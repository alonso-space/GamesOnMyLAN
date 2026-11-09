import settings from '../../admin/getSettings.js';
import usersService from './usersService.js';
import gamesService from './gamesService.js';
import { BYTES_PER_MB } from '../utils/limits.js';
import { computeQuota } from '../utils/quota.js';

// Devuelve null si el usuario no tiene límites (apagados en el .env o usuario de confianza).
// excludeGameId: al reemplazar el zip de un juego, su tamaño actual no cuenta como ocupado.
async function getQuota(userId, { excludeGameId = null } = {}) {
  if (settings.limit_games !== true) return null;

  const user = await usersService.getUserById(userId);

  if (user?.trusted) return null;

  const usage = await gamesService.getUsage(userId, excludeGameId);

  return computeQuota(
    { maxGames: settings.games_qty, maxBytes: settings.max_mbs * BYTES_PER_MB },
    usage,
  );
}

export default { getQuota };
