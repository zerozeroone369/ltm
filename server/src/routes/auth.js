const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { student_code, email, password, full_name, class_id } = req.body;

    if (!student_code || !email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Vui lòng điền đầy đủ MSSV, Email, Mật khẩu và Họ tên'
      });
    }

    // Check existing
    const existing = db.prepare('SELECT user_id FROM users WHERE student_code = ? OR email = ?').get(student_code, email);
    if (existing) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        errorCode: 'USER_EXISTS',
        message: 'Mã sinh viên hoặc email đã được đăng ký trong hệ thống'
      });
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name)}`;

    db.prepare(`
      INSERT INTO users (user_id, student_code, email, password_hash, full_name, avatar_url, role, status, class_id)
      VALUES (?, ?, ?, ?, ?, ?, 'STUDENT', 'ACTIVE', ?)
    `).run(userId, student_code, email, passwordHash, full_name, avatarUrl, class_id || null);

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Đăng ký tài khoản sinh viên thành công',
      data: {
        user_id: userId,
        student_code,
        full_name,
        email,
        role: 'STUDENT'
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, statusCode: 500, message: 'Lỗi máy chủ nội bộ' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { account, password } = req.body;
    if (!account || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Vui lòng nhập tài khoản (MSSV/Email) và mật khẩu'
      });
    }

    const user = db.prepare(`
      SELECT u.*, c.name as class_name, cr.course_id, cr.name as course_name, m.major_id, m.name as major_name, f.faculty_id, f.name as faculty_name, s.school_id, s.name as school_name
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.class_id
      LEFT JOIN courses cr ON c.course_id = cr.course_id
      LEFT JOIN majors m ON cr.major_id = m.major_id
      LEFT JOIN faculties f ON m.faculty_id = f.faculty_id
      LEFT JOIN schools s ON f.school_id = s.school_id
      WHERE u.student_code = ? OR u.email = ?
    `).get(account, account);

    if (!user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Tài khoản hoặc mật khẩu không chính xác'
      });
    }

    if (user.status === 'LOCKED') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        errorCode: 'ACCOUNT_LOCKED',
        message: 'Tài khoản của bạn đã bị khóa do vi phạm quy chuẩn. Vui lòng liên hệ Admin.'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Tài khoản hoặc mật khẩu không chính xác'
      });
    }

    const tokenPayload = {
      sub: user.user_id,
      userId: user.user_id,
      student_code: user.student_code,
      full_name: user.full_name,
      role: user.role,
      classId: user.class_id,
      courseId: user.course_id,
      facultyId: user.faculty_id,
      schoolId: user.school_id
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      statusCode: 200,
      message: 'Đăng nhập thành công',
      data: {
        access_token: accessToken,
        token_type: 'Bearer',
        user: {
          user_id: user.user_id,
          student_code: user.student_code,
          full_name: user.full_name,
          email: user.email,
          avatar_url: user.avatar_url,
          bio: user.bio,
          role: user.role,
          class_id: user.class_id,
          class_name: user.class_name,
          course_name: user.course_name,
          faculty_name: user.faculty_name,
          school_name: user.school_name
        }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, statusCode: 500, message: 'Lỗi máy chủ nội bộ' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare(`
    SELECT u.user_id, u.student_code, u.email, u.full_name, u.avatar_url, u.phone, u.bio, u.role, u.status, u.class_id,
           c.name as class_name, cr.name as course_name, f.name as faculty_name, s.name as school_name
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.class_id
    LEFT JOIN courses cr ON c.course_id = cr.course_id
    LEFT JOIN majors m ON cr.major_id = m.major_id
    LEFT JOIN faculties f ON m.faculty_id = f.faculty_id
    LEFT JOIN schools s ON f.school_id = s.school_id
    WHERE u.user_id = ?
  `).get(req.user.userId || req.user.sub);

  if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

  res.json({
    success: true,
    data: user
  });
});

module.exports = router;

