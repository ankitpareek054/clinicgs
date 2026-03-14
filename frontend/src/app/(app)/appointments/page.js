"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatusPill from "../../../components/shared/statusPill";
import {
  addMinutesToLocalInput,
  formatDateTime,
  formatDateTimeInputValue,
  sortByDateAsc,
  toIsoFromLocalInput,
} from "../../../lib/date/date";
import {
  appointmentStatusOptions,
  createAppointment,
  listAppointments,
  updateAppointment,
} from "../../../lib/receptionist/appointmentsApi";
import { listLeads } from "../../../lib/receptionist/leadsApi";

function createInitialAppointmentForm() {
  return {
    leadId: "",
    startTime: "",
    endTime: "",
    status: "booked",
    notes: "",
  };
}

function createDraftFromAppointment(appointment) {
  return {
    startTime: formatDateTimeInputValue(appointment.startTime),
    endTime: formatDateTimeInputValue(appointment.endTime),
    status: appointment.status,
    notes: appointment.notes || "",
  };
}

export default function AppointmentsPage() {
  const [filterForm, setFilterForm] = useState({
    status: "",
    search: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    search: "",
  });

  const [createForm, setCreateForm] = useState(createInitialAppointmentForm());
  const [appointments, setAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAppointmentsPage = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [appointmentRows, leadRows] = await Promise.all([
        listAppointments({
          status: appliedFilters.status || undefined,
        }),
        listLeads({ visibilityStatus: "active" }),
      ]);

      setAppointments(appointmentRows);
      setLeads(leadRows);
    } catch (err) {
      setError(err.message || "Could not load appointments.");
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters.status]);

  useEffect(() => {
    loadAppointmentsPage();
  }, [loadAppointmentsPage]);

  const leadsById = useMemo(() => {
    return leads.reduce((acc, lead) => {
      acc[lead.id] = lead;
      return acc;
    }, {});
  }, [leads]);

  const visibleAppointments = useMemo(() => {
    let rows = sortByDateAsc(appointments, (item) => item.startTime);

    if (appliedFilters.search) {
      const searchText = appliedFilters.search.trim().toLowerCase();

      rows = rows.filter((appointment) => {
        const lead = leadsById[appointment.leadId];

        if (!lead) return false;

        return [
          lead.patientName,
          lead.phone,
          lead.email,
          lead.source,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchText));
      });
    }

    return rows;
  }, [appointments, appliedFilters.search, leadsById]);

  function updateDraft(appointmentId, patch) {
    setDrafts((current) => ({
      ...current,
      [appointmentId]: {
        ...(current[appointmentId] || {}),
        ...patch,
      },
    }));
  }

  async function handleCreateAppointment(event) {
    event.preventDefault();
    setBusyKey("create-appointment");
    setError("");
    setNotice("");

    try {
      await createAppointment({
        leadId: Number(createForm.leadId),
        startTime: toIsoFromLocalInput(createForm.startTime),
        endTime: toIsoFromLocalInput(createForm.endTime),
        status: createForm.status,
        notes: createForm.notes || null,
      });

      setNotice("Appointment created successfully.");
      setCreateForm(createInitialAppointmentForm());
      await loadAppointmentsPage();
    } catch (err) {
      setError(err.message || "Could not create appointment.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSaveAppointment(appointment) {
    const draft = drafts[appointment.id] || createDraftFromAppointment(appointment);

    setBusyKey(`appointment-${appointment.id}`);
    setError("");
    setNotice("");

    try {
      await updateAppointment(appointment.id, {
        startTime: toIsoFromLocalInput(draft.startTime),
        endTime: toIsoFromLocalInput(draft.endTime),
        status: draft.status,
        notes: draft.notes || null,
      });

      setNotice("Appointment updated.");
      await loadAppointmentsPage();
    } catch (err) {
      setError(err.message || "Could not update appointment.");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Appointments</h1>
        <p className="muted">
          Manage booked, rescheduled, completed, no-show, and cancelled appointments from one page.
        </p>
      </div>

      {(error || notice) && (
        <div className={error ? "error-banner" : "notice-banner"}>
          {error || notice}
        </div>
      )}

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Filter appointments</h2>
            <p className="muted">Use the backend status filter and local patient search.</p>
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
              <label htmlFor="appointment-status-filter">Status</label>
              <select
                id="appointment-status-filter"
                value={filterForm.status}
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="">All statuses</option>
                {appointmentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="appointment-search">Search by patient</label>
              <input
                id="appointment-search"
                type="text"
                value={filterForm.search}
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Patient name, phone, email"
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
              onClick={loadAppointmentsPage}
            >
              Refresh
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Create appointment</h2>
            <p className="muted">Pick a lead, time slot, and status.</p>
          </div>
        </div>

        <form className="stack-sm" onSubmit={handleCreateAppointment}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="new-appointment-lead">Lead</label>
              <select
                id="new-appointment-lead"
                value={createForm.leadId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    leadId: event.target.value,
                  }))
                }
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
              <label htmlFor="new-appointment-start">Start time</label>
              <input
                id="new-appointment-start"
                type="datetime-local"
                value={createForm.startTime}
                onChange={(event) => {
                  const startTime = event.target.value;

                  setCreateForm((current) => ({
                    ...current,
                    startTime,
                    endTime: current.endTime || addMinutesToLocalInput(startTime, 30),
                  }));
                }}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="new-appointment-end">End time</label>
              <input
                id="new-appointment-end"
                type="datetime-local"
                value={createForm.endTime}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    endTime: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="field">
              <label htmlFor="new-appointment-status">Status</label>
              <select
                id="new-appointment-status"
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {appointmentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="new-appointment-notes">Notes</label>
            <textarea
              id="new-appointment-notes"
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional note for the visit"
            />
          </div>

          <div className="record-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={busyKey === "create-appointment"}
            >
              {busyKey === "create-appointment" ? "Creating…" : "Create appointment"}
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Appointment list</h2>
            <p className="muted">
              {isLoading ? "Loading…" : `${visibleAppointments.length} appointments in this view`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="muted">Loading appointments…</p>
        ) : visibleAppointments.length === 0 ? (
          <div className="empty-state">No appointments matched your current filters.</div>
        ) : (
          <div className="records-list">
            {visibleAppointments.map((appointment) => {
              const lead = leadsById[appointment.leadId];
              const draft = drafts[appointment.id] || createDraftFromAppointment(appointment);

              return (
                <article key={appointment.id} className="record-card">
                  <div className="record-main">
                    <div className="record-title-row">
                      <h3>{lead?.patientName || `Lead #${appointment.leadId}`}</h3>
                      <StatusPill status={appointment.status} />
                    </div>

                    <div className="record-meta">
                      <span>{lead?.phone || "No phone"}</span>
                      <span>{lead?.email || "No email"}</span>
                      <span>Starts: {formatDateTime(appointment.startTime)}</span>
                      <span>Ends: {formatDateTime(appointment.endTime)}</span>
                    </div>

                    <p className="muted">
                      {appointment.notes || "No appointment note added yet."}
                    </p>
                  </div>

                  <details className="record-details">
                    <summary>Edit appointment</summary>

                    <div className="top-gap stack-sm">
                      <div className="form-grid">
                        <div className="field">
                          <label>Start time</label>
                          <input
                            type="datetime-local"
                            value={draft.startTime}
                            onChange={(event) => {
                              const startTime = event.target.value;

                              updateDraft(appointment.id, {
                                startTime,
                                endTime: draft.endTime || addMinutesToLocalInput(startTime, 30),
                              });
                            }}
                          />
                        </div>

                        <div className="field">
                          <label>End time</label>
                          <input
                            type="datetime-local"
                            value={draft.endTime}
                            onChange={(event) =>
                              updateDraft(appointment.id, {
                                endTime: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="field">
                          <label>Status</label>
                          <select
                            value={draft.status}
                            onChange={(event) =>
                              updateDraft(appointment.id, {
                                status: event.target.value,
                              })
                            }
                          >
                            {appointmentStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field field-span-2">
                          <label>Notes</label>
                          <textarea
                            value={draft.notes}
                            onChange={(event) =>
                              updateDraft(appointment.id, {
                                notes: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="record-actions">
                        <button
                          type="button"
                          className="primary-button"
                          disabled={busyKey === `appointment-${appointment.id}`}
                          onClick={() => handleSaveAppointment(appointment)}
                        >
                          Save changes
                        </button>
                      </div>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
