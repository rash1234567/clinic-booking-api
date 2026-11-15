
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from './config/database';

async function setupDatabase() {
  try {
    const schema = await readFile(
      resolve(process.cwd(), 'database/schema.sql'),
      'utf8'
    );

    await pool.query(schema);

    console.log('Database schema created successfully!');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupDatabase();
