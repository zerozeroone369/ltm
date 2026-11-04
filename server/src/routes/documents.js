const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const uploadDirectory = path.join(__dirname, '..', '..', 'uploads', 'documents');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter (PDF, DOCX, PPTX, TXT)
const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.docx', '.pptx', '.txt', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận các tệp định dạng PDF, DOCX, PPTX, TXT, ZIP!'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter
});

// GET /api/documents - Danh sách & Tìm kiếm tài liệu
router.get('/', authenticateToken, (req, res) => {
  try {
    const { keyword, subject_id, class_id } = req.query;
    let query = `
      SELECT d.*, u.full_name as uploader_name, s.name as subject_name, s.code as subject_code, c.name as class_name,
             (SELECT score FROM document_ratings dr WHERE dr.document_id = d.document_id AND dr.user_id = ?) as user_rating
      FROM documents d
      JOIN users u ON d.uploader_id = u.user_id
      JOIN subjects s ON d.subject_id = s.subject_id
      LEFT JOIN classes c ON d.class_id = c.class_id
      WHERE d.status = 'VISIBLE'
    `;
    const params = [req.user.userId];

    if (keyword) {
      query += ` AND (d.title LIKE ? OR d.description LIKE ?)`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (subject_id) {
      query += ` AND d.subject_id = ?`;
      params.push(subject_id);
    }

    if (class_id) {
      query += ` AND d.class_id = ?`;
      params.push(class_id);
    }

    query += ` ORDER BY d.created_at DESC`;
    const documents = db.prepare(query).all(...params);

    res.json({ success: true, data: documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/documents/upload - Upload tài liệu
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tệp tài liệu cần tải lên' });
    }

    const { title, subject_id, class_id, description } = req.body;
    if (!title || !subject_id) {
      // Remove uploaded file if missing metadata
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Tiêu đề và Môn học là bắt buộc' });
    }

    const docId = uuidv4();
    const fileType = path.extname(req.file.originalname).replace('.', '').toUpperCase();

    db.prepare(`
      INSERT INTO documents (document_id, uploader_id, subject_id, class_id, title, description, file_path, file_name, file_size, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId,
      req.user.userId,
      subject_id,
      class_id || null,
      title,
      description || '',
      req.file.filename,
      req.file.originalname,
      req.file.size,
      fileType
    );

    res.status(201).json({
      success: true,
      message: 'Tải lên tài liệu thành công',
      data: {
        document_id: docId,
        title,
        file_name: req.file.originalname,
        download_url: `/api/documents/${docId}/download`
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/documents/:id/download - STREAM PROXY KIỂM SOÁT PHÂN QUYỀN
router.get('/:id/download', authenticateToken, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE document_id = ?').get(req.params.id);
    if (!doc || doc.status === 'DELETED') {
      return res.status(404).json({ success: false, message: 'Tài liệu không tồn tại hoặc đã bị xóa' });
    }

    // Phân quyền bảo mật: Nếu tài liệu chỉ dành riêng cho lớp, user phải thuộc lớp đó hoặc là ADMIN
    if (doc.class_id && doc.class_id !== req.user.classId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        errorCode: 'PERMISSION_DENIED',
        message: 'Bạn không thuộc lớp được phép tải tài liệu này!'
      });
    }

    const fullFilePath = path.join(uploadDirectory, doc.file_path);
    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({ success: false, message: 'Tệp vật lý không tìm thấy trên máy chủ' });
    }

    // Tăng lượt tải
    db.prepare('UPDATE documents SET download_count = download_count + 1 WHERE document_id = ?').run(doc.document_id);

    // Stream download an toàn
    res.download(fullFilePath, doc.file_name);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/documents/:id/rate - Đánh giá sao tài liệu (1 - 5)
router.post('/:id/rate', authenticateToken, (req, res) => {
  try {
    const { score, comment } = req.body;
    const docId = req.params.id;
    const userId = req.user.userId;

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Điểm đánh giá phải từ 1 đến 5 sao' });
    }

    const existing = db.prepare('SELECT rating_id FROM document_ratings WHERE document_id = ? AND user_id = ?').get(docId, userId);
    if (existing) {
      db.prepare('UPDATE document_ratings SET score = ?, comment = ? WHERE document_id = ? AND user_id = ?').run(score, comment || '', docId, userId);
    } else {
      db.prepare('INSERT INTO document_ratings (document_id, user_id, score, comment) VALUES (?, ?, ?, ?)').run(docId, userId, score, comment || '');
    }

    // Recalculate average
    const avg = db.prepare('SELECT AVG(score) as avg_score FROM document_ratings WHERE document_id = ?').get(docId).avg_score;
    db.prepare('UPDATE documents SET avg_rating = ROUND(?, 2) WHERE document_id = ?').run(avg || 0, docId);

    res.json({
      success: true,
      message: 'Đánh giá tài liệu thành công',
      data: { avg_rating: Math.round((avg || 0) * 10) / 10 }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

