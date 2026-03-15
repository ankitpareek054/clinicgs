"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getRoleLabel, isOwnerLike } from "../../lib/auth/auth";
import { useAuth } from "../../providers/sessionProvider";
import ThemeToggle from "../shared/themeToggle";

const receptionistNav = [
  { href: "/my-tasks", label: "My Tasks" },
  { href: "/leads", label: "Leads" },
  { href: "/appointments", label: "Appointments" },
  { href: "/followups", label: "Follow Ups" },
];

const ownerNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/my-tasks", label: "My Tasks" },
  { href: "/leads", label: "Leads" },
  { href: "/appointments", label: "Appointments" },
  { href: "/followups", label: "Follow Ups" },
];

export default function ProtectedShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isBootstrapping, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isBootstrapping, isAuthenticated, router]);

  const navItems = useMemo(() => {
    if (!user) return [];
    return isOwnerLike(user) ? ownerNav : receptionistNav;
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

  const clinicDisplayName = user.clinicName?.trim() || "Clinic workspace";
  const userDisplayName = user.fullName || user.email;

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

        <div className="sidebar-section-label">----------- Workspace -----------</div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

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
        </nav>

        <div className="sidebar-footer page-card soft-card premium-panel signed-card">
          <span className="sidebar-subtitle signed-label">Signed in</span>
          <strong className="signed-clinic">{clinicDisplayName}</strong>

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
            <div className="topbar-title topbar-clinic-name">
              {clinicDisplayName}
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

  .nav-list {
    margin-bottom: 20px;
  }

  .signed-card {
    gap: 0;
    padding: 16px;
    overflow: visible;
   // margin-top: auto !important;
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
    //border-radius: 12px;
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

  .topbar-clinic-name {
    margin: 0;
    line-height: 1.1;
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