require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
global.db = pool;

app.use('/api/search', require('./routes/search'));
app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/pdf', require('./routes/pdf'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', version: '1.0.0', timestamp: new Date().toISOString() });
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        riad_name VARCHAR(255) NOT NULL,
        riad_data JSONB,
        analysis_data JSONB,
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_id VARCHAR(255),
        report_type VARCHAR(50) DEFAULT 'basic',
        created_at TIMESTAMP DEFAULT NOW(),
        pdf_generated BOOLEAN DEFAULT FALSE
      );
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id UUID REFERENCES analyses(id),
        amount INTEGER NOT NULL,
        currency VARCHAR(10) DEFAULT 'MAD',
        status VARCHAR(50) DEFAULT 'pending',
        payzone_ref VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database initialized');
  } catch (err) {
    console.log('DB init skipped:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log('RiadPricer API running on port ' + PORT);
  await initDB();
});
