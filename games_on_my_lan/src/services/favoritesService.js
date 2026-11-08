import pool from '../database/pool.js';

async function addFavorite(favorite) {
  const result = await pool.query(
    `
        INSERT INTO favorites (
            user_id,
            game_id
        )
        VALUES ($1, $2)
        ON CONFLICT (user_id, game_id) DO NOTHING
        RETURNING *;
        `,
    [favorite.user_id, favorite.game_id],
  );

  return result.rows[0];
}

async function deleteFavorite(favorite) {
  const result = await pool.query(
    `
        DELETE FROM favorites
        WHERE user_id = $1
          AND game_id = $2
        RETURNING *;
        `,
    [favorite.user_id, favorite.game_id],
  );

  return result.rows[0] ?? null;
}

async function checkFavorite(user_id, game_id) {
  const result = await pool.query(
    `
        SELECT EXISTS (
            SELECT 1
            FROM favorites
            WHERE user_id = $1
              AND game_id = $2
        ) AS is_favorited;
        `,
    [user_id, game_id],
  );

  return result.rows[0].is_favorited;
}

export default {
  addFavorite,
  deleteFavorite,
  checkFavorite,
};
