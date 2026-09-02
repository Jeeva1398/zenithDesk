const express = require('express');
const authRoutes = require('./auth.routes');
const organizationRoutes = require('./organization.routes');
const agentRoutes = require('./agent.routes');
const ticketRoutes = require('./ticket.routes');
const tagRoutes = require('./tag.routes');
const viewRoutes = require('./view.routes');
const superAdminRoutes = require('./superAdmin.routes');
const adminRoutes = require('./admin.routes');
const customerAuthRoutes = require('./customerAuth.routes');
const customerTicketRoutes = require('./customerTicket.routes');
const analyticsRoutes = require('./analytics.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/agents', agentRoutes);
router.use('/tickets', ticketRoutes);
router.use('/tags', tagRoutes);
router.use('/views', viewRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/admin', adminRoutes);
router.use('/customer-auth', customerAuthRoutes);
router.use('/customer', customerTicketRoutes);

module.exports = router;
