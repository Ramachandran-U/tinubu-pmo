/**
 * Global Express error handler.
 * Catches errors thrown by route handlers and returns a consistent JSON response.
 */
function errorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
