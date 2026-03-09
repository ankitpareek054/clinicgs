function normalizePhone(phone) {
  const normalized = String(phone || '').replace(/\D/g, '');
  return normalized || null;
}

module.exports = {
  normalizePhone,
};