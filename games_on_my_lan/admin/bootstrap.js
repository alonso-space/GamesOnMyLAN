import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import db from '../src/database/pool.js';
import { measureFolder } from '../src/utils/folderSize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../src/database/schema.sql');

// Recalcula size_bytes con lo que hay en disco. Al arrancar no hay subidas en curso, así que
// también corrige reservas que hubieran quedado de un cierre inesperado.
async function syncGameSizes() {
  const gamesDir = path.join(process.cwd(), 'data', 'games');

  // Sin carpeta de datos (p. ej. se ejecutó desde otro directorio) no se toca nada
  if (!fs.existsSync(gamesDir)) return;

  const { rows } = await db.query('SELECT id_game, size_bytes FROM games');
  let updated = 0;

  for (const row of rows) {
    const bytes = await measureFolder(path.join(gamesDir, String(row.id_game)));

    if (bytes !== Number(row.size_bytes)) {
      await db.query('UPDATE games SET size_bytes = $1 WHERE id_game = $2', [bytes, row.id_game]);
      updated++;
    }
  }

  console.log(`✓ Tamaños de juegos sincronizados (${updated} actualizados).`);
}

async function main() {
  await db.query(fs.readFileSync(schemaPath, 'utf8'));
  console.log('✓ Estructura de la base de datos lista.');

  await syncGameSizes();

  const { rows } = await db.query('SELECT COUNT(*) FROM users');

  if (Number(rows[0].count) > 0) {
    console.log('✓ Ya existen usuarios: no se crea propietario.');
    return;
  }

  const username = (process.env.OWNER_USER ?? '').trim();
  const password = process.env.OWNER_PASSWORD ?? '';

  if (!username || !password) {
    throw new Error('La base no tiene usuarios. Define OWNER_USER y OWNER_PASSWORD ');
  }

  const hash = await bcrypt.hash(password, 12);

  await db.query(
    `INSERT INTO users (username, password_hash, role_id, trusted)
         VALUES ($1, $2, (SELECT id_role FROM roles WHERE role_name = 'owner'), TRUE)`,
    [username, hash],
  );

  console.log(`✓ Propietario "${username}" creado.`);
}

try {
  await main();
} catch (error) {
  console.error('Error en bootstrap:', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
