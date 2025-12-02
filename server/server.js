require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { auth, requireRole } = require('./authMiddleware');
const app = express();
const port = process.env.PORT || 8090;

app.use(express.json());
app.use(cors());
app.use(express.static('../client'));

// Authentication routes (login, logout)
app.use('/api/auth', require('./routes/auth'));
// Open API (no authentication)
app.use('/api/open', require('./routes/open/index'));
// User API (authentication required, users and admins can access)
app.use('/api/user', auth, requireRole('user', 'admin'), require('./routes/user/index'));
// Admin API (authentication required, only admins can access)
app.use(
  '/api/admin',
  auth,
  requireRole('admin'),
  require('./routes/admin/index'),
);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
  });
});

// Unmatched routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'The requested resource does not exist',
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
