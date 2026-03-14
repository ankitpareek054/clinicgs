"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PagePlaceholder from "../../../components/shared/pagePlaceHolder";
import { isOwnerLike } from "../../../lib/auth/auth";
import { useAuth } from "../../../providers/sessionProvider";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  useEffect(() => {
    if (!isBootstrapping && user && !isOwnerLike(user)) {
      router.replace("/my-tasks");
    }
  }, [isBootstrapping, router, user]);

  if (!user || !isOwnerLike(user)) {
    return (
      <div className="page-card">
        <h2>Redirecting…</h2>
        <p className="muted">Dashboard is owner-first, so this user is being sent to My Tasks.</p>
      </div>
    );
  }

  return (
    <PagePlaceholder
      title="Dashboard"
      description="This will become the owner clinic control center."
      points={[
        "Leads today / week / month",
        "Pipeline distribution",
        "Overdue follow-ups",
        "Appointments today and upcoming",
        "No-shows, reviews, and source breakdown",
      ]}
    />
  );
}
