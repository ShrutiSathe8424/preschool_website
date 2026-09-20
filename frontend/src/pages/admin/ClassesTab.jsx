import { useEffect, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import DataTable from "../../components/ui/DataTable";
import Modal, { ConfirmDialog } from "../../components/ui/Modal";
import { Banner } from "../../components/ui/Feedback";
import { Building2, Pencil, Trash2, Plus } from "lucide-react";

const BLANK = { class_name: "", section: "", teacher_id: "" };

export default function ClassesTab() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    api.get("/api/admin/classrooms").then((res) => setClasses(res.data)).catch((err) => setError(errorMessage(err)));
    api.get("/api/admin/teachers").then((res) => setTeachers(res.data)).catch(() => {});
  }
  useEffect(refresh, []);

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalError("");
    setOpen(true);
  }

  function startEdit(c) {
    setEditing(c);
    setForm({ class_name: c.class_name, section: c.section || "", teacher_id: c.teacher_id || "" });
    setModalError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    const body = {
      class_name: form.class_name,
      section: form.section || null,
      teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
    };
    try {
      if (editing) await api.put(`/api/admin/classrooms/${editing.class_id}`, body);
      else await api.post("/api/admin/classrooms", body);
      setOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not save this class."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError("");
    try {
      await api.delete(`/api/admin/classrooms/${confirm.class_id}`);
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
          <div className="section-title">Classes</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>One teacher runs each class. Assign or swap them here.</div>
        </div>
        <Button onClick={startAdd}>
          <Plus size={15} /> Add a class
        </Button>
      </div>

      <Banner tone="error">{error}</Banner>

      <div style={{ marginTop: 18 }}>
        <DataTable
          columns={[
            { key: "class_name", header: "Class" },
            { key: "section", header: "Section" },
            { key: "teacher_name", header: "Class teacher", render: (c) => c.teacher_name || <span className="table-cell--muted">Unassigned</span> },
            { key: "student_count", header: "Students", render: (c) => <span className="mono">{c.student_count}</span> },
          ]}
          rows={classes}
          rowKey={(c) => c.class_id}
          actions={(c) => (
            <>
              <Button size="sm" variant="outline" onClick={() => startEdit(c)} aria-label={`Edit ${c.class_name}`}>
                <Pencil size={13} />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirm(c)} aria-label={`Delete ${c.class_name}`}>
                <Trash2 size={13} />
              </Button>
            </>
          )}
          emptyIcon={Building2}
          emptyTitle="No classes yet"
          emptyHint="Add your first classroom to start enrolling children."
        />
      </div>

      <Modal open={open} title={editing ? "Edit class" : "Add a class"} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="Class name">
              <input className="input" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="Nursery" required />
            </Field>
            <Field label="Section" hint="Optional, e.g. A">
              <input className="input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" />
            </Field>
            <Field label="Class teacher" className="field--wide">
              <select className="select" value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
                <option value="">No teacher yet</option>
                {teachers.map((t) => (
                  <option key={t.teacher_id} value={t.teacher_id}>
                    {t.name} ({t.employee_id || "no ID"})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Banner tone="error">{modalError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add class"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Delete this class?"
        message={`${confirm?.class_name}${confirm?.section ? ` – ${confirm.section}` : ""} will be removed. Move its students to another class first.`}
        confirmLabel="Delete class"
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
