import PagePlaceholder from "../../../components/shared/pagePlaceHolder";

export default function MyTasksPage() {
  return (
    <PagePlaceholder
      title="My Tasks"
      description="This is the receptionist’s working cockpit. It will become the daily work queue."
      points={[
        "Overdue follow-ups",
        "Due today follow-ups",
        "Upcoming appointments",
        "Optional unassigned lead pickup",
      ]}
    />
  );
}
