require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db/connection');
const logger = require('./config/logger');
const morgan = require('./middlewares/morgan');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan.successHandler);
app.use(morgan.errorHandler);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(routes);

app.use(notFound);
app.use(errorHandler);

app.listen(port, async () => {
  logger.info(`Server listening on port ${port}`);

  try {
    await pool.query('SELECT 1');
    logger.info('Database connection OK');
  } catch (err) {
    logger.warn(`Database connection failed (continuing without it): ${err.message}`);
  }
});
