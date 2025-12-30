const express = require('express');
const prisma = require('../db');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');
const { parseEnum } = require('../utils/validation');
const { SubscriptionType, SubscriptionStatus, NotificationType } = require('@prisma/client');

const router = express.Router();

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

router.get('/me', auth, async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
  });

  if (!subscription) {
    return res.status(404).json({ error: 'No subscription' });
  }

  return res.json(subscription);
});

router.post('/request', auth, async (req, res) => {
  const errors = [];
  const type = parseEnum(req.body.type, SubscriptionType, 'type', errors);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const subscription = await prisma.subscription.upsert({
    where: { userId: req.user.id },
    update: {
      type,
      status: SubscriptionStatus.PENDING,
      startDate: null,
      endDate: null,
    },
    create: {
      userId: req.user.id,
      type,
      status: SubscriptionStatus.PENDING,
    },
  });

  return res.status(201).json(subscription);
});

router.get('/', auth, requireRole('ADMIN'), async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(subscriptions);
});

router.patch('/:id/approve', auth, requireRole('ADMIN'), async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: req.params.id },
  });

  if (!subscription) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  const startDate = new Date();
  let endDate = null;

  switch (subscription.type) {
    case SubscriptionType.MONTHLY:
      endDate = addMonths(startDate, 1);
      break;
    case SubscriptionType.QUARTERLY:
      endDate = addMonths(startDate, 3);
      break;
    case SubscriptionType.SEMESTER:
      endDate = addMonths(startDate, 6);
      break;
    default:
      endDate = addMonths(startDate, 1);
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
    },
  });

  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      type: NotificationType.SUBSCRIPTION_APPROVED,
      content: 'Votre abonnement est actif.',
    },
  });

  return res.json(updated);
});

router.patch('/:id/suspend', auth, requireRole('ADMIN'), async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: req.params.id },
  });

  if (!subscription) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.SUSPENDED,
    },
  });

  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      type: NotificationType.SUBSCRIPTION_SUSPENDED,
      content: 'Votre abonnement est suspendu.',
    },
  });

  return res.json(updated);
});

module.exports = router;
