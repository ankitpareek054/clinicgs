const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function getTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function formatDate(value) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

export function toIsoFromLocalInput(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function formatDateTimeInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function addMinutesToLocalInput(value, minutes) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function isDateToday(value, reference = new Date()) {
  if (!value) return false;
  const date = new Date(value);

  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function sortByDateAsc(items, getter) {
  return [...items].sort((a, b) => getTimestamp(getter(a)) - getTimestamp(getter(b)));
}

export function sortByDateDesc(items, getter) {
  return [...items].sort((a, b) => getTimestamp(getter(b)) - getTimestamp(getter(a)));
}
