const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../realtime');

// GET /api/groups
router.get('/', authenticateToken, (req, res) => {
  try {
    const { subject_id, status } = req.query;
    let query = `
      SELECT g.*, u.full_name as leader_name, u.avatar_url as leader_avatar, s.name as subject_name,
             (SELECT count(*) FROM group_members gm WHERE gm.group_id = g.group_id AND gm.user_id = ?) as is_member,
             (SELECT status FROM join_requests jr WHERE jr.group_id = g.group_id AND jr.user_id = ? AND jr.status = 'PENDING') as pending_request
      FROM study_groups g
      JOIN users u ON g.leader_id = u.user_id
      JOIN subjects s ON g.subject_id = s.subject_id
      WHERE 1=1
    `;
    const params = [req.user.userId, req.user.userId];

    if (subject_id) {
      query += ` AND g.subject_id = ?`;
      params.push(subject_id);
    }
    if (status) {
      query += ` AND g.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY g.created_at DESC`;
    const groups = db.prepare(query).all(...params);

    res.json({ success: true, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/groups - Tạo nhóm học
router.post('/', authenticateToken, (req, res) => {
  try {
    const { subject_id, name, goal, schedule, location, max_members } = req.body;
    if (!subject_id || !name || !goal) {
      return res.status(400).json({ success: false, message: 'Tên nhóm, môn học và mục tiêu không được để trống' });
    }

    const groupId = uuidv4();
    db.prepare(`
      INSERT INTO study_groups (group_id, leader_id, subject_id, name, goal, schedule, location, max_members, current_members)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(groupId, req.user.userId, subject_id, name, goal, schedule || 'Linh hoạt', location || 'Thư viện / Online', max_members || 5);

    // Add leader to group_members
    db.prepare(`
      INSERT INTO group_members (group_id, user_id, role)
      VALUES (?, ?, 'LEADER')
    `).run(groupId, req.user.userId);

    const created = db.prepare('SELECT * FROM study_groups WHERE group_id = ?').get(groupId);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/groups/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const group = db.prepare(`
      SELECT g.*, u.full_name as leader_name, u.avatar_url as leader_avatar, s.name as subject_name
      FROM study_groups g
      JOIN users u ON g.leader_id = u.user_id
      JOIN subjects s ON g.subject_id = s.subject_id
      WHERE g.group_id = ?
    `).get(req.params.id);

    if (!group) return res.status(404).json({ success: false, message: 'Nhóm học không tồn tại' });

    const members = db.prepare(`
      SELECT gm.*, u.full_name, u.student_code, u.avatar_url, c.name as class_name
      FROM group_members gm
      JOIN users u ON gm.user_id = u.user_id
      LEFT JOIN classes c ON u.class_id = c.class_id
      WHERE gm.group_id = ?
    `).all(req.params.id);

    // If current user is leader, return pending join requests
    let pendingRequests = [];
    if (group.leader_id === req.user.userId) {
      pendingRequests = db.prepare(`
        SELECT jr.*, u.full_name, u.student_code, u.avatar_url
        FROM join_requests jr
        JOIN users u ON jr.user_id = u.user_id
        WHERE jr.group_id = ? AND jr.status = 'PENDING'
      `).all(req.params.id);
    }

    res.json({
      success: true,
      data: {
        group,
        members,
        pendingRequests
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/groups/:id/join - Gửi yêu cầu tham gia
router.post('/:id/join', authenticateToken, (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.userId;
    const { message } = req.body;

    const group = db.prepare('SELECT * FROM study_groups WHERE group_id = ?').get(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Nhóm học không tồn tại' });

    if (group.current_members >= group.max_members) {
      return res.status(400).json({ success: false, message: 'Nhóm học đã đủ số lượng thành viên' });
    }

    const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
    if (isMember) {
      return res.status(400).json({ success: false, message: 'Bạn đã là thành viên của nhóm này' });
    }

    const pending = db.prepare('SELECT request_id FROM join_requests WHERE group_id = ? AND user_id = ? AND status = "PENDING"').get(groupId, userId);
    if (pending) {
      return res.status(400).json({ success: false, message: 'Bạn đã gửi yêu cầu và đang chờ trưởng nhóm phê duyệt' });
    }

    db.prepare(`
      INSERT INTO join_requests (group_id, user_id, message, status)
      VALUES (?, ?, ?, 'PENDING')
    `).run(groupId, userId, message || 'Xin chào, mình muốn tham gia nhóm học cùng bạn');

    // Realtime alert to leader
    const notifMsg = `${req.user.full_name} đã gửi yêu cầu tham gia nhóm học "${group.name}".`;
    db.prepare(`
      INSERT INTO notifications (recipient_id, actor_id, type, ref_id, content)
      VALUES (?, ?, 'JOIN_REQUEST', ?, ?)
    `).run(group.leader_id, userId, groupId, notifMsg);

    sendNotification(group.leader_id, {
      type: 'JOIN_REQUEST',
      title: 'Yêu cầu vào nhóm',
      content: notifMsg,
      ref_id: groupId
    });

    res.json({ success: true, message: 'Đã gửi yêu cầu tham gia nhóm học' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/groups/requests/:requestId - Leader duyệt/từ chối
router.patch('/requests/:requestId', authenticateToken, (req, res) => {
  try {
    const { status } = req.body; // 'ACCEPTED' or 'REJECTED'
    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái xử lý không hợp lệ' });
    }

    const reqData = db.prepare('SELECT * FROM join_requests WHERE request_id = ?').get(req.params.requestId);
    if (!reqData) return res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại' });

    const group = db.prepare('SELECT * FROM study_groups WHERE group_id = ?').get(reqData.group_id);
    if (group.leader_id !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Chỉ trưởng nhóm mới có quyền duyệt thành viên' });
    }

    db.prepare('UPDATE join_requests SET status = ? WHERE request_id = ?').run(status, req.params.requestId);

    if (status === 'ACCEPTED') {
      // Add member
      db.prepare(`
        INSERT OR IGNORE INTO group_members (group_id, user_id, role)
        VALUES (?, ?, 'MEMBER')
      `).run(reqData.group_id, reqData.user_id);

      db.prepare('UPDATE study_groups SET current_members = current_members + 1 WHERE group_id = ?').run(reqData.group_id);
    }

    // Send notification to applicant
    const notifMsg = status === 'ACCEPTED'
      ? `Chúc mừng! Trưởng nhóm đã duyệt bạn vào nhóm học "${group.name}".`
      : `Rất tiếc, yêu cầu tham gia nhóm "${group.name}" của bạn đã bị từ chối.`;

    db.prepare(`
      INSERT INTO notifications (recipient_id, actor_id, type, ref_id, content)
      VALUES (?, ?, 'JOIN_RESPONSE', ?, ?)
    `).run(reqData.user_id, req.user.userId, reqData.group_id, notifMsg);

    sendNotification(reqData.user_id, {
      type: 'JOIN_RESPONSE',
      title: status === 'ACCEPTED' ? 'Yêu cầu được chấp nhận' : 'Yêu cầu bị từ chối',
      content: notifMsg,
      ref_id: reqData.group_id
    });

    res.json({ success: true, message: `Đã ${status === 'ACCEPTED' ? 'chấp nhận' : 'từ chối'} thành viên thành công` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

