"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isOwnerLike } from "../../../../lib/auth/auth";
import { toIsoFromLocalInput } from "../../../../lib/date/date";
import { createLead } from "../../../../lib/receptionist/leadsApi";
import { listUsers } from "../../../../lib/receptionist/usersApi";
import { useAuth } from "../../../../providers/sessionProvider";

const leadSourceOptions = [
  { value: "walk_in", label: "Walk-in" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "phone_call", label: "Phone call" },
  { value: "other", label: "Other" },
];

const assignableRoles = new Set(["owner", "receptionist"]);

function buildInitialForm(user) {
  return {
    patientName: "",
    phone: "",
    email: "",
    source: "walk_in",
    serviceRequested: "",
    notes: "",
    preferredAppointmentAt: "",
    assignedToUserId: user?.role === "receptionist" ? String(user.id) : "",
  };
}

export default function NewLeadPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState(buildInitialForm(user));
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(buildInitialForm(user));
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      if (!isOwnerLike(user)) {
        setUsers([]);
        setIsLoadingUsers(false);
        return;
      }

      setIsLoadingUsers(true);
      setError("");

      try {
        const rows = await listUsers({ status: "active" });

        if (!cancelled) {
          setUsers(rows || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load staff list.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUsers(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const assignmentOptions = useMemo(() => {
    if (!user) {
      return [{ value: "", label: "Leave unassigned" }];
    }

    if (user.role === "receptionist") {
      return [
        { value: String(user.id), label: "Assign to me" },
        { value: "", label: "Leave unassigned" },
      ];
    }

    const activeAssignableUsers = (users || []).filter((item) =>
      assignableRoles.has(item.role)
    );

    return [
      { value: "", label: "Leave unassigned" },
      ...activeAssignableUsers.map((staffUser) => ({
        value: String(staffUser.id),
        label: staffUser.fullName || staffUser.email,
      })),
    ];
  }, [user, users]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      let assignedToUserId = form.assignedToUserId
        ? Number(form.assignedToUserId)
        : null;

      if (user?.role === "receptionist") {
        assignedToUserId =
          form.assignedToUserId === String(user.id) ? Number(user.id) : null;
      }

      await createLead({
        patientName: form.patientName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        source: form.source,
        intakeChannel: "manual",
        serviceRequested: form.serviceRequested.trim() || null,
        notes: form.notes.trim() || null,
        preferredAppointmentAt: form.preferredAppointmentAt
          ? toIsoFromLocalInput(form.preferredAppointmentAt)
          : null,
        pipelineStatus: "new",
        assignedToUserId,
      });

      router.push("/leads");
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not create lead.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canAssignOthers = isOwnerLike(user);

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Create lead</h1>
        <p className="muted">
          Add a new walk-in, phone, WhatsApp, referral, or website enquiry into the
          clinic workflow.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section className="page-card">
        <div className="section-heading">
          <div>
            <h2>Lead details</h2>
            <p className="muted">
              This saves directly into the real Express backend and clinic database.
            </p>
          </div>

          <div className="record-actions">
            <Link href="/leads" className="secondary-button">
              Back to Leads
            </Link>
          </div>
        </div>

        <form className="stack-sm" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="patientName">Patient name</label>
              <input
                id="patientName"
                type="text"
                value={form.patientName}
                onChange={(event) => updateField("patientName", event.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="text"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="Enter phone number"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="Enter email"
                required
              />
              <p className="muted">Email is required by the current backend validation.</p>
            </div>

            <div className="field">
              <label htmlFor="source">Source</label>
              <select
                id="source"
                value={form.source}
                onChange={(event) => updateField("source", event.target.value)}
                required
              >
                {leadSourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="serviceRequested">Service requested</label>
              <input
                id="serviceRequested"
                type="text"
                value={form.serviceRequested}
                onChange={(event) =>
                  updateField("serviceRequested", event.target.value)
                }
                placeholder="Dental cleaning, skin consult, physio review..."
              />
            </div>

            <div className="field">
              <label htmlFor="preferredAppointmentAt">Preferred appointment</label>
              <input
                id="preferredAppointmentAt"
                type="datetime-local"
                value={form.preferredAppointmentAt}
                onChange={(event) =>
                  updateField("preferredAppointmentAt", event.target.value)
                }
              />
            </div>

            <div className="field field-span-2">
              <label htmlFor="assignedToUserId">
                {canAssignOthers ? "Assign lead" : "Assignment"}
              </label>

              <select
                id="assignedToUserId"
                value={form.assignedToUserId}
                onChange={(event) =>
                  updateField("assignedToUserId", event.target.value)
                }
                disabled={canAssignOthers && isLoadingUsers}
              >
                {assignmentOptions.map((option) => (
                  <option key={`${option.value}-${option.label}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <p className="muted">
                {user?.role === "receptionist"
                  ? "You can only assign this lead to yourself or leave it unassigned."
                  : "Owners can leave the lead unassigned or assign it to active clinic staff."}
              </p>
            </div>

            <div className="field field-span-2">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Add patient concern, urgency, callback note, or front-desk context"
              />
            </div>
          </div>

          <div className="record-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating lead…" : "Create lead"}
            </button>

            <Link href="/leads" className="secondary-button">
              Cancel
            </Link>
          </div>

          <div className="empty-state">
            Duplicate warnings are not hard-blocked in V1. Staff can still save the
            lead and review possible duplicates later.
          </div>
        </form>
      </section>
    </div>
  );
}