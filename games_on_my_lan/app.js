import express from 'express';
import methodOverride from 'method-override';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import { engine } from 'express-handlebars';

import settings from './admin/getSettings.js';
import { getGamesOrigin } from './src/config.js';
import { startServers } from './src/startServers.js';

import homeRouter from './src/routes/homeRouter.js';
import authRouter from './src/routes/authRouter.js';
import gamesRouter from './src/routes/gamesRouter.js';
import usersRouter from './src/routes/usersRouter.js';
import favoritesRouter from './src/routes/favoritesRouter.js';

import { csrfProtection } from './src/middlewares/csrf.js';
import { getSessionSecret } from './src/utils/sessionSecret.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

if (settings.public_mode) {
  app.set('trust proxy', 1);
}

// Motor de vistas
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'main',
  }),
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, './src/views'));

// Middlewares globales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(csrfProtection);
app.use(methodOverride('_method'));

app.use(
  session({
    name: '__Host-goml.sid',
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3600000,
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      path: '/', // obligatorio para __Host-. No agregues "domain".
    },
  }),
);

// Datos disponibles en todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.gamesOrigin = getGamesOrigin(req);

  next();
});

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use('/thumbnails', express.static(path.join(process.cwd(), 'data', 'thumbnails')));
app.use('/avatars', express.static(path.join(process.cwd(), 'data', 'avatars')));

// Rutas
app.use('/', homeRouter);
app.use('/auth', authRouter);
app.use('/games', gamesRouter);
app.use('/users', usersRouter);
app.use('/favorites', favoritesRouter);

// Manejador de errores: debe ir al final
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === 'QuotaError') {
    return res.status(err.status).send(err.message);
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).send(err.publicMessage ?? 'El archivo es demasiado grande');
  }

  if (err.name === 'MulterError' || err.status === 400) {
    return res.status(400).send(err.message);
  }

  console.error(err);
  res.status(500).send('Error procesando la solicitud');
});

startServers(app);
