"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const SUMMARY_METRICS = [
  {
    key: "leadsToday",
    label: "Leads today",
    hint: "Fresh leads added today",
  },
  {
    key: "leadsThisWeek",
    label: "Leads this week",
    hint: "Leads created in the last 7 days",
  },
  {
    key: "leadsThisMonth",
    label: "Leads this month",
    hint: "Leads created in the current month",
  },
  {
    key: "overdueFollowups",
    label: "Overdue follow-ups",
    hint: "Leads needing follow-up attention",
  },
  {
    key: "appointmentsToday",
    label: "Appointments today",
    hint: "Appointments scheduled for today",
  },
  {
    key: "upcomingAppointments",
    label: "Upcoming appointments",
    hint: "Future appointments still pending",
  },
  {
    key: "noShows",
    label: "No-shows",
    hint: "Appointments marked as no-show",
  },
  {
    key: "reviewRequests",
    label: "Review requests",
    hint: "Review invites sent to patients",
  },
  {
    key: "reviewsReceived",
    label: "Reviews received",
    hint: "Reviews collected so far",
  },
  {
    key: "duplicateWarnings",
    label: "Duplicate warnings",
    hint: "Potential duplicate lead groups",
  },
];

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
};

const actionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const breakdownGridStyle = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const breakdownItemHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const subtleTextStyle = {
  margin: 0,
  color: "var(--muted)",
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCount(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const parsed = Number(value);

  if (Number.isFinite(parsed)) {
    return new Intl.NumberFormat("en-IN").format(parsed);
  }

  return String(value);
}

function formatMinutes(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "—";
  }

  if (parsed < 60) {
    return `${Math.round(parsed)} min`;
  }

  const hours = Math.floor(parsed / 60);
  const minutes = Math.round(parsed % 60);

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

function humanizeLabel(value, fallback = "Unspecified") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLastUpdated(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getPercent(count, total) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((toNumber(count) / total) * 100)}%`;
}

function getStaffStatusTone(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (["active", "approved"].includes(normalized)) {
    return "done";
  }

  if (["pending", "invited"].includes(normalized)) {
    return "pending";
  }

  if (["inactive", "disabled", "removed", "suspended"].includes(normalized)) {
    return "cancelled";
  }

  return "pending";
}

function BreakdownSection({
  title,
  description,
  items,
  total,
  labelKey,
  emptyText,
}) {
  return (
    <section className="page-card stack">
      <div style={sectionHeaderStyle}>
        <div className="stack-sm">
          <span className="small-label">{title}</span>
          <p style={subtleTextStyle}>{description}</p>
        </div>
        <span className="small-label">{formatCount(total)} total</span>
      </div>

      {items.length > 0 ? (
        <div style={breakdownGridStyle}>
          {items.map((item, index) => {
            const label = humanizeLabel(item?.[labelKey]);
            const count = toNumber(item?.count);

            return (
              <article className="soft-card stack-sm" key={`${label}-${index}`}>
                <div style={breakdownItemHeaderStyle}>
                  <strong>{label}</strong>
                  <span className="small-label">{getPercent(count, total)}</span>
                </div>

                <div className="stack-sm">
                  <strong style={{ fontSize: "1.85rem", lineHeight: 1 }}>
                    {formatCount(count)}
                  </strong>
                  <p style={subtleTextStyle}>Entries in this bucket</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">{emptyText}</div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  useEffect(() => {
    if (!isBootstrapping && user && !isOwnerLike(user)) {
      router.replace("/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const showClinicOwnerOnlyPlaceholder =
    user?.role === "super_admin" && !user?.clinicId;

  const loadDashboard = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user || !isOwnerLike(user) || showClinicOwnerOnlyPlaceholder) {
        return;
      }

      try {
        setError("");

        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const payload = await api.get("/dashboards/clinic");
        const data = extractApiData(payload, null);

        if (!data) {
          throw new Error("Could not read the clinic dashboard response.");
        }

        setDashboard(data);
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        setError(err?.message || "Could not load the owner dashboard.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showClinicOwnerOnlyPlaceholder, user]
  );

  useEffect(() => {
    if (
      !isBootstrapping &&
      user &&
      isOwnerLike(user) &&
      !showClinicOwnerOnlyPlaceholder
    ) {
      loadDashboard();
    }
  }, [isBootstrapping, loadDashboard, showClinicOwnerOnlyPlaceholder, user]);

  const summaryCards = useMemo(() => {
    const summary = dashboard?.summary || {};

    return SUMMARY_METRICS.map((metric) => {
      const value = summary?.[metric.key];
      const isDuplicateMetric = metric.key === "duplicateWarnings";

      return {
        ...metric,
        value,
        href: isDuplicateMetric ? "/leads/duplicates" : null,
        actionLabel: isDuplicateMetric
          ? toNumber(value) > 0
            ? "Review duplicates"
            : "Open review page"
          : null,
      };
    });
  }, [dashboard]);

  const pipelineDistribution = useMemo(() => {
    const items = Array.isArray(dashboard?.pipelineDistribution)
      ? dashboard.pipelineDistribution
      : [];

    return items
      .map((item) => ({
        pipelineStatus: item?.pipelineStatus,
        count: toNumber(item?.count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [dashboard]);

  const sourceBreakdown = useMemo(() => {
    const items = Array.isArray(dashboard?.sourceBreakdown)
      ? dashboard.sourceBreakdown
      : [];

    return items
      .map((item) => ({
        source: item?.source,
        count: toNumber(item?.count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [dashboard]);

  const pipelineTotal = useMemo(() => {
    return pipelineDistribution.reduce(
      (total, item) => total + toNumber(item.count),
      0
    );
  }, [pipelineDistribution]);

  const sourceTotal = useMemo(() => {
    return sourceBreakdown.reduce(
      (total, item) => total + toNumber(item.count),
      0
    );
  }, [sourceBreakdown]);

  const staffPerformance = useMemo(() => {
    const items = Array.isArray(dashboard?.staffPerformance)
      ? dashboard.staffPerformance
      : [];

    return [...items].sort((a, b) => {
      const appointmentsDiff =
        toNumber(b?.appointmentsBooked) - toNumber(a?.appointmentsBooked);

      if (appointmentsDiff !== 0) {
        return appointmentsDiff;
      }

      const activeLeadsDiff =
        toNumber(b?.currentlyHandledLeads) - toNumber(a?.currentlyHandledLeads);

      if (activeLeadsDiff !== 0) {
        return activeLeadsDiff;
      }

      return String(a?.fullName || "").localeCompare(
        String(b?.fullName || "")
      );
    });
  }, [dashboard]);

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading dashboard"
        description="Checking your session and clinic access."
        points={[
          "Verifying owner access",
          "Preparing clinic-level dashboard data",
          "Keeping receptionist flows untouched",
        ]}
      />
    );
  }

  if (!user || !isOwnerLike(user)) {
    return (
      <PagePlaceholder
        title="Redirecting"
        description="Dashboard is owner-first, so this user is being sent to My Tasks."
        points={[
          "Receptionists land on My Tasks",
          "Owners get clinic-wide visibility",
          "Existing routing behavior stays intact",
        ]}
      />
    );
  }

  if (showClinicOwnerOnlyPlaceholder) {
    return (
      <PagePlaceholder
        title="Clinic dashboard is owner-specific"
        description="This route is meant for a clinic owner context. Super admin dashboard should stay separate from the clinic owner dashboard."
        points={[
          "Owner dashboard uses clinic-scoped data",
          "Super admin should get a platform-wide dashboard later",
          "This avoids mixing owner and admin workflows",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div style={sectionHeaderStyle}>
          <div className="stack-sm">
            <span className="small-label">Owner dashboard</span>
            <h1>{user.clinicName?.trim() || "Clinic workspace"}</h1>
            <p style={subtleTextStyle}>
              A live clinic-wide snapshot for leads, appointments, reviews, and
              staff performance.
            </p>
          </div>

          <div style={actionRowStyle}>
            {lastUpdatedAt ? (
              <span className="small-label">
                Updated {formatLastUpdated(lastUpdatedAt)}
              </span>
            ) : null}

            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadDashboard({ refresh: true })}
              disabled={isRefreshing || isLoading}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {isLoading && !dashboard ? (
        <section className="page-card stack">
          <span className="small-label">Loading</span>
          <p style={subtleTextStyle}>
            Pulling the latest clinic dashboard numbers.
          </p>
        </section>
      ) : null}

      {!isLoading && !dashboard ? (
        <section className="page-card stack">
          <span className="small-label">Dashboard unavailable</span>
          <div className="empty-state">
            We could not load the clinic dashboard yet.
          </div>
          <div>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadDashboard()}
            >
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {dashboard ? (
        <>
          <section className="metrics-grid">
            {summaryCards.map((metric) => (
              <article
                className={`metric-card ${
                  metric.href ? "metric-card-attention" : ""
                }`}
                key={metric.key}
              >
                <span className="small-label">{metric.label}</span>
                <strong>{formatCount(metric.value)}</strong>
                <p style={subtleTextStyle}>{metric.hint}</p>

                {metric.href ? (
                  <div className="metric-card-action-row">
                    <Link
                      href={metric.href}
                      className="secondary-button compact-button"
                    >
                      {metric.actionLabel}
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </section>

          <BreakdownSection
            title="Pipeline distribution"
            description="See where your active clinic volume currently sits across pipeline stages."
            items={pipelineDistribution}
            total={pipelineTotal}
            labelKey="pipelineStatus"
            emptyText="No pipeline distribution is available yet."
          />

          <BreakdownSection
            title="Source breakdown"
            description="Track which lead sources are contributing the most volume."
            items={sourceBreakdown}
            total={sourceTotal}
            labelKey="source"
            emptyText="No lead source data is available yet."
          />

          <section className="page-card stack">
            <div style={sectionHeaderStyle}>
              <div className="stack-sm">
                <span className="small-label">Staff performance</span>
                <p style={subtleTextStyle}>
                  Receptionist activity ranked by appointments booked, active
                  workload, and follow-up execution.
                </p>
              </div>

              <span className="small-label">
                {formatCount(staffPerformance.length)} team member
                {staffPerformance.length === 1 ? "" : "s"}
              </span>
            </div>

            {staffPerformance.length > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Status</th>
                      <th>Leads created</th>
                      <th>Active leads</th>
                      <th>Leads progressed</th>
                      <th>Follow-ups done</th>
                      <th>Appointments booked</th>
                      <th>Avg response</th>
                      <th>Overdue leads</th>
                      <th>No-show handled</th>
                    </tr>
                  </thead>

                  <tbody>
                    {staffPerformance.map((member) => (
                      <tr key={member.userId}>
                        <td>
                          <div className="stack-sm">
                            <strong>
                              {member.fullName || "Unnamed staff member"}
                            </strong>
                            <span style={subtleTextStyle}>
                              {member.email || "No email"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${getStaffStatusTone(
                              member.status
                            )}`}
                          >
                            {humanizeLabel(member.status, "Unknown")}
                          </span>
                        </td>
                        <td>{formatCount(member.leadsCreated)}</td>
                        <td>{formatCount(member.currentlyHandledLeads)}</td>
                        <td>{formatCount(member.leadsContactedOrProgressed)}</td>
                        <td>{formatCount(member.followupsCompleted)}</td>
                        <td>{formatCount(member.appointmentsBooked)}</td>
                        <td>{formatMinutes(member.avgResponseMinutes)}</td>
                        <td>{formatCount(member.overdueAssignedLeads)}</td>
                        <td>{formatCount(member.noShowRelatedHandledLeads)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No staff performance data is available yet.
              </div>
            )}
          </section>
        </>
      ) : null}

      <style jsx global>{`
        .metric-card-attention {
          border-color: rgba(58, 94, 160, 0.24);
        }

        .metric-card-attention strong {
          color: var(--accent);
        }

        .metric-card-action-row {
          margin-top: 8px;
          display: flex;
        }

        .metric-card-action-row .secondary-button {
          width: 100%;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}