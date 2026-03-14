import PagePlaceholder from "../../../components/shared/pagePlaceHolder";

export default function AppointmentsPage() {
  return (
    <PagePlaceholder
      title="Appointments"
      description="This page will become the appointment workflow surface."
      points={[
        "Upcoming appointments list",
        "Create and update appointment flow",
        "Appointment status guidance",
        "Review-related next actions later",
      ]}
    />
  );
}
