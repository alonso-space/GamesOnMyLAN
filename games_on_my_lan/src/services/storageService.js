import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import unzipper from 'unzipper';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { assertPngFile } from '../utils/validators.js';
import { MAX_IMAGE_BYTES } from '../utils/limits.js';
import { QuotaError } from '../utils/quota.js';
import { moveFile } from '../utils/moveFile.js';

const DATA_PATH = path.join(process.cwd(), 'data');
const DEFAULT_THUMBNAIL = path.join(process.cwd(), 'src', 'public', 'img', 'default_game.png');

const MAX_FILES = 10000;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

// ---------- Funciones privadas (no se exportan) ----------

// Extracción con protección Zip Slip, reutilizable para juegos nuevos y reemplazos.
// maxBytes: tope de lo que puede ocupar descomprimido (el cupo del usuario, si tiene).
// Devuelve los bytes reales extraídos.
async function extractZipSafely(zipFilePath, destFolder, maxBytes = MAX_TOTAL_BYTES) {
  const resolvedRoot = path.resolve(destFolder);
  const limit = Math.min(maxBytes, MAX_TOTAL_BYTES);
  const directory = await unzipper.Open.file(zipFilePath);

  const tooBig = () =>
    limit < MAX_TOTAL_BYTES
      ? new QuotaError('Superarías tu límite de almacenamiento', 413)
      : new Error('ZIP demasiado grande al descomprimir');

  // Capa 2: rechazo rápido según lo que el zip DECLARA
  if (directory.files.length > MAX_FILES) {
    throw new Error('ZIP con demasiados archivos');
  }

  const declaredTotal = directory.files.reduce((sum, f) => sum + (f.uncompressedSize || 0), 0);

  if (declaredTotal > limit) {
    throw tooBig();
  }

  // Capa 3: conteo de bytes REALES (el tamaño declarado se puede falsificar)
  let total = 0;

  for (const file of directory.files) {
    const destPath = path.resolve(path.join(destFolder, file.path));

    if (destPath !== resolvedRoot && !destPath.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`ZIP inválido: entrada fuera de la carpeta destino (${file.path})`);
    }

    if (file.type === 'Directory') {
      await fsp.mkdir(destPath, { recursive: true });
      continue;
    }

    await fsp.mkdir(path.dirname(destPath), { recursive: true });

    const declaredSize = file.uncompressedSize || 0;
    let fileBytes = 0;

    await pipeline(
      file.stream(),
      new Transform({
        transform(chunk, enc, cb) {
          fileBytes += chunk.length;
          total += chunk.length;

          if (fileBytes > declaredSize) {
            return cb(new Error('ZIP inválido: un archivo excede su tamaño declarado'));
          }

          if (total > limit) {
            return cb(tooBig());
          }

          cb(null, chunk);
        },
      }),
      fs.createWriteStream(destPath),
    );
  }

  return total;
}

// Respaldo: el middleware ya corta las subidas que superan el límite
function assertImageSize(file, label) {
  if (file.size > MAX_IMAGE_BYTES) {
    const err = new Error(`${label} no puede pesar más de ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`);
    err.status = 400;
    throw err;
  }
}

async function normalizeGameFolder(gameFolder, entry_file) {
  const root = path.resolve(gameFolder);
  const target = path.resolve(root, entry_file);

  if (!target.startsWith(root + path.sep)) {
    throw new Error('Archivo principal inválido');
  }

  try {
    await fsp.access(path.join(gameFolder, entry_file));
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const entries = await fsp.readdir(gameFolder, { withFileTypes: true });

  if (entries.length !== 1 || !entries[0].isDirectory()) {
    throw new Error('El archivo principal no se encontró en la raíz del ZIP.');
  }

  const innerFolder = path.join(gameFolder, entries[0].name);

  try {
    await fsp.access(path.join(innerFolder, entry_file));
  } catch {
    throw new Error('El archivo principal no existe dentro del ZIP.');
  }

  // Renombrar la carpeta contenedora a un nombre temporal para que ningún
  // hijo (ej: games/games) choque con el nombre de su propio padre.
  const tempFolder = path.join(gameFolder, `__normalize_${Date.now()}`);
  await fsp.rename(innerFolder, tempFolder);

  const innerEntries = await fsp.readdir(tempFolder);

  for (const entry of innerEntries) {
    await fsp.rename(path.join(tempFolder, entry), path.join(gameFolder, entry));
  }
  await fsp.rmdir(tempFolder);
}

// ---------- Funciones públicas ----------

async function extractGame(zipFile, id_game, entry_file, { maxBytes } = {}) {
  const gameFolder = path.join(DATA_PATH, 'games', String(id_game));
  await fsp.mkdir(gameFolder, { recursive: true });

  const bytes = await extractZipSafely(zipFile.path, gameFolder, maxBytes);

  await normalizeGameFolder(gameFolder, entry_file);
  await fsp.unlink(zipFile.path);
  return { gameFolder, bytes };
}

// Para reemplazar archivos de un juego que YA existe: extrae a una carpeta
// temporal primero. Solo si todo sale bien, borra la carpeta real y pone
// la nueva en su lugar. Si algo falla, el juego actual queda intacto.
async function replaceGameFiles(id_game, zipFile, entry_file, { maxBytes } = {}) {
  const finalFolder = path.join(DATA_PATH, 'games', String(id_game));
  const stagingFolder = path.join(DATA_PATH, 'games', `${id_game}_staging_${Date.now()}`);

  await fsp.mkdir(stagingFolder, { recursive: true });

  let bytes;

  try {
    bytes = await extractZipSafely(zipFile.path, stagingFolder, maxBytes);
    await normalizeGameFolder(stagingFolder, entry_file);
  } catch (error) {
    await fsp.rm(stagingFolder, { recursive: true, force: true });
    throw error;
  }

  await fsp.rm(finalFolder, { recursive: true, force: true });
  await fsp.rename(stagingFolder, finalFolder);
  await fsp.unlink(zipFile.path);

  return { finalFolder, bytes };
}

async function storeThumbnail(thumbnailFile, id_game) {
  if (thumbnailFile) {
    assertImageSize(thumbnailFile, 'La miniatura');
    await assertPngFile(thumbnailFile.path);
  }

  const thumbnailFolder = path.join(DATA_PATH, 'thumbnails');
  await fsp.mkdir(thumbnailFolder, { recursive: true });

  const thumbnailPath = path.join(thumbnailFolder, `${id_game}.png`);

  if (thumbnailFile) {
    await moveFile(thumbnailFile.path, thumbnailPath);
  } else {
    await fsp.copyFile(DEFAULT_THUMBNAIL, thumbnailPath);
  }

  return thumbnailPath;
}

// Foto de perfil: data/avatars/<id_usuario>.png (sobrescribe la anterior)
async function storeAvatar(avatarFile, id_user) {
  assertImageSize(avatarFile, 'La foto de perfil');
  await assertPngFile(avatarFile.path);

  const avatarFolder = path.join(DATA_PATH, 'avatars');
  await fsp.mkdir(avatarFolder, { recursive: true });

  const avatarPath = path.join(avatarFolder, `${id_user}.png`);
  await moveFile(avatarFile.path, avatarPath);

  return avatarPath;
}

async function deleteGameFiles(id_game) {
  const gameFolder = path.join(DATA_PATH, 'games', String(id_game));
  const thumbnailPath = path.join(DATA_PATH, 'thumbnails', `${id_game}.png`);

  await fsp.rm(gameFolder, { recursive: true, force: true });
  await fsp.rm(thumbnailPath, { force: true });
}

async function deleteAvatar(id_user) {
  const avatarPath = path.join(DATA_PATH, 'avatars', `${id_user}.png`);
  await fsp.rm(avatarPath, { force: true });
}

export default {
  extractGame,
  replaceGameFiles,
  storeThumbnail,
  storeAvatar,
  deleteGameFiles,
  deleteAvatar,
};
