import gamesService from '../services/gamesService.js';
import usersService from '../services/usersService.js';
import { canDeleteGame, canDeleteUser } from '../utils/permissions.js';
import { isValidId } from '../utils/validators.js';

// Para acciones (POST, PUT, DELETE): responde 401 si no hay sesión
export function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).send('Debes iniciar sesión');
  }

  next();
}

// Para páginas: manda a la pantalla de login si no hay sesión
export function requireLoginPage(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  next();
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    const user = await usersService.getUserById(req.session.user.id);

    if (!user) {
      return res.status(403).send('Usuario no encontrado');
    }

    if (!roles.includes(user.role_name)) {
      return res.status(403).send('Sin permisos');
    }

    next();
  };
}

export async function requireOwnership(req, res, next) {
  const gameId = req.params.gameId;

  if (!isValidId(gameId)) {
    return res.status(404).send('Juego no encontrado');
  }

  const game = await gamesService.getGameById(gameId);

  if (!game || game.uploader_id !== req.session.user.id) {
    return res.status(403).send('No eres el propietario del juego');
  }

  next();
}

export async function requireCanDelete(req, res, next) {
  const gameId = req.params.gameId;

  if (!isValidId(gameId)) {
    return res.status(404).send('Juego no encontrado');
  }

  const actorId = req.session.user.id;

  const game = await gamesService.getGameById(gameId);

  if (!game) {
    return res.status(404).send('Juego no encontrado');
  }

  const actor = await usersService.getUserById(actorId);

  if (!actor) {
    return res.status(403).send('Usuario no encontrado');
  }

  const allowed = canDeleteGame({
    actorId,
    actorRole: actor.role_name,
    uploaderId: game.uploader_id,
    uploaderRole: game.uploader_role,
  });

  if (!allowed) {
    return res.status(403).send('No tienes permiso para eliminar este juego');
  }

  // Para el registro de moderación en el controlador
  req.moderation = {
    isUploader: game.uploader_id === actorId,
    actorRole: actor.role_name,
    uploaderRole: game.uploader_role,
  };

  next();
}

export async function requireCanDeleteUser(req, res, next) {
  const targetId = req.params.userId;

  if (!isValidId(targetId)) {
    return res.status(404).send('Usuario no encontrado');
  }

  const actorId = req.session.user.id;

  const target = await usersService.getUserById(targetId);

  if (!target) {
    return res.status(404).send('Usuario no encontrado');
  }

  const actor = await usersService.getUserById(actorId);

  if (!actor) {
    return res.status(403).send('Usuario no encontrado');
  }

  const allowed = canDeleteUser({
    actorId,
    actorRole: actor.role_name,
    targetId: target.id_user,
    targetRole: target.role_name,
  });

  if (!allowed) {
    return res.status(403).send('No tienes permiso para eliminar a este usuario');
  }

  // Para el registro de moderación en el controlador
  req.moderation = {
    isSelf: target.id_user === actorId,
    actorRole: actor.role_name,
    targetRole: target.role_name,
  };

  next();
}
