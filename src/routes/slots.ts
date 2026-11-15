
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

interface SlotInput {
  id: string;
  provider: string;
  start: string;
  end: string;
}

function isValidSlot(slot: unknown): slot is SlotInput {
  if (!slot || typeof slot !== 'object') return false;

  const { id, provider, start, end } = slot as Record<string, unknown>;

  return (
    typeof id === 'string' &&
    id.trim() !== '' &&
    typeof provider === 'string' &&
    provider.trim() !== '' &&
    typeof start === 'string' &&
    Number.isFinite(Date.parse(start)) &&
    typeof end === 'string' &&
    Number.isFinite(Date.parse(end))
  );
}

router.post('/reset', async (req, res) => {
  const slots = req.body?.slots;

  if (!Array.isArray(slots)) {
    res.status(400).json({ error: 'slots must be an array' });
    return;
  }

  if (!slots.every(isValidSlot)) {
    res.status(400).json({ error: 'invalid slot' });
    return;
  }

  if (new Set(slots.map((slot) => slot.id)).size !== slots.length) {
    res.status(400).json({ error: 'duplicate slot id' });
    return;
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
        `INSERT INTO slots (id, provider, start, "end", start_text, end_text)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [slot.id, slot.provider, slot.start, slot.end, slot.start, slot.end]
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
         COALESCE(s.start_text, to_char(s.start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS start,
         COALESCE(s.end_text, to_char(s."end" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS "end",
         NOT EXISTS (
           SELECT 1
           FROM bookings b
           WHERE b.slot_id = s.id
           AND b.status = 'confirmed'
         ) AS available
       FROM slots s
       WHERE ($1::text IS NULL OR s.provider = $1)
       ORDER BY s.start ASC, s.id ASC`,
      [typeof provider === 'string' ? provider : null]
    );

    res.json({ slots: result.rows });
  } catch (error) {
    console.error('Fetching slots failed:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
