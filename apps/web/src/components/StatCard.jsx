export default function StatCard({ label, value, hint, helper }) {
  return (
    <div className="card stat-card">
      <p className="eyebrow">{label}</p>
      <h3>{value}</h3>
      <p className="muted">{hint || helper}</p>
    </div>
  );
}
