const db = require('../../db');

async function getAdminSummary(client = null) {
  const query = `
    SELECT
      (SELECT COUNT(*)::int FROM clinics c) AS total_clinics,
      (SELECT COUNT(*)::int FROM leads l) AS total_leads,
      (SELECT COUNT(*)::int FROM leads l WHERE l.created_at >= NOW() - INTERVAL '7 days') AS leads_last_7_days,
      (SELECT COUNT(*)::int FROM leads l WHERE l.created_at >= NOW() - INTERVAL '30 days') AS leads_last_30_days,
      (SELECT COUNT(*)::int FROM appointments a WHERE a.created_at >= NOW() - INTERVAL '7 days') AS bookings_last_7_days,
      (SELECT COUNT(*)::int FROM appointments a WHERE a.created_at >= NOW() - INTERVAL '30 days') AS bookings_last_30_days,
      (SELECT COUNT(*)::int FROM appointments a WHERE a.status = 'completed') AS completed_appointments,
      (
        SELECT COALESCE(
          ROUND(
            (
              COUNT(*) FILTER (WHERE a.status = 'no_show')::numeric
              / NULLIF(
                  COUNT(*) FILTER (
                    WHERE a.status IN ('booked', 'rescheduled', 'completed', 'no_show', 'cancelled')
                  ),
                  0
                )
            ) * 100,
            2
          ),
          0
        )
        FROM appointments a
      ) AS no_show_rate,
      (SELECT COUNT(*)::int FROM staff_change_requests scr WHERE scr.status = 'pending') AS pending_staff_requests,
      (SELECT COUNT(*)::int FROM message_logs ml WHERE ml.status = 'failed') AS failed_message_count,
      (SELECT COUNT(*)::int FROM appointments a WHERE a.sync_status = 'failed') AS failed_calendar_sync_count
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
      COUNT(*)::int AS duplicate_warning_count
    FROM v_clinic_duplicate_phone_warnings
    GROUP BY clinic_id, clinic_name
    ORDER BY duplicate_warning_count DESC, clinic_name ASC
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
      duplicate_phone_groups AS duplicate_warning_count,
      unassigned_active_leads,
      open_support_tickets,
      failed_calendar_syncs,
      inactive_receptionists,
      active_receptionists,
      has_no_active_receptionist AS no_active_receptionist
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
      st.clinic_id,
      c.name AS clinic_name,
      c.status AS clinic_status,
      COUNT(st.id)::int AS total_tickets,
      COUNT(st.id) FILTER (
        WHERE st.status IN ('open', 'pending', 'in_progress')
      )::int AS open_support_tickets,
      COUNT(st.id) FILTER (
        WHERE st.status = 'resolved'
      )::int AS resolved_tickets,
      COUNT(st.id) FILTER (
        WHERE st.status = 'closed'
      )::int AS closed_tickets
    FROM support_tickets st
    INNER JOIN clinics c ON c.id = st.clinic_id
    GROUP BY st.clinic_id, c.name, c.status
    ORDER BY open_support_tickets DESC, total_tickets DESC, clinic_name ASC
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
      (
        SELECT COUNT(*)::int
        FROM appointments
        WHERE clinic_id = $1
          AND start_time >= CURRENT_DATE
          AND start_time < CURRENT_DATE + INTERVAL '1 day'
      ) AS appointments_today,
      (
        SELECT COUNT(*)::int
        FROM appointments
        WHERE clinic_id = $1
          AND start_time >= NOW()
          AND status IN ('booked', 'rescheduled')
      ) AS upcoming_appointments,
      (
        SELECT COUNT(*)::int
        FROM appointments
        WHERE clinic_id = $1
          AND status = 'no_show'
      ) AS no_shows
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
    WITH clinic_staff AS (
      SELECT
        u.id AS user_id,
        u.full_name,
        u.email::text AS email,
        u.status
      FROM users u
      WHERE u.clinic_id = $1
        AND u.role = 'receptionist'
    ),
    leads_created AS (
      SELECT
        l.created_by_user_id AS user_id,
        COUNT(*)::int AS leads_created
      FROM leads l
      WHERE l.clinic_id = $1
        AND l.created_by_user_id IS NOT NULL
      GROUP BY l.created_by_user_id
    ),
    handled_leads AS (
      SELECT
        l.assigned_to_user_id AS user_id,
        COUNT(*) FILTER (
          WHERE l.visibility_status = 'active'
        )::int AS currently_handled_leads,
        COUNT(*) FILTER (
          WHERE l.pipeline_status IN (
            'contacted',
            'booked',
            'rescheduled',
            'completed',
            'review_pending',
            'no_show'
          )
        )::int AS leads_contacted_or_progressed,
        ROUND(
          AVG(
            CASE
              WHEN l.first_contact_at IS NOT NULL
                   AND l.first_contact_at >= l.created_at
              THEN EXTRACT(EPOCH FROM (l.first_contact_at - l.created_at)) / 60.0
              ELSE NULL
            END
          )::numeric,
          2
        ) AS avg_response_minutes,
        COUNT(*) FILTER (
          WHERE l.visibility_status = 'active'
            AND l.next_followup_at IS NOT NULL
            AND l.next_followup_at < NOW()
        )::int AS overdue_assigned_leads,
        COUNT(*) FILTER (
          WHERE l.pipeline_status = 'no_show'
        )::int AS no_show_related_handled_leads
      FROM leads l
      WHERE l.clinic_id = $1
        AND l.assigned_to_user_id IS NOT NULL
      GROUP BY l.assigned_to_user_id
    ),
    completed_followups AS (
      SELECT
        f.completed_by_user_id AS user_id,
        COUNT(*) FILTER (
          WHERE f.status = 'done'
        )::int AS followups_completed
      FROM followups f
      WHERE f.clinic_id = $1
        AND f.completed_by_user_id IS NOT NULL
      GROUP BY f.completed_by_user_id
    ),
    booked_appointments AS (
      SELECT
        a.created_by_user_id AS user_id,
        COUNT(*) FILTER (
          WHERE a.status IN ('booked', 'rescheduled', 'completed', 'no_show', 'cancelled')
        )::int AS appointments_booked
      FROM appointments a
      WHERE a.clinic_id = $1
        AND a.created_by_user_id IS NOT NULL
      GROUP BY a.created_by_user_id
    )
    SELECT
      s.user_id,
      s.full_name,
      s.email,
      s.status,
      COALESCE(lc.leads_created, 0)::int AS leads_created,
      COALESCE(hl.currently_handled_leads, 0)::int AS currently_handled_leads,
      COALESCE(hl.leads_contacted_or_progressed, 0)::int AS leads_contacted_or_progressed,
      COALESCE(cf.followups_completed, 0)::int AS followups_completed,
      COALESCE(ba.appointments_booked, 0)::int AS appointments_booked,
      hl.avg_response_minutes,
      COALESCE(hl.overdue_assigned_leads, 0)::int AS overdue_assigned_leads,
      COALESCE(hl.no_show_related_handled_leads, 0)::int AS no_show_related_handled_leads
    FROM clinic_staff s
    LEFT JOIN leads_created lc
      ON lc.user_id = s.user_id
    LEFT JOIN handled_leads hl
      ON hl.user_id = s.user_id
    LEFT JOIN completed_followups cf
      ON cf.user_id = s.user_id
    LEFT JOIN booked_appointments ba
      ON ba.user_id = s.user_id
    ORDER BY s.full_name ASC
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