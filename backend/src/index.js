require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const roomsRouter = require('./routes/rooms');
const seatsRouter = require('./routes/seats');
const reservationsRouter = require('./routes/reservations');
const subscriptionsRouter = require('./routes/subscriptions');
const notificationsRouter = require('./routes/notifications');
const adminRouter = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/rooms', roomsRouter);
app.use('/seats', seatsRouter);
app.use('/reservations', reservationsRouter);
app.use('/subscriptions', subscriptionsRouter);
app.use('/notifications', notificationsRouter);
app.use('/admin', adminRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
