"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDefaultAppPath } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";
import ThemeToggle from "../../../components/shared/themeToggle";

const demoAccounts = [
  { label: "Super Admin", email: "super@gamil.com", password: "Ankit@1234" },
  { label: "Owner", email: "owner@gamil.com", password: "Ankit@1234" },
  {
    label: "Receptionist",
    email: "receptionist@gamil.com",
    password: "Ankit@1234",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const {
    login,
    user,
    isAuthenticated,
    isBootstrapping,
    error: sessionError,
  } = useAuth();

  const [form, setForm] = useState({
    email: "receptionist@gamil.com",
    password: "Ankit@1234",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!isBootstrapping && isAuthenticated && user) {
      router.replace(getDefaultAppPath(user));
    }
  }, [isAuthenticated, isBootstrapping, router, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setPageError("");
    setIsSubmitting(true);

    try {
      const loggedInUser = await login(form);
      router.replace(getDefaultAppPath(loggedInUser));
      router.refresh();
    } catch (err) {
      setPageError(err.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemoAccount(account) {
    setForm({
      email: account.email,
      password: account.password,
    });
    setPageError("");
  }

  if (isBootstrapping) {
    return (
      <div className="auth-screen">
        <div className="floating-theme-control">
          <ThemeToggle />
        </div>

        <div className="auth-card premium-panel">
          <h1>Clinic GS</h1>
          <p className="muted">Checking for an existing login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="floating-theme-control">
        <ThemeToggle />
      </div>

      <div className="auth-card premium-panel">
        <div className="stack">
          <div className="auth-hero">
            <span className="eyebrow">Clinic operations</span>
            <h1>Welcome back</h1>
            <p className="muted">
              Login to manage leads, follow-ups, and appointments from one
              place.
            </p>
          </div>

          {(pageError || sessionError) && (
            <div className="error-banner">{pageError || sessionError}</div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="field">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <label htmlFor="password">Password</label>
                <Link href="/forgot-password" className="text-link">
                  Forgot password?
                </Link>
              </div>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                required
              />
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging in…" : "Login"}
            </button>
          </form>

          <section className="page-card soft-card">
            <h2>Quick fill seeded accounts</h2>

            <div className="demo-account-grid">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="secondary-button demo-account-button"
                  onClick={() => fillDemoAccount(account)}
                >
                  <strong>{account.label}</strong>
                  <span>{account.email}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
