import { useEffect } from "react";
import { X } from "lucide-react";
import Button from "./Button";

export default function Modal({ open, title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <div>
            <div className="modal__title">{title}</div>
            {subtitle && <div className="modal__sub">{subtitle}</div>}
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close" type="button">
            <X size={16} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onClose, busy }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p style={{ fontSize: 14, color: "var(--ink-700)" }}>{message}</p>
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Keep it
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
