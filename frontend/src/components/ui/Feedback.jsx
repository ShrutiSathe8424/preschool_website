import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info };

export function Banner({ tone = "error", children }) {
  if (!children) return null;
  const Icon = ICONS[tone] || Info;
  return (
    <div className={`banner banner--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={16} />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty__icon">
          <Icon size={23} strokeWidth={2.2} />
        </div>
      )}
      <div className="empty__title">{title}</div>
      {hint && <div className="empty__hint">{hint}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Toast({ message, tone = "", icon: Icon = CheckCircle2 }) {
  if (!message) return null;
  return (
    <div className={`toast ${tone ? `toast--${tone}` : ""}`} role="status">
      <Icon size={16} />
      {message}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}
