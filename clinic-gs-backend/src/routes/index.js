const express = require('express');

const systemRoutesImport = require('../modules/system/system.routes');
const authRoutesImport = require('../modules/auth/auth.routes');
const clinicsRoutesImport = require('../modules/clinics/clinics.routes');
//const clinicSettingsRoutesImport = require('../modules/clinic-settings/clinic-settings.routes');
const clinicIntegrationsRoutesImport = require('../modules/clinic-integrations/clinic-integrations.routes');
const clinicServicesRoutesImport = require('../modules/clinic-services/clinic-services.routes');
const usersRoutesImport = require('../modules/users/users.routes');
const staffRequestsRoutesImport = require('../modules/staff-requests/staff-requests.routes');
const leadsRoutesImport = require('../modules/leads/leads.routes');
const followupsRoutesImport = require('../modules/followups/followups.routes');
const appointmentsRoutesImport = require('../modules/appointments/appointments.routes');
const publicFormsRoutesImport = require('../modules/public-forms/public-forms.routes');
const reviewsRoutesImport = require('../modules/reviews/reviews.routes');
const messagesRoutesImport = require('../modules/messages/messages.routes');
const supportTicketsRoutesImport = require('../modules/support-tickets/support-tickets.routes');
const notificationsRoutesImport = require('../modules/notifications/notifications.routes');
const dashboardsRoutesImport = require('../modules/dashboards/dashboards.routes');

const router = express.Router();

function resolveRouter(label, routeModule) {
  const resolved =
    routeModule?.default ||
    routeModule?.router ||
    routeModule;

  const isRouterLike =
    typeof resolved === 'function' &&
    typeof resolved.use === 'function' &&
    typeof resolved.handle === 'function';

  if (!isRouterLike) {
    console.error(`\n[routes] Invalid route module: ${label}`);
    console.error('[routes] typeof import =', typeof routeModule);

    if (routeModule && typeof routeModule === 'object') {
      console.error('[routes] import keys =', Object.keys(routeModule));
    }

    console.error('[routes] resolved typeof =', typeof resolved);
    throw new TypeError(`Route module "${label}" is not exporting an Express router`);
  }

  return resolved;
}

const systemRoutes = resolveRouter('system', systemRoutesImport);
const authRoutes = resolveRouter('auth', authRoutesImport);
const clinicsRoutes = resolveRouter('clinics', clinicsRoutesImport);
//const clinicSettingsRoutes = resolveRouter('clinic-settings', clinicSettingsRoutesImport);
const clinicIntegrationsRoutes = resolveRouter('clinic-integrations', clinicIntegrationsRoutesImport);
const clinicServicesRoutes = resolveRouter('clinic-services', clinicServicesRoutesImport);
const usersRoutes = resolveRouter('users', usersRoutesImport);
const staffRequestsRoutes = resolveRouter('staff-requests', staffRequestsRoutesImport);
const leadsRoutes = resolveRouter('leads', leadsRoutesImport);
const followupsRoutes = resolveRouter('followups', followupsRoutesImport);
const appointmentsRoutes = resolveRouter('appointments', appointmentsRoutesImport);
const publicFormsRoutes = resolveRouter('public-forms', publicFormsRoutesImport);
const reviewsRoutes = resolveRouter('reviews', reviewsRoutesImport);
const messagesRoutes = resolveRouter('messages', messagesRoutesImport);
const supportTicketsRoutes = resolveRouter('support-tickets', supportTicketsRoutesImport);
const notificationsRoutes = resolveRouter('notifications', notificationsRoutesImport);
const dashboardsRoutes = resolveRouter('dashboards', dashboardsRoutesImport);

router.use('/system', systemRoutes);
router.use('/auth', authRoutes);
router.use('/clinics', clinicsRoutes);
//router.use('/clinic-settings', clinicSettingsRoutes);
router.use('/clinic-integrations', clinicIntegrationsRoutes);
router.use('/clinic-services', clinicServicesRoutes);
router.use('/users', usersRoutes);
router.use('/staff-requests', staffRequestsRoutes);
router.use('/leads', leadsRoutes);
router.use('/followups', followupsRoutes);
router.use('/appointments', appointmentsRoutes);
router.use('/public-forms', publicFormsRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/messages', messagesRoutes);
router.use('/support-tickets', supportTicketsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/dashboards', dashboardsRoutes);

module.exports = router;