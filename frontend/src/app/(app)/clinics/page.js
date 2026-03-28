
"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import PagePlaceholder from "../../../components/shared/pagePlaceHolder";

import { api, buildQuery, extractApiData } from "../../../lib/api/api";

import { useAuth } from "../../../providers/sessionProvider";



const CLINIC_STATUS_OPTIONS = [

  { value: "", label: "All statuses" },

  { value: "onboarding", label: "Onboarding" },

  { value: "trial", label: "Trial" },

  { value: "active", label: "Active" },

  { value: "inactive", label: "Inactive" },

  { value: "suspended", label: "Suspended" },

];



const STATUS_UPDATE_OPTIONS = [

  { value: "onboarding", label: "Onboarding" },

  { value: "trial", label: "Trial" },

  { value: "active", label: "Active" },

  { value: "inactive", label: "Inactive" },

  { value: "suspended", label: "Suspended" },

];



const EMPTY_CREATE_FORM = {

  name: "",

  phone: "",

  ownerFullName: "",

  ownerEmail: "",

  clinicType: "",

  clinicEmail: "",

  city: "",

  state: "",

  timezone: "",

};



const EMPTY_FILTERS = {

  status: "",

  search: "",

};



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



function getStatusTone(status) {

  const normalized = String(status || "").trim().toLowerCase();



  if (normalized === "active") return "done";

  if (normalized === "trial" || normalized === "onboarding") return "pending";

  if (normalized === "inactive" || normalized === "suspended") return "cancelled";



  return "pending";

}



function normalizeClinicList(payload) {

  const data = extractApiData(payload, []);

  return Array.isArray(data) ? data : [];

}



function getMetricCount(clinics, status) {

  return clinics.filter(

    (clinic) => String(clinic?.status || "").toLowerCase() === status

  ).length;

}



function getClinicDisplayName(clinic) {

  return clinic?.name || `Clinic #${clinic?.id || "Unknown"}`;

}



function buildAddress(clinic) {

  return [

    clinic?.addressLine1,

    clinic?.addressLine2,

    clinic?.city,

    clinic?.state,

    clinic?.country,

  ]

    .filter(Boolean)

    .join(", ");

}



function normalizeClinicContext(clinic) {

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



function sortClinics(clinics, selectedContextClinicId) {

  const priorityRank = {

    active: 0,

    trial: 1,

    onboarding: 2,

    inactive: 3,

    suspended: 4,

  };



  return [...clinics].sort((left, right) => {

    const leftIsContext = Number(left?.id) === Number(selectedContextClinicId);

    const rightIsContext = Number(right?.id) === Number(selectedContextClinicId);



    if (leftIsContext && !rightIsContext) return -1;

    if (!leftIsContext && rightIsContext) return 1;



    const leftRank =

      priorityRank[String(left?.status || "").toLowerCase()] ?? Number.MAX_SAFE_INTEGER;

    const rightRank =

      priorityRank[String(right?.status || "").toLowerCase()] ?? Number.MAX_SAFE_INTEGER;



    if (leftRank !== rightRank) {

      return leftRank - rightRank;

    }



    const leftName = String(left?.name || "");

    const rightName = String(right?.name || "");

    const nameDiff = leftName.localeCompare(rightName);



    if (nameDiff !== 0) return nameDiff;



    return Number(left?.id || 0) - Number(right?.id || 0);

  });

}



export default function ClinicsPage() {

  const router = useRouter();

  const auth = useAuth();



  const {

    user,

    isBootstrapping,

    selectedAdminClinic = null,

    setAdminClinic,

    clearAdminClinic,

  } = auth;



  const safeSetAdminClinic =

    typeof setAdminClinic === "function" ? setAdminClinic : () => null;



  const safeClearAdminClinic =

    typeof clearAdminClinic === "function" ? clearAdminClinic : () => {};



  const [clinics, setClinics] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);



  const [selectedClinicId, setSelectedClinicId] = useState(

    selectedAdminClinic?.id ?? null

  );

  const [statusDraft, setStatusDraft] = useState("active");



  const [isLoading, setIsLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);



  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);

  const [createResult, setCreateResult] = useState(null);



  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");



  const isSuperAdmin = user?.role === "super_admin";

  const currentContextClinicId = selectedAdminClinic?.id ?? null;



  useEffect(() => {

    if (!isBootstrapping && user && !isSuperAdmin) {

      router.replace(user.role === "owner" ? "/dashboard" : "/my-tasks");

    }

  }, [isBootstrapping, isSuperAdmin, router, user]);



  const loadClinics = useCallback(

    async ({ refresh = false } = {}) => {

      if (!user || user.role !== "super_admin") {

        return;

      }



      try {

        setError("");



        if (refresh) {

          setIsRefreshing(true);

        } else {

          setIsLoading(true);

        }



        const query = buildQuery({

          status: appliedFilters.status || undefined,

          search: appliedFilters.search.trim() || undefined,

        });



        const payload = await api.get(`/clinics${query}`);

        const nextClinics = normalizeClinicList(payload);



        setClinics(nextClinics);

      } catch (err) {

        setError(err?.message || "Could not load clinics.");

      } finally {

        setIsLoading(false);

        setIsRefreshing(false);

      }

    },

    [appliedFilters.search, appliedFilters.status, user]

  );



  useEffect(() => {

    if (!isBootstrapping && isSuperAdmin) {

      loadClinics();

    }

  }, [isBootstrapping, isSuperAdmin, loadClinics]);



  const sortedClinics = useMemo(() => {

    return sortClinics(clinics, currentContextClinicId);

  }, [clinics, currentContextClinicId]);



  useEffect(() => {

    if (!sortedClinics.length) {

      setSelectedClinicId(null);

      return;

    }



    const selectedStillExists = sortedClinics.some(

      (clinic) => Number(clinic.id) === Number(selectedClinicId)

    );



    if (!selectedStillExists) {

      const preferredId = currentContextClinicId || sortedClinics[0]?.id || null;

      setSelectedClinicId(preferredId);

    }

  }, [currentContextClinicId, selectedClinicId, sortedClinics]);



  useEffect(() => {

    if (

      currentContextClinicId &&

      Number(currentContextClinicId) !== Number(selectedClinicId) &&

      sortedClinics.some((clinic) => Number(clinic.id) === Number(currentContextClinicId))

    ) {

      setSelectedClinicId(currentContextClinicId);

    }

  }, [currentContextClinicId, selectedClinicId, sortedClinics]);



  const selectedClinic = useMemo(() => {

    return (

      sortedClinics.find((clinic) => Number(clinic.id) === Number(selectedClinicId)) ||

      null

    );

  }, [selectedClinicId, sortedClinics]);



  useEffect(() => {

    if (selectedClinic?.status) {

      setStatusDraft(selectedClinic.status);

    }

  }, [selectedClinic]);



  const totalClinics = sortedClinics.length;

  const activeClinics = getMetricCount(sortedClinics, "active");

  const trialClinics = getMetricCount(sortedClinics, "trial");

  const flaggedClinics =

    getMetricCount(sortedClinics, "inactive") +

    getMetricCount(sortedClinics, "suspended");



  const hasActiveFilters = Boolean(

    appliedFilters.status || appliedFilters.search.trim()

  );



  const hasPendingFilterChanges =

    filters.status !== appliedFilters.status ||

    filters.search.trim() !== appliedFilters.search.trim();



  function updateCreateForm(field, value) {

    setCreateForm((current) => ({

      ...current,

      [field]: value,

    }));

  }



  function resetCreateForm() {

    setCreateForm(EMPTY_CREATE_FORM);

  }



  function closeCreateForm() {

    resetCreateForm();

    setIsCreateOpen(false);

  }



  function handleApplyFilters(event) {

    event.preventDefault();



    setAppliedFilters({

      status: filters.status,

      search: filters.search.trim(),

    });

  }



  function handleClearFilters() {

    setFilters(EMPTY_FILTERS);

    setAppliedFilters(EMPTY_FILTERS);

  }



  async function handleCreateSubmit(event) {

    event.preventDefault();



    try {

      setIsSubmittingCreate(true);

      setError("");

      setNotice("");

      setCreateResult(null);



      const payload = await api.post("/clinics", {

        name: createForm.name.trim(),

        phone: createForm.phone.trim(),

        ownerFullName: createForm.ownerFullName.trim(),

        ownerEmail: createForm.ownerEmail.trim(),

        clinicType: createForm.clinicType.trim() || null,

        clinicEmail: createForm.clinicEmail.trim() || null,

        city: createForm.city.trim() || null,

        state: createForm.state.trim() || null,

        timezone: createForm.timezone.trim() || null,

      });



      const result = extractApiData(payload, null);

      const createdClinic = result?.clinic || null;



      setCreateResult(result);

      setNotice("Clinic created successfully.");

      closeCreateForm();



      await loadClinics({ refresh: true });



      if (createdClinic?.id) {

        setSelectedClinicId(createdClinic.id);

        safeSetAdminClinic(createdClinic);

      }

    } catch (err) {

      setError(err?.message || "Could not create clinic.");

    } finally {

      setIsSubmittingCreate(false);

    }

  }



  async function handleStatusUpdate(event) {

    event.preventDefault();



    if (!selectedClinic) {

      return;

    }



    try {

      setIsSubmittingStatus(true);

      setError("");

      setNotice("");



      const payload = await api.patch(`/clinics/${selectedClinic.id}/status`, {

        status: statusDraft,

      });



      const updatedClinic = extractApiData(payload, null);



      setClinics((current) =>

        current.map((clinic) =>

          Number(clinic.id) === Number(selectedClinic.id)

            ? {

                ...clinic,

                ...(updatedClinic || {}),

                status: statusDraft,

              }

            : clinic

        )

      );



      if (updatedClinic) {

        safeSetAdminClinic(updatedClinic);

      } else {

        safeSetAdminClinic({

          ...selectedClinic,

          status: statusDraft,

        });

      }



      setNotice("Clinic status updated successfully.");

    } catch (err) {

      setError(err?.message || "Could not update clinic status.");

    } finally {

      setIsSubmittingStatus(false);

    }

  }



  function handleUseClinicContext(clinic) {

    if (!clinic) return;



    const nextContext = normalizeClinicContext(clinic);



    if (!nextContext) return;



    safeSetAdminClinic(nextContext);

    setSelectedClinicId(clinic.id);

    setNotice(`Admin context switched to ${getClinicDisplayName(clinic)}.`);

  }



  function handleClearClinicContext() {

    safeClearAdminClinic();

    setNotice("Admin context reset to all clinics.");

  }



  function handleOpenClinicWorkspace(path) {

    if (!selectedClinic) return;



    const nextContext = normalizeClinicContext(selectedClinic);



    if (!nextContext) return;



    safeSetAdminClinic(nextContext);

    router.push(path);

  }



  if (isBootstrapping) {

    return (

      <PagePlaceholder

        title="Loading clinics hub"

        description="Checking super-admin access and preparing the platform clinic workspace."

        points={[

          "Verifying super-admin access",

          "Preparing cross-clinic controls",

          "Keeping owner and receptionist flows untouched",

        ]}

      />

    );

  }



  if (!user || !isSuperAdmin) {

    return (

      <PagePlaceholder

        title="Redirecting"

        description="Clinic management is only available to the super admin workspace."

        points={[

          "Owners stay inside their clinic workspace",

          "Receptionists do not manage clinic records",

          "Super admin owns platform clinic controls",

        ]}

      />

    );

  }



  const selectedClinicAddress = buildAddress(selectedClinic);

  const isSelectedClinicContextActive =

    Number(selectedClinic?.id) === Number(currentContextClinicId);



  return (

    <div className="page stack">

      <header className="page-header">

        <div className="clinics-header-row">

          <div className="stack-sm">

            <span className="small-label">Super admin workspace</span>

            <h1>Clinics</h1>

            <p className="clinics-subtle">

              Central clinic management for listing, creation, clinic status

              control, and selected-clinic admin drilldowns.

            </p>

          </div>



          <div className="clinics-header-actions">

            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() => loadClinics({ refresh: true })}

              disabled={

                isRefreshing ||

                isLoading ||

                isSubmittingCreate ||

                isSubmittingStatus

              }

            >

              {isRefreshing ? "Refreshing..." : "Refresh"}

            </button>



            <button

              type="button"

              className="secondary-button compact-button clinics-primary-button"

              onClick={() => setIsCreateOpen((current) => !current)}

              disabled={isSubmittingCreate}

            >

              {isCreateOpen ? "Close form" : "New clinic"}

            </button>

          </div>

        </div>

      </header>



      {(error || notice) && (

        <div className={error ? "error-banner" : "clinics-notice-banner"}>

          {error || notice}

        </div>

      )}



      <section className="metrics-grid">

        <article className="metric-card">

          <span className="small-label">Loaded clinics</span>

          <strong>{totalClinics}</strong>

          <p className="clinics-subtle">Clinics in the current filtered view.</p>

        </article>



        <article className="metric-card">

          <span className="small-label">Active</span>

          <strong>{activeClinics}</strong>

          <p className="clinics-subtle">Clinics currently live on the platform.</p>

        </article>



        <article className="metric-card">

          <span className="small-label">Trial</span>

          <strong>{trialClinics}</strong>

          <p className="clinics-subtle">Clinics still in trial mode.</p>

        </article>



        <article className="metric-card metric-card-attention">

          <span className="small-label">Inactive / Suspended</span>

          <strong>{flaggedClinics}</strong>

          <p className="clinics-subtle">Clinics needing platform attention.</p>

        </article>

      </section>



      {isCreateOpen ? (

        <section className="page-card stack">

          <div className="stack-sm">

            <span className="small-label">Create clinic</span>

            <p className="clinics-subtle">

              This flow uses the real clinic create API and shows the clinic,

              owner, invite, and default public form data returned by the backend.

            </p>

          </div>



          <form className="clinics-form" onSubmit={handleCreateSubmit}>

            <div className="clinics-form-grid">

              <label className="clinics-field">

                <span>Clinic name</span>

                <input

                  type="text"

                  value={createForm.name}

                  onChange={(event) => updateCreateForm("name", event.target.value)}

                  placeholder="Enter clinic name"

                  maxLength={200}

                  required

                  disabled={isSubmittingCreate}

                />

              </label>



              <label className="clinics-field">

                <span>Clinic phone</span>

                <input

                  type="text"

                  value={createForm.phone}

                  onChange={(event) => updateCreateForm("phone", event.target.value)}

                  placeholder="Enter clinic phone"

                  maxLength={50}

                  required

                  disabled={isSubmittingCreate}

                />

              </label>



              <label className="clinics-field">

                <span>Owner full name</span>

                <input

                  type="text"

                  value={createForm.ownerFullName}

                  onChange={(event) =>

                    updateCreateForm("ownerFullName", event.target.value)

                  }

                  placeholder="Enter owner full name"

                  maxLength={200}

                  required

                  disabled={isSubmittingCreate}

                />

              </label>



              <label className="clinics-field">

                <span>Owner email</span>

                <input

                  type="email"

                  value={createForm.ownerEmail}

                  onChange={(event) =>

                    updateCreateForm("ownerEmail", event.target.value)

                  }

                  placeholder="Enter owner email"

                  maxLength={200}

                  required

                  disabled={isSubmittingCreate}

                />

              </label>



              <label className="clinics-field">

                <span>Clinic type</span>

                <input

                  type="text"

                  value={createForm.clinicType}

                  onChange={(event) =>

                    updateCreateForm("clinicType", event.target.value)

                  }

                  placeholder="Optional clinic type"

                  maxLength={100}

                  disabled={isSubmittingCreate}

                />

              </label>



              <label className="clinics-field">

                <span>Clinic email</span>

                <input

                  type="email"

                  value={createForm.clinicEmail}

                  onChange={(event) =>

                    updateCreateForm("clinicEmail", event.target.value)

                  }

                  placeholder="Optional clinic email"

                  maxLength={200}

                  disabled={isSubmittingCreate}

                />

              </label>



              <label className="clinics-field">

                <span>City</span>

                <input

                  type="text"

                  value={createForm.city}

                  onChange={(event) => updateCreateForm("city", event.target.value)}

                  placeholder="Optional city"

                  maxLength={100}

                  disabled={isSubmittingCreate}

                />

              </label>



              <label className="clinics-field">

                <span>State</span>

                <input

                  type="text"

                  value={createForm.state}

                  onChange={(event) => updateCreateForm("state", event.target.value)}

                  placeholder="Optional state"

                  maxLength={100}

                  disabled={isSubmittingCreate}

                />

              </label>



              <label className="clinics-field">

                <span>Timezone</span>

                <input

                  type="text"

                  value={createForm.timezone}

                  onChange={(event) =>

                    updateCreateForm("timezone", event.target.value)

                  }

                  placeholder="Optional timezone"

                  maxLength={100}

                  disabled={isSubmittingCreate}

                />

              </label>

            </div>



            <div className="clinics-form-actions">

              <button

                type="button"

                className="secondary-button compact-button"

                onClick={closeCreateForm}

                disabled={isSubmittingCreate}

              >

                Cancel

              </button>



              <button

                type="submit"

                className="secondary-button compact-button clinics-primary-button"

                disabled={isSubmittingCreate}

              >

                {isSubmittingCreate ? "Creating..." : "Create clinic"}

              </button>

            </div>

          </form>

        </section>

      ) : null}



      {createResult ? (

        <section className="page-card stack">

          <div className="stack-sm">

            <span className="small-label">Latest create result</span>

            <p className="clinics-subtle">

              Real backend response from the last clinic creation.

            </p>

          </div>



          <div className="clinics-detail-grid">

            <div className="clinics-detail-card">

              <span className="small-label">Clinic</span>

              <strong>{createResult?.clinic?.name || "Unavailable"}</strong>

            </div>



            <div className="clinics-detail-card">

              <span className="small-label">Owner</span>

              <strong>{createResult?.owner?.email || "Unavailable"}</strong>

            </div>



            <div className="clinics-detail-card">

              <span className="small-label">Invite status</span>

              <strong>

                {humanizeLabel(createResult?.invite?.status, "Unavailable")}

              </strong>

            </div>



            <div className="clinics-detail-card">

              <span className="small-label">Invite expires</span>

              <strong>{formatDateTime(createResult?.invite?.expiresAt)}</strong>

            </div>



            <div className="clinics-detail-card">

              <span className="small-label">Public form</span>

              <strong>{createResult?.publicForm?.name || "Unavailable"}</strong>

            </div>



            <div className="clinics-detail-card">

              <span className="small-label">Public form slug</span>

              <strong>{createResult?.publicForm?.slug || "Unavailable"}</strong>

            </div>

          </div>



          {createResult?.invite?.rawTokenPreview ? (

            <div className="clinics-inline-summary">

              <div>

                <strong>Development invite token preview</strong>

              </div>

              <div className="clinics-copy">

                {createResult.invite.rawTokenPreview}

              </div>

            </div>

          ) : null}

        </section>

      ) : null}



      <section className="page-card stack-sm">

        <div className="stack-sm">

          <span className="small-label">Filters</span>

          <p className="clinics-subtle">

            Apply filters deliberately instead of firing a request on every keystroke.

          </p>

        </div>



        <form className="clinics-filter-grid" onSubmit={handleApplyFilters}>

          <label className="clinics-field">

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

              {CLINIC_STATUS_OPTIONS.map((option) => (

                <option key={option.value || "all"} value={option.value}>

                  {option.label}

                </option>

              ))}

            </select>

          </label>



          <label className="clinics-field">

            <span>Search</span>

            <input

              type="text"

              value={filters.search}

              onChange={(event) =>

                setFilters((current) => ({

                  ...current,

                  search: event.target.value,

                }))

              }

              placeholder="Search by clinic name or related text"

              disabled={isLoading || isRefreshing}

            />

          </label>



          <div className="clinics-form-actions clinics-filter-actions">

            <button

              type="submit"

              className="secondary-button compact-button clinics-primary-button"

              disabled={isLoading || isRefreshing || !hasPendingFilterChanges}

            >

              Apply filters

            </button>



            <button

              type="button"

              className="secondary-button compact-button"

              onClick={handleClearFilters}

              disabled={

                isLoading ||

                isRefreshing ||

                (!hasActiveFilters && !hasPendingFilterChanges)

              }

            >

              Clear filters

            </button>

          </div>

        </form>

      </section>



      {isLoading ? (

        <section className="page-card">

          <div className="empty-state">Loading clinics…</div>

        </section>

      ) : sortedClinics.length === 0 ? (

        <section className="page-card">

          <div className="empty-state">No clinics matched the current filters.</div>

        </section>

      ) : (

        <section className="clinics-workspace-grid">

          <section className="page-card stack clinics-list-panel">

            <div className="clinics-list-panel-header">

              <div className="stack-sm">

                <span className="small-label">Clinic list</span>

                <p className="clinics-subtle">

                  Select a clinic to inspect details or set the active admin context.

                </p>

              </div>



              <span className="small-label">{sortedClinics.length}</span>

            </div>



            <div className="clinics-list">

              {sortedClinics.map((clinic) => {

                const isActive = Number(clinic.id) === Number(selectedClinicId);

                const isContextClinic =

                  Number(clinic.id) === Number(currentContextClinicId);



                return (

                  <button

                    key={clinic.id}

                    type="button"

                    className={`clinics-list-card ${isActive ? "active" : ""}`}

                    onClick={() => setSelectedClinicId(clinic.id)}

                  >

                    <div className="clinics-list-card-topline">

                      <span className={`status-pill ${getStatusTone(clinic.status)}`}>

                        {humanizeLabel(clinic.status, "Unknown")}

                      </span>



                      <div className="clinics-inline-chip-row">

                        {isContextClinic ? (

                          <span className="small-label clinics-context-chip">

                            Active context

                          </span>

                        ) : null}

                        <span className="small-label">#{clinic.id}</span>

                      </div>

                    </div>



                    <strong className="clinics-list-card-title">

                      {getClinicDisplayName(clinic)}

                    </strong>



                    <div className="clinics-list-card-meta">

                      <span>{clinic.city || "Unknown city"}</span>

                      <span>{clinic.state || "Unknown state"}</span>

                      <span>{clinic.slug || "No slug"}</span>

                    </div>

                  </button>

                );

              })}

            </div>

          </section>



          <section className="page-card stack clinics-detail-panel">

            {selectedClinic ? (

              <>

                <div className="clinics-detail-header">

                  <div className="stack-sm">

                    <div className="clinics-pill-row">

                      <span className={`status-pill ${getStatusTone(selectedClinic.status)}`}>

                        {humanizeLabel(selectedClinic.status, "Unknown")}

                      </span>



                      <span className="small-label">Clinic #{selectedClinic.id}</span>



                      {isSelectedClinicContextActive ? (

                        <span className="small-label clinics-context-chip">

                          Current admin context

                        </span>

                      ) : null}

                    </div>



                    <h3 className="clinics-detail-title">

                      {getClinicDisplayName(selectedClinic)}

                    </h3>



                    <p className="clinics-subtle">

                      Set this clinic as active context before opening clinic-specific

                      admin pages.

                    </p>

                  </div>



                  <div className="clinics-header-actions">

                    <button

                      type="button"

                      className="secondary-button compact-button clinics-primary-button"

                      onClick={() => handleUseClinicContext(selectedClinic)}

                      disabled={isSelectedClinicContextActive}

                    >

                      {isSelectedClinicContextActive

                        ? "Context already active"

                        : "Use clinic context"}

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={handleClearClinicContext}

                    >

                      Clear context

                    </button>

                  </div>

                </div>



                <div className="clinics-detail-grid">

                  <div className="clinics-detail-card">

                    <span className="small-label">Phone</span>

                    <strong>{selectedClinic.phone || "Not provided"}</strong>

                  </div>



                  <div className="clinics-detail-card">

                    <span className="small-label">Email</span>

                    <strong>{selectedClinic.email || "Not provided"}</strong>

                  </div>



                  <div className="clinics-detail-card">

                    <span className="small-label">Clinic type</span>

                    <strong>{selectedClinic.clinicType || "Not provided"}</strong>

                  </div>



                  <div className="clinics-detail-card">

                    <span className="small-label">Slug</span>

                    <strong>{selectedClinic.slug || "Not provided"}</strong>

                  </div>



                  <div className="clinics-detail-card">

                    <span className="small-label">Timezone</span>

                    <strong>{selectedClinic.timezone || "Not provided"}</strong>

                  </div>



                  <div className="clinics-detail-card">

                    <span className="small-label">Country</span>

                    <strong>{selectedClinic.country || "Not provided"}</strong>

                  </div>



                  <div className="clinics-detail-card clinics-detail-card-span">

                    <span className="small-label">Address</span>

                    <strong>{selectedClinicAddress || "Not provided"}</strong>

                  </div>



                  <div className="clinics-detail-card">

                    <span className="small-label">Created</span>

                    <strong>{formatDateTime(selectedClinic.createdAt)}</strong>

                  </div>



                  <div className="clinics-detail-card">

                    <span className="small-label">Updated</span>

                    <strong>{formatDateTime(selectedClinic.updatedAt)}</strong>

                  </div>



                  <div className="clinics-detail-card">

                    <span className="small-label">Deactivated at</span>

                    <strong>{formatDateTime(selectedClinic.deactivatedAt)}</strong>

                  </div>

                </div>



                <section className="soft-card stack">

                  <div className="stack-sm">

                    <span className="small-label">Clinic status control</span>

                    <p className="clinics-subtle">

                      Super admin only. Update the clinic status without deleting

                      history.

                    </p>

                  </div>



                  <form className="clinics-status-form" onSubmit={handleStatusUpdate}>

                    <label className="clinics-field">

                      <span>Status</span>

                      <select

                        value={statusDraft}

                        onChange={(event) => setStatusDraft(event.target.value)}

                        disabled={isSubmittingStatus}

                      >

                        {STATUS_UPDATE_OPTIONS.map((option) => (

                          <option key={option.value} value={option.value}>

                            {option.label}

                          </option>

                        ))}

                      </select>

                    </label>



                    <div className="clinics-form-actions">

                      <button

                        type="submit"

                        className="secondary-button compact-button clinics-primary-button"

                        disabled={

                          isSubmittingStatus ||

                          !selectedClinic ||

                          statusDraft === selectedClinic.status

                        }

                      >

                        {isSubmittingStatus ? "Saving..." : "Update status"}

                      </button>

                    </div>

                  </form>

                </section>



                <section className="soft-card stack">

                  <div className="stack-sm">

                    <span className="small-label">Open clinic workspace</span>

                    <p className="clinics-subtle">

                      These routes become selected-clinic admin drilldowns. Opening

                      any of them will first set the current clinic as admin context.

                    </p>

                  </div>



                  <div className="clinics-link-row">

                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={() => handleOpenClinicWorkspace("/clinic-profile")}

                    >

                      Clinic Profile

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={() => handleOpenClinicWorkspace("/clinic-settings")}

                    >

                      Operational Settings

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={() => handleOpenClinicWorkspace("/integrations")}

                    >

                      Integrations

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={() => handleOpenClinicWorkspace("/staff")}

                    >

                      Staff

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={() => handleOpenClinicWorkspace("/services")}

                    >

                      Services

                    </button>

                  </div>

                </section>

              </>

            ) : (

              <div className="empty-state">

                Select a clinic from the list to review details and actions.

              </div>

            )}

          </section>

        </section>

      )}



      <style jsx>{`

        .clinics-header-row,

        .clinics-list-panel-header,

        .clinics-detail-header,

        .clinics-list-card-topline,

        .clinics-form-actions,

        .clinics-header-actions,

        .clinics-pill-row,

        .clinics-link-row,

        .clinics-inline-chip-row {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .clinics-header-row,

        .clinics-list-panel-header,

        .clinics-detail-header {

          justify-content: space-between;

          align-items: flex-start;

        }



        .clinics-subtle {

          margin: 0;

          color: var(--muted);

        }



        .clinics-notice-banner {

          border: 1px solid var(--accent);

          background: var(--accent-soft);

          color: var(--text);

          padding: 14px 16px;

          border-radius: 16px;

        }



        .clinics-primary-button {

          background: var(--accent-soft);

          border-color: var(--accent);

          color: var(--accent);

        }



        .clinics-primary-button:hover:not(:disabled) {

          background: var(--surface-soft);

        }



        .metric-card-attention {

          border-color: rgba(58, 94, 160, 0.24);

        }



        .metric-card-attention strong {

          color: var(--accent);

        }



        .clinics-form,

        .clinics-form-grid,

        .clinics-filter-grid,

        .clinics-detail-grid,

        .clinics-status-form {

          display: grid;

          gap: 16px;

        }



        .clinics-form-grid,

        .clinics-filter-grid,

        .clinics-detail-grid {

          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

        }



        .clinics-filter-actions {

          align-items: end;

        }



        .clinics-field {

          display: grid;

          gap: 8px;

        }



        .clinics-field span {

          font-size: 11px;

          font-weight: 700;

          letter-spacing: 0.12em;

          text-transform: uppercase;

          color: var(--muted);

        }



        .clinics-field input,

        .clinics-field select {

          width: 100%;

          border: 1px solid var(--border);

          background: var(--surface);

          color: var(--text);

          border-radius: 14px;

          padding: 12px 14px;

          font: inherit;

          outline: none;

        }



        .clinics-field input:focus,

        .clinics-field select:focus {

          border-color: var(--accent);

          box-shadow: 0 0 0 3px var(--focus-ring);

        }



        .clinics-inline-summary {

          border: 1px dashed var(--border-strong);

          background: var(--surface-soft);

          border-radius: 14px;

          padding: 14px;

          display: grid;

          gap: 6px;

          color: var(--muted);

        }



        .clinics-copy {

          margin: 0;

          white-space: pre-wrap;

          color: var(--text);

          word-break: break-word;

        }



        .clinics-workspace-grid {

          display: grid;

          grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);

          gap: 16px;

          align-items: start;

        }



        .clinics-list-panel,

        .clinics-detail-panel {

          min-width: 0;

        }



        .clinics-list {

          display: grid;

          gap: 12px;

        }



        .clinics-list-card {

          width: 100%;

          text-align: left;

          border: 1px solid var(--border);

          background: var(--surface);

          border-radius: 16px;

          padding: 14px;

          display: grid;

          gap: 10px;

          transition:

            border-color 0.18s ease,

            box-shadow 0.18s ease,

            transform 0.18s ease;

          cursor: pointer;

        }



        .clinics-list-card:hover {

          transform: translateY(-1px);

          border-color: var(--accent);

        }



        .clinics-list-card.active {

          border-color: var(--accent);

          box-shadow: 0 0 0 2px var(--focus-ring);

          background: var(--accent-soft);

        }



        .clinics-list-card-title,

        .clinics-detail-title {

          margin: 0;

          color: var(--text);

          line-height: 1.35;

        }



        .clinics-list-card-meta {

          display: flex;

          flex-wrap: wrap;

          gap: 8px 12px;

          color: var(--muted);

          font-size: 13px;

        }



        .clinics-detail-card {

          border: 1px solid var(--border);

          background: var(--surface-soft);

          border-radius: 14px;

          padding: 14px;

          display: grid;

          gap: 8px;

        }



        .clinics-detail-card-span {

          grid-column: 1 / -1;

        }



        .clinics-context-chip {

          border: 1px solid var(--border);

          border-radius: 999px;

          padding: 6px 10px;

          background: var(--surface-soft);

        }



        @media (max-width: 1120px) {

          .clinics-workspace-grid {

            grid-template-columns: 1fr;

          }

        }

      `}</style>

    </div>

  );

}

