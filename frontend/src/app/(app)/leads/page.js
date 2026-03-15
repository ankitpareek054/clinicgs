"use client";



import Link from "next/link";

import { useCallback, useEffect, useMemo, useState } from "react";

import StatusPill from "../../../components/shared/statusPill";

import { formatDateTime, toIsoFromLocalInput } from "../../../lib/date/date";

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

const EMPTY_SORT = { key: "", direction: "" };



const LEAD_SOURCE_OPTIONS = [

  "Walk-in",

  "Front Desk",

  "Phone Call",

  "WhatsApp",

  "Website",

  "Google Ads",

  "Google Search",

  "Instagram",

  "Facebook",

  "Referral",

  "Public Form",

  "Other",

];



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

    };

  }



  return {

    patientName: lead.patientName || "",

    phone: lead.phone || "",

    email: lead.email || "",

    source: lead.source || "",

    serviceRequested: lead.serviceRequested || "",

    notes: lead.notes || "",

  };

}



function buildDrawerState() {

  return {

    isLoading: false,

    isEditingLeadSummary: false,

    lead: null,

    leadForm: buildLeadForm(null),

    pipelineStatus: "new",

  };

}



function getLeadInitials(name) {

  if (!name) return "LD";



  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);



  if (!parts.length) return "LD";



  return parts.map((part) => part[0]?.toUpperCase() || "").join("");

}



function compareText(a, b) {

  return String(a || "").localeCompare(String(b || ""), undefined, {

    sensitivity: "base",

  });

}



function compareOptionalDates(a, b, direction = "asc") {

  const aValue = a ? new Date(a).getTime() : null;

  const bValue = b ? new Date(b).getTime() : null;



  if (aValue === null && bValue === null) return 0;

  if (aValue === null) return 1;

  if (bValue === null) return -1;



  return direction === "asc" ? aValue - bValue : bValue - aValue;

}



function getNextSortState(currentSort, key) {

  if (currentSort.key !== key) {

    return { key, direction: "asc" };

  }



  if (currentSort.direction === "asc") {

    return { key, direction: "desc" };

  }



  return EMPTY_SORT;

}



function getSortArrow(sortState, key) {

  if (sortState.key !== key) return "";

  return sortState.direction === "asc" ? "↑" : "↓";

}



function sortLeadRows(rows, sortState, getAssigneeLabel) {

  if (!sortState.key || !sortState.direction) {

    return rows;

  }



  const next = [...rows];



  next.sort((a, b) => {

    if (sortState.key === "patient") {

      return sortState.direction === "asc"

        ? compareText(a.patientName, b.patientName)

        : compareText(b.patientName, a.patientName);

    }



    if (sortState.key === "status") {

      return sortState.direction === "asc"

        ? compareText(a.pipelineStatus, b.pipelineStatus)

        : compareText(b.pipelineStatus, a.pipelineStatus);

    }



    if (sortState.key === "assignee") {

      return sortState.direction === "asc"

        ? compareText(getAssigneeLabel(a), getAssigneeLabel(b))

        : compareText(getAssigneeLabel(b), getAssigneeLabel(a));

    }



    if (sortState.key === "phone") {

      return sortState.direction === "asc"

        ? compareText(a.phone, b.phone)

        : compareText(b.phone, a.phone);

    }



    if (sortState.key === "source") {

      return sortState.direction === "asc"

        ? compareText(a.source, b.source)

        : compareText(b.source, a.source);

    }



    if (sortState.key === "nextFollowup") {

      return compareOptionalDates(

        a.nextFollowupAt,

        b.nextFollowupAt,

        sortState.direction

      );

    }



    return 0;

  });



  return next;

}



export default function LeadsPage() {

  const { user } = useAuth();



  const [filterForm, setFilterForm] = useState(buildInitialFilters(user));

  const [appliedFilters, setAppliedFilters] = useState(buildInitialFilters(user));

  const [showFilters, setShowFilters] = useState(false);

  const [sortState, setSortState] = useState(EMPTY_SORT);

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

    setSortState(EMPTY_SORT);

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



  const getAssigneeLabel = useCallback(

    (lead) => {

      if (!lead?.assignedToUserId) return "Unassigned";

      return usersById[lead.assignedToUserId]?.fullName || `User #${lead.assignedToUserId}`;

    },

    [usersById]

  );



  const filteredLeads = useMemo(() => {

    let rows = [...leads];



    if (appliedFilters.assignmentScope === "mine") {

      rows = rows.filter((lead) => Number(lead.assignedToUserId) === Number(user?.id));

    }



    if (appliedFilters.assignmentScope === "unassigned") {

      rows = rows.filter((lead) => !lead.assignedToUserId);

    }



    return rows;

  }, [appliedFilters.assignmentScope, leads, user]);



  const sortedLeads = useMemo(() => {

    return sortLeadRows(filteredLeads, sortState, getAssigneeLabel);

  }, [filteredLeads, sortState, getAssigneeLabel]);



  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));



  useEffect(() => {

    if (page > totalPages) {

      setPage(totalPages);

    }

  }, [page, totalPages]);



  const pagedLeads = useMemo(() => {

    const start = (page - 1) * PAGE_SIZE;

    return sortedLeads.slice(start, start + PAGE_SIZE);

  }, [sortedLeads, page]);



  const unassignedLeadCount = useMemo(() => {

    return leads.filter((lead) => !lead.assignedToUserId).length;

  }, [leads]);



  const myLeadCount = useMemo(() => {

    return leads.filter(

      (lead) => Number(lead.assignedToUserId) === Number(user?.id)

    ).length;

  }, [leads, user]);



  const bookedLeadCount = useMemo(() => {

    return leads.filter((lead) => lead.pipelineStatus === "booked").length;

  }, [leads]);



  const overdueLeadCount = useMemo(() => {

    const now = Date.now();



    return leads.filter((lead) => {

      if (!lead.nextFollowupAt) return false;

      return new Date(lead.nextFollowupAt).getTime() < now;

    }).length;

  }, [leads]);



  const hasActiveFilters = useMemo(() => {

    return Boolean(

      appliedFilters.search ||

        appliedFilters.pipelineStatus ||

        appliedFilters.source ||

        appliedFilters.assignmentScope !== buildInitialFilters(user).assignmentScope

    );

  }, [appliedFilters, user]);



  const loadLeadDrawer = useCallback(async (leadId) => {

    setDrawer((current) => ({

      ...current,

      isLoading: true,

    }));



    try {

      const lead = await getLeadById(leadId);



      setDrawer({

        isLoading: false,

        isEditingLeadSummary: false,

        lead,

        leadForm: buildLeadForm(lead),

        pipelineStatus: lead.pipelineStatus || "new",

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



  function startEditingLeadSummary() {

    setDrawer((current) => ({

      ...current,

      isEditingLeadSummary: true,

      leadForm: buildLeadForm(current.lead),

      pipelineStatus: current.lead?.pipelineStatus || "new",

    }));

  }



  function cancelEditingLeadSummary() {

    setDrawer((current) => ({

      ...current,

      isEditingLeadSummary: false,

      leadForm: buildLeadForm(current.lead),

      pipelineStatus: current.lead?.pipelineStatus || "new",

    }));

  }



  function applyAssignmentScope(scope) {

    setFilterForm((current) => ({

      ...current,

      assignmentScope: scope,

    }));

    setAppliedFilters((current) => ({

      ...current,

      assignmentScope: scope,

    }));

    setPage(1);

  }



  function handleApplyFilters(event) {

    event.preventDefault();

    setAppliedFilters(filterForm);

    setPage(1);

  }



  function handleClearFilters() {

    const next = buildInitialFilters(user);

    setFilterForm(next);

    setAppliedFilters(next);

    setShowFilters(false);

    setPage(1);

  }



  async function handleRefresh() {

    setSortState(EMPTY_SORT);

    await loadLeadsPage();

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

        setNotice("Lead picked up successfully.");

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



  async function handleSaveLeadSummary() {

    if (!selectedLeadId) return;



    setBusyKey("drawer-save-summary");

    setError("");

    setNotice("");



    try {

      await updateLead(selectedLeadId, {

        patientName: drawer.leadForm.patientName,

        phone: drawer.leadForm.phone,

        email: drawer.leadForm.email,

        source: drawer.leadForm.source || null,

        serviceRequested: drawer.leadForm.serviceRequested || null,

        notes: drawer.leadForm.notes || null,

        pipelineStatus: drawer.pipelineStatus,

      });



      setNotice("Lead summary updated.");

      await loadLeadsPage();

      await loadLeadDrawer(selectedLeadId);

    } catch (err) {

      setError(err.message || "Could not update lead summary.");

    } finally {

      setBusyKey("");

    }

  }



  const selectedLeadAssignee = drawer.lead ? getAssigneeLabel(drawer.lead) : "—";

  const selectedLeadIsMine =

    Number(drawer.lead?.assignedToUserId) === Number(user?.id);

  const canToggleSelectedLeadAssignment =

    Boolean(drawer.lead) && (selectedLeadIsMine || !drawer.lead.assignedToUserId);

  const selectedLeadStatus =

    drawer.isEditingLeadSummary

      ? drawer.pipelineStatus

      : drawer.lead?.pipelineStatus || "new";



  const showingFrom = sortedLeads.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const showingTo = Math.min(page * PAGE_SIZE, sortedLeads.length);



  return (

    <div className="stack">

      <div className="page-header">

        <h1>Leads</h1>

        <p className="muted">

          Search leads, manage ownership, update pipeline, and edit lead details from one place.

        </p>

      </div>



      {(error || notice) && (

        <div className={error ? "error-banner" : "notice-banner"}>

          {error || notice}

        </div>

      )}



      <section className="page-card leads-summary-card">

        <div className="section-heading">

          <div>

            <h2>Lead overview</h2>

            <p className="muted">

              Quick view of the lead book before you drill into the list.

            </p>

          </div>



          <div className="record-actions">

            <Link href="/leads/new" className="primary-button">

              Create lead

            </Link>

          </div>

        </div>



        <div className="leads-summary-grid">

          <article className="lead-summary-tile">

            <span className="lead-summary-label">Active leads</span>

            <strong>{leads.length}</strong>

          </article>



          <article className="lead-summary-tile">

            <span className="lead-summary-label">My leads</span>

            <strong>{myLeadCount}</strong>

          </article>



          <article className="lead-summary-tile">

            <span className="lead-summary-label">Unassigned</span>

            <strong>{unassignedLeadCount}</strong>

          </article>



          <article className="lead-summary-tile">

            <span className="lead-summary-label">Booked</span>

            <strong>{bookedLeadCount}</strong>

          </article>



          <article className="lead-summary-tile">

            <span className="lead-summary-label">Overdue next follow-up</span>

            <strong>{overdueLeadCount}</strong>

          </article>

        </div>

      </section>



      <section className="page-card">

        <div className="section-heading">

          <div>

            <h2>Lead list</h2>

            <p className="muted">

              {isLoading

                ? "Loading leads…"

                : `Showing ${showingFrom}-${showingTo} of ${sortedLeads.length} leads`}

            </p>

          </div>



          <div className="record-actions lead-toolbar-actions">

            <button

              type="button"

              className="secondary-button"

              onClick={() => applyAssignmentScope("unassigned")}

            >

              Unassigned ({unassignedLeadCount})

            </button>



            <button

              type="button"

              className="secondary-button"

              onClick={() => applyAssignmentScope("mine")}

            >

              My leads ({myLeadCount})

            </button>



            <button

              type="button"

              className="secondary-button"

              onClick={() => applyAssignmentScope("all")}

            >

              All visible

            </button>



            <button

              type="button"

              className="secondary-button"

              onClick={() => setShowFilters((current) => !current)}

            >

              {showFilters ? "Hide filters" : "Filters"}

            </button>



            <button

              type="button"

              className="secondary-button"

              onClick={handleClearFilters}

              disabled={!hasActiveFilters}

            >

              Clear all

            </button>



            <button

              type="button"

              className="secondary-button"

              onClick={handleRefresh}

            >

              Refresh

            </button>

          </div>

        </div>



        {showFilters && (

          <form className="inline-filters-panel" onSubmit={handleApplyFilters}>

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



            <div className="record-actions inline-filter-actions">

              <button type="submit" className="primary-button">

                Apply filters

              </button>



              <button

                type="button"

                className="secondary-button"

                onClick={handleClearFilters}

              >

                Clear all

              </button>

            </div>

          </form>

        )}



        {isLoading ? (

          <p className="muted">Loading leads…</p>

        ) : sortedLeads.length === 0 ? (

          <div className="empty-state">No leads matched your current filters.</div>

        ) : (

          <>

            <div className="data-table-wrap">

              <table className="data-table">

                <thead>

                  <tr>

                    <th>

                      <button

                        type="button"

                        className="table-sort-button"

                        onClick={() =>

                          setSortState((current) => getNextSortState(current, "patient"))

                        }

                      >

                        Patient

                        {getSortArrow(sortState, "patient") && (

                          <span className="table-sort-arrow">

                            {getSortArrow(sortState, "patient")}

                          </span>

                        )}

                      </button>

                    </th>



                    <th>

                      <button

                        type="button"

                        className="table-sort-button"

                        onClick={() =>

                          setSortState((current) => getNextSortState(current, "status"))

                        }

                      >

                        Status

                        {getSortArrow(sortState, "status") && (

                          <span className="table-sort-arrow">

                            {getSortArrow(sortState, "status")}

                          </span>

                        )}

                      </button>

                    </th>



                    <th>

                      <button

                        type="button"

                        className="table-sort-button"

                        onClick={() =>

                          setSortState((current) => getNextSortState(current, "assignee"))

                        }

                      >

                        Assignee

                        {getSortArrow(sortState, "assignee") && (

                          <span className="table-sort-arrow">

                            {getSortArrow(sortState, "assignee")}

                          </span>

                        )}

                      </button>

                    </th>



                    <th>

                      <button

                        type="button"

                        className="table-sort-button"

                        onClick={() =>

                          setSortState((current) => getNextSortState(current, "phone"))

                        }

                      >

                        Phone

                        {getSortArrow(sortState, "phone") && (

                          <span className="table-sort-arrow">

                            {getSortArrow(sortState, "phone")}

                          </span>

                        )}

                      </button>

                    </th>



                    <th>

                      <button

                        type="button"

                        className="table-sort-button"

                        onClick={() =>

                          setSortState((current) => getNextSortState(current, "source"))

                        }

                      >

                        Source

                        {getSortArrow(sortState, "source") && (

                          <span className="table-sort-arrow">

                            {getSortArrow(sortState, "source")}

                          </span>

                        )}

                      </button>

                    </th>



                    <th>

                      <button

                        type="button"

                        className="table-sort-button"

                        onClick={() =>

                          setSortState((current) =>

                            getNextSortState(current, "nextFollowup")

                          )

                        }

                      >

                        Next follow-up

                        {getSortArrow(sortState, "nextFollowup") && (

                          <span className="table-sort-arrow">

                            {getSortArrow(sortState, "nextFollowup")}

                          </span>

                        )}

                      </button>

                    </th>



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

                        <td>

                          {lead.nextFollowupAt

                            ? formatDateTime(lead.nextFollowupAt)

                            : "Not scheduled"}

                        </td>



                        <td>

                          <div className="record-actions">

                            {(isMine || isUnassigned) && (

                              <button

                                type="button"

                                className={

                                  isUnassigned

                                    ? "primary-button compact-button"

                                    : "secondary-button compact-button"

                                }

                                disabled={busyKey === `assign-${lead.id}`}

                                onClick={() => handleAssignToggle(lead)}

                              >

                                {isMine ? "Unassign" : "Pickup"}

                              </button>

                            )}



                            <button

                              type="button"

                              className="secondary-button compact-button"

                              onClick={() => openLeadDrawer(lead.id)}

                            >

                              Edit

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

            className="drawer-panel lead-work-drawer"

            onClick={(event) => event.stopPropagation()}

          >

            <div className="drawer-header lead-work-drawer-header">

              <div className="lead-drawer-header-main">

                <div className="lead-drawer-avatar">

                  {getLeadInitials(drawer.lead?.patientName)}

                </div>



                <div className="lead-drawer-header-copy">

                  <h2>{drawer.lead?.patientName || "Lead details"}</h2>

                </div>

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

              <div className="stack lead-drawer-stack">

                <section className="page-card drawer-card lead-drawer-card">

                  <div className="section-heading">

                    <div>

                      <h3>Lead summary</h3>

                      <p className="muted">

                        All key lead details in one place. Edit only when needed.

                      </p>

                    </div>



                    <div className="record-actions">

                      {canToggleSelectedLeadAssignment && (

                        <button

                          type="button"

                          className={

                            selectedLeadIsMine ? "secondary-button" : "primary-button"

                          }

                          disabled={busyKey === `assign-${drawer.lead.id}`}

                          onClick={() => handleAssignToggle(drawer.lead)}

                        >

                          {selectedLeadIsMine ? "Unassign from me" : "Pickup lead"}

                        </button>

                      )}



                      {drawer.isEditingLeadSummary ? (

                        <>

                          <button

                            type="button"

                            className="secondary-button"

                            onClick={cancelEditingLeadSummary}

                          >

                            Cancel

                          </button>



                          <button

                            type="button"

                            className="primary-button"

                            disabled={busyKey === "drawer-save-summary"}

                            onClick={handleSaveLeadSummary}

                          >

                            Save summary

                          </button>

                        </>

                      ) : (

                        <button

                          type="button"

                          className="secondary-button"

                          onClick={startEditingLeadSummary}

                        >

                          Edit

                        </button>

                      )}

                    </div>

                  </div>



                  {drawer.isEditingLeadSummary ? (

                    <div className="form-grid lead-summary-edit-grid">

                      <div className="field">

                        <label>Patient name</label>

                        <input

                          type="text"

                          value={drawer.leadForm.patientName}

                          onChange={(event) =>

                            updateLeadForm("patientName", event.target.value)

                          }

                        />

                      </div>



                      <div className="field">

                        <label>Phone</label>

                        <input

                          type="text"

                          value={drawer.leadForm.phone}

                          onChange={(event) =>

                            updateLeadForm("phone", event.target.value)

                          }

                        />

                      </div>



                      <div className="field">

                        <label>Email</label>

                        <input

                          type="email"

                          value={drawer.leadForm.email}

                          onChange={(event) =>

                            updateLeadForm("email", event.target.value)

                          }

                        />

                      </div>



                      <div className="field">

                        <label>Source</label>

                        <select

                          value={drawer.leadForm.source}

                          onChange={(event) =>

                            updateLeadForm("source", event.target.value)

                          }

                        >

                          <option value="">Select source</option>

                          {LEAD_SOURCE_OPTIONS.map((source) => (

                            <option key={source} value={source}>

                              {source}

                            </option>

                          ))}

                        </select>

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

                        <label>Pipeline status</label>

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

                      </div>



                      <div className="field field-span-2">

                        <label>Notes</label>

                        <textarea

                          value={drawer.leadForm.notes}

                          onChange={(event) =>

                            updateLeadForm("notes", event.target.value)

                          }

                        />

                      </div>

                    </div>

                  ) : (

                    <>

                      <div className="lead-summary-grid">

                        <div className="lead-summary-item">

                          <span className="lead-summary-label">Status</span>

                          <div>

                            <StatusPill status={selectedLeadStatus} />

                          </div>

                        </div>



                        <div className="lead-summary-item">

                          <span className="lead-summary-label">Assignee</span>

                          <strong>{selectedLeadAssignee}</strong>

                        </div>



                        <div className="lead-summary-item">

                          <span className="lead-summary-label">Phone</span>

                          <strong>{drawer.lead.phone || "Not added"}</strong>

                        </div>



                        <div className="lead-summary-item">

                          <span className="lead-summary-label">Email</span>

                          <strong>{drawer.lead.email || "No email"}</strong>

                        </div>



                        <div className="lead-summary-item">

                          <span className="lead-summary-label">Source</span>

                          <strong>{drawer.lead.source || "Not added"}</strong>

                        </div>



                        <div className="lead-summary-item">

                          <span className="lead-summary-label">Service</span>

                          <strong>{drawer.lead.serviceRequested || "Not added"}</strong>

                        </div>

                      </div>



                      <div className="lead-note-panel">

                        <span className="lead-summary-label">Lead note</span>

                        <p>{drawer.lead.notes || "No lead note added yet."}</p>

                      </div>

                    </>

                  )}

                </section>

              </div>

            )}

          </aside>

        </div>

      )}



      <style jsx global>{`

        .leads-summary-card {

          padding-bottom: 18px;

        }



        .leads-summary-grid {

          display: grid;

          grid-template-columns: repeat(5, minmax(0, 1fr));

          gap: 12px;

        }



        .lead-summary-tile {

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.05));

          border-radius: 16px;

          padding: 14px;

          display: flex;

          flex-direction: column;

          gap: 8px;

        }



        .lead-summary-tile strong {

          font-size: 24px;

          line-height: 1;

        }



        .lead-summary-label {

          font-size: 12px;

          text-transform: uppercase;

          letter-spacing: 0.12em;

          color: var(--muted, #66758b);

          font-weight: 700;

        }



        .lead-toolbar-actions {

          flex-wrap: wrap;

        }



        .inline-filters-panel {

          margin-bottom: 16px;

          padding: 16px;

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.2));

          border-radius: 16px;

          background: var(--surface-soft, rgba(92, 118, 168, 0.04));

        }



        .inline-filter-actions {

          margin-top: 14px;

          flex-wrap: wrap;

        }



 






        .lead-work-drawer {

          width: min(920px, calc(100vw - 24px));

          max-width: 920px;

        }



        .lead-work-drawer-header {

          align-items: center;

          gap: 16px;

        }



        .lead-drawer-header-main {

          display: flex;

          align-items: center;

          gap: 14px;

          min-width: 0;

          flex: 1;

        }



        .lead-drawer-avatar {

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



        .lead-drawer-header-copy {

          min-width: 0;

        }



        .lead-drawer-header-copy h2 {

          margin: 0;

        }



        .lead-drawer-stack {

          gap: 16px;

        }



        .lead-drawer-card {

          padding: 18px;

          border-radius: 18px;

        }



        .lead-summary-edit-grid {

          margin-top: 16px;

        }



        .lead-summary-grid {

          display: grid;

          grid-template-columns: repeat(2, minmax(0, 1fr));

          gap: 12px;

          margin-top: 12px;

        }



        .lead-summary-item {

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.06));

          border-radius: 14px;

          padding: 12px 14px;

          display: flex;

          flex-direction: column;

          gap: 6px;

        }



        .lead-note-panel {

          margin-top: 14px;

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: var(--surface-soft, rgba(92, 118, 168, 0.04));

          border-radius: 14px;

          padding: 14px;

        }



        .lead-note-panel p {

          margin: 8px 0 0;

          white-space: pre-wrap;

        }



        @media (max-width: 1100px) {

          .leads-summary-grid {

            grid-template-columns: repeat(3, minmax(0, 1fr));

          }



          .lead-work-drawer {

            width: min(100vw - 20px, 100%);

          }

        }



        @media (max-width: 820px) {

          .leads-summary-grid,

          .lead-summary-grid,

          .form-grid {

            grid-template-columns: 1fr;

          }



          .lead-work-drawer-header {

            align-items: flex-start;

          }

        }

      `}</style>

    </div>

  );

}