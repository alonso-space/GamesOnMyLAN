import fsp from 'fs/promises';
import usersService from '../services/usersService.js';
import gamesService from '../services/gamesService.js';
import storageService from '../services/storageService.js';
import {
  regenerateSession,
  saveSession,
  endSession,
  destroyOtherSessions,
} from '../utils/session.js';
import { canDeleteUser } from '../utils/permissions.js';
import { isValidId, validatePasswordChange } from '../utils/validators.js';

async function register(req, res) {
  const { username, password } = req.body;

  try {
    const userId = await usersService.registerUser(username, password);

    await regenerateSession(req);
    req.session.user = {
      id: userId,
      username: username,
    };
    await saveSession(req);

    res.redirect('/users/profile');
  } catch (error) {
    console.error('Error al registrar usuario:', error);

    // 23505: el nombre de usuario ya existe
    if (error.code === '23505') {
      return res.redirect('/users/register?error=taken');
    }

    res.redirect('/users/register?error=1');
  }
}

function showRegister(req, res) {
  const errorParam = req.query.error;

  res.render('register', {
    title: 'Registro de usuario',
    error: Boolean(errorParam),
    errorTaken: errorParam === 'taken',
  });
}

function redirectToOwnProfile(req, res) {
  res.redirect(`/users/profile/${req.session.user.id}`);
}

function canViewerDelete(viewer, target) {
  if (!viewer) return false;

  return canDeleteUser({
    actorId: viewer.id_user,
    actorRole: viewer.role_name,
    targetId: target.id_user,
    targetRole: target.role_name,
  });
}

async function showProfile(req, res) {
  if (!isValidId(req.params.userId)) {
    return res.status(404).send('Usuario no encontrado');
  }

  const profileUser = await usersService.getUserById(req.params.userId);

  if (!profileUser) {
    return res.status(404).send('Usuario no encontrado');
  }

  const isOwnProfile = Boolean(req.session.user && req.session.user.id === profileUser.id_user);

  const viewer = req.session.user ? await usersService.getUserById(req.session.user.id) : null;

  const games = await gamesService.getGamesByAuthorId(profileUser.id_user);

  res.render('profile', {
    title: 'Perfil',
    profileUser,
    isOwnProfile,
    canDelete: canViewerDelete(viewer, profileUser),
    games,
  });
}

async function showUsers(req, res) {
  const users = await usersService.getAllUsers();

  const viewer = req.session.user ? await usersService.getUserById(req.session.user.id) : null;
  const canManageRoles = viewer?.role_name === 'owner';

  const rows = users.map((user) => {
    const isPromotable = user.role_name === 'member';
    const isDemotable = user.role_name === 'admin';

    return {
      ...user,
      canChangeRole: canManageRoles && (isPromotable || isDemotable),
      canChangeTrust: canManageRoles && user.role_name !== 'owner',
      newTrusted: !user.trusted,
      newTrustedLabel: user.trusted ? 'Quitar confianza' : 'Marcar de confianza',
      canDelete: canViewerDelete(viewer, user),
      newRole: isDemotable ? 'member' : 'admin',
      newRoleLabel: isDemotable ? 'Degradar a member' : 'Ascender a admin',
    };
  });

  res.render('users', {
    title: 'Usuarios',
    users: rows,
    canManageRoles,
    showActions: rows.some((row) => row.canChangeRole || row.canChangeTrust || row.canDelete),
  });
}

async function updateAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).send('Debes seleccionar una imagen PNG');
    }

    await storageService.storeAvatar(req.file, req.session.user.id);

    res.redirect('/users/profile');
  } finally {
    // Si el temporal sigue ahí (falló la validación) se borra;
    // si ya se movió a data/avatars, no pasa nada.
    if (req.file) {
      await fsp.unlink(req.file.path).catch(() => {});
    }
  }
}

async function updateBio(req, res) {
  const updatedUser = await usersService.updateBio(req.body.bio, req.session.user.id);

  if (!updatedUser) {
    return res.status(404).send('Usuario no encontrado');
  }

  res.redirect('/users/profile');
}

async function changeRole(req, res) {
  const targetId = req.params.userId;
  const newRole = req.body.role;

  if (!isValidId(targetId)) {
    return res.status(404).send('Usuario no encontrado');
  }

  if (!['member', 'admin'].includes(newRole)) {
    return res.status(400).send('Rol inválido');
  }

  const updated = await usersService.updateUserRole(targetId, newRole);

  if (!updated) {
    return res.status(403).send('Usuario no encontrado o no modificable');
  }

  if (updated.old_role !== newRole) {
    console.warn(
      `[ROLES] ${new Date().toISOString()} ` +
        `owner #${req.session.user.id} cambió a #${updated.id_user} ` +
        `${JSON.stringify(updated.username)}: ${updated.old_role} -> ${newRole}`,
    );
  }

  res.redirect('/users');
}

async function changeTrusted(req, res) {
  const targetId = req.params.userId;
  const { trusted } = req.body;

  if (!isValidId(targetId)) {
    return res.status(404).send('Usuario no encontrado');
  }

  if (!['true', 'false'].includes(trusted)) {
    return res.status(400).send('Valor inválido');
  }

  const updated = await usersService.updateUserTrusted(targetId, trusted === 'true');

  if (!updated) {
    return res.status(403).send('Usuario no encontrado o no modificable');
  }

  console.warn(
    `[CONFIANZA] ${new Date().toISOString()} ` +
      `owner #${req.session.user.id} marcó a #${updated.id_user} ` +
      `${JSON.stringify(updated.username)} como trusted=${updated.trusted}`,
  );

  res.redirect('/users');
}

function showChangePassword(req, res) {
  res.render('change_password', {
    title: 'Cambiar contraseña',
    success: req.query.ok === '1',
  });
}

function renderChangePasswordError(res, status, message) {
  // Nunca se reenvían las contraseñas escritas: el formulario vuelve vacío
  res.status(status).render('change_password', {
    title: 'Cambiar contraseña',
    error: message,
  });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  const validationError = validatePasswordChange({
    currentPassword,
    newPassword,
    confirmPassword,
  });

  if (validationError) {
    return renderChangePasswordError(res, 400, validationError);
  }

  const sessionUser = req.session.user;

  const result = await usersService.changePassword(sessionUser.id, currentPassword, newPassword);

  if (result === 'not_found') {
    // La cuenta ya no existe: se limpia la sesión que quedó huérfana
    await endSession(req, res);
    return res.redirect('/auth/login');
  }

  if (result === 'wrong_password') {
    // Lo lee passwordChangeLimiter: solo estos intentos cuentan para el bloqueo
    res.locals.failedPasswordAttempt = true;
    return renderChangePasswordError(res, 400, 'La contraseña actual no es correcta.');
  }

  if (result === 'conflict') {
    return renderChangePasswordError(
      res,
      409,
      'Tu contraseña cambió mientras se procesaba la solicitud. Inténtalo de nuevo.',
    );
  }

  // Cambio exitoso: se renueva el id de sesión y se cierran las demás sesiones abiertas
  await regenerateSession(req);
  req.session.user = sessionUser;
  await saveSession(req);

  let closedSessions = 0;

  try {
    closedSessions = await destroyOtherSessions(req, sessionUser.id);
  } catch (error) {
    // La contraseña ya cambió; no se falla por no poder cerrar las otras sesiones
    console.error('No se pudieron cerrar las otras sesiones:', error);
  }

  console.warn(
    `[CUENTAS] ${new Date().toISOString()} ` +
      `#${sessionUser.id} cambió su contraseña (otras sesiones cerradas: ${closedSessions})`,
  );

  res.redirect('/users/password?ok=1');
}

async function deleteUser(req, res) {
  const targetId = req.params.userId;

  // Se leen antes de borrar: la base elimina los juegos del usuario en cascada
  const games = await gamesService.getGamesByAuthorId(targetId);

  const deletedUser = await usersService.deleteUser(targetId);

  if (!deletedUser) {
    return res.status(404).send('Usuario no encontrado o no eliminable');
  }

  await Promise.all(games.map((game) => storageService.deleteGameFiles(game.id_game)));
  await storageService.deleteAvatar(deletedUser.id_user);

  if (req.moderation.isSelf) {
    console.warn(
      `[CUENTAS] ${new Date().toISOString()} ` +
        `#${deletedUser.id_user} ${JSON.stringify(deletedUser.username)} ` +
        `(${req.moderation.targetRole}) eliminó su cuenta`,
    );

    await endSession(req, res);
    return res.redirect('/');
  }

  console.warn(
    `[MODERACIÓN] ${new Date().toISOString()} ` +
      `usuario #${req.session.user.id} (${req.moderation.actorRole}) eliminó ` +
      `al usuario #${deletedUser.id_user} ${JSON.stringify(deletedUser.username)} ` +
      `(${req.moderation.targetRole})`,
  );

  res.redirect('/users');
}

export default {
  register,
  showRegister,
  redirectToOwnProfile,
  showProfile,
  showUsers,
  updateAvatar,
  updateBio,
  changeRole,
  changeTrusted,
  showChangePassword,
  changePassword,
  deleteUser,
};
