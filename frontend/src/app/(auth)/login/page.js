"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDefaultAppPath } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

const demoAccounts = [
  { label: "Super Admin", email: "super@gamil.com", password: "Ankit@1234" },
  { label: "Owner", email: "owner@gamil.com", password: "Ankit@1234" },
  { label: "Receptionist", email: "receptionist@gamil.com", password: "Ankit@1234" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isAuthenticated, isBootstrapping, error: sessionError } = useAuth();

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

  if (isBootstrapping) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Clinic GS</h1>
          <p className="muted">Checking for an existing login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="stack">
          <div>
            <h1>Login</h1>
            <p className="muted">
              This is the first real frontend flow: login, current user, protected app area, and logout.
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
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                required
              />
            </div>

            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Logging in…" : "Login"}
            </button>
          </form>

          <section className="page-card">
            <h2>Seeded test accounts</h2>
            <ul className="credentials-list">
              {demoAccounts.map((account) => (
                <li key={account.email}>
                  <strong>{account.label}:</strong> {account.email} / {account.password}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
