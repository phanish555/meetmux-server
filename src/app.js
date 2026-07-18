const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');
const userRoutes = require('./routes/user.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/api/v1', healthRoutes);
app.use('/api/v1', userRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
