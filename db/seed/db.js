const mysql = require('mysql2/promise');

function getConnectionConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'smart_medicament',
    multipleStatements: true,
  };
}

async function getConnection() {
  return mysql.createConnection(getConnectionConfig());
}

module.exports = { getConnection };
