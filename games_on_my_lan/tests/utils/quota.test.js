import { describe, it, expect } from 'vitest';
import { computeQuota, quotaViolation } from '../../src/utils/quota.js';

const MB = 1024 * 1024;
const limits = { maxGames: 3, maxBytes: 100 * MB };

describe('computeQuota', () => {
  it('calcula lo que le queda al usuario', () => {
    const quota = computeQuota(limits, { games: 1, bytes: 30 * MB });

    expect(quota.remainingGames).toBe(2);
    expect(quota.remainingBytes).toBe(70 * MB);
  });

  it('nunca devuelve restos negativos (p. ej. si bajaron el límite)', () => {
    const quota = computeQuota(limits, { games: 5, bytes: 500 * MB });

    expect(quota.remainingGames).toBe(0);
    expect(quota.remainingBytes).toBe(0);
  });
});

describe('quotaViolation', () => {
  it('es null si todavía le cabe algo', () => {
    expect(quotaViolation(computeQuota(limits, { games: 2, bytes: 99 * MB }))).toBeNull();
  });

  it('avisa si ya tiene el máximo de juegos', () => {
    const quota = computeQuota(limits, { games: 3, bytes: 0 });

    expect(quotaViolation(quota)).toMatch(/máximo de 3 juegos/);
  });

  it('avisa si no queda espacio', () => {
    const quota = computeQuota(limits, { games: 1, bytes: 100 * MB });

    expect(quotaViolation(quota)).toMatch(/100 MB/);
  });

  it('al reemplazar un juego no cuenta el máximo de juegos', () => {
    const quota = computeQuota(limits, { games: 3, bytes: 10 * MB });

    expect(quotaViolation(quota, { checkGames: false })).toBeNull();
  });
});
