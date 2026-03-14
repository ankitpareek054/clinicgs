import { api, buildQuery, extractApiData } from "../api/api";

export const followupStatusOptions = ["pending", "done", "skipped"];

export async function listFollowups(filters = {}) {
  const payload = await api.get(`/followups${buildQuery(filters)}`);
  return extractApiData(payload, []) || [];
}

export async function createFollowup(input) {
  const payload = await api.post("/followups", input);
  return extractApiData(payload);
}

export async function updateFollowup(followupId, input) {
  const payload = await api.patch(`/followups/${followupId}`, input);
  return extractApiData(payload);
}

export async function updateFollowupStatus(followupId, input) {
  const payload = await api.patch(`/followups/${followupId}/status`, input);
  return extractApiData(payload);
}
