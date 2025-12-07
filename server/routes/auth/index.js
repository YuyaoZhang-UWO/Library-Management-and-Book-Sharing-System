const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db/dbPool.js');
const router = express.Router();
const { validateInput, loginSchema, signupSchema } = require('../../validationSchemas');
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

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const validatedData = validateInput(signupSchema, req.body, res);
    if (!validatedData) return;

    const { email, username, first_name, last_name, password, date_of_birth } = validatedData;

    // Check if email already exists
    const [emailExists] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (emailExists.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already exists',
        error: 'Email already exists', // For frontend compatibility
      });
    }

    // Check if username already exists
    const [usernameExists] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (usernameExists.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Username already exists',
        error: 'Username already exists', // For frontend compatibility
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const [result] = await db.query(
      `INSERT INTO users (username, email, password_hash, fname, lname, date_of_birth, is_admin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        username,
        email,
        password_hash,
        first_name || null,
        last_name || null,
        date_of_birth || null,
      ]
    );

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully',
      data: {
        user_id: result.insertId,
        email: email,
        username: username,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create account',
      error: 'Failed to create account', // For frontend compatibility
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
