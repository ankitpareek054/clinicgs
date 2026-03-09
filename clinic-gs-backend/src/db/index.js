const pool = require('./pool');

async function query(text, params = [], client = null) {
  const executor = client || pool;
  return executor.query(text, params);
}

module.exports = {
  pool,
  query,
};