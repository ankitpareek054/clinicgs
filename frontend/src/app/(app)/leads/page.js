"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatusPill from "../../../components/shared/statusPill";
import {
  addMinutesToLocalInput,
  formatDateTime,
  formatDateTimeInputValue,
  sortByDateAsc,
  sortByDateDesc,
  toIsoFromLocalInput,
} from "../../../lib/date/date";
import {
  appointmentStatusOptions,
  createAppointment,
  listAppointments,
} from "../../../lib/receptionist/appointmentsApi";
import {
  createFollowup,
  listFollowups,
  updateFollowupStatus,
} from "../../../lib/receptionist/followupsApi";
import {
  assignLeadToSelf,
  getLeadById,
  leadPipelineOptions,
  listLeads,
  unassignLeadFromSelf,
  updateLead,
} from "../../../lib/receptionist/leadsApi";
import { listUsers } from "../../../lib/receptionist/usersApi";
import { useAuth } from "../../../providers/sessionProvider";

const PAGE_SIZE = 10;

function buildInitialFilters(user) {
  return {
    search: "",
    pipelineStatus: "",
    source: "",
    assignmentScope: user?.role === "receptionist" ? "mine" : "all",
  };
}

function buildLeadForm(lead) {
  if (!lead) {
    return {
      patientName: "",
      phone: "",
      email: "",
      source: "",
      serviceRequested: "",
      notes: "",
      preferredAppointmentAt: "",
    };
  }

  return {
    patientName: lead.patientName || "",
    phone: lead.phone || "",
    email: lead.email || "",
    source: lead.source || "",
    serviceRequested: lead.serviceRequested || "",
    notes: lead.notes || "",
    preferredAppointmentAt: formatDateTimeInputValue(lead.preferredAppointmentAt),
  };
}

function buildDrawerState() {
  return {
    isLoading: false,
    lead: null,
    followups: [],
    appointments: [],
    leadForm: buildLeadForm(null),
    pipelineStatus: "new",
    followupForm: {
      dueAt: "",
      notes: "",
    },
    appointmentForm: {
      startTime: "",
      endTime: "",
      status: "booked",
      notes: "",
    },
  };
}

export default function LeadsPage() {
  const { user } = useAuth();

  const [filterForm, setFilterForm] = useState(buildInitialFilters(user));
  const [appliedFilters, setAppliedFilters] = useState(buildInitialFilters(user));
  const [page, setPage] = useState(1);

  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [drawer, setDrawer] = useState(buildDrawerState());

  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const next = buildInitialFilters(user);
    setFilterForm(next);
    setAppliedFilters(next);
    setPage(1);
  }, [user]);

  const loadLeadsPage = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [leadRows, userRows] = await Promise.all([
        listLeads({
          visibilityStatus: "active",
          search: appliedFilters.search || undefined,
          pipelineStatus: appliedFilters.pipelineStatus || undefined,
          source: appliedFilters.source || undefined,
        }),
        listUsers({ status: "active" }),
      ]);

      setLeads(leadRows);
      setUsers(userRows);
    } catch (err) {
      setError(err.message || "Could not load leads.");
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    loadLeadsPage();
  }, [loadLeadsPage]);

  const usersById = useMemo(() => {
    return users.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [users]);

  const filteredLeads = useMemo(() => {
    let rows = [...leads];

    if (appliedFilters.assignmentScope === "mine") {
      rows = rows.filter((lead) => Number(lead.assignedToUserId) === Number(user?.id));
    }

    if (appliedFilters.assignmentScope === "unassigned") {
      rows = rows.filter((lead) => !lead.assignedToUserId);
    }

    return sortByDateDesc(rows, (item) => item.createdAt);
  }, [appliedFilters.assignmentScope, leads, user]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedLeads = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, page]);

  const getAssigneeLabel = useCallback(
    (lead) => {
      if (!lead?.assignedToUserId) return "Unassigned";
      return usersById[lead.assignedToUserId]?.fullName || `User #${lead.assignedToUserId}`;
    },
    [usersById]
  );

  const loadLeadDrawer = useCallback(async (leadId) => {
    setDrawer((current) => ({
      ...current,
      isLoading: true,
    }));

    try {
      const [lead, followups, appointments] = await Promise.all([
        getLeadById(leadId),
        listFollowups({ leadId }),
        listAppointments({ leadId }),
      ]);

      setDrawer({
        isLoading: false,
        lead,
        followups: sortByDateAsc(followups, (item) => item.dueAt),
        appointments: sortByDateAsc(appointments, (item) => item.startTime),
        leadForm: buildLeadForm(lead),
        pipelineStatus: lead.pipelineStatus || "new",
        followupForm: {
          dueAt: "",
          notes: "",
        },
        appointmentForm: {
          startTime: "",
          endTime: "",
          status: "booked",
          notes: "",
        },
      });
    } catch (err) {
      setDrawer(buildDrawerState());
      setSelectedLeadId(null);
      setError(err.message || "Could not load lead details.");
    }
  }, []);

  async function openLeadDrawer(leadId) {
    setSelectedLeadId(leadId);
    await loadLeadDrawer(leadId);
  }

  function closeLeadDrawer() {
    setSelectedLeadId(null);
    setDrawer(buildDrawerState());
  }

  function updateLeadForm(field, value) {
    setDrawer((current) => ({
      ...current,
      leadForm: {
        ...current.leadForm,
        [field]: value,
      },
    }));
  }

  function updateFollowupForm(field, value) {
    setDrawer((current) => ({
      ...current,
      followupForm: {
        ...current.followupForm,
        [field]: value,
      },
    }));
  }

  function updateAppointmentForm(field, value) {
    setDrawer((current) => ({
      ...current,
      appointmentForm: {
        ...current.appointmentForm,
        [field]: value,
      },
    }));
  }

  async function handleAssignToggle(lead) {
    const isMine = Number(lead.assignedToUserId) === Number(user?.id);

    setBusyKey(`assign-${lead.id}`);
    setError("");
    setNotice("");

    try {
      if (isMine) {
        await unassignLeadFromSelf(lead.id);
        setNotice("Lead unassigned from you.");
      } else {
        await assignLeadToSelf(lead.id);
        setNotice("Lead assigned to you.");
      }

      await loadLeadsPage();

      if (selectedLeadId === lead.id) {
        await loadLeadDrawer(lead.id);
      }
    } catch (err) {
      setError(err.message || "Could not update assignment.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSaveLeadProfile() {
    if (!selectedLeadId) return;

    setBusyKey("drawer-save-profile");
    setError("");
    setNotice("");

    try {
      await updateLead(selectedLeadId, {
        patientName: drawer.leadForm.patientName,
        phone: drawer.leadForm.phone,
        email: drawer.leadForm.email,
        source: drawer.leadForm.source,
        serviceRequested: drawer.leadForm.serviceRequested || null,
        notes: drawer.leadForm.notes || null,
        preferredAppointmentAt: drawer.leadForm.preferredAppointmentAt
          ? toIsoFromLocalInput(drawer.leadForm.preferredAppointmentAt)
          : null,
      });

      setNotice("Lead profile updated.");
      await loadLeadsPage();
      await loadLeadDrawer(selectedLeadId);
    } catch (err) {
      setError(err.message || "Could not update lead profile.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSavePipeline() {
    if (!selectedLeadId) return;

    setBusyKey("drawer-save-pipeline");
    setError("");
    setNotice("");

    try {
      await updateLead(selectedLeadId, {
        pipelineStatus: drawer.pipelineStatus,
      });

      setNotice("Lead pipeline updated.");
      await loadLeadsPage();
      await loadLeadDrawer(selectedLeadId);
    } catch (err) {
      setError(err.message || "Could not update pipeline.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleCreateFollowup() {
    if (!selectedLeadId) return;

    if (!drawer.followupForm.dueAt) {
      setError("Please choose a follow-up date and time first.");
      return;
    }

    setBusyKey("drawer-create-followup");
    setError("");
    setNotice("");

    try {
      await createFollowup({
        leadId: selectedLeadId,
        dueAt: toIsoFromLocalInput(drawer.followupForm.dueAt),
        notes: drawer.followupForm.notes || null,
        outcome: null,
      });

      setNotice("Follow-up created.");
      await loadLeadsPage();
      await loadLeadDrawer(selectedLeadId);
    } catch (err) {
      setError(err.message || "Could not create follow-up.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleFollowupStatus(followupId, status) {
    setBusyKey(`drawer-followup-${followupId}`);
    setError("");
    setNotice("");

    try {
      await updateFollowupStatus(followupId, {
        status,
      });

      setNotice(`Follow-up marked as ${status}.`);
      await loadLeadsPage();
      await loadLeadDrawer(selectedLeadId);
    } catch (err) {
      setError(err.message || "Could not update follow-up status.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleCreateAppointment() {
    if (!selectedLeadId) return;

    if (!drawer.appointmentForm.startTime || !drawer.appointmentForm.endTime) {
      setError("Please choose appointment start and end time first.");
      return;
    }

    setBusyKey("drawer-create-appointment");
    setError("");
    setNotice("");

    try {
      await createAppointment({
        leadId: selectedLeadId,
        startTime: toIsoFromLocalInput(drawer.appointmentForm.startTime),
        endTime: toIsoFromLocalInput(drawer.appointmentForm.endTime),
        status: drawer.appointmentForm.status,
        notes: drawer.appointmentForm.notes || null,
      });

      setNotice("Appointment created.");
      await loadLeadsPage();
      await loadLeadDrawer(selectedLeadId);
    } catch (err) {
      setError(err.message || "Could not create appointment.");
    } finally {
      setBusyKey("");
    }
  }

  const selectedLeadAssignee = drawer.lead ? getAssigneeLabel(drawer.lead) : "—";
  const showingFrom = filteredLeads.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredLeads.length);

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Leads</h1>
        <p className="muted">
          This is the receptionist workbench. You can search leads, manage status,
          assign yourself, schedule follow-ups, and book appointments without leaving the page.
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
            <h2>Lead filters</h2>
            <p className="muted">Use backend filters first, then local assignment scope and pagination.</p>
          </div>
        </div>

        <form
          className="stack-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedFilters(filterForm);
            setPage(1);
          }}
        >
          <div className="form-grid">
            <div className="field">
              <label htmlFor="lead-search">Search</label>
              <input
                id="lead-search"
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

            <div className="field">
              <label htmlFor="lead-status-filter">Pipeline status</label>
              <select
                id="lead-status-filter"
                value={filterForm.pipelineStatus}
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    pipelineStatus: event.target.value,
                  }))
                }
              >
                <option value="">All statuses</option>
                {leadPipelineOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="lead-source-filter">Source</label>
              <input
                id="lead-source-filter"
                type="text"
                value={filterForm.source}
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
                placeholder="Google Ads, Walk-in, Front Desk"
              />
            </div>

            <div className="field">
              <label htmlFor="lead-assignment-filter">Assignment scope</label>
              <select
                id="lead-assignment-filter"
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
          </div>

          <div className="record-actions">
            <button type="submit" className="primary-button">
              Apply filters
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={loadLeadsPage}
            >
              Refresh
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Lead list</h2>
            <p className="muted">
              {isLoading
                ? "Loading leads…"
                : `Showing ${showingFrom}-${showingTo} of ${filteredLeads.length} leads`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="muted">Loading leads…</p>
        ) : filteredLeads.length === 0 ? (
          <div className="empty-state">No leads matched your current filters.</div>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Status</th>
                    <th>Assignee</th>
                    <th>Phone</th>
                    <th>Source</th>
                    <th>Next follow-up</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedLeads.map((lead) => {
                    const isMine = Number(lead.assignedToUserId) === Number(user?.id);
                    const isUnassigned = !lead.assignedToUserId;

                    return (
                      <tr key={lead.id}>
                        <td>
                          <div className="table-primary-cell">
                            <strong>{lead.patientName}</strong>
                            <span className="muted">{lead.email || "No email"}</span>
                          </div>
                        </td>

                        <td>
                          <StatusPill status={lead.pipelineStatus} />
                        </td>

                        <td>{getAssigneeLabel(lead)}</td>
                        <td>{lead.phone}</td>
                        <td>{lead.source}</td>
                        <td>{lead.nextFollowupAt ? formatDateTime(lead.nextFollowupAt) : "Not scheduled"}</td>

                        <td>
                          <div className="record-actions">
                            {(isMine || isUnassigned) && (
                              <button
                                type="button"
                                className="secondary-button compact-button"
                                disabled={busyKey === `assign-${lead.id}`}
                                onClick={() => handleAssignToggle(lead)}
                              >
                                {isMine ? "Unassign" : "Assign to me"}
                              </button>
                            )}

                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={() => openLeadDrawer(lead.id)}
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

            <div className="pagination-bar">
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>

              <span className="muted">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="secondary-button compact-button"
                disabled={page === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      {selectedLeadId && (
        <div className="drawer-backdrop" onClick={closeLeadDrawer}>
          <aside
            className="drawer-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <h2>{drawer.lead?.patientName || "Lead details"}</h2>
                <p className="muted">
                  {drawer.lead
                    ? `${drawer.lead.phone} • ${selectedLeadAssignee}`
                    : "Loading details…"}
                </p>
              </div>

              <button
                type="button"
                className="secondary-button compact-button"
                onClick={closeLeadDrawer}
              >
                Close
              </button>
            </div>

            {drawer.isLoading || !drawer.lead ? (
              <p className="muted">Loading lead details…</p>
            ) : (
              <div className="stack">
                <section className="page-card drawer-card">
                  <div className="section-heading">
                    <div>
                      <h3>Lead overview</h3>
                      <p className="muted">Basic lead profile you can correct from the front desk.</p>
                    </div>

                    <StatusPill status={drawer.lead.pipelineStatus} />
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label>Patient name</label>
                      <input
                        type="text"
                        value={drawer.leadForm.patientName}
                        onChange={(event) => updateLeadForm("patientName", event.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Phone</label>
                      <input
                        type="text"
                        value={drawer.leadForm.phone}
                        onChange={(event) => updateLeadForm("phone", event.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Email</label>
                      <input
                        type="email"
                        value={drawer.leadForm.email}
                        onChange={(event) => updateLeadForm("email", event.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Source</label>
                      <input
                        type="text"
                        value={drawer.leadForm.source}
                        onChange={(event) => updateLeadForm("source", event.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Service requested</label>
                      <input
                        type="text"
                        value={drawer.leadForm.serviceRequested}
                        onChange={(event) =>
                          updateLeadForm("serviceRequested", event.target.value)
                        }
                      />
                    </div>

                    <div className="field">
                      <label>Preferred appointment</label>
                      <input
                        type="datetime-local"
                        value={drawer.leadForm.preferredAppointmentAt}
                        onChange={(event) =>
                          updateLeadForm("preferredAppointmentAt", event.target.value)
                        }
                      />
                    </div>

                    <div className="field field-span-2">
                      <label>Notes</label>
                      <textarea
                        value={drawer.leadForm.notes}
                        onChange={(event) => updateLeadForm("notes", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="record-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busyKey === "drawer-save-profile"}
                      onClick={handleSaveLeadProfile}
                    >
                      Save lead profile
                    </button>

                    {(Number(drawer.lead.assignedToUserId) === Number(user?.id) ||
                      !drawer.lead.assignedToUserId) && (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busyKey === `assign-${drawer.lead.id}`}
                        onClick={() => handleAssignToggle(drawer.lead)}
                      >
                        {Number(drawer.lead.assignedToUserId) === Number(user?.id)
                          ? "Unassign from me"
                          : "Assign to me"}
                      </button>
                    )}
                  </div>
                </section>

                <section className="page-card drawer-card">
                  <div className="section-heading">
                    <div>
                      <h3>Pipeline and next action</h3>
                      <p className="muted">Move the lead through the clinic pipeline.</p>
                    </div>
                  </div>

                  <div className="record-actions">
                    <select
                      value={drawer.pipelineStatus}
                      onChange={(event) =>
                        setDrawer((current) => ({
                          ...current,
                          pipelineStatus: event.target.value,
                        }))
                      }
                    >
                      {leadPipelineOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="primary-button"
                      disabled={busyKey === "drawer-save-pipeline"}
                      onClick={handleSavePipeline}
                    >
                      Save pipeline
                    </button>
                  </div>

                  <p className="muted">
                    Current assignee: {selectedLeadAssignee} • Next follow-up:{" "}
                    {drawer.lead.nextFollowupAt
                      ? formatDateTime(drawer.lead.nextFollowupAt)
                      : "Not scheduled"}
                  </p>
                </section>

                <section className="page-card drawer-card">
                  <div className="section-heading">
                    <div>
                      <h3>Follow-ups</h3>
                      <p className="muted">Create the next callback task and close old ones.</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label>Due at</label>
                      <input
                        type="datetime-local"
                        value={drawer.followupForm.dueAt}
                        onChange={(event) => updateFollowupForm("dueAt", event.target.value)}
                      />
                    </div>

                    <div className="field field-span-2">
                      <label>Notes</label>
                      <textarea
                        value={drawer.followupForm.notes}
                        onChange={(event) => updateFollowupForm("notes", event.target.value)}
                        placeholder="What should happen on this follow-up?"
                      />
                    </div>
                  </div>

                  <div className="record-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busyKey === "drawer-create-followup"}
                      onClick={handleCreateFollowup}
                    >
                      Create follow-up
                    </button>
                  </div>

                  <div className="records-list">
                    {drawer.followups.length === 0 ? (
                      <div className="empty-state">No follow-ups for this lead yet.</div>
                    ) : (
                      drawer.followups.map((followup) => (
                        <article key={followup.id} className="record-card">
                          <div className="record-main">
                            <div className="record-title-row">
                              <h3>{formatDateTime(followup.dueAt)}</h3>
                              <StatusPill status={followup.status} />
                            </div>

                            <p className="muted">
                              {followup.notes || "No follow-up note added yet."}
                            </p>
                          </div>

                          {followup.status === "pending" && (
                            <div className="record-actions">
                              <button
                                type="button"
                                className="primary-button compact-button"
                                disabled={busyKey === `drawer-followup-${followup.id}`}
                                onClick={() => handleFollowupStatus(followup.id, "done")}
                              >
                                Mark done
                              </button>

                              <button
                                type="button"
                                className="secondary-button compact-button"
                                disabled={busyKey === `drawer-followup-${followup.id}`}
                                onClick={() => handleFollowupStatus(followup.id, "skipped")}
                              >
                                Skip
                              </button>
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="page-card drawer-card">
                  <div className="section-heading">
                    <div>
                      <h3>Appointments</h3>
                      <p className="muted">Book the visit directly from the lead.</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label>Start time</label>
                      <input
                        type="datetime-local"
                        value={drawer.appointmentForm.startTime}
                        onChange={(event) => {
                          const startTime = event.target.value;

                          updateAppointmentForm("startTime", startTime);

                          if (!drawer.appointmentForm.endTime) {
                            updateAppointmentForm(
                              "endTime",
                              addMinutesToLocalInput(startTime, 30)
                            );
                          }
                        }}
                      />
                    </div>

                    <div className="field">
                      <label>End time</label>
                      <input
                        type="datetime-local"
                        value={drawer.appointmentForm.endTime}
                        onChange={(event) => updateAppointmentForm("endTime", event.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Status</label>
                      <select
                        value={drawer.appointmentForm.status}
                        onChange={(event) => updateAppointmentForm("status", event.target.value)}
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
                        value={drawer.appointmentForm.notes}
                        onChange={(event) => updateAppointmentForm("notes", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="record-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busyKey === "drawer-create-appointment"}
                      onClick={handleCreateAppointment}
                    >
                      Create appointment
                    </button>
                  </div>

                  <div className="records-list">
                    {drawer.appointments.length === 0 ? (
                      <div className="empty-state">No appointments for this lead yet.</div>
                    ) : (
                      drawer.appointments.map((appointment) => (
                        <article key={appointment.id} className="record-card">
                          <div className="record-main">
                            <div className="record-title-row">
                              <h3>{formatDateTime(appointment.startTime)}</h3>
                              <StatusPill status={appointment.status} />
                            </div>

                            <div className="record-meta">
                              <span>Ends: {formatDateTime(appointment.endTime)}</span>
                              <span>Created by user #{appointment.createdByUserId}</span>
                            </div>

                            <p className="muted">
                              {appointment.notes || "No appointment note added yet."}
                            </p>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
