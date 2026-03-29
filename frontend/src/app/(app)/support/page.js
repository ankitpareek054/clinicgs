"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, buildQuery, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];
const TICKET_TYPE_OPTIONS = [
  "bug",
  "feature_request",
  "feedback",
  "support",
  "data_issue",
];
const SUPER_ADMIN_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "recently_updated", label: "Recently updated" },
  { value: "priority_high_first", label: "Priority: high first" },
  { value: "priority_low_first", label: "Priority: low first" },
];

const EMPTY_CREATE_FORM = {
  ticketType: "support",
  title: "",
  description: "",
};

const EMPTY_EDIT_FORM = {
  title: "",
  description: "",
};

const EMPTY_WORKSPACE_FORM = {
  status: "open",
  priority: "medium",
  title: "",
  progressNote: "",
};

const SUPPORT_UPDATE_TOKEN = "[[SUPPORT_UPDATE|";

function formatDateTime(value) {
  if (!value) return "Unknown time";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Unknown time";
  }
}

function humanizeToken(value, fallback = "General") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusTone(status) {
  if (status === "resolved") return "done";
  if (status === "closed") return "cancelled";
  return "pending";
}

function getPriorityTone(priority) {
  if (priority === "high") return "support-priority-high";
  if (priority === "low") return "support-priority-low";
  return "support-priority-medium";
}

function getPriorityRank(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

function canUseClinicSupport(user) {
  if (!user) return false;
  return user.role === "owner" || user.role === "receptionist";
}

function canUseSupportPage(user) {
  if (!user) return false;
  return canUseClinicSupport(user) || user.role === "super_admin";
}

function parseTicketDescription(description) {
  const source = String(description || "");
  const markerIndex = source.indexOf(SUPPORT_UPDATE_TOKEN);
  const issueDescription =
    markerIndex === -1 ? source.trim() : source.slice(0, markerIndex).trim();

  const updates = [];
  const regex =
    /\[\[SUPPORT_UPDATE\|(.+?)\|(.+?)\]\]\n([\s\S]*?)(?=(?:\n\n\[\[SUPPORT_UPDATE\|)|$)/g;

  let match = regex.exec(source);

  while (match) {
    updates.push({
      createdAt: match[1],
      status: match[2],
      note: match[3].trim(),
    });

    match = regex.exec(source);
  }

  return {
    issueDescription,
    updates,
  };
}

function buildTicketDescription(issueDescription, updates) {
  const base = String(issueDescription || "").trim();

  const updateBlocks = updates
    .filter((entry) => entry?.createdAt && entry?.status && entry?.note)
    .map(
      (entry) =>
        `[[SUPPORT_UPDATE|${entry.createdAt}|${entry.status}]]\n${entry.note.trim()}`,
    )
    .join("\n\n");

  return [base, updateBlocks].filter(Boolean).join("\n\n").trim();
}

function isWithinDateRange(value, fromDate, toDate) {
  if (!value) return false;

  const ticketDate = new Date(value);
  if (Number.isNaN(ticketDate.getTime())) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    if (ticketDate < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`);
    if (ticketDate > to) return false;
  }

  return true;
}

export default function SupportPage() {
  const router = useRouter();
  const { user, isBootstrapping, setAdminClinic } = useAuth();

  const isSuperAdmin = user?.role === "super_admin";
  const canCreateTickets = canUseClinicSupport(user);

  const [tickets, setTickets] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [filters, setFilters] = useState({
    clinicId: "",
    status: "",
    priority: "",
    ticketType: "",
    fromDate: "",
    toDate: "",
    unresolvedOnly: false,
    sortBy: "newest",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingClinics, setIsLoadingClinics] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [workspaceForm, setWorkspaceForm] = useState(EMPTY_WORKSPACE_FORM);
  const [isSubmittingWorkspace, setIsSubmittingWorkspace] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const safeSetAdminClinic =
    typeof setAdminClinic === "function" ? setAdminClinic : () => null;

  useEffect(() => {
    if (!isBootstrapping && user && !canUseSupportPage(user)) {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const clinicOptions = useMemo(() => {
    return [...clinics].sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || "")),
    );
  }, [clinics]);

  const clinicMapById = useMemo(() => {
    const map = new Map();

    clinicOptions.forEach((clinic) => {
      map.set(Number(clinic.id), clinic);
    });

    return map;
  }, [clinicOptions]);

  const clinicNameById = useMemo(() => {
    const map = new Map();

    clinicOptions.forEach((clinic) => {
      map.set(Number(clinic.id), clinic.name || `Clinic #${clinic.id}`);
    });

    return map;
  }, [clinicOptions]);

  function getClinicLabel(clinicId) {
    const normalized = Number(clinicId);

    if (clinicNameById.has(normalized)) {
      return clinicNameById.get(normalized);
    }

    if (clinicId === null || clinicId === undefined || clinicId === "") {
      return "Unknown clinic";
    }

    return `Clinic #${clinicId}`;
  }

  function getClinicSelectionFromTicket(ticket) {
    if (!ticket) {
      return null;
    }

    const clinicId =
      ticket.clinicId ?? ticket.clinic_id ?? ticket.clinic?.id ?? null;

    if (!clinicId) {
      return null;
    }

    const clinicFromMap = clinicMapById.get(Number(clinicId));

    return {
      id: clinicId,
      name:
        ticket.clinicName ||
        ticket.clinic_name ||
        clinicFromMap?.name ||
        `Clinic #${clinicId}`,
      status:
        ticket.clinicStatus ||
        ticket.clinic_status ||
        clinicFromMap?.status ||
        "",
      city:
        ticket.clinicCity || ticket.clinic_city || clinicFromMap?.city || "",
    };
  }

  const loadClinics = useCallback(async () => {
    if (!user || user.role !== "super_admin") {
      setClinics([]);
      return;
    }

    try {
      setIsLoadingClinics(true);
      const payload = await api.get("/clinics");
      const data = extractApiData(payload, []);
      setClinics(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Could not load clinics.");
    } finally {
      setIsLoadingClinics(false);
    }
  }, [user]);

  const loadTickets = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user || !canUseSupportPage(user)) {
        return;
      }

      try {
        setError("");
        setNotice("");

        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const query = buildQuery({
          clinicId: isSuperAdmin ? filters.clinicId || undefined : undefined,
          status: filters.status || undefined,
          priority: isSuperAdmin ? filters.priority || undefined : undefined,
          ticketType: filters.ticketType || undefined,
        });

        const payload = await api.get(`/support-tickets${query}`);
        const data = extractApiData(payload, []);

        setTickets(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err?.message || "Could not load support tickets.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      filters.clinicId,
      filters.priority,
      filters.status,
      filters.ticketType,
      isSuperAdmin,
      user,
    ],
  );

  useEffect(() => {
    if (!isBootstrapping && user && user.role === "super_admin") {
      loadClinics();
    }
  }, [isBootstrapping, loadClinics, user]);

  useEffect(() => {
    if (!isBootstrapping && user && canUseSupportPage(user)) {
      loadTickets();
    }
  }, [isBootstrapping, loadTickets, user]);

  const visibleTickets = useMemo(() => {
    let next = [...tickets];

    if (isSuperAdmin) {
      if (filters.fromDate || filters.toDate) {
        next = next.filter((ticket) =>
          isWithinDateRange(ticket.createdAt, filters.fromDate, filters.toDate),
        );
      }

      if (filters.unresolvedOnly) {
        next = next.filter(
          (ticket) =>
            ticket.status === "open" || ticket.status === "in_progress",
        );
      }

      next.sort((a, b) => {
        if (filters.sortBy === "oldest") {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }

        if (filters.sortBy === "recently_updated") {
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }

        if (filters.sortBy === "priority_high_first") {
          const diff =
            getPriorityRank(b.priority) - getPriorityRank(a.priority);
          if (diff !== 0) return diff;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }

        if (filters.sortBy === "priority_low_first") {
          const diff =
            getPriorityRank(a.priority) - getPriorityRank(b.priority);
          if (diff !== 0) return diff;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }

    return next;
  }, [
    filters.fromDate,
    filters.sortBy,
    filters.toDate,
    filters.unresolvedOnly,
    isSuperAdmin,
    tickets,
  ]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedTicketId(null);
      return;
    }

    if (!visibleTickets.length) {
      setSelectedTicketId(null);
      return;
    }

    const ticketStillExists = visibleTickets.some(
      (ticket) => Number(ticket.id) === Number(selectedTicketId),
    );

    if (!ticketStillExists) {
      setSelectedTicketId(visibleTickets[0].id);
    }
  }, [isSuperAdmin, selectedTicketId, visibleTickets]);

  const ticketStats = useMemo(() => {
    return visibleTickets.reduce(
      (accumulator, ticket) => {
        accumulator.total += 1;

        if (ticket.status === "open") accumulator.open += 1;
        if (ticket.status === "in_progress") accumulator.inProgress += 1;
        if (ticket.status === "resolved") accumulator.resolved += 1;
        if (ticket.status === "closed") accumulator.closed += 1;

        return accumulator;
      },
      {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
      },
    );
  }, [visibleTickets]);

  const selectedTicket = useMemo(() => {
    return (
      visibleTickets.find(
        (ticket) => Number(ticket.id) === Number(selectedTicketId),
      ) || null
    );
  }, [selectedTicketId, visibleTickets]);

  const selectedTicketParsed = useMemo(() => {
    return parseTicketDescription(selectedTicket?.description || "");
  }, [selectedTicket]);

  useEffect(() => {
    if (!isSuperAdmin || !selectedTicket) {
      setWorkspaceForm(EMPTY_WORKSPACE_FORM);
      return;
    }

    setWorkspaceForm({
      status: selectedTicket.status || "open",
      priority: selectedTicket.priority || "medium",
      title: selectedTicket.title || "",
      progressNote: "",
    });
  }, [isSuperAdmin, selectedTicket, selectedTicketId]);

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

  function updateWorkspaceForm(field, value) {
    setWorkspaceForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function closeCreateForm() {
    setIsCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
  }

  function startEditing(ticket) {
    const parsed = parseTicketDescription(ticket.description || "");

    setEditingTicketId(ticket.id);
    setEditForm({
      title: ticket.title || "",
      description: parsed.issueDescription || "",
    });
  }

  function stopEditing() {
    setEditingTicketId(null);
    setEditForm(EMPTY_EDIT_FORM);
  }

  function activateClinicContext(ticket, nextPath) {
    if (!isSuperAdmin) {
      return;
    }

    const clinicSelection = getClinicSelectionFromTicket(ticket);

    if (!clinicSelection) {
      setError("This ticket does not include clinic context.");
      setNotice("");
      return;
    }

    safeSetAdminClinic(clinicSelection);

    if (nextPath) {
      router.push(nextPath);
      return;
    }

    setError("");
    setNotice(`Selected clinic set to ${clinicSelection.name}.`);
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();

    if (!canCreateTickets) {
      return;
    }

    try {
      setIsSubmittingCreate(true);
      setError("");
      setNotice("");

      await api.post("/support-tickets", {
        ticketType: createForm.ticketType,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
      });

      closeCreateForm();
      setNotice("Support ticket created successfully.");
      await loadTickets({ refresh: true });
    } catch (err) {
      setError(err?.message || "Could not create support ticket.");
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();

    if (!editingTicketId) {
      return;
    }

    try {
      setIsSubmittingEdit(true);
      setError("");
      setNotice("");

      await api.patch(`/support-tickets/${editingTicketId}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
      });

      stopEditing();
      setNotice("Support ticket updated successfully.");
      await loadTickets({ refresh: true });
    } catch (err) {
      setError(err?.message || "Could not update support ticket.");
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  async function handleWorkspaceSubmit(event) {
    event.preventDefault();

    if (!selectedTicket || !isSuperAdmin) {
      return;
    }

    const nextTitle = workspaceForm.title.trim();
    const statusChanged = workspaceForm.status !== selectedTicket.status;
    const priorityChanged = workspaceForm.priority !== selectedTicket.priority;
    const titleChanged = nextTitle !== (selectedTicket.title || "");
    const progressNote = workspaceForm.progressNote.trim();

    if (!statusChanged && !priorityChanged && !titleChanged && !progressNote) {
      setNotice("No changes to save yet.");
      return;
    }

    try {
      setIsSubmittingWorkspace(true);
      setError("");
      setNotice("");

      const currentParsed = parseTicketDescription(
        selectedTicket.description || "",
      );
      let nextDescription = selectedTicket.description || "";

      if (progressNote || statusChanged) {
        const nextUpdates = [
          ...currentParsed.updates,
          {
            createdAt: new Date().toISOString(),
            status: workspaceForm.status,
            note:
              progressNote ||
              `Status updated to ${humanizeToken(workspaceForm.status)}.`,
          },
        ];

        nextDescription = buildTicketDescription(
          currentParsed.issueDescription,
          nextUpdates,
        );
      }

      await api.patch(`/support-tickets/${selectedTicket.id}`, {
        status: workspaceForm.status,
        priority: workspaceForm.priority,
        title: nextTitle,
        description: nextDescription,
      });

      setNotice("Ticket workspace saved successfully.");
      await loadTickets({ refresh: true });
    } catch (err) {
      setError(err?.message || "Could not save ticket progress.");
    } finally {
      setIsSubmittingWorkspace(false);
    }
  }

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading support"
        description="Checking your session and preparing the right support workspace."
        points={[
          "Verifying workspace access",
          "Loading support data",
          "Preparing role-specific support actions",
        ]}
      />
    );
  }

  if (!user) {
    return null;
  }

  if (!canUseSupportPage(user)) {
    return (
      <PagePlaceholder
        title="Redirecting"
        description="This support page is only available to clinic-side users and super admin."
        points={[
          "Owners can see clinic-wide tickets",
          "Receptionists see the tickets they created",
          "Super admin actively works tickets across clinics",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="support-header-row">
          <div className="stack-sm">
            <span className="small-label">
              {isSuperAdmin
                ? "Super admin support workspace"
                : user.role === "owner"
                  ? "Owner workspace"
                  : "Receptionist workspace"}
            </span>

            <h1>Support</h1>

            <p className="support-subtle">
              {isSuperAdmin
                ? "View all tickets, filter them by clinic, date, status, type, or priority, and keep a real progress trail while working tickets."
                : "Create tickets for bugs, data issues, and workflow blockers. Owners see clinic-wide tickets, while receptionists see the tickets they created."}
            </p>
          </div>

          <div className="support-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadTickets({ refresh: true })}
              disabled={
                isLoading ||
                isRefreshing ||
                isLoadingClinics ||
                isSubmittingCreate ||
                isSubmittingEdit ||
                isSubmittingWorkspace
              }
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            {canCreateTickets ? (
              <button
                type="button"
                className="secondary-button compact-button support-primary-button"
                onClick={() => setIsCreateOpen((current) => !current)}
                disabled={isSubmittingCreate || isSubmittingEdit}
              >
                {isCreateOpen ? "Close form" : "New ticket"}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "error-banner" : "support-notice-banner"}>
          {error || notice}
        </div>
      )}

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="small-label">Loaded</span>
          <strong>{ticketStats.total}</strong>
          <p className="support-subtle">
            Tickets in the current filtered view.
          </p>
        </article>

        <article className="metric-card">
          <span className="small-label">Open</span>
          <strong>{ticketStats.open}</strong>
          <p className="support-subtle">New tickets waiting for work.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">In progress</span>
          <strong>{ticketStats.inProgress}</strong>
          <p className="support-subtle">Tickets actively being worked on.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Resolved / Closed</span>
          <strong>{ticketStats.resolved + ticketStats.closed}</strong>
          <p className="support-subtle">Tickets that are no longer active.</p>
        </article>
      </section>

      {canCreateTickets && isCreateOpen ? (
        <section className="page-card stack">
          <div className="stack-sm">
            <span className="small-label">Create support ticket</span>
            <p className="support-subtle">
              Use this for bugs, feature requests, data issues, or workflow
              blockers.
            </p>
          </div>

          <form className="support-form" onSubmit={handleCreateSubmit}>
            <div className="support-form-grid">
              <label className="support-field">
                <span>Ticket type</span>
                <select
                  value={createForm.ticketType}
                  onChange={(event) =>
                    updateCreateForm("ticketType", event.target.value)
                  }
                  disabled={isSubmittingCreate}
                >
                  {TICKET_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {humanizeToken(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="support-field">
              <span>Title</span>
              <input
                type="text"
                value={createForm.title}
                onChange={(event) =>
                  updateCreateForm("title", event.target.value)
                }
                placeholder="Briefly describe the issue"
                maxLength={200}
                disabled={isSubmittingCreate}
                required
              />
            </label>

            <label className="support-field">
              <span>Description</span>
              <textarea
                value={createForm.description}
                onChange={(event) =>
                  updateCreateForm("description", event.target.value)
                }
                placeholder="What happened, what you expected, and anything the team should know"
                rows={6}
                maxLength={5000}
                disabled={isSubmittingCreate}
                required
              />
            </label>

            <div className="support-form-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={closeCreateForm}
                disabled={isSubmittingCreate}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="secondary-button compact-button support-primary-button"
                disabled={isSubmittingCreate}
              >
                {isSubmittingCreate ? "Creating..." : "Create ticket"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="page-card stack-sm">
        <div className="stack-sm">
          <span className="small-label">Filters</span>
          <p className="support-subtle">
            Narrow the ticket list by clinic, date range, status, type, or
            priority.
          </p>
        </div>

        <div className="support-filters-grid">
          {isSuperAdmin ? (
            <>
              <label className="support-field">
                <span>Clinic</span>
                <select
                  value={filters.clinicId}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      clinicId: event.target.value,
                    }))
                  }
                  disabled={isLoading || isRefreshing || isLoadingClinics}
                >
                  <option value="">All clinics</option>
                  {clinicOptions.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name || `Clinic #${clinic.id}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="support-field">
                <span>From date</span>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      fromDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="support-field">
                <span>To date</span>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      toDate: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : null}

          <label className="support-field">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              disabled={isLoading || isRefreshing}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {humanizeToken(option)}
                </option>
              ))}
            </select>
          </label>

          {isSuperAdmin ? (
            <label className="support-field">
              <span>Priority</span>
              <select
                value={filters.priority}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
                disabled={isLoading || isRefreshing}
              >
                <option value="">All priorities</option>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {humanizeToken(option)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="support-field">
            <span>Ticket type</span>
            <select
              value={filters.ticketType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  ticketType: event.target.value,
                }))
              }
              disabled={isLoading || isRefreshing}
            >
              <option value="">All types</option>
              {TICKET_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {humanizeToken(option)}
                </option>
              ))}
            </select>
          </label>

          {isSuperAdmin ? (
            <>
              <label className="support-field">
                <span>Sort by</span>
                <select
                  value={filters.sortBy}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      sortBy: event.target.value,
                    }))
                  }
                >
                  {SUPER_ADMIN_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="support-toggle">
                <input
                  type="checkbox"
                  checked={filters.unresolvedOnly}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      unresolvedOnly: event.target.checked,
                    }))
                  }
                />
                <span>Only unresolved tickets</span>
              </label>
            </>
          ) : null}

          <div className="support-filter-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() =>
                setFilters({
                  clinicId: "",
                  status: "",
                  priority: "",
                  ticketType: "",
                  fromDate: "",
                  toDate: "",
                  unresolvedOnly: false,
                  sortBy: "newest",
                })
              }
              disabled={
                isLoading ||
                isRefreshing ||
                (!filters.clinicId &&
                  !filters.status &&
                  !filters.priority &&
                  !filters.ticketType &&
                  !filters.fromDate &&
                  !filters.toDate &&
                  !filters.unresolvedOnly &&
                  filters.sortBy === "newest")
              }
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">
            {isSuperAdmin
              ? "Loading super admin support workspace…"
              : "Loading support tickets…"}
          </div>
        </section>
      ) : visibleTickets.length === 0 ? (
        <section className="page-card">
          <div className="empty-state">
            {isSuperAdmin
              ? "No support tickets matched the current workspace filters."
              : "No support tickets matched the current view."}
          </div>
        </section>
      ) : isSuperAdmin ? (
        <section className="support-workspace-grid">
          <section className="page-card stack support-list-panel">
            <div className="support-list-panel-header">
              <div className="stack-sm">
                <span className="small-label">All tickets</span>
                <p className="support-subtle">
                  Work from one filtered list instead of a default open queue.
                </p>
              </div>

              <span className="small-label">{visibleTickets.length}</span>
            </div>

            <div className="support-list">
              {visibleTickets.map((ticket) => {
                const parsed = parseTicketDescription(ticket.description || "");
                const isActive = Number(ticket.id) === Number(selectedTicketId);

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`support-list-card ${isActive ? "active" : ""}`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="support-list-card-topline">
                      <div className="support-ticket-topline">
                        <span className="small-label">
                          {humanizeToken(ticket.ticketType)}
                        </span>

                        <span
                          className={`status-pill ${getStatusTone(ticket.status)}`}
                        >
                          {humanizeToken(ticket.status)}
                        </span>

                        <span className="small-label support-clinic-chip">
                          {getClinicLabel(ticket.clinicId)}
                        </span>
                      </div>

                      <span
                        className={`support-priority-badge ${getPriorityTone(ticket.priority)}`}
                      >
                        {humanizeToken(ticket.priority)}
                      </span>
                    </div>

                    <strong className="support-list-card-title">
                      {ticket.title}
                    </strong>

                    <div className="support-list-card-meta">
                      <span>#{ticket.id}</span>
                      <span>Created {formatDateTime(ticket.createdAt)}</span>
                      <span>Updated {formatDateTime(ticket.updatedAt)}</span>
                    </div>

                    <div className="support-list-card-flags">
                      <span className="small-label">
                        {parsed.updates.length > 0
                          ? `${parsed.updates.length} progress update${parsed.updates.length === 1 ? "" : "s"}`
                          : "No progress yet"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="support-workspace-column stack">
            {selectedTicket ? (
              <>
                <section className="page-card stack">
                  <div className="support-ticket-header">
                    <div className="stack-sm">
                      <div className="support-ticket-topline">
                        <span className="small-label">
                          {humanizeToken(selectedTicket.ticketType)}
                        </span>

                        <span
                          className={`status-pill ${getStatusTone(selectedTicket.status)}`}
                        >
                          {humanizeToken(selectedTicket.status)}
                        </span>

                        <span className="small-label support-clinic-chip">
                          {getClinicLabel(selectedTicket.clinicId)}
                        </span>
                      </div>

                      <h3 className="support-ticket-title">
                        {selectedTicket.title}
                      </h3>
                    </div>

                    <span
                      className={`support-priority-badge ${getPriorityTone(
                        selectedTicket.priority,
                      )}`}
                    >
                      {humanizeToken(selectedTicket.priority)}
                    </span>
                  </div>

                  <div className="support-ticket-meta">
                    <span>Ticket #{selectedTicket.id}</span>
                    <span>
                      Created {formatDateTime(selectedTicket.createdAt)}
                    </span>
                    <span>
                      Updated {formatDateTime(selectedTicket.updatedAt)}
                    </span>
                    {selectedTicket.resolvedAt ? (
                      <span>
                        Resolved {formatDateTime(selectedTicket.resolvedAt)}
                      </span>
                    ) : null}
                  </div>

                  <div className="support-ticket-actions">
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() => activateClinicContext(selectedTicket)}
                    >
                      Use this clinic workspace
                    </button>

                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() =>
                        activateClinicContext(selectedTicket, "/clinic-profile")
                      }
                    >
                      Open clinic profile
                    </button>

                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() =>
                        activateClinicContext(selectedTicket, "/staff")
                      }
                    >
                      Open clinic staff
                    </button>

                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() =>
                        activateClinicContext(selectedTicket, "/integrations")
                      }
                    >
                      Open integrations
                    </button>
                  </div>
                </section>

                <section className="page-card stack">
                  <div className="stack-sm">
                    <span className="small-label">Reported issue</span>
                    <p className="support-ticket-description">
                      {selectedTicketParsed.issueDescription ||
                        "No original issue description was provided."}
                    </p>
                  </div>
                </section>

                <section className="page-card stack">
                  <div className="stack-sm">
                    <span className="small-label">Progress trail</span>
                    <p className="support-subtle">
                      Every save logs what was done and what the current state
                      is.
                    </p>
                  </div>

                  {selectedTicketParsed.updates.length > 0 ? (
                    <div className="support-timeline">
                      {[...selectedTicketParsed.updates]
                        .slice()
                        .reverse()
                        .map((entry, index) => (
                          <article
                            className="support-timeline-item"
                            key={`${entry.createdAt}-${index}`}
                          >
                            <div className="support-timeline-item-topline">
                              <span
                                className={`status-pill ${getStatusTone(entry.status)}`}
                              >
                                {humanizeToken(entry.status)}
                              </span>
                              <span className="small-label">
                                {formatDateTime(entry.createdAt)}
                              </span>
                            </div>

                            <p className="support-ticket-description">
                              {entry.note}
                            </p>
                          </article>
                        ))}
                    </div>
                  ) : (
                    <div className="empty-state support-inline-empty">
                      No progress updates yet.
                    </div>
                  )}
                </section>

                <section className="page-card stack">
                  <div className="stack-sm">
                    <span className="small-label">Active workspace</span>
                    <p className="support-subtle">
                      Set priority, move the ticket through status, and log
                      exactly what work has been done.
                    </p>
                  </div>

                  <form
                    className="support-form stack"
                    onSubmit={handleWorkspaceSubmit}
                  >
                    <div className="support-form-grid">
                      <label className="support-field">
                        <span>Status</span>
                        <select
                          value={workspaceForm.status}
                          onChange={(event) =>
                            updateWorkspaceForm("status", event.target.value)
                          }
                          disabled={isSubmittingWorkspace}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {humanizeToken(option)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="support-field">
                        <span>Priority</span>
                        <select
                          value={workspaceForm.priority}
                          onChange={(event) =>
                            updateWorkspaceForm("priority", event.target.value)
                          }
                          disabled={isSubmittingWorkspace}
                        >
                          {PRIORITY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {humanizeToken(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="support-field">
                      <span>Title</span>
                      <input
                        type="text"
                        value={workspaceForm.title}
                        onChange={(event) =>
                          updateWorkspaceForm("title", event.target.value)
                        }
                        maxLength={200}
                        disabled={isSubmittingWorkspace}
                        required
                      />
                    </label>

                    <label className="support-field">
                      <span>Progress update</span>
                      <textarea
                        value={workspaceForm.progressNote}
                        onChange={(event) =>
                          updateWorkspaceForm(
                            "progressNote",
                            event.target.value,
                          )
                        }
                        rows={6}
                        maxLength={5000}
                        disabled={isSubmittingWorkspace}
                        placeholder="What was done, what was checked, blockers, next step, or current progress."
                      />
                    </label>

                    <div className="support-form-actions">
                      <button
                        type="submit"
                        className="secondary-button compact-button support-primary-button"
                        disabled={isSubmittingWorkspace}
                      >
                        {isSubmittingWorkspace ? "Saving..." : "Save progress"}
                      </button>
                    </div>
                  </form>
                </section>
              </>
            ) : (
              <section className="page-card">
                <div className="empty-state">
                  Select a ticket from the list to start working on it.
                </div>
              </section>
            )}
          </div>
        </section>
      ) : (
        <section className="stack">
          {visibleTickets.map((ticket) => {
            const isEditing = Number(editingTicketId) === Number(ticket.id);
            const parsed = parseTicketDescription(ticket.description || "");

            return (
              <article
                key={ticket.id}
                className="page-card support-ticket-card"
              >
                {!isEditing ? (
                  <div className="stack">
                    <div className="support-ticket-header">
                      <div className="stack-sm">
                        <div className="support-ticket-topline">
                          <span className="small-label">
                            {humanizeToken(ticket.ticketType)}
                          </span>

                          <span
                            className={`status-pill ${getStatusTone(ticket.status)}`}
                          >
                            {humanizeToken(ticket.status)}
                          </span>
                        </div>

                        <h3 className="support-ticket-title">{ticket.title}</h3>
                      </div>

                      <div className="support-ticket-right">
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => startEditing(ticket)}
                          disabled={isSubmittingCreate || isSubmittingEdit}
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <p className="support-ticket-description">
                      {parsed.issueDescription || "No description provided."}
                    </p>

                    <div className="support-ticket-meta">
                      <span>Ticket #{ticket.id}</span>
                      <span>Created {formatDateTime(ticket.createdAt)}</span>
                      <span>Updated {formatDateTime(ticket.updatedAt)}</span>
                    </div>
                  </div>
                ) : (
                  <form
                    className="support-form stack"
                    onSubmit={handleEditSubmit}
                  >
                    <div className="support-ticket-header">
                      <div className="stack-sm">
                        <span className="small-label">
                          Edit ticket #{ticket.id}
                        </span>
                        <h3 className="support-ticket-title">{ticket.title}</h3>
                      </div>

                      <span
                        className={`status-pill ${getStatusTone(ticket.status)}`}
                      >
                        {humanizeToken(ticket.status)}
                      </span>
                    </div>

                    <label className="support-field">
                      <span>Title</span>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(event) =>
                          updateEditForm("title", event.target.value)
                        }
                        maxLength={200}
                        disabled={isSubmittingEdit}
                        required
                      />
                    </label>

                    <label className="support-field">
                      <span>Description</span>
                      <textarea
                        value={editForm.description}
                        onChange={(event) =>
                          updateEditForm("description", event.target.value)
                        }
                        rows={6}
                        maxLength={5000}
                        disabled={isSubmittingEdit}
                        required
                      />
                    </label>

                    <div className="support-form-actions">
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={stopEditing}
                        disabled={isSubmittingEdit}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="secondary-button compact-button support-primary-button"
                        disabled={isSubmittingEdit}
                      >
                        {isSubmittingEdit ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </section>
      )}

      <style jsx>{`
        .support-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .support-header-actions,
        .support-ticket-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .support-subtle {
          margin: 0;
          color: var(--muted);
        }

        .support-notice-banner {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          color: var(--text);
          padding: 14px 16px;
          border-radius: 16px;
        }

        .support-primary-button {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }

        .support-primary-button:hover:not(:disabled) {
          background: var(--surface-soft);
        }

        .support-form,
        .support-form-grid,
        .support-filters-grid {
          display: grid;
          gap: 16px;
        }

        .support-form-grid,
        .support-filters-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .support-field {
          display: grid;
          gap: 8px;
        }

        .support-field span {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .support-field input,
        .support-field select,
        .support-field textarea {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          border-radius: 14px;
          padding: 12px 14px;
          font: inherit;
          outline: none;
        }

        .support-field input:focus,
        .support-field select:focus,
        .support-field textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }

        .support-field textarea {
          resize: vertical;
          min-height: 140px;
        }

        .support-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          padding-top: 22px;
          color: var(--text);
        }

        .support-form-actions,
        .support-filter-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .support-workspace-grid {
          display: grid;
          grid-template-columns: minmax(340px, 430px) minmax(0, 1fr);
          gap: 16px;
          align-items: start;
        }

        .support-list-panel,
        .support-workspace-column {
          min-width: 0;
        }

        .support-list-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .support-list {
          display: grid;
          gap: 12px;
        }

        .support-list-card {
          width: 100%;
          text-align: left;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 16px;
          padding: 14px;
          display: grid;
          gap: 10px;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease;
          cursor: pointer;
        }

        .support-list-card:hover {
          transform: translateY(-1px);
          border-color: var(--accent);
        }

        .support-list-card.active {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--focus-ring);
          background: var(--accent-soft);
        }

        .support-list-card-topline {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        }

        .support-list-card-title {
          color: var(--text);
          line-height: 1.35;
        }

        .support-list-card-meta,
        .support-list-card-flags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 12px;
          color: var(--muted);
          font-size: 13px;
        }

        .support-ticket-card {
          border: 1px solid var(--border);
        }

        .support-ticket-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .support-ticket-topline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .support-ticket-title {
          margin: 0;
          font-size: 1.15rem;
          line-height: 1.35;
        }

        .support-ticket-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .support-priority-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          border-radius: 999px;
          padding: 0 12px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          border: 1px solid var(--border);
          background: var(--surface-soft);
        }

        .support-priority-high {
          border-color: rgba(220, 38, 38, 0.35);
        }

        .support-priority-medium {
          border-color: rgba(180, 120, 20, 0.35);
        }

        .support-priority-low {
          border-color: rgba(34, 139, 34, 0.35);
        }

        .support-clinic-chip {
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 10px;
          background: var(--surface-soft);
        }

        .support-ticket-description {
          margin: 0;
          white-space: pre-wrap;
          color: var(--text);
          word-break: break-word;
        }

        .support-ticket-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          color: var(--muted);
          font-size: 13px;
        }

        .support-timeline {
          display: grid;
          gap: 12px;
        }

        .support-timeline-item {
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface-soft);
          padding: 14px;
          display: grid;
          gap: 10px;
        }

        .support-timeline-item-topline {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .support-inline-empty {
          padding: 20px 0;
        }

        @media (max-width: 1120px) {
          .support-workspace-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .support-ticket-right {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
