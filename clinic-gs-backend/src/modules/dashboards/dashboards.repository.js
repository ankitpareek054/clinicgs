const db = require('../../db');

async function getAdminSummary(client = null) {
  const query = `
    SELECT
      (SELECT COUNT(*)::int FROM clinics) AS total_clinics,
      (SELECT COUNT(*)::int FROM leads) AS total_leads,
      (SELECT COUNT(*)::int FROM leads WHERE created_at >= NOW() - INTERVAL '7 days') AS leads_last_7_days,
      (SELECT COUNT(*)::int FROM leads WHERE created_at >= NOW() - INTERVAL '30 days') AS leads_last_30_days,
      (SELECT COUNT(*)::int FROM appointments WHERE created_at >= NOW() - INTERVAL '7 days') AS bookings_last_7_days,
      (SELECT COUNT(*)::int FROM appointments WHERE created_at >= NOW() - INTERVAL '30 days') AS bookings_last_30_days,
      (SELECT COUNT(*)::int FROM appointments WHERE status = 'completed') AS completed_appointments,
      (
        SELECT COALESCE(
          ROUND(
            (
              COUNT(*) FILTER (WHERE status = 'no_show')::numeric
              / NULLIF(COUNT(*) FILTER (WHERE status IN ('booked', 'rescheduled', 'completed', 'no_show', 'cancelled')), 0)
            ) * 100,
            2
          ),
          0
        )
        FROM appointments
      ) AS no_show_rate_pct,
      (SELECT COUNT(*)::int FROM staff_change_requests WHERE status = 'pending') AS pending_staff_requests,
      (SELECT COUNT(*)::int FROM message_logs WHERE status = 'failed') AS failed_message_logs,
      (SELECT COUNT(*)::int FROM appointments WHERE sync_status = 'failed') AS failed_calendar_syncs
  `;

  const result = await db.query(query, [], client);
  return result.rows[0];
}

async function getClinicsByStatus(client = null) {
  const query = `
    SELECT
      status,
      COUNT(*)::int AS count
    FROM clinics
    GROUP BY status
    ORDER BY status ASC
  `;

  const result = await db.query(query, [], client);
  return result.rows;
}

async function getOverdueFollowupsByClinic(client = null) {
  const query = `
    SELECT
      f.clinic_id,
      c.name AS clinic_name,
      COUNT(*)::int AS overdue_followups
    FROM followups f
    INNER JOIN clinics c ON c.id = f.clinic_id
    WHERE f.status = 'pending'
      AND f.due_at < NOW()
    GROUP BY f.clinic_id, c.name
    ORDER BY overdue_followups DESC, clinic_name ASC
  `;

  const result = await db.query(query, [], client);
  return result.rows;
}

async function getAverageResponseTimeByClinic(client = null) {
  const query = `
    SELECT
      clinic_id,
      clinic_name,
      ROUND(AVG(avg_response_minutes), 2) AS avg_response_minutes
    FROM (
      SELECT
        dcm.clinic_id,
        c.name AS clinic_name,
        dcm.avg_response_minutes
      FROM daily_clinic_metrics dcm
      INNER JOIN clinics c ON c.id = dcm.clinic_id
      WHERE dcm.metric_date >= CURRENT_DATE - INTERVAL '29 days'
    ) x
    GROUP BY clinic_id, clinic_name
    ORDER BY avg_response_minutes ASC NULLS LAST, clinic_name ASC
  `;

  const result = await db.query(query, [], client);
  return result.rows;
}

async function getDuplicateWarningsByClinic(client = null) {
  const query = `
    SELECT
      clinic_id,
      clinic_name,
      COUNT(*)::int AS duplicate_groups
    FROM v_clinic_duplicate_phone_warnings
    GROUP BY clinic_id, clinic_name
    ORDER BY duplicate_groups DESC, clinic_name ASC
  `;

  const result = await db.query(query, [], client);
  return result.rows;
}

async function getTopGrowthClinics(client = null) {
  const query = `
    SELECT
      clinic_id,
      clinic_name,
      clinic_status,
      total_leads_30d,
      booked_appointments_30d,
      conversion_rate_pct,
      growth_score_100
    FROM v_admin_clinic_leaderboard
    ORDER BY growth_score_100 DESC, total_leads_30d DESC
    LIMIT 10
  `;

  const result = await db.query(query, [], client);
  return result.rows;
}

async function getClinicsNeedingAttention(client = null) {
  const query = `
    SELECT
      clinic_id,
      clinic_name,
      clinic_status,
      duplicate_phone_groups,
      unassigned_active_leads,
      open_support_tickets,
      failed_calendar_syncs,
      inactive_receptionists,
      active_receptionists,
      has_no_active_receptionist
    FROM v_clinic_attention_flags
    WHERE duplicate_phone_groups > 0
       OR unassigned_active_leads > 0
       OR open_support_tickets > 0
       OR failed_calendar_syncs > 0
       OR has_no_active_receptionist = TRUE
    ORDER BY failed_calendar_syncs DESC,
             open_support_tickets DESC,
             unassigned_active_leads DESC,
             duplicate_phone_groups DESC,
             clinic_name ASC
  `;

  const result = await db.query(query, [], client);
  return result.rows;
}

async function getPendingStaffRequests(client = null) {
  const query = `
    SELECT
      scr.id,
      scr.clinic_id,
      c.name AS clinic_name,
      scr.request_type,
      scr.target_name,
      scr.target_email::text AS target_email,
      scr.target_role,
      scr.created_at
    FROM staff_change_requests scr
    INNER JOIN clinics c ON c.id = scr.clinic_id
    WHERE scr.status = 'pending'
    ORDER BY scr.created_at DESC
  `;

  const result = await db.query(query, [], client);
  return result.rows;
}

async function getSupportTicketsByClinic(client = null) {
  const query = `
    SELECT
      clinic_id,
      c.name AS clinic_name,
      COUNT(*)::int AS total_tickets,
      COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::int AS open_tickets,
      COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_tickets,
      COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_tickets
    FROM support_tickets st
    INNER JOIN clinics c ON c.id = st.clinic_id
    GROUP BY clinic_id, c.name
    ORDER BY open_tickets DESC, total_tickets DESC, clinic_name ASC
  `;

  const result = await db.query(query, [], client);
  return result.rows;
}

async function getClinicLeadSummary(clinicId, client = null) {
  const query = `
    SELECT
      (SELECT COUNT(*)::int FROM leads WHERE clinic_id = $1 AND created_at >= CURRENT_DATE) AS leads_today,
      (SELECT COUNT(*)::int FROM leads WHERE clinic_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 days') AS leads_this_week,
      (SELECT COUNT(*)::int FROM leads WHERE clinic_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '29 days') AS leads_this_month
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0];
}

async function getClinicPipelineDistribution(clinicId, client = null) {
  const query = `
    SELECT
      pipeline_status,
      COUNT(*)::int AS count
    FROM leads
    WHERE clinic_id = $1
    GROUP BY pipeline_status
    ORDER BY pipeline_status ASC
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows;
}

async function getClinicOverdueFollowups(clinicId, client = null) {
  const query = `
    SELECT
      COUNT(*)::int AS overdue_count
    FROM followups
    WHERE clinic_id = $1
      AND status = 'pending'
      AND due_at < NOW()
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0];
}

async function getClinicAppointmentsSummary(clinicId, client = null) {
  const query = `
    SELECT
      (SELECT COUNT(*)::int
       FROM appointments
       WHERE clinic_id = $1
         AND start_time >= CURRENT_DATE
         AND start_time < CURRENT_DATE + INTERVAL '1 day') AS appointments_today,
      (SELECT COUNT(*)::int
       FROM appointments
       WHERE clinic_id = $1
         AND start_time >= NOW()
         AND status IN ('booked', 'rescheduled')) AS upcoming_appointments,
      (SELECT COUNT(*)::int
       FROM appointments
       WHERE clinic_id = $1
         AND status = 'no_show') AS no_shows
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0];
}

async function getClinicReviewSummary(clinicId, client = null) {
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE review_link_sent_at IS NOT NULL)::int AS review_requests,
      COUNT(*) FILTER (WHERE review_posted = TRUE)::int AS reviews_received
    FROM reviews
    WHERE clinic_id = $1
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0];
}

async function getClinicDuplicateWarnings(clinicId, client = null) {
  const query = `
    SELECT COUNT(*)::int AS duplicate_groups
    FROM v_clinic_duplicate_phone_warnings
    WHERE clinic_id = $1
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0];
}

async function getClinicSourceBreakdown(clinicId, client = null) {
  const query = `
    SELECT
      source,
      COUNT(*)::int AS count
    FROM leads
    WHERE clinic_id = $1
    GROUP BY source
    ORDER BY count DESC, source ASC
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows;
}

async function getClinicStaffPerformance(clinicId, client = null) {
  const query = `
    SELECT
      u.id AS user_id,
      u.full_name,
      u.email::text AS email,
      u.status,
      COUNT(lc.id)::int AS leads_created,
      COUNT(lh.id) FILTER (WHERE lh.visibility_status = 'active')::int AS currently_handled_leads,
      COUNT(lh.id) FILTER (WHERE lh.pipeline_status IN ('contacted', 'booked', 'rescheduled', 'completed', 'review_pending', 'no_show'))::int AS leads_contacted_or_progressed,
      COUNT(f.id) FILTER (WHERE f.status = 'done')::int AS followups_completed,
      COUNT(a.id) FILTER (WHERE a.status IN ('booked', 'rescheduled', 'completed', 'no_show', 'cancelled'))::int AS appointments_booked,
      ROUND(
        AVG(
          CASE
            WHEN lh.first_contact_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (lh.first_contact_at - lh.created_at)) / 60.0
            ELSE NULL
          END
        )::numeric,
        2
      ) AS avg_response_minutes,
      COUNT(lh.id) FILTER (
        WHERE lh.visibility_status = 'active'
          AND lh.next_followup_at IS NOT NULL
          AND lh.next_followup_at < NOW()
      )::int AS overdue_assigned_leads,
      COUNT(lh.id) FILTER (WHERE lh.pipeline_status = 'no_show')::int AS no_show_related_handled_leads
    FROM users u
    LEFT JOIN leads lc
      ON lc.created_by_user_id = u.id
     AND lc.clinic_id = $1
    LEFT JOIN leads lh
      ON lh.assigned_to_user_id = u.id
     AND lh.clinic_id = $1
    LEFT JOIN followups f
      ON f.completed_by_user_id = u.id
     AND f.clinic_id = $1
    LEFT JOIN appointments a
      ON a.created_by_user_id = u.id
     AND a.clinic_id = $1
    WHERE u.clinic_id = $1
      AND u.role = 'receptionist'
    GROUP BY u.id, u.full_name, u.email, u.status
    ORDER BY u.full_name ASC
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows;
}

module.exports = {
  getAdminSummary,
  getClinicsByStatus,
  getOverdueFollowupsByClinic,
  getAverageResponseTimeByClinic,
  getDuplicateWarningsByClinic,
  getTopGrowthClinics,
  getClinicsNeedingAttention,
  getPendingStaffRequests,
  getSupportTicketsByClinic,
  getClinicLeadSummary,
  getClinicPipelineDistribution,
  getClinicOverdueFollowups,
  getClinicAppointmentsSummary,
  getClinicReviewSummary,
  getClinicDuplicateWarnings,
  getClinicSourceBreakdown,
  getClinicStaffPerformance,
};