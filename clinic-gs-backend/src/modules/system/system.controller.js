const db = require('../../db');
const { sendSuccess } = require('../../utils/api-response');

async function health(req, res) {
  return sendSuccess(res, {
    message: 'ClinicGS backend is running.',
    data: {
      service: 'clinicgs-backend',
      status: 'ok',
      time: new Date().toISOString(),
    },
  });
}

async function dbHealth(req, res) {
  const result = await db.query('SELECT NOW() AS db_time, current_database() AS db_name');

  return sendSuccess(res, {
    message: 'Database connection is healthy.',
    data: result.rows[0],
  });
}

module.exports = {
  health,
  dbHealth,
};