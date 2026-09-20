export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const key = typeof t === "string" ? t : t.key;
        const label = typeof t === "string" ? t : t.label;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active === key}
            className={active === key ? "is-on" : ""}
            onClick={() => onChange(key)}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
