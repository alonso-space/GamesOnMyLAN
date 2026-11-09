import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

function read(name) {
  const value = process.env[name];
  return value === '' ? undefined : value;
}

function toNumber(value) {
  return value === undefined ? undefined : Number(value);
}

function toBoolean(value) {
  if (value === undefined) {
    return undefined;
  }
  return ['1', 'true', 'yes', 'si', 'sí'].includes(value.toLowerCase());
}

const settings = {
  db_host: read('DB_HOST'),
  db_port: toNumber(read('DB_PORT')),
  db_user: read('DB_USER'),
  db_password: read('DB_PASSWORD'),
  db_database: read('DB_DATABASE'),

  app_port: toNumber(read('APP_PORT')),
  games_port: toNumber(read('GAMES_PORT')),

  guest_register: toBoolean(read('GUEST_REGISTER')),
  session_secret: read('SESSION_SECRET'),
  host_ip: read('HOST_IP'),

  public_mode: toBoolean(read('PUBLIC_MODE')),
  games_origin: read('GAMES_ORIGIN'),

  limit_users: toBoolean(read('LIMIT_USERS')),
  max_users: toNumber(read('MAX_USERS')),

  limit_games: toBoolean(read('LIMIT_GAMES')),
  games_qty: toNumber(read('GAMES_QTY')),
  max_mbs: toNumber(read('MAX_MBS')),
};

if (settings.limit_users && !(Number.isInteger(settings.max_users) && settings.max_users > 0)) {
  throw new Error('LIMIT_USERS=true requiere que MAX_USERS sea un entero mayor que 0');
}

if (settings.limit_games) {
  const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

  if (!isPositiveInteger(settings.games_qty) || !isPositiveInteger(settings.max_mbs)) {
    throw new Error('LIMIT_GAMES=true requiere que GAMES_QTY y MAX_MBS sean enteros mayores que 0');
  }
}

export default settings;
