const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { broadcastPostUpdate, sendNotification } = require('../realtime');

// GET /api/posts/feed - SMART FEED ALGORITHM
router.get('/feed', authenticateToken, (req, res) => {
  try {
    const { category, scope_type } = req.query;
    const userClassId = req.user.classId || -1;
    const userCourseId = req.user.courseId || -1;
    const userFacultyId = req.user.facultyId || -1;
    const userSchoolId = req.user.schoolId || 1;

    let baseQuery = `
      SELECT p.*, u.full_name as author_name, u.student_code as author_code, u.avatar_url as author_avatar,
             c.name as class_name,
             (SELECT count(*) FROM reactions r WHERE r.post_id = p.post_id AND r.user_id = ?) as user_has_reacted,
             CASE
               WHEN p.scope_type = 'CLASS' AND p.scope_id = ? THEN 4
               WHEN p.scope_type = 'COURSE' AND p.scope_id = ? THEN 3
               WHEN p.scope_type = 'FACULTY' AND p.scope_id = ? THEN 2
               WHEN p.scope_type = 'SCHOOL' THEN 1
               ELSE 0
             END as priority_weight
      FROM posts p
      JOIN users u ON p.author_id = u.user_id
      LEFT JOIN classes c ON u.class_id = c.class_id
      WHERE p.status = 'VISIBLE'
    `;

    const params = [req.user.userId, userClassId, userCourseId, userFacultyId];

    if (category && category !== 'ALL') {
      baseQuery += ` AND p.category = ?`;
      params.push(category);
    }

    if (scope_type && scope_type !== 'ALL') {
      baseQuery += ` AND p.scope_type = ?`;
      params.push(scope_type);
    }

    baseQuery += ` ORDER BY priority_weight DESC, p.created_at DESC LIMIT 50`;

    const posts = db.prepare(baseQuery).all(...params);

    res.json({
      success: true,
      data: posts
    });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/posts - Đăng bài viết
router.post('/', authenticateToken, (req, res) => {
  try {
    const { scope_type, scope_id, category, content, media_urls } = req.body;
    if (!content || !scope_type || !category) {
      return res.status(400).json({ success: false, message: 'Nội dung, phạm vi và phân loại không được để trống' });
    }

    const postId = uuidv4();
    const effectiveScopeId = scope_id || (scope_type === 'CLASS' ? req.user.classId : (scope_type === 'FACULTY' ? req.user.facultyId : 1));

    db.prepare(`
      INSERT INTO posts (post_id, author_id, scope_type, scope_id, category, content, media_urls)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(postId, req.user.userId, scope_type, effectiveScopeId || 1, category, content, JSON.stringify(media_urls || []));

    const newPost = db.prepare(`
      SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
      FROM posts p JOIN users u ON p.author_id = u.user_id WHERE p.post_id = ?
    `).get(postId);

    broadcastPostUpdate(postId, { action: 'CREATED', post: newPost });

    res.status(201).json({
      success: true,
      data: newPost
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/posts/:id/comments
router.get('/:id/comments', authenticateToken, (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, u.full_name as author_name, u.avatar_url as author_avatar
    FROM comments c JOIN users u ON c.author_id = u.user_id
    WHERE c.post_id = ? AND c.status = 'VISIBLE'
    ORDER BY c.created_at ASC
  `).all(req.params.id);

  res.json({ success: true, data: comments });
});

// POST /api/posts/:id/comments
router.post('/:id/comments', authenticateToken, (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Nội dung bình luận rỗng' });

    const commentId = uuidv4();
    const postId = req.params.id;

    db.prepare(`
      INSERT INTO comments (comment_id, post_id, author_id, content)
      VALUES (?, ?, ?, ?)
    `).run(commentId, postId, req.user.userId, content);

    // Increment count
    db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE post_id = ?').run(postId);

    // Notify post author if not self
    const post = db.prepare('SELECT author_id FROM posts WHERE post_id = ?').get(postId);
    if (post && post.author_id !== req.user.userId) {
      const notifContent = `${req.user.full_name} đã bình luận vào bài viết của bạn.`;
      const notif = db.prepare(`
        INSERT INTO notifications (recipient_id, actor_id, type, ref_id, content)
        VALUES (?, ?, 'NEW_COMMENT', ?, ?)
      `).run(post.author_id, req.user.userId, postId, notifContent);

      sendNotification(post.author_id, {
        notification_id: notif.lastInsertRowid,
        type: 'NEW_COMMENT',
        title: 'Bình luận mới',
        content: notifContent,
        ref_id: postId
      });
    }

    const created = db.prepare(`
      SELECT c.*, u.full_name as author_name, u.avatar_url as author_avatar
      FROM comments c JOIN users u ON c.author_id = u.user_id WHERE c.comment_id = ?
    `).get(commentId);

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/posts/:id/reactions
router.post('/:id/reactions', authenticateToken, (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.userId;
    const type = req.body.type || 'LIKE';

    const existing = db.prepare('SELECT reaction_id FROM reactions WHERE post_id = ? AND user_id = ?').get(postId, userId);

    let action = 'ADDED';
    if (existing) {
      db.prepare('DELETE FROM reactions WHERE post_id = ? AND user_id = ?').run(postId, userId);
      db.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE post_id = ?').run(postId);
      action = 'REMOVED';
    } else {
      db.prepare('INSERT INTO reactions (post_id, user_id, type) VALUES (?, ?, ?)').run(postId, userId, type);
      db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE post_id = ?').run(postId);
    }

    const currentPost = db.prepare('SELECT like_count FROM posts WHERE post_id = ?').get(postId);
    broadcastPostUpdate(postId, { action, like_count: currentPost.like_count });

    res.json({
      success: true,
      data: {
        action,
        like_count: currentPost.like_count,
        has_reacted: action === 'ADDED'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/posts/:id/report - Báo cáo vi phạm
router.post('/:id/report', authenticateToken, (req, res) => {
  try {
    const { reason, description } = req.body;
    db.prepare(`
      INSERT INTO reports (reporter_id, target_type, target_id, reason, description)
      VALUES (?, 'POST', ?, ?, ?)
    `).run(req.user.userId, req.params.id, reason || 'Vi phạm nội dung', description || '');

    res.json({ success: true, message: 'Báo cáo vi phạm đã được gửi đến ban quản trị' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

