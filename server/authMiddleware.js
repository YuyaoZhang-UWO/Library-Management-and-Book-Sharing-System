const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'ECE9014';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).send('Missing token');
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(403).send('Invalid token');
  }
}

function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).send('Not authenticated');
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).send('Permission denied');
    }
    next();
  };
}

module.exports = { auth, requireRole };
