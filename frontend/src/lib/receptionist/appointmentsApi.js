import { api, buildQuery, extractApiData } from "../api/api";

export const appointmentStatusOptions = [
  "booked",
  "rescheduled",
  "completed",
  "no_show",
  "cancelled",
];

export async function listAppointments(filters = {}) {
  const payload = await api.get(`/appointments${buildQuery(filters)}`);
  return extractApiData(payload, []) || [];
}

export async function createAppointment(input) {
  const payload = await api.post("/appointments", input);
  return extractApiData(payload);
}

export async function updateAppointment(appointmentId, input) {
  const payload = await api.patch(`/appointments/${appointmentId}`, input);
  return extractApiData(payload);
}
