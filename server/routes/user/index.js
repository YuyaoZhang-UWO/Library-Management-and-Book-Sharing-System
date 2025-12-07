const express = require('express');
const router = express.Router();
const db = require('../../db/dbPool');
const {
  validateInput,
  borrowBookSchema,
  returnBookSchema,
  renewBookSchema,
  waitlistBookSchema,
  cancelWaitlistSchema,
  addReviewSchema,
  updateReviewSchema,
  addFavoriteSchema,
  removeFavoriteSchema,
} = require('../../validationSchemas');

// ML Recommendations endpoint
router.get('/recommendations', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const limit = parseInt(req.query.limit) || 10;
    
    // Call Flask ML service
    try {
      const mlResponse = await fetch('http://localhost:5001/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          top_n: limit,
          exclude_borrowed: true
        }),
        signal: AbortSignal.timeout(2000)
      });
      
      if (mlResponse.ok) {
        const mlData = await mlResponse.json();
        
        if (mlData.status === 'success') {
          return res.json({
            status: 'success',
            data: mlData.recommendations,
            source: 'ml_model',
            total: mlData.total_predictions
          });
        }
      }
    } catch (mlError) {
      // ML service is optional, silently use fallback
      // Only log in development mode if needed
      if (process.env.NODE_ENV === 'development') {
        // Uncomment the line below if you want to see ML service status in development
        // console.log('ML service unavailable, using fallback');
      }
    }
    
    // Fallback to popularity-based recommendations if ML service is down
    // Note: borrow_transactions now uses inventory_id, need to join with inventory to get book_id
    const [popularBooks] = await db.query(`
      SELECT 
        b.book_id,
        b.title,
        b.author,
        b.category,
        b.isbn,
        COALESCE(bs.average_rating, 0) as predicted_rating,
        COALESCE(bs.times_borrowed, 0) as popularity
      FROM books b
      LEFT JOIN book_statistics bs ON b.book_id = bs.book_id
      WHERE b.book_id NOT IN (
        SELECT DISTINCT i.book_id 
        FROM borrow_transactions bt
        JOIN inventory i ON bt.inventory_id = i.inventory_id
        WHERE bt.borrower_id = ? AND bt.return_date IS NULL
      )
      AND b.book_id NOT IN (
        SELECT DISTINCT r.book_id 
        FROM reviews r
        WHERE r.reviewer_id = ?
      )
      AND b.book_id IN (
        SELECT DISTINCT i.book_id 
        FROM inventory i
        WHERE i.status = 'available'
      )
      ORDER BY bs.times_borrowed DESC, bs.average_rating DESC
      LIMIT ?
    `, [userId, userId, limit]);
    
    // Ensure numeric types for predicted_rating and popularity
    const formattedBooks = popularBooks.map(book => ({
      ...book,
      predicted_rating: Number(book.predicted_rating) || 0,
      popularity: Number(book.popularity) || 0
    }));
    
    return res.json({
      status: 'success',
      data: formattedBooks,
      source: 'fallback_popularity',
      total: formattedBooks.length
    });
    
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get recommendations'
    });
  }
});

// Get current user's borrow records
router.get('/borrows', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [borrows] = await db.query(
      `SELECT 
        bt.transaction_id,
        i.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        bt.borrow_date,
        bt.due_date,
        bt.return_date,
        bt.status,
        CASE 
          WHEN bt.return_date IS NULL THEN 'borrowed'
          ELSE bt.status
        END AS display_status
      FROM borrow_transactions bt
      JOIN inventory i ON bt.inventory_id = i.inventory_id
      JOIN books b ON i.book_id = b.book_id
      WHERE bt.borrower_id = ?
      ORDER BY bt.borrow_date DESC`,
      [userId]
    );

    // Add computed status for backward compatibility with frontend
    const formattedBorrows = borrows.map(borrow => ({
      ...borrow,
      status: borrow.display_status, // Use display_status for frontend compatibility
    }));

    res.json({
      status: 'success',
      data: formattedBorrows,
    });
  } catch (error) {
    console.error('Get borrows error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Fail to get borrow record',
    });
  }
});

// Borrow book
router.post('/borrow', async (req, res) => {
  try {
    const validatedData = validateInput(borrowBookSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { book_id } = validatedData;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // check if the book exists
      const [books] = await connection.query(
        'SELECT * FROM books WHERE book_id = ?',
        [book_id]
      );

      if (books.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          status: 'error',
          message: 'The book is not exist',
        });
      }

      // find an available inventory copy
      const [availableInventory] = await connection.query(
        'SELECT * FROM inventory WHERE book_id = ? AND status = ? FOR UPDATE',
        [book_id, 'available']
      );

      if (availableInventory.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'The book is not avalible to borrow',
        });
      }

      const inventoryItem = availableInventory[0];

      // check if the user has any unreturned books of the same book_id
      // borrow_transactions.status can be 'returned' or 'overdue'
      // If return_date IS NULL, the book is still borrowed
      const [existingBorrows] = await connection.query(
        `SELECT bt.* FROM borrow_transactions bt
         JOIN inventory i ON bt.inventory_id = i.inventory_id
         WHERE bt.borrower_id = ? AND i.book_id = ? AND bt.return_date IS NULL`,
        [userId, book_id]
      );

      if (existingBorrows.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'The book you borrowed is unreturned',
        });
      }

      // check if the user has any unpaid fines
      const [fines] = await connection.query(
        'SELECT SUM(amount) as total_fine FROM fines WHERE user_id = ? AND paid = FALSE',
        [userId]
      );

      if (fines[0].total_fine > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'You have fine unpaid,please borrow after paying',
        });
      }

      // calculate due date (default borrow 30 days)
      const borrowDate = new Date();
      const dueDate = new Date(borrowDate);
      dueDate.setDate(dueDate.getDate() + 30);

      // create borrow record
      // borrow_transactions.status can be 'returned' or 'overdue'
      // Initially, status is NULL or will be set to 'overdue' by trigger if past due date
      // We'll let the trigger/event handle the status update
      const [result] = await connection.query(
        `INSERT INTO borrow_transactions (inventory_id, borrower_id, borrow_date, due_date, status)
         VALUES (?, ?, ?, ?, NULL)`,
        [inventoryItem.inventory_id, userId, borrowDate, dueDate]
      );

      // update book_statistics (trigger will handle inventory status update)
      await connection.query(
        `INSERT INTO book_statistics (book_id, times_borrowed)
         VALUES (?, 1)
         ON DUPLICATE KEY UPDATE times_borrowed = times_borrowed + 1`,
        [book_id]
      );

      await connection.commit();
      connection.release();

      res.json({
        status: 'success',
        message: 'Borrow book successfully',
        data: {
          transaction_id: result.insertId,
          borrow_date: borrowDate,
          due_date: dueDate,
        },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Borrow book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to borrow book',
    });
  }
});

// Return book
router.post('/return', async (req, res) => {
  try {
    const validatedData = validateInput(returnBookSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { transaction_id } = validatedData;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // check if the borrow record exists and belongs to the current user
      const [borrows] = await connection.query(
        `SELECT bt.*, i.book_id 
         FROM borrow_transactions bt
         JOIN inventory i ON bt.inventory_id = i.inventory_id
         WHERE bt.transaction_id = ? AND bt.borrower_id = ? FOR UPDATE`,
        [transaction_id, userId]
      );

      if (borrows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          status: 'error',
          message: 'The borrow record is not exist',
        });
      }

      const borrow = borrows[0];

      // Check if already returned (return_date IS NOT NULL or status = 'returned')
      if (borrow.return_date !== null || borrow.status === 'returned') {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'The book is already returned',
        });
      }

      const returnDate = new Date();
      const dueDate = new Date(borrow.due_date);

      // update borrow record
      await connection.query(
        `UPDATE borrow_transactions 
         SET return_date = ?, status = 'returned' 
         WHERE transaction_id = ?`,
        [returnDate, transaction_id]
      );

      // if overdue, create fine record
      if (returnDate > dueDate) {
        const daysOverdue = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
        const fineAmount = daysOverdue * 0.5; // 0.5 yuan per day

        await connection.query(
          `INSERT INTO fines (transaction_id, user_id, amount, paid, issued_at)
           VALUES (?, ?, ?, FALSE, ?)`,
          [transaction_id, userId, fineAmount, returnDate]
        );
      }

      // check if there is a waitlist, if there is, notify the first waitlist
      const [waitlist] = await connection.query(
        'SELECT * FROM waitlist WHERE book_id = ? ORDER BY requested_at LIMIT 1',
        [borrow.book_id]
      );

      if (waitlist.length > 0) {
        // can send notification here
        await connection.query(
          `INSERT INTO notifications (user_id, message)
           VALUES (?, ?)`,
          [
            waitlist[0].user_id,
            `The book《${borrow.book_id}》you are waiting for is now available`,
          ]
        );
      }

      await connection.commit();
      connection.release();

      res.json({
        status: 'success',
        message: 'Return book successfully',
        data: {
          return_date: returnDate,
        },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Return book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to return book',
    });
  }
});

  // Renew book
router.post('/renew', async (req, res) => {
  try {
    const validatedData = validateInput(renewBookSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { transaction_id } = validatedData;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // check if the borrow record exists and belongs to the current user
      const [borrows] = await connection.query(
        `SELECT bt.*, i.book_id 
         FROM borrow_transactions bt
         JOIN inventory i ON bt.inventory_id = i.inventory_id
         WHERE bt.transaction_id = ? AND bt.borrower_id = ? FOR UPDATE`,
        [transaction_id, userId]
      );

      if (borrows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          status: 'error',
          message: 'The borrow record does not exist',
        });
      }

      const borrow = borrows[0];

      // Check if already returned (return_date IS NOT NULL or status = 'returned')
      if (borrow.return_date !== null || borrow.status === 'returned') {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'Only books that are not returned can be renewed',
        });
      }

      // check if there is a waitlist, if there is, notify the first waitlist
      const [waitlist] = await connection.query(
        'SELECT * FROM waitlist WHERE book_id = ? ORDER BY requested_at LIMIT 1',
        [borrow.book_id]
      );

      if (waitlist.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'The book has been reserved, cannot be renewed',
        });
      }

      // update due date (renew for 30 days)
      const newDueDate = new Date(borrow.due_date);
      newDueDate.setDate(newDueDate.getDate() + 30);

      await connection.query(
        `UPDATE borrow_transactions 
         SET due_date = ? 
         WHERE transaction_id = ?`,
        [newDueDate, transaction_id]
      );

      await connection.commit();
      connection.release();

      res.json({
        status: 'success',
        message: 'Renew book successfully',
        data: {
          new_due_date: newDueDate,
        },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Renew book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to renew book',
    });
  }
});

// Get my waitlist
router.get('/waitlist', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [waitlist] = await db.query(
      `SELECT 
        w.waitlist_id,
        w.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        w.requested_at
      FROM waitlist w
      JOIN books b ON w.book_id = b.book_id
      WHERE w.user_id = ?
      ORDER BY w.requested_at DESC`,
      [userId]
    );

    res.json({
      status: 'success',
      data: waitlist,
    });
  } catch (error) {
    console.error('Get waitlist error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get waitlist',
    });
  }
});

// Add to waitlist
router.post('/waitlist', async (req, res) => {
  try {
    const validatedData = validateInput(waitlistBookSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { book_id } = validatedData;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // check if the book exists
      const [books] = await connection.query(
        'SELECT * FROM books WHERE book_id = ?',
        [book_id]
      );

      if (books.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          status: 'error',
          message: 'The book does not exist',
        });
      }

      // check if the book is already in the waitlist
      const [existingWaitlist] = await connection.query(
        'SELECT * FROM waitlist WHERE user_id = ? AND book_id = ?',
        [userId, book_id]
      );

      if (existingWaitlist.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'You are already in the waitlist for this book',
        });
      }

      // check if the user is currently borrowing this book
      // borrow_transactions.status can be 'returned' or 'overdue'
      // If return_date IS NULL, the book is still borrowed
      const [borrows] = await connection.query(
        `SELECT bt.* FROM borrow_transactions bt
         JOIN inventory i ON bt.inventory_id = i.inventory_id
         WHERE bt.borrower_id = ? AND i.book_id = ? AND bt.return_date IS NULL`,
        [userId, book_id]
      );

      if (borrows.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'You are currently borrowing this book, no need to wait',
        });
      }

      // create waitlist record
      const [result] = await connection.query(
        `INSERT INTO waitlist (user_id, book_id, requested_at)
         VALUES (?, ?, ?)`,
        [userId, book_id, new Date()]
      );

      await connection.commit();
      connection.release();

      res.json({
        status: 'success',
        message: 'Added to waitlist successfully',
        data: {
          waitlist_id: result.insertId,
        },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Add to waitlist error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add to waitlist',
    });
  }
});

// Cancel waitlist
router.post('/waitlist/cancel', async (req, res) => {
  try {
    const validatedData = validateInput(cancelWaitlistSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { waitlist_id } = validatedData;

    const [waitlist] = await db.query(
      'SELECT * FROM waitlist WHERE waitlist_id = ? AND user_id = ?',
      [waitlist_id, userId]
    );

    if (waitlist.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The waitlist record does not exist',
      });
    }

    await db.query('DELETE FROM waitlist WHERE waitlist_id = ?', [waitlist_id]);

    res.json({
      status: 'success',
      message: 'Cancel waitlist successfully',
    });
  } catch (error) {
    console.error('Cancel waitlist error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel waitlist',
    });
  }
});

  // Get my fines
router.get('/fines', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [fines] = await db.query(
      `SELECT 
        f.fine_id,
        f.transaction_id,
        f.amount,
        f.paid,
        f.issued_at,
        f.paid_at,
        i.book_id,
        b.title,
        b.author
      FROM fines f
      LEFT JOIN borrow_transactions bt ON f.transaction_id = bt.transaction_id
      LEFT JOIN inventory i ON bt.inventory_id = i.inventory_id
      LEFT JOIN books b ON i.book_id = b.book_id
      WHERE f.user_id = ?
      ORDER BY f.issued_at DESC`,
      [userId]
    );

    const totalUnpaid = fines
      .filter((f) => !f.paid)
      .reduce((sum, f) => sum + parseFloat(f.amount), 0);

    res.json({
      status: 'success',
      data: {
        fines,
        total_unpaid: totalUnpaid,
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

// Pay fines
router.post('/fines/pay', async (req, res) => {
  try {
    const { fine_id, amount } = req.body;

    if (!fine_id || !amount || amount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parameters',
      });
    }

    const userId = req.user.user_id;

    const [fines] = await db.query(
      'SELECT * FROM fines WHERE fine_id = ? AND user_id = ?',
      [fine_id, userId]
    );

    if (fines.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The fine record does not exist',
      });
    }

    const fine = fines[0];

    if (fine.paid) {
      return res.status(400).json({
        status: 'error',
        message: 'The fine has been paid',
      });
    }

    if (parseFloat(amount) < parseFloat(fine.amount)) {
      return res.status(400).json({
        status: 'error',
        message: 'The payment amount is insufficient',
      });
    }

    await db.query(
      'UPDATE fines SET paid = TRUE, paid_at = ? WHERE fine_id = ?',
      [new Date(), fine_id]
    );

    res.json({
      status: 'success',
      message: 'Pay fine successfully',
    });
  } catch (error) {
    console.error('Pay fine error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to pay fine',
    });
  }
});

// Add review
router.post('/reviews', async (req, res) => {
  try {
    const validatedData = validateInput(addReviewSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { book_id, rating, comment } = validatedData;

    // check if the user has borrowed this book
    // borrow_transactions.status can be 'returned' or 'overdue'
    // Check if status is 'returned' or return_date IS NOT NULL
    const [borrows] = await db.query(
      `SELECT bt.* FROM borrow_transactions bt
       JOIN inventory i ON bt.inventory_id = i.inventory_id
       WHERE bt.borrower_id = ? AND i.book_id = ? AND (bt.status = 'returned' OR bt.return_date IS NOT NULL)`,
      [userId, book_id]
    );

    if (borrows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Only users who have borrowed and returned this book can review',
      });
    }

      // check if the user has already reviewed this book
    const [existingReviews] = await db.query(
      'SELECT * FROM reviews WHERE reviewer_id = ? AND book_id = ?',
      [userId, book_id]
    );

    if (existingReviews.length > 0) {
      // update review
      await db.query(
        `UPDATE reviews 
         SET rating = ?, comment = ?, created_at = NOW() 
         WHERE reviewer_id = ? AND book_id = ?`,
        [rating, comment, userId, book_id]
      );
    } else {
      // create review
      await db.query(
        `INSERT INTO reviews (reviewer_id, book_id, rating, comment, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, book_id, rating, comment]
      );
    }

    // update average rating in book_statistics
    const [avgRating] = await db.query(
      'SELECT AVG(rating) as avg_rating FROM reviews WHERE book_id = ?',
      [book_id]
    );

    await db.query(
      `INSERT INTO book_statistics (book_id, average_rating)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE average_rating = ?`,
      [book_id, avgRating[0].avg_rating, avgRating[0].avg_rating]
    );

    res.json({
      status: 'success',
      message: 'Review successfully',
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to review',
    });
  }
});

// Update review
router.put('/reviews', async (req, res) => {
  try {
    const validatedData = validateInput(updateReviewSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { review_id, rating, comment } = validatedData;

    // check if the review exists and belongs to the current user
    const [reviews] = await db.query(
      'SELECT * FROM reviews WHERE review_id = ? AND reviewer_id = ?',
      [review_id, userId]
    );

    if (reviews.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The review does not exist',
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (rating !== undefined) {
      updateFields.push('rating = ?');
      updateValues.push(rating);
    }

    if (comment !== undefined) {
      updateFields.push('comment = ?');
      updateValues.push(comment);
    }

    updateValues.push(review_id);

    await db.query(
      `UPDATE reviews SET ${updateFields.join(', ')} WHERE review_id = ?`,
      updateValues
    );

    // update average rating in book_statistics
    const bookId = reviews[0].book_id;
    const [avgRating] = await db.query(
      'SELECT AVG(rating) as avg_rating FROM reviews WHERE book_id = ?',
      [bookId]
    );

    await db.query(
      `INSERT INTO book_statistics (book_id, average_rating)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE average_rating = ?`,
      [bookId, avgRating[0].avg_rating, avgRating[0].avg_rating]
    );

    res.json({
      status: 'success',
      message: 'Update review successfully',
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update review',
    });
  }
});

  // Delete my review
router.delete('/reviews/:review_id', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const review_id = parseInt(req.params.review_id);

    if (!review_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parameters',
      });
    }

    // check if the review exists and belongs to the current user
    const [reviews] = await db.query(
      'SELECT * FROM reviews WHERE review_id = ? AND reviewer_id = ?',
      [review_id, userId]
    );

    if (reviews.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The review does not exist',
      });
    }

    const bookId = reviews[0].book_id;

    await db.query('DELETE FROM reviews WHERE review_id = ?', [review_id]);

    // update average rating in book_statistics
    const [avgRating] = await db.query(
      'SELECT AVG(rating) as avg_rating FROM reviews WHERE book_id = ?',
      [bookId]
    );

    if (avgRating[0].avg_rating) {
      await db.query(
        `INSERT INTO book_statistics (book_id, average_rating)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE average_rating = ?`,
        [bookId, avgRating[0].avg_rating, avgRating[0].avg_rating]
      );
    } else {
      await db.query(
        'UPDATE book_statistics SET average_rating = NULL WHERE book_id = ?',
        [bookId]
      );
    }

    res.json({
      status: 'success',
      message: 'Delete review successfully',
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete review',
    });
  }
});

// Get my notifications
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [notifications] = await db.query(
      `SELECT 
        notification_id,
        message,
        created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50`,
      [userId]
    );

    res.json({
      status: 'success',
      data: notifications,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get notifications',
    });
  }
});

// Get my favorites
router.get('/favorites', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get favorites with book details
    const [favorites] = await db.query(
      `SELECT 
        f.favorite_id,
        f.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        b.conditions,
        f.created_at
      FROM favorites f
      JOIN books b ON f.book_id = b.book_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), offset]
    );

    // Get total count
    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM favorites WHERE user_id = ?',
      [userId]
    );

    res.json({
      status: 'success',
      data: {
        favorites,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get favorites',
    });
  }
});

// Add favorite
router.post('/favorites', async (req, res) => {
  try {
    const validatedData = validateInput(addFavoriteSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { book_id } = validatedData;

    // Check if the book exists
    const [books] = await db.query('SELECT * FROM books WHERE book_id = ?', [
      book_id,
    ]);

    if (books.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The book does not exist',
      });
    }

    // Check if already favorited
    const [existingFavorites] = await db.query(
      'SELECT * FROM favorites WHERE user_id = ? AND book_id = ?',
      [userId, book_id]
    );

    if (existingFavorites.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'This book is already in your favorites',
      });
    }

    // Add to favorites
    const [result] = await db.query(
      `INSERT INTO favorites (user_id, book_id, created_at)
       VALUES (?, ?, NOW())`,
      [userId, book_id]
    );

    res.json({
      status: 'success',
      message: 'Added to favorites successfully',
      data: {
        favorite_id: result.insertId,
      },
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add favorite',
    });
  }
});

// Remove favorite
router.delete('/favorites', async (req, res) => {
  try {
    const validatedData = validateInput(removeFavoriteSchema, req.body, res);
    if (!validatedData) return;

    const userId = req.user.user_id;
    const { favorite_id, book_id } = validatedData;

    let favorite;

    if (favorite_id) {
      // Delete by favorite_id
      const [favorites] = await db.query(
        'SELECT * FROM favorites WHERE favorite_id = ? AND user_id = ?',
        [favorite_id, userId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'The favorite record does not exist',
        });
      }

      favorite = favorites[0];
      await db.query('DELETE FROM favorites WHERE favorite_id = ?', [
        favorite_id,
      ]);
    } else if (book_id) {
      // Delete by book_id
      const [favorites] = await db.query(
        'SELECT * FROM favorites WHERE book_id = ? AND user_id = ?',
        [book_id, userId]
      );

      if (favorites.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'This book is not in your favorites',
        });
      }

      favorite = favorites[0];
      await db.query(
        'DELETE FROM favorites WHERE book_id = ? AND user_id = ?',
        [book_id, userId]
      );
    }

    res.json({
      status: 'success',
      message: 'Removed from favorites successfully',
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove favorite',
    });
  }
});

// Check if a book is favorited
router.get('/favorites/check/:book_id', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const book_id = parseInt(req.params.book_id);

    if (!book_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid book_id',
      });
    }

    const [favorites] = await db.query(
      'SELECT favorite_id FROM favorites WHERE user_id = ? AND book_id = ?',
      [userId, book_id]
    );

    res.json({
      status: 'success',
      data: {
        is_favorited: favorites.length > 0,
        favorite_id: favorites.length > 0 ? favorites[0].favorite_id : null,
      },
    });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check favorite status',
    });
  }
});

// Get user's own books (books they own in inventory)
router.get('/my-books', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const [books] = await db.query(
      `SELECT DISTINCT
        b.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        b.conditions,
        b.created_at,
        COUNT(DISTINCT i.inventory_id) as total_copies,
        COUNT(DISTINCT CASE WHEN i.status = 'available' THEN i.inventory_id END) as available_copies,
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN i.status = 'available' THEN i.inventory_id END) > 0 
          THEN 'available' 
          ELSE 'borrowed' 
        END AS availability_status
      FROM books b
      INNER JOIN inventory i ON b.book_id = i.book_id
      WHERE i.owner_id = ?
      GROUP BY b.book_id, b.title, b.author, b.isbn, b.category, b.conditions, b.created_at
      ORDER BY b.created_at DESC`,
      [userId]
    );

    res.json({
      status: 'success',
      data: books,
    });
  } catch (error) {
    console.error('Get my books error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get my books',
    });
  }
});

// Add a new book (create book and inventory entry)
router.post('/my-books', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { title, author, isbn, category, conditions } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Title is required',
      });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Check if ISBN already exists
      if (isbn && isbn.trim()) {
        const [existingBooks] = await connection.query(
          'SELECT * FROM books WHERE isbn = ?',
          [isbn.trim()]
        );

        if (existingBooks.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            status: 'error',
            message: 'The ISBN already exists',
          });
        }
      }

      // Insert into books table
      const [bookResult] = await connection.query(
        `INSERT INTO books (title, author, isbn, category, conditions, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          title.trim(),
          author && author.trim() ? author.trim() : null,
          isbn && isbn.trim() ? isbn.trim() : null,
          category && category.trim() ? category.trim() : null,
          conditions && conditions.trim() ? conditions.trim() : null,
        ]
      );

      const book_id = bookResult.insertId;

      // Get the next copy number for this book
      const [copyCount] = await connection.query(
        'SELECT MAX(copy_number) as max_copy FROM inventory WHERE book_id = ?',
        [book_id]
      );
      const nextCopyNumber = (copyCount[0].max_copy || 0) + 1;

      // Insert into inventory table
      await connection.query(
        `INSERT INTO inventory (book_id, copy_number, owner_id, status, location)
         VALUES (?, ?, ?, 'available', NULL)`,
        [book_id, nextCopyNumber, userId]
      );

      // Initialize book_statistics
      await connection.query(
        `INSERT INTO book_statistics (book_id, times_borrowed, average_rating)
         VALUES (?, 0, NULL)`,
        [book_id]
      );

      await connection.commit();
      connection.release();

      res.status(201).json({
        status: 'success',
        message: 'Book added successfully',
        data: {
          book_id: book_id,
        },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Add my book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add book',
    });
  }
});

// Delete a book (delete inventory entry, and book if no more copies)
router.delete('/my-books/:book_id', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const book_id = parseInt(req.params.book_id);

    if (!book_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid book_id',
      });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Check if user owns any copies of this book
      const [inventory] = await connection.query(
        'SELECT * FROM inventory WHERE book_id = ? AND owner_id = ?',
        [book_id, userId]
      );

      if (inventory.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          status: 'error',
          message: 'You do not own any copies of this book',
        });
      }

      // Check if any copies are currently borrowed
      const [activeBorrows] = await connection.query(
        `SELECT COUNT(*) as count 
         FROM borrow_transactions bt
         WHERE bt.inventory_id IN (
           SELECT inventory_id FROM inventory 
           WHERE book_id = ? AND owner_id = ?
         ) AND bt.return_date IS NULL`,
        [book_id, userId]
      );

      if (activeBorrows[0].count > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete book with active borrow records',
        });
      }

      // Delete all inventory copies owned by this user
      await connection.query(
        'DELETE FROM inventory WHERE book_id = ? AND owner_id = ?',
        [book_id, userId]
      );

      // Check if there are any other copies of this book
      const [remainingCopies] = await connection.query(
        'SELECT COUNT(*) as count FROM inventory WHERE book_id = ?',
        [book_id]
      );

      // If no more copies exist, delete the book and statistics
      if (remainingCopies[0].count === 0) {
        await connection.query('DELETE FROM book_statistics WHERE book_id = ?', [book_id]);
        await connection.query('DELETE FROM books WHERE book_id = ?', [book_id]);
      }

      await connection.commit();
      connection.release();

      res.json({
        status: 'success',
        message: 'Book deleted successfully',
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Delete my book error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete book',
    });
  }
});

module.exports = router;
