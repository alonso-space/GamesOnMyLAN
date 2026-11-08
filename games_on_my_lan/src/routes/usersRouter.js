import express from 'express';
import usersController from '../controllers/usersController.js';
import { requireGuestRegister, requireLimitUsers } from '../middlewares/settings.js';
import { registerLimiter, passwordChangeLimiter } from '../middlewares/rateLimit.js';
import {
  requireLogin,
  requireLoginPage,
  requireRole,
  requireCanDeleteUser,
} from '../middlewares/auth.js';
import { uploadAvatar } from '../middlewares/upload.js';

const router = express.Router();

router.get('/register', requireGuestRegister, usersController.showRegister);
router.post('/register', requireGuestRegister, requireLimitUsers, registerLimiter, usersController.register);

router.get('/profile', requireLoginPage, usersController.redirectToOwnProfile);
router.get('/profile/:userId', usersController.showProfile);
router.post(
  '/profile/avatar',
  requireLogin,
  uploadAvatar.single('avatar'),
  usersController.updateAvatar,
);
router.post('/profile/bio', requireLogin, usersController.updateBio);

router.get('/password', requireLoginPage, usersController.showChangePassword);
router.post('/password', requireLogin, passwordChangeLimiter, usersController.changePassword);

router.get('/', usersController.showUsers);

router.delete('/:userId', requireLogin, requireCanDeleteUser, usersController.deleteUser);

router.post('/:userId/role', requireLogin, requireRole('owner'), usersController.changeRole);

export default router;
