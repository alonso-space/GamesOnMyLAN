import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { MAX_GAME_BYTES, MAX_IMAGE_BYTES } from '../utils/limits.js';

const TEMP_DIR = path.resolve('temp');
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Almacenamiento en disco (como el de multer) pero con un límite de tamaño
// POR CAMPO. Multer solo permite un límite global por instancia, y como el
// juego (1 GB) y la miniatura viajan en la misma petición, la miniatura
// podría llegar a pesar 1 GB. Aquí se corta en cuanto supera su máximo.
// Cada límite puede ser un número o una función (req) => número.
function createStorage(fieldLimits) {
  return {
    _handleFile(req, file, cb) {
      const spec = fieldLimits[file.fieldname];
      const limit = typeof spec === 'function' ? spec(req) : spec;
      const filename = crypto.randomBytes(16).toString('hex');
      const filePath = path.join(TEMP_DIR, filename);
      const out = fs.createWriteStream(filePath);

      let size = 0;
      let done = false;

      const fail = (err) => {
        if (done) return;
        done = true;
        file.stream.unpipe(out);
        out.destroy();
        fs.unlink(filePath, () => {});
        file.stream.resume(); // descarta lo que falta por llegar
        cb(err);
      };

      file.stream.on('data', (chunk) => {
        size += chunk.length;

        if (limit !== undefined && size > limit) {
          const err = new Error('El archivo es demasiado grande');
          err.code = 'LIMIT_FILE_SIZE';

          if (file.fieldname === 'gameFile' && limit < MAX_GAME_BYTES) {
            err.publicMessage = 'Superarías tu límite de almacenamiento';
          }

          fail(err);
        }
      });

      file.stream.on('error', fail);
      out.on('error', fail);

      out.on('finish', () => {
        if (done) return;
        done = true;
        cb(null, {
          destination: TEMP_DIR,
          filename,
          path: filePath,
          size,
        });
      });

      file.stream.pipe(out);
    },

    // Multer lo llama para limpiar archivos cuando la petición falla. El
    // archivo que falló ya se borró en fail() y no tiene "path", así que
    // esos casos no son un error.
    _removeFile(req, file, cb) {
      if (!file.path) return cb(null);

      fs.unlink(file.path, (err) => {
        cb(err && err.code !== 'ENOENT' ? err : null);
      });
    },
  };
}

// Juegos (.zip) y miniaturas (.png)
const upload = multer({
  storage: createStorage({
    // Con límites activos, el zip no puede superar el espacio que le queda al usuario
    gameFile: (req) => Math.min(MAX_GAME_BYTES, req.quota?.remainingBytes ?? MAX_GAME_BYTES),
    thumbnail: MAX_IMAGE_BYTES,
  }),
  limits: {
    fileSize: MAX_GAME_BYTES,
    files: 2,
    fields: 10,
    fieldSize: 10 * 1024,
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === 'gameFile' && ext === '.zip') return cb(null, true);
    if (file.fieldname === 'thumbnail' && ext === '.png') return cb(null, true);

    const err = new Error('Tipo de archivo no permitido');
    err.status = 400;
    cb(err);
  },
});

// Fotos de perfil (.png)
export const uploadAvatar = multer({
  storage: createStorage({
    avatar: MAX_IMAGE_BYTES,
  }),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    fields: 2,
    fieldSize: 1024,
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === 'avatar' && ext === '.png') return cb(null, true);

    const err = new Error('Solo se permite una imagen PNG');
    err.status = 400;
    cb(err);
  },
});

export default upload;
