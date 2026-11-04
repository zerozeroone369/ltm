const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticateToken, (req, res) => {
  try {
    const list = db.prepare(`
      SELECT n.*, u.full_name as actor_name, u.avatar_url as actor_avatar
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.user_id
      WHERE n.recipient_id = ?
      ORDER BY n.created_at DESC
      LIMIT 30
    `).all(req.user.userId);

    const unreadCount = db.prepare(`
      SELECT count(*) as count FROM notifications WHERE recipient_id = ? AND is_read = 0
    `).get(req.user.userId).count;

    res.json({
      success: true,
      data: {
        notifications: list,
        unreadCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND recipient_id = ?').run(req.params.id, req.user.userId);
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?').run(req.user.userId);
  res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
});

module.exports = router;

