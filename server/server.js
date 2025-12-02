require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { auth, requireRole } = require('./authMiddleware');
const app = express();
const port = process.env.PORT || 8090;

app.use(express.json());
app.use(cors());
app.use(express.static('../client'));

// login, change-password
app.use('/api/auth', require('./routes/auth'));
// open api
app.use('/api/open', require('./routes/open/index'));
// api for user
app.use('/api/user', auth, requireRole('user'), require('./routes/user/index'));
// api for admin
app.use(
  '/api/admin',
  auth,
  requireRole('admin'),
  require('./routes/admin/index'),
);

//unmatched route
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist.',
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
