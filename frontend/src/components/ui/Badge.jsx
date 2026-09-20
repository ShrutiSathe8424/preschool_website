export default function Badge({ children, variant = "" }) {
  return <span className={`badge ${variant ? `badge--${variant}` : ""}`}>{children}</span>;
}
