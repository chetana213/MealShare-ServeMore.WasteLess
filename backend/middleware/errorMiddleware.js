function notFound(req, res) {
  return res.status(404).json({ message: 'Route not found.' });
}

function errorHandler(error, req, res, next) {
  console.error(error);

  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? 'Internal server error.' : error.message;

  return res.status(statusCode).json({ message });
}

module.exports = { notFound, errorHandler };
