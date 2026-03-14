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
    fullName:
      rawUser.full_name ||
      rawUser.fullName ||
      rawUser.name ||
      "",
    email: rawUser.email || "",
    role: rawUser.role,
    clinicId: rawUser.clinic_id ?? rawUser.clinicId ?? null,
    clinicName:
      rawUser.clinic_name ||
      rawUser.clinicName ||
      rawUser.clinic?.name ||
      "",
    status: rawUser.status || "",
  };
}
