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

        <div className="sidebar-section-label">Workspace</div>

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

        <div className="sidebar-footer page-card soft-card premium-panel">
          <span className="eyebrow">Signed in</span>
          <strong>{user.clinicName ? user.clinicName : "Clinic workspace"}</strong>
          <p className="muted sidebar-footer-copy">
            {getRoleLabel(user.role)} access for clinic-side workflows.
          </p>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="eyebrow">Clinic-side workspace</span>
            <div className="topbar-title">Clinic GS</div>
            <div className="topbar-subtitle">
              {user.clinicName ? user.clinicName : "Clinic workspace"}
            </div>
          </div>

          <div className="topbar-right">
            <ThemeToggle compact />

            <div className="user-chip">
              <strong>{user.fullName || user.email}</strong>
              <span className="muted">{getRoleLabel(user.role)}</span>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Logging out…" : "Logout"}
            </button>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}