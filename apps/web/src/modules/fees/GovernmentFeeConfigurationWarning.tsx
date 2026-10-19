export function GovernmentFeeConfigurationWarning({
  studentCount,
}: {
  studentCount: number;
}) {
  if (studentCount <= 0) return null;

  return (
    <div
      role="alert"
      style={{
        padding: "12px 16px",
        marginBottom: 16,
        border: "1px solid #f59e0b",
        borderRadius: 8,
        background: "#fffbeb",
        color: "#92400e",
      }}
    >
      Government tuition is not configured for {studentCount} active Government
      student{studentCount === 1 ? "" : "s"}. These students are excluded from
      fee totals and defaulter calculations. Configure Government tuition under
      Admin &gt; Fee Types.
    </div>
  );
}
