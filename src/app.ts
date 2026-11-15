
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { authenticate } from './middleware/auth';
import slotsRouter from './routes/slots';
import bookingsRouter from './routes/bookings';

const app = express();

app.use(cors());
app.use(authenticate);
app.use(express.json());

app.use(slotsRouter);
app.use(bookingsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'request body must be valid JSON' });
    return;
  }

  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'request body is too large' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
};

app.use(errorHandler);

export default app;
