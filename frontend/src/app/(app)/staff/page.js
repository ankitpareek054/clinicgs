
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

  return user?.role === "owner" || user?.role === "super_admin";

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



function buildDeactivateWarningMessage(member, isSuperAdmin) {

  const staffName = member.fullName || member.email || "this receptionist";



  if (isSuperAdmin) {

    return [

      `Deactivate ${staffName}?`,

      "",

      "This will revoke their active access for the selected clinic workspace.",

      "Any currently assigned active leads will become unassigned automatically.",

      "Use Staff Requests for owner-role changes instead of treating this page as a replacement for that approval trail.",

    ].join("\n");

  }



  return [

    `Deactivate ${staffName}?`,

    "",

    "This will revoke their active access.",

    "Any currently assigned active leads will become unassigned automatically.",

    "You can reassign those leads later from the leads workflow.",

  ].join("\n");

}



function getWorkspaceCopy(user, selectedAdminClinic) {

  if (user?.role === "super_admin") {

    return {

      eyebrow: "Super admin selected-clinic workspace",

      description: selectedAdminClinic?.name

        ? `Review staff for ${selectedAdminClinic.name}, filter clinic users, and manage receptionist access without breaking owner approval flows.`

        : "Review staff for the currently selected clinic.",

      loadingDescription:

        "Checking selected clinic context and preparing clinic staff data.",

    };

  }



  return {

    eyebrow: "Owner workspace",

    description:

      "Review your clinic team, see current status, and activate or deactivate receptionists without leaving the owner workspace.",

    loadingDescription:

      "Checking your session and preparing clinic staff data.",

  };

}



export default function StaffPage() {

  const router = useRouter();

  const {

    user,

    isBootstrapping,

    selectedAdminClinic = null,

    clearAdminClinic,

  } = useAuth();



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



  const isSuperAdmin = user?.role === "super_admin";

  const workspaceCopy = useMemo(

    () => getWorkspaceCopy(user, selectedAdminClinic),

    [user, selectedAdminClinic]

  );



  const safeClearAdminClinic =

    typeof clearAdminClinic === "function" ? clearAdminClinic : () => {};



  useEffect(() => {

    if (!isBootstrapping && user && !canUseStaffPage(user)) {

      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");

    }

  }, [isBootstrapping, router, user]);



  const targetClinicId = isSuperAdmin

    ? selectedAdminClinic?.id ?? null

    : user?.clinicId ?? null;



  const loadStaff = useCallback(

    async ({ refresh = false } = {}) => {

      if (!user || !canUseStaffPage(user)) {

        return;

      }



      if (isSuperAdmin && !targetClinicId) {

        setStaff([]);

        setIsLoading(false);

        setIsRefreshing(false);

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

          clinicId: isSuperAdmin ? targetClinicId || undefined : undefined,

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

    [filters.role, filters.search, filters.status, isSuperAdmin, targetClinicId, user]

  );



  useEffect(() => {

    if (!isBootstrapping && user && canUseStaffPage(user)) {

      if (isSuperAdmin && !targetClinicId) {

        setStaff([]);

        setIsLoading(false);

        return;

      }



      loadStaff();

    }

  }, [isBootstrapping, isSuperAdmin, loadStaff, targetClinicId, user]);



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

    if (nextStatus === "inactive") {

      const confirmed = window.confirm(

        buildDeactivateWarningMessage(member, isSuperAdmin)

      );



      if (!confirmed) {

        return;

      }

    }



    try {

      setBusyUserId(member.id);

      setError("");

      setNotice("");



      const payload = await api.patch(`/users/${member.id}/status`, {

        status: nextStatus,

        reason:

          nextStatus === "inactive"

            ? isSuperAdmin

              ? "Deactivated by super admin from selected clinic staff workspace."

              : "Deactivated by clinic owner from the staff page."

            : isSuperAdmin

              ? "Reactivated by super admin from selected clinic staff workspace."

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

            ? `${member.fullName || member.email} was deactivated. ${unassignedLeadCount} active lead${

                unassignedLeadCount === 1 ? "" : "s"

              } were unassigned automatically.`

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



  function handleClearClinicContext() {

    safeClearAdminClinic();

    router.replace("/dashboard");

  }



  if (isBootstrapping) {

    return (

      <PagePlaceholder

        title="Loading staff"

        description={workspaceCopy.loadingDescription}

        points={

          isSuperAdmin

            ? [

                "Verifying super-admin access",

                "Checking selected clinic context",

                "Preparing clinic staff controls",

              ]

            : [

                "Verifying owner access",

                "Loading clinic users",

                "Preparing activation controls",

              ]

        }

      />

    );

  }



  if (!user) {

    return null;

  }



  if (!canUseStaffPage(user)) {

    return (

      <PagePlaceholder

        title="Access restricted"

        description="The Staff page is available only to owners and super admin."

        points={[

          "Owners manage their clinic staff here",

          "Super admin uses selected clinic context here",

          "Receptionists stay focused on operational work",

        ]}

      />

    );

  }



  if (isSuperAdmin && !targetClinicId) {

    return (

      <PagePlaceholder

        title="Choose a clinic first"

        description="Select a clinic in the admin workspace before opening Staff."

        points={[

          "Use the selected clinic context from admin pages",

          "Open the clinic you want to manage",

          "Return here to view that clinic’s staff safely",

        ]}

      />

    );

  }



  return (

    <div className="page stack">

      <header className="page-header">

        <div className="staff-header-row">

          <div className="stack-sm">

            <span className="small-label">{workspaceCopy.eyebrow}</span>

            <h1>Staff</h1>

            <p className="staff-subtle">{workspaceCopy.description}</p>

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



      {isSuperAdmin ? (

        <section className="page-card stack-sm">

          <div className="stack-sm">

            <span className="small-label">Admin clinic context</span>

            <strong className="staff-context-title">

              {selectedAdminClinic?.name || "Selected clinic"}

            </strong>

            <p className="staff-subtle">

              This page shows staff for the current selected clinic. Receptionist access can be

              toggled here, while owner-role changes should continue through Staff Requests so the

              approval trail stays intact.

            </p>

          </div>



          <div className="staff-context-actions">

            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() => router.push("/staff-requests")}

            >

              Open staff requests

            </button>



            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() => router.push("/clinic-profile")}

            >

              Open clinic profile

            </button>



            <button

              type="button"

              className="secondary-button compact-button"

              onClick={handleClearClinicContext}

              disabled={busyUserId !== null}

            >

              Clear selected clinic

            </button>

          </div>

        </section>

      ) : null}



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



                      <h3 className="staff-card-title">{member.fullName || "Unnamed user"}</h3>

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

                      ) : member.role === "owner" ? (

                        <button

                          type="button"

                          className="secondary-button compact-button"

                          onClick={() => router.push("/staff-requests")}

                        >

                          Use staff requests

                        </button>

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



                  {member.role === "owner" ? (

                    <div className="staff-owner-note">

                      Owner-role changes should continue through Staff Requests so the approval and

                      audit trail remain visible.

                    </div>

                  ) : null}



                  {member.deactivatedAt || member.removedAt || member.removalReason ? (

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



        .staff-header-actions,

        .staff-context-actions {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .staff-subtle {

          margin: 0;

          color: var(--muted);

        }



        .staff-context-title {

          color: var(--text);

          line-height: 1.3;

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



        .staff-owner-note {

          border: 1px dashed var(--border-strong);

          background: var(--surface-soft);

          border-radius: 14px;

          padding: 14px;

          color: var(--muted);

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

