import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/quotaService.js', () => ({
  default: { getQuota: vi.fn() },
}));

const { default: quotaService } = await import('../../src/services/quotaService.js');
const { requireGameQuota } = await import('../../src/middlewares/quota.js');

const MB = 1024 * 1024;

function quotaWith(remainingGames, remainingBytes) {
  return { maxGames: 3, maxBytes: 100 * MB, remainingGames, remainingBytes };
}

async function run(middleware) {
  const req = { session: { user: { id: 7 } }, params: { gameId: '3' } };
  const res = { set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis(), send: vi.fn() };
  const next = vi.fn();

  await middleware(req, res, next);

  return { req, res, next };
}

describe('requireGameQuota', () => {
  beforeEach(() => {
    quotaService.getQuota.mockReset();
  });

  it('deja pasar sin req.quota si el usuario no tiene límites', async () => {
    quotaService.getQuota.mockResolvedValue(null);
    const { req, next } = await run(requireGameQuota());

    expect(next).toHaveBeenCalledWith();
    expect(req.quota).toBeUndefined();
  });

  it('deja pasar y guarda el cupo si todavía le cabe algo', async () => {
    const quota = quotaWith(2, 70 * MB);
    quotaService.getQuota.mockResolvedValue(quota);
    const { req, next } = await run(requireGameQuota());

    expect(next).toHaveBeenCalledWith();
    expect(req.quota).toBe(quota);
  });

  it('responde 403 y cierra la conexión si ya tiene el máximo de juegos', async () => {
    quotaService.getQuota.mockResolvedValue(quotaWith(0, 70 * MB));
    const { res, next } = await run(requireGameQuota());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.set).toHaveBeenCalledWith('Connection', 'close');
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 403 si no le queda espacio', async () => {
    quotaService.getQuota.mockResolvedValue(quotaWith(2, 0));
    const { res, next } = await run(requireGameQuota());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('al reemplazar excluye el juego editado y permite editar sin espacio', async () => {
    quotaService.getQuota.mockResolvedValue(quotaWith(0, 0));
    const { req, res, next } = await run(requireGameQuota({ replacing: true }));

    expect(quotaService.getQuota).toHaveBeenCalledWith(7, { excludeGameId: '3' });
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(req.quota.remainingBytes).toBe(0);
  });

  it('pasa el error a next si la consulta falla', async () => {
    const error = new Error('db caída');
    quotaService.getQuota.mockRejectedValue(error);
    const { next } = await run(requireGameQuota());

    expect(next).toHaveBeenCalledWith(error);
  });
});
