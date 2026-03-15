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

function getSuggestedEndParts(datePart, timePart) {
  const localValue = joinLocalDateTimeValue(datePart, timePart);

  if (!localValue) {
    return { date: "", time: "" };
  }

  return splitLocalDateTimeValue(addMinutesToLocalInput(localValue, 30));
}

function createInitialAppointmentForm() {
  return {
    leadId: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    status: "booked",
    notes: "",
  };
}

function createEditForm(appointment) {
  const start = splitLocalDateTimeValue(
    formatDateTimeInputValue(appointment.startTime)
  );
  const end = splitLocalDateTimeValue(formatDateTimeInputValue(appointment.endTime));

  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    status: appointment.status || "booked",
    notes: appointment.notes || "",
  };
}

function getLeadInitials(name) {
  if (!name) return "AP";

  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (!parts.length) return "AP";

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
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
  const [isLoading, setIsLoading] = useState(true);

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [appointmentRows, leadRows] = await Promise.all([
        listAppointments({
          status: appliedFilters.status || undefined,
        }),
        listLeads({
          visibilityStatus: "active",
        }),
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
    loadPage();
  }, [loadPage]);

  const leadsById = useMemo(() => {
    return leads.reduce((acc, lead) => {
      acc[lead.id] = lead;
      return acc;
    }, {});
  }, [leads]);

  const visibleAppointments = useMemo(() => {
    let rows = sortByDateAsc(appointments, (item) => item.startTime);

    if (appliedFilters.search.trim()) {
      const searchText = appliedFilters.search.trim().toLowerCase();

      rows = rows.filter((appointment) => {
        const lead = leadsById[appointment.leadId];
        if (!lead) return false;

        return [
          lead.patientName,
          lead.phone,
          lead.email,
          lead.source,
          lead.serviceRequested,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchText));
      });
    }

    return rows;
  }, [appointments, appliedFilters.search, leadsById]);

  function buildCreateStartLocalValue() {
    return joinLocalDateTimeValue(createForm.startDate, createForm.startTime);
  }

  function buildCreateEndLocalValue() {
    return joinLocalDateTimeValue(createForm.endDate, createForm.endTime);
  }

  function buildEditStartLocalValue() {
    return joinLocalDateTimeValue(editForm?.startDate, editForm?.startTime);
  }

  function buildEditEndLocalValue() {
    return joinLocalDateTimeValue(editForm?.endDate, editForm?.endTime);
  }

  function validateAppointmentRange(startLocal, endLocal) {
    if (!startLocal || !endLocal) {
      return "Please choose both start and end date/time first.";
    }

    const startMs = new Date(toIsoFromLocalInput(startLocal)).getTime();
    const endMs = new Date(toIsoFromLocalInput(endLocal)).getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return "Please enter a valid appointment time.";
    }

    if (endMs <= startMs) {
      return "Appointment end time must be after the start time.";
    }

    return "";
  }

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

  function handleCreateStartDateChange(value) {
    setCreateForm((current) => {
      const next = {
        ...current,
        startDate: value,
      };

      if (!next.endDate) {
        next.endDate = value;
      }

      if (next.startTime && !next.endTime) {
        const suggested = getSuggestedEndParts(value, next.startTime);
        next.endDate = suggested.date || next.endDate;
        next.endTime = suggested.time || next.endTime;
      }

      return next;
    });
  }

  function handleCreateStartTimeChange(value) {
    setCreateForm((current) => {
      const next = {
        ...current,
        startTime: value,
      };

      if (next.startDate && !next.endTime) {
        const suggested = getSuggestedEndParts(next.startDate, value);
        next.endDate = next.endDate || suggested.date || next.startDate;
        next.endTime = suggested.time || next.endTime;
      }

      return next;
    });
  }

  function handleEditStartDateChange(value) {
    setEditForm((current) => {
      const next = {
        ...current,
        startDate: value,
      };

      if (!next.endDate) {
        next.endDate = value;
      }

      if (next.startTime && !next.endTime) {
        const suggested = getSuggestedEndParts(value, next.startTime);
        next.endDate = suggested.date || next.endDate;
        next.endTime = suggested.time || next.endTime;
      }

      return next;
    });
  }

  function handleEditStartTimeChange(value) {
    setEditForm((current) => {
      const next = {
        ...current,
        startTime: value,
      };

      if (next.startDate && !next.endTime) {
        const suggested = getSuggestedEndParts(next.startDate, value);
        next.endDate = next.endDate || suggested.date || next.startDate;
        next.endTime = suggested.time || next.endTime;
      }

      return next;
    });
  }

  function openDrawer(appointment) {
    setSelectedAppointment(appointment);
    setEditForm(createEditForm(appointment));
  }

  function closeDrawer() {
    setSelectedAppointment(null);
    setEditForm(null);
  }

  async function handleCreateAppointment(event) {
    event.preventDefault();

    const startLocal = buildCreateStartLocalValue();
    const endLocal = buildCreateEndLocalValue();
    const validationError = validateAppointmentRange(startLocal, endLocal);

    if (!createForm.leadId) {
      setError("Please select a lead first.");
      return;
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    setBusyKey("create-appointment");
    setError("");
    setNotice("");

    try {
      await createAppointment({
        leadId: Number(createForm.leadId),
        startTime: toIsoFromLocalInput(startLocal),
        endTime: toIsoFromLocalInput(endLocal),
        status: createForm.status,
        notes: createForm.notes || null,
      });

      setNotice("Appointment created successfully.");
      setCreateForm(createInitialAppointmentForm());
      await loadPage();
    } catch (err) {
      setError(err.message || "Could not create appointment.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSaveAppointment() {
    if (!selectedAppointment || !editForm) return;

    const startLocal = buildEditStartLocalValue();
    const endLocal = buildEditEndLocalValue();
    const validationError = validateAppointmentRange(startLocal, endLocal);

    if (validationError) {
      setError(validationError);
      return;
    }

    setBusyKey(`appointment-${selectedAppointment.id}`);
    setError("");
    setNotice("");

    try {
      await updateAppointment(selectedAppointment.id, {
        startTime: toIsoFromLocalInput(startLocal),
        endTime: toIsoFromLocalInput(endLocal),
        status: editForm.status,
        notes: editForm.notes || null,
      });

      setNotice("Appointment updated.");
      await loadPage();
      closeDrawer();
    } catch (err) {
      setError(err.message || "Could not update appointment.");
    } finally {
      setBusyKey("");
    }
  }

  const selectedLead = selectedAppointment
    ? leadsById[selectedAppointment.leadId]
    : null;

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Appointments</h1>
        <p className="muted">
          This is the receptionist scheduling screen. Create, review, and update
          appointments here.
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
            <p className="muted">
              Filter by backend status and search locally by patient details.
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
                {appointmentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Search patient</label>
              <input
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
              onClick={loadPage}
            >
              Refresh
            </button>
          </div>
        </form>
      </section>

      <section className="page-card appointment-create-card">
        <div className="section-heading">
          <div>
            <h2>Create appointment</h2>
            <p className="muted">
              Pick a lead, choose a slot, and save the visit.
            </p>
          </div>
        </div>

        <form className="stack-sm" onSubmit={handleCreateAppointment}>
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
          </div>

          <div className="appointment-datetime-grid">
            <div className="appointment-datetime-block">
              <h4>Start</h4>

              <div className="appointment-two-col-grid">
                <div className="lead-split-field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={createForm.startDate}
                    onChange={(event) => handleCreateStartDateChange(event.target.value)}
                  />
                </div>

                <div className="lead-split-field">
                  <label>Time</label>
                  <select
                    value={createForm.startTime}
                    onChange={(event) => handleCreateStartTimeChange(event.target.value)}
                  >
                    <option value="">Select time</option>
                    {TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="appointment-datetime-block">
              <h4>End</h4>

              <div className="appointment-two-col-grid">
                <div className="lead-split-field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(event) => updateCreateForm("endDate", event.target.value)}
                  />
                </div>

                <div className="lead-split-field">
                  <label>Time</label>
                  <select
                    value={createForm.endTime}
                    onChange={(event) => updateCreateForm("endTime", event.target.value)}
                  >
                    <option value="">Select time</option>
                    {TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Status</label>
              <select
                value={createForm.status}
                onChange={(event) => updateCreateForm("status", event.target.value)}
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
                value={createForm.notes}
                onChange={(event) => updateCreateForm("notes", event.target.value)}
                placeholder="Optional appointment note"
              />
            </div>
          </div>

          <div className="record-actions appointment-action-bar">
            <button
              type="submit"
              className="primary-button"
              disabled={busyKey === "create-appointment"}
            >
              {busyKey === "create-appointment"
                ? "Creating…"
                : "Create appointment"}
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Appointment list</h2>
            <p className="muted">
              {isLoading
                ? "Loading appointments…"
                : `${visibleAppointments.length} appointments in this view`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="muted">Loading appointments…</p>
        ) : visibleAppointments.length === 0 ? (
          <div className="empty-state">No appointments matched your current filters.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Phone</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleAppointments.map((appointment) => {
                  const lead = leadsById[appointment.leadId];

                  return (
                    <tr key={appointment.id}>
                      <td>
                        <div className="table-primary-cell">
                          <strong>{lead?.patientName || `Lead #${appointment.leadId}`}</strong>
                          <span className="muted">{lead?.email || "No email"}</span>
                        </div>
                      </td>

                      <td>
                        <StatusPill status={appointment.status} />
                      </td>

                      <td>{lead?.phone || "No phone"}</td>
                      <td>{formatDateTime(appointment.startTime)}</td>
                      <td>{formatDateTime(appointment.endTime)}</td>

                      <td>
                        <button
                          type="button"
                          className="primary-button compact-button"
                          onClick={() => openDrawer(appointment)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedAppointment && editForm && (
        <div className="drawer-backdrop" onClick={closeDrawer}>
          <aside
            className="drawer-panel appointment-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header appointment-drawer-header">
              <div className="appointment-drawer-header-main">
                <div className="appointment-drawer-avatar">
                  {getLeadInitials(selectedLead?.patientName)}
                </div>

                <div className="appointment-drawer-header-copy">
                  <h2>{selectedLead?.patientName || `Lead #${selectedAppointment.leadId}`}</h2>
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

            <div className="stack appointment-details-stack">
              <section className="page-card drawer-card">
                <div className="section-heading">
                  <div>
                    <h3>Appointment details</h3>
                    <p className="muted">
                      Update timing, status, and notes for this visit.
                    </p>
                  </div>

                  <StatusPill status={editForm.status} />
                </div>

                <div className="appointment-drawer-content">
                  <div className="appointment-meta-grid">
                    <div className="appointment-meta-item">
                      <span className="lead-summary-label">Phone</span>
                      <strong>{selectedLead?.phone || "No phone"}</strong>
                    </div>

                    <div className="appointment-meta-item">
                      <span className="lead-summary-label">Email</span>
                      <strong>{selectedLead?.email || "No email"}</strong>
                    </div>

                    <div className="appointment-meta-item">
                      <span className="lead-summary-label">Source</span>
                      <strong>{selectedLead?.source || "Not added"}</strong>
                    </div>

                    <div className="appointment-meta-item">
                      <span className="lead-summary-label">Service</span>
                      <strong>{selectedLead?.serviceRequested || "Not added"}</strong>
                    </div>
                  </div>

                  <div className="appointment-datetime-grid appointment-datetime-grid-drawer">
                    <div className="appointment-datetime-block">
                      <h4>Start</h4>

                      <div className="appointment-two-col-grid">
                        <div className="lead-split-field">
                          <label>Date</label>
                          <input
                            type="date"
                            value={editForm.startDate}
                            onChange={(event) =>
                              handleEditStartDateChange(event.target.value)
                            }
                          />
                        </div>

                        <div className="lead-split-field">
                          <label>Time</label>
                          <select
                            value={editForm.startTime}
                            onChange={(event) =>
                              handleEditStartTimeChange(event.target.value)
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
                      </div>
                    </div>

                    <div className="appointment-datetime-block">
                      <h4>End</h4>

                      <div className="appointment-two-col-grid">
                        <div className="lead-split-field">
                          <label>Date</label>
                          <input
                            type="date"
                            value={editForm.endDate}
                            onChange={(event) =>
                              updateEditForm("endDate", event.target.value)
                            }
                          />
                        </div>

                        <div className="lead-split-field">
                          <label>Time</label>
                          <select
                            value={editForm.endTime}
                            onChange={(event) =>
                              updateEditForm("endTime", event.target.value)
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
                      </div>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label>Status</label>
                      <select
                        value={editForm.status}
                        onChange={(event) =>
                          updateEditForm("status", event.target.value)
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
                        value={editForm.notes}
                        onChange={(event) =>
                          updateEditForm("notes", event.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="record-actions appointment-save-bar">
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
                    disabled={busyKey === `appointment-${selectedAppointment.id}`}
                    onClick={handleSaveAppointment}
                  >
                    Save appointment
                  </button>
                </div>
              </section>

              <section className="page-card drawer-card">
                <div className="section-heading">
                  <div>
                    <h3>Lead note</h3>
                    <p className="muted">
                      Quick context from the linked lead.
                    </p>
                  </div>
                </div>

                <div className="lead-note-panel appointment-lead-note-panel">
                  <p>{selectedLead?.notes || "No lead notes available."}</p>
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}

      <style jsx global>{`
        .appointment-create-card .stack-sm {
          gap: 18px;
        }

        .appointment-datetime-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .appointment-datetime-block {
          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));
          background: var(--surface-soft, rgba(92, 118, 168, 0.04));
          border-radius: 14px;
          padding: 14px;
        }

        .appointment-datetime-block h4 {
          margin: 0 0 12px;
          font-size: 15px;
        }

        .appointment-two-col-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .lead-split-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .lead-split-field label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--muted, #66758b);
          font-weight: 700;
        }

        .lead-split-field input,
        .lead-split-field select {
          width: 100%;
        }

        .appointment-action-bar {
          padding-top: 4px;
        }

        .appointment-drawer {
          width: min(920px, calc(100vw - 24px));
          max-width: 920px;
        }

        .appointment-drawer-header {
          align-items: center;
          gap: 16px;
        }

        .appointment-drawer-header-main {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          flex: 1;
        }

        .appointment-drawer-avatar {
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

        .appointment-drawer-header-copy {
          min-width: 0;
        }

        .appointment-drawer-header-copy h2 {
          margin: 0;
        }

        .appointment-details-stack {
          gap: 16px;
        }

        .appointment-drawer-content {
          margin-top: 16px;
          display: grid;
          gap: 16px;
        }

        .appointment-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .appointment-meta-item {
          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));
          background: var(--surface-soft, rgba(92, 118, 168, 0.06));
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .lead-summary-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--muted, #66758b);
          font-weight: 700;
        }

        .appointment-datetime-grid-drawer {
          margin-top: 2px;
        }

        .appointment-save-bar {
          margin-top: 18px;
          padding-top: 4px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .appointment-lead-note-panel {
          margin-top: 0;
        }

        .lead-note-panel {
          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));
          background: var(--surface-soft, rgba(92, 118, 168, 0.04));
          border-radius: 14px;
          padding: 14px;
        }

        .lead-note-panel p {
          margin: 0;
          white-space: pre-wrap;
        }

        @media (max-width: 1100px) {
          .appointment-drawer {
            width: min(100vw - 20px, 100%);
          }
        }

        @media (max-width: 820px) {
          .appointment-datetime-grid,
          .appointment-two-col-grid,
          .appointment-meta-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .appointment-drawer-header {
            align-items: flex-start;
          }

          .appointment-save-bar {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}