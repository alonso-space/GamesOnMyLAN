# GamesOnMyLAN

A self-hosted LAN game distribution platform for hosting, managing, and playing browser-based games. Designed by a student, for students.

**Manual:** [How To GamesOnMyLAN](https://alonso-space.github.io/GamesOnMyLAN/)

## What is it?

GamesOnMyLAN (GOML) turns one computer into a small games portal for your local network. Anyone on the network can sign in, browse the catalog, and play browser games, with no internet connection needed. Members can also upload their own games.

## Features

- **User accounts** with three roles: `owner`, `admin` and `member`. Registration for guests can be turned on or off.
- **Upload games as a `.zip`**, with a configurable entry file (`index.html` by default), a description and a thumbnail.
- **Favorites**, user profiles with a bio and avatar, and password change.
- **HTTPS out of the box:** a certificate for your LAN IP is generated on first start.
- **Games run on a separate origin** (their own port), so a game cannot touch the site's session.
- **Security basics:** hashed passwords (bcrypt), CSRF protection, rate limiting, strict session cookies and security headers.
- **Public mode** for internet deployments behind a Caddy reverse proxy.
- **Tested:** unit tests with Vitest, linting with ESLint and formatting with Prettier.

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) with Docker Compose.

1. Clone the repository and go into the folder:

   ```bash
   git clone https://github.com/alonso-space/GamesOnMyLAN.git
   cd GamesOnMyLAN
   ```

2. Create your configuration file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`. At least set `HOST_IP` (your machine's IP on the local network, e.g. from `hostname -I` on Linux), `DB_PASSWORD` and `OWNER_PASSWORD`. Choose the database values **before** the first start.

4. Build and start everything:

   ```bash
   docker compose up -d --build
   ```

5. Open `https://<HOST_IP>:3000` from any device on the network and sign in with `OWNER_USER` / `OWNER_PASSWORD`.

The owner account is created on the first start, only if the database has no users yet. You can add more users later from the command line:

```bash
docker compose exec goml node admin/new_user.js
```

## Configuration

All settings live in the `.env` file (see [`.env.example`](.env.example)).

| Variable | What it does | Default |
| --- | --- | --- |
| `HOST_IP` | Your machine's IP on the LAN, used for the HTTPS certificate | none (required in LAN mode) |
| `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` | Database credentials | `goml`, none (required), `goml_db` |
| `APP_PORT` | Port of the main site | `3000` |
| `GAMES_PORT` | Port where games are served | `3001` |
| `GUEST_REGISTER` | Allow anyone to create an account (`true` / `false`) | `true` |
| `LIMIT_USERS`, `MAX_USERS` | Cap the number of accounts: with `LIMIT_USERS=true`, registration closes once `MAX_USERS` is reached (must be an integer > 0) | `false`, `100` |
| `OWNER_USER`, `OWNER_PASSWORD` | Initial owner, used only when the database has no users | none |
| `SESSION_SECRET` | Optional. If empty, a random one is generated on first start | empty |
| `PUBLIC_MODE`, `GAMES_ORIGIN` | Internet deployment behind a proxy with HTTPS. Leave empty on a LAN | empty |

## Public mode

To serve GOML on the internet, the repository includes `docker-compose.public.yml` and a `Caddyfile` that put a Caddy reverse proxy with HTTPS in front of the app. In this mode the app ports are not exposed directly, and `GAMES_ORIGIN` must point to the domain used for games. The [manual](https://alonso-space.github.io/GamesOnMyLAN/) explains the setup.

## Project structure

```
GamesOnMyLAN/
├── games_on_my_lan/   # The server (Express app, views, database schema, tests)
├── gomlmanual/        # Source of the "How To" manual website
├── docker-compose.yml # App + PostgreSQL
├── docker-compose.public.yml  # Public mode with Caddy
└── .env.example       # Configuration template
```

## Development

Tests and linting run from the server folder:

```bash
cd games_on_my_lan
npm ci
npm test          # run the tests once
npm run lint      # check the code with ESLint
npm run format    # format the code with Prettier
```

## License

This project is licensed under the AGPL-3.0. See [LICENSE](LICENSE) for details.