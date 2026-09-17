export function errorHandler(err, req, res, next) {
  if ((err.status || 500) >= 500) {
    console.error('[RefatOS API Error]', err);
  }
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    path: req.path
  });
}
