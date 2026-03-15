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

      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;



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



  const upcomingAppointments = useMemo(() => {

    return sortByDateAsc(

      appointments.filter((appointment) => {

        const isRelevantLead = responsibleLeadIds.has(appointment.leadId);

        const isUpcoming =

          new Date(appointment.startTime).getTime() >= Date.now();

        const isOpenStatus = ["booked", "rescheduled"].includes(

          appointment.status

        );



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



  const selectedLead = selectedFollowup

    ? leadsById[selectedFollowup.leadId]

    : null;



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

        taskForm.appointmentNotes.trim() ||

        taskForm.outcomeNotes.trim() ||

        null;



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

          This is the receptionist daily queue. It shows which follow-ups and

          appointments need action right now.

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

              Quick counts for the tasks that need attention first.

            </p>

          </div>



          <div className="record-actions">

            <Link href="/leads" className="secondary-button">

              Open Leads Workspace

            </Link>



            <Link href="/appointments" className="secondary-button">

              Open Appointments

            </Link>



            <button

              type="button"

              className="primary-button"

              onClick={loadPage}

            >

              Refresh

            </button>

          </div>

        </div>



        <div className="records-list">

          <article className="record-card">

            <div className="record-main">

              <div className="record-title-row">

                <h3>Overdue follow-ups</h3>

              </div>

              <p className="muted">{overdueFollowups.length} waiting</p>

            </div>

          </article>



          <article className="record-card">

            <div className="record-main">

              <div className="record-title-row">

                <h3>Due today</h3>

              </div>

              <p className="muted">{todayFollowups.length} still on today’s clock</p>

            </div>

          </article>



          <article className="record-card">

            <div className="record-main">

              <div className="record-title-row">

                <h3>Upcoming appointments</h3>

              </div>

              <p className="muted">{upcomingAppointments.length} ahead</p>

            </div>

          </article>



          <article className="record-card">

            <div className="record-main">

              <div className="record-title-row">

                <h3>Pickup leads</h3>

              </div>

              <p className="muted">{pickupLeads.length} available</p>

            </div>

          </article>

        </div>

      </section>



      <section className="page-card">

        <div className="section-heading">

          <div>

            <h2>Overdue follow-ups</h2>

            <p className="muted">These need attention first.</p>

          </div>

        </div>



        {isLoading ? (

          <p className="muted">Loading tasks…</p>

        ) : overdueFollowups.length === 0 ? (

          <div className="empty-state">No overdue follow-ups right now.</div>

        ) : (

          <div className="records-list">

            {overdueFollowups.map((followup) => {

              const lead = leadsById[followup.leadId];



              return (

                <article key={followup.id} className="record-card">

                  <div className="record-main">

                    <div className="record-title-row">

                      <h3>{getLeadLabel(followup.leadId)}</h3>

                      <StatusPill status={lead?.pipelineStatus || "new"} />

                    </div>



                    <div className="record-meta">

                      <span>{formatDateTime(followup.dueAt)}</span>

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

                      Mark done

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      disabled={busyKey === `followup-${followup.id}`}

                      onClick={() => handleFollowupAction(followup.id, "skipped")}

                    >

                      Skip

                    </button>

                  </div>

                </article>

              );

            })}

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

            {todayFollowups.map((followup) => {

              const lead = leadsById[followup.leadId];



              return (

                <article key={followup.id} className="record-card">

                  <div className="record-main">

                    <div className="record-title-row">

                      <h3>{getLeadLabel(followup.leadId)}</h3>

                      <StatusPill status={lead?.pipelineStatus || "new"} />

                    </div>



                    <div className="record-meta">

                      <span>{formatDateTime(followup.dueAt)}</span>

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

                      Mark done

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      disabled={busyKey === `followup-${followup.id}`}

                      onClick={() => handleFollowupAction(followup.id, "skipped")}

                    >

                      Skip

                    </button>

                  </div>

                </article>

              );

            })}

          </div>

        )}

      </section>



      <section className="page-card">

        <div className="section-heading">

          <div>

            <h2>Upcoming appointments</h2>

            <p className="muted">

              Booked or rescheduled appointments for your active leads.

            </p>

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

              <p className="muted">

                Optional unassigned leads you can grab and work on.

              </p>

            </div>

          </div>



          {isLoading ? (

            <p className="muted">Loading pickup leads…</p>

          ) : pickupLeads.length === 0 ? (

            <div className="empty-state">

              No unassigned leads are waiting right now.

            </div>

          ) : (

            <div className="records-list">

              {pickupLeads.map((lead) => (

                <article key={lead.id} className="record-card">

                  <div className="record-main">

                    <div className="record-title-row">

                      <h3>{lead.patientName}</h3>

                      <StatusPill status={lead.pipelineStatus || "new"} />

                    </div>



                    <div className="record-meta">

                      <span>{lead.phone}</span>

                      <span>{lead.email || "No email"}</span>

                      <span>{lead.source || "No source"}</span>

                    </div>



                    <p className="muted">

                      {lead.serviceRequested || "No requested service added yet."}

                    </p>

                  </div>



                  <div className="record-actions">

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

            className="drawer-panel task-work-drawer"

            onClick={(event) => event.stopPropagation()}

          >

            <div className="drawer-header task-work-drawer-header">

              <div>

                <h2>{selectedLead.patientName}</h2>

                <p className="muted">

                  {selectedLead.phone || "No phone"} •{" "}

                  {selectedLead.email || "No email"}

                </p>

              </div>



              <button

                type="button"

                className="secondary-button compact-button"

                onClick={closeTaskDrawer}

              >

                Close

              </button>

            </div>



            <div className="stack task-drawer-stack">

              <section className="page-card drawer-card task-drawer-card">

                <div className="section-heading">

                  <div>

                    <h3>Task summary</h3>

                    <p className="muted">

                      Everything important for this call in one place.

                    </p>

                  </div>



                  <StatusPill status={selectedLead.pipelineStatus || "new"} />

                </div>



                <div className="task-summary-grid">

                  <div className="task-summary-item">

                    <span className="task-summary-label">Follow-up due</span>

                    <strong>{formatDateTime(selectedFollowup.dueAt)}</strong>

                  </div>



                  <div className="task-summary-item">

                    <span className="task-summary-label">Lead source</span>

                    <strong>{selectedLead.source || "Not added"}</strong>

                  </div>



                  <div className="task-summary-item">

                    <span className="task-summary-label">Service</span>

                    <strong>{selectedLead.serviceRequested || "Not added"}</strong>

                  </div>



                  <div className="task-summary-item">

                    <span className="task-summary-label">Current status</span>

                    <strong>{selectedLead.pipelineStatus || "new"}</strong>

                  </div>

                </div>



                <div className="task-note-panel">

                  <span className="task-summary-label">Current follow-up note</span>

                  <p>{selectedFollowup.notes || "No follow-up note added yet."}</p>

                </div>

              </section>



              <section className="page-card drawer-card task-drawer-card">

                <div className="section-heading">

                  <div>

                    <h3>Call outcome</h3>

                    <p className="muted">

                      Save the call result and create the next step when needed.

                    </p>

                  </div>

                </div>



                <div className="task-form-grid">

                  <div className="task-split-field">

                    <label>Next follow-up date</label>

                    <input

                      type="date"

                      value={taskForm.nextFollowupDate}

                      onChange={(event) =>

                        updateTaskForm("nextFollowupDate", event.target.value)

                      }

                    />

                  </div>



                  <div className="task-split-field">

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



                  <div className="field task-field-span-full">

                    <label>Outcome note</label>

                    <textarea

                      value={taskForm.outcomeNotes}

                      onChange={(event) =>

                        updateTaskForm("outcomeNotes", event.target.value)

                      }

                      placeholder="What happened on the call?"

                    />

                  </div>

                </div>



                <div className="task-action-cluster">

                  <button

                    type="button"

                    className="secondary-button compact-button"

                    disabled={busyKey === "task-outcome-no_answer"}

                    onClick={() => handleTaskOutcome("no_answer")}

                  >

                    No answer + next follow-up

                  </button>



                  <button

                    type="button"

                    className="primary-button compact-button"

                    disabled={busyKey === "task-outcome-callback_requested"}

                    onClick={() => handleTaskOutcome("callback_requested")}

                  >

                    Callback requested

                  </button>



                  <button

                    type="button"

                    className="secondary-button compact-button"

                    disabled={busyKey === "task-outcome-not_interested"}

                    onClick={() => handleTaskOutcome("not_interested")}

                  >

                    Not interested

                  </button>



                  <button

                    type="button"

                    className="secondary-button compact-button"

                    disabled={busyKey === "task-outcome-done"}

                    onClick={() => handleTaskOutcome("done")}

                  >

                    Mark done

                  </button>



                  <button

                    type="button"

                    className="secondary-button compact-button"

                    disabled={busyKey === "task-outcome-skipped"}

                    onClick={() => handleTaskOutcome("skipped")}

                  >

                    Skip

                  </button>

                </div>

              </section>



              <section className="page-card drawer-card task-drawer-card">

                <div className="section-heading">

                  <div>

                    <h3>Book appointment</h3>

                    <p className="muted">

                      Use this when the patient agrees to a visit during the call.

                    </p>

                  </div>

                </div>



                <div className="task-booking-grid">

                  <div className="task-booking-block">

                    <h4>Start</h4>



                    <div className="task-form-grid">

                      <div className="task-split-field">

                        <label>Date</label>

                        <input

                          type="date"

                          value={taskForm.appointmentStartDate}

                          onChange={(event) => {

                            const appointmentStartDate = event.target.value;



                            setTaskForm((current) => ({

                              ...current,

                              appointmentStartDate,

                              appointmentEndDate:

                                current.appointmentEndDate || appointmentStartDate,

                            }));

                          }}

                        />

                      </div>



                      <div className="task-split-field">

                        <label>Time</label>

                        <select

                          value={taskForm.appointmentStartTime}

                          onChange={(event) => {

                            const appointmentStartTime = event.target.value;



                            setTaskForm((current) => ({

                              ...current,

                              appointmentStartTime,

                            }));

                          }}

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



                    <div className="task-form-grid">

                      <div className="task-split-field">

                        <label>Date</label>

                        <input

                          type="date"

                          value={taskForm.appointmentEndDate}

                          onChange={(event) =>

                            updateTaskForm("appointmentEndDate", event.target.value)

                          }

                        />

                      </div>



                      <div className="task-split-field">

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



                  <div className="field task-field-span-full">

                    <label>Appointment note</label>

                    <textarea

                      value={taskForm.appointmentNotes}

                      onChange={(event) =>

                        updateTaskForm("appointmentNotes", event.target.value)

                      }

                      placeholder="Optional booking note"

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



                  <Link href="/appointments" className="secondary-button">

                    Open full schedule

                  </Link>

                </div>

              </section>



              <section className="page-card drawer-card task-drawer-card">

                <div className="section-heading">

                  <div>

                    <h3>Lead notes</h3>

                    <p className="muted">

                      Extra context before you finish this task.

                    </p>

                  </div>

                </div>



                <div className="task-note-panel">

                  <p>{selectedLead.notes || "No lead notes available."}</p>

                </div>



                <div className="record-actions">

                  <Link href="/leads" className="secondary-button">

                    Open Leads Workspace

                  </Link>

                </div>

              </section>

            </div>

          </aside>

        </div>

      )}



      <style jsx global>{`

        .task-work-drawer {

          width: min(860px, calc(100vw - 24px));

          max-width: 860px;

        }



        .task-work-drawer-header {

          align-items: flex-start;

          gap: 16px;

        }



        .task-drawer-stack {

          gap: 16px;

        }



        .task-drawer-card {

          padding: 18px;

          border-radius: 18px;

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



        .task-summary-label {

          font-size: 12px;

          text-transform: uppercase;

          letter-spacing: 0.12em;

          color: var(--muted, #66758b);

          font-weight: 700;

        }



        .task-note-panel {

          margin-top: 14px;

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.05));

          border-radius: 14px;

          padding: 14px;

        }



        .task-note-panel p {

          margin: 8px 0 0;

        }



        .task-form-grid {

          display: grid;

          grid-template-columns: repeat(2, minmax(0, 1fr));

          gap: 14px;

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



        .task-split-field {

          display: flex;

          flex-direction: column;

          gap: 8px;

        }



        .task-split-field label {

          font-size: 12px;

          text-transform: uppercase;

          letter-spacing: 0.12em;

          color: var(--muted, #66758b);

          font-weight: 700;

        }



        .task-split-field input,

        .task-split-field select {

          width: 100%;

        }



        .task-field-span-full {

          grid-column: 1 / -1;

        }



        .task-action-cluster {

          display: flex;

          flex-wrap: wrap;

          gap: 10px;

          margin-top: 14px;

        }



        .task-action-cluster .compact-button {

          min-height: 42px;

        }



        @media (max-width: 900px) {

          .task-work-drawer {

            width: min(100vw - 16px, 100%);

          }

        }



        @media (max-width: 720px) {

          .task-summary-grid,

          .task-form-grid {

            grid-template-columns: 1fr;

          }

        }

      `}</style>

    </div>

  );

}