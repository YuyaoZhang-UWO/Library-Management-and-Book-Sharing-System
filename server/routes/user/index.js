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
} = require('../../validationSchemas');

// Get current user's borrow records
router.get('/borrows', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [borrows] = await db.query(
      `SELECT 
        bt.transaction_id,
        bt.book_id,
        b.title,
        b.author,
        b.isbn,
        b.category,
        bt.borrow_date,
        bt.due_date,
        bt.return_date,
        bt.status
      FROM borrow_transactions bt
      JOIN books b ON bt.book_id = b.book_id
      WHERE bt.borrower_id = ?
      ORDER BY bt.borrow_date DESC`,
      [userId]
    );

    res.json({
      status: 'success',
      data: borrows,
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
      // check if the book exists and is available
      const [books] = await connection.query(
        'SELECT * FROM books WHERE book_id = ? FOR UPDATE',
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

      const book = books[0];

      // check if the book is available
      if (book.availability_status !== 'available') {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          status: 'error',
          message: 'The book is not avalible to borrow',
        });
      }

      // check if the user has any unreturned books
      const [existingBorrows] = await connection.query(
        'SELECT * FROM borrow_transactions WHERE borrower_id = ? AND book_id = ? AND status = "borrowed"',
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
      const [result] = await connection.query(
        `INSERT INTO borrow_transactions (borrower_id, book_id, borrow_date, due_date, status)
         VALUES (?, ?, ?, ?, 'borrowed')`,
        [userId, book_id, borrowDate, dueDate]
      );

      // update book status
      await connection.query(
        "UPDATE books SET availability_status = 'lent_out' WHERE book_id = ?",
        [book_id]
      );

      // update book_statistics
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
        'SELECT * FROM borrow_transactions WHERE transaction_id = ? AND borrower_id = ? FOR UPDATE',
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

      if (borrow.status === 'returned') {
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

      // update book status
      await connection.query(
        "UPDATE books SET availability_status = 'available' WHERE book_id = ?",
        [borrow.book_id]
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
        'SELECT * FROM borrow_transactions WHERE transaction_id = ? AND borrower_id = ? FOR UPDATE',
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

      if (borrow.status !== 'borrowed') {
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
      const [borrows] = await connection.query(
        'SELECT * FROM borrow_transactions WHERE borrower_id = ? AND book_id = ? AND status = "borrowed"',
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
        bt.book_id,
        b.title,
        b.author
      FROM fines f
      LEFT JOIN borrow_transactions bt ON f.transaction_id = bt.transaction_id
      LEFT JOIN books b ON bt.book_id = b.book_id
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
    const [borrows] = await db.query(
      'SELECT * FROM borrow_transactions WHERE borrower_id = ? AND book_id = ? AND status = "returned"',
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

module.exports = router;
