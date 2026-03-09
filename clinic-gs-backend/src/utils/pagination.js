const { DEFAULT_PAGINATION } = require('../config/constants');

function parsePagination(query = {}) {
  const page = Math.max(Number(query.page) || DEFAULT_PAGINATION.PAGE, 1);
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_PAGINATION.LIMIT, 1),
    DEFAULT_PAGINATION.MAX_LIMIT
  );
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
}

module.exports = {
  parsePagination,
};