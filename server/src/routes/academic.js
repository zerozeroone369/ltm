const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/academic/tree - Toàn bộ cây trường DAU
router.get('/tree', (req, res) => {
  try {
    const schools = db.prepare('SELECT * FROM schools').all();
    const faculties = db.prepare('SELECT * FROM faculties ORDER BY faculty_id ASC').all();
    const majors = db.prepare('SELECT * FROM majors ORDER BY major_id ASC').all();
    const courses = db.prepare('SELECT * FROM courses ORDER BY start_year DESC').all();
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    const subjects = db.prepare('SELECT * FROM subjects ORDER BY name ASC').all();

    res.json({
      success: true,
      data: {
        school: schools[0] || null,
        faculties,
        majors,
        courses,
        classes,
        subjects
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/academic/faculties - 9 Khoa của ĐH Kiến trúc Đà Nẵng
router.get('/faculties', (req, res) => {
  const faculties = db.prepare('SELECT * FROM faculties ORDER BY faculty_id ASC').all();
  res.json({ success: true, data: faculties });
});

// GET /api/academic/majors?faculty_id=...
router.get('/majors', (req, res) => {
  const { faculty_id } = req.query;
  let query = 'SELECT * FROM majors';
  const params = [];
  if (faculty_id) {
    query += ' WHERE faculty_id = ?';
    params.push(faculty_id);
  }
  query += ' ORDER BY major_id ASC';
  const majors = db.prepare(query).all(...params);
  res.json({ success: true, data: majors });
});

// GET /api/academic/courses?major_id=...
router.get('/courses', (req, res) => {
  const { major_id } = req.query;
  let query = 'SELECT * FROM courses';
  const params = [];
  if (major_id) {
    query += ' WHERE major_id = ?';
    params.push(major_id);
  }
  query += ' ORDER BY start_year DESC';
  const courses = db.prepare(query).all(...params);
  res.json({ success: true, data: courses });
});

// GET /api/academic/classes?course_id=...
router.get('/classes', (req, res) => {
  const { course_id } = req.query;
  let query = `
    SELECT c.*, cr.name as course_name, m.name as major_name, f.name as faculty_name
    FROM classes c
    JOIN courses cr ON c.course_id = cr.course_id
    JOIN majors m ON cr.major_id = m.major_id
    JOIN faculties f ON m.faculty_id = f.faculty_id
  `;
  const params = [];
  if (course_id) {
    query += ' WHERE c.course_id = ?';
    params.push(course_id);
  }
  query += ' ORDER BY c.name ASC';
  const classes = db.prepare(query).all(...params);
  res.json({ success: true, data: classes });
});

// GET /api/academic/subjects?faculty_id=...
router.get('/subjects', (req, res) => {
  const { faculty_id } = req.query;
  let query = `
    SELECT s.*, f.name as faculty_name
    FROM subjects s
    JOIN faculties f ON s.faculty_id = f.faculty_id
  `;
  const params = [];
  if (faculty_id) {
    query += ' WHERE s.faculty_id = ?';
    params.push(faculty_id);
  }
  query += ' ORDER BY s.name ASC';
  const subjects = db.prepare(query).all(...params);
  res.json({ success: true, data: subjects });
});

module.exports = router;
