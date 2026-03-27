

"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import PagePlaceholder from "../../../components/shared/pagePlaceHolder";

import { api, buildQuery, extractApiData } from "../../../lib/api/api";

import { isOwnerLike } from "../../../lib/auth/auth";

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



export default function NotificationsPage() {

  const router = useRouter();

  const { user, isBootstrapping } = useAuth();



  const [notifications, setNotifications] = useState([]);

  const [unreadCount, setUnreadCount] = useState(0);

  const [activeFilter, setActiveFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [busyNotificationId, setBusyNotificationId] = useState(null);

  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");



  useEffect(() => {

    if (!isBootstrapping && user && !isOwnerLike(user)) {

      router.replace("/my-tasks");

    }

  }, [isBootstrapping, router, user]);



  const visibleNotifications = useMemo(() => {

    if (activeFilter === "unread") {

      return notifications.filter((notification) => !notification.isRead);

    }



    return notifications;

  }, [activeFilter, notifications]);



  const loadNotifications = useCallback(

    async ({ refresh = false } = {}) => {

      if (!user?.id || !isOwnerLike(user)) {

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

          api.get(`/notifications/unread-count`),

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

    if (!isBootstrapping && user && isOwnerLike(user)) {

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



  if (isBootstrapping) {

    return (

      <PagePlaceholder

        title="Loading notifications"

        description="Checking your owner session and preparing your clinic notifications."

        points={[

          "Verifying owner access",

          "Loading unread count",

          "Preparing notification history",

        ]}

      />

    );

  }



  if (!user || !isOwnerLike(user)) {

    return (

      <PagePlaceholder

        title="Redirecting"

        description="Notifications in this owner workspace are only available to owner-like users."

        points={[

          "Receptionists continue in My Tasks",

          "Owner-side pages stay clinic focused",

          "Existing routing behavior stays intact",

        ]}

      />

    );

  }



  return (

    <div className="stack">

      <div className="page-header">

        <span className="small-label">Owner workspace</span>

        <h1>Notifications</h1>

        <p className="muted">

          Review clinic updates, stay on top of unread items, and clear your

          queue without leaving the current workflow.

        </p>

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

                        {humanizeToken(notification.notificationType, "Notification")}

                      </span>



                      <span

                        className={`status-pill ${

                          notification.isRead ? "done" : "pending"

                        }`}

                      >

                        {notification.isRead ? "Read" : "Unread"}

                      </span>

                    </div>



                    <h3 className="notification-title">

                      {notification.title || "Untitled notification"}

                    </h3>



                    <p className="muted notification-message">

                      {notification.message || "No message provided for this notification."}

                    </p>



                    <div className="notification-meta">

                      <span>{getEntityMeta(notification)}</span>

                      <span>Created {formatDateTime(notification.createdAt)}</span>

                      {notification.readAt ? (

                        <span>Read {formatDateTime(notification.readAt)}</span>

                      ) : null}

                    </div>

                  </div>



                  <div className="notification-actions-column">

                    {!notification.isRead ? (

                      <button

                        type="button"

                        className="secondary-button compact-button"

                        onClick={() => handleMarkAsRead(notification.id)}

                        disabled={isBusy || isMarkingAll}

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



        .notification-actions-column {

          display: flex;

          flex-direction: column;

          align-items: flex-end;

          gap: 10px;

          min-width: 160px;

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