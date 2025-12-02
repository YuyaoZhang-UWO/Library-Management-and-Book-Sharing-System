const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'ECE9014';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({
      status: 'error',
      message: 'Missing authentication token',
    });
  }
  const token = header.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Missing authentication token',
    });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(403).json({
      status: 'error',
      message: 'Invalid authentication token',
    });
  }
}

function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized',
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions',
      });
    }
    next();
  };
}

module.exports = { auth, requireRole };
