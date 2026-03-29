"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, extractApiData } from "../../../lib/api/api";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const EMPTY_FORM = {
  name: "",
  clinicType: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  timezone: "",
};

function canUseClinicProfilePage(user) {
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

function humanizeToken(value, fallback = "—") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeNullable(value) {
  const next = String(value ?? "").trim();
  return next === "" ? null : next;
}

function buildFormFromClinic(clinic) {
  if (!clinic) {
    return EMPTY_FORM;
  }

  return {
    name: clinic?.name || "",
    clinicType: clinic?.clinicType || clinic?.clinic_type || "",
    phone: clinic?.phone || "",
    email: clinic?.email || "",
    addressLine1: clinic?.addressLine1 || clinic?.address_line_1 || "",
    addressLine2: clinic?.addressLine2 || clinic?.address_line_2 || "",
    city: clinic?.city || "",
    state: clinic?.state || "",
    country: clinic?.country || "",
    timezone: clinic?.timezone || "",
  };
}

function normalizeFormForCompare(form) {
  return {
    name: String(form?.name || "").trim(),
    clinicType: String(form?.clinicType || "").trim(),
    phone: String(form?.phone || "").trim(),
    email: String(form?.email || "").trim(),
    addressLine1: String(form?.addressLine1 || "").trim(),
    addressLine2: String(form?.addressLine2 || "").trim(),
    city: String(form?.city || "").trim(),
    state: String(form?.state || "").trim(),
    country: String(form?.country || "").trim(),
    timezone: String(form?.timezone || "").trim(),
  };
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

function getWorkspaceCopy(user, selectedAdminClinic) {
  if (user?.role === "super_admin") {
    return {
      label: "Super admin clinic management",
      description: selectedAdminClinic?.name
        ? `Review and update profile details for ${selectedAdminClinic.name}.`
        : "Review and update profile details for the selected clinic.",
      loadingDescription:
        "Loading the selected clinic profile and preparing clinic controls.",
    };
  }

  return {
    label: "Owner workspace",
    description:
      "Review and update your clinic’s main identity and contact details.",
    loadingDescription:
      "Checking your session and preparing the clinic profile.",
  };
}

function buildAdminClinicContext(clinic) {
  if (!clinic || typeof clinic !== "object") {
    return null;
  }

  const id = clinic.id ?? clinic.clinic_id ?? clinic.clinicId ?? null;

  if (!id) {
    return null;
  }

  return {
    id,
    name: clinic.name || clinic.clinic_name || clinic.clinicName || "",
    status: clinic.status || "",
    city: clinic.city || "",
  };
}

export default function ClinicProfilePage() {
  const router = useRouter();
  const {
    user,
    isBootstrapping,
    selectedAdminClinic = null,
    setAdminClinic,
  } = useAuth();

  const [clinic, setClinic] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSuperAdmin = user?.role === "super_admin";
  const targetClinicId = getClinicTargetId(user, selectedAdminClinic);

  const safeSetAdminClinic =
    typeof setAdminClinic === "function" ? setAdminClinic : () => null;

  useEffect(() => {
    if (!isBootstrapping && user && !canUseClinicProfilePage(user)) {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const loadClinic = useCallback(async () => {
    if (!user || !targetClinicId || !canUseClinicProfilePage(user)) {
      setClinic(null);
      setForm(EMPTY_FORM);
      setIsEditing(false);
      setIsLoading(false);
      return;
    }

    try {
      setError("");
      setIsLoading(true);

      const payload = await api.get(`/clinics/${targetClinicId}`);
      const data = extractApiData(payload, null);

      setClinic(data);
      setForm(buildFormFromClinic(data));
      setIsEditing(false);

      if (isSuperAdmin && data) {
        const nextContext = buildAdminClinicContext(data);
        if (nextContext) {
          safeSetAdminClinic(nextContext);
        }
      }
    } catch (err) {
      setClinic(null);
      setForm(EMPTY_FORM);
      setError(err?.message || "Could not load clinic profile.");
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, safeSetAdminClinic, targetClinicId, user]);

  useEffect(() => {
    if (!isBootstrapping && user && canUseClinicProfilePage(user)) {
      if (isSuperAdmin && !targetClinicId) {
        setClinic(null);
        setForm(EMPTY_FORM);
        setIsEditing(false);
        setIsLoading(false);
        return;
      }

      loadClinic();
    }
  }, [isBootstrapping, isSuperAdmin, loadClinic, targetClinicId, user]);

  const workspaceCopy = useMemo(() => {
    return getWorkspaceCopy(user, selectedAdminClinic);
  }, [selectedAdminClinic, user]);

  const profileStats = useMemo(() => {
    return {
      status: humanizeToken(clinic?.status, "—"),
      slug: clinic?.slug || "—",
      createdAt: formatDateTime(clinic?.createdAt),
      updatedAt: formatDateTime(clinic?.updatedAt),
      deactivatedAt: formatDateTime(clinic?.deactivatedAt),
    };
  }, [clinic]);

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(normalizeFormForCompare(form)) !==
      JSON.stringify(normalizeFormForCompare(buildFormFromClinic(clinic)))
    );
  }, [clinic, form]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(buildFormFromClinic(clinic));
  }

  function handleEditClick() {
    setError("");
    setNotice("");
    setIsEditing(true);
  }

  function handleCancelEdit() {
    resetForm();
    setIsEditing(false);
    setError("");
    setNotice("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isEditing || !hasChanges || !targetClinicId) {
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setNotice("");

      const payload = {
        name: form.name.trim(),
        clinicType: normalizeNullable(form.clinicType),
        phone: form.phone.trim(),
        email: normalizeNullable(form.email),
        addressLine1: normalizeNullable(form.addressLine1),
        addressLine2: normalizeNullable(form.addressLine2),
        city: normalizeNullable(form.city),
        state: normalizeNullable(form.state),
        country: normalizeNullable(form.country),
        timezone: normalizeNullable(form.timezone),
      };

      const response = await api.patch(`/clinics/${targetClinicId}/profile`, payload);
      const updatedClinic = extractApiData(response, null);

      setClinic(updatedClinic);
      setForm(buildFormFromClinic(updatedClinic));
      setIsEditing(false);
      setNotice("Clinic profile updated successfully.");

      if (isSuperAdmin && updatedClinic) {
        const nextContext = buildAdminClinicContext(updatedClinic);
        if (nextContext) {
          safeSetAdminClinic(nextContext);
        }
      }
    } catch (err) {
      setError(err?.message || "Could not update clinic profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading clinic profile"
        description={workspaceCopy.loadingDescription}
        points={
          isSuperAdmin
            ? [
                "Verifying super-admin access",
                "Loading selected clinic details",
                "Preparing clinic profile controls",
              ]
            : [
                "Verifying owner access",
                "Loading clinic details",
                "Preparing profile controls",
              ]
        }
      />
    );
  }

  if (!user) {
    return null;
  }

  if (!canUseClinicProfilePage(user)) {
    return (
      <PagePlaceholder
        title="Access restricted"
        description="Clinic Profile is available only to clinic owners and super admin."
        points={[
          "Owners manage their own clinic profile here",
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
        description="Open Clinics, select the clinic you want to manage, and then open Clinic Profile from there."
        points={[
          "Go to Clinics from the sidebar",
          "Choose the clinic you want to manage",
          "Open Clinic Profile from the clinic action panel",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="clinic-profile-header-row">
          <div className="stack-sm">
            <span className="small-label">{workspaceCopy.label}</span>
            <h1>Clinic Profile</h1>
            <p className="clinic-profile-subtle">{workspaceCopy.description}</p>
          </div>

          {isSuperAdmin ? (
            <div className="clinic-profile-header-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => router.push("/clinics")}
              >
                Back to Clinics
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "error-banner" : "clinic-profile-notice-banner"}>
          {error || notice}
        </div>
      )}

      {isSuperAdmin && clinic ? (
        <section className="page-card stack-sm">
          <div className="stack-sm">
            <span className="small-label">Selected clinic</span>
            <strong className="clinic-context-title">
              {clinic?.name || selectedAdminClinic?.name || "Clinic"}
            </strong>
            <p className="clinic-profile-subtle">
              Manage this clinic’s profile details here. Use the links below to move
              between clinic-specific pages.
            </p>
          </div>

          <div className="clinic-context-actions">
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
      ) : null}

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading clinic profile…</div>
        </section>
      ) : !clinic ? (
        <section className="page-card">
          <div className="empty-state">Clinic profile is not available right now.</div>
        </section>
      ) : (
        <div className="clinic-profile-layout">
          <section className="page-card stack">
            <div className="clinic-profile-card-header">
              <div className="stack-sm">
                <span className="small-label">Clinic details</span>
                <p className="clinic-profile-subtle">
                  These details define how this clinic appears across the product.
                </p>
              </div>

              {!isEditing ? (
                <button
                  type="button"
                  className="primary-button compact-button"
                  onClick={handleEditClick}
                  disabled={isSaving}
                >
                  Edit profile
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

            <form className="clinic-profile-form" onSubmit={handleSubmit}>
              <div className="clinic-profile-form-grid">
                <label className="clinic-profile-field">
                  <span>Clinic name</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    maxLength={200}
                    disabled={!isEditing || isSaving}
                    required
                  />
                </label>

                <label className="clinic-profile-field">
                  <span>Clinic type</span>
                  <input
                    type="text"
                    value={form.clinicType}
                    onChange={(event) => updateForm("clinicType", event.target.value)}
                    placeholder="Dental, skin, ortho, etc."
                    maxLength={120}
                    disabled={!isEditing || isSaving}
                  />
                </label>
              </div>

              <div className="clinic-profile-form-grid">
                <label className="clinic-profile-field">
                  <span>Phone</span>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    maxLength={40}
                    disabled={!isEditing || isSaving}
                    required
                  />
                </label>

                <label className="clinic-profile-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    maxLength={200}
                    disabled={!isEditing || isSaving}
                  />
                </label>
              </div>

              <div className="clinic-profile-form-grid">
                <label className="clinic-profile-field">
                  <span>Address line 1</span>
                  <input
                    type="text"
                    value={form.addressLine1}
                    onChange={(event) => updateForm("addressLine1", event.target.value)}
                    maxLength={200}
                    disabled={!isEditing || isSaving}
                  />
                </label>

                <label className="clinic-profile-field">
                  <span>Address line 2</span>
                  <input
                    type="text"
                    value={form.addressLine2}
                    onChange={(event) => updateForm("addressLine2", event.target.value)}
                    maxLength={200}
                    disabled={!isEditing || isSaving}
                  />
                </label>
              </div>

              <div className="clinic-profile-form-grid">
                <label className="clinic-profile-field">
                  <span>City</span>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(event) => updateForm("city", event.target.value)}
                    maxLength={120}
                    disabled={!isEditing || isSaving}
                  />
                </label>

                <label className="clinic-profile-field">
                  <span>State</span>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(event) => updateForm("state", event.target.value)}
                    maxLength={120}
                    disabled={!isEditing || isSaving}
                  />
                </label>
              </div>

              <div className="clinic-profile-form-grid">
                <label className="clinic-profile-field">
                  <span>Country</span>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(event) => updateForm("country", event.target.value)}
                    maxLength={120}
                    disabled={!isEditing || isSaving}
                  />
                </label>

                <label className="clinic-profile-field">
                  <span>Timezone</span>
                  <input
                    type="text"
                    value={form.timezone}
                    onChange={(event) => updateForm("timezone", event.target.value)}
                    placeholder="Asia/Kolkata"
                    maxLength={120}
                    disabled={!isEditing || isSaving}
                  />
                </label>
              </div>

              {isEditing ? (
                <div className="clinic-profile-form-actions">
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
                    className="primary-button compact-button"
                    disabled={!hasChanges || isSaving}
                  >
                    {isSaving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              ) : null}
            </form>
          </section>

          <section className="page-card stack">
            <div className="stack-sm">
              <span className="small-label">System details</span>
              <p className="clinic-profile-subtle">
                Read-only reference details for this clinic.
              </p>
            </div>

            <div className="clinic-profile-system-details">
              <p>
                <strong>Status:</strong> {profileStats.status}
              </p>

              <p>
                <strong>Clinic URL ID:</strong> {profileStats.slug}
              </p>

              <p>
                <strong>Created:</strong> {profileStats.createdAt}
              </p>

              <p>
                <strong>Last updated:</strong> {profileStats.updatedAt}
              </p>

              <p>
                <strong>Deactivated at:</strong> {profileStats.deactivatedAt}
              </p>
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        .clinic-profile-layout {
          display: grid;
          gap: 20px;
          grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.9fr);
          align-items: start;
        }

        .clinic-profile-header-row,
        .clinic-profile-card-header,
        .clinic-context-actions,
        .clinic-profile-header-actions {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .clinic-profile-subtle {
          margin: 0;
          color: var(--muted);
        }

        .clinic-context-title {
          color: var(--text);
          line-height: 1.3;
        }

        .clinic-profile-notice-banner {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          color: var(--text);
          padding: 12px 14px;
          border-radius: var(--radius-sm);
        }

        .clinic-profile-form,
        .clinic-profile-form-grid {
          display: grid;
          gap: 16px;
        }

        .clinic-profile-form-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .clinic-profile-field {
          display: grid;
          gap: 8px;
        }

        .clinic-profile-field span {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .clinic-profile-field input {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          border-radius: 14px;
          padding: 12px 14px;
          font: inherit;
          outline: none;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .clinic-profile-field input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }

        .clinic-profile-field input:disabled {
          background: var(--surface-soft);
          color: var(--text);
          cursor: not-allowed;
          opacity: 0.9;
        }

        .clinic-profile-form-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding-top: 4px;
        }

        .clinic-profile-system-details {
          display: grid;
          gap: 14px;
          padding-top: 6px;
        }

        .clinic-profile-system-details p {
          margin: 0;
          color: var(--text);
          line-height: 1.65;
        }

        .clinic-profile-system-details strong {
          font-weight: 600;
          color: var(--text);
        }

        @media (max-width: 1100px) {
          .clinic-profile-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .clinic-profile-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}