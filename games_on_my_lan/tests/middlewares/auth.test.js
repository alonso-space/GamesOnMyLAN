import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/gamesService.js', () => ({
  default: { getGameById: vi.fn() },
}));

vi.mock('../../src/services/usersService.js', () => ({
  default: { getUserById: vi.fn() },
}));

import gamesService from '../../src/services/gamesService.js';
import usersService from '../../src/services/usersService.js';
import { requireLogin, requireLoginPage, requireCanDelete } from '../../src/middlewares/auth.js';

// req/res falsos: no levantamos Express real, solo simulamos lo mínimo
// que el middleware necesita para ejercitar su lógica.
function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireLogin', () => {
  it('deja pasar si hay un usuario en sesión', () => {
    const req = { session: { user: { id: 1 } } };
    const res = mockRes();
    const next = vi.fn();

    requireLogin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 401 si no hay sesión iniciada', () => {
    const req = { session: {} };
    const res = mockRes();
    const next = vi.fn();

    requireLogin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireLoginPage', () => {
  it('deja pasar si hay un usuario en sesión', () => {
    const req = { session: { user: { id: 1 } } };
    const res = mockRes();
    const next = vi.fn();

    requireLoginPage(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirige a /auth/login si no hay sesión iniciada', () => {
    const req = { session: {} };
    const res = mockRes();
    const next = vi.fn();

    requireLoginPage(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/auth/login');
  });
});

describe('requireCanDelete', () => {
  beforeEach(() => {
    gamesService.getGameById.mockReset();
    usersService.getUserById.mockReset();
  });

  it('responde 404 si el id del juego no es un número válido', async () => {
    const req = { params: { gameId: 'abc' }, session: { user: { id: 1 } } };
    const res = mockRes();
    const next = vi.fn();

    await requireCanDelete(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
    // Ni siquiera debería haber consultado la BD con un id inválido
    expect(gamesService.getGameById).not.toHaveBeenCalled();
  });

  it('deja pasar y anota req.moderation cuando el actor es quien subió el juego', async () => {
    gamesService.getGameById.mockResolvedValueOnce({ uploader_id: 7, uploader_role: 'member' });
    usersService.getUserById.mockResolvedValueOnce({ role_name: 'member' });

    const req = { params: { gameId: '10' }, session: { user: { id: 7 } } };
    const res = mockRes();
    const next = vi.fn();

    await requireCanDelete(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.moderation).toEqual({
      isUploader: true,
      actorRole: 'member',
      uploaderRole: 'member',
    });
  });

  it('responde 403 cuando un member intenta borrar el juego de otro usuario', async () => {
    gamesService.getGameById.mockResolvedValueOnce({ uploader_id: 7, uploader_role: 'member' });
    usersService.getUserById.mockResolvedValueOnce({ role_name: 'member' });

    const req = { params: { gameId: '10' }, session: { user: { id: 99 } } };
    const res = mockRes();
    const next = vi.fn();

    await requireCanDelete(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 404 si el juego no existe', async () => {
    gamesService.getGameById.mockResolvedValueOnce(undefined);

    const req = { params: { gameId: '10' }, session: { user: { id: 1 } } };
    const res = mockRes();
    const next = vi.fn();

    await requireCanDelete(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
