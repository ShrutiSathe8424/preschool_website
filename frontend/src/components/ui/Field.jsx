export default function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field__label">{label}</span>}
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
