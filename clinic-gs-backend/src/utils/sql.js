function buildLimitOffset(limit, offset) {
  return {
    clause: ' LIMIT $1 OFFSET $2 ',
    values: [limit, offset],
  };
}

function safeSortDirection(direction, fallback = 'DESC') {
  if (!direction) return fallback;
  const normalized = String(direction).toUpperCase();
  return normalized === 'ASC' ? 'ASC' : 'DESC';
}

module.exports = {
  buildLimitOffset,
  safeSortDirection,
};