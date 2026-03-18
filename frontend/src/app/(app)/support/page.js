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

const EMPTY_CREATE_FORM = {
  ticketType: "support",
  priority: "medium",
  title: "",
  description: "",
};

const EMPTY_EDIT_FORM = {
  priority: "medium",
  title: "",
  description: "",
};

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

function canUseClinicSupport(user) {
  if (!user) return false;
  return user.role === "owner" || user.role === "receptionist";
}

export default function SupportPage() {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    ticketType: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isBootstrapping && user && !canUseClinicSupport(user) && user.role !== "super_admin") {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const showSuperAdminPlaceholder = user?.role === "super_admin";

  const loadTickets = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user || !canUseClinicSupport(user) || showSuperAdminPlaceholder) {
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
          status: filters.status || undefined,
          priority: filters.priority || undefined,
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
    [filters.priority, filters.status, filters.ticketType, showSuperAdminPlaceholder, user]
  );

  useEffect(() => {
    if (!isBootstrapping && user && canUseClinicSupport(user) && !showSuperAdminPlaceholder) {
      loadTickets();
    }
  }, [isBootstrapping, loadTickets, showSuperAdminPlaceholder, user]);

  const ticketStats = useMemo(() => {
    return tickets.reduce(
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
      }
    );
  }, [tickets]);

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

  function resetCreateForm() {
    setCreateForm(EMPTY_CREATE_FORM);
  }

  function closeCreateForm() {
    setIsCreateOpen(false);
    resetCreateForm();
  }

  function startEditing(ticket) {
    setEditingTicketId(ticket.id);
    setEditForm({
      priority: ticket.priority || "medium",
      title: ticket.title || "",
      description: ticket.description || "",
    });
  }

  function stopEditing() {
    setEditingTicketId(null);
    setEditForm(EMPTY_EDIT_FORM);
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmittingCreate(true);
      setError("");
      setNotice("");

      await api.post("/support-tickets", {
        ticketType: createForm.ticketType,
        priority: createForm.priority,
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
        priority: editForm.priority,
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

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading support"
        description="Checking your session and preparing clinic support tickets."
        points={[
          "Verifying workspace access",
          "Loading ticket history",
          "Preparing support actions",
        ]}
      />
    );
  }

  if (!user) {
    return null;
  }

  if (showSuperAdminPlaceholder) {
    return (
      <PagePlaceholder
        title="Super admin support stays separate"
        description="This page is for clinic-side owners and receptionists. Super admin ticket resolution should live in a separate admin workspace."
        points={[
          "Clinic users create and view support tickets here",
          "Super admin is the resolver/status handler",
          "Admin support tooling should be built separately",
        ]}
      />
    );
  }

  if (!canUseClinicSupport(user)) {
    return (
      <PagePlaceholder
        title="Redirecting"
        description="This support page is only available to clinic-side users."
        points={[
          "Owners can see clinic-wide tickets",
          "Receptionists see the tickets they created",
          "Platform-side workflows stay separate",
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
              {user.role === "owner" ? "Owner workspace" : "Receptionist workspace"}
            </span>
            <h1>Support</h1>
            <p className="support-subtle">
              Create tickets for bugs, data issues, and workflow blockers. Owners see clinic-wide
              tickets, while receptionists see the tickets they created.
            </p>
          </div>

          <div className="support-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadTickets({ refresh: true })}
              disabled={isLoading || isRefreshing || isSubmittingCreate || isSubmittingEdit}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="secondary-button compact-button support-primary-button"
              onClick={() => setIsCreateOpen((current) => !current)}
              disabled={isSubmittingCreate || isSubmittingEdit}
            >
              {isCreateOpen ? "Close form" : "New ticket"}
            </button>
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
          <p className="support-subtle">
            Fresh tickets waiting for action.
          </p>
        </article>

        <article className="metric-card">
          <span className="small-label">In progress</span>
          <strong>{ticketStats.inProgress}</strong>
          <p className="support-subtle">
            Tickets actively being worked on.
          </p>
        </article>

        <article className="metric-card">
          <span className="small-label">Resolved / Closed</span>
          <strong>{ticketStats.resolved + ticketStats.closed}</strong>
          <p className="support-subtle">
            Tickets that are no longer active.
          </p>
        </article>
      </section>

      {isCreateOpen ? (
        <section className="page-card stack">
          <div className="stack-sm">
            <span className="small-label">Create support ticket</span>
            <p className="support-subtle">
              Use this for bugs, feature requests, data issues, or workflow blockers.
            </p>
          </div>

          <form className="support-form" onSubmit={handleCreateSubmit}>
            <div className="support-form-grid">
              <label className="support-field">
                <span>Ticket type</span>
                <select
                  value={createForm.ticketType}
                  onChange={(event) => updateCreateForm("ticketType", event.target.value)}
                  disabled={isSubmittingCreate}
                >
                  {TICKET_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {humanizeToken(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="support-field">
                <span>Priority</span>
                <select
                  value={createForm.priority}
                  onChange={(event) => updateCreateForm("priority", event.target.value)}
                  disabled={isSubmittingCreate}
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
                value={createForm.title}
                onChange={(event) => updateCreateForm("title", event.target.value)}
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
                onChange={(event) => updateCreateForm("description", event.target.value)}
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
            Narrow the ticket list by status, priority, or ticket type.
          </p>
        </div>

        <div className="support-filters-grid">
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

          <div className="support-filter-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() =>
                setFilters({
                  status: "",
                  priority: "",
                  ticketType: "",
                })
              }
              disabled={
                isLoading ||
                isRefreshing ||
                (!filters.status && !filters.priority && !filters.ticketType)
              }
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading support tickets…</div>
        </section>
      ) : tickets.length === 0 ? (
        <section className="page-card">
          <div className="empty-state">
            No support tickets matched the current view.
          </div>
        </section>
      ) : (
        <section className="stack">
          {tickets.map((ticket) => {
            const isEditing = Number(editingTicketId) === Number(ticket.id);

            return (
              <article key={ticket.id} className="page-card support-ticket-card">
                {!isEditing ? (
                  <div className="stack">
                    <div className="support-ticket-header">
                      <div className="stack-sm">
                        <div className="support-ticket-topline">
                          <span className="small-label">
                            {humanizeToken(ticket.ticketType)}
                          </span>

                          <span className={`status-pill ${getStatusTone(ticket.status)}`}>
                            {humanizeToken(ticket.status)}
                          </span>
                        </div>

                        <h3 className="support-ticket-title">{ticket.title}</h3>
                      </div>

                      <div className="support-ticket-right">
                        <span className={`support-priority-badge ${getPriorityTone(ticket.priority)}`}>
                          {humanizeToken(ticket.priority)} priority
                        </span>

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
                      {ticket.description}
                    </p>

                    <div className="support-ticket-meta">
                      <span>Ticket #{ticket.id}</span>
                      <span>Created {formatDateTime(ticket.createdAt)}</span>
                      <span>Updated {formatDateTime(ticket.updatedAt)}</span>
                      {ticket.resolvedAt ? (
                        <span>Resolved {formatDateTime(ticket.resolvedAt)}</span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <form className="support-form stack" onSubmit={handleEditSubmit}>
                    <div className="support-ticket-header">
                      <div className="stack-sm">
                        <span className="small-label">Edit ticket #{ticket.id}</span>
                        <h3 className="support-ticket-title">{ticket.title}</h3>
                      </div>

                      <span className={`status-pill ${getStatusTone(ticket.status)}`}>
                        {humanizeToken(ticket.status)}
                      </span>
                    </div>

                    <div className="support-form-grid">
                      <label className="support-field">
                        <span>Priority</span>
                        <select
                          value={editForm.priority}
                          onChange={(event) => updateEditForm("priority", event.target.value)}
                          disabled={isSubmittingEdit}
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
                        value={editForm.title}
                        onChange={(event) => updateEditForm("title", event.target.value)}
                        maxLength={200}
                        disabled={isSubmittingEdit}
                        required
                      />
                    </label>

                    <label className="support-field">
                      <span>Description</span>
                      <textarea
                        value={editForm.description}
                        onChange={(event) => updateEditForm("description", event.target.value)}
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

        .support-header-actions {
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

        .support-form-actions,
        .support-filter-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
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

        .support-ticket-description {
          margin: 0;
          white-space: pre-wrap;
          color: var(--text);
        }

        .support-ticket-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          color: var(--muted);
          font-size: 13px;
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