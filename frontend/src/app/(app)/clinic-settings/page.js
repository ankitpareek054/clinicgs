
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

function normalizeBusinessHours(hours) {
  const source = hours || {};

  return DAYS.reduce((accumulator, day) => {
    accumulator[day.key] = String(source?.[day.key] || "").trim();
    return accumulator;
  }, makeEmptyBusinessHours());
}

function makeInitialForm(settings) {
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
    businessHours: normalizeBusinessHours(settings?.businessHoursJson),
  };
}

function normalizeFormForCompare(form) {
  return {
    defaultAppointmentDurationMins: String(form?.defaultAppointmentDurationMins || "").trim(),
    reminder24hEnabled: Boolean(form?.reminder24hEnabled),
    reminder2hEnabled: Boolean(form?.reminder2hEnabled),
    autoFollowupAfterNoShow: Boolean(form?.autoFollowupAfterNoShow),
    noShowFollowupDelayHours: String(form?.noShowFollowupDelayHours || "").trim(),
    publicFormAutoFollowupEnabled: Boolean(form?.publicFormAutoFollowupEnabled),
    publicFormFollowupDelayHours: String(form?.publicFormFollowupDelayHours || "").trim(),
    recallIntervalDays: String(form?.recallIntervalDays || "").trim(),
    reviewRequestEnabled: Boolean(form?.reviewRequestEnabled),
    reviewRequestDelayHours: String(form?.reviewRequestDelayHours || "").trim(),
    googleReviewLink: String(form?.googleReviewLink || "").trim(),
    messageTone: form?.messageTone === "formal" ? "formal" : "friendly",
    receptionistCanArchiveLeads: Boolean(form?.receptionistCanArchiveLeads),
    businessHours: normalizeBusinessHours(form?.businessHours),
  };
}

function canUseOperationalSettingsPage(user) {
  return user?.role === "owner" || user?.role === "super_admin";
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

function normalizeNullable(value) {
  const next = String(value ?? "").trim();
  return next === "" ? null : next;
}

function formatOnOff(value) {
  return value ? "Enabled" : "Disabled";
}

function isPositiveIntegerString(value) {
  if (String(value).trim() === "") return false;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0;
}

function isZeroOrPositiveIntegerString(value) {
  if (String(value).trim() === "") return false;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0;
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function mergeSavedSettings(currentSettings, payload, responseData) {
  if (responseData) {
    return responseData;
  }

  return {
    ...(currentSettings || {}),
    ...payload,
    businessHoursJson: payload.businessHoursJson,
  };
}

function getWorkspaceCopy(user, selectedAdminClinic) {
  if (user?.role === "super_admin") {
    return {
      eyebrow: "Super admin clinic management",
      description: selectedAdminClinic?.name
        ? `Manage operational settings for ${selectedAdminClinic.name}.`
        : "Manage operational settings for the selected clinic.",
      loadingDescription:
        "Checking super-admin clinic access and preparing clinic operational settings.",
    };
  }

  return {
    eyebrow: "Owner workspace",
    description:
      "Control appointment defaults, reminders, follow-up behavior, review settings, message tone, archive permissions, and business hours.",
    loadingDescription:
      "Checking your session and preparing clinic-level operational settings.",
  };
}

export default function ClinicSettingsPage() {
  const router = useRouter();
  const { user, isBootstrapping, selectedAdminClinic = null } = useAuth();

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(makeInitialForm(null));

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSuperAdmin = user?.role === "super_admin";
  const targetClinicId = getClinicTargetId(user, selectedAdminClinic);
  const workspaceCopy = useMemo(
    () => getWorkspaceCopy(user, selectedAdminClinic),
    [user, selectedAdminClinic]
  );

  useEffect(() => {
    if (!isBootstrapping && user && !canUseOperationalSettingsPage(user)) {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const loadSettings = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user || !targetClinicId || !canUseOperationalSettingsPage(user)) {
        setSettings(null);
        setForm(makeInitialForm(null));
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

        const payload = await api.get(`/clinic-settings/${targetClinicId}`);
        const data = extractApiData(payload, null);

        setSettings(data);
        setForm(makeInitialForm(data));
        setIsEditing(false);
      } catch (err) {
        setSettings(null);
        setForm(makeInitialForm(null));
        setError(err?.message || "Could not load clinic operational settings.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [targetClinicId, user]
  );

  useEffect(() => {
    if (!isBootstrapping && user && canUseOperationalSettingsPage(user)) {
      if (isSuperAdmin && !targetClinicId) {
        setSettings(null);
        setForm(makeInitialForm(null));
        setIsEditing(false);
        setIsLoading(false);
        return;
      }

      loadSettings();
    }
  }, [isBootstrapping, isSuperAdmin, loadSettings, targetClinicId, user]);

  const baselineForm = useMemo(() => makeInitialForm(settings), [settings]);

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(normalizeFormForCompare(form)) !==
      JSON.stringify(normalizeFormForCompare(baselineForm))
    );
  }, [baselineForm, form]);

  const validationMessage = useMemo(() => {
    if (!isPositiveIntegerString(form.defaultAppointmentDurationMins)) {
      return "Default appointment duration must be at least 1 minute.";
    }

    if (
      String(form.noShowFollowupDelayHours).trim() !== "" &&
      !isPositiveIntegerString(form.noShowFollowupDelayHours)
    ) {
      return "No-show follow-up delay must be a whole number greater than 0.";
    }

    if (
      String(form.publicFormFollowupDelayHours).trim() !== "" &&
      !isPositiveIntegerString(form.publicFormFollowupDelayHours)
    ) {
      return "Public form follow-up delay must be a whole number greater than 0.";
    }

    if (
      String(form.recallIntervalDays).trim() !== "" &&
      !isPositiveIntegerString(form.recallIntervalDays)
    ) {
      return "Recall interval must be a whole number greater than 0.";
    }

    if (
      String(form.reviewRequestDelayHours).trim() !== "" &&
      !isZeroOrPositiveIntegerString(form.reviewRequestDelayHours)
    ) {
      return "Review request delay must be a whole number 0 or greater.";
    }

    if (
      String(form.googleReviewLink).trim() !== "" &&
      !isValidUrl(form.googleReviewLink)
    ) {
      return "Google review link must be a valid URL.";
    }

    return "";
  }, [form]);

  const stats = useMemo(() => {
    const reminders = [
      form.reminder24hEnabled ? "24h" : "",
      form.reminder2hEnabled ? "2h" : "",
    ]
      .filter(Boolean)
      .join(" + ");

    return {
      duration: form.defaultAppointmentDurationMins?.trim() || "—",
      reminders: reminders || "Disabled",
      tone: form.messageTone === "formal" ? "Formal" : "Friendly",
      archivePermission: form.receptionistCanArchiveLeads ? "Allowed" : "Not allowed",
    };
  }, [form]);

  const bannerMessage = error || (isEditing ? validationMessage : "") || notice;
  const bannerClass =
    error || (isEditing && validationMessage)
      ? "error-banner"
      : "settings-notice-banner";

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

  function handleStartEdit() {
    if (!settings) return;
    setError("");
    setNotice("");
    setForm(makeInitialForm(settings));
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setForm(makeInitialForm(settings));
    setError("");
    setNotice("");
    setIsEditing(false);
  }

  function resetForm() {
    setForm(makeInitialForm(settings));
    setError("");
    setNotice("");
  }

  function buildUpdatePayload() {
    const businessHoursJson = Object.fromEntries(
      Object.entries(normalizeBusinessHours(form.businessHours))
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

    if (!settings) {
      setError("Operational settings are not available right now.");
      setNotice("");
      return;
    }

    if (!isEditing) {
      return;
    }

    if (!hasChanges) {
      setError("");
      setNotice("There are no changes to save.");
      return;
    }

    if (validationMessage) {
      setError(validationMessage);
      setNotice("");
      return;
    }

    if (!targetClinicId) {
      setError("No clinic is selected for this settings workspace.");
      setNotice("");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setNotice("");

      const payload = buildUpdatePayload();

      const response = await api.patch(`/clinic-settings/${targetClinicId}`, payload);
      const responseData = extractApiData(response, null);
      const mergedSettings = mergeSavedSettings(settings, payload, responseData);

      setSettings(mergedSettings);
      setForm(makeInitialForm(mergedSettings));
      setIsEditing(false);
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
        description={workspaceCopy.loadingDescription}
        points={
          isSuperAdmin
            ? [
                "Verifying super-admin access",
                "Loading selected clinic settings",
                "Preparing operational controls",
              ]
            : [
                "Verifying owner access",
                "Loading saved clinic settings",
                "Preparing edit controls",
              ]
        }
      />
    );
  }

  if (!user) {
    return null;
  }

  if (!canUseOperationalSettingsPage(user)) {
    return (
      <PagePlaceholder
        title="Access restricted"
        description="Operational Settings is available only to clinic owners and super admin."
        points={[
          "Owners manage their clinic settings here",
          "Super admin manages one clinic at a time here",
          "Receptionists stay focused on operational workflows",
        ]}
      />
    );
  }

  if (isSuperAdmin && !targetClinicId) {
    return (
      <PagePlaceholder
        title="Choose a clinic first"
        description="Open Clinics, select the clinic you want to manage, and then open Operational Settings from there."
        points={[
          "Go to Clinics from the sidebar",
          "Choose the clinic you want to manage",
          "Open Operational Settings from the clinic action panel",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="settings-header-row">
          <div className="stack-sm">
            <span className="small-label">{workspaceCopy.eyebrow}</span>
            <h1>Operational Settings</h1>
            <p className="settings-subtle">{workspaceCopy.description}</p>
          </div>

          <div className="settings-header-actions">
            {isSuperAdmin ? (
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => router.push("/clinics")}
              >
                Back to Clinics
              </button>
            ) : null}

            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadSettings({ refresh: true })}
              disabled={isLoading || isRefreshing || isSaving || isEditing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            {!isEditing ? (
              <button
                type="button"
                className="secondary-button compact-button settings-primary-button"
                onClick={handleStartEdit}
                disabled={isLoading || isRefreshing || isSaving || !settings}
              >
                Edit settings
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
            )}
          </div>
        </div>
      </header>

      {bannerMessage ? <div className={bannerClass}>{bannerMessage}</div> : null}

      {isSuperAdmin ? (
        <section className="page-card stack-sm">
          <div className="stack-sm">
            <span className="small-label">Selected clinic</span>
            <strong className="settings-context-title">
              {selectedAdminClinic?.name || "Selected clinic"}
            </strong>
            <p className="settings-subtle">
              Manage this clinic’s operational rules here. Use the links below to move
              between clinic-specific pages.
            </p>
          </div>

          <div className="settings-context-actions">
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
      ) : null}

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
          <p className="settings-subtle">
            Clinic-level archive permission for receptionists.
          </p>
        </article>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading operational settings…</div>
        </section>
      ) : !settings ? (
        <section className="page-card stack">
          <div className="stack-sm">
            <span className="small-label">Operational settings unavailable</span>
            <p className="settings-subtle">
              We could not find clinic-level operational settings for this clinic right
              now.
            </p>
          </div>

          <div className="settings-form-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadSettings({ refresh: true })}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Retry"}
            </button>
          </div>
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
                  step="1"
                  value={form.defaultAppointmentDurationMins}
                  onChange={(event) =>
                    updateForm("defaultAppointmentDurationMins", event.target.value)
                  }
                  disabled={!isEditing || isSaving}
                  required
                />
              </label>

              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={form.reminder24hEnabled}
                  onChange={(event) => updateForm("reminder24hEnabled", event.target.checked)}
                  disabled={!isEditing || isSaving}
                />
                <span>Enable 24-hour reminder</span>
              </label>

              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={form.reminder2hEnabled}
                  onChange={(event) => updateForm("reminder2hEnabled", event.target.checked)}
                  disabled={!isEditing || isSaving}
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
                  disabled={!isEditing || isSaving}
                />
                <span>Auto-create follow-up after no-show</span>
              </label>

              <label className="settings-field">
                <span>No-show follow-up delay (hours)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.noShowFollowupDelayHours}
                  onChange={(event) =>
                    updateForm("noShowFollowupDelayHours", event.target.value)
                  }
                  placeholder="e.g. 24"
                  disabled={!isEditing || isSaving}
                />
              </label>

              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={form.publicFormAutoFollowupEnabled}
                  onChange={(event) =>
                    updateForm("publicFormAutoFollowupEnabled", event.target.checked)
                  }
                  disabled={!isEditing || isSaving}
                />
                <span>Auto-create follow-up for public form leads</span>
              </label>

              <label className="settings-field">
                <span>Public form follow-up delay (hours)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.publicFormFollowupDelayHours}
                  onChange={(event) =>
                    updateForm("publicFormFollowupDelayHours", event.target.value)
                  }
                  placeholder="e.g. 1"
                  disabled={!isEditing || isSaving}
                />
              </label>

              <label className="settings-field">
                <span>Recall interval (days)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.recallIntervalDays}
                  onChange={(event) => updateForm("recallIntervalDays", event.target.value)}
                  placeholder="e.g. 180"
                  disabled={!isEditing || isSaving}
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
                  disabled={!isEditing || isSaving}
                />
                <span>Enable review request flow</span>
              </label>

              <label className="settings-field">
                <span>Review request delay (hours)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.reviewRequestDelayHours}
                  onChange={(event) =>
                    updateForm("reviewRequestDelayHours", event.target.value)
                  }
                  placeholder="e.g. 6"
                  disabled={!isEditing || isSaving}
                />
              </label>

              <label className="settings-field">
                <span>Google review link</span>
                <input
                  type="url"
                  value={form.googleReviewLink}
                  onChange={(event) => updateForm("googleReviewLink", event.target.value)}
                  placeholder="https://..."
                  disabled={!isEditing || isSaving}
                />
              </label>

              <label className="settings-field">
                <span>Message tone</span>
                <select
                  value={form.messageTone}
                  onChange={(event) => updateForm("messageTone", event.target.value)}
                  disabled={!isEditing || isSaving}
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
                disabled={!isEditing || isSaving}
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
                    onChange={(event) => updateBusinessHour(day.key, event.target.value)}
                    placeholder="09:00-18:00 or Closed"
                    disabled={!isEditing || isSaving}
                  />
                </label>
              ))}
            </div>
          </section>

          {isEditing ? (
            <div className="settings-form-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={resetForm}
                disabled={isSaving || !hasChanges}
              >
                Reset
              </button>

              <button
                type="submit"
                className="secondary-button compact-button settings-primary-button"
                disabled={isSaving || !hasChanges || Boolean(validationMessage)}
              >
                {isSaving ? "Saving..." : "Save operational settings"}
              </button>
            </div>
          ) : null}

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

        .settings-header-actions,
        .settings-context-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .settings-subtle {
          margin: 0;
          color: var(--muted);
        }

        .settings-context-title {
          color: var(--text);
          line-height: 1.3;
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
