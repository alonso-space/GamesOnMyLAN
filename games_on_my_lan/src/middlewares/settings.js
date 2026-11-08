import settings from '../../admin/getSettings.js';
import usersService from '../services/usersService.js';

export function requireGuestRegister(req, res, next) {
  if (settings.guest_register === false) {
    return res.status(403).send('Registro de invitados deshabilitado por el host');
  }

  next();
}

export async function requireLimitUsers(req, res, next) {
  try {
    if (settings.limit_users !== true) {
      return next();
    }

    const currentUsers = await usersService.countAllUsers();

    if (currentUsers >= settings.max_users) {
      return res.status(403).send(
        'Número máximo de usuarios alcanzado'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}