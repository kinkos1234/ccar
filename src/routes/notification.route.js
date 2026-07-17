const express = require('express');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/notification.controller');
const router = express.Router();

router.get('/', auth, ctrl.list);
router.get('/unread-count', auth, ctrl.unreadCount);
router.patch('/read-all', auth, ctrl.markAllRead);
router.patch('/:id/read', auth, ctrl.markRead);
router.post('/scan', auth, ctrl.runScan);

module.exports = router;
