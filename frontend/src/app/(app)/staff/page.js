"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, buildQuery, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "owner", label: "Owner" },
  { value: "receptionist", label: "Receptionist" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending_invite", label: "Pending invite" },
];

function canUseStaffPage(user) {
  return user?.role === "owner";
}

function formatDateTime(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
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
  if (status === "active") return "done";
  if (status === "inactive") return "cancelled";
  return "pending";
}

function getRoleTone(role) {
  if (role === "owner") return "staff-role-owner";
  if (role === "receptionist") return "staff-role-receptionist";
  return "staff-role-default";
}

export default function StaffPage() {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    role: "",
    status: "",
  });

  const [draftSearch, setDraftSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isBootstrapping && user && !canUseStaffPage(user) && user.role !== "super_admin") {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const showSuperAdminPlaceholder = user?.role === "super_admin";

  const loadStaff = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user || !canUseStaffPage(user) || showSuperAdminPlaceholder) {
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
          search: filters.search || undefined,
          role: filters.role || undefined,
          status: filters.status || undefined,
        });

        const payload = await api.get(`/users${query}`);
        const data = extractApiData(payload, []);

        setStaff(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err?.message || "Could not load clinic staff.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters.role, filters.search, filters.status, showSuperAdminPlaceholder, user]
  );

  useEffect(() => {
    if (!isBootstrapping && user && canUseStaffPage(user) && !showSuperAdminPlaceholder) {
      loadStaff();
    }
  }, [isBootstrapping, loadStaff, showSuperAdminPlaceholder, user]);

  const stats = useMemo(() => {
    return staff.reduce(
      (accumulator, member) => {
        accumulator.total += 1;
        if (member.role === "owner") accumulator.owners += 1;
        if (member.role === "receptionist") accumulator.receptionists += 1;
        if (member.status === "active") accumulator.active += 1;
        if (member.status === "inactive") accumulator.inactive += 1;
        if (member.status === "pending_invite") accumulator.pendingInvite += 1;
        return accumulator;
      },
      {
        total: 0,
        owners: 0,
        receptionists: 0,
        active: 0,
        inactive: 0,
        pendingInvite: 0,
      }
    );
  }, [staff]);

  async function handleStatusChange(member, nextStatus) {
    try {
      setBusyUserId(member.id);
      setError("");
      setNotice("");

      const payload = await api.patch(`/users/${member.id}/status`, {
        status: nextStatus,
        reason:
          nextStatus === "inactive"
            ? "Deactivated by clinic owner from the staff page."
            : "Reactivated by clinic owner from the staff page.",
      });

      const data = extractApiData(payload, null);
      const updatedUser = data?.user || null;
      const unassignedLeadCount = Number(data?.unassignedLeadCount) || 0;

      setStaff((current) =>
        current.map((item) =>
          Number(item.id) === Number(member.id)
            ? {
                ...item,
                ...(updatedUser || {}),
              }
            : item
        )
      );

      if (nextStatus === "inactive") {
        setNotice(
          unassignedLeadCount > 0
            ? `${member.fullName || member.email} was deactivated. ${unassignedLeadCount} active lead${unassignedLeadCount === 1 ? "" : "s"} were unassigned automatically.`
            : `${member.fullName || member.email} was deactivated successfully.`
        );
      } else {
        setNotice(`${member.fullName || member.email} was reactivated successfully.`);
      }
    } catch (err) {
      setError(err?.message || "Could not update staff status.");
    } finally {
      setBusyUserId(null);
    }
  }

  function applySearch() {
    setFilters((current) => ({
      ...current,
      search: draftSearch.trim(),
    }));
  }

  function clearFilters() {
    setDraftSearch("");
    setFilters({
      search: "",
      role: "",
      status: "",
    });
  }

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading staff"
        description="Checking your session and preparing clinic staff data."
        points={[
          "Verifying owner access",
          "Loading clinic users",
          "Preparing activation controls",
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
        title="Super admin staff controls stay separate"
        description="This page is for clinic owners managing their clinic staff. Super admin user management should live in a separate admin workspace."
        points={[
          "Owners manage clinic staff here",
          "Super admin has platform-wide user controls elsewhere",
          "This keeps clinic and platform workflows separate",
        ]}
      />
    );
  }

  if (!canUseStaffPage(user)) {
    return (
      <PagePlaceholder
        title="Owner-only page"
        description="The Staff page is currently only available to clinic owners."
        points={[
          "Owners can review clinic staff here",
          "Receptionists stay focused on operational work",
          "Approval workflows remain separate from staff visibility",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="staff-header-row">
          <div className="stack-sm">
            <span className="small-label">Owner workspace</span>
            <h1>Staff</h1>
            <p className="staff-subtle">
              Review your clinic team, see current status, and activate or deactivate receptionists
              without leaving the owner workspace.
            </p>
          </div>

          <div className="staff-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadStaff({ refresh: true })}
              disabled={isLoading || isRefreshing || busyUserId !== null}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "error-banner" : "staff-notice-banner"}>
          {error || notice}
        </div>
      )}

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="small-label">Loaded</span>
          <strong>{stats.total}</strong>
          <p className="staff-subtle">Users in the current filtered view.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Owners</span>
          <strong>{stats.owners}</strong>
          <p className="staff-subtle">Clinic owners currently visible.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Receptionists</span>
          <strong>{stats.receptionists}</strong>
          <p className="staff-subtle">Receptionists currently visible.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Active / Inactive / Pending</span>
          <strong>{`${stats.active} / ${stats.inactive} / ${stats.pendingInvite}`}</strong>
          <p className="staff-subtle">Quick status breakdown for the visible team.</p>
        </article>
      </section>

      <section className="page-card stack-sm">
        <div className="stack-sm">
          <span className="small-label">Filters</span>
          <p className="staff-subtle">
            Search by name or email, then narrow by role or current status.
          </p>
        </div>

        <div className="staff-filters-grid">
          <label className="staff-field staff-search-field">
            <span>Search</span>
            <div className="staff-search-row">
              <input
                type="text"
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Search by name or email"
                maxLength={200}
                disabled={isLoading || isRefreshing}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applySearch();
                  }
                }}
              />
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={applySearch}
                disabled={isLoading || isRefreshing}
              >
                Search
              </button>
            </div>
          </label>

          <label className="staff-field">
            <span>Role</span>
            <select
              value={filters.role}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  role: event.target.value,
                }))
              }
              disabled={isLoading || isRefreshing}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value || "all-role"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="staff-field">
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
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all-status"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="staff-filter-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={clearFilters}
              disabled={
                isLoading ||
                isRefreshing ||
                (!filters.search && !filters.role && !filters.status && !draftSearch)
              }
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading staff…</div>
        </section>
      ) : staff.length === 0 ? (
        <section className="page-card">
          <div className="empty-state">No staff members matched the current view.</div>
        </section>
      ) : (
        <section className="stack">
          {staff.map((member) => {
            const isBusy = Number(busyUserId) === Number(member.id);
            const canToggleReceptionist =
              member.role === "receptionist" &&
              (member.status === "active" || member.status === "inactive");

            return (
              <article key={member.id} className="page-card staff-card">
                <div className="stack">
                  <div className="staff-card-header">
                    <div className="stack-sm">
                      <div className="staff-card-topline">
                        <span className={`staff-role-badge ${getRoleTone(member.role)}`}>
                          {humanizeToken(member.role)}
                        </span>

                        <span className={`status-pill ${getStatusTone(member.status)}`}>
                          {humanizeToken(member.status)}
                        </span>
                      </div>

                      <h3 className="staff-card-title">
                        {member.fullName || "Unnamed user"}
                      </h3>
                    </div>

                    <div className="staff-card-actions">
                      {canToggleReceptionist ? (
                        member.status === "active" ? (
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => handleStatusChange(member, "inactive")}
                            disabled={isBusy}
                          >
                            {isBusy ? "Updating..." : "Deactivate"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-button compact-button staff-primary-button"
                            onClick={() => handleStatusChange(member, "active")}
                            disabled={isBusy}
                          >
                            {isBusy ? "Updating..." : "Reactivate"}
                          </button>
                        )
                      ) : (
                        <span className="small-label">No direct status action</span>
                      )}
                    </div>
                  </div>

                  <div className="staff-details-grid">
                    <div className="staff-detail-card">
                      <span className="small-label">Email</span>
                      <strong>{member.email || "Not provided"}</strong>
                    </div>

                    <div className="staff-detail-card">
                      <span className="small-label">Phone</span>
                      <strong>{member.phone || "Not provided"}</strong>
                    </div>

                    <div className="staff-detail-card">
                      <span className="small-label">Last login</span>
                      <strong>{formatDateTime(member.lastLoginAt)}</strong>
                    </div>

                    <div className="staff-detail-card">
                      <span className="small-label">Created</span>
                      <strong>{formatDateTime(member.createdAt)}</strong>
                    </div>
                  </div>

                  {(member.deactivatedAt || member.removedAt || member.removalReason) ? (
                    <div className="stack-sm">
                      <span className="small-label">Status history</span>
                      <div className="staff-history-grid">
                        {member.deactivatedAt ? (
                          <div className="staff-history-item">
                            <strong>Deactivated</strong>
                            <span>{formatDateTime(member.deactivatedAt)}</span>
                          </div>
                        ) : null}

                        {member.removedAt ? (
                          <div className="staff-history-item">
                            <strong>Removed</strong>
                            <span>{formatDateTime(member.removedAt)}</span>
                          </div>
                        ) : null}

                        {member.removalReason ? (
                          <div className="staff-history-item">
                            <strong>Reason</strong>
                            <span>{member.removalReason}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <style jsx>{`
        .staff-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .staff-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .staff-subtle {
          margin: 0;
          color: var(--muted);
        }

        .staff-notice-banner {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          color: var(--text);
          padding: 14px 16px;
          border-radius: 16px;
        }

        .staff-primary-button {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }

        .staff-primary-button:hover:not(:disabled) {
          background: var(--surface-soft);
        }

        .staff-filters-grid,
        .staff-details-grid,
        .staff-history-grid {
          display: grid;
          gap: 16px;
        }

        .staff-filters-grid,
        .staff-details-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .staff-history-grid {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .staff-field {
          display: grid;
          gap: 8px;
        }

        .staff-field span {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .staff-field input,
        .staff-field select {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          border-radius: 14px;
          padding: 12px 14px;
          font: inherit;
          outline: none;
        }

        .staff-field input:focus,
        .staff-field select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }

        .staff-search-field {
          grid-column: 1 / -1;
        }

        .staff-search-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .staff-search-row input {
          flex: 1 1 300px;
          min-width: 0;
        }

        .staff-filter-actions {
          display: flex;
          align-items: end;
        }

        .staff-card {
          border: 1px solid var(--border);
        }

        .staff-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .staff-card-topline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .staff-card-title {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.35;
        }

        .staff-card-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .staff-role-badge {
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

        .staff-role-owner {
          border-color: rgba(59, 130, 246, 0.35);
        }

        .staff-role-receptionist {
          border-color: rgba(16, 185, 129, 0.35);
        }

        .staff-role-default {
          border-color: var(--border);
        }

        .staff-detail-card,
        .staff-history-item {
          border: 1px solid var(--border);
          background: var(--surface-soft);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 8px;
        }

        @media (max-width: 860px) {
          .staff-filter-actions {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}