"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { api, buildQuery, extractApiData } from "../../../lib/api/api";
import { getRoleLabel, isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

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

function getEntityMeta(notification) {
  const entityType = humanizeToken(notification?.entityType, "General");
  const entityId =
    notification?.entityId !== null &&
    notification?.entityId !== undefined &&
    notification?.entityId !== ""
      ? `#${notification.entityId}`
      : "";

  return entityId ? `${entityType} ${entityId}` : entityType;
}

function getClinicSelectionFromNotification(notification) {
  if (!notification || typeof notification !== "object") {
    return null;
  }

  const clinicId =
    notification.clinicId ??
    notification.clinic_id ??
    notification.clinic?.id ??
    null;

  if (!clinicId) {
    return null;
  }

  return {
    id: clinicId,
    name:
      notification.clinicName ||
      notification.clinic_name ||
      notification.clinic?.name ||
      "Clinic workspace",
    status:
      notification.clinicStatus ||
      notification.clinic_status ||
      notification.clinic?.status ||
      "",
    city:
      notification.clinicCity ||
      notification.clinic_city ||
      notification.clinic?.city ||
      "",
  };
}

function getNotificationTarget(notification, user) {
  const entityType = String(
    notification?.entityType || notification?.entity_type || ""
  )
    .trim()
    .toLowerCase();

  const notificationType = String(
    notification?.notificationType || notification?.notification_type || ""
  )
    .trim()
    .toLowerCase();

  const clinicSelection = getClinicSelectionFromNotification(notification);
  const isSuperAdmin = user?.role === "super_admin";
  const isOwner = user?.role === "owner";
  const isReceptionist = user?.role === "receptionist";

  if (
    entityType === "support_ticket" ||
    entityType === "support" ||
    entityType === "ticket" ||
    notificationType.includes("support")
  ) {
    return {
      href: "/support",
      label: "Open support",
      requiresClinicContext: false,
      clinicSelection: null,
    };
  }

  if (
    entityType === "staff_request" ||
    entityType === "staff-request" ||
    notificationType.includes("staff request") ||
    notificationType.includes("staff_request")
  ) {
    if (isReceptionist) {
      return null;
    }

    return {
      href: "/staff-requests",
      label: "Open staff requests",
      requiresClinicContext: false,
      clinicSelection: null,
    };
  }

  if (
    entityType === "clinic_profile" ||
    entityType === "clinic" ||
    notificationType.includes("clinic profile")
  ) {
    if (!isOwnerLike(user)) {
      return null;
    }

    return {
      href: "/clinic-profile",
      label: "Open clinic profile",
      requiresClinicContext: isSuperAdmin,
      clinicSelection,
    };
  }

  if (
    entityType === "clinic_settings" ||
    entityType === "operational_settings" ||
    notificationType.includes("settings")
  ) {
    if (!isOwnerLike(user)) {
      return null;
    }

    return {
      href: "/clinic-settings",
      label: "Open clinic settings",
      requiresClinicContext: isSuperAdmin,
      clinicSelection,
    };
  }

  if (
    entityType === "integration" ||
    entityType === "clinic_integration" ||
    entityType === "integration_status" ||
    notificationType.includes("sync") ||
    notificationType.includes("calendar")
  ) {
    if (!isOwnerLike(user)) {
      return null;
    }

    return {
      href: "/integrations",
      label: "Open integrations",
      requiresClinicContext: isSuperAdmin,
      clinicSelection,
    };
  }

  if (
    entityType === "user" ||
    entityType === "staff" ||
    entityType === "receptionist" ||
    entityType === "owner"
  ) {
    if (!isOwnerLike(user)) {
      return null;
    }

    return {
      href: "/staff",
      label: "Open staff",
      requiresClinicContext: isSuperAdmin,
      clinicSelection,
    };
  }

  if (
    entityType === "dashboard" ||
    notificationType.includes("attention") ||
    notificationType.includes("alert")
  ) {
    return {
      href: isReceptionist ? "/my-tasks" : "/dashboard",
      label: isReceptionist ? "Open my tasks" : "Open dashboard",
      requiresClinicContext: false,
      clinicSelection: null,
    };
  }

  if (isSuperAdmin) {
    return null;
  }

  if (entityType === "lead") {
    return {
      href: "/leads",
      label: "Open leads",
      requiresClinicContext: false,
      clinicSelection: null,
    };
  }

  if (entityType === "appointment") {
    return {
      href: "/appointments",
      label: "Open appointments",
      requiresClinicContext: false,
      clinicSelection: null,
    };
  }

  if (
    entityType === "followup" ||
    entityType === "follow_up" ||
    entityType === "follow-up"
  ) {
    return {
      href: "/followups",
      label: "Open follow-ups",
      requiresClinicContext: false,
      clinicSelection: null,
    };
  }

  return null;
}

function getWorkspaceCopy(user) {
  if (!user) {
    return {
      eyebrow: "Workspace",
      description: "Review your notifications and track unread activity.",
    };
  }

  if (user.role === "super_admin") {
    return {
      eyebrow: "Super admin workspace",
      description:
        "Review platform alerts, support updates, request activity, and clinic-linked signals without leaving the admin workflow.",
    };
  }

  if (user.role === "owner") {
    return {
      eyebrow: "Owner workspace",
      description:
        "Review clinic updates, stay on top of unread items, and clear your queue without leaving the current workflow.",
    };
  }

  return {
    eyebrow: "Receptionist workspace",
    description:
      "Review your personal work alerts, support updates, and other clinic notifications in one place.",
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const {
    user,
    isBootstrapping,
    setAdminClinic,
  } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyNotificationId, setBusyNotificationId] = useState(null);
  const [busyNavigationId, setBusyNavigationId] = useState(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const safeSetAdminClinic =
    typeof setAdminClinic === "function" ? setAdminClinic : () => null;

  useEffect(() => {
    if (!isBootstrapping && !user) {
      router.replace("/login");
    }
  }, [isBootstrapping, router, user]);

  const visibleNotifications = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    if (activeFilter === "unread") {
      return sorted.filter((notification) => !notification.isRead);
    }

    return sorted;
  }, [activeFilter, notifications]);

  const readCount = useMemo(() => {
    return notifications.filter((notification) => notification.isRead).length;
  }, [notifications]);

  const workspaceCopy = useMemo(() => getWorkspaceCopy(user), [user]);

  const loadNotifications = useCallback(
    async ({ refresh = false } = {}) => {
      if (!user?.id) {
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
          userId: user.id,
        });

        const [notificationsPayload, unreadPayload] = await Promise.all([
          api.get(`/notifications${query}`),
          api.get("/notifications/unread-count"),
        ]);

        const notificationData = extractApiData(notificationsPayload, []);
        const unreadData = extractApiData(unreadPayload, { unreadCount: 0 });

        setNotifications(Array.isArray(notificationData) ? notificationData : []);
        setUnreadCount(Number(unreadData?.unreadCount) || 0);
      } catch (err) {
        setError(err?.message || "Could not load notifications.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!isBootstrapping && user) {
      loadNotifications();
    }
  }, [isBootstrapping, loadNotifications, user]);

  async function handleMarkAsRead(notificationId) {
    const target = notifications.find(
      (notification) => Number(notification.id) === Number(notificationId)
    );

    if (!target || target.isRead) {
      return;
    }

    try {
      setBusyNotificationId(notificationId);
      setError("");
      setNotice("");

      await api.patch(`/notifications/${notificationId}/read`);

      setUnreadCount((current) => Math.max(0, current - 1));

      setNotifications((current) =>
        current.map((notification) =>
          Number(notification.id) === Number(notificationId)
            ? {
                ...notification,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : notification
        )
      );

      setNotice("Notification marked as read.");
    } catch (err) {
      setError(err?.message || "Could not mark notification as read.");
    } finally {
      setBusyNotificationId(null);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      setIsMarkingAll(true);
      setError("");
      setNotice("");

      const payload = await api.patch("/notifications/read-all");
      const data = extractApiData(payload, { updatedCount: 0 });
      const updatedCount = Number(data?.updatedCount) || 0;

      setUnreadCount(0);
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt || new Date().toISOString(),
        }))
      );

      if (updatedCount > 0) {
        setNotice(
          `Marked ${updatedCount} notification${
            updatedCount === 1 ? "" : "s"
          } as read.`
        );
      } else {
        setNotice("Everything is already up to date.");
      }
    } catch (err) {
      setError(err?.message || "Could not mark all notifications as read.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function handleOpenTarget(notification) {
    const target = getNotificationTarget(notification, user);

    if (!target?.href) {
      return;
    }

    if (
      target.requiresClinicContext &&
      user?.role === "super_admin" &&
      !target.clinicSelection
    ) {
      setError(
        "This notification does not include clinic context, so the related clinic workspace cannot be opened safely yet."
      );
      setNotice("");
      return;
    }

    try {
      setBusyNavigationId(notification.id);
      setError("");
      setNotice("");

      if (
        target.requiresClinicContext &&
        user?.role === "super_admin" &&
        target.clinicSelection
      ) {
        safeSetAdminClinic(target.clinicSelection);
      }

      router.push(target.href);
    } finally {
      setBusyNavigationId(null);
    }
  }

  if (isBootstrapping) {
    return (
      <PagePlaceholder
        title="Loading notifications"
        description="Checking your session and preparing your notification inbox."
        points={[
          "Verifying signed-in access",
          "Loading unread count",
          "Preparing your personal notification history",
        ]}
      />
    );
  }

  if (!user) {
    return (
      <PagePlaceholder
        title="Redirecting"
        description="You need to be signed in to view notifications."
        points={[
          "Session check completed",
          "Unauthenticated users return to login",
          "Role-specific inbox access stays protected",
        ]}
      />
    );
  }

  return (
    <div className="stack">
      <div className="page-header">
        <span className="small-label">{workspaceCopy.eyebrow}</span>
        <h1>Notifications</h1>
        <p className="muted">{workspaceCopy.description}</p>
      </div>

      {(error || notice) && (
        <div className={error ? "error-banner" : "notice-banner"}>
          {error || notice}
        </div>
      )}

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="small-label">Unread</span>
          <strong>{unreadCount}</strong>
          <p className="muted">Notifications that still need your attention.</p>
        </article>

        <article className="metric-card">
          <span className="small-label">Loaded now</span>
          <strong>{visibleNotifications.length}</strong>
          <p className="muted">
            Items shown in the current {activeFilter === "unread" ? "unread" : "all"} view.
          </p>
        </article>

        <article className="metric-card">
          <span className="small-label">Read</span>
          <strong>{readCount}</strong>
          <p className="muted">
            Notifications already cleared in this inbox.
          </p>
        </article>
      </section>

      <section className="page-card stack-sm">
        <div className="notifications-toolbar">
          <div
            className="notifications-filters"
            role="tablist"
            aria-label="Notification filters"
          >
            <button
              type="button"
              className={`notifications-filter ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              All
            </button>

            <button
              type="button"
              className={`notifications-filter ${activeFilter === "unread" ? "active" : ""}`}
              onClick={() => setActiveFilter("unread")}
            >
              Unread
            </button>
          </div>

          <div className="notifications-actions">
            <span className="small-label">
              Signed in as {getRoleLabel(user.role)}
            </span>

            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => loadNotifications({ refresh: true })}
              disabled={isLoading || isRefreshing || isMarkingAll}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="secondary-button compact-button"
              onClick={handleMarkAllAsRead}
              disabled={isLoading || isRefreshing || isMarkingAll || unreadCount === 0}
            >
              {isMarkingAll ? "Marking..." : "Mark all as read"}
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="page-card">
          <div className="empty-state">Loading notifications…</div>
        </section>
      ) : visibleNotifications.length === 0 ? (
        <section className="page-card">
          <div className="empty-state">
            {activeFilter === "unread"
              ? "You have no unread notifications right now."
              : "No notifications are available yet."}
          </div>
        </section>
      ) : (
        <section className="stack">
          {visibleNotifications.map((notification) => {
            const isBusy = Number(busyNotificationId) === Number(notification.id);
            const isNavigationBusy =
              Number(busyNavigationId) === Number(notification.id);
            const target = getNotificationTarget(notification, user);
            const isTargetBlocked =
              target?.requiresClinicContext &&
              user?.role === "super_admin" &&
              !target?.clinicSelection;

            return (
              <article
                key={notification.id}
                className={`page-card notification-card ${
                  notification.isRead ? "notification-card-read" : "notification-card-unread"
                }`}
              >
                <div className="notification-main">
                  <div className="notification-copy">
                    <div className="notification-topline">
                      <span className="small-label">
                        {humanizeToken(
                          notification.notificationType,
                          "Notification"
                        )}
                      </span>

                      <div className="notification-pill-row">
                        {notification.clinicName || notification.clinic_name ? (
                          <span className="status-pill">
                            {notification.clinicName || notification.clinic_name}
                          </span>
                        ) : null}

                        <span
                          className={`status-pill ${
                            notification.isRead ? "done" : "pending"
                          }`}
                        >
                          {notification.isRead ? "Read" : "Unread"}
                        </span>
                      </div>
                    </div>

                    <h3 className="notification-title">
                      {notification.title || "Untitled notification"}
                    </h3>

                    <p className="muted notification-message">
                      {notification.message ||
                        "No message provided for this notification."}
                    </p>

                    <div className="notification-meta">
                      <span>{getEntityMeta(notification)}</span>
                      <span>Created {formatDateTime(notification.createdAt)}</span>
                      {notification.readAt ? (
                        <span>Read {formatDateTime(notification.readAt)}</span>
                      ) : null}
                    </div>

                    {isTargetBlocked ? (
                      <p className="muted notification-link-hint">
                        This alert points to a clinic-scoped admin page, but the
                        notification payload does not include enough clinic context
                        to open that workspace safely.
                      </p>
                    ) : null}
                  </div>

                  <div className="notification-actions-column">
                    {target ? (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => handleOpenTarget(notification)}
                        disabled={isNavigationBusy || isMarkingAll || isTargetBlocked}
                      >
                        {isNavigationBusy ? "Opening..." : target.label}
                      </button>
                    ) : (
                      <span className="small-label">No linked page</span>
                    )}

                    {!notification.isRead ? (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={isBusy || isMarkingAll || isNavigationBusy}
                      >
                        {isBusy ? "Saving..." : "Mark as read"}
                      </button>
                    ) : (
                      <span className="small-label">Already handled</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <style jsx>{`
        .notifications-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .notifications-filters {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .notifications-filter {
          border: 1px solid var(--border-strong);
          background: transparent;
          color: var(--text);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .notifications-filter:hover {
          background: var(--surface-soft);
          border-color: var(--accent);
        }

        .notifications-filter.active {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }

        .notifications-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .notification-card {
          border: 1px solid var(--border);
          background: var(--surface);
        }

        .notification-card-unread {
          box-shadow: 0 0 0 1px var(--focus-ring);
        }

        .notification-card-read {
          opacity: 0.95;
        }

        .notification-main {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          flex-wrap: wrap;
        }

        .notification-copy {
          flex: 1 1 560px;
          min-width: 0;
          display: grid;
          gap: 12px;
        }

        .notification-topline {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .notification-pill-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .notification-title {
          margin: 0;
          font-size: 1.1rem;
        }

        .notification-message {
          margin: 0;
        }

        .notification-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          color: var(--muted);
          font-size: 13px;
        }

        .notification-link-hint {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
        }

        .notification-actions-column {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          min-width: 180px;
        }

        @media (max-width: 860px) {
          .notification-actions-column {
            align-items: flex-start;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}