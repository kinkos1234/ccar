const notificationService = require('../services/notification.service');
const { convertBigIntToString } = require('../utils/bigint');

exports.list = async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const unreadOnly = req.query.unreadOnly === 'true';
    const rows = await notificationService.listForUser(req.user.id, { limit, unreadOnly });
    res.json({ success: true, data: convertBigIntToString(rows) });
  } catch (e) {
    next(e);
  }
};

exports.unreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.countUnread(req.user.id);
    res.json({ success: true, count });
  } catch (e) {
    next(e);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const result = await notificationService.markRead(req.params.id, req.user.id);
    res.json({ success: true, updated: result.count });
  } catch (e) {
    next(e);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.user.id);
    res.json({ success: true, updated: result.count });
  } catch (e) {
    next(e);
  }
};

exports.runScan = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const results = await notificationService.runDueDateScan();
    res.json({ success: true, generated: results.length });
  } catch (e) {
    next(e);
  }
};
