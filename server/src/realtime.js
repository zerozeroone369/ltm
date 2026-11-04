const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');

let io = null;
const activeUsers = new Map(); // Map<userId, Set<socketId>>

function initRealtime(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // JWT Middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    jwt.verify(cleanToken, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error: Invalid token'));
      socket.data.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const userId = user.userId || user.sub;

    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, new Set());
    }
    activeUsers.get(userId).add(socket.id);

    console.log(`[Socket] User connected: ${user.full_name || userId} (Socket: ${socket.id})`);

    // Join personal notification room
    socket.join(`user:${userId}`);

    // Join class room if assigned
    if (user.classId) {
      socket.join(`class:${user.classId}`);
    }

    // Join custom group room
    socket.on('join_group', (groupId) => {
      socket.join(`group:${groupId}`);
      console.log(`[Socket] ${user.full_name} joined room group:${groupId}`);
    });

    socket.on('leave_group', (groupId) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on('disconnect', () => {
      const userSockets = activeUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          activeUsers.delete(userId);
          console.log(`[Socket] User went offline: ${userId}`);
        }
      }
    });
  });

  return io;
}

function sendNotification(recipientId, data) {
  if (io) {
    io.to(`user:${recipientId}`).emit('notification_received', data);
  }
}

function broadcastPostUpdate(postId, data) {
  if (io) {
    io.emit('post_updated', { postId, ...data });
  }
}

function broadcastToClass(classId, event, data) {
  if (io) {
    io.to(`class:${classId}`).emit(event, data);
  }
}

function getActiveUsersCount() {
  return activeUsers.size;
}

module.exports = {
  initRealtime,
  sendNotification,
  broadcastPostUpdate,
  broadcastToClass,
  getActiveUsersCount
};

