const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'localhost',
  user: 'library_manage',
  password: '123456',
  database: 'library_sharing_system',
  timezone: '-04:00',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = db;
