
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

router.post('/reset', async (req, res) => {
  const { slots } = req.body;

  if (!Array.isArray(slots)) {
    res.status(400).json({ error: 'slots must be an array' });
    return;
  }

  for (const slot of slots) {
    if (
      !slot.id ||
      !slot.provider ||
      !slot.start ||
      !slot.end ||
      !Number.isFinite(Date.parse(slot.start)) ||
      !Number.isFinite(Date.parse(slot.end)) ||
      Date.parse(slot.end) <= Date.parse(slot.start)
    ) {
      res.status(400).json({ error: 'invalid slot' });
      return;
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM bookings');
    await client.query('DELETE FROM slots');
    await client.query('DELETE FROM idempotency_keys');
    await client.query('DELETE FROM booking_attempts');

    for (const slot of slots) {
      await client.query(
        `INSERT INTO slots (id, provider, start, "end")
         VALUES ($1, $2, $3, $4)`,
        [slot.id, slot.provider, slot.start, slot.end]
      );
    }

    await client.query('COMMIT');

    res.status(200).json({ message: 'Done' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reset failed:', error);
    res.status(500).json({ error: 'internal server error' });
  } finally {
    client.release();
  }
});

router.get('/slots', async (req, res) => {
  try {
    const provider = req.query.provider;

    const result = await pool.query(
      `SELECT
         s.id,
         s.provider,
         s.start,
         s."end",
         NOT EXISTS (
           SELECT 1
           FROM bookings b
           WHERE b.slot_id = s.id
           AND b.status = 'confirmed'
         ) AS available
       FROM slots s
       WHERE ($1::text IS NULL OR s.provider = $1)
       ORDER BY s.start ASC`,
      [typeof provider === 'string' ? provider : null]
    );

    res.json({ slots: result.rows });
  } catch (error) {
    console.error('Fetching slots failed:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
