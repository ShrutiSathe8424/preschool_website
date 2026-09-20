import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import FileUpload from "../../components/ui/FileUpload";
import Modal, { ConfirmDialog } from "../../components/ui/Modal";
import { Banner, EmptyState } from "../../components/ui/Feedback";
import { Palette, Pencil, Trash2, Plus } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const BLANK = { title: "", description: "", act_date: today(), photo_url: "" };

export default function ActivitiesTab({ classId }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    api.get("/api/teacher/activity").then((res) => setItems(res.data)).catch((err) => setError(errorMessage(err)));
  }
  useEffect(refresh, []);

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalError("");
    setOpen(true);
  }

  function startEdit(a) {
    setEditing(a);
    setForm({ title: a.title, description: a.description || "", act_date: a.act_date || today(), photo_url: a.photo_url || "" });
    setModalError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    try {
      if (editing) await api.put(`/api/teacher/activity/${editing.activity_id}`, form);
      else await api.post("/api/teacher/activity", { ...form, class_id: classId });
      setOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not save this activity."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/teacher/activity/${confirm.activity_id}`);
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
          <div className="section-title">Today's activities</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>
            A photo and a line about what the class did. Parents see this the same day.
          </div>
        </div>
        <Button onClick={startAdd}>
          <Plus size={15} /> Log an activity
        </Button>
      </div>

      <Banner tone="error">{error}</Banner>

      <div style={{ marginTop: 14 }}>
        {items.length === 0 ? (
          <EmptyState icon={Palette} title="No activities logged yet" hint="Share what the class did today — painting, story time, a song." />
        ) : (
          items.map((a) => (
            <div className="list-row" key={a.activity_id}>
              {a.photo_url ? (
                <img className="list-row__media" src={mediaUrl(a.photo_url)} alt="" />
              ) : (
                <div className="list-row__media" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-faint)" }}>
                  <Palette size={22} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="list-row__title">{a.title}</div>
                <div className="list-row__meta">{a.act_date}</div>
                {a.description && <div className="list-row__body">{a.description}</div>}
              </div>
              <div className="table-actions" style={{ alignSelf: "center" }}>
                <Button size="sm" variant="outline" onClick={() => startEdit(a)} aria-label={`Edit ${a.title}`}>
                  <Pencil size={13} />
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirm(a)} aria-label={`Delete ${a.title}`}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={open} title={editing ? "Edit activity" : "Log an activity"} onClose={() => setOpen(false)} wide>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="Title" className="field--wide">
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Finger painting" required />
            </Field>
            <Field label="Date">
              <input className="input" type="date" value={form.act_date} onChange={(e) => setForm({ ...form, act_date: e.target.value })} required />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="What happened">
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="We mixed red and blue and everyone made a purple handprint." />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <FileUpload value={form.photo_url} onChange={(url) => setForm({ ...form, photo_url: url })} accept="image/*" label="Photo from the day" />
          </div>
          <Banner tone="error">{modalError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Log activity"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Delete this activity?"
        message={`"${confirm?.title}" will be removed from every parent's feed.`}
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
