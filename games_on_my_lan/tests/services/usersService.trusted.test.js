import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/database/pool.js', () => ({
  default: { query: vi.fn() },
}));

import pool from '../../src/database/pool.js';
import usersService from '../../src/services/usersService.js';

describe('usersService.updateUserTrusted', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('actualiza el valor y devuelve el usuario', async () => {
    const row = { id_user: 4, username: 'ana', trusted: true };
    pool.query.mockResolvedValueOnce({ rows: [row] });

    const result = await usersService.updateUserTrusted(4, true);

    expect(pool.query.mock.calls[0][1]).toEqual([true, 4]);
    expect(result).toEqual(row);
  });

  it('devuelve null si el usuario no existe o es el owner', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    expect(await usersService.updateUserTrusted(1, false)).toBeNull();
  });
});
