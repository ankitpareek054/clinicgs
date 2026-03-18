"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

function makeEmptyBusinessHours() {
  return DAYS.reduce((accumulator, day) => {
    accumulator[day.key] = "";
    return accumulator;
  }, {});
}

function makeInitialForm(settings) {
  const businessHoursSource = settings?.businessHoursJson || {};

  return {
    defaultAppointmentDurationMins:
      settings?.defaultAppointmentDurationMins !== null &&
      settings?.defaultAppointmentDurationMins !== undefined
        ? String(settings.defaultAppointmentDurationMins)
        : "30",

    reminder24hEnabled: Boolean(settings?.reminder24hEnabled),
    reminder2hEnabled: Boolean(settings?.reminder2hEnabled),

    autoFollowupAfterNoShow: Boolean(settings?.autoFollowupAfterNoShow),
    noShowFollowupDelayHours:
      settings?.noShowFollowupDelayHours !== null &&
      settings?.noShowFollowupDelayHours !== undefined
        ? String(settings.noShowFollowupDelayHours)
        : "",

    publicFormAutoFollowupEnabled: Boolean(settings?.publicFormAutoFollowupEnabled),
    publicFormFollowupDelayHours:
      settings?.publicFormFollowupDelayHours !== null &&
      settings?.publicFormFollowupDelayHours !== undefined
        ? String(settings.publicFormFollowupDelayHours)
        : "",

    recallIntervalDays:
      settings?.recallIntervalDays !== null &&
      settings?.recallIntervalDays !== undefined
        ? String(settings.recallIntervalDays)
        : "",

    reviewRequestEnabled: Boolean(settings?.reviewRequestEnabled),
    reviewRequestDelayHours:
      settings?.reviewRequestDelayHours !== null &&
      settings?.reviewRequestDelayHours !== undefined
        ? String(settings.reviewRequestDelayHours)
        : "",

    googleReviewLink: settings?.googleReviewLink || "",
    messageTone: settings?.messageTone || "friendly",
    receptionistCanArchiveLeads: Boolean(settings?.receptionistCanArchiveLeads),

    businessHours: DAYS.reduce((accumulator, day) => {
      accumulator[day.key] = businessHoursSource?.[day.key] || "";
      return accumulator;
    }, {}),
  };
}

function canUseOperationalSettingsPage(user) {
  return user?.role === "owner";
}

function normalizeNullable(value) {
  const next = String(value ?? "").trim();
  return next === "" ? null : next;
}

function formatOnOff(value) {
  return value ? "Enabled" : "Disabled";
}

export default function ClinicSettingsPage() {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(makeInitialForm(null));

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (
      !isBootstrapping &&
      user &&
      !canUseOperationalSettingsPage(user) &&
      user.role !== "super_admin"
    ) {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const showSuperAdminPlaceholder = user?.role === "super_admin";

  const loadSettings = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user?.clinicId || !canUseOperationalSettingsPage(user) || showSuperAdminPlaceholder) {
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

        const payload = await api.get(`/clinic-settings/${user.clinicId}`);
        const data = extractApiData(payload, null);

        setSettings(data);
        setForm(makeInitialForm(data));
      } catch (err) {
        setError(err?.message || "Could not load clinic operational settings.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showSuperAdminPlaceholder, user]
  );

  useEffect(() => {
    if (
      !isBootstrapping &&
      user &&
      canUseOperationalSettingsPage(user) &&
      !showSuperAdminPlaceholder
    ) {
      loadSettings();
    }
  }, [isBootstrapping, loadSettings, showSuperAdminPlaceholder, user]);

  const stats = useMemo(() => {
    return {
      duration:
        form.defaultAppointmentDurationMins?.trim() || "—",
      reminders:
        `${form.reminder24hEnabled ? "24h" : ""}${
          form.reminder24hEnabled && form.reminder2hEnabled ? " + " : ""
        }${form.reminder2hEnabled ? "2h" : ""}` || "Disabled",
      tone: form.messageTone === "formal" ? "Formal" : "Friendly",
      archivePermission: form.receptionistCanArchiveLeads ? "Allowed" : "Not allowed",
    };
  }, [form]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateBusinessHour(dayKey, value) {
    setForm((current) => ({
      ...current,
      businessHours: {
        ...current.businessHours,
        [dayKey]: value,
      },
    }));
  }

  function resetForm() {
    setForm(makeInitialForm(settings));
  }

  function buildUpdatePayload() {
    const businessHoursJson = Object.fromEntries(
      Object.entries(form.businessHours || {})
        .map(([key, value]) => [key, String(value || "").trim()])
        .filter(([, value]) => value !== "")
    );

    const payload = {
      defaultAppointmentDurationMins: Number(form.defaultAppointmentDurationMins || 30),
      reminder24hEnabled: Boolean(form.reminder24hEnabled),
      reminder2hEnabled: Boolean(form.reminder2hEnabled),
      autoFollowupAfterNoShow: Boolean(form.autoFollowupAfterNoShow),
      publicFormAutoFollowupEnabled: Boolean(form.publicFormAutoFollowupEnabled),
      reviewRequestEnabled: Boolean(form.reviewRequestEnabled),
      googleReviewLink: normalizeNullable(form.googleReviewLink),
      messageTone: form.messageTone || "friendly",
      receptionistCanArchiveLeads: Boolean(form.receptionistCanArchiveLeads),
      businessHoursJson,
    };

    if (String(form.noShowFollowupDelayHours).trim() !== "") {
      payload.noShowFollowupDelayHours = Number(form.noShowFollowupDelayHours);
    }

    if (String(form.publicFormFollowupDelayHours).trim() !== "") {
      payload.publicFormFollowupDelayHours = Number(form.publicFormFollowupDelayHours);
    }

    if (String(form.recallIntervalDays).trim() !== "") {
      payload.recallIntervalDays = Number(form.recallIntervalDays);
    }

    if (String(form.reviewRequestDelayHours).trim() !== "") {
      payload.reviewRequestDelayHours = Number(form.reviewRequestDelayHours);
    }

    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError("");
      setNotice("");

      const payload = buildUpdatePayload();

      const response = await api.patch(`/clinic-settings/${user.clinicId}`, payload);
      const updatedSettings = extractApiData(response, null);

      setSettings(updatedSettings);
      setForm(makeInitialForm(updatedSettings));
      setNotice("Operational settings updated successfully.");
    } catch (err) {
      setError(err?.message || "Could not update clinic operational settings.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading operational settings"
        description="Checking your session and preparing clinic-level operational settings."
        points={[
          "Verifying owner access",
          "Loading saved clinic settings",
          "Preparing edit controls",
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
        title="Super admin settings stay separate"
        description="This page is for clinic owners editing operational settings. Super admin settings management should stay in a separate admin workspace."
        points={[
          "Owners edit clinic operational settings here",
          "Super admin can still manage settings elsewhere",
          "This keeps clinic and admin workflows separate",
        ]}
      />
    );
  }

  if (!canUseOperationalSettingsPage(user)) {
    return (
      <PagePlaceholder
        title="Owner-only page"
        description="Operational Settings is currently available only to clinic owners."
        points={[
          "Owners manage clinic operational rules here",
          "Receptionists stay focused on daily operations",
          "Clinic behavior remains owner-controlled",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="settings-header-row">
          <div className="stack-sm">
            <span className="small-label">Owner workspace</span>
            <h1>Operational Settings</h1>
            <p className="settings-subtle">
              Control appointment defaults, reminders, follow-up behavior, review settings,
              message tone, archive permissions, and business hours.
            </p>
          </div>

          <div className="settings-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadSettings({ refresh: true })}
              disabled={isLoading || isRefreshing || isSaving}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "error-banner" : "settings-notice-banner"}>
          {error || notice}
        </div>
      )}

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="small-label">Default appointment</span>
          <strong>{stats.duration} min</strong>
          <p className="settings-subtle">Base duration for new appointments.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Reminders</span>
          <strong>{stats.reminders}</strong>
          <p className="settings-subtle">Current reminder windows enabled.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Message tone</span>
          <strong>{stats.tone}</strong>
          <p className="settings-subtle">Default communication style.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Receptionist archive</span>
          <strong>{stats.archivePermission}</strong>
          <p className="settings-subtle">Clinic-level archive permission for receptionists.</p>
        </article>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading operational settings…</div>
        </section>
      ) : (
        <form className="stack" onSubmit={handleSubmit}>
          <section className="page-card stack">
            <div className="stack-sm">
              <span className="small-label">Appointments and reminders</span>
              <p className="settings-subtle">
                Configure default appointment duration and reminder behavior.
              </p>
            </div>

            <div className="settings-grid">
              <label className="settings-field">
                <span>Default appointment duration (mins)</span>
                <input
                  type="number"
                  min="1"
                  value={form.defaultAppointmentDurationMins}
                  onChange={(event) =>
                    updateForm("defaultAppointmentDurationMins", event.target.value)
                  }
                  disabled={isSaving}
                  required
                />
              </label>

              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={form.reminder24hEnabled}
                  onChange={(event) => updateForm("reminder24hEnabled", event.target.checked)}
                  disabled={isSaving}
                />
                <span>Enable 24-hour reminder</span>
              </label>

              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={form.reminder2hEnabled}
                  onChange={(event) => updateForm("reminder2hEnabled", event.target.checked)}
                  disabled={isSaving}
                />
                <span>Enable 2-hour reminder</span>
              </label>
            </div>
          </section>

          <section className="page-card stack">
            <div className="stack-sm">
              <span className="small-label">Follow-up and recall</span>
              <p className="settings-subtle">
                Configure no-show follow-up, public form follow-up, and recall timing.
              </p>
            </div>

            <div className="settings-grid">
              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={form.autoFollowupAfterNoShow}
                  onChange={(event) =>
                    updateForm("autoFollowupAfterNoShow", event.target.checked)
                  }
                  disabled={isSaving}
                />
                <span>Auto-create follow-up after no-show</span>
              </label>

              <label className="settings-field">
                <span>No-show follow-up delay (hours)</span>
                <input
                  type="number"
                  min="1"
                  value={form.noShowFollowupDelayHours}
                  onChange={(event) =>
                    updateForm("noShowFollowupDelayHours", event.target.value)
                  }
                  placeholder="e.g. 24"
                  disabled={isSaving}
                />
              </label>

              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={form.publicFormAutoFollowupEnabled}
                  onChange={(event) =>
                    updateForm("publicFormAutoFollowupEnabled", event.target.checked)
                  }
                  disabled={isSaving}
                />
                <span>Auto-create follow-up for public form leads</span>
              </label>

              <label className="settings-field">
                <span>Public form follow-up delay (hours)</span>
                <input
                  type="number"
                  min="1"
                  value={form.publicFormFollowupDelayHours}
                  onChange={(event) =>
                    updateForm("publicFormFollowupDelayHours", event.target.value)
                  }
                  placeholder="e.g. 1"
                  disabled={isSaving}
                />
              </label>

              <label className="settings-field">
                <span>Recall interval (days)</span>
                <input
                  type="number"
                  min="1"
                  value={form.recallIntervalDays}
                  onChange={(event) => updateForm("recallIntervalDays", event.target.value)}
                  placeholder="e.g. 180"
                  disabled={isSaving}
                />
              </label>
            </div>
          </section>

          <section className="page-card stack">
            <div className="stack-sm">
              <span className="small-label">Reviews and messaging</span>
              <p className="settings-subtle">
                Configure review request defaults, Google review link, and message tone.
              </p>
            </div>

            <div className="settings-grid">
              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={form.reviewRequestEnabled}
                  onChange={(event) =>
                    updateForm("reviewRequestEnabled", event.target.checked)
                  }
                  disabled={isSaving}
                />
                <span>Enable review request flow</span>
              </label>

              <label className="settings-field">
                <span>Review request delay (hours)</span>
                <input
                  type="number"
                  min="0"
                  value={form.reviewRequestDelayHours}
                  onChange={(event) =>
                    updateForm("reviewRequestDelayHours", event.target.value)
                  }
                  placeholder="e.g. 6"
                  disabled={isSaving}
                />
              </label>

              <label className="settings-field">
                <span>Google review link</span>
                <input
                  type="url"
                  value={form.googleReviewLink}
                  onChange={(event) => updateForm("googleReviewLink", event.target.value)}
                  placeholder="https://..."
                  disabled={isSaving}
                />
              </label>

              <label className="settings-field">
                <span>Message tone</span>
                <select
                  value={form.messageTone}
                  onChange={(event) => updateForm("messageTone", event.target.value)}
                  disabled={isSaving}
                >
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                </select>
              </label>
            </div>
          </section>

          <section className="page-card stack">
            <div className="stack-sm">
              <span className="small-label">Permissions and business hours</span>
              <p className="settings-subtle">
                Control receptionist archive permissions and set clinic business hours.
              </p>
            </div>

            <label className="settings-toggle-row">
              <input
                type="checkbox"
                checked={form.receptionistCanArchiveLeads}
                onChange={(event) =>
                  updateForm("receptionistCanArchiveLeads", event.target.checked)
                }
                disabled={isSaving}
              />
              <span>Allow receptionists to archive and view archived leads</span>
            </label>

            <div className="settings-hours-grid">
              {DAYS.map((day) => (
                <label className="settings-field" key={day.key}>
                  <span>{day.label}</span>
                  <input
                    type="text"
                    value={form.businessHours[day.key] || ""}
                    onChange={(event) =>
                      updateBusinessHour(day.key, event.target.value)
                    }
                    placeholder="09:00-18:00 or Closed"
                    disabled={isSaving}
                  />
                </label>
              ))}
            </div>
          </section>

          <div className="settings-form-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={resetForm}
              disabled={isSaving}
            >
              Reset
            </button>

            <button
              type="submit"
              className="secondary-button compact-button settings-primary-button"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save operational settings"}
            </button>
          </div>

          <section className="page-card stack">
            <div className="stack-sm">
              <span className="small-label">Current operational snapshot</span>
              <p className="settings-subtle">
                Quick read-only summary of the currently loaded settings.
              </p>
            </div>

            <div className="settings-summary-grid">
              <div className="settings-summary-card">
                <span className="small-label">24h reminder</span>
                <strong>{formatOnOff(form.reminder24hEnabled)}</strong>
              </div>

              <div className="settings-summary-card">
                <span className="small-label">2h reminder</span>
                <strong>{formatOnOff(form.reminder2hEnabled)}</strong>
              </div>

              <div className="settings-summary-card">
                <span className="small-label">No-show auto follow-up</span>
                <strong>{formatOnOff(form.autoFollowupAfterNoShow)}</strong>
              </div>

              <div className="settings-summary-card">
                <span className="small-label">Public form auto follow-up</span>
                <strong>{formatOnOff(form.publicFormAutoFollowupEnabled)}</strong>
              </div>

              <div className="settings-summary-card">
                <span className="small-label">Review requests</span>
                <strong>{formatOnOff(form.reviewRequestEnabled)}</strong>
              </div>

              <div className="settings-summary-card">
                <span className="small-label">Receptionist archive</span>
                <strong>{formatOnOff(form.receptionistCanArchiveLeads)}</strong>
              </div>
            </div>
          </section>
        </form>
      )}

      <style jsx>{`
        .settings-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .settings-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .settings-subtle {
          margin: 0;
          color: var(--muted);
        }

        .settings-notice-banner {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          color: var(--text);
          padding: 14px 16px;
          border-radius: 16px;
        }

        .settings-primary-button {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }

        .settings-primary-button:hover:not(:disabled) {
          background: var(--surface-soft);
        }

        .settings-grid,
        .settings-hours-grid,
        .settings-summary-grid {
          display: grid;
          gap: 16px;
        }

        .settings-grid,
        .settings-summary-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .settings-hours-grid {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }

        .settings-field {
          display: grid;
          gap: 8px;
        }

        .settings-field span {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .settings-field input,
        .settings-field select {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          border-radius: 14px;
          padding: 12px 14px;
          font: inherit;
          outline: none;
        }

        .settings-field input:focus,
        .settings-field select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }

        .settings-toggle-row {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          min-height: 48px;
        }

        .settings-toggle-row input {
          width: 16px;
          height: 16px;
        }

        .settings-form-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .settings-summary-card {
          border: 1px solid var(--border);
          background: var(--surface-soft);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}