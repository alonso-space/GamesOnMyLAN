import bcrypt from 'bcryptjs';
import readline from 'readline';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseEnv } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// install.js está dentro de admin/.
const envPath = path.join(__dirname, '..', '..', '.env');
const schemaPath = path.join(__dirname, '../src/database/schema.sql');

let rl = createReadline();

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function askDefault(question, defaultValue) {
  return new Promise((resolve) => {
    rl.question(`${question} [${defaultValue}]: `, (answer) => {
      const value = answer.trim();
      resolve(value === '' ? String(defaultValue) : value);
    });
  });
}

// Lee contraseñas sin mostrarlas en una terminal interactiva.
async function askPassword(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return ask(question);
  }

  rl.close();
  process.stdout.write(question);

  return new Promise((resolve, reject) => {
    let password = '';

    const restoreReadline = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      rl = createReadline();
    };

    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') {
          restoreReadline();
          process.stdout.write('\n');
          reject(new Error('Operación cancelada.'));
          return;
        }

        if (char === '\r' || char === '\n') {
          restoreReadline();
          process.stdout.write('\n');
          resolve(password);
          return;
        }

        if (char === '\u007f' || char === '\b') {
          password = password.slice(0, -1);
          continue;
        }

        if (char >= ' ' && char !== '\u007f') {
          password += char;
        }
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function askBoolean(question, defaultValue = true) {
  const defaultText = defaultValue ? 'S/n' : 's/N';

  while (true) {
    const value = (await ask(`${question} [${defaultText}]: `))
      .trim()
      .toLowerCase();

    if (value === '') return defaultValue;
    if (['s', 'si', 'sí', 'y', 'yes'].includes(value)) return true;
    if (['n', 'no'].includes(value)) return false;

    console.log('Respuesta no válida. Introduce S o N.');
  }
}

async function askPort(question, defaultValue, forbiddenPort) {
  while (true) {
    const answer = await askDefault(question, defaultValue);
    const port = Number(answer);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      console.log('Introduce un puerto válido entre 1 y 65535.');
      continue;
    }

    if (forbiddenPort !== undefined && port === forbiddenPort) {
      console.log('Debe ser distinto al puerto de la aplicación.');
      continue;
    }

    return port;
  }
}

async function askInstallationType() {
  console.log(`
====================================
       Tipo de instalación
====================================

[1] Instalación nueva
[2] Restauración de una instalación existente
`);

  while (true) {
    const option = (await ask('Selecciona una opción [1/2]: ')).trim();

    if (option === '1') return 'new';
    if (option === '2') return 'restore';

    console.log('\nOpción no válida.\n');
  }
}

const ENV_KEYS = {
  db_host: 'DB_HOST',
  db_port: 'DB_PORT',
  db_user: 'DB_USER',
  db_password: 'DB_PASSWORD',
  db_database: 'DB_DATABASE',

  app_port: 'APP_PORT',
  games_port: 'GAMES_PORT',

  guest_register: 'GUEST_REGISTER',
  host_ip: 'HOST_IP',

  owner_user: 'OWNER_USER',
  owner_password: 'OWNER_PASSWORD',

  limit_users: 'LIMIT_USERS',
  max_users: 'MAX_USERS',

  public_mode: 'PUBLIC_MODE',
  games_origin: 'GAMES_ORIGIN',
};

// Detecta una IPv4 local e ignora interfaces virtuales habituales.
function detectHostIp() {
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    if (/^(docker|br-|veth|virbr)/i.test(name)) continue;

    const found = (addresses ?? []).find(
      (address) => address.family === 'IPv4' && !address.internal,
    );

    if (found) return found.address;
  }

  return undefined;
}

function toEnvValue(value) {
  const text = String(value);

  if (/^[A-Za-z0-9_./:@+-]*$/.test(text)) return text;

  return JSON.stringify(text);
}

function readEnvFile() {
  if (!fs.existsSync(envPath)) return {};

  return parseEnv(fs.readFileSync(envPath, 'utf8'));
}

// Escribe el .env siguiendo el orden de .env.example.
function writeEnvFile(settings = {}) {
  const current = readEnvFile();
  const values = { ...current };

  for (const [key, envName] of Object.entries(ENV_KEYS)) {
    if (settings[key] !== undefined) {
      values[envName] = String(settings[key]);
    }
  }

  // Valores predeterminados para una instalación nueva.
  const defaults = {
    HOST_IP: '',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'goml',
    DB_PASSWORD: '',
    DB_DATABASE: 'goml_db',
    APP_PORT: '3000',
    GAMES_PORT: '3001',
    GUEST_REGISTER: 'true',
    OWNER_USER: 'owner',
    OWNER_PASSWORD: '',
    LIMIT_USERS: 'false',
    MAX_USERS: '100',
    PUBLIC_MODE: 'false',
    GAMES_ORIGIN: '',
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (values[key] === undefined) {
      values[key] = value;
    }
  }

  const lines = [];
  const written = new Set();

  function addVariable(name) {
    lines.push(`${name}=${toEnvValue(values[name] ?? '')}`);
    written.add(name);
  }

  lines.push('# IP de tu máquina en la red local');
  addVariable('HOST_IP');

  lines.push('');
  lines.push('# Base de datos. Elegir antes del primer arranque');
  addVariable('DB_HOST');
  addVariable('DB_PORT');
  addVariable('DB_USER');
  addVariable('DB_PASSWORD');
  addVariable('DB_DATABASE');

  lines.push('');
  lines.push('# Puertos de GOML y de los juegos');
  addVariable('APP_PORT');
  addVariable('GAMES_PORT');

  lines.push('');
  lines.push('# Permitir que cualquiera cree una cuenta (true / false)');
  addVariable('GUEST_REGISTER');

  lines.push('');
  lines.push('# Propietario inicial (solo se usa si la base no tiene usuarios)');
  addVariable('OWNER_USER');
  addVariable('OWNER_PASSWORD');

  lines.push('');
  lines.push('# Limitación de usuarios');
  addVariable('LIMIT_USERS');
  addVariable('MAX_USERS');

  lines.push('');
  lines.push('# Clave de sesión personalizada (opcional)');

  if (values.SESSION_SECRET !== undefined) {
    addVariable('SESSION_SECRET');
  } else {
    lines.push('# SESSION_SECRET=');
  }

  lines.push('');
  lines.push('# Modo público (internet, detrás de un proxy con HTTPS)');
  addVariable('PUBLIC_MODE');
  addVariable('GAMES_ORIGIN');

  // Conserva cualquier variable adicional que ya existiera en el .env.
  const extraVariables = Object.keys(values).filter(
    (name) => !written.has(name),
  );

  if (extraVariables.length > 0) {
    lines.push('');
    lines.push('# Otras variables de configuración');

    for (const name of extraVariables) {
      addVariable(name);
    }
  }

  lines.push('');

  const temporaryPath = `${envPath}.tmp`;

  try {
    fs.writeFileSync(temporaryPath, lines.join('\n'), {
      encoding: 'utf8',
      mode: 0o600,
    });

    fs.renameSync(temporaryPath, envPath);
    fs.chmodSync(envPath, 0o600);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }

    throw error;
  }
}

async function createSettings() {
  console.log(`
====================================
       Configuración de GOML
====================================

Introduce los datos de conexión a PostgreSQL.
Presiona ENTER para utilizar el valor indicado entre corchetes.
`);

  const db_host = (await askDefault('Host de PostgreSQL', 'localhost')).trim();
  const db_port = await askPort('Puerto de PostgreSQL', 5432);
  const db_user = (await askDefault('Usuario de PostgreSQL', 'goml')).trim();
  const db_password = await askPassword('Contraseña de PostgreSQL: ');
  const db_database = (await askDefault('Base de datos', 'goml_db')).trim();

  if (!db_host || !db_user || !db_database) {
    throw new Error(
      'El host, usuario y nombre de la base de datos son obligatorios.',
    );
  }

  console.log('');

  const app_port = await askPort('Puerto de GamesOnMyLAN', 3000);
  const games_port = await askPort(
    'Puerto del servidor de juegos',
    3001,
    app_port,
  );

  const guest_register = await askBoolean(
    '¿Permitir registro de invitados?',
    true,
  );

  const host_ip = detectHostIp();

  console.log(
    host_ip
      ? `\nIP detectada: ${host_ip}`
      : '\nNo se detectó la IP; cert.js la buscará al generar el certificado.',
  );

  const settings = {
    db_host,
    db_port,
    db_user,
    db_password,
    db_database,

    app_port,
    games_port,

    guest_register,
    host_ip,

    limit_users: false,
    max_users: 100,

    public_mode: false,
    games_origin: '',
  };

  // No modifica las credenciales del propietario durante la configuración general.
  writeEnvFile(settings);

  console.log('\n✓ .env creado correctamente.');

  return settings;
}

function loadSettings() {
  const values = readEnvFile();
  const settings = {};

  for (const [key, envName] of Object.entries(ENV_KEYS)) {
    settings[key] = values[envName];
  }

  return settings;
}

async function configureSettings() {
  if (!fs.existsSync(envPath)) {
    return createSettings();
  }

  console.log(`
====================================
       .env encontrado
====================================

Ya existe un archivo .env.
`);

  console.log('[1] Usar configuración existente');
  console.log('[2] Reconfigurar');
  console.log('[3] Cancelar');

  while (true) {
    const option = (await ask('\nSelecciona una opción [1/2/3]: ')).trim();

    if (option === '1') {
      console.log('\n✓ Se utilizará la configuración existente.');
      return loadSettings();
    }

    if (option === '2') {
      console.log('\nSe actualizará la configuración.');
      return createSettings();
    }

    if (option === '3') {
      console.log('\nInstalación cancelada.');
      process.exit(0);
    }

    console.log('\nOpción no válida.');
  }
}

async function connectDatabase() {
  // pool.js lee la configuración al importarse.
  const { default: db } = await import('../src/database/pool.js');

  try {
    const result = await db.query('SELECT current_database();');

    console.log('✓ Conectado a PostgreSQL.');
    console.log(`  Base de datos: ${result.rows[0].current_database}`);

    return db;
  } catch (error) {
    console.error(`
====================================
     Error de conexión
====================================

No se pudo conectar a PostgreSQL.

Comprueba que PostgreSQL esté instalado y ejecutándose,
y revisa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_DATABASE.

Error: ${error.message}
`);

    throw error;
  }
}

async function newInstallation(db) {
  console.log(`
====================================
       Instalación nueva
====================================
`);

  console.log('[1/2] Creando estructura de base de datos...');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`No se encontró schema.sql en:\n${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  await db.query(schema);

  console.log('✓ Base de datos preparada.');

  console.log(`
[2/2] Configurar propietario inicial
`);

  // Siempre se solicitan las credenciales iniciales.
  const username = (await askDefault('Usuario owner inicial', 'owner')).trim();

  if (!username) {
    throw new Error('El nombre de usuario no puede estar vacío.');
  }

  if (username.length > 50) {
    throw new Error('El nombre de usuario no puede superar los 50 caracteres.');
  }

  const password = await askPassword('Contraseña owner inicial: ');

  if (!password) {
    throw new Error('La contraseña no puede estar vacía.');
  }

  // Se guardan antes de comprobar si se creará el usuario.
  // Así también estarán disponibles para Docker si ya existen usuarios.
  writeEnvFile({
    owner_user: username,
    owner_password: password,
  });

  console.log('✓ Credenciales iniciales guardadas en .env.');

  const result = await db.query('SELECT COUNT(*) FROM users;');

  if (Number(result.rows[0].count) > 0) {
    console.log(`
Ya existen usuarios en la base de datos.

No se creará otro usuario owner.

Las credenciales iniciales introducidas
se conservaron en el archivo .env.
`);
    return;
  }

  const createOwner = await askBoolean(
    '¿Crear este usuario como propietario inicial?',
    true,
  );

  if (!createOwner) {
    console.log(`
No se creó el propietario en PostgreSQL.

Las credenciales introducidas se mantienen
en el archivo .env.
`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);

  await db.query(
    `
      INSERT INTO users (username, password_hash, role_id)
      VALUES (
        $1,
        $2,
        (
          SELECT id_role
          FROM roles
          WHERE role_name = 'owner'
        )
      );
    `,
    [username, hash],
  );

  console.log('\n✓ Owner creado correctamente.');
}

async function restoreInstallation() {
  const settings = loadSettings();

  console.log(`
====================================
       Restauración
====================================

GamesOnMyLAN no modificará la estructura
ni los datos de la base de datos.

Debes restaurar manualmente el respaldo
de PostgreSQL antes de iniciar GOML.

Configuración actual:

    Host:       ${settings.db_host ?? ''}
    Puerto:     ${settings.db_port ?? ''}
    Usuario:    ${settings.db_user ?? ''}
    Base datos: ${settings.db_database ?? ''}

IMPORTANTE:

NO ejecutes schema.sql.

El respaldo ya contiene la estructura y los
datos de la instalación anterior.

Consulta el manual de administración de
GamesOnMyLAN para las instrucciones completas
de backup y restauración.

====================================
     Restauración preparada
====================================
`);

  await ask('\nPresiona ENTER para finalizar...');
}

function showFinalMessage() {
  console.log(`
====================================
     Instalación completada
====================================

Antes de iniciar GamesOnMyLAN debes generar
los certificados HTTPS:

    node admin/cert.js

Esto creará la carpeta "certs" en el
directorio raíz del proyecto.

Si los certificados ya existen pero la IP
local cambió, elimina la carpeta "certs"
y vuelve a ejecutar el script.

También puedes revisar el archivo .env si
necesitas modificar alguna configuración.

====================================
`);
}

async function main() {
  let db = null;

  try {
    console.log(`
====================================
      GamesOnMyLAN Installer
====================================
`);

    console.log('[1/4] Configurando GamesOnMyLAN...');
    await configureSettings();

    console.log('\n[2/4] Seleccionando tipo de instalación...');
    const installationType = await askInstallationType();

    if (installationType === 'restore') {
      console.log('\n[3/4] Preparando restauración...');
      await restoreInstallation();
      return;
    }

    console.log('\n[3/4] Comprobando PostgreSQL...');
    db = await connectDatabase();

    console.log('\n[4/4] Instalando GamesOnMyLAN...');
    await newInstallation(db);

    showFinalMessage();
  } catch (error) {
    console.error(`
====================================
              ERROR
====================================

${error.message}
`);

    process.exitCode = 1;
  } finally {
    rl.close();

    if (db) {
      await db.end();
    }
  }
}

main();
