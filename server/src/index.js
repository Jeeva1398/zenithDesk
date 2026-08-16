require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db/connection');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);

  try {
    await pool.query('SELECT 1');
    console.log('Database connection OK');
  } catch (err) {
    console.warn('Database connection failed (continuing without it):', err.message);
  }
});
