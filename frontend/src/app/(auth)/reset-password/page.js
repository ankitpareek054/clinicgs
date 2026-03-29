"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "../../../components/shared/themeToggle";
import { resetPassword } from "../../../lib/auth/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setPageError("");
    setIsSuccess(false);

    if (!token) {
      setPageError("Reset link is invalid or missing.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setPageError("Password and confirm password must match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({
        token,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      setIsSuccess(true);
      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (err) {
      setPageError(err.message || "Could not reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="floating-theme-control">
        <ThemeToggle />
      </div>

      <div className="auth-card premium-panel">
        <div className="stack">
          <div className="auth-hero">
            <span className="eyebrow">Account recovery</span>
            <h1>Set a new password</h1>
            <p className="muted">
              Choose a strong password for your account.
            </p>
          </div>

          {pageError && <div className="error-banner">{pageError}</div>}

          {isSuccess && (
            <div className="success-banner">
              Password reset successful. Redirecting to login…
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
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

            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                required
              />
            </div>

            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Updating password…" : "Reset password"}
            </button>
          </form>

          <div className="auth-footer-links">
            <Link href="/login" className="text-link">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}