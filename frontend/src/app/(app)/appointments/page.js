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

function createEditForm(appointment) {
  return {
    startTime: formatDateTimeInputValue(appointment.startTime),
    endTime: formatDateTimeInputValue(appointment.endTime),
    status: appointment.status || "booked",
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
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchText));
      });
    }

    return rows;
  }, [appointments, appliedFilters.search, leadsById]);

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
      await loadPage();
    } catch (err) {
      setError(err.message || "Could not create appointment.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSaveAppointment() {
    if (!selectedAppointment || !editForm) return;

    setBusyKey(`appointment-${selectedAppointment.id}`);
    setError("");
    setNotice("");

    try {
      await updateAppointment(selectedAppointment.id, {
        startTime: toIsoFromLocalInput(editForm.startTime),
        endTime: toIsoFromLocalInput(editForm.endTime),
        status: editForm.status,
        notes: editForm.notes || null,
      });

      setNotice("Appointment updated.");
      await loadPage();

      const refreshed = appointments.find((item) => item.id === selectedAppointment.id);
      if (refreshed) {
        setSelectedAppointment(refreshed);
      }

      closeDrawer();
    } catch (err) {
      setError(err.message || "Could not update appointment.");
    } finally {
      setBusyKey("");
    }
  }

  const selectedLead = selectedAppointment ? leadsById[selectedAppointment.leadId] : null;

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Appointments</h1>
        <p className="muted">
          This is the receptionist scheduling screen. Create, review, and update appointments here.
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
            <p className="muted">Filter by backend status and search locally by patient details.</p>
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
              <label htmlFor="appointment-search">Search patient</label>
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

            <button type="button" className="secondary-button" onClick={loadPage}>
              Refresh
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Create appointment</h2>
            <p className="muted">Pick a lead, choose a slot, and save the visit.</p>
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
              placeholder="Optional appointment note"
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
              {isLoading ? "Loading appointments…" : `${visibleAppointments.length} appointments in this view`}
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
          <aside className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2>{selectedLead?.patientName || `Lead #${selectedAppointment.leadId}`}</h2>
                <p className="muted">
                  {selectedLead?.phone || "No phone"} • {selectedLead?.email || "No email"}
                </p>
              </div>

              <button
                type="button"
                className="secondary-button compact-button"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>

            <div className="stack">
              <section className="page-card drawer-card">
                <div className="section-heading">
                  <div>
                    <h3>Appointment details</h3>
                    <p className="muted">Update timing, status, and notes for this visit.</p>
                  </div>

                  <StatusPill status={selectedAppointment.status} />
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Start time</label>
                    <input
                      type="datetime-local"
                      value={editForm.startTime}
                      onChange={(event) => {
                        const startTime = event.target.value;

                        setEditForm((current) => ({
                          ...current,
                          startTime,
                          endTime: current.endTime || addMinutesToLocalInput(startTime, 30),
                        }));
                      }}
                    />
                  </div>

                  <div className="field">
                    <label>End time</label>
                    <input
                      type="datetime-local"
                      value={editForm.endTime}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Status</label>
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((current) => ({
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

                  <div className="field field-span-2">
                    <label>Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="record-actions">
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
                <h3>Related lead</h3>
                <p className="muted">
                  Source: {selectedLead?.source || "Not added"} • Service:{" "}
                  {selectedLead?.serviceRequested || "Not added"}
                </p>
                <p>{selectedLead?.notes || "No lead notes available."}</p>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
