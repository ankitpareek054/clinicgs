"use client";

import Link from "next/link";
import { useState } from "react";
import ThemeToggle from "../../../components/shared/themeToggle";
import { requestPasswordReset } from "../../../lib/auth/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setPageError("");
    setIsSuccess(false);
    setIsSubmitting(true);

    try {
      await requestPasswordReset({ email });
      setIsSuccess(true);
    } catch (err) {
      setPageError(err.message || "Could not send password reset link.");
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
            <h1>Forgot your password?</h1>
            <p className="muted">
              Enter your email address and we will send you a reset link if your account exists.
            </p>
          </div>

          {pageError && <div className="error-banner">{pageError}</div>}

          {isSuccess && (
            <div className="success-banner">
              If the email exists in our system, a password reset link has been sent.
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Sending link…" : "Send reset link"}
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