const express = require('express');
const router = express.Router();
const db = require('../../db/dbPool');

// TODO: implement age distribution endpoint
// GET /api/admin/analytics/age-distribution
router.get('/age-distribution', async (req, res) => {
  try {
    // calculate age from date_of_birth and group into ranges
    const [results] = await db.query(`
      SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) < 18 THEN 'Under 18'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 18 AND 25 THEN '18-25'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 26 AND 35 THEN '26-35'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 36 AND 50 THEN '36-50'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) > 50 THEN 'Over 50'
          ELSE 'Unknown'
        END AS age_range,
        COUNT(*) AS count
      FROM users
      WHERE date_of_birth IS NOT NULL
      GROUP BY age_range
      ORDER BY 
        CASE age_range
          WHEN 'Under 18' THEN 1
          WHEN '18-25' THEN 2
          WHEN '26-35' THEN 3
          WHEN '36-50' THEN 4
          WHEN 'Over 50' THEN 5
          ELSE 6
        END
    `);
    
    res.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    console.error('Age distribution error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get age distribution'
    });
  }
});

// TODO: category statistics
// GET /api/admin/analytics/category-stats
router.get('/category-stats', async (req, res) => {
  try {
    // get borrow counts by category
    const [results] = await db.query(`
      SELECT 
        COALESCE(b.category, 'Uncategorized') AS category,
        COUNT(bt.transaction_id) AS borrow_count,
        COUNT(DISTINCT b.book_id) AS book_count
      FROM books b
      LEFT JOIN inventory i ON b.book_id = i.book_id
      LEFT JOIN borrow_transactions bt ON i.inventory_id = bt.inventory_id
      GROUP BY b.category
      ORDER BY borrow_count DESC
    `);
    
    res.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    console.error('Category stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get category stats'
    });
  }
});

// TODO: top books by category
// GET /api/admin/analytics/top-books?category=Fiction
router.get('/top-books', async (req, res) => {
  try {
    // get most borrowed books, optionally filter by category
    const { category, limit = 10 } = req.query;
    
    let query = `
      SELECT 
        b.book_id,
        b.title,
        b.author,
        b.category,
        COUNT(bt.transaction_id) AS borrow_count,
        AVG(CASE 
          WHEN bt.return_date IS NOT NULL 
          THEN DATEDIFF(bt.return_date, bt.borrow_date) 
          ELSE NULL 
        END) AS avg_borrow_days
      FROM books b
      LEFT JOIN inventory i ON b.book_id = i.book_id
      LEFT JOIN borrow_transactions bt ON i.inventory_id = bt.inventory_id
      WHERE 1=1
    `;
    
    const params = [];
    if (category && category !== 'all') {
      query += ` AND b.category = ?`;
      params.push(category);
    }
    
    query += `
      GROUP BY b.book_id, b.title, b.author, b.category
      ORDER BY borrow_count DESC
      LIMIT ?
    `;
    params.push(parseInt(limit));
    
    const [results] = await db.query(query, params);
    
    res.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    console.error('Top books error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get top books'
    });
  }
});

// TODO: honors board - top borrowers and reviewers
// GET /api/admin/analytics/honors-board
router.get('/honors-board', async (req, res) => {
  try {
    // get top 10 users by borrows
    const [topBorrowers] = await db.query(`
      SELECT 
        u.user_id,
        u.username,
        u.fname,
        u.lname,
        COUNT(bt.transaction_id) AS borrow_count,
        COUNT(CASE WHEN bt.status = 'returned' THEN 1 END) AS returned_count,
        ROUND(COUNT(CASE WHEN bt.status = 'returned' THEN 1 END) * 100.0 / COUNT(bt.transaction_id), 1) AS return_rate
      FROM users u
      INNER JOIN borrow_transactions bt ON u.user_id = bt.borrower_id
      GROUP BY u.user_id, u.username, u.fname, u.lname
      ORDER BY borrow_count DESC, return_rate DESC
      LIMIT 10
    `);
    
    // top book contributors (owners with most books shared)
    const [topContributors] = await db.query(`
      SELECT 
        u.user_id,
        u.username,
        u.fname,
        u.lname,
        COUNT(DISTINCT i.book_id) AS books_owned,
        COUNT(bt.transaction_id) AS times_lent,
        ROUND(COUNT(bt.transaction_id) * 1.0 / NULLIF(COUNT(DISTINCT i.book_id), 0), 1) AS avg_borrows_per_book
      FROM users u
      INNER JOIN inventory i ON u.user_id = i.owner_id
      LEFT JOIN borrow_transactions bt ON i.inventory_id = bt.inventory_id
      GROUP BY u.user_id, u.username, u.fname, u.lname
      HAVING books_owned > 0
      ORDER BY times_lent DESC, books_owned DESC
      LIMIT 10
    `);
    
    res.json({
      status: 'success',
      data: {
        top_borrowers: topBorrowers,
        top_contributors: topContributors
      }
    });
  } catch (error) {
    console.error('Honors board error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get honors board'
    });
  }
});

// TODO: borrowing trends over time
// GET /api/admin/analytics/borrowing-trends
router.get('/borrowing-trends', async (req, res) => {
  try {
    // get daily/weekly/monthly trends
    const { period = '30days' } = req.query;
    
    let interval;
    let dateFormat;
    let daysBack;
    
    // figure out what period to use
    if (period === '7days') {
      interval = 'DAY';
      dateFormat = '%Y-%m-%d';
      daysBack = 7;
    } else if (period === '90days') {
      interval = 'WEEK';
      dateFormat = '%Y-%u';  // year-week
      daysBack = 90;
    } else if (period === '12months') {
      interval = 'MONTH';
      dateFormat = '%Y-%m';
      daysBack = 365;
    } else {
      // default 30days
      interval = 'DAY';
      dateFormat = '%Y-%m-%d';
      daysBack = 30;
    }
    
    const [results] = await db.query(`
      SELECT 
        DATE_FORMAT(borrow_date, ?) AS period,
        COUNT(*) AS borrow_count,
        COUNT(CASE WHEN status = 'returned' THEN 1 END) AS returned_count,
        COUNT(CASE WHEN status = 'borrowed' THEN 1 END) AS active_count
      FROM borrow_transactions
      WHERE borrow_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY period
      ORDER BY period ASC
    `, [dateFormat, daysBack]);
    
    res.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    console.error('Borrowing trends error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get borrowing trends'
    });
  }
});

module.exports = router;
