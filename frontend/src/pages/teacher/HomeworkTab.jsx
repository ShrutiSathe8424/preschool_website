import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import FileUpload from "../../components/ui/FileUpload";
import Modal, { ConfirmDialog } from "../../components/ui/Modal";
import { Banner, EmptyState } from "../../components/ui/Feedback";
import { BookOpen, Pencil, Trash2, Plus, Paperclip } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const BLANK = { title: "", description: "", due_date: today(), file_url: "" };
const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;

export default function HomeworkTab({ classId }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    api.get("/api/teacher/homework").then((res) => setItems(res.data)).catch((err) => setError(errorMessage(err)));
  }
  useEffect(refresh, []);

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalError("");
    setOpen(true);
  }

  function startEdit(h) {
    setEditing(h);
    setForm({ title: h.title, description: h.description || "", due_date: h.due_date || today(), file_url: h.file_url || "" });
    setModalError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    try {
      if (editing) await api.put(`/api/teacher/homework/${editing.homework_id}`, form);
      else await api.post("/api/teacher/homework", { ...form, class_id: classId });
      setOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not save this homework."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/teacher/homework/${confirm.homework_id}`);
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
      setConfirm(null);
    }
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="section-title">Homework</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>
            Attach a worksheet or a photo — parents can open it from their dashboard.
          </div>
        </div>
        <Button onClick={startAdd}>
          <Plus size={15} /> Assign homework
        </Button>
      </div>

      <Banner tone="error">{error}</Banner>

      <div style={{ marginTop: 14 }}>
        {items.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nothing assigned yet" hint="Set your first task and it appears for every parent in your class." />
        ) : (
          items.map((h) => (
            <div className="list-row" key={h.homework_id}>
              {h.file_url && IMAGE_RE.test(h.file_url) ? (
                <img className="list-row__media" src={mediaUrl(h.file_url)} alt="" />
              ) : (
                <div className="list-row__media" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-faint)" }}>
                  <BookOpen size={22} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="list-row__title">{h.title}</div>
                <div className="list-row__meta">Due {h.due_date}</div>
                {h.description && <div className="list-row__body">{h.description}</div>}
                {h.file_url && (
                  <a className="file-link" href={mediaUrl(h.file_url)} target="_blank" rel="noreferrer">
                    <Paperclip size={12} /> {h.file_url.split("/").pop()}
                  </a>
                )}
              </div>
              <div className="table-actions" style={{ alignSelf: "center" }}>
                <Button size="sm" variant="outline" onClick={() => startEdit(h)} aria-label={`Edit ${h.title}`}>
                  <Pencil size={13} />
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirm(h)} aria-label={`Delete ${h.title}`}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={open} title={editing ? "Edit homework" : "Assign homework"} onClose={() => setOpen(false)} wide>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="Title" className="field--wide">
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Trace the letter B" required />
            </Field>
            <Field label="Due date">
              <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="What to do">
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Two lines of B, then colour the balloon." />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <FileUpload
              value={form.file_url}
              onChange={(url) => setForm({ ...form, file_url: url })}
              label="Worksheet or photo"
              hint="PDF, image or Word file."
            />
          </div>
          <Banner tone="error">{modalError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Assign homework"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Delete this homework?"
        message={`"${confirm?.title}" will be removed from every parent's dashboard.`}
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
