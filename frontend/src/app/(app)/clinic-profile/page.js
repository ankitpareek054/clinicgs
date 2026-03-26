
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



function buildFormFromClinic(clinic) {

  if (!clinic) {

    return EMPTY_FORM;

  }



  return {

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



export default function ClinicProfilePage() {

  const router = useRouter();

  const { user, isBootstrapping } = useAuth();



  const [clinic, setClinic] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);



  const [isEditing, setIsEditing] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);



  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");



  useEffect(() => {

    if (

      !isBootstrapping &&

      user &&

      !canUseClinicProfilePage(user) &&

      user.role !== "super_admin"

    ) {

      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");

    }

  }, [isBootstrapping, router, user]);



  const showSuperAdminPlaceholder = user?.role === "super_admin";



  const loadClinic = useCallback(async () => {

    if (!user?.clinicId || !canUseClinicProfilePage(user) || showSuperAdminPlaceholder) {

      return;

    }



    try {

      setError("");

      setNotice("");

      setIsLoading(true);



      const payload = await api.get(`/clinics/${user.clinicId}`);

      const data = extractApiData(payload, null);



      setClinic(data);

      setForm(buildFormFromClinic(data));

      setIsEditing(false);

    } catch (err) {

      setError(err?.message || "Could not load clinic profile.");

    } finally {

      setIsLoading(false);

    }

  }, [showSuperAdminPlaceholder, user]);



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



    if (!isEditing || !hasChanges) {

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



      const response = await api.patch(`/clinics/${user.clinicId}/profile`, payload);

      const updatedClinic = extractApiData(response, null);



      setClinic(updatedClinic);

      setForm(buildFormFromClinic(updatedClinic));

      setIsEditing(false);

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

              Review and update your clinic’s main identity and contact details.

            </p>

          </div>

        </div>

      </header>



      {(error || notice) && (

        <div className={error ? "error-banner" : "clinic-profile-notice-banner"}>

          {error || notice}

        </div>

      )}



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

                  These details define how your clinic appears across the product.

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

        .clinic-profile-card-header {

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

          transition: border-color 160ms ease, box-shadow 160ms ease,

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