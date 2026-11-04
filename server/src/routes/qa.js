const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../realtime');

// GET /api/qa/questions
router.get('/questions', authenticateToken, (req, res) => {
  try {
    const { subject_id, keyword, filter_type } = req.query;
    let query = `
      SELECT q.*, u.full_name as author_name, u.avatar_url as author_avatar, s.name as subject_name,
             (SELECT count(*) FROM answers a WHERE a.question_id = q.question_id AND a.status = 'VISIBLE') as answer_count
      FROM questions q
      JOIN users u ON q.author_id = u.user_id
      JOIN subjects s ON q.subject_id = s.subject_id
      WHERE q.status = 'VISIBLE'
    `;
    const params = [];

    if (subject_id) {
      query += ` AND q.subject_id = ?`;
      params.push(subject_id);
    }
    if (keyword) {
      query += ` AND (q.title LIKE ? OR q.content LIKE ?)`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (filter_type === 'RESOLVED') {
      query += ` AND q.accepted_answer_id IS NOT NULL`;
    } else if (filter_type === 'UNRESOLVED') {
      query += ` AND q.accepted_answer_id IS NULL`;
    }

    query += ` ORDER BY q.created_at DESC`;
    const questions = db.prepare(query).all(...params);

    res.json({ success: true, data: questions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/qa/questions
router.post('/questions', authenticateToken, (req, res) => {
  try {
    const { subject_id, title, content, tags } = req.body;
    if (!subject_id || !title || !content) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn môn học, nhập tiêu đề và nội dung câu hỏi' });
    }

    const questionId = uuidv4();
    db.prepare(`
      INSERT INTO questions (question_id, author_id, subject_id, title, content, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(questionId, req.user.userId, subject_id, title, content, JSON.stringify(tags || []));

    const newQ = db.prepare(`
      SELECT q.*, u.full_name as author_name, u.avatar_url as author_avatar, s.name as subject_name
      FROM questions q
      JOIN users u ON q.author_id = u.user_id
      JOIN subjects s ON q.subject_id = s.subject_id
      WHERE q.question_id = ?
    `).get(questionId);

    res.status(201).json({ success: true, data: newQ });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/qa/questions/:id
router.get('/questions/:id', authenticateToken, (req, res) => {
  try {
    const question = db.prepare(`
      SELECT q.*, u.full_name as author_name, u.avatar_url as author_avatar, s.name as subject_name
      FROM questions q
      JOIN users u ON q.author_id = u.user_id
      JOIN subjects s ON q.subject_id = s.subject_id
      WHERE q.question_id = ? AND q.status = 'VISIBLE'
    `).get(req.params.id);

    if (!question) return res.status(404).json({ success: false, message: 'Câu hỏi không tồn tại' });

    const answers = db.prepare(`
      SELECT a.*, u.full_name as author_name, u.avatar_url as author_avatar,
             (SELECT vote_type FROM votes v WHERE v.answer_id = a.answer_id AND v.user_id = ?) as user_vote
      FROM answers a
      JOIN users u ON a.author_id = u.user_id
      WHERE a.question_id = ? AND a.status = 'VISIBLE'
      ORDER BY a.is_accepted DESC, a.upvote_count DESC, a.created_at ASC
    `).all(req.user.userId, req.params.id);

    res.json({
      success: true,
      data: {
        question,
        answers
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/qa/questions/:id/answers
router.post('/questions/:id/answers', authenticateToken, (req, res) => {
  try {
    const { content } = req.body;
    const questionId = req.params.id;
    if (!content) return res.status(400).json({ success: false, message: 'Nội dung câu trả lời không được rỗng' });

    const answerId = uuidv4();
    db.prepare(`
      INSERT INTO answers (answer_id, question_id, author_id, content)
      VALUES (?, ?, ?, ?)
    `).run(answerId, questionId, req.user.userId, content);

    // Notify question author
    const q = db.prepare('SELECT author_id, title FROM questions WHERE question_id = ?').get(questionId);
    if (q && q.author_id !== req.user.userId) {
      const msg = `${req.user.full_name} đã trả lời câu hỏi: "${q.title.slice(0, 40)}..."`;
      const notif = db.prepare(`
        INSERT INTO notifications (recipient_id, actor_id, type, ref_id, content)
        VALUES (?, ?, 'ANSWERED_QUESTION', ?, ?)
      `).run(q.author_id, req.user.userId, questionId, msg);

      sendNotification(q.author_id, {
        notification_id: notif.lastInsertRowid,
        type: 'ANSWERED_QUESTION',
        title: 'Có câu trả lời mới',
        content: msg,
        ref_id: questionId
      });
    }

    const created = db.prepare(`
      SELECT a.*, u.full_name as author_name, u.avatar_url as author_avatar
      FROM answers a JOIN users u ON a.author_id = u.user_id WHERE a.answer_id = ?
    `).get(answerId);

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/qa/answers/:id/vote
router.post('/answers/:id/vote', authenticateToken, (req, res) => {
  try {
    const answerId = req.params.id;
    const userId = req.user.userId;
    const voteType = req.body.vote_type || 1; // 1 for upvote

    const existing = db.prepare('SELECT vote_id FROM votes WHERE answer_id = ? AND user_id = ?').get(answerId, userId);
    if (existing) {
      db.prepare('DELETE FROM votes WHERE answer_id = ? AND user_id = ?').run(answerId, userId);
      db.prepare('UPDATE answers SET upvote_count = MAX(0, upvote_count - 1) WHERE answer_id = ?').run(answerId);
    } else {
      db.prepare('INSERT INTO votes (answer_id, user_id, vote_type) VALUES (?, ?, ?)').run(answerId, userId, voteType);
      db.prepare('UPDATE answers SET upvote_count = upvote_count + 1 WHERE answer_id = ?').run(answerId);
    }

    const ans = db.prepare('SELECT upvote_count FROM answers WHERE answer_id = ?').get(answerId);
    res.json({
      success: true,
      data: {
        upvote_count: ans.upvote_count,
        has_voted: !existing
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/qa/questions/:id/accept-answer
router.patch('/questions/:id/accept-answer', authenticateToken, (req, res) => {
  try {
    const { answer_id } = req.body;
    const q = db.prepare('SELECT author_id FROM questions WHERE question_id = ?').get(req.params.id);

    if (!q) return res.status(404).json({ success: false, message: 'Câu hỏi không tồn tại' });
    if (q.author_id !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Chỉ người đặt câu hỏi mới được đánh dấu câu trả lời đúng' });
    }

    // Reset previous answers
    db.prepare('UPDATE answers SET is_accepted = 0 WHERE question_id = ?').run(req.params.id);
    // Mark target
    db.prepare('UPDATE answers SET is_accepted = 1 WHERE answer_id = ?').run(answer_id);
    db.prepare('UPDATE questions SET accepted_answer_id = ? WHERE question_id = ?').run(answer_id, req.params.id);

    // Notify answerer
    const ans = db.prepare('SELECT author_id FROM answers WHERE answer_id = ?').get(answer_id);
    if (ans) {
      const msg = `Câu trả lời của bạn đã được đánh dấu là đáp án chính xác!`;
      db.prepare(`
        INSERT INTO notifications (recipient_id, actor_id, type, ref_id, content)
        VALUES (?, ?, 'ACCEPTED_ANSWER', ?, ?)
      `).run(ans.author_id, req.user.userId, req.params.id, msg);

      sendNotification(ans.author_id, {
        type: 'ACCEPTED_ANSWER',
        title: 'Đáp án được chấp nhận',
        content: msg,
        ref_id: req.params.id
      });
    }

    res.json({ success: true, message: 'Đã đánh dấu câu trả lời đúng thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/qa/questions/:id - Xóa câu hỏi (Người hỏi hoặc Admin)
router.delete('/questions/:id', authenticateToken, (req, res) => {
  try {
    const q = db.prepare('SELECT author_id FROM questions WHERE question_id = ?').get(req.params.id);
    if (!q) return res.status(404).json({ success: false, message: 'Câu hỏi không tồn tại' });

    if (q.author_id !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa câu hỏi này' });
    }

    db.prepare('UPDATE questions SET status = "DELETED" WHERE question_id = ?').run(req.params.id);
    res.json({ success: true, message: 'Đã xóa câu hỏi thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/qa/answers/:id - Xóa câu trả lời (Người trả lời hoặc Admin)
router.delete('/answers/:id', authenticateToken, (req, res) => {
  try {
    const ans = db.prepare('SELECT author_id, question_id, is_accepted FROM answers WHERE answer_id = ?').get(req.params.id);
    if (!ans) return res.status(404).json({ success: false, message: 'Câu trả lời không tồn tại' });

    if (ans.author_id !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa câu trả lời này' });
    }

    db.prepare('UPDATE answers SET status = "DELETED" WHERE answer_id = ?').run(req.params.id);

    // If it was accepted answer, clear it from question
    if (ans.is_accepted) {
      db.prepare('UPDATE questions SET accepted_answer_id = NULL WHERE question_id = ?').run(ans.question_id);
    }

    res.json({ success: true, message: 'Đã xóa câu trả lời' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

