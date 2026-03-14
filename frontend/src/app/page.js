"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultAppPath } from "../lib/auth/auth";
import { useAuth } from "../providers/sessionProvider";

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    if (isBootstrapping) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    router.replace(getDefaultAppPath(user));
  }, [isAuthenticated, isBootstrapping, router, user]);

  return (
    <div className="loading-screen">
      <div className="page-card">
        <h2>Opening Clinic GS…</h2>
        <p className="muted">Sending you to the right page for your role.</p>
      </div>
    </div>
  );
}
