import { api, buildQuery, extractApiData } from "../api/api";

export async function listUsers(filters = {}) {
  const payload = await api.get(`/users${buildQuery(filters)}`);
  return extractApiData(payload, []) || [];
}
