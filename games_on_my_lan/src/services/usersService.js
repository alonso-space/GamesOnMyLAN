import pool from '../database/pool.js';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

async function registerUser(username, password) {
  //receive password in plain text and hash it
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await pool.query(
    `
        INSERT INTO users (username, password_hash, role_id)
        VALUES (
            $1,
            $2,
            (SELECT id_role FROM roles WHERE role_name = 'member')
        )
        RETURNING id_user
        `,
    [username, hashedPassword],
  );

  return result.rows[0].id_user;
}

async function getUserById(userId) {
  const result = await pool.query(
    `
        SELECT 
            users.id_user,
            users.username,
            roles.role_name,
            users.bio,
            users.registered_at
        FROM users
        INNER JOIN roles
            ON users.role_id = roles.id_role
        WHERE users.id_user = $1
        `,
    [userId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

async function getAllUsers() {
  const result = await pool.query(
    `
        SELECT 
            users.id_user,
            users.username,
            roles.role_name,
            users.registered_at
        FROM users
        INNER JOIN roles
            ON users.role_id = roles.id_role
        ORDER BY users.id_user
        `,
  );

  return result.rows;
}
async function updateUserRole(userId, roleName) {
  const result = await pool.query(
    `
        WITH target AS (
            SELECT u.id_user, r.role_name AS old_role
            FROM users u
            JOIN roles r ON r.id_role = u.role_id
            WHERE u.id_user = $2
              AND r.role_name IN ('member', 'admin')
        )
        UPDATE users
        SET role_id = (SELECT id_role FROM roles WHERE role_name = $1)
        FROM target
        WHERE users.id_user = target.id_user
        RETURNING users.id_user, users.username, target.old_role
        `,
    [roleName, userId],
  );

  return result.rows[0] ?? null;
}

async function deleteUser(userId) {
  // El owner nunca se elimina, aunque otra parte del código falle.
  // Los juegos y favoritos del usuario se borran en cascada (ver schema.sql).
  const result = await pool.query(
    `
        DELETE FROM users
        WHERE id_user = $1
          AND role_id <> (SELECT id_role FROM roles WHERE role_name = 'owner')
        RETURNING id_user, username
        `,
    [userId],
  );

  return result.rows[0] ?? null;
}

async function updateBio(bio, userId) {
  const result = await pool.query(
    `
        UPDATE users
        SET bio = $1
        WHERE id_user = $2
        RETURNING id_user, bio
        `,
    [bio, userId],
  );

  return result.rows[0] ?? null;
}

// Cambia la contraseña comprobando la actual. Devuelve:
//   'ok' | 'wrong_password' | 'not_found' | 'conflict' (la contraseña cambió a mitad de camino)
async function changePassword(userId, currentPassword, newPassword) {
  const found = await pool.query('SELECT password_hash FROM users WHERE id_user = $1', [userId]);

  if (found.rows.length === 0) {
    return 'not_found';
  }

  const oldHash = found.rows[0].password_hash;

  const correct = await bcrypt.compare(currentPassword, oldHash);

  if (!correct) {
    return 'wrong_password';
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // "AND password_hash = $3": si otra petición cambió la contraseña mientras tanto,
  // esta no la pisa.
  const updated = await pool.query(
    `
        UPDATE users
        SET password_hash = $1
        WHERE id_user = $2
          AND password_hash = $3
        RETURNING id_user
        `,
    [newHash, userId, oldHash],
  );

  return updated.rowCount === 0 ? 'conflict' : 'ok';
}

async function countAllUsers() {
  const result = await pool.query(
    `
        SELECT COUNT(*) AS total_users
        FROM users;
        `,
  );

  return result.rows[0].total_users;
}

export default {
  countAllUsers,
  registerUser,
  getUserById,
  getAllUsers,
  updateUserRole,
  deleteUser,
  updateBio,
  changePassword,
};
