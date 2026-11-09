import express from 'express';
import gamesController from '../controllers/gamesController.js';
import {
  requireLogin,
  requireLoginPage,
  requireRole,
  requireOwnership,
  requireCanDelete,
} from '../middlewares/auth.js';
import { requireGameQuota } from '../middlewares/quota.js';
import upload from '../middlewares/upload.js';

const router = express.Router();

const gameUploads = upload.fields([
  { name: 'gameFile', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

router.get('/', gamesController.showGames);
router.get('/new', requireLoginPage, gamesController.showNewGame);
router.post(
  '/',
  requireLogin,
  requireRole('member', 'admin', 'owner'),
  requireGameQuota(),
  gameUploads,
  gamesController.createGame,
);

router.get('/game-details/:gameId', gamesController.showGameDetails);
router.get(
  '/game-details/:gameId/edit',
  requireLogin,
  requireOwnership,
  gamesController.showEditGame,
);

router.get('/:gameId', gamesController.playGame);
router.put(
  '/:gameId',
  requireLogin,
  requireOwnership,
  requireGameQuota({ replacing: true }),
  gameUploads,
  gamesController.updateGame,
);
router.delete('/:gameId', requireLogin, requireCanDelete, gamesController.deleteGame);

export default router;
