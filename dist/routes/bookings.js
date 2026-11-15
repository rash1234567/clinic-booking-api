"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const node_crypto_1 = require("node:crypto");
const router = (0, express_1.Router)();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKING_COLUMNS = "id, slot_id, name, email, status, created_at";
function trimmed(value) {
    return typeof value === "string" ? value.trim() : value ?? null;
}
// POST /bookings
router.post("/bookings", async (req, res) => {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const { slot_id, name, email } = body;
    const normalizedSlotId = typeof slot_id === "string" ? slot_id.trim() : "";
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    let validationError = null;
    if (!normalizedSlotId || !normalizedName || !normalizedEmail) {
        validationError = "slot_id, name and email are required";
    }
    else if (!EMAIL_REGEX.test(normalizedEmail)) {
        validationError = "invalid email address";
    }
    const idempotencyKey = req.header("Idempotency-Key")?.trim();
    const requestHash = (0, node_crypto_1.createHash)("sha256")
        .update(JSON.stringify({
        slot_id: trimmed(slot_id),
        name: trimmed(name),
        email: typeof email === "string" ? email.trim().toLowerCase() : email ?? null,
    }))
        .digest("hex");
    let client;
    try {
        client = await database_1.pool.connect();
        await client.query("BEGIN");
        // Check whether this request has been processed before.
        if (idempotencyKey) {
            const inserted = await client.query(`INSERT INTO idempotency_keys (key, request_hash)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING
         RETURNING key`, [idempotencyKey, requestHash]);
            if (inserted.rowCount === 0) {
                const existing = await client.query(`SELECT request_hash, response_status, response_body
           FROM idempotency_keys
           WHERE key = $1
           FOR UPDATE`, [idempotencyKey]);
                const previous = existing.rows[0];
                if (!previous) {
                    await client.query("ROLLBACK");
                    res.status(409).json({
                        error: "a request with this idempotency key is in progress",
                    });
                    return;
                }
                if (previous.request_hash !== requestHash) {
                    await client.query("ROLLBACK");
                    res.status(422).json({
                        error: "idempotency key reused with different request body",
                    });
                    return;
                }
                if (previous.response_status !== null) {
                    await client.query("COMMIT");
                    res.status(previous.response_status).json(previous.response_body);
                    return;
                }
            }
        }
        // Rate limit: maximum 5 attempts per email per minute, failed ones included.
        if (normalizedEmail) {
            await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
                normalizedEmail,
            ]);
            const attemptsResult = await client.query(`SELECT
           COUNT(*)::int AS count,
           MIN(attempted_at) AS oldest
         FROM booking_attempts
         WHERE email = $1
           AND attempted_at > clock_timestamp() - INTERVAL '1 minute'`, [normalizedEmail]);
            const attempts = attemptsResult.rows[0];
            if (attempts.count >= 5) {
                const retryResult = await client.query(`SELECT GREATEST(
             1,
             CEIL(EXTRACT(EPOCH FROM (
               $1::timestamptz + INTERVAL '1 minute' - clock_timestamp()
             )))::int
           ) AS retry_after`, [attempts.oldest]);
                const retryAfter = retryResult.rows[0].retry_after;
                await client.query("ROLLBACK");
                res.setHeader("Retry-After", String(retryAfter));
                res.status(429).json({
                    error: "too many booking attempts. Try again later.",
                });
                return;
            }
            await client.query("INSERT INTO booking_attempts (email, attempted_at) VALUES ($1, clock_timestamp())", [normalizedEmail]);
        }
        let status;
        let responseBody;
        if (validationError) {
            status = 400;
            responseBody = { error: validationError };
        }
        else {
            const slotResult = await client.query("SELECT id, start FROM slots WHERE id = $1", [normalizedSlotId]);
            if (slotResult.rowCount === 0) {
                status = 404;
                responseBody = { error: "slot not found" };
            }
            else if (new Date(slotResult.rows[0].start).getTime() <= Date.now()) {
                status = 400;
                responseBody = { error: "slot has already started" };
            }
            else {
                const bookingResult = await client.query(`INSERT INTO bookings (slot_id, name, email)
           VALUES ($1, $2, $3)
           ON CONFLICT (slot_id) WHERE status = 'confirmed'
           DO NOTHING
           RETURNING ${BOOKING_COLUMNS}`, [normalizedSlotId, normalizedName, normalizedEmail]);
                if (bookingResult.rowCount === 0) {
                    status = 409;
                    responseBody = { error: "slot already booked" };
                }
                else {
                    status = 201;
                    responseBody = bookingResult.rows[0];
                }
            }
        }
        // Save the original response so retries receive the same result.
        if (idempotencyKey) {
            await client.query(`UPDATE idempotency_keys
         SET response_status = $1,
             response_body = $2::jsonb
         WHERE key = $3`, [status, JSON.stringify(responseBody), idempotencyKey]);
        }
        await client.query("COMMIT");
        res.status(status).json(responseBody);
    }
    catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => { });
        }
        console.error("Booking error:", error);
        res.status(500).json({ error: "internal server error" });
    }
    finally {
        client?.release();
    }
});
// GET /bookings/:id
router.get("/bookings/:id", async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
        res.status(404).json({ error: "booking not found" });
        return;
    }
    try {
        const result = await database_1.pool.query(`SELECT ${BOOKING_COLUMNS}
       FROM bookings
       WHERE id = $1`, [req.params.id]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: "booking not found" });
            return;
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        console.error("Booking retrieval failed:", error);
        res.status(500).json({ error: "internal server error" });
    }
});
router.delete("/bookings/:id", async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
        res.status(404).json({ error: "booking not found" });
        return;
    }
    const client = await database_1.pool.connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(`SELECT ${BOOKING_COLUMNS}
       FROM bookings
       WHERE id = $1
       FOR UPDATE`, [req.params.id]);
        if (result.rowCount === 0) {
            await client.query("ROLLBACK");
            res.status(404).json({ error: "booking not found" });
            return;
        }
        const booking = result.rows[0];
        if (booking.status === "cancelled") {
            await client.query("ROLLBACK");
            res.status(409).json({ error: "booking already cancelled" });
            return;
        }
        const updated = await client.query(`UPDATE bookings
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING ${BOOKING_COLUMNS}`, [booking.id]);
        await client.query("COMMIT");
        res.status(200).json(updated.rows[0]);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Cancellation error:", error);
        res.status(500).json({ error: "internal server error" });
    }
    finally {
        client.release();
    }
});
router.get("/bookings", async (req, res) => {
    const email = req.query.email;
    if (typeof email !== "string" || !email.trim()) {
        res.status(400).json({ error: "email is required" });
        return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
        res.status(400).json({ error: "invalid email address" });
        return;
    }
    const rawLimit = req.query.limit;
    const limit = rawLimit === undefined ? 10 : Number(rawLimit);
    if ((typeof rawLimit === "string" && rawLimit.trim() === "") ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50) {
        res.status(400).json({ error: "limit must be between 1 and 50" });
        return;
    }
    let cursor = null;
    if (req.query.cursor !== undefined) {
        if (typeof req.query.cursor !== "string") {
            res.status(400).json({ error: "invalid cursor" });
            return;
        }
        try {
            const decoded = JSON.parse(Buffer.from(req.query.cursor, "base64url").toString("utf8"));
            if (typeof decoded.created_at !== "string" ||
                !Number.isFinite(Date.parse(decoded.created_at)) ||
                typeof decoded.id !== "string" ||
                !UUID_REGEX.test(decoded.id)) {
                throw new Error("Invalid cursor");
            }
            cursor = decoded;
        }
        catch {
            res.status(400).json({ error: "invalid cursor" });
            return;
        }
    }
    try {
        const result = await database_1.pool.query(`SELECT ${BOOKING_COLUMNS},
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
       FROM bookings
       WHERE email = $1
         AND (
           $2::timestamptz IS NULL
           OR (created_at, id) > ($2::timestamptz, $3::uuid)
         )
       ORDER BY created_at ASC, id ASC
       LIMIT $4`, [
            normalizedEmail,
            cursor?.created_at ?? null,
            cursor?.id ?? null,
            limit + 1,
        ]);
        const hasMore = result.rows.length > limit;
        const page = result.rows.slice(0, limit);
        const lastBooking = page[page.length - 1];
        const nextCursor = hasMore && lastBooking
            ? Buffer.from(JSON.stringify({
                created_at: lastBooking.cursor_ts,
                id: lastBooking.id,
            })).toString("base64url")
            : null;
        const bookings = page.map(({ cursor_ts, ...booking }) => booking);
        res.status(200).json({
            bookings,
            next_cursor: nextCursor,
        });
    }
    catch (error) {
        console.error("List bookings error:", error);
        res.status(500).json({ error: "internal server error" });
    }
});
exports.default = router;
