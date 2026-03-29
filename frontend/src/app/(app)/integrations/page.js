"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const INTEGRATION_STATUS_OPTIONS = [
  { value: "not_configured", label: "Not configured" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "error", label: "Error" },
];

const EMPTY_FORM = {
  googleCalendarId: "",
  calendarSyncEnabled: false,
  makeWebhookUrl: "",
  integrationStatus: "not_configured",
  ownerReportEmail: "",
  dailyOwnerReportEnabled: false,
  lastErrorMessage: "",
};

function canViewIntegrationsPage(user) {
  return user?.role === "super_admin";
}

function canEditIntegrationsPage(user) {
  return user?.role === "super_admin";
}

function getClinicTargetId(user, selectedAdminClinic) {
  if (user?.role === "super_admin") {
    return selectedAdminClinic?.id ?? null;
  }

  if (user?.role === "owner") {
    return user?.clinicId ?? null;
  }

  return null;
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

  if (
    ["connected", "active", "healthy", "ok", "enabled", "success"].includes(
      normalized,
    )
  ) {
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

function isMissingIntegrationsError(err) {
  const message = String(err?.message || "")
    .trim()
    .toLowerCase();

  return (
    err?.status === 404 ||
    message.includes("clinic integration settings not found") ||
    message.includes("clinic integrations not found") ||
    message.includes("integration settings not found")
  );
}

function normalizeNullableString(value) {
  const next = String(value ?? "").trim();
  return next === "" ? null : next;
}

function buildFormFromIntegrations(integrations) {
  if (!integrations) {
    return EMPTY_FORM;
  }

  return {
    googleCalendarId: integrations.googleCalendarId || "",
    calendarSyncEnabled: Boolean(integrations.calendarSyncEnabled),
    makeWebhookUrl: integrations.makeWebhookUrl || "",
    integrationStatus: integrations.integrationStatus || "not_configured",
    ownerReportEmail: integrations.ownerReportEmail || "",
    dailyOwnerReportEnabled: Boolean(integrations.dailyOwnerReportEnabled),
    lastErrorMessage: integrations.lastErrorMessage || "",
  };
}

function normalizeFormForCompare(form) {
  return {
    googleCalendarId: String(form?.googleCalendarId || "").trim(),
    calendarSyncEnabled: Boolean(form?.calendarSyncEnabled),
    makeWebhookUrl: String(form?.makeWebhookUrl || "").trim(),
    integrationStatus: String(
      form?.integrationStatus || "not_configured",
    ).trim(),
    ownerReportEmail: String(form?.ownerReportEmail || "").trim(),
    dailyOwnerReportEnabled: Boolean(form?.dailyOwnerReportEnabled),
    lastErrorMessage: String(form?.lastErrorMessage || "").trim(),
  };
}

function buildUpdatePayload(form) {
  return {
    googleCalendarId: normalizeNullableString(form.googleCalendarId),
    calendarSyncEnabled: Boolean(form.calendarSyncEnabled),
    makeWebhookUrl: normalizeNullableString(form.makeWebhookUrl),
    integrationStatus: form.integrationStatus || "not_configured",
    ownerReportEmail: normalizeNullableString(form.ownerReportEmail),
    dailyOwnerReportEnabled: Boolean(form.dailyOwnerReportEnabled),
    lastErrorMessage: normalizeNullableString(form.lastErrorMessage),
  };
}

function getWorkspaceCopy(user, selectedAdminClinic) {
  if (user?.role === "super_admin") {
    return {
      eyebrow: "Super admin clinic management",
      description: selectedAdminClinic?.name
        ? `Review and manage integration settings for ${selectedAdminClinic.name}.`
        : "Review and manage integration settings for the selected clinic.",
      loadingDescription:
        "Checking selected clinic access and preparing clinic integration controls.",
    };
  }

  return {
    eyebrow: "Workspace",
    description: "Integrations is not available in this workspace.",
    loadingDescription: "Preparing workspace.",
  };
}

function isValidOptionalUrl(value) {
  const next = String(value || "").trim();
  if (!next) return true;

  try {
    new URL(next);
    return true;
  } catch {
    return false;
  }
}

function isValidOptionalEmail(value) {
  const next = String(value || "").trim();
  if (!next) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next);
}

export default function IntegrationsPage() {
  const router = useRouter();
  const { user, isBootstrapping, selectedAdminClinic = null } = useAuth();

  const [integrations, setIntegrations] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSuperAdmin = user?.role === "super_admin";
  const canEdit = canEditIntegrationsPage(user);
  const targetClinicId = getClinicTargetId(user, selectedAdminClinic);

  const workspaceCopy = useMemo(() => {
    return getWorkspaceCopy(user, selectedAdminClinic);
  }, [user, selectedAdminClinic]);

  useEffect(() => {
    if (!isBootstrapping && user && !canViewIntegrationsPage(user)) {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const loadIntegrations = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user || !targetClinicId || !canViewIntegrationsPage(user)) {
        setIntegrations(null);
        setForm(EMPTY_FORM);
        setIsEditing(false);
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

        const payload = await api.get(`/clinic-integrations/${targetClinicId}`);
        const data = extractApiData(payload, null);

        setIntegrations(data);
        setForm(buildFormFromIntegrations(data));
        setIsEditing(false);
      } catch (err) {
        if (isMissingIntegrationsError(err)) {
          setIntegrations(null);
          setForm(EMPTY_FORM);
          setError("");
          setNotice("");
          setIsEditing(false);
        } else {
          setIntegrations(null);
          setForm(EMPTY_FORM);
          setError(err?.message || "Could not load clinic integrations.");
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [targetClinicId, user],
  );

  useEffect(() => {
    if (!isBootstrapping && user && canViewIntegrationsPage(user)) {
      if (isSuperAdmin && !targetClinicId) {
        setIntegrations(null);
        setForm(EMPTY_FORM);
        setIsEditing(false);
        setIsLoading(false);
        return;
      }

      loadIntegrations();
    }
  }, [isBootstrapping, isSuperAdmin, loadIntegrations, targetClinicId, user]);

  const summary = useMemo(() => {
    return {
      status: humanizeToken(integrations?.integrationStatus, "Unknown"),
      calendarSync: formatOnOff(integrations?.calendarSyncEnabled),
      dailyOwnerReport: formatOnOff(integrations?.dailyOwnerReportEnabled),
      lastSyncAt: formatDateTime(integrations?.lastSyncAt),
    };
  }, [integrations]);

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(normalizeFormForCompare(form)) !==
      JSON.stringify(
        normalizeFormForCompare(buildFormFromIntegrations(integrations)),
      )
    );
  }, [form, integrations]);

  const validationMessage = useMemo(() => {
    if (!isValidOptionalUrl(form.makeWebhookUrl)) {
      return "Webhook URL must be a valid URL.";
    }

    if (!isValidOptionalEmail(form.ownerReportEmail)) {
      return "Owner report email must be a valid email address.";
    }

    return "";
  }, [form.makeWebhookUrl, form.ownerReportEmail]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(buildFormFromIntegrations(integrations));
    setError("");
    setNotice("");
  }

  function handleStartEdit() {
    setForm(buildFormFromIntegrations(integrations));
    setError("");
    setNotice("");
    setIsEditing(true);
  }

  function handleCancelEdit() {
    resetForm();
    setIsEditing(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canEdit || !integrations || !targetClinicId) {
      return;
    }

    if (!hasChanges) {
      setNotice("There are no changes to save.");
      setError("");
      return;
    }

    if (validationMessage) {
      setError(validationMessage);
      setNotice("");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setNotice("");

      const payload = buildUpdatePayload(form);
      const response = await api.patch(
        `/clinic-integrations/${targetClinicId}`,
        payload,
      );
      const data = extractApiData(response, null);

      setIntegrations(data);
      setForm(buildFormFromIntegrations(data));
      setIsEditing(false);
      setNotice("Integrations updated successfully.");
    } catch (err) {
      setError(err?.message || "Could not update clinic integrations.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading integrations"
        description={workspaceCopy.loadingDescription}
        points={[
          "Verifying super-admin access",
          "Checking selected clinic",
          "Preparing integration controls",
        ]}
      />
    );
  }

  if (!user) {
    return null;
  }

  if (!canViewIntegrationsPage(user)) {
    return (
      <PagePlaceholder
        title="Access restricted"
        description="Integrations is available only to super admin in V1."
        points={[
          "Super admin manages clinic integration settings here",
          "Owners do not use this page in V1",
          "Receptionists stay focused on operational work",
        ]}
      />
    );
  }

  if (isSuperAdmin && !targetClinicId) {
    return (
      <PagePlaceholder
        title="Choose a clinic first"
        description="Open Clinics, select the clinic you want to manage, and then open Integrations from there."
        points={[
          "Go to Clinics from the sidebar",
          "Choose the clinic you want to manage",
          "Open Integrations from the clinic action panel",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="integrations-header-row">
          <div className="stack-sm">
            <span className="small-label">{workspaceCopy.eyebrow}</span>
            <h1>Integrations</h1>
            <p className="integrations-subtle">{workspaceCopy.description}</p>
          </div>

          <div className="integrations-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => router.push("/clinics")}
            >
              Back to Clinics
            </button>

            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadIntegrations({ refresh: true })}
              disabled={isLoading || isRefreshing || isSaving || isEditing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            {canEdit && integrations ? (
              !isEditing ? (
                <button
                  type="button"
                  className="secondary-button compact-button integrations-primary-button"
                  onClick={handleStartEdit}
                  disabled={isLoading || isRefreshing || isSaving}
                >
                  Edit integrations
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              )
            ) : null}
          </div>
        </div>
      </header>

      {(error || notice || (isEditing && validationMessage)) && (
        <div
          className={
            error || (isEditing && validationMessage)
              ? "error-banner"
              : "integrations-notice-banner"
          }
        >
          {error || validationMessage || notice}
        </div>
      )}

      <section className="page-card stack-sm">
        <div className="stack-sm">
          <span className="small-label">Selected clinic</span>
          <strong className="integrations-context-title">
            {selectedAdminClinic?.name || "Selected clinic"}
          </strong>
          <p className="integrations-subtle">
            This page stays available for super admin only in V1. The route is
            kept in place now, while deeper integration setup work can be
            completed later.
          </p>
        </div>

        <div className="integrations-context-actions">
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => router.push("/clinic-profile")}
          >
            Clinic Profile
          </button>

          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => router.push("/clinic-settings")}
          >
            Operational Settings
          </button>

          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => router.push("/staff")}
          >
            Staff
          </button>

          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => router.push("/services")}
          >
            Services
          </button>

          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => router.push("/clinics")}
          >
            Back to Clinics
          </button>
        </div>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading integrations…</div>
        </section>
      ) : !integrations ? (
        <section className="page-card stack">
          <div className="stack-sm">
            <span className="small-label">Integrations not configured yet</span>
            <p className="integrations-subtle">
              This clinic does not have integration settings yet. That is okay
              for now. The integrations surface remains available so final sync
              and reporting work can be completed later in the project.
            </p>
          </div>

          <div className="integrations-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadIntegrations({ refresh: true })}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Retry"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="metrics-grid">
            <article className="metric-card">
              <span className="small-label">Integration status</span>
              <strong>{summary.status}</strong>
              <p className="integrations-subtle">
                Overall clinic integration health.
              </p>
            </article>

            <article className="metric-card">
              <span className="small-label">Calendar sync</span>
              <strong>{summary.calendarSync}</strong>
              <p className="integrations-subtle">
                Whether calendar sync is enabled.
              </p>
            </article>

            <article className="metric-card">
              <span className="small-label">Daily owner report</span>
              <strong>{summary.dailyOwnerReport}</strong>
              <p className="integrations-subtle">
                Whether owner reports are enabled.
              </p>
            </article>

            <article className="metric-card">
              <span className="small-label">Last sync</span>
              <strong>{summary.lastSyncAt}</strong>
              <p className="integrations-subtle">Most recent sync timestamp.</p>
            </article>
          </section>

          {isEditing ? (
            <form className="page-card stack" onSubmit={handleSubmit}>
              <div className="integrations-card-header">
                <div className="stack-sm">
                  <span className="small-label">Super admin editor</span>
                  <h3 className="integrations-card-title">
                    Update clinic integrations
                  </h3>
                </div>

                <span
                  className={`status-pill ${getStatusTone(form.integrationStatus)}`}
                >
                  {humanizeToken(form.integrationStatus, "Unknown")}
                </span>
              </div>

              <div className="integrations-details-grid">
                <label className="integrations-field">
                  <span>Google Calendar ID</span>
                  <input
                    type="text"
                    value={form.googleCalendarId}
                    onChange={(event) =>
                      updateForm("googleCalendarId", event.target.value)
                    }
                    maxLength={255}
                    disabled={isSaving}
                  />
                </label>

                <label className="integrations-field">
                  <span>Webhook URL</span>
                  <input
                    type="url"
                    value={form.makeWebhookUrl}
                    onChange={(event) =>
                      updateForm("makeWebhookUrl", event.target.value)
                    }
                    placeholder="https://..."
                    maxLength={1000}
                    disabled={isSaving}
                  />
                </label>

                <label className="integrations-field">
                  <span>Owner report email</span>
                  <input
                    type="email"
                    value={form.ownerReportEmail}
                    onChange={(event) =>
                      updateForm("ownerReportEmail", event.target.value)
                    }
                    maxLength={255}
                    disabled={isSaving}
                  />
                </label>

                <label className="integrations-field">
                  <span>Integration status</span>
                  <select
                    value={form.integrationStatus}
                    onChange={(event) =>
                      updateForm("integrationStatus", event.target.value)
                    }
                    disabled={isSaving}
                  >
                    {INTEGRATION_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="integrations-toggle-row">
                  <input
                    type="checkbox"
                    checked={form.calendarSyncEnabled}
                    onChange={(event) =>
                      updateForm("calendarSyncEnabled", event.target.checked)
                    }
                    disabled={isSaving}
                  />
                  <span>Enable calendar sync</span>
                </label>

                <label className="integrations-toggle-row">
                  <input
                    type="checkbox"
                    checked={form.dailyOwnerReportEnabled}
                    onChange={(event) =>
                      updateForm(
                        "dailyOwnerReportEnabled",
                        event.target.checked,
                      )
                    }
                    disabled={isSaving}
                  />
                  <span>Enable daily owner report</span>
                </label>
              </div>

              <label className="integrations-field">
                <span>Last error message</span>
                <textarea
                  value={form.lastErrorMessage}
                  onChange={(event) =>
                    updateForm("lastErrorMessage", event.target.value)
                  }
                  rows={4}
                  maxLength={2000}
                  disabled={isSaving}
                  placeholder="Optional current integration issue note"
                />
              </label>

              <div className="integrations-form-actions">
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={resetForm}
                  disabled={!hasChanges || isSaving}
                >
                  Reset
                </button>

                <button
                  type="submit"
                  className="secondary-button compact-button integrations-primary-button"
                  disabled={
                    !hasChanges || isSaving || Boolean(validationMessage)
                  }
                >
                  {isSaving ? "Saving..." : "Save integrations"}
                </button>
              </div>
            </form>
          ) : null}

          <section className="integrations-grid">
            <article className="page-card stack">
              <div className="integrations-card-header">
                <div className="stack-sm">
                  <span className="small-label">Google Calendar</span>
                  <h3 className="integrations-card-title">Calendar sync</h3>
                </div>

                <span
                  className={`status-pill ${getStatusTone(integrations.integrationStatus)}`}
                >
                  {humanizeToken(integrations.integrationStatus, "Unknown")}
                </span>
              </div>

              <div className="integrations-details-grid">
                <div className="integrations-detail-card">
                  <span className="small-label">Calendar ID</span>
                  <strong>
                    {maskCalendarId(integrations.googleCalendarId)}
                  </strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Sync enabled</span>
                  <strong>
                    {formatOnOff(integrations.calendarSyncEnabled)}
                  </strong>
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
                  <h3 className="integrations-card-title">
                    Webhook and reports
                  </h3>
                </div>

                <span
                  className={`status-pill ${
                    integrations.dailyOwnerReportEnabled ? "done" : "pending"
                  }`}
                >
                  {integrations.dailyOwnerReportEnabled
                    ? "Reports enabled"
                    : "Reports disabled"}
                </span>
              </div>

              <div className="integrations-details-grid">
                <div className="integrations-detail-card">
                  <span className="small-label">Webhook</span>
                  <strong>{maskWebhookUrl(integrations.makeWebhookUrl)}</strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Owner report email</span>
                  <strong>
                    {integrations.ownerReportEmail || "Not configured"}
                  </strong>
                </div>

                <div className="integrations-detail-card">
                  <span className="small-label">Daily owner report</span>
                  <strong>
                    {formatOnOff(integrations.dailyOwnerReportEnabled)}
                  </strong>
                </div>
              </div>
            </article>

            <article className="page-card stack integrations-full-width">
              <div className="integrations-card-header">
                <div className="stack-sm">
                  <span className="small-label">Troubleshooting</span>
                  <h3 className="integrations-card-title">
                    Current integration notes
                  </h3>
                </div>
              </div>

              <div className="integrations-details-grid">
                <div className="integrations-detail-card">
                  <span className="small-label">Last error</span>
                  <strong>
                    {integrations.lastErrorMessage ||
                      "No recent error recorded"}
                  </strong>
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
                This clinic is loaded in super-admin mode, so you can review and
                update the same integration record here. Deeper sync automation
                work can still be completed later in the project.
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

        .integrations-header-actions,
        .integrations-context-actions,
        .integrations-form-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .integrations-subtle {
          margin: 0;
          color: var(--muted);
        }

        .integrations-context-title {
          color: var(--text);
          line-height: 1.3;
        }

        .integrations-notice-banner {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          color: var(--text);
          padding: 14px 16px;
          border-radius: 16px;
        }

        .integrations-primary-button {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }

        .integrations-primary-button:hover:not(:disabled) {
          background: var(--surface-soft);
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

        .integrations-field {
          display: grid;
          gap: 8px;
        }

        .integrations-field span {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .integrations-field input,
        .integrations-field select,
        .integrations-field textarea {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          border-radius: 14px;
          padding: 12px 14px;
          font: inherit;
          outline: none;
        }

        .integrations-field input:focus,
        .integrations-field select:focus,
        .integrations-field textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }

        .integrations-field textarea {
          resize: vertical;
          min-height: 110px;
        }

        .integrations-toggle-row {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          padding-top: 22px;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
