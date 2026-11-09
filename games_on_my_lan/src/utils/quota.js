import { BYTES_PER_MB } from './limits.js';

export class QuotaError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'QuotaError';
    this.status = status;
  }
}

// limits: { maxGames, maxBytes } | usage: { games, bytes }
export function computeQuota(limits, usage) {
  return {
    maxGames: limits.maxGames,
    maxBytes: limits.maxBytes,
    usedGames: usage.games,
    usedBytes: usage.bytes,
    remainingGames: Math.max(0, limits.maxGames - usage.games),
    remainingBytes: Math.max(0, limits.maxBytes - usage.bytes),
  };
}

// Motivo por el que no puede subir nada, o null si todavía le cabe algo.
// Al reemplazar el zip de un juego que ya existe, el cupo de juegos no cuenta.
export function quotaViolation(quota, { checkGames = true } = {}) {
  if (checkGames && quota.remainingGames === 0) {
    return `Alcanzaste el máximo de ${quota.maxGames} juegos`;
  }

  if (quota.remainingBytes === 0) {
    const maxMb = Math.round(quota.maxBytes / BYTES_PER_MB);

    return (
      `No te queda espacio (límite de ${maxMb} MB). ` +
      'Si tienes otra subida en curso, espera a que termine.'
    );
  }

  return null;
}
