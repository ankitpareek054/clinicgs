
"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import PagePlaceholder from "../../../components/shared/pagePlaceHolder";

import { api, buildQuery, extractApiData } from "../../../lib/api/api";

import { isOwnerLike } from "../../../lib/auth/auth";

import { useAuth } from "../../../providers/sessionProvider";



const REQUEST_TYPE_OPTIONS = [

  { value: "add_receptionist", label: "Add receptionist" },

  { value: "remove_receptionist", label: "Remove receptionist" },

  { value: "add_owner", label: "Add owner" },

  { value: "remove_owner", label: "Remove owner" },

];



const STATUS_OPTIONS = [

  { value: "pending", label: "Pending" },

  { value: "approved", label: "Approved" },

  { value: "rejected", label: "Rejected" },

  { value: "cancelled", label: "Cancelled" },

];



const DECISION_STATUS_OPTIONS = [

  { value: "approved", label: "Approve" },

  { value: "rejected", label: "Reject" },

];



const EMPTY_CREATE_FORM = {

  requestType: "add_receptionist",

  targetUserId: "",

  targetName: "",

  targetEmail: "",

  targetPhone: "",

  requestNote: "",

};



const EMPTY_DECISION_FORM = {

  status: "approved",

  adminNote: "",

};



function formatDateTime(value) {

  if (!value) return "Unknown time";



  try {

    return new Intl.DateTimeFormat("en-IN", {

      dateStyle: "medium",

      timeStyle: "short",

    }).format(new Date(value));

  } catch {

    return "Unknown time";

  }

}



function humanizeToken(value, fallback = "General") {

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

  if (status === "approved") return "done";

  if (status === "rejected" || status === "cancelled") return "cancelled";

  return "pending";

}



function getRequestTargetRole(requestType) {

  if (

    requestType === "add_receptionist" ||

    requestType === "remove_receptionist"

  ) {

    return "receptionist";

  }



  return "owner";

}



function canCreateStaffRequests(user) {

  return user?.role === "owner";

}



function canViewStaffRequests(user) {

  return user?.role === "owner" || user?.role === "super_admin";

}



function isRemovalRequest(requestType) {

  return requestType === "remove_owner" || requestType === "remove_receptionist";

}



function getRemovalLabel(requestType) {

  return requestType === "remove_owner" ? "owner" : "receptionist";

}



function getDecisionSummary(status) {

  if (status === "approved") return "Approved";

  if (status === "rejected") return "Rejected";

  if (status === "cancelled") return "Cancelled";

  return "Pending";

}



export default function StaffRequestsPage() {

  const router = useRouter();

  const {

    user,

    isBootstrapping,

    selectedAdminClinic,

    setAdminClinic,

  } = useAuth();



  const isSuperAdmin = user?.role === "super_admin";

  const canCreateRequests = canCreateStaffRequests(user);



  const [requests, setRequests] = useState([]);

  const [clinics, setClinics] = useState([]);

  const [owners, setOwners] = useState([]);

  const [receptionists, setReceptionists] = useState([]);

  const [filters, setFilters] = useState({

    clinicId: "",

    status: "",

    requestType: "",

    pendingOnly: false,

  });



  const [isLoading, setIsLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isClinicsLoading, setIsClinicsLoading] = useState(false);

  const [isStaffLoading, setIsStaffLoading] = useState(false);



  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);

  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);



  const [selectedRequestId, setSelectedRequestId] = useState(null);

  const [decisionForm, setDecisionForm] = useState(EMPTY_DECISION_FORM);

  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const [decisionResult, setDecisionResult] = useState(null);



  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");



  const safeSetAdminClinic =

    typeof setAdminClinic === "function" ? setAdminClinic : () => null;



  useEffect(() => {

    if (!isBootstrapping && user && !canViewStaffRequests(user)) {

      router.replace(isOwnerLike(user) ? "/dashboard" : "/my-tasks");

    }

  }, [isBootstrapping, router, user]);



  const clinicOptions = useMemo(() => {

    return [...clinics].sort((a, b) =>

      String(a?.name || "").localeCompare(String(b?.name || ""))

    );

  }, [clinics]);



  const clinicMapById = useMemo(() => {

    const map = new Map();



    clinicOptions.forEach((clinic) => {

      map.set(Number(clinic.id), clinic);

    });



    return map;

  }, [clinicOptions]);



  const clinicNameById = useMemo(() => {

    const map = new Map();



    clinicOptions.forEach((clinic) => {

      map.set(Number(clinic.id), clinic.name || `Clinic #${clinic.id}`);

    });



    return map;

  }, [clinicOptions]);



  function getClinicLabel(clinicId) {

    const normalized = Number(clinicId);



    if (clinicNameById.has(normalized)) {

      return clinicNameById.get(normalized);

    }



    if (clinicId === null || clinicId === undefined || clinicId === "") {

      return "Unknown clinic";

    }



    return `Clinic #${clinicId}`;

  }



  function getClinicSelectionFromRequest(request) {

    if (!request) {

      return null;

    }



    const clinicId =

      request.clinicId ?? request.clinic_id ?? request.clinic?.id ?? null;



    if (!clinicId) {

      return null;

    }



    const clinicFromMap = clinicMapById.get(Number(clinicId));



    return {

      id: clinicId,

      name:

        request.clinicName ||

        request.clinic_name ||

        clinicFromMap?.name ||

        `Clinic #${clinicId}`,

      status:

        request.clinicStatus ||

        request.clinic_status ||

        clinicFromMap?.status ||

        "",

      city:

        request.clinicCity ||

        request.clinic_city ||

        clinicFromMap?.city ||

        "",

    };

  }



  const loadClinics = useCallback(async () => {

    if (!user || user.role !== "super_admin") {

      setClinics([]);

      return;

    }



    try {

      setIsClinicsLoading(true);

      const payload = await api.get("/clinics");

      const data = extractApiData(payload, []);

      setClinics(Array.isArray(data) ? data : []);

    } catch (err) {

      setError(err?.message || "Could not load clinics.");

    } finally {

      setIsClinicsLoading(false);

    }

  }, [user]);



  const loadRequests = useCallback(

    async ({ refresh = false } = {}) => {

      if (!user || !canViewStaffRequests(user)) {

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



        const query = buildQuery({

          clinicId: isSuperAdmin ? filters.clinicId || undefined : undefined,

          status: filters.status || undefined,

          requestType: filters.requestType || undefined,

        });



        const payload = await api.get(`/staff-requests${query}`);

        const data = extractApiData(payload, []);



        setRequests(Array.isArray(data) ? data : []);

      } catch (err) {

        setError(err?.message || "Could not load staff requests.");

      } finally {

        setIsLoading(false);

        setIsRefreshing(false);

      }

    },

    [filters.clinicId, filters.requestType, filters.status, isSuperAdmin, user]

  );



  const loadStaffOptions = useCallback(async () => {

    if (!user || !canCreateRequests) {

      setOwners([]);

      setReceptionists([]);

      return;

    }



    try {

      setIsStaffLoading(true);



      const ownerQuery = buildQuery({

        role: "owner",

        status: "active",

      });



      const receptionistQuery = buildQuery({

        role: "receptionist",

        status: "active",

      });



      const [ownersPayload, receptionistsPayload] = await Promise.all([

        api.get(`/users${ownerQuery}`),

        api.get(`/users${receptionistQuery}`),

      ]);



      const ownersData = extractApiData(ownersPayload, []);

      const receptionistsData = extractApiData(receptionistsPayload, []);



      const ownerOptions = (Array.isArray(ownersData) ? ownersData : []).filter(

        (ownerItem) => Number(ownerItem.id) !== Number(user.id)

      );



      setOwners(ownerOptions);

      setReceptionists(Array.isArray(receptionistsData) ? receptionistsData : []);

    } catch (err) {

      setError(err?.message || "Could not load clinic staff.");

    } finally {

      setIsStaffLoading(false);

    }

  }, [canCreateRequests, user]);



  useEffect(() => {

    if (!isBootstrapping && user && user.role === "super_admin") {

      loadClinics();

    }

  }, [isBootstrapping, loadClinics, user]);



  useEffect(() => {

    if (!isBootstrapping && user && canViewStaffRequests(user)) {

      loadRequests();

    }

  }, [isBootstrapping, loadRequests, user]);



  useEffect(() => {

    if (!isBootstrapping && user && canCreateRequests) {

      loadStaffOptions();

    }

  }, [isBootstrapping, loadStaffOptions, canCreateRequests, user]);



  const visibleRequests = useMemo(() => {

    let next = [...requests];



    if (isSuperAdmin && filters.pendingOnly) {

      next = next.filter((request) => request.status === "pending");

    }



    next.sort((a, b) => {

      if (isSuperAdmin) {

        const statusRank = { pending: 3, approved: 2, rejected: 1, cancelled: 0 };

        const rankDiff =

          (statusRank[b.status] || 0) - (statusRank[a.status] || 0);



        if (rankDiff !== 0) return rankDiff;

      }



      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    });



    return next;

  }, [filters.pendingOnly, isSuperAdmin, requests]);



  const requestStats = useMemo(() => {

    return visibleRequests.reduce(

      (accumulator, request) => {

        accumulator.total += 1;



        if (request.status === "pending") accumulator.pending += 1;

        if (request.status === "approved") accumulator.approved += 1;

        if (request.status === "rejected") accumulator.rejected += 1;

        if (request.status === "cancelled") accumulator.cancelled += 1;



        return accumulator;

      },

      {

        total: 0,

        pending: 0,

        approved: 0,

        rejected: 0,

        cancelled: 0,

      }

    );

  }, [visibleRequests]);



  useEffect(() => {

    if (!isSuperAdmin) {

      setSelectedRequestId(null);

      return;

    }



    if (!visibleRequests.length) {

      setSelectedRequestId(null);

      return;

    }



    const requestStillExists = visibleRequests.some(

      (request) => Number(request.id) === Number(selectedRequestId)

    );



    if (!requestStillExists) {

      setSelectedRequestId(visibleRequests[0].id);

    }

  }, [isSuperAdmin, selectedRequestId, visibleRequests]);



  const selectedRequest = useMemo(() => {

    return (

      visibleRequests.find(

        (request) => Number(request.id) === Number(selectedRequestId)

      ) || null

    );

  }, [selectedRequestId, visibleRequests]);



  useEffect(() => {

    if (!isSuperAdmin || !selectedRequest) {

      setDecisionForm(EMPTY_DECISION_FORM);

      return;

    }



    setDecisionForm({

      status: "approved",

      adminNote: selectedRequest.adminNote || "",

    });

  }, [isSuperAdmin, selectedRequest]);



  const selectedRemovalUser = useMemo(() => {

    if (!createForm.targetUserId) return null;



    const source =

      createForm.requestType === "remove_owner" ? owners : receptionists;



    return (

      source.find((item) => Number(item.id) === Number(createForm.targetUserId)) ||

      null

    );

  }, [createForm.requestType, createForm.targetUserId, owners, receptionists]);



  const decisionResultForSelected = useMemo(() => {

    if (!decisionResult?.request || !selectedRequest) return null;



    return Number(decisionResult.request.id) === Number(selectedRequest.id)

      ? decisionResult

      : null;

  }, [decisionResult, selectedRequest]);



  const selectedClinicMatchesFilter = useMemo(() => {

    if (!selectedAdminClinic?.id || !filters.clinicId) {

      return false;

    }



    return Number(selectedAdminClinic.id) === Number(filters.clinicId);

  }, [filters.clinicId, selectedAdminClinic]);



  function updateCreateForm(field, value) {

    setCreateForm((current) => ({

      ...current,

      [field]: value,

    }));

  }



  function resetCreateForm(nextType = "add_receptionist") {

    setCreateForm({

      requestType: nextType,

      targetUserId: "",

      targetName: "",

      targetEmail: "",

      targetPhone: "",

      requestNote: "",

    });

  }



  function closeCreateForm() {

    setIsCreateOpen(false);

    resetCreateForm();

  }



  function updateDecisionForm(field, value) {

    setDecisionForm((current) => ({

      ...current,

      [field]: value,

    }));

  }



  function applySelectedClinicFilter() {

    if (!selectedAdminClinic?.id) {

      return;

    }



    setFilters((current) => ({

      ...current,

      clinicId: String(selectedAdminClinic.id),

    }));

  }



  function clearClinicFilter() {

    setFilters((current) => ({

      ...current,

      clinicId: "",

    }));

  }



  function activateClinicContext(request, nextPath) {

    if (!isSuperAdmin) {

      return;

    }



    const clinicSelection = getClinicSelectionFromRequest(request);



    if (!clinicSelection) {

      setError("This request does not include clinic context.");

      setNotice("");

      return;

    }



    safeSetAdminClinic(clinicSelection);



    if (nextPath) {

      router.push(nextPath);

    } else {

      setNotice(`Selected clinic set to ${clinicSelection.name}.`);

      setError("");

    }

  }



  async function handleCreateSubmit(event) {

    event.preventDefault();



    if (!canCreateRequests) {

      return;

    }



    try {

      setIsSubmittingCreate(true);

      setError("");

      setNotice("");

      setDecisionResult(null);



      let payload;



      if (isRemovalRequest(createForm.requestType)) {

        if (!selectedRemovalUser) {

          throw new Error(

            `Please select the ${getRemovalLabel(createForm.requestType)} to remove.`

          );

        }



        payload = {

          requestType: createForm.requestType,

          targetUserId: Number(selectedRemovalUser.id),

          targetName: selectedRemovalUser.fullName || selectedRemovalUser.email,

          targetEmail: selectedRemovalUser.email || null,

          targetPhone: selectedRemovalUser.phone || null,

          targetRole: getRequestTargetRole(createForm.requestType),

          requestNote: createForm.requestNote.trim() || null,

        };

      } else {

        payload = {

          requestType: createForm.requestType,

          targetName: createForm.targetName.trim(),

          targetEmail: createForm.targetEmail.trim(),

          targetPhone: createForm.targetPhone.trim() || null,

          targetRole: getRequestTargetRole(createForm.requestType),

          requestNote: createForm.requestNote.trim() || null,

        };

      }



      await api.post("/staff-requests", payload);



      closeCreateForm();

      setNotice("Staff request created successfully.");

      await loadRequests({ refresh: true });

      await loadStaffOptions();

    } catch (err) {

      setError(err?.message || "Could not create staff request.");

    } finally {

      setIsSubmittingCreate(false);

    }

  }



  async function handleDecisionSubmit(event) {

    event.preventDefault();



    if (!isSuperAdmin || !selectedRequest || selectedRequest.status !== "pending") {

      return;

    }



    try {

      setIsSubmittingDecision(true);

      setError("");

      setNotice("");



      const payload = await api.patch(

        `/staff-requests/${selectedRequest.id}/decision`,

        {

          status: decisionForm.status,

          adminNote: decisionForm.adminNote.trim() || null,

        }

      );



      const data = extractApiData(payload, null);

      const normalizedResult =

        data && typeof data === "object"

          ? data

          : {

              request: null,

              createdUser: null,

              invite: null,

            };



      setDecisionResult(normalizedResult);

      setNotice(

        decisionForm.status === "approved"

          ? "Staff request approved successfully."

          : "Staff request rejected successfully."

      );



      await loadRequests({ refresh: true });

    } catch (err) {

      setError(err?.message || "Could not update staff request.");

    } finally {

      setIsSubmittingDecision(false);

    }

  }



  if (isBootstrapping) {

    return (

      <PagePlaceholder

        title="Loading staff requests"

        description="Checking your session and preparing the right staff-request workspace."

        points={[

          "Verifying workspace access",

          "Loading request history",

          "Preparing role-specific actions",

        ]}

      />

    );

  }



  if (!user) {

    return null;

  }



  if (!canViewStaffRequests(user)) {

    return (

      <PagePlaceholder

        title="Redirecting"

        description="This page is only available to owners and super admin."

        points={[

          "Owners create and review their clinic requests",

          "Super admin decides requests across clinics",

          "Receptionists stay out of staff approval flows",

        ]}

      />

    );

  }



  const removalOptions =

    createForm.requestType === "remove_owner" ? owners : receptionists;



  return (

    <div className="page stack">

      <header className="page-header">

        <div className="staff-requests-header-row">

          <div className="stack-sm">

            <span className="small-label">

              {isSuperAdmin ? "Super admin workspace" : "Owner workspace"}

            </span>

            <h1>Staff Requests</h1>

            <p className="staff-requests-subtle">

              {isSuperAdmin

                ? "Review requests across clinics, make approval decisions, and keep the final action trail visible."

                : "Create clinic staff and ownership requests for super admin approval."}

            </p>

          </div>



          <div className="staff-requests-header-actions">

            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() => loadRequests({ refresh: true })}

              disabled={

                isLoading ||

                isRefreshing ||

                isSubmittingCreate ||

                isSubmittingDecision

              }

            >

              {isRefreshing ? "Refreshing..." : "Refresh"}

            </button>



            {canCreateRequests ? (

              <button

                type="button"

                className="secondary-button compact-button staff-requests-primary-button"

                onClick={() => setIsCreateOpen((current) => !current)}

                disabled={isSubmittingCreate}

              >

                {isCreateOpen ? "Close form" : "New request"}

              </button>

            ) : null}

          </div>

        </div>

      </header>



      {(error || notice) && (

        <div className={error ? "error-banner" : "staff-requests-notice-banner"}>

          {error || notice}

        </div>

      )}



      {isSuperAdmin ? (

        <section className="page-card stack-sm">

          <div className="stack-sm">

            <span className="small-label">Admin clinic context</span>

            <strong className="staff-context-title">

              {selectedAdminClinic?.name || "All clinics mode"}

            </strong>

            <p className="staff-requests-subtle">

              {selectedAdminClinic

                ? "You already have a selected clinic for clinic-scoped admin pages. You can use it as a filter here or replace it from any request below."

                : "You are reviewing requests across all clinics. When needed, activate a clinic from any request to jump into that clinic workspace."}

            </p>

          </div>



          <div className="staff-context-actions">

            <button

              type="button"

              className="secondary-button compact-button"

              onClick={applySelectedClinicFilter}

              disabled={

                !selectedAdminClinic ||

                selectedClinicMatchesFilter ||

                isLoading ||

                isRefreshing

              }

            >

              {selectedClinicMatchesFilter

                ? "Selected clinic filter active"

                : "Use selected clinic filter"}

            </button>



            <button

              type="button"

              className="secondary-button compact-button"

              onClick={clearClinicFilter}

              disabled={!filters.clinicId || isLoading || isRefreshing}

            >

              Clear clinic filter

            </button>



            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() => router.push("/staff")}

              disabled={!selectedAdminClinic}

            >

              Open selected clinic staff

            </button>

          </div>

        </section>

      ) : null}



      <section className="metrics-grid">

        <article className="metric-card">

          <span className="small-label">Loaded</span>

          <strong>{requestStats.total}</strong>

          <p className="staff-requests-subtle">

            Requests in the current filtered view.

          </p>

        </article>



        <article className="metric-card">

          <span className="small-label">Pending</span>

          <strong>{requestStats.pending}</strong>

          <p className="staff-requests-subtle">

            Requests waiting for super admin decision.

          </p>

        </article>



        <article className="metric-card">

          <span className="small-label">Approved</span>

          <strong>{requestStats.approved}</strong>

          <p className="staff-requests-subtle">

            Requests already approved.

          </p>

        </article>



        <article className="metric-card">

          <span className="small-label">Rejected / Cancelled</span>

          <strong>{requestStats.rejected + requestStats.cancelled}</strong>

          <p className="staff-requests-subtle">

            Requests that did not move forward.

          </p>

        </article>

      </section>



      {canCreateRequests && isCreateOpen ? (

        <section className="page-card stack">

          <div className="stack-sm">

            <span className="small-label">Create staff request</span>

            <p className="staff-requests-subtle">

              Owners can add or remove receptionists, and add or remove owners

              through super admin approval.

            </p>

          </div>



          <form className="staff-requests-form" onSubmit={handleCreateSubmit}>

            <div className="staff-requests-form-grid">

              <label className="staff-requests-field">

                <span>Request type</span>

                <select

                  value={createForm.requestType}

                  onChange={(event) => resetCreateForm(event.target.value)}

                  disabled={isSubmittingCreate}

                >

                  {REQUEST_TYPE_OPTIONS.map((option) => (

                    <option key={option.value} value={option.value}>

                      {option.label}

                    </option>

                  ))}

                </select>

              </label>

            </div>



            {isRemovalRequest(createForm.requestType) ? (

              <>

                <label className="staff-requests-field">

                  <span>

                    Select {getRemovalLabel(createForm.requestType)} to remove

                  </span>

                  <select

                    value={createForm.targetUserId}

                    onChange={(event) =>

                      updateCreateForm("targetUserId", event.target.value)

                    }

                    disabled={

                      isSubmittingCreate ||

                      isStaffLoading ||

                      removalOptions.length === 0

                    }

                    required

                  >

                    <option value="">

                      {isStaffLoading

                        ? "Loading staff..."

                        : removalOptions.length === 0

                          ? `No removable ${getRemovalLabel(createForm.requestType)} found`

                          : `Choose a ${getRemovalLabel(createForm.requestType)}`}

                    </option>



                    {removalOptions.map((item) => (

                      <option key={item.id} value={item.id}>

                        {item.fullName || item.email}{" "}

                        {item.email ? `(${item.email})` : ""}

                      </option>

                    ))}

                  </select>

                </label>



                {selectedRemovalUser ? (

                  <div className="staff-requests-inline-summary">

                    <div>

                      <strong>

                        {selectedRemovalUser.fullName ||

                          `Unnamed ${getRemovalLabel(createForm.requestType)}`}

                      </strong>

                    </div>

                    <div>{selectedRemovalUser.email || "No email available"}</div>

                    {selectedRemovalUser.phone ? (

                      <div>{selectedRemovalUser.phone}</div>

                    ) : null}

                    <div className="staff-requests-warning">

                      This request will send a removal/deactivation request to

                      super admin for approval.

                    </div>

                  </div>

                ) : null}

              </>

            ) : (

              <>

                <div className="staff-requests-form-grid">

                  <label className="staff-requests-field">

                    <span>

                      {createForm.requestType === "add_receptionist"

                        ? "Receptionist name"

                        : "Owner name"}

                    </span>

                    <input

                      type="text"

                      value={createForm.targetName}

                      onChange={(event) =>

                        updateCreateForm("targetName", event.target.value)

                      }

                      placeholder="Enter full name"

                      maxLength={200}

                      disabled={isSubmittingCreate}

                      required

                    />

                  </label>



                  <label className="staff-requests-field">

                    <span>

                      {createForm.requestType === "add_receptionist"

                        ? "Receptionist email"

                        : "Owner email"}

                    </span>

                    <input

                      type="email"

                      value={createForm.targetEmail}

                      onChange={(event) =>

                        updateCreateForm("targetEmail", event.target.value)

                      }

                      placeholder="Enter email address"

                      maxLength={200}

                      disabled={isSubmittingCreate}

                      required

                    />

                  </label>

                </div>



                <label className="staff-requests-field">

                  <span>Phone</span>

                  <input

                    type="text"

                    value={createForm.targetPhone}

                    onChange={(event) =>

                      updateCreateForm("targetPhone", event.target.value)

                    }

                    placeholder="Optional phone number"

                    maxLength={30}

                    disabled={isSubmittingCreate}

                  />

                </label>

              </>

            )}



            <label className="staff-requests-field">

              <span>Request note</span>

              <textarea

                value={createForm.requestNote}

                onChange={(event) =>

                  updateCreateForm("requestNote", event.target.value)

                }

                placeholder={

                  isRemovalRequest(createForm.requestType)

                    ? "Add a short confirmation or removal reason"

                    : "Why this request is needed"

                }

                rows={5}

                maxLength={1000}

                disabled={isSubmittingCreate}

              />

            </label>



            <div className="staff-requests-form-actions">

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

                className="secondary-button compact-button staff-requests-primary-button"

                disabled={

                  isSubmittingCreate ||

                  (isRemovalRequest(createForm.requestType) &&

                    removalOptions.length === 0)

                }

              >

                {isSubmittingCreate ? "Creating..." : "Create request"}

              </button>

            </div>

          </form>

        </section>

      ) : null}



      <section className="page-card stack-sm">

        <div className="stack-sm">

          <span className="small-label">Filters</span>

          <p className="staff-requests-subtle">

            Narrow the request list by clinic, status, request type, or pending-only view.

          </p>

        </div>



        <div className="staff-requests-filters-grid">

          {isSuperAdmin ? (

            <label className="staff-requests-field">

              <span>Clinic</span>

              <select

                value={filters.clinicId}

                onChange={(event) =>

                  setFilters((current) => ({

                    ...current,

                    clinicId: event.target.value,

                  }))

                }

                disabled={isLoading || isRefreshing || isClinicsLoading}

              >

                <option value="">All clinics</option>

                {clinicOptions.map((clinic) => (

                  <option key={clinic.id} value={clinic.id}>

                    {clinic.name || `Clinic #${clinic.id}`}

                  </option>

                ))}

              </select>

            </label>

          ) : null}



          <label className="staff-requests-field">

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

              <option value="">All statuses</option>

              {STATUS_OPTIONS.map((option) => (

                <option key={option.value} value={option.value}>

                  {option.label}

                </option>

              ))}

            </select>

          </label>



          <label className="staff-requests-field">

            <span>Request type</span>

            <select

              value={filters.requestType}

              onChange={(event) =>

                setFilters((current) => ({

                  ...current,

                  requestType: event.target.value,

                }))

              }

              disabled={isLoading || isRefreshing}

            >

              <option value="">All request types</option>

              {REQUEST_TYPE_OPTIONS.map((option) => (

                <option key={option.value} value={option.value}>

                  {option.label}

                </option>

              ))}

            </select>

          </label>



          {isSuperAdmin ? (

            <label className="staff-requests-toggle">

              <input

                type="checkbox"

                checked={filters.pendingOnly}

                onChange={(event) =>

                  setFilters((current) => ({

                    ...current,

                    pendingOnly: event.target.checked,

                  }))

                }

              />

              <span>Only pending requests</span>

            </label>

          ) : null}



          <div className="staff-requests-filter-actions">

            <button

              type="button"

              className="secondary-button compact-button"

              onClick={() =>

                setFilters({

                  clinicId: "",

                  status: "",

                  requestType: "",

                  pendingOnly: false,

                })

              }

              disabled={

                isLoading ||

                isRefreshing ||

                (!filters.clinicId &&

                  !filters.status &&

                  !filters.requestType &&

                  !filters.pendingOnly)

              }

            >

              Clear filters

            </button>

          </div>

        </div>

      </section>



      {isLoading ? (

        <section className="page-card">

          <div className="empty-state">

            {isSuperAdmin

              ? "Loading super admin staff-request workspace…"

              : "Loading staff requests…"}

          </div>

        </section>

      ) : visibleRequests.length === 0 ? (

        <section className="page-card">

          <div className="empty-state">

            {isSuperAdmin

              ? "No staff requests matched the current workspace filters."

              : "No staff requests matched the current view."}

          </div>

        </section>

      ) : isSuperAdmin ? (

        <section className="staff-requests-workspace-grid">

          <section className="page-card stack staff-requests-list-panel">

            <div className="staff-requests-list-panel-header">

              <div className="stack-sm">

                <span className="small-label">All requests</span>

                <p className="staff-requests-subtle">

                  Review requests from one decision queue across all clinics.

                </p>

              </div>



              <span className="small-label">{visibleRequests.length}</span>

            </div>



            <div className="staff-requests-list">

              {visibleRequests.map((request) => {

                const isActive = Number(request.id) === Number(selectedRequestId);



                return (

                  <button

                    key={request.id}

                    type="button"

                    className={`staff-requests-list-card ${isActive ? "active" : ""}`}

                    onClick={() => setSelectedRequestId(request.id)}

                  >

                    <div className="staff-requests-list-card-topline">

                      <div className="staff-request-topline">

                        <span className="small-label">

                          {humanizeToken(request.requestType)}

                        </span>



                        <span className={`status-pill ${getStatusTone(request.status)}`}>

                          {humanizeToken(request.status)}

                        </span>



                        <span className="small-label staff-request-clinic-chip">

                          {getClinicLabel(request.clinicId)}

                        </span>

                      </div>



                      <span className="small-label">

                        {humanizeToken(

                          request.targetRole || getRequestTargetRole(request.requestType)

                        )}

                      </span>

                    </div>



                    <strong className="staff-requests-list-card-title">

                      {request.targetName || "Unnamed target"}

                    </strong>



                    <div className="staff-requests-list-card-meta">

                      <span>#{request.id}</span>

                      <span>Created {formatDateTime(request.createdAt)}</span>

                    </div>

                  </button>

                );

              })}

            </div>

          </section>



          <div className="staff-requests-workspace-column stack">

            {selectedRequest ? (

              <>

                <section className="page-card stack">

                  <div className="staff-request-header">

                    <div className="stack-sm">

                      <div className="staff-request-topline">

                        <span className="small-label">

                          {humanizeToken(selectedRequest.requestType)}

                        </span>



                        <span

                          className={`status-pill ${getStatusTone(selectedRequest.status)}`}

                        >

                          {humanizeToken(selectedRequest.status)}

                        </span>



                        <span className="small-label staff-request-clinic-chip">

                          {getClinicLabel(selectedRequest.clinicId)}

                        </span>

                      </div>



                      <h3 className="staff-request-title">

                        {selectedRequest.targetName || "Unnamed target"}

                      </h3>

                    </div>



                    <div className="staff-request-side-meta">

                      <span className="small-label">

                        Request #{selectedRequest.id}

                      </span>

                      <span className="small-label">

                        {humanizeToken(

                          selectedRequest.targetRole ||

                            getRequestTargetRole(selectedRequest.requestType)

                        )}

                      </span>

                    </div>

                  </div>



                  <div className="staff-request-details-grid">

                    <div className="staff-request-detail-card">

                      <span className="small-label">Target email</span>

                      <strong>{selectedRequest.targetEmail || "Not provided"}</strong>

                    </div>



                    <div className="staff-request-detail-card">

                      <span className="small-label">Target phone</span>

                      <strong>{selectedRequest.targetPhone || "Not provided"}</strong>

                    </div>



                    <div className="staff-request-detail-card">

                      <span className="small-label">Created</span>

                      <strong>{formatDateTime(selectedRequest.createdAt)}</strong>

                    </div>



                    <div className="staff-request-detail-card">

                      <span className="small-label">Decision</span>

                      <strong>{getDecisionSummary(selectedRequest.status)}</strong>

                    </div>



                    <div className="staff-request-detail-card">

                      <span className="small-label">Approved at</span>

                      <strong>

                        {selectedRequest.approvedAt

                          ? formatDateTime(selectedRequest.approvedAt)

                          : "Not decided yet"}

                      </strong>

                    </div>



                    <div className="staff-request-detail-card">

                      <span className="small-label">Clinic</span>

                      <strong>{getClinicLabel(selectedRequest.clinicId)}</strong>

                    </div>

                  </div>



                  <div className="staff-request-detail-actions">

                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={() => activateClinicContext(selectedRequest)}

                    >

                      Use this clinic workspace

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={() => activateClinicContext(selectedRequest, "/staff")}

                    >

                      Open clinic staff

                    </button>



                    <button

                      type="button"

                      className="secondary-button compact-button"

                      onClick={() =>

                        activateClinicContext(selectedRequest, "/clinic-profile")

                      }

                    >

                      Open clinic profile

                    </button>

                  </div>

                </section>



                {selectedRequest.requestNote ? (

                  <section className="page-card stack-sm">

                    <span className="small-label">Owner note</span>

                    <p className="staff-request-copy">{selectedRequest.requestNote}</p>

                  </section>

                ) : null}



                {selectedRequest.adminNote ? (

                  <section className="page-card stack-sm">

                    <span className="small-label">Existing admin note</span>

                    <p className="staff-request-copy">{selectedRequest.adminNote}</p>

                  </section>

                ) : null}



                {selectedRequest.status === "pending" ? (

                  <section className="page-card stack">

                    <div className="stack-sm">

                      <span className="small-label">Decision workspace</span>

                      <p className="staff-requests-subtle">

                        Approve or reject this request and record the final admin note.

                      </p>

                    </div>



                    <form className="staff-requests-form" onSubmit={handleDecisionSubmit}>

                      <div className="staff-requests-form-grid">

                        <label className="staff-requests-field">

                          <span>Decision</span>

                          <select

                            value={decisionForm.status}

                            onChange={(event) =>

                              updateDecisionForm("status", event.target.value)

                            }

                            disabled={isSubmittingDecision}

                          >

                            {DECISION_STATUS_OPTIONS.map((option) => (

                              <option key={option.value} value={option.value}>

                                {option.label}

                              </option>

                            ))}

                          </select>

                        </label>

                      </div>



                      <label className="staff-requests-field">

                        <span>Admin note</span>

                        <textarea

                          value={decisionForm.adminNote}

                          onChange={(event) =>

                            updateDecisionForm("adminNote", event.target.value)

                          }

                          placeholder="Why this request was approved or rejected"

                          rows={5}

                          maxLength={1000}

                          disabled={isSubmittingDecision}

                        />

                      </label>



                      <div className="staff-requests-form-actions">

                        <button

                          type="submit"

                          className="secondary-button compact-button staff-requests-primary-button"

                          disabled={isSubmittingDecision}

                        >

                          {isSubmittingDecision ? "Saving..." : "Save decision"}

                        </button>

                      </div>

                    </form>

                  </section>

                ) : (

                  <section className="page-card stack-sm">

                    <span className="small-label">Decision locked</span>

                    <p className="staff-requests-subtle">

                      This request has already been decided and can no longer be changed

                      from this workflow.

                    </p>

                  </section>

                )}



                {decisionResultForSelected ? (

                  <section className="page-card stack">

                    <div className="stack-sm">

                      <span className="small-label">Latest decision result</span>

                      <p className="staff-requests-subtle">

                        Shows the outcome returned by the backend after the most recent

                        decision on this request.

                      </p>

                    </div>



                    <div className="staff-request-details-grid">

                      <div className="staff-request-detail-card">

                        <span className="small-label">Request status</span>

                        <strong>

                          {humanizeToken(decisionResultForSelected.request?.status, "Unknown")}

                        </strong>

                      </div>



                      <div className="staff-request-detail-card">

                        <span className="small-label">Created user</span>

                        <strong>

                          {decisionResultForSelected.createdUser?.email ||

                            "No new user created"}

                        </strong>

                      </div>



                      <div className="staff-request-detail-card">

                        <span className="small-label">Invite status</span>

                        <strong>

                          {decisionResultForSelected.invite?.status

                            ? humanizeToken(decisionResultForSelected.invite.status)

                            : "No invite created"}

                        </strong>

                      </div>



                      <div className="staff-request-detail-card">

                        <span className="small-label">Invite expires</span>

                        <strong>

                          {decisionResultForSelected.invite?.expiresAt

                            ? formatDateTime(decisionResultForSelected.invite.expiresAt)

                            : "Not applicable"}

                        </strong>

                      </div>

                    </div>



                    {decisionResultForSelected.createdUser ? (

                      <div className="staff-requests-inline-summary">

                        <div>

                          <strong>

                            {decisionResultForSelected.createdUser.fullName ||

                              "New pending user created"}

                          </strong>

                        </div>

                        <div>

                          {decisionResultForSelected.createdUser.email || "No email"}

                        </div>

                        <div>

                          {humanizeToken(decisionResultForSelected.createdUser.role)} /{" "}

                          {humanizeToken(decisionResultForSelected.createdUser.status)}

                        </div>

                      </div>

                    ) : null}



                    {decisionResultForSelected.invite?.rawTokenPreview ? (

                      <div className="staff-requests-inline-summary">

                        <div>

                          <strong>Development invite token preview</strong>

                        </div>

                        <div className="staff-request-copy">

                          {decisionResultForSelected.invite.rawTokenPreview}

                        </div>

                      </div>

                    ) : null}

                  </section>

                ) : null}

              </>

            ) : (

              <section className="page-card">

                <div className="empty-state">

                  Select a request from the list to review and decide it.

                </div>

              </section>

            )}

          </div>

        </section>

      ) : (

        <section className="stack">

          {visibleRequests.map((request) => (

            <article key={request.id} className="page-card staff-request-card">

              <div className="stack">

                <div className="staff-request-header">

                  <div className="stack-sm">

                    <div className="staff-request-topline">

                      <span className="small-label">

                        {humanizeToken(request.requestType)}

                      </span>



                      <span className={`status-pill ${getStatusTone(request.status)}`}>

                        {humanizeToken(request.status)}

                      </span>

                    </div>



                    <h3 className="staff-request-title">

                      {request.targetName || "Unnamed target"}

                    </h3>

                  </div>



                  <div className="staff-request-side-meta">

                    <span className="small-label">Request #{request.id}</span>

                    <span className="small-label">

                      {humanizeToken(

                        request.targetRole || getRequestTargetRole(request.requestType)

                      )}

                    </span>

                  </div>

                </div>



                <div className="staff-request-details-grid">

                  <div className="staff-request-detail-card">

                    <span className="small-label">Target email</span>

                    <strong>{request.targetEmail || "Not provided"}</strong>

                  </div>



                  <div className="staff-request-detail-card">

                    <span className="small-label">Target phone</span>

                    <strong>{request.targetPhone || "Not provided"}</strong>

                  </div>



                  <div className="staff-request-detail-card">

                    <span className="small-label">Created</span>

                    <strong>{formatDateTime(request.createdAt)}</strong>

                  </div>



                  <div className="staff-request-detail-card">

                    <span className="small-label">Approved at</span>

                    <strong>

                      {request.approvedAt

                        ? formatDateTime(request.approvedAt)

                        : "Not decided yet"}

                    </strong>

                  </div>

                </div>



                {request.requestNote ? (

                  <div className="stack-sm">

                    <span className="small-label">Owner note</span>

                    <p className="staff-request-copy">{request.requestNote}</p>

                  </div>

                ) : null}



                {request.adminNote ? (

                  <div className="stack-sm">

                    <span className="small-label">Admin note</span>

                    <p className="staff-request-copy">{request.adminNote}</p>

                  </div>

                ) : null}

              </div>

            </article>

          ))}

        </section>

      )}



      <style jsx>{`

        .staff-requests-header-row {

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          gap: 16px;

          flex-wrap: wrap;

        }



        .staff-requests-header-actions,

        .staff-context-actions,

        .staff-request-detail-actions {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .staff-context-title {

          color: var(--text);

          line-height: 1.3;

        }



        .staff-requests-subtle {

          margin: 0;

          color: var(--muted);

        }



        .staff-requests-notice-banner {

          border: 1px solid var(--accent);

          background: var(--accent-soft);

          color: var(--text);

          padding: 14px 16px;

          border-radius: 16px;

        }



        .staff-requests-primary-button {

          background: var(--accent-soft);

          border-color: var(--accent);

          color: var(--accent);

        }



        .staff-requests-primary-button:hover:not(:disabled) {

          background: var(--surface-soft);

        }



        .staff-requests-form,

        .staff-requests-form-grid,

        .staff-requests-filters-grid,

        .staff-request-details-grid {

          display: grid;

          gap: 16px;

        }



        .staff-requests-form-grid,

        .staff-requests-filters-grid,

        .staff-request-details-grid {

          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

        }



        .staff-requests-field {

          display: grid;

          gap: 8px;

        }



        .staff-requests-field span {

          font-size: 11px;

          font-weight: 700;

          letter-spacing: 0.12em;

          text-transform: uppercase;

          color: var(--muted);

        }



        .staff-requests-field input,

        .staff-requests-field select,

        .staff-requests-field textarea {

          width: 100%;

          border: 1px solid var(--border);

          background: var(--surface);

          color: var(--text);

          border-radius: 14px;

          padding: 12px 14px;

          font: inherit;

          outline: none;

        }



        .staff-requests-field input:focus,

        .staff-requests-field select:focus,

        .staff-requests-field textarea:focus {

          border-color: var(--accent);

          box-shadow: 0 0 0 3px var(--focus-ring);

        }



        .staff-requests-field textarea {

          resize: vertical;

          min-height: 120px;

        }



        .staff-requests-toggle {

          display: flex;

          align-items: center;

          gap: 10px;

          min-height: 48px;

          padding-top: 22px;

          color: var(--text);

        }



        .staff-requests-form-actions,

        .staff-requests-filter-actions {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .staff-requests-inline-summary {

          border: 1px dashed var(--border-strong);

          background: var(--surface-soft);

          border-radius: 14px;

          padding: 14px;

          display: grid;

          gap: 6px;

          color: var(--muted);

        }



        .staff-requests-warning {

          margin-top: 6px;

          color: var(--text);

          font-weight: 600;

        }



        .staff-requests-workspace-grid {

          display: grid;

          grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);

          gap: 16px;

          align-items: start;

        }



        .staff-requests-list-panel,

        .staff-requests-workspace-column {

          min-width: 0;

        }



        .staff-requests-list-panel-header {

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          gap: 12px;

        }



        .staff-requests-list {

          display: grid;

          gap: 12px;

        }



        .staff-requests-list-card {

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



        .staff-requests-list-card:hover {

          transform: translateY(-1px);

          border-color: var(--accent);

        }



        .staff-requests-list-card.active {

          border-color: var(--accent);

          box-shadow: 0 0 0 2px var(--focus-ring);

          background: var(--accent-soft);

        }



        .staff-requests-list-card-topline {

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          gap: 12px;

          flex-wrap: wrap;

        }



        .staff-requests-list-card-title {

          color: var(--text);

          line-height: 1.35;

        }



        .staff-requests-list-card-meta {

          display: flex;

          flex-wrap: wrap;

          gap: 8px 12px;

          color: var(--muted);

          font-size: 13px;

        }



        .staff-request-card {

          border: 1px solid var(--border);

        }



        .staff-request-header {

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          gap: 16px;

          flex-wrap: wrap;

        }



        .staff-request-topline {

          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;

        }



        .staff-request-title {

          margin: 0;

          font-size: 1.1rem;

          line-height: 1.35;

        }



        .staff-request-side-meta {

          display: flex;

          flex-direction: column;

          gap: 8px;

          align-items: flex-end;

        }



        .staff-request-detail-card {

          border: 1px solid var(--border);

          background: var(--surface-soft);

          border-radius: 14px;

          padding: 14px;

          display: grid;

          gap: 8px;

        }



        .staff-request-copy {

          margin: 0;

          white-space: pre-wrap;

          color: var(--text);

          word-break: break-word;

        }



        .staff-request-clinic-chip {

          border: 1px solid var(--border);

          border-radius: 999px;

          padding: 6px 10px;

          background: var(--surface-soft);

        }



        @media (max-width: 1120px) {

          .staff-requests-workspace-grid {

            grid-template-columns: 1fr;

          }

        }



        @media (max-width: 860px) {

          .staff-request-side-meta {

            align-items: flex-start;

          }

        }

      `}</style>

    </div>

  );

}

