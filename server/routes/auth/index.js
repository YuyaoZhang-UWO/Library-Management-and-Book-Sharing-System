const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db/dbPool.js');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ECE9014';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length == 0)
    return res.status(401).json({
      message: 'User not found',
    });
  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match)
    return res.status(400).json({
      message: 'Invalid password, login was unsuccessful',
    });
  const token = jwt.sign(
    {
      email: user.email,
      is_admin: user.is_admin,
    },
    JWT_SECRET,
    { expiresIn: '1d' },
  );
  res.json({
    message: 'Successful login',
    token,
    email: user.email,
    is_admin: user.is_admin,
  });
});

module.exports = router;
