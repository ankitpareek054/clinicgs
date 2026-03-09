const app = require('./app');
const env = require('./config/env');
const pool = require('./db/pool');

async function startServer() {
  try {
    await pool.query('SELECT 1');

    app.listen(env.PORT, () => {
      console.log(`ClinicGS backend running on port ${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
      console.log(`API URL: ${env.API_BASE_URL}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();