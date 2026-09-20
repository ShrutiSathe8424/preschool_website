import { EmptyState } from "./Feedback";

/**
 * columns: [{ key, header, render?, align? }]
 * actions: (row) => ReactNode — rendered right-aligned in a trailing column
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey,
  actions,
  emptyIcon,
  emptyTitle = "Nothing here yet",
  emptyHint,
}) {
  if (!rows.length) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.header}</th>
            ))}
            {actions && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.className || ""}>
                  {c.render ? c.render(row) : row[c.key] ?? <span className="table-cell--muted">—</span>}
                </td>
              ))}
              {actions && (
                <td className="is-actions">
                  <div className="table-actions">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
