const express = require('express');
const router = express.Router();
const db = require('../../db/dbPool');
const { validateInput, bookSearchSchema } = require('../../validationSchemas');

// Search books
router.get('/books/search', async (req, res) => {
  try {
    const validatedData = validateInput(bookSearchSchema, req.query, res);
    if (!validatedData) return;

    const { query, category, author, page = 1, limit = 20 } = validatedData;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sqlQuery = `
      SELECT 
        b.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        b.conditions,
        b.availability_status,
        b.owner_id,
        u.username AS owner_name,
        b.created_at
      FROM books b
      JOIN users u ON b.owner_id = u.user_id
      WHERE b.availability_status = 'available'
    `;
    const queryParams = [];

    // search conditions
    if (query) {
      sqlQuery += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)`;
      const searchPattern = `%${query}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (category) {
      sqlQuery += ` AND b.category = ?`;
      queryParams.push(category);
    }

    if (author) {
      sqlQuery += ` AND b.author LIKE ?`;
      queryParams.push(`%${author}%`);
    }

    sqlQuery += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), offset);

    const [books] = await db.query(sqlQuery, queryParams);

    // get total number of books
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM books b
      WHERE b.availability_status = 'available'
    `;
    const countParams = [];

    if (query) {
      countQuery += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)`;
      const searchPattern = `%${query}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (category) {
      countQuery += ` AND b.category = ?`;
      countParams.push(category);
    }

    if (author) {
      countQuery += ` AND b.author LIKE ?`;
      countParams.push(`%${author}%`);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      status: 'success',
      data: {
        books,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Search books error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search books',
    });
  }
});

// Get book details
router.get('/books/:book_id', async (req, res) => {
  try {
    const book_id = parseInt(req.params.book_id);

    if (!book_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parameters',
      });
    }

    const [books] = await db.query(
      `SELECT 
        b.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        b.conditions,
        b.availability_status,
        b.owner_id,
        u.username AS owner_name,
        b.created_at
      FROM books b
      JOIN users u ON b.owner_id = u.user_id
      WHERE b.book_id = ?`,
      [book_id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The book does not exist',
      });
    }

    const book = books[0];

    // get average rating and statistics
    const [stats] = await db.query(
      `SELECT 
        bs.times_borrowed,
        bs.average_rating,
        COUNT(DISTINCT r.review_id) as review_count
      FROM book_statistics bs
      LEFT JOIN reviews r ON bs.book_id = r.book_id
      WHERE bs.book_id = ?
      GROUP BY bs.book_id, bs.times_borrowed, bs.average_rating`,
      [book_id]
    );

    // get review list
    const [reviews] = await db.query(
      `SELECT 
        r.review_id,
        r.reviewer_id,
        u.username AS reviewer_name,
        r.rating,
        r.comment,
        r.created_at
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.user_id
      WHERE r.book_id = ?
      ORDER BY r.created_at DESC
      LIMIT 10`,
      [book_id]
    );

    res.json({
      status: 'success',
      data: {
        ...book,
        statistics: stats[0] || {
          times_borrowed: 0,
          average_rating: null,
          review_count: 0,
        },
        reviews: reviews.map((review) => ({
          ...review,
          reviewer_name: review.reviewer_name || '匿名用户',
        })),
      },
    });
  } catch (error) {
    console.error('Get book detail error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get book details',
    });
  }
});

// Get popular books (by borrowing times)
router.get('/books/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const [books] = await db.query(
      `SELECT 
        b.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        b.availability_status,
        bs.times_borrowed,
        bs.average_rating
      FROM books b
      LEFT JOIN book_statistics bs ON b.book_id = bs.book_id
      WHERE b.availability_status = 'available'
      ORDER BY bs.times_borrowed DESC, bs.average_rating DESC
      LIMIT ?`,
      [parseInt(limit)]
    );

    res.json({
      status: 'success',
      data: books.map((book) => ({
        ...book,
        times_borrowed: parseInt(book.times_borrowed || 0),
        average_rating: book.average_rating ? parseFloat(book.average_rating).toFixed(1) : null,
      })),
    });
  } catch (error) {
    console.error('Get popular books error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get popular books',
    });
  }
});

// Get recently added books
router.get('/books/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const [books] = await db.query(
      `SELECT 
        b.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        b.conditions,
        b.availability_status,
        u.username AS owner_name,
        b.created_at
      FROM books b
      JOIN users u ON b.owner_id = u.user_id
      WHERE b.availability_status = 'available'
      ORDER BY b.created_at DESC
      LIMIT ?`,
      [parseInt(limit)]
    );

    res.json({
      status: 'success',
      data: books,
    });
  } catch (error) {
    console.error('Get recent books error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get recently added books',
    });
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await db.query(
      `SELECT 
        category,
        COUNT(*) as book_count
      FROM books
      WHERE category IS NOT NULL AND category != '' AND availability_status = 'available'
      GROUP BY category
      ORDER BY book_count DESC`
    );

    res.json({
      status: 'success',
      data: categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get categories',
    });
  }
});

// Get book reviews (paged)
router.get('/books/:book_id/reviews', async (req, res) => {
  try {
    const book_id = parseInt(req.params.book_id);
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!book_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parameters',
      });
    }

    // check if the book exists
    const [books] = await db.query('SELECT * FROM books WHERE book_id = ?', [
      book_id,
    ]);

    if (books.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The book does not exist',
      });
    }

        // get reviews
    const [reviews] = await db.query(
      `SELECT 
        r.review_id,
        r.reviewer_id,
        u.username AS reviewer_name,
        r.rating,
        r.comment,
        r.created_at
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.user_id
      WHERE r.book_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [book_id, parseInt(limit), offset]
    );

    // get total number of reviews
    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM reviews WHERE book_id = ?',
      [book_id]
    );

    // get rating distribution
    const [ratingStats] = await db.query(
      `SELECT 
        rating,
        COUNT(*) as count
      FROM reviews
      WHERE book_id = ?
      GROUP BY rating
      ORDER BY rating DESC`,
      [book_id]
    );

    res.json({
      status: 'success',
      data: {
        reviews: reviews.map((review) => ({
          ...review,
          reviewer_name: review.reviewer_name || 'Anonymous user',
        })),
        rating_distribution: ratingStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get book reviews error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get book reviews',
    });
  }
});

module.exports = router;
