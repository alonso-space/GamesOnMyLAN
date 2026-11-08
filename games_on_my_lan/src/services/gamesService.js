import pool from '../database/pool.js';

async function createGame(game) {
  const result = await pool.query(
    `
        INSERT INTO games
        (
            game_name,
            game_description,
            entry_file,
            author_id
        )
        VALUES ($1,$2,$3,$4)
        RETURNING *;
        `,
    [game.game_name, game.game_description, game.entry_file, game.author_id],
  );

  return result.rows[0];
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
            u.username AS author_name,
            (f.game_id IS NOT NULL) AS is_favorite
        FROM games g
        JOIN users u
            ON g.author_id = u.id_user
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
            g.author_id,
            g.updated_at,
            g.created_at,
            u.username AS author_name,
            r.role_name AS author_role
        FROM games g
        JOIN users u ON g.author_id = u.id_user
        JOIN roles r ON u.role_id = r.id_role
        WHERE g.id_game = $1;`,
    [id_game],
  );

  return result.rows[0];
}

async function getGamesByAuthorId(author_id) {
  const result = await pool.query(
    `
        SELECT *
        FROM games
        WHERE author_id = $1
        ORDER BY updated_at DESC;
        `,
    [author_id],
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
            updated_at = NOW()
        WHERE id_game = $4
        RETURNING *;
        `,
    [game.game_name, game.game_description, game.entry_file, id_game],
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
  getAllGames,
  getGameById,
  getGamesByAuthorId,
  deleteGame,
  updateGame,
};
