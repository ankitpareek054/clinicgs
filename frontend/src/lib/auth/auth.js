import { api, extractApiData } from "../api/api";

export function isOwnerLike(user) {
  return user?.role === "owner" || user?.role === "super_admin";
}

export function getDefaultAppPath(user) {
  if (!user) return "/login";

  if (user.role === "receptionist") {
    return "/my-tasks";
  }

  return "/dashboard";
}

export function getRoleLabel(role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "owner") return "Owner";
  if (role === "receptionist") return "Receptionist";
  return "User";
}

export function normalizeSessionPayload(payload) {
  const rawUser =
    payload?.data?.user ||
    payload?.user ||
    payload?.data ||
    payload?.currentUser ||
    payload;

  if (!rawUser || typeof rawUser !== "object") {
    return null;
  }

  if (!rawUser.id || !rawUser.role) {
    return null;
  }

  return {
    id: rawUser.id,
    fullName: rawUser.full_name || rawUser.fullName || rawUser.name || "",
    email: rawUser.email || "",
    role: rawUser.role,
    clinicId: rawUser.clinic_id ?? rawUser.clinicId ?? null,
    clinicName:
      rawUser.clinic_name ||
      rawUser.clinicName ||
      rawUser.clinic?.name ||
      "",
    status: rawUser.status || "",
    mustResetPassword:
      rawUser.must_reset_password ??
      rawUser.mustResetPassword ??
      false,
  };
}

export async function getInviteByToken(token) {
  const payload = await api.get(`/auth/invites/${encodeURIComponent(token)}`);
  return extractApiData(payload, null);
}

export async function acceptInvite(input) {
  const payload = await api.post("/auth/invites/accept", input);
  return normalizeSessionPayload(extractApiData(payload, null));
}

export async function requestPasswordReset(input) {
  const payload = await api.post("/auth/password/forgot", {
    email: String(input?.email || "").trim(),
  });

  return extractApiData(payload, { success: true });
}

export async function resetPassword(input) {
  const payload = await api.post("/auth/password/reset", {
    token: String(input?.token || "").trim(),
    password: input?.password || "",
    confirmPassword: input?.confirmPassword || "",
  });

  return extractApiData(payload, { success: true });
}