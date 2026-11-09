import pool from '../database/pool.js';
import { QuotaError, computeQuota, quotaViolation } from '../utils/quota.js';

// Clave del lock de Postgres que serializa las comprobaciones de cupo de un mismo usuario
const QUOTA_LOCK_KEY = 7301;

// Ejecuta fn dentro de una transacción con un lock por usuario. Así dos subidas
// simultáneas del mismo usuario no pueden comprobar el cupo a la vez y pasarse del límite.
async function withUserLock(userId, fn) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [QUOTA_LOCK_KEY, userId]);

    const result = await fn(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Juegos y bytes que ya ocupa un usuario. excludeGameId: ignora un juego (el que se reemplaza).
async function getUsage(uploaderId, excludeGameId = null, db = pool) {
  const result = await db.query(
    `
        SELECT
            COUNT(*)::int AS games,
            COALESCE(SUM(size_bytes), 0)::float8 AS bytes
        FROM games
        WHERE uploader_id = $1
          AND ($2::int IS NULL OR id_game <> $2);
        `,
    [uploaderId, excludeGameId],
  );

  return result.rows[0];
}

function insertGame(db, game, sizeBytes) {
  return db.query(
    `
        INSERT INTO games
        (
            game_name,
            game_description,
            entry_file,
            uploader_id,
            original_author,
            source_url,
            size_bytes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *;
        `,
    [
      game.game_name,
      game.game_description,
      game.entry_file,
      game.uploader_id,
      game.original_author,
      game.source_url,
      sizeBytes,
    ],
  );
}

// Sin quota crea el juego sin más. Con quota (límites activos) comprueba el cupo dentro del
// lock y RESERVA todo el espacio que le queda al usuario en size_bytes mientras se extrae
// el zip; setGameSize deja después el tamaño real. El tope de extracción es esa reserva.
async function createGame(game, quota = null) {
  if (!quota) {
    const result = await insertGame(pool, game, 0);
    return result.rows[0];
  }

  return withUserLock(game.uploader_id, async (client) => {
    const usage = await getUsage(game.uploader_id, null, client);
    const current = computeQuota(quota, usage);
    const violation = quotaViolation(current);

    if (violation) throw new QuotaError(violation);

    const result = await insertGame(client, game, current.remainingBytes);
    return result.rows[0];
  });
}

// Igual que createGame pero para reemplazar el zip de un juego existente. Devuelve el tamaño
// anterior (para restaurarlo si falla) y el máximo que puede ocupar el zip nuevo.
async function reserveReplacement(gameId, uploaderId, quota) {
  return withUserLock(uploaderId, async (client) => {
    const usage = await getUsage(uploaderId, gameId, client);
    const current = computeQuota(quota, usage);
    const violation = quotaViolation(current, { checkGames: false });

    if (violation) throw new QuotaError(violation);

    const previous = await client.query('SELECT size_bytes FROM games WHERE id_game = $1', [
      gameId,
    ]);

    await client.query('UPDATE games SET size_bytes = $1 WHERE id_game = $2', [
      current.remainingBytes,
      gameId,
    ]);

    return {
      previousBytes: Number(previous.rows[0]?.size_bytes ?? 0),
      budget: current.remainingBytes,
    };
  });
}

async function setGameSize(id_game, sizeBytes) {
  await pool.query('UPDATE games SET size_bytes = $1 WHERE id_game = $2', [sizeBytes, id_game]);
}

async function getAllGames(userId) {
  const result = await pool.query(
    `
        SELECT
            g.id_game,
            g.game_name,
            g.game_description,
            g.entry_file,
            g.updated_at,
            g.original_author,
            g.source_url,
            u.username AS uploader_name,
            (f.game_id IS NOT NULL) AS is_favorite
        FROM games g
        JOIN users u
            ON g.uploader_id = u.id_user
        LEFT JOIN favorites f
            ON f.game_id = g.id_game
            AND f.user_id = $1
        ORDER BY
            (f.game_id IS NOT NULL) DESC,
            g.updated_at DESC;
        `,
    [userId],
  );

  return result.rows;
}

async function getGameById(id_game) {
  const result = await pool.query(
    `
        SELECT
            g.id_game,
            g.game_name,
            g.game_description,
            g.entry_file,
            g.uploader_id,
            g.original_author,
            g.source_url,
            g.updated_at,
            g.created_at,
            u.username AS uploader_name,
            r.role_name AS uploader_role
        FROM games g
        JOIN users u ON g.uploader_id = u.id_user
        JOIN roles r ON u.role_id = r.id_role
        WHERE g.id_game = $1;`,
    [id_game],
  );

  return result.rows[0];
}

async function getGamesByUploaderId(uploader_id) {
  const result = await pool.query(
    `
        SELECT *
        FROM games
        WHERE uploader_id = $1
        ORDER BY updated_at DESC;
        `,
    [uploader_id],
  );

  return result.rows;
}

async function deleteGame(id_game) {
  const result = await pool.query(
    `
        DELETE FROM games
        WHERE id_game = $1
        RETURNING *;
        `,
    [id_game],
  );

  return result.rows[0];
}

async function updateGame(id_game, game) {
  const result = await pool.query(
    `
        UPDATE games
        SET
            game_name = $1,
            game_description = $2,
            entry_file = $3,
            original_author = $4,
            source_url = $5,
            updated_at = NOW()
        WHERE id_game = $6
        RETURNING *;
        `,
    [
      game.game_name,
      game.game_description,
      game.entry_file,
      game.original_author,
      game.source_url,
      id_game,
    ],
  );

  return result.rows[0];
}

async function countAllGames() {
  const result = await pool.query(
    `
        SELECT COUNT(*) AS total_games
        FROM games;
        `,
  );

  return parseInt(result.rows[0].total_games, 10);
}

export default {
  countAllGames,
  createGame,
  getUsage,
  reserveReplacement,
  setGameSize,
  getAllGames,
  getGameById,
  getGamesByUploaderId,
  deleteGame,
  updateGame,
};
