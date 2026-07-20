function success(res, { data, meta = undefined, status = 200 }) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function failure(res, { code, message, details = [], status = 400 }) {
  return res.status(status).json({
    success: false,
    error: { code, message, details },
  });
}

module.exports = { success, failure };
