export default function Button({
  children,
  variant = "primary",
  size,
  block,
  loading,
  type = "button",
  className = "",
  ...rest
}) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size ? `btn--${size}` : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} disabled={loading || rest.disabled} {...rest}>
      {loading && <span className="btn__spinner" />}
      {children}
    </button>
  );
}
