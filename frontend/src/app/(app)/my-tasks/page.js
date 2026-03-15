"use client";



import Link from "next/link";

import { useCallback, useEffect, useMemo, useState } from "react";

import StatusPill from "../../../components/shared/statusPill";

import {

  addMinutesToLocalInput,

  formatDateTime,

  formatDateTimeInputValue,

  isDateToday,

  sortByDateAsc,

  toIsoFromLocalInput,

} from "../../../lib/date/date";

import useAutoDismissBanner from "../../../hooks/useAutoDismissBanner";

import {

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

  listLeads,

  updateLead,

} from "../../../lib/receptionist/leadsApi";

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



function getDefaultNextFollowupInput() {

  const date = new Date();

  date.setHours(date.getHours() + 2);

  date.setMinutes(0);

  date.setSeconds(0);

  date.setMilliseconds(0);

  return formatDateTimeInputValue(date.toISOString());

}



function getDefaultAppointmentStartInput(lead) {

  if (lead?.preferredAppointmentAt) {

    return formatDateTimeInputValue(lead.preferredAppointmentAt);

  }



  const date = new Date();

  date.setHours(date.getHours() + 1);

  date.setMinutes(0);

  date.setSeconds(0);

  date.setMilliseconds(0);

  return formatDateTimeInputValue(date.toISOString());

}



function buildTaskForm(lead) {

  const nextFollowupLocal = getDefaultNextFollowupInput();

  const appointmentStartLocal = getDefaultAppointmentStartInput(lead);

  const appointmentEndLocal = addMinutesToLocalInput(appointmentStartLocal, 30);



  const nextFollowupParts = splitLocalDateTimeValue(nextFollowupLocal);

  const appointmentStartParts = splitLocalDateTimeValue(appointmentStartLocal);

  const appointmentEndParts = splitLocalDateTimeValue(appointmentEndLocal);



  return {

    outcomeNotes: "",

    nextFollowupDate: nextFollowupParts.date,

    nextFollowupTime: nextFollowupParts.time,

    appointmentStartDate: appointmentStartParts.date,

    appointmentStartTime: appointmentStartParts.time,

    appointmentEndDate: appointmentEndParts.date,

    appointmentEndTime: appointmentEndParts.time,

    appointmentNotes: "",

  };

}



function getLeadInitials(name) {

  if (!name) return "MT";



  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);



  if (!parts.length) return "MT";



  return parts.map((part) => part[0]?.toUpperCase() || "").join("");

}



function TaskCardArrowLink({ href, label }) {

  return (

    <Link

      href={href}

      className="task-overview-arrow"

      aria-label={label}

      title={label}

    >

      <svg

        viewBox="0 0 20 20"

        fill="none"

        aria-hidden="true"

        className="task-overview-arrow-icon"

      >

        <path

          d="M7 4L13 10L7 16"

          stroke="currentColor"

          strokeWidth="1.8"

          strokeLinecap="round"

          strokeLinejoin="round"

        />

      </svg>

    </Link>

  );

}



export default function MyTasksPage() {

  const { user } = useAuth();



  const [activeLeads, setActiveLeads] = useState([]);

  const [followups, setFollowups] = useState([]);

  const [appointments, setAppointments] = useState([]);

  const [isLoading, setIsLoading] = useState(true);



  const [selectedFollowup, setSelectedFollowup] = useState(null);

  const [taskForm, setTaskForm] = useState(null);



  const [busyKey, setBusyKey] = useState("");

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");



  useAutoDismissBanner({

    error,

    notice,

    setError,

    setNotice,

  });



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

        ? activeLeads.filter(

            (lead) => Number(lead.assignedToUserId) === Number(user.id)

          )

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



  const todayAppointments = useMemo(() => {

    return sortByDateAsc(

      appointments.filter((appointment) => {

        const isRelevantLead = responsibleLeadIds.has(appointment.leadId);

        const isUpcoming = new Date(appointment.startTime).getTime() >= Date.now();

        const isToday = isDateToday(appointment.startTime);

        const isOpenStatus = ["booked", "rescheduled"].includes(appointment.status);



        return isRelevantLead && isUpcoming && isToday && isOpenStatus;

      }),

      (item) => item.startTime

    );

  }, [appointments, responsibleLeadIds]);



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



  const priorityNow = useMemo(() => {

    const merged = [

      ...overdueFollowups.map((item) => ({ ...item, urgencyLabel: "Overdue" })),

      ...todayFollowups.map((item) => ({ ...item, urgencyLabel: "Due today" })),

    ];



    return merged.slice(0, 5);

  }, [overdueFollowups, todayFollowups]);



  const selectedLead = selectedFollowup ? leadsById[selectedFollowup.leadId] : null;



  function getLeadLabel(leadId) {

    return leadsById[leadId]?.patientName || `Lead #${leadId}`;

  }



  function getLeadPhone(leadId) {

    return leadsById[leadId]?.phone || "No phone";

  }



  function openTaskDrawer(followup) {

    const lead = leadsById[followup.leadId] || null;

    setSelectedFollowup(followup);

    setTaskForm(buildTaskForm(lead));

  }



  function closeTaskDrawer() {

    setSelectedFollowup(null);

    setTaskForm(null);

  }



  function updateTaskForm(field, value) {

    setTaskForm((current) => ({

      ...current,

      [field]: value,

    }));

  }



  function buildNextFollowupLocalValue() {

    return joinLocalDateTimeValue(

      taskForm?.nextFollowupDate,

      taskForm?.nextFollowupTime

    );

  }



  function buildAppointmentStartLocalValue() {

    return joinLocalDateTimeValue(

      taskForm?.appointmentStartDate,

      taskForm?.appointmentStartTime

    );

  }



  function buildAppointmentEndLocalValue() {

    return joinLocalDateTimeValue(

      taskForm?.appointmentEndDate,

      taskForm?.appointmentEndTime

    );

  }



  async function handleFollowupAction(followupId, status) {

    setBusyKey(`followup-${followupId}`);

    setError("");

    setNotice("");



    try {

      await updateFollowupStatus(followupId, { status });

      setNotice(`Follow-up marked as ${status}.`);



      if (selectedFollowup?.id === followupId) {

        closeTaskDrawer();

      }



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



  async function handleTaskOutcome(kind) {

    if (!selectedFollowup || !selectedLead || !taskForm) return;



    const outcomeNotes = taskForm.outcomeNotes.trim() || null;

    const nextFollowupLocal = buildNextFollowupLocalValue();



    if (

      (kind === "no_answer" || kind === "callback_requested") &&

      !nextFollowupLocal

    ) {

      setError("Please choose both next follow-up date and time first.");

      return;

    }



    setBusyKey(`task-outcome-${kind}`);

    setError("");

    setNotice("");



    try {

      if (kind === "no_answer") {

        await updateFollowupStatus(selectedFollowup.id, {

          status: "done",

          outcome: "No answer",

          notes: outcomeNotes,

        });



        await createFollowup({

          leadId: selectedFollowup.leadId,

          dueAt: toIsoFromLocalInput(nextFollowupLocal),

          notes: outcomeNotes || "Retry patient contact.",

          outcome: "Retry contact",

        });



        setNotice("No-answer outcome saved and next follow-up scheduled.");

      }



      if (kind === "callback_requested") {

        await updateFollowupStatus(selectedFollowup.id, {

          status: "done",

          outcome: "Callback requested",

          notes: outcomeNotes,

        });



        await updateLead(selectedLead.id, {

          pipelineStatus: "contacted",

        });



        await createFollowup({

          leadId: selectedFollowup.leadId,

          dueAt: toIsoFromLocalInput(nextFollowupLocal),

          notes: outcomeNotes || "Patient requested a callback.",

          outcome: "Callback requested",

        });



        setNotice("Callback saved and next follow-up scheduled.");

      }



      if (kind === "not_interested") {

        await updateFollowupStatus(selectedFollowup.id, {

          status: "done",

          outcome: "Not interested",

          notes: outcomeNotes,

        });



        await updateLead(selectedLead.id, {

          pipelineStatus: "not_interested",

        });



        setNotice("Lead marked as not interested.");

      }



      if (kind === "done") {

        await updateFollowupStatus(selectedFollowup.id, {

          status: "done",

          outcome: outcomeNotes ? "Completed task" : null,

          notes: outcomeNotes,

        });



        setNotice("Follow-up marked as done.");

      }



      if (kind === "skipped") {

        await updateFollowupStatus(selectedFollowup.id, {

          status: "skipped",

          outcome: outcomeNotes ? "Skipped" : null,

          notes: outcomeNotes,

        });



        setNotice("Follow-up skipped.");

      }



      closeTaskDrawer();

      await loadPage();

    } catch (err) {

      setError(err.message || "Could not save task outcome.");

    } finally {

      setBusyKey("");

    }

  }



  async function handleBookAppointment() {

    if (!selectedFollowup || !selectedLead || !taskForm) return;



    const appointmentStartLocal = buildAppointmentStartLocalValue();

    const appointmentEndLocal = buildAppointmentEndLocalValue();



    if (!appointmentStartLocal || !appointmentEndLocal) {

      setError("Please choose appointment start and end date/time first.");

      return;

    }



    setBusyKey("task-book-appointment");

    setError("");

    setNotice("");



    try {

      const combinedNotes =

        taskForm.appointmentNotes.trim() || taskForm.outcomeNotes.trim() || null;



      await updateFollowupStatus(selectedFollowup.id, {

        status: "done",

        outcome: "Appointment booked",

        notes: combinedNotes,

      });



      await updateLead(selectedLead.id, {

        pipelineStatus: "booked",

        preferredAppointmentAt: toIsoFromLocalInput(appointmentStartLocal),

      });



      await createAppointment({

        leadId: selectedFollowup.leadId,

        startTime: toIsoFromLocalInput(appointmentStartLocal),

        endTime: toIsoFromLocalInput(appointmentEndLocal),

        status: "booked",

        notes: combinedNotes,

      });



      setNotice("Appointment booked from My Tasks.");

      closeTaskDrawer();

      await loadPage();

    } catch (err) {

      setError(err.message || "Could not book appointment.");

    } finally {

      setBusyKey("");

    }

  }


  return (

    <div className="stack">

      <div className="page-header">

        <h1>My Tasks</h1>

        <p className="muted">

          This is the receptionist launchpad. See what needs attention first, then

          jump into the right workflow quickly.

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

            <h2>Today at a glance</h2>

            <p className="muted">

              Fast view of the queues that need action today.

            </p>

          </div>



          <div className="record-actions">

            <button

              type="button"

              className="secondary-button"

              onClick={loadPage}

            >

              Refresh

            </button>

          </div>

        </div>



        <div className="task-overview-grid">

          <article className="task-overview-tile">

            <div className="task-overview-copy">

              <span className="task-overview-label">Overdue follow-ups</span>

              <strong>{overdueFollowups.length}</strong>

              <p className="muted">Needs action first</p>

            </div>



            <div className="task-overview-footer">

              <TaskCardArrowLink

                href="/followups?bucket=overdue"

                label="Open overdue follow-ups"

              />

            </div>

          </article>



          <article className="task-overview-tile">

            <div className="task-overview-copy">

              <span className="task-overview-label">Due today</span>

              <strong>{todayFollowups.length}</strong>

              <p className="muted">Still on today’s clock</p>

            </div>



            <div className="task-overview-footer">

              <TaskCardArrowLink

                href="/followups?bucket=today"

                label="Open follow-ups due today"

              />

            </div>

          </article>



          <article className="task-overview-tile">

            <div className="task-overview-copy">

              <span className="task-overview-label">Today’s appointments</span>

              <strong>{todayAppointments.length}</strong>

              <p className="muted">Scheduled for today</p>

            </div>



            <div className="task-overview-footer">

              <TaskCardArrowLink

                href="/appointments"

                label="Open appointments"

              />

            </div>

          </article>



          <article className="task-overview-tile">

            <div className="task-overview-copy">

              <span className="task-overview-label">Pickup leads</span>

              <strong>{pickupLeads.length}</strong>

              <p className="muted">Unassigned opportunities</p>

            </div>



            <div className="task-overview-footer">

              <TaskCardArrowLink

                href="/leads?scope=unassigned"

                label="Open unassigned leads"

              />

            </div>

          </article>

        </div>

      </section>



      <section className="task-main-grid">

        <section className="page-card task-column-card">

          <div className="section-heading">

            <div>

              <h2>Priority now</h2>

              <p className="muted">

                Overdue and due-today follow-ups in one focused queue.

              </p>

            </div>



            <div className="record-actions">

              <Link href="/followups" className="secondary-button">

                View all

              </Link>

            </div>

          </div>



          {isLoading ? (

            <p className="muted">Loading tasks…</p>

          ) : priorityNow.length === 0 ? (

            <div className="empty-state">Nothing urgent is waiting right now.</div>

          ) : (

            <div className="records-list compact-records-list">

              {priorityNow.map((followup) => {

                const lead = leadsById[followup.leadId];

                const urgencyLabel = followup.urgencyLabel || "Due";



                return (

                  <article key={followup.id} className="record-card compact-record-card">

                    <div className="record-main">

                      <div className="record-title-row">

                        <h3>{getLeadLabel(followup.leadId)}</h3>

                        <div className="task-inline-badges">

                          <span

                            className={

                              urgencyLabel === "Overdue"

                                ? "task-urgency-badge task-urgency-badge-overdue"

                                : "task-urgency-badge"

                            }

                          >

                            {urgencyLabel}

                          </span>

                          <StatusPill status={followup.status} />

                        </div>

                      </div>



                      <div className="record-meta">

                        <span>Due: {formatDateTime(followup.dueAt)}</span>

                        <span>{getLeadPhone(followup.leadId)}</span>

                        <span>{lead?.source || "No source"}</span>

                      </div>



                      <p className="muted">

                        {followup.notes || "No follow-up note added yet."}

                      </p>

                    </div>



                    <div className="record-actions">

                      <button

                        type="button"

                        className="primary-button compact-button"

                        onClick={() => openTaskDrawer(followup)}

                      >

                        Work task

                      </button>



                      <button

                        type="button"

                        className="secondary-button compact-button"

                        disabled={busyKey === `followup-${followup.id}`}

                        onClick={() => handleFollowupAction(followup.id, "done")}

                      >

                        Done

                      </button>

                    </div>

                  </article>

                );

              })}

            </div>

          )}

        </section>



        <section className="page-card task-column-card">

          <div className="section-heading">

            <div>

              <h2>Today’s appointments</h2>

              <p className="muted">

                Upcoming visits that are already on today’s schedule.

              </p>

            </div>



            <div className="record-actions">

              <Link href="/appointments" className="secondary-button">

                View all

              </Link>

            </div>

          </div>



          {isLoading ? (

            <p className="muted">Loading appointments…</p>

          ) : todayAppointments.length === 0 ? (

            <div className="empty-state">No appointments are scheduled for later today.</div>

          ) : (

            <div className="task-mini-grid">

              {todayAppointments.slice(0, 6).map((appointment) => (

                <article key={appointment.id} className="task-mini-card">

                  <div className="task-mini-card-head">

                    <div className="task-mini-avatar">

                      {getLeadInitials(getLeadLabel(appointment.leadId))}

                    </div>



                    <div className="task-mini-copy">

                      <strong>{getLeadLabel(appointment.leadId)}</strong>

                      <span className="muted">{getLeadPhone(appointment.leadId)}</span>

                    </div>

                  </div>



                  <div className="task-mini-meta">

                    <span>{formatDateTime(appointment.startTime)}</span>

                    <span>Ends: {formatDateTime(appointment.endTime)}</span>

                  </div>



                  <div className="task-mini-footer">

                    <StatusPill status={appointment.status} />

                    <Link

                      href="/appointments"

                      className="secondary-button compact-button"

                    >

                      Open

                    </Link>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

      </section>



      <section className="page-card">

        <div className="section-heading">

          <div>

            <h2>Upcoming appointments</h2>

            <p className="muted">A wider preview of what is coming next.</p>

          </div>



          <div className="record-actions">

            <Link href="/appointments" className="secondary-button">

              View all

            </Link>

          </div>

        </div>



        {isLoading ? (

          <p className="muted">Loading appointments…</p>

        ) : upcomingAppointments.length === 0 ? (

          <div className="empty-state">No upcoming appointments found.</div>

        ) : (

          <div className="records-list compact-records-list">

            {upcomingAppointments.slice(0, 5).map((appointment) => (

              <article key={appointment.id} className="record-card compact-record-card">

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



                <div className="record-actions">

                  <Link

                    href="/appointments"

                    className="secondary-button compact-button"

                  >

                    Open

                  </Link>

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

              <p className="muted">

                Fresh unassigned leads you can grab and work on.

              </p>

            </div>



            <div className="record-actions">

              <Link href="/leads?scope=unassigned" className="secondary-button">

                View all

              </Link>

            </div>

          </div>



          {isLoading ? (

            <p className="muted">Loading pickup leads…</p>

          ) : pickupLeads.length === 0 ? (

            <div className="empty-state">No unassigned leads are waiting right now.</div>

          ) : (

            <div className="task-mini-grid pickup-mini-grid">

              {pickupLeads.slice(0, 4).map((lead) => (

                <article key={lead.id} className="task-mini-card">

                  <div className="task-mini-card-head">

                    <div className="task-mini-avatar">

                      {getLeadInitials(lead.patientName)}

                    </div>



                    <div className="task-mini-copy">

                      <strong>{lead.patientName}</strong>

                      <span className="muted">{lead.phone}</span>

                    </div>

                  </div>



                  <div className="task-mini-meta">

                    <span>{lead.email || "No email"}</span>

                    <span>{lead.source || "No source"}</span>

                    <span>{lead.serviceRequested || "No service added"}</span>

                  </div>



                  <div className="task-mini-footer">

                    <StatusPill status={lead.pipelineStatus} />



                    <button

                      type="button"

                      className="primary-button compact-button"

                      disabled={busyKey === `lead-${lead.id}`}

                      onClick={() => handlePickupLead(lead.id)}

                    >

                      Pickup

                    </button>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

      )}



      {selectedFollowup && selectedLead && taskForm && (

        <div className="drawer-backdrop" onClick={closeTaskDrawer}>

          <aside

            className="drawer-panel my-tasks-drawer"

            onClick={(event) => event.stopPropagation()}

          >

            <div className="drawer-header my-tasks-drawer-header">

              <div className="my-tasks-drawer-header-main">

                <div className="my-tasks-drawer-avatar">

                  {getLeadInitials(selectedLead.patientName)}

                </div>



                <div className="my-tasks-drawer-copy">

                  <h2>{selectedLead.patientName}</h2>

                  <p className="muted">

                    {selectedLead.phone} • Due {formatDateTime(selectedFollowup.dueAt)}

                  </p>

                </div>

              </div>



              <button

                type="button"

                className="secondary-button compact-button"

                onClick={closeTaskDrawer}

              >

                Close

              </button>

            </div>



            <div className="stack my-tasks-drawer-stack">

              <section className="page-card drawer-card">

                <div className="section-heading">

                  <div>

                    <h3>Follow-up summary</h3>

                    <p className="muted">

                      Capture the call result and choose the next step.

                    </p>

                  </div>



                  <StatusPill status={selectedFollowup.status} />

                </div>



                <div className="task-summary-grid">

                  <div className="task-summary-item">

                    <span className="task-overview-label">Phone</span>

                    <strong>{selectedLead.phone || "No phone"}</strong>

                  </div>



                  <div className="task-summary-item">

                    <span className="task-overview-label">Source</span>

                    <strong>{selectedLead.source || "Not added"}</strong>

                  </div>



                  <div className="task-summary-item">

                    <span className="task-overview-label">Service</span>

                    <strong>{selectedLead.serviceRequested || "Not added"}</strong>

                  </div>



                  <div className="task-summary-item">

                    <span className="task-overview-label">Current due</span>

                    <strong>{formatDateTime(selectedFollowup.dueAt)}</strong>

                  </div>

                </div>



                <div className="task-note-panel">

                  <span className="task-overview-label">Current note</span>

                  <p>{selectedFollowup.notes || "No follow-up note added yet."}</p>

                </div>

              </section>



              <section className="page-card drawer-card">

                <div className="section-heading">

                  <div>

                    <h3>Call result</h3>

                    <p className="muted">

                      Save a quick outcome or move straight to booking.

                    </p>

                  </div>

                </div>



                <div className="form-grid">

                  <div className="field field-span-2">

                    <label>Outcome notes</label>

                    <textarea

                      value={taskForm.outcomeNotes}

                      onChange={(event) =>

                        updateTaskForm("outcomeNotes", event.target.value)

                      }

                      placeholder="What happened on the call?"

                    />

                  </div>

                </div>



                <div className="record-actions task-outcome-actions">

                  <button

                    type="button"

                    className="secondary-button"

                    disabled={busyKey === "task-outcome-no_answer"}

                    onClick={() => handleTaskOutcome("no_answer")}

                  >

                    No answer

                  </button>



                  <button

                    type="button"

                    className="secondary-button"

                    disabled={busyKey === "task-outcome-callback_requested"}

                    onClick={() => handleTaskOutcome("callback_requested")}

                  >

                    Callback requested

                  </button>



                  <button

                    type="button"

                    className="secondary-button"

                    disabled={busyKey === "task-outcome-not_interested"}

                    onClick={() => handleTaskOutcome("not_interested")}

                  >

                    Not interested

                  </button>



                  <button

                    type="button"

                    className="secondary-button"

                    disabled={busyKey === "task-outcome-done"}

                    onClick={() => handleTaskOutcome("done")}

                  >

                    Mark done

                  </button>



                  <button

                    type="button"

                    className="secondary-button"

                    disabled={busyKey === "task-outcome-skipped"}

                    onClick={() => handleTaskOutcome("skipped")}

                  >

                    Skip

                  </button>

                </div>

              </section>



              <section className="page-card drawer-card">

                <div className="section-heading">

                  <div>

                    <h3>Schedule next follow-up</h3>

                    <p className="muted">

                      Use this for no-answer or callback outcomes.

                    </p>

                  </div>

                </div>



                <div className="form-grid">

                  <div className="field">

                    <label>Next follow-up date</label>

                    <input

                      type="date"

                      value={taskForm.nextFollowupDate}

                      onChange={(event) =>

                        updateTaskForm("nextFollowupDate", event.target.value)

                      }

                    />

                  </div>



                  <div className="field">

                    <label>Next follow-up time</label>

                    <select

                      value={taskForm.nextFollowupTime}

                      onChange={(event) =>

                        updateTaskForm("nextFollowupTime", event.target.value)

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

              </section>



              <section className="page-card drawer-card">

                <div className="section-heading">

                  <div>

                    <h3>Book appointment</h3>

                    <p className="muted">

                      Book directly from the task when the patient confirms.

                    </p>

                  </div>

                </div>



                <div className="task-booking-grid">

                  <div className="task-booking-block">

                    <h4>Start</h4>



                    <div className="form-grid">

                      <div className="field">

                        <label>Date</label>

                        <input

                          type="date"

                          value={taskForm.appointmentStartDate}

                          onChange={(event) =>

                            updateTaskForm("appointmentStartDate", event.target.value)

                          }

                        />

                      </div>



                      <div className="field">

                        <label>Time</label>

                        <select

                          value={taskForm.appointmentStartTime}

                          onChange={(event) =>

                            updateTaskForm("appointmentStartTime", event.target.value)

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



                  <div className="task-booking-block">

                    <h4>End</h4>



                    <div className="form-grid">

                      <div className="field">

                        <label>Date</label>

                        <input

                          type="date"

                          value={taskForm.appointmentEndDate}

                          onChange={(event) =>

                            updateTaskForm("appointmentEndDate", event.target.value)

                          }

                        />

                      </div>



                      <div className="field">

                        <label>Time</label>

                        <select

                          value={taskForm.appointmentEndTime}

                          onChange={(event) =>

                            updateTaskForm("appointmentEndTime", event.target.value)

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



                  <div className="field field-span-2">

                    <label>Appointment notes</label>

                    <textarea

                      value={taskForm.appointmentNotes}

                      onChange={(event) =>

                        updateTaskForm("appointmentNotes", event.target.value)

                      }

                      placeholder="Any note for the booked visit"

                    />

                  </div>

                </div>



                <div className="record-actions">

                  <button

                    type="button"

                    className="primary-button"

                    disabled={busyKey === "task-book-appointment"}

                    onClick={handleBookAppointment}

                  >

                    Book appointment

                  </button>

                </div>

              </section>

            </div>

          </aside>

        </div>

      )}



      <style jsx global>{`

        .task-overview-grid {

          display: grid;

          grid-template-columns: repeat(4, minmax(0, 1fr));

          gap: 12px;

        }



        .task-overview-tile {

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.05));

          border-radius: 16px;

          padding: 14px;

          display: flex;

          flex-direction: column;

          justify-content: space-between;

          gap: 12px;

          min-height: 152px;

        }



        .task-overview-copy {

          display: flex;

          flex-direction: column;

          gap: 8px;

        }



        .task-overview-label {

          font-size: 12px;

          text-transform: uppercase;

          letter-spacing: 0.12em;

          color: var(--muted, #66758b);

          font-weight: 700;

        }



        .task-overview-tile strong {

          font-size: 24px;

          line-height: 1;

        }



        .task-overview-footer {

          display: flex;

          justify-content: flex-end;

          margin-top: auto;

        }



        .task-overview-arrow {

          width: 38px;

          height: 38px;

          border-radius: 999px;

          display: inline-flex;

          align-items: center;

          justify-content: center;

          color: var(--text-soft, #2e3b4e);

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: rgba(255, 255, 255, 0.4);

          transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;

        }



        .task-overview-arrow:hover {

          transform: translateX(1px);

          background: rgba(92, 118, 168, 0.08);

          border-color: rgba(116, 136, 170, 0.34);

        }



        .task-overview-arrow-icon {

          width: 16px;

          height: 16px;

        }



        .task-main-grid {

          display: grid;

          grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);

          gap: 16px;

        }



        .task-column-card {

          min-width: 0;

        }



        .compact-records-list {

          gap: 12px;

        }



        .compact-record-card {

          padding: 14px;

        }



        .task-inline-badges {

          display: flex;

          align-items: center;

          gap: 8px;

          flex-wrap: wrap;

        }



        .task-urgency-badge {

          display: inline-flex;

          align-items: center;

          justify-content: center;

          min-height: 28px;

          padding: 0 10px;

          border-radius: 999px;

          border: 1px solid rgba(133, 157, 194, 0.35);

          background: rgba(92, 118, 168, 0.08);

          color: var(--text-soft, #2e3b4e);

          font-size: 12px;

          font-weight: 700;

          letter-spacing: 0.04em;

          text-transform: uppercase;

        }



        .task-urgency-badge-overdue {

          border-color: rgba(186, 110, 110, 0.35);

          background: rgba(186, 110, 110, 0.08);

        }



        .task-mini-grid {

          display: grid;

          grid-template-columns: repeat(2, minmax(0, 1fr));

          gap: 12px;

        }



        .pickup-mini-grid {

          grid-template-columns: repeat(4, minmax(0, 1fr));

        }



        .task-mini-card {

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.04));

          border-radius: 16px;

          padding: 14px;

          display: flex;

          flex-direction: column;

          gap: 12px;

        }



        .task-mini-card-head {

          display: flex;

          align-items: center;

          gap: 12px;

          min-width: 0;

        }



        .task-mini-avatar {

          width: 42px;

          height: 42px;

          border-radius: 12px;

          flex-shrink: 0;

          display: grid;

          place-items: center;

          font-weight: 800;

          letter-spacing: 0.04em;

          color: var(--text-soft, #2e3b4e);

          background: var(--surface-soft, rgba(92, 118, 168, 0.08));

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

        }



        .task-mini-copy {

          min-width: 0;

          display: flex;

          flex-direction: column;

          gap: 4px;

        }



        .task-mini-copy strong {

          display: block;

          line-height: 1.2;

        }



        .task-mini-meta {

          display: flex;

          flex-direction: column;

          gap: 6px;

          color: var(--muted, #66758b);

          font-size: 14px;

        }



        .task-mini-footer {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 10px;

          flex-wrap: wrap;

          margin-top: auto;

        }



        .my-tasks-drawer {

          width: min(980px, calc(100vw - 24px));

          max-width: 980px;

        }



        .my-tasks-drawer-header {

          align-items: center;

          gap: 16px;

        }



        .my-tasks-drawer-header-main {

          display: flex;

          align-items: center;

          gap: 14px;

          min-width: 0;

          flex: 1;

        }



        .my-tasks-drawer-avatar {

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



        .my-tasks-drawer-copy {

          min-width: 0;

        }



        .my-tasks-drawer-copy h2 {

          margin: 0;

        }



        .my-tasks-drawer-copy p {

          margin: 4px 0 0;

        }



        .my-tasks-drawer-stack {

          gap: 16px;

        }



        .task-summary-grid {

          display: grid;

          grid-template-columns: repeat(2, minmax(0, 1fr));

          gap: 12px;

          margin-top: 12px;

        }



        .task-summary-item {

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.06));

          border-radius: 14px;

          padding: 12px 14px;

          display: flex;

          flex-direction: column;

          gap: 6px;

        }



        .task-note-panel {

          margin-top: 14px;

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.04));

          border-radius: 14px;

          padding: 14px;

        }



        .task-note-panel p {

          margin: 8px 0 0;

          white-space: pre-wrap;

        }



        .task-outcome-actions {

          margin-top: 14px;

          flex-wrap: wrap;

        }



        .task-booking-grid {

          display: grid;

          gap: 14px;

        }



        .task-booking-block {

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.04));

          border-radius: 14px;

          padding: 14px;

        }



        .task-booking-block h4 {

          margin: 0 0 12px;

          font-size: 15px;

        }



        @media (max-width: 1200px) {

          .task-overview-grid {

            grid-template-columns: repeat(2, minmax(0, 1fr));

          }



          .pickup-mini-grid {

            grid-template-columns: repeat(2, minmax(0, 1fr));

          }

        }



        @media (max-width: 980px) {

          .task-main-grid {

            grid-template-columns: 1fr;

          }



          .task-mini-grid {

            grid-template-columns: 1fr;

          }



          .my-tasks-drawer {

            width: min(100vw - 20px, 100%);

          }

        }



        @media (max-width: 820px) {

          .task-overview-grid,

          .task-summary-grid,

          .pickup-mini-grid,

          .form-grid {

            grid-template-columns: 1fr;

          }



          .my-tasks-drawer-header {

            align-items: flex-start;

          }

        }

      `}</style>

    </div>

  );

}