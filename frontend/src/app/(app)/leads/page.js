import PagePlaceholder from "../../../components/shared/pagePlaceHolder";

export default function LeadsPage() {
  return (
    <PagePlaceholder
      title="Leads"
      description="This page will become the main lead management table."
      points={[
        "Table-driven lead list",
        "Filters by status, assignment, and source",
        "Role-aware default views",
        "Duplicate and assignment indicators",
      ]}
    />
  );
}
