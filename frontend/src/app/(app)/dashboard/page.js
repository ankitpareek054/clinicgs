"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const OWNER_SUMMARY_METRICS = [
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
    tone: "attention",
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
    tone: "attention",
  },
];

const SUPER_ADMIN_SUMMARY_METRICS = [
  {
    key: "totalClinics",
    label: "Total clinics",
    hint: "Clinic workspaces on the platform",
  },
  {
    key: "totalLeads",
    label: "Total leads",
    hint: "All visible leads across clinics",
  },
  {
    key: "leadsLast7Days",
    label: "Leads last 7 days",
    hint: "Fresh platform activity this week",
  },
  {
    key: "bookingsLast30Days",
    label: "Bookings last 30 days",
    hint: "Booked appointments across clinics this month",
  },
  {
    key: "pendingStaffRequests",
    label: "Pending staff requests",
    hint: "Requests waiting for review",
    tone: "attention",
  },
  {
    key: "failedCalendarSyncs",
    label: "Failed calendar syncs",
    hint: "Calendar sync issues needing review",
    tone: "attention",
  },
  {
    key: "failedMessageLogs",
    label: "Failed message logs",
    hint: "Messaging failures across clinics",
    tone: "attention",
  },
  {
    key: "noShowRatePct",
    label: "No-show rate",
    hint: "Current platform-level no-show rate",
    formatter: "percent",
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

const attentionGridStyle = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const attentionMetricRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const pillRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const rankedListStyle = {
  display: "grid",
  gap: "12px",
};

const rankedListItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
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

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "—";
  }

  return `${parsed.toFixed(parsed % 1 === 0 ? 0 : 1)}%`;
}

function formatMetricValue(metric, value) {
  if (metric?.formatter === "percent") {
    return formatPercent(value);
  }

  return formatCount(value);
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

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function getPercent(count, total) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((toNumber(count) / total) * 100)}%`;
}

function getStatusTone(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (
    [
      "active",
      "approved",
      "resolved",
      "connected",
      "completed",
      "done",
      "healthy",
    ].includes(normalized)
  ) {
    return "done";
  }

  if (
    [
      "pending",
      "invited",
      "open",
      "warning",
      "attention",
      "in_progress",
      "in progress",
      "requested",
      "trial",
      "onboarding",
    ].includes(normalized)
  ) {
    return "pending";
  }

  if (
    [
      "inactive",
      "disabled",
      "removed",
      "suspended",
      "failed",
      "rejected",
      "cancelled",
      "closed",
      "archived",
      "error",
    ].includes(normalized)
  ) {
    return "cancelled";
  }

  return "pending";
}

function getClinicSelectionFromItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const clinicId = item.clinicId ?? item.id ?? null;

  if (!clinicId) {
    return null;
  }

  return {
    id: clinicId,
    name: item.clinicName || item.name || "Clinic workspace",
    status: item.clinicStatus || item.status || "",
    city: item.city || "",
  };
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
                  <span className="small-label">
                    {getPercent(count, total)}
                  </span>
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

function RankedListSection({
  title,
  description,
  items,
  emptyText,
  renderLabel,
  renderValue,
  renderMeta,
}) {
  return (
    <section className="page-card stack">
      <div className="stack-sm">
        <span className="small-label">{title}</span>
        <p style={subtleTextStyle}>{description}</p>
      </div>

      {items.length > 0 ? (
        <div style={rankedListStyle}>
          {items.map((item, index) => (
            <article className="soft-card stack-sm" key={`${title}-${index}`}>
              <div style={rankedListItemStyle}>
                <div className="stack-sm">
                  <strong>{renderLabel(item)}</strong>
                  {renderMeta ? (
                    <span style={subtleTextStyle}>{renderMeta(item)}</span>
                  ) : null}
                </div>
                <strong>{renderValue(item)}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">{emptyText}</div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isBootstrapping, setAdminClinic, clearAdminClinic } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  const isSuperAdmin = user?.role === "super_admin";
  const isOwner = user?.role === "owner";

  const safeSetAdminClinic =
    typeof setAdminClinic === "function" ? setAdminClinic : () => null;

  const safeClearAdminClinic =
    typeof clearAdminClinic === "function" ? clearAdminClinic : () => {};

  useEffect(() => {
    if (!isBootstrapping && user && !isOwnerLike(user)) {
      router.replace("/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const loadDashboard = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user || !isOwnerLike(user)) {
        return;
      }

      try {
        setError("");

        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const endpoint =
          user.role === "super_admin"
            ? "/dashboards/super-admin"
            : "/dashboards/clinic";

        const payload = await api.get(endpoint);
        const data = extractApiData(payload, null);

        if (!data) {
          throw new Error("Could not read the dashboard response.");
        }

        setDashboard(data);
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        setError(
          err?.message ||
            (user?.role === "super_admin"
              ? "Could not load the super admin dashboard."
              : "Could not load the owner dashboard."),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!isBootstrapping && user && isOwnerLike(user)) {
      loadDashboard();
    }
  }, [isBootstrapping, loadDashboard, user]);

  const ownerSummaryCards = useMemo(() => {
    const summary = dashboard?.summary || {};

    return OWNER_SUMMARY_METRICS.map((metric) => ({
      ...metric,
      value: summary?.[metric.key],
    }));
  }, [dashboard]);

  const superAdminSummaryCards = useMemo(() => {
    const summary = dashboard?.summary || {};

    return SUPER_ADMIN_SUMMARY_METRICS.map((metric) => ({
      ...metric,
      value: summary?.[metric.key],
    }));
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
      0,
    );
  }, [pipelineDistribution]);

  const sourceTotal = useMemo(() => {
    return sourceBreakdown.reduce(
      (total, item) => total + toNumber(item.count),
      0,
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

      return String(a?.fullName || "").localeCompare(String(b?.fullName || ""));
    });
  }, [dashboard]);

  const clinicsByStatus = useMemo(() => {
    const items = Array.isArray(dashboard?.clinicsByStatus)
      ? dashboard.clinicsByStatus
      : [];

    return items
      .map((item) => ({
        status: item?.status,
        count: toNumber(item?.count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [dashboard]);

  const clinicsByStatusTotal = useMemo(() => {
    const summaryTotal = toNumber(dashboard?.summary?.totalClinics);

    if (summaryTotal > 0) {
      return summaryTotal;
    }

    return clinicsByStatus.reduce(
      (total, item) => total + toNumber(item.count),
      0,
    );
  }, [clinicsByStatus, dashboard]);

  const topGrowthClinics = useMemo(() => {
    const items = Array.isArray(dashboard?.topGrowthClinics)
      ? dashboard.topGrowthClinics
      : [];

    return [...items].sort((a, b) => {
      const scoreDiff =
        toNumber(b?.growthScore100) - toNumber(a?.growthScore100);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return String(a?.clinicName || "").localeCompare(
        String(b?.clinicName || ""),
      );
    });
  }, [dashboard]);

  const clinicsNeedingAttention = useMemo(() => {
    const items = Array.isArray(dashboard?.clinicsNeedingAttention)
      ? dashboard.clinicsNeedingAttention
      : [];

    const scoreItem = (item) => {
      let score = 0;
      score += toNumber(item?.duplicatePhoneGroups);
      score += toNumber(item?.unassignedActiveLeads);
      score += toNumber(item?.openSupportTickets) * 2;
      score += toNumber(item?.failedCalendarSyncs) * 3;
      score += toNumber(item?.inactiveReceptionists);
      if (item?.hasNoActiveReceptionist) {
        score += 10;
      }
      return score;
    };

    return [...items].sort((a, b) => scoreItem(b) - scoreItem(a));
  }, [dashboard]);

  const pendingStaffRequests = useMemo(() => {
    const items = Array.isArray(dashboard?.pendingStaffRequests)
      ? dashboard.pendingStaffRequests
      : [];

    return [...items].sort((a, b) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [dashboard]);

  const supportTicketsByClinic = useMemo(() => {
    const items = Array.isArray(dashboard?.supportTicketsByClinic)
      ? dashboard.supportTicketsByClinic
      : [];

    return [...items].sort((a, b) => {
      const openDiff = toNumber(b?.openTickets) - toNumber(a?.openTickets);

      if (openDiff !== 0) {
        return openDiff;
      }

      return toNumber(b?.totalTickets) - toNumber(a?.totalTickets);
    });
  }, [dashboard]);

  const overdueFollowupsByClinic = useMemo(() => {
    const items = Array.isArray(dashboard?.overdueFollowupsByClinic)
      ? dashboard.overdueFollowupsByClinic
      : [];

    return [...items]
      .sort(
        (a, b) => toNumber(b?.overdueFollowups) - toNumber(a?.overdueFollowups),
      )
      .slice(0, 6);
  }, [dashboard]);

  const averageResponseTimeByClinic = useMemo(() => {
    const items = Array.isArray(dashboard?.averageResponseTimeByClinic)
      ? dashboard.averageResponseTimeByClinic
      : [];

    return [...items]
      .sort(
        (a, b) =>
          toNumber(b?.avgResponseMinutes) - toNumber(a?.avgResponseMinutes),
      )
      .slice(0, 6);
  }, [dashboard]);

  const duplicateWarningsByClinic = useMemo(() => {
    const items = Array.isArray(dashboard?.duplicateWarningsByClinic)
      ? dashboard.duplicateWarningsByClinic
      : [];

    return [...items]
      .sort(
        (a, b) => toNumber(b?.duplicateGroups) - toNumber(a?.duplicateGroups),
      )
      .slice(0, 6);
  }, [dashboard]);

  function openClinicWorkspace(clinicLike, targetPath = "/clinic-profile") {
    const clinicSelection = getClinicSelectionFromItem(clinicLike);

    if (!clinicSelection) {
      return;
    }

    safeSetAdminClinic(clinicSelection);
    router.push(targetPath);
  }

  function goToAdminPath(path) {
    router.push(path);
  }

  function openGlobalAdminPage(path) {
    safeClearAdminClinic();
    router.push(path);
  }

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading dashboard"
        description="Checking your session and role-specific dashboard access."
        points={[
          "Verifying logged-in access",
          "Preparing the correct dashboard by role",
          "Keeping current receptionist and owner flows intact",
        ]}
      />
    );
  }

  if (!user || !isOwnerLike(user)) {
    return (
      <PagePlaceholder
        title="Redirecting"
        description="Dashboard is restricted to owner and super admin users, so this user is being sent to My Tasks."
        points={[
          "Receptionists land on My Tasks",
          "Owners keep clinic-level visibility",
          "Super admin uses the same /dashboard route with platform-wide data",
        ]}
      />
    );
  }

  const dashboardTitle = isSuperAdmin
    ? "Platform overview"
    : user.clinicName?.trim() || "Clinic workspace";

  const dashboardDescription = isSuperAdmin
    ? "Cross-clinic visibility for growth, attention flags, pending staff requests, sync health, and support load."
    : "A live clinic-wide snapshot for leads, appointments, reviews, and staff performance.";

  return (
    <div className="page stack">
      <header className="page-header">
        <div style={sectionHeaderStyle}>
          <div className="stack-sm">
            <span className="small-label">
              {isSuperAdmin ? "Super admin dashboard" : "Owner dashboard"}
            </span>
            <h1>{dashboardTitle}</h1>
            <p style={subtleTextStyle}>{dashboardDescription}</p>
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
            Pulling the latest {isSuperAdmin ? "platform" : "clinic"} dashboard
            numbers.
          </p>
        </section>
      ) : null}

      {!isLoading && !dashboard ? (
        <section className="page-card stack">
          <span className="small-label">Dashboard unavailable</span>
          <div className="empty-state">
            We could not load the {isSuperAdmin ? "platform" : "clinic"}{" "}
            dashboard yet.
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

      {dashboard && isOwner ? (
        <>
          <section className="metrics-grid">
            {ownerSummaryCards.map((metric) => (
              <article
                className={`metric-card ${
                  metric.tone === "attention" ? "metric-card-attention" : ""
                }`}
                key={metric.key}
              >
                <span className="small-label">{metric.label}</span>
                <strong>{formatMetricValue(metric, metric.value)}</strong>
                <p style={subtleTextStyle}>{metric.hint}</p>
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
                            className={`status-pill ${getStatusTone(
                              member.status,
                            )}`}
                          >
                            {humanizeLabel(member.status, "Unknown")}
                          </span>
                        </td>
                        <td>{formatCount(member.leadsCreated)}</td>
                        <td>{formatCount(member.currentlyHandledLeads)}</td>
                        <td>
                          {formatCount(member.leadsContactedOrProgressed)}
                        </td>
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

      {dashboard && isSuperAdmin ? (
        <>
          <section className="metrics-grid">
            {superAdminSummaryCards.map((metric) => (
              <article
                className={`metric-card ${
                  metric.tone === "attention" ? "metric-card-attention" : ""
                }`}
                key={metric.key}
              >
                <span className="small-label">{metric.label}</span>
                <strong>{formatMetricValue(metric, metric.value)}</strong>
                <p style={subtleTextStyle}>{metric.hint}</p>
              </article>
            ))}
          </section>

          <BreakdownSection
            title="Clinic status"
            description="A quick cross-clinic view of how many workspaces sit in each clinic state."
            items={clinicsByStatus}
            total={clinicsByStatusTotal}
            labelKey="status"
            emptyText="No clinic status data is available yet."
          />

          <section className="page-card stack">
            <div style={sectionHeaderStyle}>
              <div className="stack-sm">
                <span className="small-label">Clinics needing attention</span>
                <p style={subtleTextStyle}>
                  Priority clinics based on duplicate risk, unassigned work,
                  open support load, sync issues, and staffing gaps.
                </p>
              </div>

              <div style={actionRowStyle}>
                <span className="small-label">
                  {formatCount(clinicsNeedingAttention.length)} clinic
                  {clinicsNeedingAttention.length === 1 ? "" : "s"}
                </span>

                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => goToAdminPath("/clinics")}
                >
                  Open Clinics
                </button>
              </div>
            </div>

            {clinicsNeedingAttention.length > 0 ? (
              <div style={attentionGridStyle}>
                {clinicsNeedingAttention.map((clinic) => (
                  <article
                    className="soft-card stack-sm"
                    key={clinic.clinicId || clinic.clinicName}
                  >
                    <div style={sectionHeaderStyle}>
                      <div className="stack-sm">
                        <strong>{clinic.clinicName || "Unknown clinic"}</strong>

                        <div style={pillRowStyle}>
                          <span
                            className={`status-pill ${getStatusTone(
                              clinic.clinicStatus,
                            )}`}
                          >
                            {humanizeLabel(clinic.clinicStatus, "Unknown")}
                          </span>

                          {clinic.hasNoActiveReceptionist ? (
                            <span className="status-pill cancelled">
                              No active receptionist
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="context-action-column">
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() =>
                            openClinicWorkspace(clinic, "/clinic-profile")
                          }
                        >
                          Open profile
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => openClinicWorkspace(clinic, "/staff")}
                        >
                          Open staff
                        </button>
                      </div>
                    </div>

                    <div className="stack-sm">
                      <div style={attentionMetricRowStyle}>
                        <span style={subtleTextStyle}>Duplicate groups</span>
                        <strong>
                          {formatCount(clinic.duplicatePhoneGroups)}
                        </strong>
                      </div>

                      <div style={attentionMetricRowStyle}>
                        <span style={subtleTextStyle}>
                          Unassigned active leads
                        </span>
                        <strong>
                          {formatCount(clinic.unassignedActiveLeads)}
                        </strong>
                      </div>

                      <div style={attentionMetricRowStyle}>
                        <span style={subtleTextStyle}>
                          Open support tickets
                        </span>
                        <strong>
                          {formatCount(clinic.openSupportTickets)}
                        </strong>
                      </div>

                      <div style={attentionMetricRowStyle}>
                        <span style={subtleTextStyle}>
                          Failed calendar syncs
                        </span>
                        <strong>
                          {formatCount(clinic.failedCalendarSyncs)}
                        </strong>
                      </div>

                      <div style={attentionMetricRowStyle}>
                        <span style={subtleTextStyle}>
                          Inactive receptionists
                        </span>
                        <strong>
                          {formatCount(clinic.inactiveReceptionists)}
                        </strong>
                      </div>

                      <div style={attentionMetricRowStyle}>
                        <span style={subtleTextStyle}>
                          Active receptionists
                        </span>
                        <strong>
                          {formatCount(clinic.activeReceptionists)}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No clinics are currently flagged for attention.
              </div>
            )}
          </section>

          <section className="page-card stack">
            <div style={sectionHeaderStyle}>
              <div className="stack-sm">
                <span className="small-label">Pending staff requests</span>
                <p style={subtleTextStyle}>
                  Staff requests waiting for super-admin review.
                </p>
              </div>

              <div style={actionRowStyle}>
                <span className="small-label">
                  {formatCount(pendingStaffRequests.length)} request
                  {pendingStaffRequests.length === 1 ? "" : "s"}
                </span>

                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => openGlobalAdminPage("/staff-requests")}
                >
                  Open queue
                </button>
              </div>
            </div>

            {pendingStaffRequests.length > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Clinic</th>
                      <th>Request type</th>
                      <th>Target</th>
                      <th>Role</th>
                      <th>Requested at</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pendingStaffRequests.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <strong>
                            {request.clinicName || "Unknown clinic"}
                          </strong>
                        </td>
                        <td>{humanizeLabel(request.requestType, "Unknown")}</td>
                        <td>
                          <div className="stack-sm">
                            <strong>
                              {request.targetName || "Unnamed user"}
                            </strong>
                            <span style={subtleTextStyle}>
                              {request.targetEmail || "No email"}
                            </span>
                          </div>
                        </td>
                        <td>{humanizeLabel(request.targetRole, "Unknown")}</td>
                        <td>{formatDateTime(request.createdAt)}</td>
                        <td>
                          <div className="table-action-row">
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() =>
                                openGlobalAdminPage("/staff-requests")
                              }
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() =>
                                openClinicWorkspace(request, "/staff")
                              }
                            >
                              Open clinic
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No pending staff requests right now.
              </div>
            )}
          </section>

          <section className="two-column-dashboard-grid">
            <RankedListSection
              title="Overdue follow-ups by clinic"
              description="Where follow-up discipline is slipping the most."
              items={overdueFollowupsByClinic}
              emptyText="No overdue follow-up hotspots right now."
              renderLabel={(item) => item.clinicName || "Unknown clinic"}
              renderValue={(item) => formatCount(item.overdueFollowups)}
              renderMeta={() => "Overdue follow-ups"}
            />

            <RankedListSection
              title="Slowest response times"
              description="Clinics with the slowest average response time."
              items={averageResponseTimeByClinic}
              emptyText="No response-time data is available yet."
              renderLabel={(item) => item.clinicName || "Unknown clinic"}
              renderValue={(item) => formatMinutes(item.avgResponseMinutes)}
              renderMeta={() => "Average response time"}
            />

            <RankedListSection
              title="Duplicate warning hotspots"
              description="Clinics with the highest duplicate warning load."
              items={duplicateWarningsByClinic}
              emptyText="No duplicate hotspots right now."
              renderLabel={(item) => item.clinicName || "Unknown clinic"}
              renderValue={(item) => formatCount(item.duplicateGroups)}
              renderMeta={() => "Duplicate groups"}
            />
          </section>

          <section className="page-card stack">
            <div style={sectionHeaderStyle}>
              <div className="stack-sm">
                <span className="small-label">Support visibility</span>
                <p style={subtleTextStyle}>
                  Cross-clinic ticket volume and current open-ticket pressure.
                </p>
              </div>

              <div style={actionRowStyle}>
                <span className="small-label">
                  {formatCount(supportTicketsByClinic.length)} clinic
                  {supportTicketsByClinic.length === 1 ? "" : "s"}
                </span>

                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => openGlobalAdminPage("/support")}
                >
                  Open support
                </button>
              </div>
            </div>

            {supportTicketsByClinic.length > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Clinic</th>
                      <th>Open</th>
                      <th>Resolved</th>
                      <th>Closed</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {supportTicketsByClinic.map((item) => (
                      <tr key={item.clinicId || item.clinicName}>
                        <td>
                          <strong>{item.clinicName || "Unknown clinic"}</strong>
                        </td>
                        <td>{formatCount(item.openTickets)}</td>
                        <td>{formatCount(item.resolvedTickets)}</td>
                        <td>{formatCount(item.closedTickets)}</td>
                        <td>{formatCount(item.totalTickets)}</td>
                        <td>
                          <div className="table-action-row">
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => openGlobalAdminPage("/support")}
                            >
                              View queue
                            </button>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() =>
                                openClinicWorkspace(item, "/clinic-profile")
                              }
                            >
                              Open clinic
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No support-ticket visibility data is available yet.
              </div>
            )}
          </section>

          <section className="page-card stack">
            <div style={sectionHeaderStyle}>
              <div className="stack-sm">
                <span className="small-label">Top growth clinics</span>
                <p style={subtleTextStyle}>
                  Clinics ranked by the backend growth score using recent lead
                  and booking activity.
                </p>
              </div>

              <div style={actionRowStyle}>
                <span className="small-label">
                  {formatCount(topGrowthClinics.length)} clinic
                  {topGrowthClinics.length === 1 ? "" : "s"}
                </span>

                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => goToAdminPath("/clinics")}
                >
                  Open Clinics
                </button>
              </div>
            </div>

            {topGrowthClinics.length > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Clinic</th>
                      <th>Status</th>
                      <th>Leads 30d</th>
                      <th>Bookings 30d</th>
                      <th>Conversion</th>
                      <th>Growth score</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {topGrowthClinics.map((clinic) => (
                      <tr key={clinic.clinicId || clinic.clinicName}>
                        <td>
                          <strong>
                            {clinic.clinicName || "Unknown clinic"}
                          </strong>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${getStatusTone(
                              clinic.clinicStatus,
                            )}`}
                          >
                            {humanizeLabel(clinic.clinicStatus, "Unknown")}
                          </span>
                        </td>
                        <td>{formatCount(clinic.totalLeads30d)}</td>
                        <td>{formatCount(clinic.bookedAppointments30d)}</td>
                        <td>{formatPercent(clinic.conversionRatePct)}</td>
                        <td>{formatCount(clinic.growthScore100)}</td>
                        <td>
                          <div className="table-action-row">
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() =>
                                openClinicWorkspace(clinic, "/clinic-profile")
                              }
                            >
                              Open profile
                            </button>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() =>
                                openClinicWorkspace(clinic, "/integrations")
                              }
                            >
                              Integrations
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No growth-ranking data is available yet.
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

        .two-column-dashboard-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        }

        .context-action-column {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .table-action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}
