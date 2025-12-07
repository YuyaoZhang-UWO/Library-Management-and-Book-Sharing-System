const express = require('express');
const router = express.Router();
const db = require('../../db/dbPool');
const {
  validateInput,
  addBookSchema,
  updateBookSchema,
  positiveNumberSchema,
} = require('../../validationSchemas');

// Get all books (admin)
router.get('/books', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        b.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        b.conditions,
        b.created_at,
        COUNT(DISTINCT i.inventory_id) as total_copies,
        COUNT(DISTINCT CASE WHEN i.status = 'available' THEN i.inventory_id END) as available_copies
      FROM books b
      LEFT JOIN inventory i ON b.book_id = i.book_id
      WHERE 1=1
    `;
    const queryParams = [];

    if (search) {
      query += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)`;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    query += ` GROUP BY b.book_id, b.title, b.author, b.isbn, b.category, b.conditions, b.created_at`;
    query += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), offset);

    const [books] = await db.query(query, queryParams);

    // get total number of books
    let countQuery = 'SELECT COUNT(*) as total FROM books WHERE 1=1';
    const countParams = [];
    if (search) {
      countQuery += ` AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
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
    console.error('Get books error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get books list',
    });
  }
});

// Get single book details (admin)
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
        b.owner_id,
        u.username AS owner_name,
        b.availability_status,
        b.created_at
      FROM books b
      JOIN users u ON b.owner_id = u.user_id
      WHERE b.book_id = ?`,
      [book_id],
    );

    if (books.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The book does not exist',
      });
    }

    res.json({
      status: 'success',
      data: books[0],
    });
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get book details',
    });
  }
});

// Add book (admin can add books on behalf of users)
router.post('/books', async (req, res) => {
  try {
    const validatedData = validateInput(addBookSchema, req.body, res);
    if (!validatedData) return;

    const { title, author, isbn, category, conditions } = validatedData;
    const owner_id = req.body.owner_id || req.user.user_id; // default is the admin himself

    // check if ISBN already exists
    if (isbn) {
      const [existingBooks] = await db.query(
        'SELECT * FROM books WHERE isbn = ?',
        [isbn],
      );

      if (existingBooks.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'The ISBN already exists',
        });
      }
    }

    const [result] = await db.query(
      `INSERT INTO books 
       (title, author, isbn, category, conditions, owner_id, availability_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'available', NOW())`,
      [
        title,
        author || null,
        isbn || null,
        category || null,
        conditions || null,
        owner_id,
      ],
    );

    res.status(201).json({
      status: 'success',
      message: 'Add book successfully',
      data: {
        book_id: result.insertId,
      },
    });
  } catch (error) {
    console.error('Add book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add book',
    });
  }
});

// Update book information
router.put('/books/:book_id', async (req, res) => {
  try {
    const book_id = parseInt(req.params.book_id);

    if (!book_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parameters',
      });
    }

    const validatedData = validateInput(updateBookSchema, req.body, res);
    if (!validatedData) return;

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

    // if update ISBN, check if it conflicts with other books
    if (validatedData.isbn) {
      const [existingBooks] = await db.query(
        'SELECT * FROM books WHERE isbn = ? AND book_id != ?',
        [validatedData.isbn, book_id],
      );

      if (existingBooks.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'The ISBN is already in use',
        });
      }
    }

    // build update fields
    const updateFields = [];
    const updateValues = [];

    if (validatedData.title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(validatedData.title);
    }
    if (validatedData.author !== undefined) {
      updateFields.push('author = ?');
      updateValues.push(validatedData.author);
    }
    if (validatedData.isbn !== undefined) {
      updateFields.push('isbn = ?');
      updateValues.push(validatedData.isbn || null);
    }
    if (validatedData.category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(validatedData.category || null);
    }
    if (validatedData.conditions !== undefined) {
      updateFields.push('conditions = ?');
      updateValues.push(validatedData.conditions || null);
    }
    if (validatedData.availability_status !== undefined) {
      updateFields.push('availability_status = ?');
      updateValues.push(validatedData.availability_status);
    }

    updateValues.push(book_id);

    await db.query(
      `UPDATE books SET ${updateFields.join(', ')} WHERE book_id = ?`,
      updateValues,
    );

    res.json({
      status: 'success',
      message: 'Update book successfully',
    });
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update book',
    });
  }
});

// Delete book
router.delete('/books/:book_id', async (req, res) => {
  try {
    const book_id = parseInt(req.params.book_id);

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

    const book = books[0];

    // if there are any borrowed records, cannot delete
    if (book.availability_status === 'lent_out') {
      return res.status(400).json({
        status: 'error',
        message: 'The book has borrowed records, cannot delete',
      });
    }

    await db.query('DELETE FROM books WHERE book_id = ?', [book_id]);

    res.json({
      status: 'success',
      message: 'Delete book successfully',
    });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete book',
    });
  }
});

// Get all borrow records
router.get('/borrows', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, borrower_id, book_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        bt.transaction_id,
        bt.borrower_id,
        u.username AS borrower_name,
        u.email AS borrower_email,
        i.book_id,
        b.title,
        b.author,
        b.isbn,
        i.owner_id,
        ou.username AS owner_name,
        bt.borrow_date,
        bt.due_date,
        bt.return_date,
        bt.status
      FROM borrow_transactions bt
      JOIN users u ON bt.borrower_id = u.user_id
      JOIN inventory i ON bt.inventory_id = i.inventory_id
      JOIN books b ON i.book_id = b.book_id
      JOIN users ou ON i.owner_id = ou.user_id
      WHERE 1=1
    `;
    const queryParams = [];

    if (status) {
      query += ` AND bt.status = ?`;
      queryParams.push(status);
    }

    if (borrower_id) {
      query += ` AND bt.borrower_id = ?`;
      queryParams.push(parseInt(borrower_id));
    }

    if (book_id) {
      query += ` AND i.book_id = ?`;
      queryParams.push(parseInt(book_id));
    }

    query += ` ORDER BY bt.borrow_date DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), offset);

    const [borrows] = await db.query(query, queryParams);

    // get total number of borrows
    let countQuery = `
      SELECT COUNT(*) as total
      FROM borrow_transactions bt
      JOIN inventory i ON bt.inventory_id = i.inventory_id
      WHERE 1=1
    `;
    const countParams = [];

    if (status) {
      countQuery += ` AND bt.status = ?`;
      countParams.push(status);
    }

    if (borrower_id) {
      countQuery += ` AND bt.borrower_id = ?`;
      countParams.push(parseInt(borrower_id));
    }

    if (book_id) {
      countQuery += ` AND i.book_id = ?`;
      countParams.push(parseInt(book_id));
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      status: 'success',
      data: {
        borrows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get borrows error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get borrow records',
    });
  }
});

// Get all waitlist
router.get('/waitlist', async (req, res) => {
  try {
    const { page = 1, limit = 20, book_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        w.waitlist_id,
        w.user_id,
        u.username AS user_name,
        u.email AS user_email,
        w.book_id,
        b.title,
        b.author,
        b.isbn,
        w.requested_at
      FROM waitlist w
      JOIN users u ON w.user_id = u.user_id
      JOIN books b ON w.book_id = b.book_id
      WHERE 1=1
    `;
    const queryParams = [];

    if (book_id) {
      query += ` AND w.book_id = ?`;
      queryParams.push(parseInt(book_id));
    }

    query += ` ORDER BY w.requested_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), offset);

    const [waitlist] = await db.query(query, queryParams);

    // get total number of waitlist
    let countQuery = 'SELECT COUNT(*) as total FROM waitlist WHERE 1=1';
    const countParams = [];
    if (book_id) {
      countQuery += ` AND book_id = ?`;
      countParams.push(parseInt(book_id));
    }
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      status: 'success',
      data: {
        waitlist,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get waitlist error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get waitlist',
    });
  }
});

// Get all fines
router.get('/fines', async (req, res) => {
  try {
    const { page = 1, limit = 20, paid, user_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        f.fine_id,
        f.transaction_id,
        f.user_id,
        u.username AS user_name,
        u.email AS user_email,
        f.amount,
        f.paid,
        f.issued_at,
        f.paid_at,
        i.book_id,
        b.title,
        b.author
      FROM fines f
      JOIN users u ON f.user_id = u.user_id
      LEFT JOIN borrow_transactions bt ON f.transaction_id = bt.transaction_id
      LEFT JOIN inventory i ON bt.inventory_id = i.inventory_id
      LEFT JOIN books b ON i.book_id = b.book_id
      WHERE 1=1
    `;
    const queryParams = [];

    if (paid !== undefined) {
      query += ` AND f.paid = ?`;
      queryParams.push(paid === 'true' ? 1 : 0);
    }

    if (user_id) {
      query += ` AND f.user_id = ?`;
      queryParams.push(parseInt(user_id));
    }

    query += ` ORDER BY f.issued_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), offset);

    const [fines] = await db.query(query, queryParams);

    // get total number of fines and total amount
    let countQuery =
      'SELECT COUNT(*) as total, SUM(amount) as total_amount FROM fines WHERE 1=1';
    const countParams = [];
    if (paid !== undefined) {
      countQuery += ` AND paid = ?`;
      countParams.push(paid === 'true' ? 1 : 0);
    }
    if (user_id) {
      countQuery += ` AND user_id = ?`;
      countParams.push(parseInt(user_id));
    }
    const [countResult] = await db.query(countQuery, countParams);

    res.json({
      status: 'success',
      data: {
        fines,
        summary: {
          total: countResult[0].total,
          total_amount: parseFloat(countResult[0].total_amount || 0),
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get fines error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get fines',
    });
  }
});

// Admin update fine status
router.put('/fines/:fine_id', async (req, res) => {
  try {
    const fine_id = parseInt(req.params.fine_id);
    const { paid, amount } = req.body;

    if (!fine_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parameters',
      });
    }

    const [fines] = await db.query('SELECT * FROM fines WHERE fine_id = ?', [
      fine_id,
    ]);

    if (fines.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The fine record does not exist',
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (paid !== undefined) {
      updateFields.push('paid = ?');
      updateValues.push(paid ? 1 : 0);
      if (paid) {
        updateFields.push('paid_at = ?');
        updateValues.push(new Date());
      }
    }

    if (amount !== undefined) {
      updateFields.push('amount = ?');
      updateValues.push(parseFloat(amount));
    }

    updateValues.push(fine_id);

    await db.query(
      `UPDATE fines SET ${updateFields.join(', ')} WHERE fine_id = ?`,
      updateValues,
    );

    res.json({
      status: 'success',
      message: 'Update fine record successfully',
    });
  } catch (error) {
    console.error('Update fine error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update fine record',
    });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        user_id,
        username,
        email,
        fname,
        lname,
        date_of_birth,
        is_admin,
        created_at
      FROM users
      WHERE 1=1
    `;
    const queryParams = [];

    if (search) {
      query += ` AND (username LIKE ? OR email LIKE ? OR fname LIKE ? OR lname LIKE ?)`;
      const searchPattern = `%${search}%`;
      queryParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), offset);

    const [users] = await db.query(query, queryParams);

    // get total number of users
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];
    if (search) {
      countQuery += ` AND (username LIKE ? OR email LIKE ? OR fname LIKE ? OR lname LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
    }
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      status: 'success',
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get users',
    });
  }
});

// Analytics routes
router.use('/analytics', require('./analytics'));

// Get statistics
router.get('/statistics', async (req, res) => {
  try {
    // total number of books
    const [bookCount] = await db.query('SELECT COUNT(*) as total FROM books');

    // total number of users
    const [userCount] = await db.query('SELECT COUNT(*) as total FROM users');

    // active borrow count
    const [activeBorrows] = await db.query(
      "SELECT COUNT(*) as total FROM borrow_transactions WHERE status = 'borrowed'",
    );

    // pending waitlist count
    const [waitlistCount] = await db.query(
      'SELECT COUNT(*) as total FROM waitlist',
    );

    // total unpaid fines
    const [unpaidFines] = await db.query(
      'SELECT COUNT(*) as count, SUM(amount) as total FROM fines WHERE paid = FALSE',
    );

    // recent borrow trends in the last 30 days
    const [recentBorrows] = await db.query(
      `SELECT DATE(borrow_date) as date, COUNT(*) as count 
       FROM borrow_transactions 
       WHERE borrow_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(borrow_date)
       ORDER BY date DESC`,
    );

    // borrow times by category
    const [categoryStats] = await db.query(
      `SELECT 
        b.category,
        COUNT(*) as borrow_times
      FROM borrow_transactions bt
      JOIN inventory i ON bt.inventory_id = i.inventory_id
      JOIN books b ON i.book_id = b.book_id
      GROUP BY b.category
      ORDER BY borrow_times DESC
      LIMIT 10`,
    );

    res.json({
      status: 'success',
      data: {
        books: {
          total: bookCount[0].total,
        },
        users: {
          total: userCount[0].total,
        },
        borrows: {
          active: activeBorrows[0].total,
        },
        waitlist: {
          total: waitlistCount[0].total,
        },
        fines: {
          unpaid_count: unpaidFines[0].count,
          unpaid_total: parseFloat(unpaidFines[0].total || 0),
        },
        trends: {
          recent_borrows: recentBorrows,
        },
        categories: categoryStats,
      },
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get statistics',
    });
  }
});

module.exports = router;
