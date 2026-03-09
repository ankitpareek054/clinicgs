function sendSuccess(res, options = {}) {
  const {
    statusCode = 200,
    message = 'Success',
    data = null,
    meta = null,
  } = options;

  const payload = {
    success: true,
    message,
    data,
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

function sendError(res, options = {}) {
  const {
    statusCode = 500,
    message = 'Something went wrong',
    code = 'ERROR',
    details = null,
  } = options;

  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      details,
    },
  });
}

module.exports = {
  sendSuccess,
  sendError,
};