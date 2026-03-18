"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, buildQuery, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const REQUEST_TYPE_OPTIONS = [
  { value: "add_receptionist", label: "Add receptionist" },
  { value: "remove_receptionist", label: "Remove receptionist" },
  { value: "add_owner", label: "Add owner" },
  { value: "remove_owner", label: "Remove owner" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const EMPTY_CREATE_FORM = {
  requestType: "add_receptionist",
  targetUserId: "",
  targetName: "",
  targetEmail: "",
  targetPhone: "",
  requestNote: "",
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
  if (status === "approved") return "done";
  if (status === "rejected" || status === "cancelled") return "cancelled";
  return "pending";
}

function getRequestTargetRole(requestType) {
  if (
    requestType === "add_receptionist" ||
    requestType === "remove_receptionist"
  ) {
    return "receptionist";
  }

  return "owner";
}

function canUseStaffRequests(user) {
  return user?.role === "owner";
}

function isRemovalRequest(requestType) {
  return requestType === "remove_owner" || requestType === "remove_receptionist";
}

function getRemovalLabel(requestType) {
  return requestType === "remove_owner" ? "owner" : "receptionist";
}

export default function StaffRequestsPage() {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const [requests, setRequests] = useState([]);
  const [owners, setOwners] = useState([]);
  const [receptionists, setReceptionists] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    requestType: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isBootstrapping && user && !canUseStaffRequests(user) && user.role !== "super_admin") {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const showSuperAdminPlaceholder = user?.role === "super_admin";

  const loadRequests = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user || !canUseStaffRequests(user) || showSuperAdminPlaceholder) {
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
          requestType: filters.requestType || undefined,
        });

        const payload = await api.get(`/staff-requests${query}`);
        const data = extractApiData(payload, []);

        setRequests(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err?.message || "Could not load staff requests.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters.requestType, filters.status, showSuperAdminPlaceholder, user]
  );

  const loadStaffOptions = useCallback(async () => {
    if (!user || !canUseStaffRequests(user) || showSuperAdminPlaceholder) {
      return;
    }

    try {
      setIsStaffLoading(true);

      const ownerQuery = buildQuery({
        role: "owner",
        status: "active",
      });

      const receptionistQuery = buildQuery({
        role: "receptionist",
        status: "active",
      });

      const [ownersPayload, receptionistsPayload] = await Promise.all([
        api.get(`/users${ownerQuery}`),
        api.get(`/users${receptionistQuery}`),
      ]);

      const ownersData = extractApiData(ownersPayload, []);
      const receptionistsData = extractApiData(receptionistsPayload, []);

      const ownerOptions = (Array.isArray(ownersData) ? ownersData : []).filter(
        (ownerItem) => Number(ownerItem.id) !== Number(user.id)
      );

      setOwners(ownerOptions);
      setReceptionists(Array.isArray(receptionistsData) ? receptionistsData : []);
    } catch (err) {
      setError(err?.message || "Could not load clinic staff.");
    } finally {
      setIsStaffLoading(false);
    }
  }, [showSuperAdminPlaceholder, user]);

  useEffect(() => {
    if (!isBootstrapping && user && canUseStaffRequests(user) && !showSuperAdminPlaceholder) {
      loadRequests();
      loadStaffOptions();
    }
  }, [isBootstrapping, loadRequests, loadStaffOptions, showSuperAdminPlaceholder, user]);

  const requestStats = useMemo(() => {
    return requests.reduce(
      (accumulator, request) => {
        accumulator.total += 1;

        if (request.status === "pending") accumulator.pending += 1;
        if (request.status === "approved") accumulator.approved += 1;
        if (request.status === "rejected") accumulator.rejected += 1;
        if (request.status === "cancelled") accumulator.cancelled += 1;

        return accumulator;
      },
      {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
      }
    );
  }, [requests]);

  const selectedRemovalUser = useMemo(() => {
    if (!createForm.targetUserId) return null;

    const source =
      createForm.requestType === "remove_owner" ? owners : receptionists;

    return (
      source.find((item) => Number(item.id) === Number(createForm.targetUserId)) || null
    );
  }, [createForm.requestType, createForm.targetUserId, owners, receptionists]);

  function updateCreateForm(field, value) {
    setCreateForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetCreateForm(nextType = "add_receptionist") {
    setCreateForm({
      requestType: nextType,
      targetUserId: "",
      targetName: "",
      targetEmail: "",
      targetPhone: "",
      requestNote: "",
    });
  }

  function closeCreateForm() {
    setIsCreateOpen(false);
    resetCreateForm();
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmittingCreate(true);
      setError("");
      setNotice("");

      let payload;

      if (isRemovalRequest(createForm.requestType)) {
        if (!selectedRemovalUser) {
          throw new Error(`Please select the ${getRemovalLabel(createForm.requestType)} to remove.`);
        }

        payload = {
          requestType: createForm.requestType,
          targetUserId: Number(selectedRemovalUser.id),
          targetName: selectedRemovalUser.fullName || selectedRemovalUser.email,
          targetEmail: selectedRemovalUser.email || null,
          targetPhone: selectedRemovalUser.phone || null,
          targetRole: getRequestTargetRole(createForm.requestType),
          requestNote: createForm.requestNote.trim() || null,
        };
      } else {
        payload = {
          requestType: createForm.requestType,
          targetName: createForm.targetName.trim(),
          targetEmail: createForm.targetEmail.trim(),
          targetPhone: createForm.targetPhone.trim() || null,
          targetRole: getRequestTargetRole(createForm.requestType),
          requestNote: createForm.requestNote.trim() || null,
        };
      }

      await api.post("/staff-requests", payload);

      closeCreateForm();
      setNotice("Staff request created successfully.");
      await loadRequests({ refresh: true });
      await loadStaffOptions();
    } catch (err) {
      setError(err?.message || "Could not create staff request.");
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading staff requests"
        description="Checking your session and preparing clinic staff requests."
        points={[
          "Verifying owner access",
          "Loading clinic request history",
          "Preparing staff-request actions",
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
        title="Super admin decisioning stays separate"
        description="This page is for clinic owners creating requests. Super admin approval or rejection should live in a separate admin workspace."
        points={[
          "Owners create staff requests here",
          "Super admin approves or rejects them elsewhere",
          "This keeps clinic and admin workflows separate",
        ]}
      />
    );
  }

  if (!canUseStaffRequests(user)) {
    return (
      <PagePlaceholder
        title="Owner-only page"
        description="Staff requests are currently owner-centric. Receptionists cannot access this workflow."
        points={[
          "Owners create clinic staff requests",
          "Receptionists stay out of approval flows",
          "Super admin remains the final decision maker",
        ]}
      />
    );
  }

  const removalOptions =
    createForm.requestType === "remove_owner" ? owners : receptionists;

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="staff-requests-header-row">
          <div className="stack-sm">
            <span className="small-label">Owner workspace</span>
            <h1>Staff Requests</h1>
            <p className="staff-requests-subtle">
              Create clinic staff and ownership requests for super admin approval.
            </p>
          </div>

          <div className="staff-requests-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadRequests({ refresh: true })}
              disabled={isLoading || isRefreshing || isSubmittingCreate}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="secondary-button compact-button staff-requests-primary-button"
              onClick={() => setIsCreateOpen((current) => !current)}
              disabled={isSubmittingCreate}
            >
              {isCreateOpen ? "Close form" : "New request"}
            </button>
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "error-banner" : "staff-requests-notice-banner"}>
          {error || notice}
        </div>
      )}

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="small-label">Loaded</span>
          <strong>{requestStats.total}</strong>
          <p className="staff-requests-subtle">Requests in the current filtered view.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Pending</span>
          <strong>{requestStats.pending}</strong>
          <p className="staff-requests-subtle">Requests waiting for super admin decision.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Approved</span>
          <strong>{requestStats.approved}</strong>
          <p className="staff-requests-subtle">Requests already approved.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Rejected / Cancelled</span>
          <strong>{requestStats.rejected + requestStats.cancelled}</strong>
          <p className="staff-requests-subtle">Requests that did not move forward.</p>
        </article>
      </section>

      {isCreateOpen ? (
        <section className="page-card stack">
          <div className="stack-sm">
            <span className="small-label">Create staff request</span>
            <p className="staff-requests-subtle">
              Owners can add or remove receptionists, and add or remove owners through super admin approval.
            </p>
          </div>

          <form className="staff-requests-form" onSubmit={handleCreateSubmit}>
            <div className="staff-requests-form-grid">
              <label className="staff-requests-field">
                <span>Request type</span>
                <select
                  value={createForm.requestType}
                  onChange={(event) => resetCreateForm(event.target.value)}
                  disabled={isSubmittingCreate}
                >
                  {REQUEST_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {isRemovalRequest(createForm.requestType) ? (
              <>
                <label className="staff-requests-field">
                  <span>
                    Select {getRemovalLabel(createForm.requestType)} to remove
                  </span>
                  <select
                    value={createForm.targetUserId}
                    onChange={(event) => updateCreateForm("targetUserId", event.target.value)}
                    disabled={isSubmittingCreate || isStaffLoading || removalOptions.length === 0}
                    required
                  >
                    <option value="">
                      {isStaffLoading
                        ? "Loading staff..."
                        : removalOptions.length === 0
                          ? `No removable ${getRemovalLabel(createForm.requestType)} found`
                          : `Choose a ${getRemovalLabel(createForm.requestType)}`}
                    </option>

                    {removalOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fullName || item.email} {item.email ? `(${item.email})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedRemovalUser ? (
                  <div className="staff-requests-inline-summary">
                    <div>
                      <strong>{selectedRemovalUser.fullName || `Unnamed ${getRemovalLabel(createForm.requestType)}`}</strong>
                    </div>
                    <div>{selectedRemovalUser.email || "No email available"}</div>
                    {selectedRemovalUser.phone ? (
                      <div>{selectedRemovalUser.phone}</div>
                    ) : null}
                    <div className="staff-requests-warning">
                      This request will send a removal/deactivation request to super admin for approval.
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="staff-requests-form-grid">
                  <label className="staff-requests-field">
                    <span>
                      {createForm.requestType === "add_receptionist"
                        ? "Receptionist name"
                        : "Owner name"}
                    </span>
                    <input
                      type="text"
                      value={createForm.targetName}
                      onChange={(event) => updateCreateForm("targetName", event.target.value)}
                      placeholder="Enter full name"
                      maxLength={200}
                      disabled={isSubmittingCreate}
                      required
                    />
                  </label>

                  <label className="staff-requests-field">
                    <span>
                      {createForm.requestType === "add_receptionist"
                        ? "Receptionist email"
                        : "Owner email"}
                    </span>
                    <input
                      type="email"
                      value={createForm.targetEmail}
                      onChange={(event) => updateCreateForm("targetEmail", event.target.value)}
                      placeholder="Enter email address"
                      maxLength={200}
                      disabled={isSubmittingCreate}
                      required
                    />
                  </label>
                </div>

                <label className="staff-requests-field">
                  <span>Phone</span>
                  <input
                    type="text"
                    value={createForm.targetPhone}
                    onChange={(event) => updateCreateForm("targetPhone", event.target.value)}
                    placeholder="Optional phone number"
                    maxLength={30}
                    disabled={isSubmittingCreate}
                  />
                </label>
              </>
            )}

            <label className="staff-requests-field">
              <span>Request note</span>
              <textarea
                value={createForm.requestNote}
                onChange={(event) => updateCreateForm("requestNote", event.target.value)}
                placeholder={
                  isRemovalRequest(createForm.requestType)
                    ? "Add a short confirmation or removal reason"
                    : "Why this request is needed"
                }
                rows={5}
                maxLength={1000}
                disabled={isSubmittingCreate}
              />
            </label>

            <div className="staff-requests-form-actions">
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
                className="secondary-button compact-button staff-requests-primary-button"
                disabled={
                  isSubmittingCreate ||
                  (isRemovalRequest(createForm.requestType) && removalOptions.length === 0)
                }
              >
                {isSubmittingCreate ? "Creating..." : "Create request"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="page-card stack-sm">
        <div className="stack-sm">
          <span className="small-label">Filters</span>
          <p className="staff-requests-subtle">
            Narrow the request list by status or request type.
          </p>
        </div>

        <div className="staff-requests-filters-grid">
          <label className="staff-requests-field">
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
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="staff-requests-field">
            <span>Request type</span>
            <select
              value={filters.requestType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  requestType: event.target.value,
                }))
              }
              disabled={isLoading || isRefreshing}
            >
              <option value="">All request types</option>
              {REQUEST_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="staff-requests-filter-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() =>
                setFilters({
                  status: "",
                  requestType: "",
                })
              }
              disabled={
                isLoading ||
                isRefreshing ||
                (!filters.status && !filters.requestType)
              }
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading staff requests…</div>
        </section>
      ) : requests.length === 0 ? (
        <section className="page-card">
          <div className="empty-state">
            No staff requests matched the current view.
          </div>
        </section>
      ) : (
        <section className="stack">
          {requests.map((request) => (
            <article key={request.id} className="page-card staff-request-card">
              <div className="stack">
                <div className="staff-request-header">
                  <div className="stack-sm">
                    <div className="staff-request-topline">
                      <span className="small-label">
                        {humanizeToken(request.requestType)}
                      </span>

                      <span className={`status-pill ${getStatusTone(request.status)}`}>
                        {humanizeToken(request.status)}
                      </span>
                    </div>

                    <h3 className="staff-request-title">
                      {request.targetName || "Unnamed target"}
                    </h3>
                  </div>

                  <div className="staff-request-side-meta">
                    <span className="small-label">Request #{request.id}</span>
                    <span className="small-label">
                      {humanizeToken(request.targetRole || getRequestTargetRole(request.requestType))}
                    </span>
                  </div>
                </div>

                <div className="staff-request-details-grid">
                  <div className="staff-request-detail-card">
                    <span className="small-label">Target email</span>
                    <strong>{request.targetEmail || "Not provided"}</strong>
                  </div>

                  <div className="staff-request-detail-card">
                    <span className="small-label">Target phone</span>
                    <strong>{request.targetPhone || "Not provided"}</strong>
                  </div>

                  <div className="staff-request-detail-card">
                    <span className="small-label">Created</span>
                    <strong>{formatDateTime(request.createdAt)}</strong>
                  </div>

                  <div className="staff-request-detail-card">
                    <span className="small-label">Approved at</span>
                    <strong>{request.approvedAt ? formatDateTime(request.approvedAt) : "Not decided yet"}</strong>
                  </div>
                </div>

                {request.requestNote ? (
                  <div className="stack-sm">
                    <span className="small-label">Owner note</span>
                    <p className="staff-request-copy">{request.requestNote}</p>
                  </div>
                ) : null}

                {request.adminNote ? (
                  <div className="stack-sm">
                    <span className="small-label">Admin note</span>
                    <p className="staff-request-copy">{request.adminNote}</p>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}

      <style jsx>{`
        .staff-requests-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .staff-requests-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .staff-requests-subtle {
          margin: 0;
          color: var(--muted);
        }

        .staff-requests-notice-banner {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          color: var(--text);
          padding: 14px 16px;
          border-radius: 16px;
        }

        .staff-requests-primary-button {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }

        .staff-requests-primary-button:hover:not(:disabled) {
          background: var(--surface-soft);
        }

        .staff-requests-form,
        .staff-requests-form-grid,
        .staff-requests-filters-grid,
        .staff-request-details-grid {
          display: grid;
          gap: 16px;
        }

        .staff-requests-form-grid,
        .staff-requests-filters-grid,
        .staff-request-details-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .staff-requests-field {
          display: grid;
          gap: 8px;
        }

        .staff-requests-field span {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .staff-requests-field input,
        .staff-requests-field select,
        .staff-requests-field textarea {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          border-radius: 14px;
          padding: 12px 14px;
          font: inherit;
          outline: none;
        }

        .staff-requests-field input:focus,
        .staff-requests-field select:focus,
        .staff-requests-field textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }

        .staff-requests-field textarea {
          resize: vertical;
          min-height: 120px;
        }

        .staff-requests-form-actions,
        .staff-requests-filter-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .staff-requests-inline-summary {
          border: 1px dashed var(--border-strong);
          background: var(--surface-soft);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 6px;
          color: var(--muted);
        }

        .staff-requests-warning {
          margin-top: 6px;
          color: var(--text);
          font-weight: 600;
        }

        .staff-request-card {
          border: 1px solid var(--border);
        }

        .staff-request-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .staff-request-topline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .staff-request-title {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.35;
        }

        .staff-request-side-meta {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end;
        }

        .staff-request-detail-card {
          border: 1px solid var(--border);
          background: var(--surface-soft);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 8px;
        }

        .staff-request-copy {
          margin: 0;
          white-space: pre-wrap;
          color: var(--text);
        }

        @media (max-width: 860px) {
          .staff-request-side-meta {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}