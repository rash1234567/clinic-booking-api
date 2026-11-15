
import express from 'express';
import cors from 'cors';
import { authenticate } from './middleware/auth';
import slotsRouter from './routes/slots';
import bookingsRouter from './routes/bookings';

const app = express();

app.use(cors());
app.use(express.json());

app.use(authenticate);

app.use(slotsRouter);
app.use(bookingsRouter);


app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

export default app;
