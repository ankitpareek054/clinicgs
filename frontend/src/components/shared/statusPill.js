function humanizeStatus(value) {
  if (!value) return "Unknown";

  return value
    .split("_")
    .join(" ")
    .split("-")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StatusPill({ status }) {
  const className = (status || "unknown").replaceAll("_", "-");

  return (
    <span className={`status-pill ${className}`}>
      {humanizeStatus(status)}
    </span>
  );
}
