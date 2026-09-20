import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../api/client";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Field from "./ui/Field";
import Modal, { ConfirmDialog } from "./ui/Modal";
import FileUpload from "./ui/FileUpload";
import DataTable from "./ui/DataTable";
import Badge from "./ui/Badge";
import { Banner } from "./ui/Feedback";
import { Clapperboard, Pencil, Trash2, Plus, ExternalLink } from "lucide-react";

const CATEGORIES = ["Alphabets", "Numbers", "Colours", "Shapes", "Animals", "Rhymes", "Stories", "Lesson"];
const EMOJI = ["🎬", "🔤", "🔢", "🎨", "🔺", "🐘", "🎵", "📖", "🌈", "⭐"];

const BLANK = {
  title: "",
  description: "",
  category: "Rhymes",
  emoji: "🎬",
  content_type: "video",
  media_url: "",
  class_id: "",
  is_active: true,
};

/**
 * Admin and teachers curate what children see in Child Mode: uploaded videos,
 * or links to a video hosted elsewhere.
 */
export default function ContentManager({ role, classes = [] }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  function refresh() {
    api.get("/api/content").then((res) => setItems(res.data)).catch((err) => setError(errorMessage(err)));
  }
  useEffect(refresh, []);

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setError("");
    setOpen(true);
  }

  function startEdit(item) {
    setEditing(item);
    setForm({ ...item, class_id: item.class_id ?? "" });
    setError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.media_url) {
      setError("Upload a video or paste a link first.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      title: form.title,
      description: form.description,
      category: form.category,
      emoji: form.emoji,
      content_type: form.content_type,
      media_url: form.media_url,
      is_active: form.is_active,
    };
    if (role === "admin") body.class_id = form.class_id ? Number(form.class_id) : null;

    try {
      if (editing) await api.put(`/api/content/${editing.content_id}`, body);
      else await api.post("/api/content", body);
      setOpen(false);
      refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not save this lesson."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/content/${confirm.content_id}`);
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
      setConfirm(null);
    }
  }

  const className = (id) => classes.find((c) => c.class_id === id)?.class_name || "All classes";

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="section-title">Learning World content</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>
            Videos and lessons children see when a parent opens Child Mode.
          </div>
        </div>
        <Button onClick={startAdd}>
          <Plus size={15} /> Add a lesson
        </Button>
      </div>

      <Banner tone="error">{error}</Banner>

      <div style={{ marginTop: 18 }}>
        <DataTable
          columns={[
            {
              key: "title",
              header: "Lesson",
              render: (c) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{c.emoji}</span>
                  <span>
                    {c.title}
                    {c.description && <div className="table-cell--muted" style={{ fontSize: 12 }}>{c.description}</div>}
                  </span>
                </span>
              ),
            },
            { key: "category", header: "Topic", render: (c) => <Badge variant="accent">{c.category}</Badge> },
            { key: "class_id", header: "Shown to", render: (c) => className(c.class_id) },
            {
              key: "media_url",
              header: "Media",
              render: (c) => (
                <a className="file-link" href={mediaUrl(c.media_url)} target="_blank" rel="noreferrer">
                  <ExternalLink size={12} /> {c.content_type === "link" ? "Open link" : "Play"}
                </a>
              ),
            },
            {
              key: "is_active",
              header: "Status",
              render: (c) => <Badge variant={c.is_active ? "present" : ""}>{c.is_active ? "Live" : "Hidden"}</Badge>,
            },
          ]}
          rows={items}
          rowKey={(c) => c.content_id}
          actions={(c) => (
            <>
              <Button size="sm" variant="outline" onClick={() => startEdit(c)} aria-label={`Edit ${c.title}`}>
                <Pencil size={13} />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirm(c)} aria-label={`Remove ${c.title}`}>
                <Trash2 size={13} />
              </Button>
            </>
          )}
          emptyIcon={Clapperboard}
          emptyTitle="No lessons added yet"
          emptyHint="Upload a rhyme or a phonics video and it appears in Child Mode straight away."
        />
      </div>

      <Modal
        open={open}
        title={editing ? "Edit lesson" : "Add a lesson"}
        subtitle="Children see the emoji and title as a big tile."
        onClose={() => setOpen(false)}
        wide
      >
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="Title" className="field--wide">
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Phonics song: A to E" required />
            </Field>
            <Field label="Topic">
              <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Tile emoji">
              <select className="select" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}>
                {EMOJI.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </Field>
            {role === "admin" && (
              <Field label="Shown to">
                <select className="select" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                  <option value="">All classes</option>
                  {classes.map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.class_name}
                      {c.section ? ` – ${c.section}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Source">
              <select className="select" value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value, media_url: "" })}>
                <option value="video">Uploaded video</option>
                <option value="link">Link to a video</option>
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label="Description">
              <textarea className="textarea" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="One line about what the child will learn." />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            {form.content_type === "video" ? (
              <FileUpload
                value={form.media_url}
                onChange={(url) => setForm({ ...form, media_url: url })}
                accept="video/*"
                label="Video file"
                hint="MP4 or WebM plays inside Child Mode."
              />
            ) : (
              <Field label="Video link">
                <input className="input" value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://..." />
              </Field>
            )}
          </div>

          <label className="radio-inline" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Show this in Child Mode
          </label>

          <Banner tone="error">{error}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add lesson"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Remove this lesson?"
        message={`"${confirm?.title}" will disappear from Child Mode. The uploaded file stays on the server.`}
        confirmLabel="Remove lesson"
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
