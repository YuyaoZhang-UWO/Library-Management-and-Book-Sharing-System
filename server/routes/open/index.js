const express = require('express');
const router = express.Router();
const db = require('../../db/dbPool.js');

router.get('/books', async (req, res) => {
  try {
    // 1. Read pagination parameters from query
    const page = parseInt(req.query.page) || 1; // default page 1
    const limit = parseInt(req.query.limit) || 20; // default 20 items
    const offset = (page - 1) * limit;

    // 2. Query total number of books
    const totalSql = `SELECT COUNT(*) AS total FROM books`;
    const [totalRows] = await db.query(totalSql);
    const total = totalRows[0].total;

    // 3. Query paged results
    const sql = `SELECT * FROM books LIMIT ?, ?`;
    const [books] = await db.query(sql, [offset, limit]);

    // 4. Construct response
    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: books,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;
