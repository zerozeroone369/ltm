const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'unilife_super_secret_jwt_key_2026_network_programming';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Vui lòng đăng nhập để thực hiện hành động này'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        errorCode: 'FORBIDDEN',
        message: 'Phiên đăng nhập đã hết hạn hoặc token không hợp lệ'
      });
    }

    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'ACCESS_DENIED',
      message: 'Chỉ có Quản trị viên (Admin) mới có quyền truy cập chức năng này'
    });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  JWT_SECRET
};

