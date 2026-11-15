
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import app from './app';
import { pool } from './config/database';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await pool.query('SELECT 1');

    app.listen(PORT, () => {
      console.log(`Clinic Booking API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
