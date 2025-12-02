const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../../db/dbPool');
const hashRounds = 12;

const {
  validateInput,
  userNameSchema,
  userNamePasswordSchema,
} = require('../../validationSchemas.js');

// GET all users
router.get('/users', async (req, res) => {
  const [rows] = await db.query(`SELECT user_name, role FROM user`);
  res.json(rows);
});

module.exports = router;
