import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reemplaza el pool real de Postgres por uno falso ANTES de importar
// cualquier archivo que dependa de él. Así los tests corren sin necesitar
// una base de datos real ni settings.json configurado.
vi.mock('../../src/database/pool.js', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}));

import pool from '../../src/database/pool.js';
import gamesService from '../../src/services/gamesService.js';
import { QuotaError } from '../../src/utils/quota.js';

const MB = 1024 * 1024;
const quota = { maxGames: 3, maxBytes: 100 * MB };

describe('gamesService', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.connect.mockReset();
  });

  it('createGame inserta el juego y devuelve la fila creada', async () => {
    const fakeRow = { id_game: 1, game_name: 'Pong' };
    pool.query.mockResolvedValueOnce({ rows: [fakeRow] });

    const result = await gamesService.createGame({
      game_name: 'Pong',
      game_description: 'clásico',
      entry_file: 'index.html',
      uploader_id: 5,
      original_author: 'Atari',
      source_url: 'https://github.com/atari/pong',
    });

    expect(pool.query).toHaveBeenCalledOnce();
    // Verifica que los parámetros lleguen en el orden correcto a la query
    expect(pool.query.mock.calls[0][1]).toEqual([
      'Pong',
      'clásico',
      'index.html',
      5,
      'Atari',
      'https://github.com/atari/pong',
      0,
    ]);
    expect(result).toEqual(fakeRow);
  });

  it('getAllGames devuelve la lista de juegos tal cual la entrega la BD', async () => {
    const fakeRows = [{ id_game: 1 }, { id_game: 2 }];
    pool.query.mockResolvedValueOnce({ rows: fakeRows });

    const result = await gamesService.getAllGames();

    expect(result).toEqual(fakeRows);
  });

  it('deleteGame devuelve undefined si el juego no existía', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await gamesService.deleteGame(999);

    expect(result).toBeUndefined();
  });

  it('deleteGame propaga el error si la query falla', async () => {
    pool.query.mockRejectedValueOnce(new Error('conexión perdida'));

    await expect(gamesService.deleteGame(1)).rejects.toThrow('conexión perdida');
  });

  describe('con cupo', () => {
    // Cliente falso de una transacción: responde según el SQL recibido
    function fakeClient({ usage, inserted, previous }) {
      return {
        release: vi.fn(),
        query: vi.fn(async (sql) => {
          if (sql.includes('COUNT(*)')) return { rows: [usage] };
          if (sql.includes('INSERT INTO games')) return { rows: [inserted] };
          if (sql.includes('SELECT size_bytes')) return { rows: [previous] };
          return { rows: [] };
        }),
      };
    }

    const sqls = (client) => client.query.mock.calls.map(([sql]) => sql.trim());

    it('createGame reserva el espacio que le queda al usuario', async () => {
      const client = fakeClient({
        usage: { games: 1, bytes: 30 * MB },
        inserted: { id_game: 9 },
      });
      pool.connect.mockResolvedValue(client);

      const game = { game_name: 'A', game_description: '', entry_file: 'x.html', uploader_id: 5 };
      const result = await gamesService.createGame(game, quota);

      const insert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO games'));

      expect(result).toEqual({ id_game: 9 });
      expect(insert[1][6]).toBe(70 * MB);
      expect(sqls(client)).toContain('BEGIN');
      expect(sqls(client)).toContain('COMMIT');
      expect(client.release).toHaveBeenCalledOnce();
    });

    it('createGame rechaza si ya tiene el máximo de juegos', async () => {
      const client = fakeClient({ usage: { games: 3, bytes: 0 } });
      pool.connect.mockResolvedValue(client);

      await expect(gamesService.createGame({ uploader_id: 5 }, quota)).rejects.toThrow(QuotaError);

      expect(sqls(client).some((sql) => sql.includes('INSERT INTO games'))).toBe(false);
      expect(sqls(client)).toContain('ROLLBACK');
      expect(client.release).toHaveBeenCalledOnce();
    });

    it('createGame rechaza si no le queda espacio', async () => {
      const client = fakeClient({ usage: { games: 1, bytes: 100 * MB } });
      pool.connect.mockResolvedValue(client);

      await expect(gamesService.createGame({ uploader_id: 5 }, quota)).rejects.toThrow(QuotaError);
      expect(sqls(client)).toContain('ROLLBACK');
    });

    it('reserveReplacement ignora el juego reemplazado y devuelve el tamaño previo', async () => {
      const client = fakeClient({
        usage: { games: 2, bytes: 40 * MB },
        previous: { size_bytes: String(5 * MB) },
      });
      pool.connect.mockResolvedValue(client);

      const result = await gamesService.reserveReplacement('3', 5, quota);

      const usageCall = client.query.mock.calls.find(([sql]) => sql.includes('COUNT(*)'));

      expect(usageCall[1]).toEqual([5, '3']);
      expect(result).toEqual({ previousBytes: 5 * MB, budget: 60 * MB });
      expect(sqls(client)).toContain('COMMIT');
    });

    it('reserveReplacement rechaza si no queda espacio, sin tocar el juego', async () => {
      const client = fakeClient({ usage: { games: 2, bytes: 100 * MB } });
      pool.connect.mockResolvedValue(client);

      await expect(gamesService.reserveReplacement('3', 5, quota)).rejects.toThrow(QuotaError);
      expect(sqls(client).some((sql) => sql.startsWith('UPDATE games'))).toBe(false);
    });
  });
});
