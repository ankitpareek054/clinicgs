
"use client";



import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";

import { useEffect, useMemo, useState } from "react";

import { getDefaultAppPath, getRoleLabel, isOwnerLike } from "../../lib/auth/auth";

import { useAuth } from "../../providers/sessionProvider";

import ThemeToggle from "../shared/themeToggle";



const ADMIN_CLINIC_SELECTION_FALLBACK_PATH = "/clinics";



const RECEPTIONIST_NAV_GROUPS = [

  {

    key: "daily-work",

    label: "Workspace",

    items: [

      { href: "/my-tasks", label: "My Tasks" },

      { href: "/notifications", label: "Notifications" },

      { href: "/support", label: "Support" },

      { href: "/leads", label: "Leads" },

      { href: "/appointments", label: "Appointments" },

      { href: "/followups", label: "Follow Ups" },

    ],

  },

];



const OWNER_NAV_GROUPS = [

  {

    key: "owner-overview",

    label: "Clinic Overview",

    items: [

      { href: "/dashboard", label: "Dashboard" },

      { href: "/notifications", label: "Notifications" },

      { href: "/support", label: "Support" },

      { href: "/staff-requests", label: "Staff Requests" },

      { href: "/staff", label: "Staff" },

    ],

  },

  {

    key: "owner-clinic-control",

    label: "Clinic Setup",

    items: [

      { href: "/services", label: "Services" },

      { href: "/clinic-profile", label: "Clinic Profile" },

      { href: "/clinic-settings", label: "Operational Settings" },

      { href: "/integrations", label: "Integrations" },

    ],

  },

  {

    key: "owner-ops",

    label: "Operations",

    items: [

      { href: "/my-tasks", label: "My Tasks" },

      { href: "/leads", label: "Leads" },

      { href: "/appointments", label: "Appointments" },

      { href: "/followups", label: "Follow Ups" },

    ],

  },

];



const SUPER_ADMIN_NAV_GROUPS = [

  {

    key: "admin-command",

    label: "Command Center",

    items: [

      { href: "/dashboard", label: "Dashboard" },

      { href: "/clinics", label: "Clinics" },

      { href: "/notifications", label: "Notifications" },

    ],

  },

  {

    key: "admin-queues",

    label: "Operational Queues",

    items: [

      { href: "/staff-requests", label: "Staff Requests" },

      { href: "/support", label: "Support" },

    ],

  },

  {

    key: "admin-clinic-workspace",

    label: "Selected Clinic Workspace",

    items: [

      {

        href: "/clinic-profile",

        label: "Clinic Profile",

        requiresSelectedClinic: true,

      },

      {

        href: "/clinic-settings",

        label: "Operational Settings",

        requiresSelectedClinic: true,

      },

      {

        href: "/integrations",

        label: "Integrations",

        requiresSelectedClinic: true,

      },

      {

        href: "/staff",

        label: "Staff",

        requiresSelectedClinic: true,

      },

      {

        href: "/services",

        label: "Services",

        requiresSelectedClinic: true,

      },

    ],

  },

];



const RECEPTIONIST_ALLOWED_PREFIXES = [

  "/my-tasks",

  "/notifications",

  "/support",

  "/leads",

  "/appointments",

  "/followups",

];



const OWNER_ALLOWED_PREFIXES = [

  "/dashboard",

  "/notifications",

  "/support",

  "/staff-requests",

  "/staff",

  "/services",

  "/clinic-profile",

  "/clinic-settings",

  "/integrations",

  "/my-tasks",

  "/leads",

  "/appointments",

  "/followups",

];



const SUPER_ADMIN_ALLOWED_PREFIXES = [

  "/dashboard",

  "/clinics",

  "/notifications",

  "/staff-requests",

  "/support",

  "/clinic-profile",

  "/clinic-settings",

  "/integrations",

  "/staff",

  "/services",

];



const SUPER_ADMIN_SELECTED_CLINIC_REQUIRED_PREFIXES = [

  "/clinic-profile",

  "/clinic-settings",

  "/integrations",

  "/staff",

  "/services",

];



function formatClinicStatus(status) {

  if (!status) return "Status unknown";



  return String(status)

    .replace(/[_-]+/g, " ")

    .replace(/\s+/g, " ")

    .trim()

    .replace(/\b\w/g, (char) => char.toUpperCase());

}



function matchesRoutePrefix(pathname, href) {

  if (!pathname || !href) {

    return false;

  }



  return pathname === href || pathname.startsWith(`${href}/`);

}



function getAllowedPrefixesForUser(user) {

  if (!user) return [];



  if (user.role === "super_admin") {

    return SUPER_ADMIN_ALLOWED_PREFIXES;

  }



  if (isOwnerLike(user)) {

    return OWNER_ALLOWED_PREFIXES;

  }



  return RECEPTIONIST_ALLOWED_PREFIXES;

}



function routeRequiresSelectedClinic(pathname) {

  return SUPER_ADMIN_SELECTED_CLINIC_REQUIRED_PREFIXES.some((href) =>

    matchesRoutePrefix(pathname, href)

  );

}



export default function ProtectedShell({ children }) {

  const router = useRouter();

  const pathname = usePathname();

  const auth = useAuth();



  const {

    user,

    isAuthenticated,

    isBootstrapping,

    logout,

    selectedAdminClinic = null,

    adminWorkspaceMode = selectedAdminClinic ? "selected_clinic" : "all_clinics",

    clearAdminClinic,

  } = auth;



  const safeClearAdminClinic =

    typeof clearAdminClinic === "function" ? clearAdminClinic : () => {};



  const [isLoggingOut, setIsLoggingOut] = useState(false);



  const isSuperAdmin = user?.role === "super_admin";



  useEffect(() => {

    if (!isBootstrapping && !isAuthenticated) {

      router.replace("/login");

    }

  }, [isBootstrapping, isAuthenticated, router]);



  useEffect(() => {

    if (isBootstrapping || !isAuthenticated || !user || !pathname) {

      return;

    }



    const allowedPrefixes = getAllowedPrefixesForUser(user);

    const isAllowed = allowedPrefixes.some((href) => matchesRoutePrefix(pathname, href));



    if (!isAllowed) {

      router.replace(getDefaultAppPath(user));

      return;

    }



    if (

      user.role === "super_admin" &&

      routeRequiresSelectedClinic(pathname) &&

      !selectedAdminClinic

    ) {

      router.replace(ADMIN_CLINIC_SELECTION_FALLBACK_PATH);

    }

  }, [isBootstrapping, isAuthenticated, user, pathname, router, selectedAdminClinic]);



  const navGroups = useMemo(() => {

    if (!user) return [];



    if (user.role === "super_admin") {

      return SUPER_ADMIN_NAV_GROUPS;

    }



    if (isOwnerLike(user)) {

      return OWNER_NAV_GROUPS;

    }



    return RECEPTIONIST_NAV_GROUPS;

  }, [user]);



  async function handleLogout() {

    try {

      setIsLoggingOut(true);

      await logout();

      router.replace("/login");

      router.refresh();

    } finally {

      setIsLoggingOut(false);

    }

  }



  function handleClearAdminClinic() {

    safeClearAdminClinic();



    if (pathname && routeRequiresSelectedClinic(pathname)) {

      router.replace(ADMIN_CLINIC_SELECTION_FALLBACK_PATH);

    }

  }



  function isNavItemActive(href) {

    return matchesRoutePrefix(pathname, href);

  }



  function isNavItemDisabled(item) {

    if (item.disabled) {

      return true;

    }



    if (isSuperAdmin && item.requiresSelectedClinic && !selectedAdminClinic) {

      return true;

    }



    return false;

  }



  function getNavItemHelperText(item) {

    if (item.disabledReason) {

      return item.disabledReason;

    }



    if (isSuperAdmin && item.requiresSelectedClinic && !selectedAdminClinic) {

      return "Select a clinic first.";

    }



    return "";

  }



  if (isBootstrapping) {

    return (

      <div className="loading-screen">

        <div className="page-card premium-panel">

          <h2>Loading your session…</h2>

          <p className="muted">

            Checking who is logged in and which clinic they belong to.

          </p>

        </div>

      </div>

    );

  }



  if (!isAuthenticated || !user) {

    return null;

  }



  const workspaceDisplayName = isSuperAdmin

    ? selectedAdminClinic?.name || "All clinics workspace"

    : user.clinicName?.trim() || "Clinic workspace";



  const topbarTitle = isSuperAdmin

    ? selectedAdminClinic?.name || "Platform overview"

    : workspaceDisplayName;



  const topbarSubtitle = isSuperAdmin

    ? adminWorkspaceMode === "selected_clinic"

      ? selectedAdminClinic?.status

        ? `Selected clinic • ${formatClinicStatus(selectedAdminClinic.status)}`

        : "Selected clinic workspace"

      : "All clinics workspace"

    : getRoleLabel(user.role);



  const userDisplayName = user.fullName || user.email;

  const isClinicScopedAdminPage =

    isSuperAdmin && pathname ? routeRequiresSelectedClinic(pathname) : false;



  return (

    <div className="app-shell">

      <aside className="sidebar">

        <div className="sidebar-brand">

          <span className="brand-pill">CGS</span>



          <div>

            <div className="sidebar-title">Clinic GS</div>

            <div className="sidebar-subtitle">Clinic growth system</div>

          </div>

        </div>



        <div className="sidebar-section-label">

          {isSuperAdmin

            ? "----------- Platform -----------"

            : "----------- Workspace -----------"}

        </div>



        <nav className="nav-section-list">

          {navGroups.map((group) => (

            <div key={group.key} className="nav-group">

              <div className="nav-group-label">{group.label}</div>



              <div className="nav-list">

                {group.items.map((item) => {

                  const isActive = isNavItemActive(item.href);

                  const isDisabled = isNavItemDisabled(item);

                  const helperText = getNavItemHelperText(item);



                  if (isDisabled) {

                    return (

                      <div key={item.href} className="nav-disabled-wrap">

                        <span

                          className={`nav-link nav-link-disabled ${isActive ? "active" : ""}`}

                          aria-disabled="true"

                          title={helperText || item.label}

                        >

                          {item.label}

                        </span>



                        {helperText ? (

                          <span className="nav-helper-text">{helperText}</span>

                        ) : null}

                      </div>

                    );

                  }



                  return (

                    <Link

                      key={item.href}

                      href={item.href}

                      className={`nav-link ${isActive ? "active" : ""}`}

                    >

                      {item.label}

                    </Link>

                  );

                })}

              </div>

            </div>

          ))}

        </nav>



        {isSuperAdmin ? (

          <div className="page-card soft-card premium-panel admin-context-card">

            <span className="sidebar-subtitle signed-label">

              Admin clinic context

            </span>



            <strong className="signed-clinic">

              {selectedAdminClinic?.name || "All clinics"}

            </strong>



            <span className="muted admin-context-copy">

              {selectedAdminClinic

                ? selectedAdminClinic.status

                  ? `Scoped to one clinic • ${formatClinicStatus(

                      selectedAdminClinic.status

                    )}`

                  : "Scoped to one clinic"

                : "Platform-wide mode across every clinic"}

            </span>



            {selectedAdminClinic?.city ? (

              <span className="muted admin-context-copy">

                {selectedAdminClinic.city}

              </span>

            ) : null}



            {!selectedAdminClinic ? (

              <span className="muted admin-context-hint">

                Open Clinics to choose the active clinic for clinic-scoped admin pages.

                Platform-wide pages stay usable even when no clinic is selected.

              </span>

            ) : null}



            <button

              type="button"

              className="admin-context-button"

              onClick={handleClearAdminClinic}

              disabled={!selectedAdminClinic}

            >

              {selectedAdminClinic ? "Clear selected clinic" : "All clinics active"}

            </button>

          </div>

        ) : null}



        <div className="sidebar-footer page-card soft-card premium-panel signed-card">

          <span className="sidebar-subtitle signed-label">Signed in</span>

          <strong className="signed-clinic">{workspaceDisplayName}</strong>



          <strong className="signed-user">{userDisplayName}</strong>

          <span className="muted signed-role">{getRoleLabel(user.role)}</span>



          <button

            type="button"

            className="signed-logout-button"

            onClick={handleLogout}

            disabled={isLoggingOut}

          >

            {isLoggingOut ? "Logging out…" : "Logout"}

          </button>

        </div>

      </aside>



      <div className="shell-main">

        <header className="topbar">

          <div className="topbar-copy topbar-clinic-only">

            <div className="topbar-heading">

              <div className="topbar-title topbar-clinic-name">{topbarTitle}</div>

              <div className="topbar-subtitle">

                {isClinicScopedAdminPage && !selectedAdminClinic

                  ? "Select a clinic from Clinics to open this workspace."

                  : topbarSubtitle}

              </div>

            </div>

          </div>



          <div className="topbar-right">

            <ThemeToggle compact />

          </div>

        </header>



        <main className="page">{children}</main>

      </div>



      <style jsx global>{`

        .app-shell {

          align-items: start;

        }



        .sidebar {

          position: sticky;

          top: 0;

          align-self: start;

          height: 100vh;

          overflow-y: auto;

          scrollbar-width: none;

          -ms-overflow-style: none;

        }



        .sidebar::-webkit-scrollbar {

          width: 0;

          height: 0;

          display: none;

        }



        .shell-main {

          min-width: 0;

          min-height: 100vh;

        }



        .nav-section-list {

          display: grid;

          gap: 18px;

          margin-bottom: 20px;

        }



        .nav-group {

          display: grid;

          gap: 10px;

        }



        .nav-group-label {

          font-size: 11px;

          font-weight: 700;

          letter-spacing: 0.12em;

          text-transform: uppercase;

          color: var(--sidebar-muted, rgba(255, 255, 255, 0.68));

          padding: 0 6px;

        }



        .nav-list {

          display: grid;

          gap: 8px;

        }



        .nav-disabled-wrap {

          display: grid;

          gap: 4px;

        }



        .nav-link-disabled {

          opacity: 0.62;

          cursor: default;

          pointer-events: none;

        }



        .nav-helper-text {

          padding: 0 10px;

          font-size: 11px;

          line-height: 1.35;

          color: var(--sidebar-muted, rgba(255, 255, 255, 0.68));

        }



        .admin-context-card {

          gap: 0;

          padding: 16px;

          margin: 0 2px 16px;

          overflow: visible;

        }



        .admin-context-copy {

          display: block;

          line-height: 1.35;

          margin-bottom: 8px;

          word-break: break-word;

        }



        .admin-context-hint {

          display: block;

          line-height: 1.35;

          margin-bottom: 12px;

          word-break: break-word;

        }



        .admin-context-button {

          width: 100%;

          min-height: 42px;

          padding: 11px 14px;

          border: 1px solid rgba(255, 255, 255, 0.16);

          background: rgba(255, 255, 255, 0.08);

          color: #ffffff;

          font-weight: 700;

          letter-spacing: 0.01em;

          transition:

            transform 0.18s ease,

            background 0.18s ease,

            border-color 0.18s ease;

          cursor: pointer;

        }



        .admin-context-button:hover:not(:disabled) {

          transform: translateY(-1px);

          background: rgba(255, 255, 255, 0.12);

          border-color: rgba(255, 255, 255, 0.22);

        }



        .admin-context-button:disabled {

          opacity: 0.76;

          cursor: default;

          transform: none;

        }



        .signed-card {

          gap: 0;

          padding: 16px;

          overflow: visible;

          margin-bottom: -20px;

          margin-left: 2px;

          margin-right: 2px;

          align-self: stretch;

        }



        .signed-label {

          display: block;

          margin-bottom: 8px;

        }



        .signed-clinic {

          display: block;

          color: var(--sidebar-text, #ffffff);

          line-height: 1.3;

          margin-bottom: 10px;

          word-break: break-word;

        }



        .signed-user {

          display: block;

          color: var(--sidebar-text, #ffffff);

          opacity: 0.92;

          line-height: 1.3;

          margin-bottom: 4px;

          word-break: break-word;

        }



        .signed-role {

          display: block;

          margin-bottom: 14px;

        }



        .signed-logout-button {

          width: 100%;

          min-height: 46px;

          padding: 12px 16px;

          border: 1px solid rgba(255, 255, 255, 0.16);

          background: linear-gradient(

            180deg,

            rgba(255, 255, 255, 0.14) 0%,

            rgba(255, 255, 255, 0.08) 100%

          );

          color: #ffffff;

          font-weight: 800;

          letter-spacing: 0.02em;

          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);

          transition:

            transform 0.18s ease,

            background 0.18s ease,

            border-color 0.18s ease,

            box-shadow 0.18s ease;

          cursor: pointer;

        }



        .signed-logout-button:hover:not(:disabled) {

          transform: translateY(-1px);

          background: linear-gradient(

            180deg,

            rgba(255, 255, 255, 0.2) 0%,

            rgba(255, 255, 255, 0.11) 100%

          );

          border-color: rgba(255, 255, 255, 0.22);

          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);

        }



        .signed-logout-button:disabled {

          opacity: 0.78;

          cursor: not-allowed;

          transform: none;

        }



        .topbar-clinic-only {

          display: flex;

          align-items: center;

          min-width: 0;

        }



        .topbar-heading {

          min-width: 0;

        }



        .topbar-clinic-name {

          margin: 0;

          line-height: 1.1;

          word-break: break-word;

        }



        .topbar-subtitle {

          margin-top: 6px;

          color: var(--muted);

          font-size: 0.92rem;

          line-height: 1.35;

          word-break: break-word;

        }



        html[data-theme="light"] .signed-logout-button {

          background: linear-gradient(

            180deg,

            rgba(255, 255, 255, 0.18) 0%,

            rgba(255, 255, 255, 0.1) 100%

          );

          color: #ffffff;

        }



        html[data-theme="dark"] .signed-logout-button {

          background: linear-gradient(

            180deg,

            rgba(255, 255, 255, 0.12) 0%,

            rgba(255, 255, 255, 0.06) 100%

          );

          color: #ffffff;

        }



        .drawer-panel {

          overflow-y: auto;

          scrollbar-width: none;

          -ms-overflow-style: none;

        }



        .drawer-panel::-webkit-scrollbar {

          width: 0;

          height: 0;

          display: none;

        }

      `}</style>

    </div>

  );

}

