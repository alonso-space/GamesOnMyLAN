import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/usersService.js', () => ({
  default: { countAllUsers: vi.fn() },
}));

const { default: usersService } = await import('../../src/services/usersService.js');
const { default: settings } = await import('../../admin/getSettings.js');
const { requireLimitUsers } = await import('../../src/middlewares/settings.js');

function run() {
  const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  const next = vi.fn();
  return requireLimitUsers({}, res, next).then(() => ({ res, next }));
}

describe('requireLimitUsers', () => {
  beforeEach(() => {
    usersService.countAllUsers.mockReset();
    settings.limit_users = true;
    settings.max_users = 3;
  });

  it('deja pasar sin consultar la base si el límite está apagado', async () => {
    settings.limit_users = false;
    const { next } = await run();

    expect(next).toHaveBeenCalledWith();
    expect(usersService.countAllUsers).not.toHaveBeenCalled();
  });

  it('deja pasar si hay menos usuarios que el máximo', async () => {
    usersService.countAllUsers.mockResolvedValue(2);
    const { res, next } = await run();

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 403 al llegar al máximo', async () => {
    usersService.countAllUsers.mockResolvedValue(3);
    const { res, next } = await run();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('pasa el error a next si la base falla', async () => {
    const error = new Error('db caída');
    usersService.countAllUsers.mockRejectedValue(error);
    const { next } = await run();

    expect(next).toHaveBeenCalledWith(error);
  });
});
