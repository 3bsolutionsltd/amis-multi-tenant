import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAlumniRecord } from "./alumni.api";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DetailRow,
  SecondaryBtn,
} from "../../lib/ui";

export function AlumniDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: alumni,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["alumni", id],
    queryFn: () => getAlumniRecord(id!),
    enabled: !!id,
  });

  if (isLoading) return <Spinner />;
  if (error || !alumni) {
    return (
      <div>
        <PageHeader title="Alumni" />
        <div style={{ color: "#dc2626", marginTop: 16 }}>
          Alumni record not found.
        </div>
        <SecondaryBtn onClick={() => navigate("/alumni")} style={{ marginTop: 12 }}>
          Back to Alumni
        </SecondaryBtn>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${alumni.first_name} ${alumni.last_name}`}
        action={
          <SecondaryBtn onClick={() => navigate("/alumni")}>
            Back to Alumni
          </SecondaryBtn>
        }
      />

      <Card>
        <DetailRow label="Programme" value={alumni.programme ?? "—"} />
        <DetailRow label="Admission #" value={alumni.admission_number ?? "—"} />
        <DetailRow label="Graduation Date" value={alumni.graduation_date} />
        <DetailRow
          label="Graduation Notes"
          value={alumni.graduation_notes ?? "—"}
        />
        <DetailRow
          label="Record Created"
          value={new Date(alumni.created_at).toLocaleDateString()}
        />
      </Card>
    </div>
  );
}
