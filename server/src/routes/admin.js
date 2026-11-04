const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getActiveUsersCount } = require('../realtime');

router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT count(*) as count FROM users WHERE role = "STUDENT"').get().count;
    const totalPosts = db.prepare('SELECT count(*) as count FROM posts WHERE status = "VISIBLE"').get().count;
    const totalDocs = db.prepare('SELECT count(*) as count FROM documents WHERE status = "VISIBLE"').get().count;
    const totalQuestions = db.prepare('SELECT count(*) as count FROM questions WHERE status = "VISIBLE"').get().count;
    const totalGroups = db.prepare('SELECT count(*) as count FROM study_groups').get().count;
    const pendingReports = db.prepare('SELECT count(*) as count FROM reports WHERE status = "PENDING"').get().count;
    const activeSockets = getActiveUsersCount();

    res.json({
      success: true,
      data: {
        totalUsers,
        totalPosts,
        totalDocs,
        totalQuestions,
        totalGroups,
        pendingReports,
        activeSockets
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/reports
router.get('/reports', (req, res) => {
  try {
    const reports = db.prepare(`
      SELECT r.*, u.full_name as reporter_name, u.student_code as reporter_code
      FROM reports r
      JOIN users u ON r.reporter_id = u.user_id
      ORDER BY r.created_at DESC
    `).all();

    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/reports/:id
router.patch('/reports/:id', (req, res) => {
  try {
    const { action } = req.body; // 'HIDE_CONTENT', 'DISMISS', 'LOCK_USER'
    const report = db.prepare('SELECT * FROM reports WHERE report_id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Báo cáo không tồn tại' });

    if (action === 'HIDE_CONTENT') {
      if (report.target_type === 'POST') {
        db.prepare('UPDATE posts SET status = "HIDDEN" WHERE post_id = ?').run(report.target_id);
      } else if (report.target_type === 'DOCUMENT') {
        db.prepare('UPDATE documents SET status = "HIDDEN" WHERE document_id = ?').run(report.target_id);
      } else if (report.target_type === 'QUESTION') {
        db.prepare('UPDATE questions SET status = "HIDDEN" WHERE question_id = ?').run(report.target_id);
      }
      db.prepare('UPDATE reports SET status = "RESOLVED", resolved_by = ? WHERE report_id = ?').run(req.user.userId, req.params.id);
    } else if (action === 'DISMISS') {
      db.prepare('UPDATE reports SET status = "DISMISSED", resolved_by = ? WHERE report_id = ?').run(req.user.userId, req.params.id);
    }

    res.json({ success: true, message: 'Xử lý báo cáo thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.user_id, u.student_code, u.email, u.full_name, u.role, u.status, u.created_at, c.name as class_name
      FROM users u LEFT JOIN classes c ON u.class_id = c.class_id
      ORDER BY u.created_at DESC
    `).all();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/users/:id/toggle-lock
router.patch('/users/:id/toggle-lock', (req, res) => {
  try {
    const user = db.prepare('SELECT status, role FROM users WHERE user_id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    if (user.role === 'ADMIN') return res.status(400).json({ success: false, message: 'Không thể khóa tài khoản Admin' });

    const newStatus = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    db.prepare('UPDATE users SET status = ? WHERE user_id = ?').run(newStatus, req.params.id);

    res.json({ success: true, message: `Đã ${newStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản người dùng`, data: { status: newStatus } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/structure - Thống kê cấu trúc đào tạo trường DAU
router.get('/structure', (req, res) => {
  try {
    const totalFaculties = db.prepare('SELECT count(*) as count FROM faculties').get().count;
    const totalMajors = db.prepare('SELECT count(*) as count FROM majors').get().count;
    const totalCourses = db.prepare('SELECT count(*) as count FROM courses').get().count;
    const totalClasses = db.prepare('SELECT count(*) as count FROM classes').get().count;
    const totalSubjects = db.prepare('SELECT count(*) as count FROM subjects').get().count;

    res.json({
      success: true,
      data: {
        totalFaculties,
        totalMajors,
        totalCourses,
        totalClasses,
        totalSubjects
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

