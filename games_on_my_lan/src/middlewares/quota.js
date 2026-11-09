import quotaService from '../services/quotaService.js';
import { quotaViolation } from '../utils/quota.js';

// Comprobación temprana: rechaza antes de recibir el archivo (un zip puede pesar 1 GB) y deja
// en req.quota el espacio que le queda al usuario para que la subida se corte al llegar a él.
// La comprobación definitiva y atómica está en gamesService.
export function requireGameQuota({ replacing = false } = {}) {
  return async (req, res, next) => {
    try {
      const quota = await quotaService.getQuota(req.session.user.id, {
        excludeGameId: replacing ? req.params.gameId : null,
      });

      if (!quota) return next();

      // Editar un juego sin cambiar el zip no sube nada, aunque no quede espacio
      const violation = replacing ? null : quotaViolation(quota);

      if (violation) {
        // Cierra la conexión para que el cliente no siga enviando el archivo completo
        res.set('Connection', 'close');
        return res.status(403).send(violation);
      }

      req.quota = quota;
      next();
    } catch (error) {
      next(error);
    }
  };
}
