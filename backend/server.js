const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const foodRoutes = require('./routes/foodRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { checkDatabaseConnection } = require('./config/db');
const { startExpirationJob } = require('./services/expirationService');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
app.disable("etag");
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  })
);
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

app.get('/', (req, res) => {
  res.send('MealShare Backend is running!');
});

app.get('/api/health', async (req, res) => {
  const databaseConnected = await checkDatabaseConnection();
  return res.json({ status: 'ok', database: databaseConnected ? 'connected' : 'unavailable' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use(notFound);
app.use(errorHandler);

startExpirationJob();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
