import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import FileUpload from "../../components/ui/FileUpload";
import Modal, { ConfirmDialog } from "../../components/ui/Modal";
import { Banner, EmptyState } from "../../components/ui/Feedback";
import { CalendarClock, Pencil, Trash2, Plus, MapPin } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const BLANK = { title: "", description: "", event_date: today(), venue: "", photo_url: "" };

const prettyDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "";

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    api.get("/api/admin/events").then((res) => setEvents(res.data)).catch((err) => setError(errorMessage(err)));
  }
  useEffect(refresh, []);

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalError("");
    setOpen(true);
  }

  function startEdit(ev) {
    setEditing(ev);
    setForm({ ...BLANK, ...ev });
    setModalError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    const body = {
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      venue: form.venue || null,
      photo_url: form.photo_url || null,
    };
    try {
      if (editing) await api.put(`/api/admin/events/${editing.event_id}`, body);
      else await api.post("/api/admin/events", body);
      setOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not save this event."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/admin/events/${confirm.event_id}`);
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
          <div className="section-title">Events</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>
            Sports day, concerts, holidays — with a photo, these show up for every parent.
          </div>
        </div>
        <Button onClick={startAdd}>
          <Plus size={15} /> Post an event
        </Button>
      </div>

      <Banner tone="error">{error}</Banner>

      <div style={{ marginTop: 14 }}>
        {events.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing on the calendar" hint="Post your first event and parents will see it straight away." />
        ) : (
          events.map((ev) => {
            const upcoming = ev.event_date >= today();
            return (
              <div className="list-row" key={ev.event_id}>
                {ev.photo_url ? (
                  <img className="list-row__media" src={mediaUrl(ev.photo_url)} alt="" />
                ) : (
                  <div className="list-row__media" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-faint)" }}>
                    <CalendarClock size={22} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="list-row__title">{ev.title}</span>
                    <Badge variant={upcoming ? "present" : ""}>{upcoming ? "Upcoming" : "Past"}</Badge>
                  </div>
                  <div className="list-row__meta">
                    {prettyDate(ev.event_date)}
                    {ev.venue && (
                      <>
                        {" · "}
                        <MapPin size={11} style={{ verticalAlign: -1 }} /> {ev.venue}
                      </>
                    )}
                  </div>
                  {ev.description && <div className="list-row__body">{ev.description}</div>}
                </div>
                <div className="table-actions" style={{ alignSelf: "center" }}>
                  <Button size="sm" variant="outline" onClick={() => startEdit(ev)} aria-label={`Edit ${ev.title}`}>
                    <Pencil size={13} />
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirm(ev)} aria-label={`Delete ${ev.title}`}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={open} title={editing ? "Edit event" : "Post an event"} onClose={() => setOpen(false)} wide>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="Title" className="field--wide">
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Annual Sports Day" required />
            </Field>
            <Field label="Date">
              <input className="input" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
            </Field>
            <Field label="Where">
              <input className="input" value={form.venue || ""} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="School ground" />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Details">
              <textarea className="textarea" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What happens, what to bring, what time to arrive." />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <FileUpload value={form.photo_url} onChange={(url) => setForm({ ...form, photo_url: url })} accept="image/*" label="Event photo or poster" />
          </div>
          <Banner tone="error">{modalError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Post event"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Delete this event?"
        message={`"${confirm?.title}" will disappear from every parent's dashboard.`}
        confirmLabel="Delete event"
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
