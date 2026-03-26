import { api, buildQuery, extractApiData } from "../api/api";

export const leadPipelineOptions = [
  "new",
  "contacted",
  "booked",
  "rescheduled",
  "completed",
  "review_pending",
  "no_show",
  "not_interested",
  "cancelled",
];

function normalizeDuplicateWarningsResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.groups)) return data.groups;
  if (Array.isArray(data?.duplicateWarnings)) return data.duplicateWarnings;
  return [];
}

export async function listLeads(filters = {}) {
  const payload = await api.get(`/leads${buildQuery(filters)}`);
  return extractApiData(payload, []) || [];
}

export async function listDuplicateWarnings(filters = {}) {
  const payload = await api.get(`/leads/duplicates${buildQuery(filters)}`);
  const data = extractApiData(payload, []);
  return normalizeDuplicateWarningsResponse(data);
}

export async function getLeadById(leadId) {
  const payload = await api.get(`/leads/${leadId}`);
  return extractApiData(payload);
}

export async function createLead(input) {
  const payload = await api.post("/leads", input);
  return extractApiData(payload);
}

export async function updateLead(leadId, input) {
  const payload = await api.patch(`/leads/${leadId}`, input);
  return extractApiData(payload);
}

export async function assignLeadToSelf(leadId) {
  const payload = await api.post(`/leads/${leadId}/assign-self`, {});
  return extractApiData(payload);
}

export async function unassignLeadFromSelf(leadId) {
  const payload = await api.post(`/leads/${leadId}/unassign-self`, {});
  return extractApiData(payload);
}