"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatusPill from "../../../components/shared/statusPill";
import { formatDateTime, isDateToday, sortByDateAsc } from "../../../lib/date/date";
import { listAppointments } from "../../../lib/receptionist/appointmentsApi";
import { listFollowups, updateFollowupStatus } from "../../../lib/receptionist/followupsApi";
import { assignLeadToSelf, listLeads } from "../../../lib/receptionist/leadsApi";
import { useAuth } from "../../../providers/sessionProvider";

export default function MyTasksPage() {
  const { user } = useAuth();

  const [activeLeads, setActiveLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPage = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError("");

    try {
      const [leadRows, followupRows, appointmentRows] = await Promise.all([
        listLeads({ visibilityStatus: "active" }),
        listFollowups({ status: "pending" }),
        listAppointments(),
      ]);

      setActiveLeads(leadRows);
      setFollowups(followupRows);
      setAppointments(appointmentRows);
    } catch (err) {
      setError(err.message || "Could not load receptionist tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const leadsById = useMemo(() => {
    return activeLeads.reduce((acc, lead) => {
      acc[lead.id] = lead;
      return acc;
    }, {});
  }, [activeLeads]);

  const responsibleLeadIds = useMemo(() => {
    if (!user) return new Set();

    const rows =
      user.role === "receptionist"
        ? activeLeads.filter((lead) => Number(lead.assignedToUserId) === Number(user.id))
        : activeLeads;

    return new Set(rows.map((lead) => lead.id));
  }, [activeLeads, user]);

  const pendingFollowupsForMe = useMemo(() => {
    return sortByDateAsc(
      followups.filter((followup) => responsibleLeadIds.has(followup.leadId)),
      (item) => item.dueAt
    );
  }, [followups, responsibleLeadIds]);

  const overdueFollowups = useMemo(() => {
    const now = Date.now();

    return pendingFollowupsForMe.filter(
      (followup) => new Date(followup.dueAt).getTime() < now
    );
  }, [pendingFollowupsForMe]);

  const todayFollowups = useMemo(() => {
    const now = Date.now();

    return pendingFollowupsForMe.filter((followup) => {
      const dueAt = new Date(followup.dueAt).getTime();
      return isDateToday(followup.dueAt) && dueAt >= now;
    });
  }, [pendingFollowupsForMe]);

  const upcomingAppointments = useMemo(() => {
    return sortByDateAsc(
      appointments.filter((appointment) => {
        const isRelevantLead = responsibleLeadIds.has(appointment.leadId);
        const isUpcoming = new Date(appointment.startTime).getTime() >= Date.now();
        const isOpenStatus = ["booked", "rescheduled"].includes(appointment.status);

        return isRelevantLead && isUpcoming && isOpenStatus;
      }),
      (item) => item.startTime
    );
  }, [appointments, responsibleLeadIds]);

  const pickupLeads = useMemo(() => {
    return sortByDateAsc(
      activeLeads.filter((lead) => !lead.assignedToUserId),
      (item) => item.createdAt
    );
  }, [activeLeads]);

  async function handleFollowupAction(followupId, status) {
    setBusyKey(`followup-${followupId}`);
    setError("");
    setNotice("");

    try {
      await updateFollowupStatus(followupId, { status });
      setNotice(`Follow-up marked as ${status}.`);
      await loadPage();
    } catch (err) {
      setError(err.message || "Could not update follow-up.");
    } finally {
      setBusyKey("");
    }
  }

  async function handlePickupLead(leadId) {
    setBusyKey(`lead-${leadId}`);
    setError("");
    setNotice("");

    try {
      await assignLeadToSelf(leadId);
      setNotice("Lead assigned to you.");
      await loadPage();
    } catch (err) {
      setError(err.message || "Could not assign lead to you.");
    } finally {
      setBusyKey("");
    }
  }

  function getLeadLabel(leadId) {
    return leadsById[leadId]?.patientName || `Lead #${leadId}`;
  }

  function getLeadPhone(leadId) {
    return leadsById[leadId]?.phone || "No phone";
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h1>My Tasks</h1>
        <p className="muted">
          This is the receptionist action screen. It pulls follow-ups and appointments from the backend and turns them into today’s work queue.
        </p>
      </div>

      {(error || notice) && (
        <div className={error ? "error-banner" : "notice-banner"}>
          {error || notice}
        </div>
      )}

      <div className="metrics-grid">
        <section className="metric-card">
          <span className="muted small-label">Overdue follow-ups</span>
          <strong>{overdueFollowups.length}</strong>
        </section>

        <section className="metric-card">
          <span className="muted small-label">Due today</span>
          <strong>{todayFollowups.length}</strong>
        </section>

        <section className="metric-card">
          <span className="muted small-label">Upcoming appointments</span>
          <strong>{upcomingAppointments.length}</strong>
        </section>

        <section className="metric-card">
          <span className="muted small-label">Unassigned pickup leads</span>
          <strong>{pickupLeads.length}</strong>
        </section>
      </div>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Overdue follow-ups</h2>
            <p className="muted">These need attention first.</p>
          </div>

          <button type="button" className="secondary-button" onClick={loadPage}>
            Refresh
          </button>
        </div>

        {isLoading ? (
          <p className="muted">Loading tasks…</p>
        ) : overdueFollowups.length === 0 ? (
          <div className="empty-state">No overdue follow-ups right now.</div>
        ) : (
          <div className="records-list">
            {overdueFollowups.map((followup) => (
              <article key={followup.id} className="record-card">
                <div className="record-main">
                  <div className="record-title-row">
                    <h3>{getLeadLabel(followup.leadId)}</h3>
                    <StatusPill status={followup.status} />
                  </div>

                  <div className="record-meta">
                    <span>{formatDateTime(followup.dueAt)}</span>
                    <span>{getLeadPhone(followup.leadId)}</span>
                  </div>

                  <p className="muted">
                    {followup.notes || "No follow-up note added yet."}
                  </p>
                </div>

                <div className="record-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busyKey === `followup-${followup.id}`}
                    onClick={() => handleFollowupAction(followup.id, "done")}
                  >
                    Mark done
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busyKey === `followup-${followup.id}`}
                    onClick={() => handleFollowupAction(followup.id, "skipped")}
                  >
                    Skip
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Due today</h2>
            <p className="muted">These are still on today’s clock.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="muted">Loading tasks…</p>
        ) : todayFollowups.length === 0 ? (
          <div className="empty-state">Nothing else is due later today.</div>
        ) : (
          <div className="records-list">
            {todayFollowups.map((followup) => (
              <article key={followup.id} className="record-card">
                <div className="record-main">
                  <div className="record-title-row">
                    <h3>{getLeadLabel(followup.leadId)}</h3>
                    <StatusPill status={followup.status} />
                  </div>

                  <div className="record-meta">
                    <span>{formatDateTime(followup.dueAt)}</span>
                    <span>{getLeadPhone(followup.leadId)}</span>
                  </div>

                  <p className="muted">
                    {followup.notes || "No follow-up note added yet."}
                  </p>
                </div>

                <div className="record-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busyKey === `followup-${followup.id}`}
                    onClick={() => handleFollowupAction(followup.id, "done")}
                  >
                    Mark done
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busyKey === `followup-${followup.id}`}
                    onClick={() => handleFollowupAction(followup.id, "skipped")}
                  >
                    Skip
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Upcoming appointments</h2>
            <p className="muted">Booked or rescheduled appointments for your active leads.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="muted">Loading appointments…</p>
        ) : upcomingAppointments.length === 0 ? (
          <div className="empty-state">No upcoming appointments found.</div>
        ) : (
          <div className="records-list">
            {upcomingAppointments.map((appointment) => (
              <article key={appointment.id} className="record-card">
                <div className="record-main">
                  <div className="record-title-row">
                    <h3>{getLeadLabel(appointment.leadId)}</h3>
                    <StatusPill status={appointment.status} />
                  </div>

                  <div className="record-meta">
                    <span>Starts: {formatDateTime(appointment.startTime)}</span>
                    <span>Ends: {formatDateTime(appointment.endTime)}</span>
                    <span>{getLeadPhone(appointment.leadId)}</span>
                  </div>

                  <p className="muted">
                    {appointment.notes || "No appointment note added yet."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {user?.role === "receptionist" && (
        <section className="page-card">
          <div className="section-heading">
            <div>
              <h2>Pickup leads</h2>
              <p className="muted">Optional unassigned leads you can grab for follow-up.</p>
            </div>
          </div>

          {isLoading ? (
            <p className="muted">Loading lead pickup list…</p>
          ) : pickupLeads.length === 0 ? (
            <div className="empty-state">No unassigned leads are waiting right now.</div>
          ) : (
            <div className="records-list">
              {pickupLeads.map((lead) => (
                <article key={lead.id} className="record-card">
                  <div className="record-main">
                    <div className="record-title-row">
                      <h3>{lead.patientName}</h3>
                      <StatusPill status={lead.pipelineStatus} />
                    </div>

                    <div className="record-meta">
                      <span>{lead.phone}</span>
                      <span>{lead.email}</span>
                      <span>{lead.source}</span>
                    </div>

                    <p className="muted">
                      {lead.serviceRequested || "No requested service added yet."}
                    </p>
                  </div>

                  <div className="record-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busyKey === `lead-${lead.id}`}
                      onClick={() => handlePickupLead(lead.id)}
                    >
                      Assign to me
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
