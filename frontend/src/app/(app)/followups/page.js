"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatusPill from "../../../components/shared/statusPill";
import {
  formatDateTime,
  formatDateTimeInputValue,
  sortByDateAsc,
  toIsoFromLocalInput,
} from "../../../lib/date/date";
import {
  createFollowup,
  followupStatusOptions,
  listFollowups,
  updateFollowup,
  updateFollowupStatus,
} from "../../../lib/receptionist/followupsApi";
import { listLeads } from "../../../lib/receptionist/leadsApi";
import { listUsers } from "../../../lib/receptionist/usersApi";
import { useAuth } from "../../../providers/sessionProvider";

const TIME_OPTIONS = buildTimeOptions(15);

function buildTimeOptions(stepMinutes = 15) {
  const options = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0"
      )}`;

      const suffix = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      const label = `${String(hour12).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0"
      )} ${suffix}`;

      options.push({ value, label });
    }
  }

  return options;
}

function splitLocalDateTimeValue(localValue) {
  if (!localValue) {
    return { date: "", time: "" };
  }

  const [datePart = "", timePart = ""] = String(localValue).split("T");

  return {
    date: datePart,
    time: timePart.slice(0, 5),
  };
}

function joinLocalDateTimeValue(datePart, timePart) {
  if (!datePart || !timePart) {
    return "";
  }

  return `${datePart}T${timePart}`;
}

function createInitialFilters(user) {
  return {
    status: "",
    dueBucket: "",
    search: "",
    assignmentScope: user?.role === "receptionist" ? "mine" : "all",
  };
}

function createInitialCreateForm() {
  return {
    leadId: "",
    dueDate: "",
    dueTime: "",
    notes: "",
  };
}

function createEditForm(followup) {
  const dueAtParts = splitLocalDateTimeValue(
    formatDateTimeInputValue(followup?.dueAt)
  );

  return {
    dueDate: dueAtParts.date || "",
    dueTime: dueAtParts.time || "",
    status: followup?.status || "pending",
    outcome: followup?.outcome || "",
    notes: followup?.notes || "",
  };
}

function getLeadInitials(name) {
  if (!name) return "FU";

  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (!parts.length) return "FU";

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getEndOfToday() {
  const start = getStartOfToday();
  return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
}

function isPendingOverdue(followup) {
  if (followup.status !== "pending" || !followup.dueAt) return false;
  return new Date(followup.dueAt).getTime() < Date.now();
}

function isPendingToday(followup) {
  if (followup.status !== "pending" || !followup.dueAt) return false;
  return isSameLocalDay(new Date(followup.dueAt), new Date());
}

function isPendingUpcoming(followup) {
  if (followup.status !== "pending" || !followup.dueAt) return false;
  const dueAt = new Date(followup.dueAt).getTime();
  return dueAt > getEndOfToday().getTime();
}

function isDoneToday(followup) {
  if (followup.status !== "done" || !followup.completedAt) return false;
  return isSameLocalDay(new Date(followup.completedAt), new Date());
}

export default function FollowupsPage() {
  const { user } = useAuth();

  const [filterForm, setFilterForm] = useState(createInitialFilters(user));
  const [appliedFilters, setAppliedFilters] = useState(createInitialFilters(user));

  const [createForm, setCreateForm] = useState(createInitialCreateForm());
  const [followups, setFollowups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const next = createInitialFilters(user);
    setFilterForm(next);
    setAppliedFilters(next);
  }, [user]);

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [followupRows, leadRows, userRows] = await Promise.all([
        listFollowups({
          status: appliedFilters.status || undefined,
        }),
        listLeads({
          visibilityStatus: "active",
        }),
        listUsers({ status: "active" }),
      ]);

      setFollowups(followupRows);
      setLeads(leadRows);
      setUsers(userRows);
    } catch (err) {
      setError(err.message || "Could not load follow-ups.");
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters.status]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const leadsById = useMemo(() => {
    return leads.reduce((acc, lead) => {
      acc[lead.id] = lead;
      return acc;
    }, {});
  }, [leads]);

  const usersById = useMemo(() => {
    return users.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [users]);

  const getAssigneeLabel = useCallback(
    (lead) => {
      if (!lead?.assignedToUserId) return "Unassigned";
      return usersById[lead.assignedToUserId]?.fullName || `User #${lead.assignedToUserId}`;
    },
    [usersById]
  );

  const visibleFollowups = useMemo(() => {
    let rows = sortByDateAsc(followups, (item) => item.dueAt);

    if (appliedFilters.assignmentScope === "mine") {
      rows = rows.filter((followup) => {
        const lead = leadsById[followup.leadId];
        return Number(lead?.assignedToUserId) === Number(user?.id);
      });
    }

    if (appliedFilters.assignmentScope === "unassigned") {
      rows = rows.filter((followup) => {
        const lead = leadsById[followup.leadId];
        return !lead?.assignedToUserId;
      });
    }

    if (appliedFilters.search.trim()) {
      const searchText = appliedFilters.search.trim().toLowerCase();

      rows = rows.filter((followup) => {
        const lead = leadsById[followup.leadId];

        return [
          lead?.patientName,
          lead?.phone,
          lead?.email,
          lead?.source,
          lead?.serviceRequested,
          followup.notes,
          followup.outcome,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchText));
      });
    }

    if (appliedFilters.dueBucket === "overdue") {
      rows = rows.filter(isPendingOverdue);
    }

    if (appliedFilters.dueBucket === "today") {
      rows = rows.filter(isPendingToday);
    }

    if (appliedFilters.dueBucket === "upcoming") {
      rows = rows.filter(isPendingUpcoming);
    }

    return rows;
  }, [appliedFilters, followups, leadsById, user]);

  const summary = useMemo(() => {
    return {
      pending: followups.filter((item) => item.status === "pending").length,
      overdue: followups.filter(isPendingOverdue).length,
      dueToday: followups.filter(isPendingToday).length,
      doneToday: followups.filter(isDoneToday).length,
    };
  }, [followups]);

  function updateCreateForm(field, value) {
    setCreateForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function buildCreateDueLocalValue() {
    return joinLocalDateTimeValue(createForm.dueDate, createForm.dueTime);
  }

  function buildEditDueLocalValue() {
    return joinLocalDateTimeValue(editForm?.dueDate, editForm?.dueTime);
  }

  function openDrawer(followup) {
    setSelectedFollowup(followup);
    setEditForm(createEditForm(followup));
  }

  function closeDrawer() {
    setSelectedFollowup(null);
    setEditForm(null);
  }

  async function handleCreateFollowup(event) {
    event.preventDefault();

    const dueLocal = buildCreateDueLocalValue();

    if (!createForm.leadId) {
      setError("Please select a lead first.");
      return;
    }

    if (!dueLocal) {
      setError("Please choose both follow-up date and time first.");
      return;
    }

    setBusyKey("create-followup");
    setError("");
    setNotice("");

    try {
      await createFollowup({
        leadId: Number(createForm.leadId),
        dueAt: toIsoFromLocalInput(dueLocal),
        notes: createForm.notes || null,
        outcome: null,
      });

      setNotice("Follow-up created.");
      setCreateForm(createInitialCreateForm());
      await loadPage();
    } catch (err) {
      setError(err.message || "Could not create follow-up.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSaveFollowup() {
    if (!selectedFollowup || !editForm) return;

    const dueLocal = buildEditDueLocalValue();

    if (!dueLocal) {
      setError("Please choose both follow-up date and time first.");
      return;
    }

    setBusyKey(`followup-save-${selectedFollowup.id}`);
    setError("");
    setNotice("");

    try {
      await updateFollowup(selectedFollowup.id, {
        dueAt: toIsoFromLocalInput(dueLocal),
        status: editForm.status,
        outcome: editForm.outcome || null,
        notes: editForm.notes || null,
      });

      setNotice("Follow-up updated.");
      await loadPage();
      closeDrawer();
    } catch (err) {
      setError(err.message || "Could not update follow-up.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleQuickStatus(followup, status) {
    setBusyKey(`followup-status-${followup.id}`);
    setError("");
    setNotice("");

    try {
      await updateFollowupStatus(followup.id, { status });
      setNotice(`Follow-up marked as ${status}.`);
      await loadPage();

      if (selectedFollowup?.id === followup.id) {
        closeDrawer();
      }
    } catch (err) {
      setError(err.message || "Could not update follow-up status.");
    } finally {
      setBusyKey("");
    }
  }

  const selectedLead = selectedFollowup ? leadsById[selectedFollowup.leadId] : null;
  const selectedAssigneeLabel = selectedLead ? getAssigneeLabel(selectedLead) : "—";

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Follow-ups</h1>
        <p className="muted">
          This is the follow-up queue. Create, review, and close callback tasks from one place.
        </p>
      </div>

      {(error || notice) && (
        <div className={error ? "error-banner" : "notice-banner"}>
          {error || notice}
        </div>
      )}

      <section className="page-card followups-summary-card">
        <div className="section-heading">
          <div>
            <h2>Follow-up overview</h2>
            <p className="muted">
              Keep an eye on pending work, overdue items, and same-day completions.
            </p>
          </div>
        </div>

        <div className="followups-summary-grid">
          <article className="followup-summary-tile">
            <span className="followup-summary-label">Pending</span>
            <strong>{summary.pending}</strong>
          </article>

          <article className="followup-summary-tile">
            <span className="followup-summary-label">Overdue</span>
            <strong>{summary.overdue}</strong>
          </article>

          <article className="followup-summary-tile">
            <span className="followup-summary-label">Due today</span>
            <strong>{summary.dueToday}</strong>
          </article>

          <article className="followup-summary-tile">
            <span className="followup-summary-label">Done today</span>
            <strong>{summary.doneToday}</strong>
          </article>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Filter follow-ups</h2>
            <p className="muted">
              Use backend status filtering first, then narrow the queue locally.
            </p>
          </div>
        </div>

        <form
          className="stack-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedFilters(filterForm);
          }}
        >
          <div className="form-grid">
            <div className="field">
              <label>Status</label>
              <select
                value={filterForm.status}
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="">All statuses</option>
                {followupStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Due bucket</label>
              <select
                value={filterForm.dueBucket}
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    dueBucket: event.target.value,
                  }))
                }
              >
                <option value="">All follow-ups</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>

            <div className="field">
              <label>Assignment scope</label>
              <select
                value={filterForm.assignmentScope}
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    assignmentScope: event.target.value,
                  }))
                }
              >
                <option value="all">All visible leads</option>
                <option value="mine">Assigned to me</option>
                <option value="unassigned">Unassigned only</option>
              </select>
            </div>

            <div className="field">
              <label>Search</label>
              <input
                type="text"
                value={filterForm.search}
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Patient, phone, email, source, notes"
              />
            </div>
          </div>

          <div className="record-actions">
            <button type="submit" className="primary-button">
              Apply filters
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={loadPage}
            >
              Refresh
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Create follow-up</h2>
            <p className="muted">
              Add a new callback task without going back into the lead drawer.
            </p>
          </div>
        </div>

        <form className="stack-sm" onSubmit={handleCreateFollowup}>
          <div className="form-grid">
            <div className="field field-span-2">
              <label>Lead</label>
              <select
                value={createForm.leadId}
                onChange={(event) => updateCreateForm("leadId", event.target.value)}
                required
              >
                <option value="">Select a lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.patientName} — {lead.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Follow-up date</label>
              <input
                type="date"
                value={createForm.dueDate}
                onChange={(event) => updateCreateForm("dueDate", event.target.value)}
              />
            </div>

            <div className="field">
              <label>Follow-up time</label>
              <select
                value={createForm.dueTime}
                onChange={(event) => updateCreateForm("dueTime", event.target.value)}
              >
                <option value="">Select time</option>
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field-span-2">
              <label>Notes</label>
              <textarea
                value={createForm.notes}
                onChange={(event) => updateCreateForm("notes", event.target.value)}
                placeholder="What should happen on this follow-up?"
              />
            </div>
          </div>

          <div className="record-actions followup-create-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={busyKey === "create-followup"}
            >
              {busyKey === "create-followup" ? "Creating…" : "Create follow-up"}
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Follow-up list</h2>
            <p className="muted">
              {isLoading
                ? "Loading follow-ups…"
                : `${visibleFollowups.length} follow-ups in this view`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="muted">Loading follow-ups…</p>
        ) : visibleFollowups.length === 0 ? (
          <div className="empty-state">No follow-ups matched your current filters.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleFollowups.map((followup) => {
                  const lead = leadsById[followup.leadId];
                  const isBusy = busyKey === `followup-status-${followup.id}`;
                  const isOverdue = isPendingOverdue(followup);

                  return (
                    <tr key={followup.id}>
                      <td>
                        <div className="table-primary-cell">
                          <strong>{lead?.patientName || `Lead #${followup.leadId}`}</strong>
                          <span className="muted">{lead?.email || "No email"}</span>
                        </div>
                      </td>

                      <td>
                        <div className="table-primary-cell">
                          <strong>{formatDateTime(followup.dueAt)}</strong>
                          <span className="muted">
                            {isOverdue ? "Overdue" : followup.outcome || "No outcome"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <StatusPill status={followup.status} />
                      </td>

                      <td>{getAssigneeLabel(lead)}</td>
                      <td>{lead?.phone || "No phone"}</td>

                      <td>
                        <div className="record-actions">
                          {followup.status === "pending" && (
                            <>
                              <button
                                type="button"
                                className="primary-button compact-button"
                                disabled={isBusy}
                                onClick={() => handleQuickStatus(followup, "done")}
                              >
                                Done
                              </button>

                              <button
                                type="button"
                                className="secondary-button compact-button"
                                disabled={isBusy}
                                onClick={() => handleQuickStatus(followup, "skipped")}
                              >
                                Skip
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => openDrawer(followup)}
                          >
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedFollowup && editForm && (
        <div className="drawer-backdrop" onClick={closeDrawer}>
          <aside
            className="drawer-panel followup-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header followup-drawer-header">
              <div className="followup-drawer-header-main">
                <div className="followup-drawer-avatar">
                  {getLeadInitials(selectedLead?.patientName)}
                </div>

                <div className="followup-drawer-header-copy">
                  <h2>{selectedLead?.patientName || `Lead #${selectedFollowup.leadId}`}</h2>
                </div>
              </div>

              <button
                type="button"
                className="secondary-button compact-button"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>

            <div className="stack followup-drawer-stack">
              <section className="page-card drawer-card followup-drawer-card">
                <div className="section-heading">
                  <div>
                    <h3>Follow-up details</h3>
                    <p className="muted">
                      Update due time, status, notes, and outcome from one place.
                    </p>
                  </div>

                  <StatusPill status={editForm.status} />
                </div>

                <div className="followup-drawer-content">
                  <div className="followup-summary-grid">
                    <div className="followup-summary-item">
                      <span className="followup-summary-label">Assignee</span>
                      <strong>{selectedAssigneeLabel}</strong>
                    </div>

                    <div className="followup-summary-item">
                      <span className="followup-summary-label">Phone</span>
                      <strong>{selectedLead?.phone || "No phone"}</strong>
                    </div>

                    <div className="followup-summary-item">
                      <span className="followup-summary-label">Email</span>
                      <strong>{selectedLead?.email || "No email"}</strong>
                    </div>

                    <div className="followup-summary-item">
                      <span className="followup-summary-label">Source</span>
                      <strong>{selectedLead?.source || "Not added"}</strong>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label>Follow-up date</label>
                      <input
                        type="date"
                        value={editForm.dueDate}
                        onChange={(event) =>
                          updateEditForm("dueDate", event.target.value)
                        }
                      />
                    </div>

                    <div className="field">
                      <label>Follow-up time</label>
                      <select
                        value={editForm.dueTime}
                        onChange={(event) =>
                          updateEditForm("dueTime", event.target.value)
                        }
                      >
                        <option value="">Select time</option>
                        {TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Status</label>
                      <select
                        value={editForm.status}
                        onChange={(event) =>
                          updateEditForm("status", event.target.value)
                        }
                      >
                        {followupStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Outcome</label>
                      <input
                        type="text"
                        value={editForm.outcome}
                        onChange={(event) =>
                          updateEditForm("outcome", event.target.value)
                        }
                        placeholder="No answer, callback requested, not interested"
                      />
                    </div>

                    <div className="field field-span-2">
                      <label>Notes</label>
                      <textarea
                        value={editForm.notes}
                        onChange={(event) =>
                          updateEditForm("notes", event.target.value)
                        }
                        placeholder="Internal follow-up note"
                      />
                    </div>
                  </div>
                </div>

                <div className="record-actions followup-drawer-actions">
                  {selectedFollowup.status === "pending" && (
                    <>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busyKey === `followup-status-${selectedFollowup.id}`}
                        onClick={() => handleQuickStatus(selectedFollowup, "skipped")}
                      >
                        Skip
                      </button>

                      <button
                        type="button"
                        className="primary-button"
                        disabled={busyKey === `followup-status-${selectedFollowup.id}`}
                        onClick={() => handleQuickStatus(selectedFollowup, "done")}
                      >
                        Mark done
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeDrawer}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={busyKey === `followup-save-${selectedFollowup.id}`}
                    onClick={handleSaveFollowup}
                  >
                    Save follow-up
                  </button>
                </div>
              </section>

              <section className="page-card drawer-card followup-drawer-card">
                <div className="section-heading">
                  <div>
                    <h3>Lead note</h3>
                    <p className="muted">Quick context from the linked lead.</p>
                  </div>
                </div>

                <div className="followup-note-panel">
                  <p>{selectedLead?.notes || "No lead note added yet."}</p>
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}

      <style jsx global>{`
        .followups-summary-card {
          padding-bottom: 18px;
        }

        .followups-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .followup-summary-tile {
          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));
          background: var(--surface-soft, rgba(92, 118, 168, 0.05));
          border-radius: 16px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .followup-summary-tile strong {
          font-size: 24px;
          line-height: 1;
        }

        .followup-summary-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--muted, #66758b);
          font-weight: 700;
        }

        .followup-create-actions {
          margin-top: 4px;
        }

        .followup-drawer {
          width: min(920px, calc(100vw - 24px));
          max-width: 920px;
        }

        .followup-drawer-header {
          align-items: center;
          gap: 16px;
        }

        .followup-drawer-header-main {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          flex: 1;
        }

        .followup-drawer-avatar {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: var(--text-soft, #2e3b4e);
          background: var(--surface-soft, rgba(92, 118, 168, 0.08));
          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));
        }

        .followup-drawer-header-copy {
          min-width: 0;
        }

        .followup-drawer-header-copy h2 {
          margin: 0;
        }

        .followup-drawer-stack {
          gap: 16px;
        }

        .followup-drawer-card {
          padding: 18px;
          border-radius: 18px;
        }

        .followup-drawer-content {
          margin-top: 16px;
          display: grid;
          gap: 16px;
        }

        .followup-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .followup-summary-item {
          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));
          background: var(--surface-soft, rgba(92, 118, 168, 0.06));
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .followup-drawer-actions {
          margin-top: 18px;
          padding-top: 4px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .followup-note-panel {
          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));
          background: var(--surface-soft, rgba(92, 118, 168, 0.04));
          border-radius: 14px;
          padding: 14px;
        }

        .followup-note-panel p {
          margin: 0;
          white-space: pre-wrap;
        }

        @media (max-width: 1100px) {
          .followups-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .followup-drawer {
            width: min(100vw - 20px, 100%);
          }
        }

        @media (max-width: 820px) {
          .followups-summary-grid,
          .followup-summary-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .followup-drawer-header {
            align-items: flex-start;
          }

          .followup-drawer-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}