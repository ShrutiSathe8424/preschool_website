export default function StatCard({ icon: Icon, label, value, hint, tone = "grape" }) {
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat__top">
        {Icon && (
          <span className="stat__icon">
            <Icon size={16} strokeWidth={2.4} />
          </span>
        )}
        <span className="stat__label">{label}</span>
      </div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}
