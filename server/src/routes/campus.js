const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/campus
router.get('/', authenticateToken, (req, res) => {
  try {
    const { type } = req.query;
    let query = `
      SELECT cp.*, u.full_name as admin_name
      FROM campus_posts cp
      JOIN users u ON cp.admin_id = u.user_id
      WHERE cp.status = 'VISIBLE'
    `;
    const params = [];

    if (type && type !== 'ALL') {
      query += ` AND cp.type = ?`;
      params.push(type);
    }

    query += ` ORDER BY cp.created_at DESC`;
    const list = db.prepare(query).all(...params);

    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/campus (Admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { type, title, content, banner_url, start_time, end_time } = req.body;
    if (!type || !title || !content) {
      return res.status(400).json({ success: false, message: 'Loại, tiêu đề và nội dung là bắt buộc' });
    }

    const result = db.prepare(`
      INSERT INTO campus_posts (admin_id, type, title, content, banner_url, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.userId, type, title, content, banner_url || null, start_time || null, end_time || null);

    res.status(201).json({ success: true, message: 'Đăng tin Campus thành công', data: { campus_id: result.lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

