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

export default function ClinicProfilePage() {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const [clinic, setClinic] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isBootstrapping && user && !canUseClinicProfilePage(user) && user.role !== "super_admin") {
      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  const showSuperAdminPlaceholder = user?.role === "super_admin";

  const loadClinic = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user?.clinicId || !canUseClinicProfilePage(user) || showSuperAdminPlaceholder) {
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

        const payload = await api.get(`/clinics/${user.clinicId}`);
        const data = extractApiData(payload, null);

        setClinic(data);
        setForm({
          name: data?.name || "",
          clinicType: data?.clinicType || "",
          phone: data?.phone || "",
          email: data?.email || "",
          addressLine1: data?.addressLine1 || "",
          addressLine2: data?.addressLine2 || "",
          city: data?.city || "",
          state: data?.state || "",
          country: data?.country || "",
          timezone: data?.timezone || "",
        });
      } catch (err) {
        setError(err?.message || "Could not load clinic profile.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showSuperAdminPlaceholder, user]
  );

  useEffect(() => {
    if (!isBootstrapping && user && canUseClinicProfilePage(user) && !showSuperAdminPlaceholder) {
      loadClinic();
    }
  }, [isBootstrapping, loadClinic, showSuperAdminPlaceholder, user]);

  const profileStats = useMemo(() => {
    return {
      status: humanizeToken(clinic?.status, "—"),
      slug: clinic?.slug || "—",
      createdAt: formatDateTime(clinic?.createdAt),
      updatedAt: formatDateTime(clinic?.updatedAt),
    };
  }, [clinic]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    if (!clinic) {
      setForm(EMPTY_FORM);
      return;
    }

    setForm({
      name: clinic?.name || "",
      clinicType: clinic?.clinicType || "",
      phone: clinic?.phone || "",
      email: clinic?.email || "",
      addressLine1: clinic?.addressLine1 || "",
      addressLine2: clinic?.addressLine2 || "",
      city: clinic?.city || "",
      state: clinic?.state || "",
      country: clinic?.country || "",
      timezone: clinic?.timezone || "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

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

      const response = await api.patch(`/clinics/${user.clinicId}/profile`, payload);
      const updatedClinic = extractApiData(response, null);

      setClinic(updatedClinic);
      setForm({
        name: updatedClinic?.name || "",
        clinicType: updatedClinic?.clinicType || "",
        phone: updatedClinic?.phone || "",
        email: updatedClinic?.email || "",
        addressLine1: updatedClinic?.addressLine1 || "",
        addressLine2: updatedClinic?.addressLine2 || "",
        city: updatedClinic?.city || "",
        state: updatedClinic?.state || "",
        country: updatedClinic?.country || "",
        timezone: updatedClinic?.timezone || "",
      });

      setNotice("Clinic profile updated successfully.");
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
        description="Checking your session and preparing the clinic profile."
        points={[
          "Verifying owner access",
          "Loading clinic details",
          "Preparing profile controls",
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
        title="Super admin clinic tools stay separate"
        description="This page is for clinic owners updating their clinic profile. Super admin clinic management should stay in a separate admin workspace."
        points={[
          "Owners manage their clinic profile here",
          "Super admin keeps platform-wide controls elsewhere",
          "This avoids mixing clinic and admin workflows",
        ]}
      />
    );
  }

  if (!canUseClinicProfilePage(user)) {
    return (
      <PagePlaceholder
        title="Owner-only page"
        description="Clinic Profile is currently available only to clinic owners."
        points={[
          "Owners manage clinic identity here",
          "Receptionists stay focused on operations",
          "Clinic profile remains owner-controlled",
        ]}
      />
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="clinic-profile-header-row">
          <div className="stack-sm">
            <span className="small-label">Owner workspace</span>
            <h1>Clinic Profile</h1>
            <p className="clinic-profile-subtle">
              Update your clinic’s core identity, contact information, and location details.
            </p>
          </div>

          <div className="clinic-profile-header-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadClinic({ refresh: true })}
              disabled={isLoading || isRefreshing || isSaving}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "error-banner" : "clinic-profile-notice-banner"}>
          {error || notice}
        </div>
      )}

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="small-label">Status</span>
          <strong>{profileStats.status}</strong>
          <p className="clinic-profile-subtle">Current clinic lifecycle state.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Slug</span>
          <strong>{profileStats.slug}</strong>
          <p className="clinic-profile-subtle">Internal clinic slug.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Created</span>
          <strong>{profileStats.createdAt}</strong>
          <p className="clinic-profile-subtle">When this clinic was created.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Updated</span>
          <strong>{profileStats.updatedAt}</strong>
          <p className="clinic-profile-subtle">Most recent profile update.</p>
        </article>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading clinic profile…</div>
        </section>
      ) : !clinic ? (
        <section className="page-card">
          <div className="empty-state">Clinic profile is not available right now.</div>
        </section>
      ) : (
        <>
          <section className="page-card stack">
            <div className="stack-sm">
              <span className="small-label">Edit clinic profile</span>
              <p className="clinic-profile-subtle">
                These fields shape how your clinic appears across the product.
              </p>
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
                    disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
                  />
                </label>

                <label className="clinic-profile-field">
                  <span>Address line 2</span>
                  <input
                    type="text"
                    value={form.addressLine2}
                    onChange={(event) => updateForm("addressLine2", event.target.value)}
                    maxLength={200}
                    disabled={isSaving}
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
                    disabled={isSaving}
                  />
                </label>

                <label className="clinic-profile-field">
                  <span>State</span>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(event) => updateForm("state", event.target.value)}
                    maxLength={120}
                    disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
                  />
                </label>
              </div>

              <div className="clinic-profile-form-actions">
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
                  className="secondary-button compact-button clinic-profile-primary-button"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save profile"}
                </button>
              </div>
            </form>
          </section>

          <section className="page-card stack">
            <div className="stack-sm">
              <span className="small-label">Current clinic snapshot</span>
              <p className="clinic-profile-subtle">
                Read-only summary of what is currently saved for this clinic.
              </p>
            </div>

            <div className="clinic-profile-details-grid">
              <div className="clinic-profile-detail-card">
                <span className="small-label">Clinic name</span>
                <strong>{clinic.name || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">Clinic type</span>
                <strong>{clinic.clinicType || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">Phone</span>
                <strong>{clinic.phone || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">Email</span>
                <strong>{clinic.email || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">Address line 1</span>
                <strong>{clinic.addressLine1 || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">Address line 2</span>
                <strong>{clinic.addressLine2 || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">City</span>
                <strong>{clinic.city || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">State</span>
                <strong>{clinic.state || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">Country</span>
                <strong>{clinic.country || "—"}</strong>
              </div>

              <div className="clinic-profile-detail-card">
                <span className="small-label">Timezone</span>
                <strong>{clinic.timezone || "—"}</strong>
              </div>
            </div>
          </section>
        </>
      )}

      <style jsx>{`
        .clinic-profile-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .clinic-profile-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .clinic-profile-subtle {
          margin: 0;
          color: var(--muted);
        }

        .clinic-profile-notice-banner {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          color: var(--text);
          padding: 14px 16px;
          border-radius: 16px;
        }

        .clinic-profile-primary-button {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }

        .clinic-profile-primary-button:hover:not(:disabled) {
          background: var(--surface-soft);
        }

        .clinic-profile-form,
        .clinic-profile-form-grid,
        .clinic-profile-details-grid {
          display: grid;
          gap: 16px;
        }

        .clinic-profile-form-grid,
        .clinic-profile-details-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
        }

        .clinic-profile-field input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }

        .clinic-profile-form-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .clinic-profile-detail-card {
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