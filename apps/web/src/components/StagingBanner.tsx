export default function StagingBanner() {
  if (import.meta.env.VITE_APP_ENV !== "staging") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#f59e0b",
        color: "#1c1917",
        textAlign: "center",
        padding: "6px 12px",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        userSelect: "none",
      }}
    >
      ⚠ STAGING ENVIRONMENT — pre.amis.institute — Do not use for real data
    </div>
  );
}
