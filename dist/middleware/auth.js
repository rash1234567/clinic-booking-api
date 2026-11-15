"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const node_crypto_1 = require("node:crypto");
function authenticate(req, res, next) {
    const providedKey = req.header('X-API-Key');
    const expectedKey = process.env.API_KEY;
    if (!providedKey || !expectedKey) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    const provided = Buffer.from(providedKey);
    const expected = Buffer.from(expectedKey);
    if (provided.length !== expected.length ||
        !(0, node_crypto_1.timingSafeEqual)(provided, expected)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    next();
}
