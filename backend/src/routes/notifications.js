const express = require('express');
const prisma = require('../db');
const auth = require('../middlewares/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const where = {
    userId: req.user.id,
  };

  if (req.query.unreadOnly === 'true') {
    where.readAt = null;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { sentAt: 'desc' },
  });

  return res.json(notifications);
});

router.patch('/:id/read', auth, async (req, res) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id },
  });

  if (!notification || notification.userId !== req.user.id) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { readAt: new Date() },
  });

  return res.json(updated);
});

router.patch('/read-all', auth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return res.status(204).send();
});

router.delete('/:id', auth, async (req, res) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id },
  });

  if (!notification || notification.userId !== req.user.id) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  await prisma.notification.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

router.delete('/', auth, async (req, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.user.id } });
  return res.status(204).send();
});

module.exports = router;
