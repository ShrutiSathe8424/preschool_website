import { LogOut } from "lucide-react";
import Logo from "./ui/Logo";
import Avatar from "./ui/Avatar";

/**
 * Shared shell for the three grown-up dashboards. `role` sets the accent
 * crayon (.role-admin / .role-teacher / .role-parent in theme.css), so every
 * module reuses one layout and only the colour changes.
 */
export default function AppShell({
  role,
  roleLabel,
  navItems,
  activeNav,
  onNavChange,
  userName,
  userPhoto,
  onLogout,
  children,
}) {
  return (
    <div className={`shell role-${role}`}>
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <Logo size={27} />
          <div>
            <div className="shell-brand__name">Sprout</div>
            <div className="shell-brand__tag">Preschool Suite</div>
          </div>
        </div>

        <nav className="shell-nav">
          {navItems.map((item) =>
            item.group ? (
              <div key={item.group} className="shell-nav__group">
                {item.group}
              </div>
            ) : (
              <button
                key={item.key}
                type="button"
                className={`shell-nav__item ${activeNav === item.key ? "is-active" : ""}`}
                onClick={() => onNavChange(item.key)}
              >
                <item.icon size={17} strokeWidth={2.2} />
                {item.label}
              </button>
            )
          )}
        </nav>

        <div className="shell-sidebar__spacer" />

        <div className="shell-user">
          <Avatar name={userName} src={userPhoto} size={36} />
          <div style={{ minWidth: 0 }}>
            <div className="shell-user__name">{userName}</div>
            <div className="shell-user__role">{roleLabel}</div>
          </div>
          <button className="shell-user__logout" onClick={onLogout} title="Log out" type="button">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="shell-main">
        <div className="shell-content">{children}</div>
      </main>
    </div>
  );
}

/** The coloured band that opens every page. */
export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
