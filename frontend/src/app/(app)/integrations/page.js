"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

function canUseIntegrationsPage(user) {
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

function formatOnOff(value) {
  return value ? "Enabled" : "Disabled";
}

function getStatusTone(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (["connected", "active", "healthy", "ok", "enabled", "success"].includes(normalized)) {
    return "done";
  }

  if (["error", "failed", "disconnected", "inactive"].includes(normalized)) {
    return "cancelled";
  }

  return "pending";
}

function humanizeToken(value, fallback = "Not set") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function maskWebhookUrl(value) {
  if (!value) return "Not configured";

  try {
    const url = new URL(value);
    return `${url.origin}/…`;
  } catch {
    return "Configured";
  }
}

function maskCalendarId(value) {
  if (!value) return "Not configured";

  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const [integrations, setIntegrations] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isBootstrapping && user && !canUseIntegrationsPage(user) && user.role !== "super_admin") {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const showSuperAdminPlaceholder = user?.role === "super_admin";

  const loadIntegrations = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user?.clinicId || !canUseIntegrationsPage(user) || showSuperAdminPlaceholder) {
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

        const payload = await api.get(`/clinic-integrations/${user.clinicId}`);
        const data = extractApiData(payload, null);

        setIntegrations(data);
      } catch (err) {
        setError(err?.message || "Could not load clinic integrations.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showSuperAdminPlaceholder, user]
  );

  useEffect(() => {
    if (!isBootstrapping && user && canUseIntegrationsPage(user) && !showSuperAdminPlaceholder) {
      loadIntegrations();
    }
  }, [isBootstrapping, loadIntegrations, showSuperAdminPlaceholder, user]);

  const summary = useMemo(() => {
    return {
      status: humanizeToken(integrations?.integrationStatus, "Unknown"),
      calendarSync: formatOnOff(integrations?.calendarSyncEnabled),
      dailyOwnerReport: formatOnOff(integrations?.dailyOwnerReportEnabled),
      lastSyncAt: formatDateTime(integrations?.lastSyncAt),
    };
  }, [integrations]);

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading integrations"
        description="Checking your session and preparing clinic integration status."
        points={[
          "Verifying owner access",
          "Loading clinic integrations",
          "Preparing read-only integration overview",
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
        title="Super admin integrations stay separate"
        description="This page is a read-only owner view. Super admin can manage integration settings in the admin workspace."
        points={[
          "Owners can review integration status here",
          "Super admin remains the editor for integration settings",
          "This keeps clinic and admin workflows separate",
        ]}
      />
    );
  }

  if (!canUseIntegrationsPage(user)) {
    return (
      <PagePlaceholder
        title="Owner-only page"
        description="Integrations is currently available only to clinic owners."
        points={[
          "Owners can review integration status here",
          "Receptionists stay focused on operational work",
          "Integration editing remains restricted",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="integrations-header-row">
          <div className="stack-sm">
            <span className="small-label">Owner workspace</span>
            <h1>Integrations</h1>
            <p className="integrations-subtle">
              Review the current clinic integration status. This page is read-only for owners.
            </p>
          </div>

          <div className="integrations-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadIntegrations({ refresh: true })}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "error-banner" : "integrations-notice-banner"}>
          {error || notice}
        </div>
      )}

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading integrations…</div>
        </section>
      ) : !integrations ? (
        <section className="page-card">
          <div className="empty-state">Clinic integrations are not available right now.</div>
        </section>
      ) : (
        <>
          <section className="metrics-grid">
            <article className="metric-card">
              <span className="small-label">Integration status</span>
              <strong>{summary.status}</strong>
              <p className="integrations-subtle">Overall clinic integration health.</p>
            </article>

            <article className="metric-card">
              <span className="small-label">Calendar sync</span>
              <strong>{summary.calendarSync}</strong>
              <p className="integrations-subtle">Whether calendar sync is enabled.</p>
            </article>

            <article className="metric-card">
              <span className="small-label">Daily owner report</span>
              <strong>{summary.dailyOwnerReport}</strong>
              <p className="integrations-subtle">Whether owner reports are enabled.</p>
            </article>

            <article className="metric-card">
              <span className="small-label">Last sync</span>
              <strong>{summary.lastSyncAt}</strong>
              <p className="integrations-subtle">Most recent sync timestamp.</p>
            </article>
          </section>

          <section className="integrations-grid">
            <article className="page-card stack">
              <div className="integrations-card-header">
                <div className="stack-sm">
                  <span className="small-label">Google Calendar</span>
                  <h3 className="integrations-card-title">Calendar sync</h3>
                </div>

                <span className={`status-pill ${getStatusTone(integrations.integrationStatus)}`}>
                  {humanizeToken(integrations.integrationStatus, "Unknown")}
                </span>
              </div>

              <div className="integrations-details-grid">
                <div className="integrations-detail-card">
                  <span className="small-label">Calendar ID</span>
                  <strong>{maskCalendarId(integrations.googleCalendarId)}</strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Sync enabled</span>
                  <strong>{formatOnOff(integrations.calendarSyncEnabled)}</strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Last sync</span>
                  <strong>{formatDateTime(integrations.lastSyncAt)}</strong>
                </div>
              </div>
            </article>

            <article className="page-card stack">
              <div className="integrations-card-header">
                <div className="stack-sm">
                  <span className="small-label">Automation</span>
                  <h3 className="integrations-card-title">Webhook and reports</h3>
                </div>

                <span className={`status-pill ${integrations.dailyOwnerReportEnabled ? "done" : "pending"}`}>
                  {integrations.dailyOwnerReportEnabled ? "Reports enabled" : "Reports disabled"}
                </span>
              </div>

              <div className="integrations-details-grid">
                <div className="integrations-detail-card">
                  <span className="small-label">Webhook</span>
                  <strong>{maskWebhookUrl(integrations.makeWebhookUrl)}</strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Owner report email</span>
                  <strong>{integrations.ownerReportEmail || "Not configured"}</strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Daily owner report</span>
                  <strong>{formatOnOff(integrations.dailyOwnerReportEnabled)}</strong>
                </div>
              </div>
            </article>

            <article className="page-card stack integrations-full-width">
              <div className="integrations-card-header">
                <div className="stack-sm">
                  <span className="small-label">Troubleshooting</span>
                  <h3 className="integrations-card-title">Current integration notes</h3>
                </div>
              </div>

              <div className="integrations-details-grid">
                <div className="integrations-detail-card">
                  <span className="small-label">Last error</span>
                  <strong>{integrations.lastErrorMessage || "No recent error recorded"}</strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Created</span>
                  <strong>{formatDateTime(integrations.createdAt)}</strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Updated</span>
                  <strong>{formatDateTime(integrations.updatedAt)}</strong>
                </div>
              </div>

              <div className="integrations-readonly-note">
                Owners can review these values here, but integration changes are reserved for super admin.
              </div>
            </article>
          </section>
        </>
      )}

      <style jsx>{`
        .integrations-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .integrations-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .integrations-subtle {
          margin: 0;
          color: var(--muted);
        }

        .integrations-notice-banner {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          color: var(--text);
          padding: 14px 16px;
          border-radius: 16px;
        }

        .integrations-grid,
        .integrations-details-grid {
          display: grid;
          gap: 16px;
        }

        .integrations-grid {
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }

        .integrations-full-width {
          grid-column: 1 / -1;
        }

        .integrations-details-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .integrations-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .integrations-card-title {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.35;
        }

        .integrations-detail-card {
          border: 1px solid var(--border);
          background: var(--surface-soft);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 8px;
        }

        .integrations-readonly-note {
          border: 1px dashed var(--border-strong);
          background: var(--surface-soft);
          border-radius: 14px;
          padding: 14px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}

