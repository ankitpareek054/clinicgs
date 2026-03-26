"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import StatusPill from "../../../../components/shared/statusPill";
import { formatDateTime } from "../../../../lib/date/date";
import {
  getLeadById,
  listDuplicateWarnings,
} from "../../../../lib/receptionist/leadsApi";
import { listUsers } from "../../../../lib/receptionist/usersApi";
import { useAuth } from "../../../../providers/sessionProvider";

function canReviewDuplicateWarnings(user) {
  return user?.role === "owner" || user?.role === "super_admin";
}

function sortDuplicateWarnings(groups) {
  return [...groups].sort((a, b) => {
    if (Number(b.leadCount) !== Number(a.leadCount)) {
      return Number(b.leadCount) - Number(a.leadCount);
    }

    return String(a.normalizedPhone || "").localeCompare(
      String(b.normalizedPhone || ""),
      undefined,
      { sensitivity: "base" }
    );
  });
}

function sortLeadsInsideGroup(leads) {
  return [...leads].sort((a, b) => {
    if (a.visibilityStatus !== b.visibilityStatus) {
      return a.visibilityStatus === "active" ? -1 : 1;
    }

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

function getVisibilityLabel(status) {
  if (status === "archived") return "Archived";
  return "Active";
}

export default function DuplicateLeadsPage() {
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDuplicateWarnings = useCallback(async () => {
    if (!canReviewDuplicateWarnings(user)) {
      setGroups([]);
      setUsers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const [warningRows, userRows] = await Promise.all([
        listDuplicateWarnings(),
        listUsers({ status: "active" }),
      ]);

      const sortedWarnings = sortDuplicateWarnings(warningRows || []);

      const detailedGroups = await Promise.all(
        sortedWarnings.map(async (group) => {
          const uniqueLeadIds = [...new Set(group.leadIds || [])];

          const leadResults = await Promise.allSettled(
            uniqueLeadIds.map((leadId) => getLeadById(leadId))
          );

          const leads = sortLeadsInsideGroup(
            leadResults
              .filter((result) => result.status === "fulfilled")
              .map((result) => result.value)
          );

          return {
            ...group,
            leads,
          };
        })
      );

      setGroups(detailedGroups);
      setUsers(userRows || []);
    } catch (err) {
      setError(err.message || "Could not load duplicate warnings.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDuplicateWarnings();
  }, [loadDuplicateWarnings]);

  const usersById = useMemo(() => {
    return users.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [users]);

  const impactedLeadCount = useMemo(() => {
    return groups.reduce((sum, group) => sum + Number(group.leadCount || 0), 0);
  }, [groups]);

  const archivedLeadCount = useMemo(() => {
    return groups.reduce(
      (sum, group) => sum + Number(group.archivedLeadCount || 0),
      0
    );
  }, [groups]);

  const activeLeadCount = useMemo(() => {
    return groups.reduce(
      (sum, group) => sum + Number(group.activeLeadCount || 0),
      0
    );
  }, [groups]);

  function getAssigneeLabel(lead) {
    if (!lead?.assignedToUserId) return "Unassigned";

    return (
      usersById[lead.assignedToUserId]?.fullName ||
      `User #${lead.assignedToUserId}`
    );
  }

  if (!canReviewDuplicateWarnings(user)) {
    return (
      <div className="stack">
        <div className="page-header">
          <h1>Review duplicate leads</h1>
          <p className="muted">
            Duplicate warnings are available only to owner-level users.
          </p>
        </div>

        <section className="page-card duplicate-review-blocked-card">
          <h2>Access restricted</h2>
          <p className="muted">
            Receptionists should keep using the main leads workflow. Duplicate
            review is an owner awareness and data quality workflow.
          </p>

          <div className="record-actions">
            <Link href="/leads" className="secondary-button">
              Back to leads
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Review duplicate leads</h1>
        <p className="muted">
          Review phone-number duplicate groups across your clinic without mixing
          separate groups together.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section className="page-card duplicate-review-summary-card">
        <div className="section-heading">
          <div>
            <h2>Duplicate overview</h2>
            <p className="muted">
              Each card below represents one phone-number duplicate group that
              needs owner review.
            </p>
          </div>

          <div className="record-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={loadDuplicateWarnings}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing…" : "Refresh"}
            </button>

            <Link href="/leads" className="secondary-button">
              Back to leads
            </Link>

            <Link href="/leads/new" className="primary-button">
              Create lead
            </Link>
          </div>
        </div>

        <div className="duplicate-review-metrics-grid">
          <article className="duplicate-review-metric">
            <span className="small-label">Duplicate groups</span>
            <strong>{groups.length}</strong>
          </article>

          <article className="duplicate-review-metric">
            <span className="small-label">Impacted leads</span>
            <strong>{impactedLeadCount}</strong>
          </article>

          <article className="duplicate-review-metric">
            <span className="small-label">Active leads in review</span>
            <strong>{activeLeadCount}</strong>
          </article>

          <article className="duplicate-review-metric">
            <span className="small-label">Archived leads in review</span>
            <strong>{archivedLeadCount}</strong>
          </article>
        </div>
      </section>

      {isLoading ? (
        <section className="page-card">
          <p className="muted">Loading duplicate warnings…</p>
        </section>
      ) : groups.length === 0 ? (
        <section className="page-card">
          <div className="empty-state">
            No duplicate phone groups need review right now.
          </div>
        </section>
      ) : (
        <div className="duplicate-groups-stack">
          {groups.map((group, index) => (
            <section key={`${group.normalizedPhone}-${index}`} className="page-card">
              <div className="section-heading duplicate-group-heading">
                <div>
                  <span className="eyebrow">Group {index + 1}</span>
                  <h2 className="duplicate-group-title">
                    Potential duplicates for {group.normalizedPhone || "Unknown phone"}
                  </h2>
                  <p className="muted duplicate-group-copy">
                    {group.leadCount} leads share this normalized phone number in
                    your clinic.
                  </p>
                </div>

                <div className="duplicate-group-summary-chips">
                  <span className="duplicate-summary-chip">
                    Total {group.leadCount}
                  </span>
                  <span className="duplicate-summary-chip">
                    Active {group.activeLeadCount}
                  </span>
                  <span className="duplicate-summary-chip">
                    Archived {group.archivedLeadCount}
                  </span>
                </div>
              </div>

              {group.leads.length === 0 ? (
                <div className="empty-state">
                  Duplicate group found, but lead details could not be loaded.
                </div>
              ) : (
                <div className="duplicate-lead-list">
                  {group.leads.map((lead) => (
                    <article key={lead.id} className="duplicate-lead-card">
                      <div className="duplicate-lead-top-row">
                        <div className="duplicate-lead-title-wrap">
                          <h3>{lead.patientName || `Lead #${lead.id}`}</h3>
                          <p className="muted duplicate-lead-id">Lead ID: {lead.id}</p>
                        </div>

                        <div className="duplicate-lead-pill-row">
                          <span
                            className={`duplicate-visibility-pill ${lead.visibilityStatus}`}
                          >
                            {getVisibilityLabel(lead.visibilityStatus)}
                          </span>
                          <StatusPill status={lead.pipelineStatus} />
                        </div>
                      </div>

                      <div className="duplicate-lead-meta-grid">
                        <div className="duplicate-lead-meta-item">
                          <span className="small-label">Phone</span>
                          <strong>{lead.phone || "Not added"}</strong>
                        </div>

                        <div className="duplicate-lead-meta-item">
                          <span className="small-label">Email</span>
                          <strong>{lead.email || "No email"}</strong>
                        </div>

                        <div className="duplicate-lead-meta-item">
                          <span className="small-label">Assignee</span>
                          <strong>{getAssigneeLabel(lead)}</strong>
                        </div>

                        <div className="duplicate-lead-meta-item">
                          <span className="small-label">Source</span>
                          <strong>{lead.source || "Not added"}</strong>
                        </div>

                        <div className="duplicate-lead-meta-item">
                          <span className="small-label">Service</span>
                          <strong>{lead.serviceRequested || "Not added"}</strong>
                        </div>

                        <div className="duplicate-lead-meta-item">
                          <span className="small-label">Created</span>
                          <strong>
                            {lead.createdAt ? formatDateTime(lead.createdAt) : "—"}
                          </strong>
                        </div>
                      </div>

                      <div className="duplicate-lead-note-panel">
                        <span className="small-label">Lead note</span>
                        <p>{lead.notes || "No note added on this lead."}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <style jsx global>{`
        .duplicate-review-summary-card {
          padding-bottom: 18px;
        }

        .duplicate-review-metrics-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .duplicate-review-metric {
          border: 1px solid var(--border-color, var(--border));
          background: var(--surface-soft);
          border-radius: 16px;
          padding: 16px;
          display: grid;
          gap: 8px;
        }

        .duplicate-review-metric strong {
          font-size: 28px;
          line-height: 1;
          font-family: var(--font-serif, Georgia, serif);
          font-weight: 400;
          letter-spacing: -0.03em;
          color: var(--accent);
        }

        .duplicate-groups-stack {
          display: grid;
          gap: 16px;
        }

        .duplicate-group-heading {
          align-items: flex-start;
        }

        .duplicate-group-title {
          margin-bottom: 6px;
        }

        .duplicate-group-copy {
          margin-bottom: 0;
        }

        .duplicate-group-summary-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .duplicate-summary-chip {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 8px 12px;
          background: var(--surface-soft);
          color: var(--text-soft);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .duplicate-lead-list {
          display: grid;
          gap: 14px;
        }

        .duplicate-lead-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 18px;
          background: var(--surface-soft);
          display: grid;
          gap: 16px;
        }

        .duplicate-lead-top-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .duplicate-lead-title-wrap {
          display: grid;
          gap: 4px;
        }

        .duplicate-lead-title-wrap h3 {
          margin-bottom: 0;
        }

        .duplicate-lead-id {
          margin-bottom: 0;
        }

        .duplicate-lead-pill-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .duplicate-visibility-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          border: 1px solid var(--border);
        }

        .duplicate-visibility-pill.active {
          background: rgba(16, 185, 129, 0.12);
          border-color: rgba(16, 185, 129, 0.24);
          color: #0f766e;
        }

        .duplicate-visibility-pill.archived {
          background: rgba(100, 116, 139, 0.12);
          border-color: rgba(100, 116, 139, 0.24);
          color: #475569;
        }

        html[data-theme="dark"] .duplicate-visibility-pill.active {
          background: rgba(45, 212, 191, 0.14);
          border-color: rgba(45, 212, 191, 0.26);
          color: #5eead4;
        }

        html[data-theme="dark"] .duplicate-visibility-pill.archived {
          background: rgba(148, 163, 184, 0.14);
          border-color: rgba(148, 163, 184, 0.24);
          color: #cbd5e1;
        }

        .duplicate-lead-meta-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .duplicate-lead-meta-item {
          display: grid;
          gap: 6px;
          padding: 12px;
          border-radius: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
        }

        .duplicate-lead-meta-item strong {
          font-size: 14px;
          line-height: 1.5;
          word-break: break-word;
        }

        .duplicate-lead-note-panel {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
          background: var(--surface);
          display: grid;
          gap: 8px;
        }

        .duplicate-lead-note-panel p {
          margin-bottom: 0;
        }

        .duplicate-review-blocked-card {
          display: grid;
          gap: 12px;
        }

        @media (max-width: 1100px) {
          .duplicate-review-metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .duplicate-lead-meta-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .duplicate-review-metrics-grid,
          .duplicate-lead-meta-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}