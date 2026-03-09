const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const dashboardsRepository = require('./dashboards.repository');

async function getSuperAdminDashboard(currentUser) {
  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Only super admin can access this dashboard.', {
      code: 'FORBIDDEN',
    });
  }

  const [
    summary,
    clinicsByStatus,
    overdueFollowupsByClinic,
    averageResponseTimeByClinic,
    duplicateWarningsByClinic,
    topGrowthClinics,
    clinicsNeedingAttention,
    pendingStaffRequests,
    supportTicketsByClinic,
  ] = await Promise.all([
    dashboardsRepository.getAdminSummary(),
    dashboardsRepository.getClinicsByStatus(),
    dashboardsRepository.getOverdueFollowupsByClinic(),
    dashboardsRepository.getAverageResponseTimeByClinic(),
    dashboardsRepository.getDuplicateWarningsByClinic(),
    dashboardsRepository.getTopGrowthClinics(),
    dashboardsRepository.getClinicsNeedingAttention(),
    dashboardsRepository.getPendingStaffRequests(),
    dashboardsRepository.getSupportTicketsByClinic(),
  ]);

  return {
    summary: {
      totalClinics: summary.total_clinics,
      totalLeads: summary.total_leads,
      leadsLast7Days: summary.leads_last_7_days,
      leadsLast30Days: summary.leads_last_30_days,
      bookingsLast7Days: summary.bookings_last_7_days,
      bookingsLast30Days: summary.bookings_last_30_days,
      completedAppointments: summary.completed_appointments,
      noShowRatePct: summary.no_show_rate_pct,
      pendingStaffRequests: summary.pending_staff_requests,
      failedMessageLogs: summary.failed_message_logs,
      failedCalendarSyncs: summary.failed_calendar_syncs,
    },
    clinicsByStatus: clinicsByStatus.map((row) => ({
      status: row.status,
      count: row.count,
    })),
    overdueFollowupsByClinic: overdueFollowupsByClinic.map((row) => ({
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      overdueFollowups: row.overdue_followups,
    })),
    averageResponseTimeByClinic: averageResponseTimeByClinic.map((row) => ({
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      avgResponseMinutes: row.avg_response_minutes,
    })),
    duplicateWarningsByClinic: duplicateWarningsByClinic.map((row) => ({
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      duplicateGroups: row.duplicate_groups,
    })),
    topGrowthClinics: topGrowthClinics.map((row) => ({
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      clinicStatus: row.clinic_status,
      totalLeads30d: row.total_leads_30d,
      bookedAppointments30d: row.booked_appointments_30d,
      conversionRatePct: row.conversion_rate_pct,
      growthScore100: row.growth_score_100,
    })),
    clinicsNeedingAttention: clinicsNeedingAttention.map((row) => ({
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      clinicStatus: row.clinic_status,
      duplicatePhoneGroups: row.duplicate_phone_groups,
      unassignedActiveLeads: row.unassigned_active_leads,
      openSupportTickets: row.open_support_tickets,
      failedCalendarSyncs: row.failed_calendar_syncs,
      inactiveReceptionists: row.inactive_receptionists,
      activeReceptionists: row.active_receptionists,
      hasNoActiveReceptionist: row.has_no_active_receptionist,
    })),
    pendingStaffRequests: pendingStaffRequests.map((row) => ({
      id: row.id,
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      requestType: row.request_type,
      targetName: row.target_name,
      targetEmail: row.target_email,
      targetRole: row.target_role,
      createdAt: row.created_at,
    })),
    supportTicketsByClinic: supportTicketsByClinic.map((row) => ({
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      totalTickets: row.total_tickets,
      openTickets: row.open_tickets,
      resolvedTickets: row.resolved_tickets,
      closedTickets: row.closed_tickets,
    })),
  };
}

async function getClinicDashboard(currentUser) {
  if (![ROLES.OWNER, ROLES.SUPER_ADMIN].includes(currentUser.role)) {
    throw new ApiError(403, 'Only owner or super admin can access clinic dashboard.', {
      code: 'FORBIDDEN',
    });
  }

  if (!currentUser.clinicId && currentUser.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(400, 'Clinic context is required.', {
      code: 'CLINIC_ID_REQUIRED',
    });
  }

  const clinicId = Number(currentUser.clinicId);

  const [
    leadSummary,
    pipelineDistribution,
    overdueFollowups,
    appointmentsSummary,
    reviewSummary,
    duplicateWarnings,
    sourceBreakdown,
    staffPerformance,
  ] = await Promise.all([
    dashboardsRepository.getClinicLeadSummary(clinicId),
    dashboardsRepository.getClinicPipelineDistribution(clinicId),
    dashboardsRepository.getClinicOverdueFollowups(clinicId),
    dashboardsRepository.getClinicAppointmentsSummary(clinicId),
    dashboardsRepository.getClinicReviewSummary(clinicId),
    dashboardsRepository.getClinicDuplicateWarnings(clinicId),
    dashboardsRepository.getClinicSourceBreakdown(clinicId),
    dashboardsRepository.getClinicStaffPerformance(clinicId),
  ]);

  return {
    summary: {
      leadsToday: leadSummary.leads_today,
      leadsThisWeek: leadSummary.leads_this_week,
      leadsThisMonth: leadSummary.leads_this_month,
      overdueFollowups: overdueFollowups.overdue_count,
      appointmentsToday: appointmentsSummary.appointments_today,
      upcomingAppointments: appointmentsSummary.upcoming_appointments,
      noShows: appointmentsSummary.no_shows,
      reviewRequests: reviewSummary.review_requests,
      reviewsReceived: reviewSummary.reviews_received,
      duplicateWarnings: duplicateWarnings.duplicate_groups,
    },
    pipelineDistribution: pipelineDistribution.map((row) => ({
      pipelineStatus: row.pipeline_status,
      count: row.count,
    })),
    sourceBreakdown: sourceBreakdown.map((row) => ({
      source: row.source,
      count: row.count,
    })),
    staffPerformance: staffPerformance.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      status: row.status,
      leadsCreated: row.leads_created,
      currentlyHandledLeads: row.currently_handled_leads,
      leadsContactedOrProgressed: row.leads_contacted_or_progressed,
      followupsCompleted: row.followups_completed,
      appointmentsBooked: row.appointments_booked,
      avgResponseMinutes: row.avg_response_minutes,
      overdueAssignedLeads: row.overdue_assigned_leads,
      noShowRelatedHandledLeads: row.no_show_related_handled_leads,
    })),
  };
}

module.exports = {
  getSuperAdminDashboard,
  getClinicDashboard,
};