
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const providedKey = req.header('X-API-Key');
  const expectedKey = process.env.API_KEY;

  if (!providedKey || !expectedKey) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const provided = Buffer.from(providedKey);
  const expected = Buffer.from(expectedKey);

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  next();
}
