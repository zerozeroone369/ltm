require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');
const { initRealtime } = require('./realtime');

// Routes
const authRoutes = require('./routes/auth');
const academicRoutes = require('./routes/academic');
const postsRoutes = require('./routes/posts');
const documentsRoutes = require('./routes/documents');
const qaRoutes = require('./routes/qa');
const groupsRoutes = require('./routes/groups');
const campusRoutes = require('./routes/campus');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Initialize Database & Tables
initDatabase();

// Initialize WebSocket / Socket.io
initRealtime(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/campus', campusRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'UniLife Network Server'
  });
});

// Serve Frontend Client Static Files
const clientPublicPath = path.join(__dirname, '..', '..', 'client', 'public');
app.use(express.static(clientPublicPath));

// SPA Fallback
app.use((req, res) => {
  res.sendFile(path.join(clientPublicPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    statusCode: 500,
    message: err.message || 'Lỗi hệ thống máy chủ'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 UniLife Network Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`📡 WebSocket Realtime Server sẵn sàng`);
  console.log(`📚 Mạng xã hội đời sống sinh viên phục vụ môn Lập trình mạng`);
  console.log(`=======================================================`);
});

