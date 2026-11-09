CREATE TABLE IF NOT EXISTS roles (
    id_role SERIAL PRIMARY KEY,
    role_name VARCHAR(25) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    id_user SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL,
    bio TEXT,
    trusted BOOLEAN NOT NULL DEFAULT FALSE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (role_id)
        REFERENCES roles(id_role)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS games (
    id_game SERIAL PRIMARY KEY,
    game_name VARCHAR(100) NOT NULL,
    game_description TEXT,
    entry_file TEXT NOT NULL DEFAULT 'index.html',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    author_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (author_id)
        REFERENCES users(id_user)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
    id_favorite SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,

    UNIQUE (user_id, game_id),

    FOREIGN KEY (user_id)
        REFERENCES users(id_user)
        ON DELETE CASCADE,

    FOREIGN KEY (game_id)
        REFERENCES games(id_game)
        ON DELETE CASCADE
);

INSERT INTO roles (role_name)
VALUES
    ('owner'),
    ('admin'),
    ('member')
ON CONFLICT (role_name) DO NOTHING;

-- Migraciones para bases creadas antes de estas columnas (no hacen nada si ya existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
          AND column_name = 'trusted'
    ) THEN
        ALTER TABLE users ADD COLUMN trusted BOOLEAN NOT NULL DEFAULT FALSE;

        UPDATE users
        SET trusted = TRUE
        WHERE role_id = (SELECT id_role FROM roles WHERE role_name = 'owner');
    END IF;
END $$;

ALTER TABLE games ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;
