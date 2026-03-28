
"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import PagePlaceholder from "../../../components/shared/pagePlaceHolder";

import { api, extractApiData } from "../../../lib/api/api";

import { isOwnerLike } from "../../../lib/auth/auth";

import { useAuth } from "../../../providers/sessionProvider";



const EMPTY_CREATE_FORM = {

  serviceName: "",

};



const EMPTY_EDIT_FORM = {

  serviceName: "",

  isActive: true,

};



function canUseServicesPage(user) {

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



function normalizeServiceName(value) {

  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

}



function getWorkspaceCopy(user, selectedAdminClinic) {

  if (user?.role === "super_admin") {

    return {

      eyebrow: "Super admin selected-clinic workspace",

      description: selectedAdminClinic?.name

        ? `Manage services for ${selectedAdminClinic.name} using the active clinic context.`

        : "Manage services for the currently selected clinic.",

      loadingDescription:

        "Checking selected clinic context and preparing clinic services.",

    };

  }



  return {

    eyebrow: "Owner workspace",

    description:

      "Add new services for the clinic and manage the services that already exist.",

    loadingDescription:

      "Checking your session and preparing clinic services.",

  };

}



export default function ServicesPage() {

  const router = useRouter();

  const {

    user,

    isBootstrapping,

    selectedAdminClinic = null,

    clearAdminClinic,

  } = useAuth();



  const [services, setServices] = useState([]);

  const [activeFilter, setActiveFilter] = useState("all");



  const [isLoading, setIsLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);



  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);

  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);



  const [editingServiceId, setEditingServiceId] = useState(null);

  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [busyServiceId, setBusyServiceId] = useState(null);



  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");



  const isSuperAdmin = user?.role === "super_admin";

  const targetClinicId = isSuperAdmin

    ? selectedAdminClinic?.id ?? null

    : user?.clinicId ?? null;



  const workspaceCopy = useMemo(

    () => getWorkspaceCopy(user, selectedAdminClinic),

    [user, selectedAdminClinic]

  );



  const safeClearAdminClinic =

    typeof clearAdminClinic === "function" ? clearAdminClinic : () => {};



  useEffect(() => {

    if (!isBootstrapping && user && !canUseServicesPage(user)) {

      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");

    }

  }, [isBootstrapping, router, user]);



  const loadServices = useCallback(

    async ({ refresh = false } = {}) => {

      if (!targetClinicId || !user || !canUseServicesPage(user)) {

        setServices([]);

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



        const payload = await api.get(`/clinic-services/${targetClinicId}`);

        const data = extractApiData(payload, []);

        setServices(Array.isArray(data) ? data : []);

      } catch (err) {

        setError(err?.message || "Could not load clinic services.");

      } finally {

        setIsLoading(false);

        setIsRefreshing(false);

      }

    },

    [targetClinicId, user]

  );



  useEffect(() => {

    if (!isBootstrapping && user && canUseServicesPage(user)) {

      if (isSuperAdmin && !targetClinicId) {

        setServices([]);

        setIsLoading(false);

        return;

      }



      loadServices();

    }

  }, [isBootstrapping, isSuperAdmin, loadServices, targetClinicId, user]);



  const filteredServices = useMemo(() => {

    const sorted = [...services].sort((a, b) =>

      String(a.serviceName || "").localeCompare(String(b.serviceName || ""))

    );



    if (activeFilter === "active") {

      return sorted.filter((item) => item.isActive);

    }



    if (activeFilter === "inactive") {

      return sorted.filter((item) => !item.isActive);

    }



    return sorted;

  }, [activeFilter, services]);



  const stats = useMemo(() => {

    return services.reduce(

      (accumulator, service) => {

        accumulator.total += 1;

        if (service.isActive) {

          accumulator.active += 1;

        } else {

          accumulator.inactive += 1;

        }

        return accumulator;

      },

      { total: 0, active: 0, inactive: 0 }

    );

  }, [services]);



  function updateCreateForm(field, value) {

    setCreateForm((current) => ({

      ...current,

      [field]: value,

    }));

  }



  function updateEditForm(field, value) {

    setEditForm((current) => ({

      ...current,

      [field]: value,

    }));

  }



  function resetCreateForm() {

    setCreateForm(EMPTY_CREATE_FORM);

  }



  function startEditing(service) {

    setEditingServiceId(service.id);

    setEditForm({

      serviceName: service.serviceName || "",

      isActive: Boolean(service.isActive),

    });

  }



  function stopEditing() {

    setEditingServiceId(null);

    setEditForm(EMPTY_EDIT_FORM);

  }



  function handleClearClinicContext() {

    safeClearAdminClinic();

    router.replace("/clinics");

  }



  async function handleCreateSubmit(event) {

    event.preventDefault();



    const nextName = createForm.serviceName.trim();



    if (!nextName) {

      setError("Service name is required.");

      setNotice("");

      return;

    }



    const duplicate = services.some(

      (service) => normalizeServiceName(service.serviceName) === normalizeServiceName(nextName)

    );



    if (duplicate) {

      setError("This service already exists for the clinic.");

      setNotice("");

      return;

    }



    try {

      setIsSubmittingCreate(true);

      setError("");

      setNotice("");



      await api.post(`/clinic-services/${targetClinicId}`, {

        serviceName: nextName,

        sortOrder: 0,

        isActive: true,

      });



      resetCreateForm();

      setNotice("Service created successfully.");

      await loadServices({ refresh: true });

    } catch (err) {

      setError(err?.message || "Could not create service.");

    } finally {

      setIsSubmittingCreate(false);

    }

  }



  async function handleEditSubmit(event) {

    event.preventDefault();



    if (!editingServiceId) {

      return;

    }



    const nextName = editForm.serviceName.trim();



    if (!nextName) {

      setError("Service name is required.");

      setNotice("");

      return;

    }



    const duplicate = services.some(

      (service) =>

        Number(service.id) !== Number(editingServiceId) &&

        normalizeServiceName(service.serviceName) === normalizeServiceName(nextName)

    );



    if (duplicate) {

      setError("Another service with this name already exists.");

      setNotice("");

      return;

    }



    try {

      setBusyServiceId(editingServiceId);

      setError("");

      setNotice("");



      const currentService = services.find(

        (service) => Number(service.id) === Number(editingServiceId)

      );



      await api.patch(`/clinic-services/${targetClinicId}/${editingServiceId}`, {

        serviceName: nextName,

        sortOrder: Number(currentService?.sortOrder || 0),

        isActive: Boolean(editForm.isActive),

      });



      stopEditing();

      setNotice("Service updated successfully.");

      await loadServices({ refresh: true });

    } catch (err) {

      setError(err?.message || "Could not update service.");

    } finally {

      setBusyServiceId(null);

    }

  }



  async function handleArchive(service) {

    try {

      setBusyServiceId(service.id);

      setError("");

      setNotice("");



      await api.delete(`/clinic-services/${targetClinicId}/${service.id}`);



      setNotice(`${service.serviceName || "Service"} was archived.`);

      await loadServices({ refresh: true });

    } catch (err) {

      setError(err?.message || "Could not archive service.");

    } finally {

      setBusyServiceId(null);

    }

  }



  async function handleReactivate(service) {

    try {

      setBusyServiceId(service.id);

      setError("");

      setNotice("");



      await api.patch(`/clinic-services/${targetClinicId}/${service.id}`, {

        serviceName: service.serviceName,

        sortOrder: Number(service.sortOrder || 0),

        isActive: true,

      });



      setNotice(`${service.serviceName || "Service"} was reactivated.`);

      await loadServices({ refresh: true });

    } catch (err) {

      setError(err?.message || "Could not reactivate service.");

    } finally {

      setBusyServiceId(null);

    }

  }



  if (isBootstrapping) {

    return (

      <PagePlaceholder

        title="Loading services"

        description={workspaceCopy.loadingDescription}

        points={

          isSuperAdmin

            ? [

                "Verifying super-admin access",

                "Checking selected clinic context",

                "Preparing clinic service management",

              ]

            : [

                "Verifying owner access",

                "Loading clinic services",

                "Preparing service management actions",

              ]

        }

      />

    );

  }



  if (!user) {

    return null;

  }



  if (!canUseServicesPage(user)) {

    return (

      <PagePlaceholder

        title="Access restricted"

        description="The Services page is available only to owners and super admin."

        points={[

          "Owners manage their clinic services here",

          "Super admin manages services through selected clinic context",

          "Receptionists stay focused on operations",

        ]}

      />

    );

  }



  if (isSuperAdmin && !targetClinicId) {

    return (

      <PagePlaceholder

        title="Choose a clinic first"

        description="Select a clinic in the admin workspace before opening Services."

        points={[

          "Use the Clinics workspace or another clinic-linked admin page",

          "Set the clinic as the active admin context",

          "Return here to manage that clinic’s service catalog",

        ]}

      />

    );

  }



  return (

    <div className="page stack">

      <header className="page-header">

        <div className="services-header-row">

          <div className="stack-sm">

            <span className="small-label">{workspaceCopy.eyebrow}</span>

            <h1>Services</h1>

            <p className="services-subtle">{workspaceCopy.description}</p>

          </div>



          <div className="services-header-actions">

            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() => loadServices({ refresh: true })}

              disabled={isLoading || isRefreshing || isSubmittingCreate || busyServiceId !== null}

            >

              {isRefreshing ? "Refreshing..." : "Refresh"}

            </button>

          </div>

        </div>

      </header>



      {(error || notice) && (

        <div className={error ? "error-banner" : "services-notice-banner"}>

          {error || notice}

        </div>

      )}



      {isSuperAdmin ? (

        <section className="page-card stack-sm">

          <div className="stack-sm">

            <span className="small-label">Admin clinic context</span>

            <strong className="services-context-title">

              {selectedAdminClinic?.name || "Selected clinic"}

            </strong>

            <p className="services-subtle">

              This page manages the service catalog for the active selected clinic without

              changing the owner workflow.

            </p>

          </div>



          <div className="services-context-actions">

            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() => router.push("/clinic-profile")}

            >

              Open clinic profile

            </button>



            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() => router.push("/staff")}

            >

              Open clinic staff

            </button>



            <button

              type="button"

              className="secondary-button compact-button"

              onClick={handleClearClinicContext}

              disabled={busyServiceId !== null || isSubmittingCreate}

            >

              Clear selected clinic

            </button>

          </div>

        </section>

      ) : null}



      <section className="metrics-grid">

        <article className="metric-card">

          <span className="small-label">Total</span>

          <strong>{stats.total}</strong>

          <p className="services-subtle">All clinic services.</p>

        </article>



        <article className="metric-card">

          <span className="small-label">Active</span>

          <strong>{stats.active}</strong>

          <p className="services-subtle">Services currently available.</p>

        </article>



        <article className="metric-card">

          <span className="small-label">Inactive</span>

          <strong>{stats.inactive}</strong>

          <p className="services-subtle">Archived or disabled services.</p>

        </article>



        <article className="metric-card">

          <span className="small-label">Visible now</span>

          <strong>{filteredServices.length}</strong>

          <p className="services-subtle">Services shown in the current section.</p>

        </article>

      </section>



      <section className="page-card stack">

        <div className="stack-sm">

          <span className="small-label">Create new service</span>

          <p className="services-subtle">

            Add a service only if it is not already present in this clinic.

          </p>

        </div>



        <form className="services-form" onSubmit={handleCreateSubmit}>

          <label className="services-field">

            <span>Service name</span>

            <input

              type="text"

              value={createForm.serviceName}

              onChange={(event) => updateCreateForm("serviceName", event.target.value)}

              placeholder="Enter service name"

              maxLength={200}

              disabled={isSubmittingCreate}

              required

            />

          </label>



          <div className="services-form-actions">

            <button

              type="button"

              className="secondary-button compact-button"

              onClick={resetCreateForm}

              disabled={isSubmittingCreate || !createForm.serviceName}

            >

              Clear

            </button>



            <button

              type="submit"

              className="secondary-button compact-button services-primary-button"

              disabled={isSubmittingCreate}

            >

              {isSubmittingCreate ? "Creating..." : "Add service"}

            </button>

          </div>

        </form>

      </section>



      <section className="page-card stack-sm">

        <div className="stack-sm">

          <span className="small-label">Existing clinic services</span>

          <p className="services-subtle">

            Review all services already available for this clinic and update them if needed.

          </p>

        </div>



        <div className="services-filter-row">

          <button

            type="button"

            className={`services-filter-chip ${activeFilter === "all" ? "active" : ""}`}

            onClick={() => setActiveFilter("all")}

          >

            All

          </button>



          <button

            type="button"

            className={`services-filter-chip ${activeFilter === "active" ? "active" : ""}`}

            onClick={() => setActiveFilter("active")}

          >

            Active

          </button>



          <button

            type="button"

            className={`services-filter-chip ${activeFilter === "inactive" ? "active" : ""}`}

            onClick={() => setActiveFilter("inactive")}

          >

            Inactive

          </button>

        </div>

      </section>



      {isLoading ? (

        <section className="page-card">

          <div className="empty-state">Loading services…</div>

        </section>

      ) : filteredServices.length === 0 ? (

        <section className="page-card">

          <div className="empty-state">No services matched the current view.</div>

        </section>

      ) : (

        <section className="stack">

          {filteredServices.map((service) => {

            const isEditing = Number(editingServiceId) === Number(service.id);

            const isBusy = Number(busyServiceId) === Number(service.id);



            return (

              <article key={service.id} className="page-card services-card">

                {!isEditing ? (

                  <div className="stack">

                    <div className="services-card-header">

                      <div className="stack-sm">

                        <div className="services-card-topline">

                          <span className="small-label">Service #{service.id}</span>

                          <span className={`status-pill ${service.isActive ? "done" : "cancelled"}`}>

                            {service.isActive ? "Active" : "Inactive"}

                          </span>

                        </div>



                        <h3 className="services-card-title">

                          {service.serviceName || "Unnamed service"}

                        </h3>

                      </div>



                      <div className="services-card-actions">

                        <button

                          type="button"

                          className="secondary-button compact-button"

                          onClick={() => startEditing(service)}

                          disabled={isBusy}

                        >

                          Edit

                        </button>



                        {service.isActive ? (

                          <button

                            type="button"

                            className="secondary-button compact-button"

                            onClick={() => handleArchive(service)}

                            disabled={isBusy}

                          >

                            {isBusy ? "Updating..." : "Archive"}

                          </button>

                        ) : (

                          <button

                            type="button"

                            className="secondary-button compact-button services-primary-button"

                            onClick={() => handleReactivate(service)}

                            disabled={isBusy}

                          >

                            {isBusy ? "Updating..." : "Reactivate"}

                          </button>

                        )}

                      </div>

                    </div>



                    <div className="services-details-grid">

                      <div className="services-detail-card">

                        <span className="small-label">Created</span>

                        <strong>{formatDateTime(service.createdAt)}</strong>

                      </div>



                      <div className="services-detail-card">

                        <span className="small-label">Updated</span>

                        <strong>{formatDateTime(service.updatedAt)}</strong>

                      </div>

                    </div>

                  </div>

                ) : (

                  <form className="services-form stack" onSubmit={handleEditSubmit}>

                    <div className="services-card-header">

                      <div className="stack-sm">

                        <span className="small-label">Edit service #{service.id}</span>

                        <h3 className="services-card-title">

                          {service.serviceName || "Unnamed service"}

                        </h3>

                      </div>



                      <span className={`status-pill ${editForm.isActive ? "done" : "cancelled"}`}>

                        {editForm.isActive ? "Active" : "Inactive"}

                      </span>

                    </div>



                    <label className="services-field">

                      <span>Service name</span>

                      <input

                        type="text"

                        value={editForm.serviceName}

                        onChange={(event) => updateEditForm("serviceName", event.target.value)}

                        maxLength={200}

                        disabled={isBusy}

                        required

                      />

                    </label>



                    <label className="services-checkbox-row">

                      <input

                        type="checkbox"

                        checked={editForm.isActive}

                        onChange={(event) => updateEditForm("isActive", event.target.checked)}

                        disabled={isBusy}

                      />

                      <span>Keep this service active</span>

                    </label>



                    <div className="services-form-actions">

                      <button

                        type="button"

                        className="secondary-button compact-button"

                        onClick={stopEditing}

                        disabled={isBusy}

                      >

                        Cancel

                      </button>



                      <button

                        type="submit"

                        className="secondary-button compact-button services-primary-button"

                        disabled={isBusy}

                      >

                        {isBusy ? "Saving..." : "Save changes"}

                      </button>

                    </div>

                  </form>

                )}

              </article>

            );

          })}

        </section>

      )}



      <style jsx>{`

        .services-header-row {

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          gap: 16px;

          flex-wrap: wrap;

        }



        .services-header-actions,

        .services-context-actions {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .services-subtle {

          margin: 0;

          color: var(--muted);

        }



        .services-context-title {

          color: var(--text);

          line-height: 1.3;

        }



        .services-notice-banner {

          border: 1px solid var(--accent);

          background: var(--accent-soft);

          color: var(--text);

          padding: 14px 16px;

          border-radius: 16px;

        }



        .services-primary-button {

          background: var(--accent-soft);

          border-color: var(--accent);

          color: var(--accent);

        }



        .services-primary-button:hover:not(:disabled) {

          background: var(--surface-soft);

        }



        .services-form,

        .services-details-grid {

          display: grid;

          gap: 16px;

        }



        .services-details-grid {

          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

        }



        .services-field {

          display: grid;

          gap: 8px;

        }



        .services-field span {

          font-size: 11px;

          font-weight: 700;

          letter-spacing: 0.12em;

          text-transform: uppercase;

          color: var(--muted);

        }



        .services-field input {

          width: 100%;

          border: 1px solid var(--border);

          background: var(--surface);

          color: var(--text);

          border-radius: 14px;

          padding: 12px 14px;

          font: inherit;

          outline: none;

        }



        .services-field input:focus {

          border-color: var(--accent);

          box-shadow: 0 0 0 3px var(--focus-ring);

        }



        .services-checkbox-row {

          display: inline-flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .services-checkbox-row input {

          width: 16px;

          height: 16px;

        }



        .services-form-actions {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .services-filter-row {

          display: flex;

          gap: 10px;

          flex-wrap: wrap;

        }



        .services-filter-chip {

          border: 1px solid var(--border);

          background: var(--surface);

          color: var(--text);

          border-radius: 999px;

          padding: 10px 14px;

          font: inherit;

          cursor: pointer;

        }



        .services-filter-chip.active {

          border-color: var(--accent);

          background: var(--accent-soft);

          color: var(--accent);

        }



        .services-card {

          border: 1px solid var(--border);

        }



        .services-card-header {

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          gap: 16px;

          flex-wrap: wrap;

        }



        .services-card-topline {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .services-card-title {

          margin: 0;

          font-size: 1.1rem;

          line-height: 1.35;

        }



        .services-card-actions {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .services-detail-card {

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