function StatusBadge({ status }) {

  const colors = {
    new: "#3b82f6",
    contacted: "#f59e0b",
    booked: "#10b981",
    completed: "#6366f1",
    closed: "#6b7280",
    no_show: "#ef4444"
  };

  return (
    <span
      style={{
        background: colors[status] || "#999",
        color: "white",
        padding: "4px 8px",
        borderRadius: "6px",
        fontSize: "12px",
        textTransform: "capitalize"
      }}
    >
      {status}
    </span>
  );
}

export default StatusBadge;