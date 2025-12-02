const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db/dbPool.js');
const router = express.Router();
const { validateInput, loginSchema } = require('../../validationSchemas');
const JWT_SECRET = process.env.JWT_SECRET || 'ECE9014';

// Log in
router.post('/login', async (req, res) => {
  try {
    const validatedData = validateInput(loginSchema, req.body, res);
    if (!validatedData) return;

    const { email, password } = validatedData;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'The account does not exist',
      });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        status: 'error',
        message: 'The password is incorrect',
      });
    }

    // identify user role
    const role = user.is_admin ? 'admin' : 'user';

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: role,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.json({
      message: 'Successful login',
      token,
      email: user.email,
      role: role,
      user_id: user.user_id,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
});

// log out
router.post('/logout', async (req, res) => {
  res.json({
    status: 'success',
    message: 'Log out successfully',
  });
});

module.exports = router;
