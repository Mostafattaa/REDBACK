const successResponse = (res, data, statusCode = 200, meta = null) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

const errorResponse = (res, message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) => {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
};

module.exports = { successResponse, errorResponse };
