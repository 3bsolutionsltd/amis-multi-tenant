import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getFeeOverview,
  getFeeDefaulters,
  type FeeOverview,
  type Defaulter,
} from "./fees.api";
import {
  ensureGlobalCss,
  PageHeader,
  StatCard,
  Card,
  DataTable,
  TR,
  TD,
  Spinner,
  EmptyState,
  Badge,
  SectionLabel,
} from "../../lib/ui";

function OverviewCards({ data }: { data: FeeOverview }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 16,
        marginBottom: 28,
      }}
    >
      <StatCard
        label="Total Students"
        value={data.totalStudents.toLocaleString()}
        accent="#2563eb"
      />
      <StatCard
        label="Total Expected"
        value={`UGX ${data.totalExpected.toLocaleString()}`}
        accent="#7c3aed"
      />
      <StatCard
        label="Total Collected"
        value={`UGX ${data.totalCollected.toLocaleString()}`}
        accent="#16a34a"
      />
      <StatCard
        label="Collection Rate"
        value={`${data.collectionRate}%`}
        accent={data.collectionRate >= 75 ? "#16a34a" : "#dc2626"}
      />
      <StatCard
        label="Fully Paid"
        value={data.fullyPaid.toLocaleString()}
        accent="#16a34a"
      />
      <StatCard
        label="Defaulters"
        value={data.defaulters.toLocaleString()}
        accent={data.defaulters > 0 ? "#dc2626" : "#16a34a"}
      />
    </div>
  );
}

export function FeeOverviewPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "defaulters">("overview");

  const overviewQ = useQuery({
    queryKey: ["feeOverview"],
    queryFn: getFeeOverview,
  });

  const defaultersQ = useQuery({
    queryKey: ["feeDefaulters"],
    queryFn: getFeeDefaulters,
    enabled: tab === "defaulters",
  });

  return (
    <div>
      <PageHeader
        title="Fee Overview"
        back={{ label: "Finance", to: "/finance" }}
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab("overview")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontWeight: 500,
            fontSize: 14,
            cursor: "pointer",
            background: tab === "overview" ? "#2563eb" : "#fff",
            color: tab === "overview" ? "#fff" : "#374151",
          }}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab("defaulters")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontWeight: 500,
            fontSize: 14,
            cursor: "pointer",
            background: tab === "defaulters" ? "#2563eb" : "#fff",
            color: tab === "defaulters" ? "#fff" : "#374151",
          }}
        >
          Defaulters
        </button>
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <>
          {overviewQ.isLoading && <Spinner />}
          {overviewQ.data && <OverviewCards data={overviewQ.data} />}
        </>
      )}

      {/* Defaulters Tab */}
      {tab === "defaulters" && (
        <Card padding="0">
          <div style={{ padding: "16px 24px 0" }}>
            <SectionLabel>Students with Outstanding Balances</SectionLabel>
          </div>
          {defaultersQ.isLoading && <Spinner />}
          {defaultersQ.data && defaultersQ.data.length === 0 && (
            <EmptyState title="No defaulters — all students are up to date!" />
          )}
          {defaultersQ.data && defaultersQ.data.length > 0 && (
            <DataTable
              headers={[
                "Admission #",
                "Student",
                "Programme",
                "Paid",
                "Balance",
                "Status",
              ]}
            >
              {defaultersQ.data.map((d: Defaulter) => (
                <TR
                  key={d.id}
                  onClick={() => navigate(`/students/${d.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <TD>{d.admission_number ?? "—"}</TD>
                  <TD>
                    {d.first_name} {d.last_name}
                  </TD>
                  <TD>{d.programme ?? "—"}</TD>
                  <TD>UGX {Number(d.total_paid).toLocaleString()}</TD>
                  <TD style={{ color: "#dc2626", fontWeight: 600 }}>
                    UGX {Number(d.balance).toLocaleString()}
                  </TD>
                  <TD>
                    <Badge label="OWING" color="red" />
                  </TD>
                </TR>
              ))}
            </DataTable>
          )}
        </Card>
      )}
    </div>
  );
}
