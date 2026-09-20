import { useEffect, useMemo, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import DataTable from "../../components/ui/DataTable";
import FileUpload from "../../components/ui/FileUpload";
import Modal, { ConfirmDialog } from "../../components/ui/Modal";
import { Banner } from "../../components/ui/Feedback";
import { Baby, Pencil, Trash2, Plus, Search } from "lucide-react";

const BLANK = { name: "", dob: "", gender: "", parent_id: "", class_id: "", profile_photo: "" };

export default function StudentsTab() {
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    api.get("/api/admin/students").then((res) => setStudents(res.data)).catch((err) => setError(errorMessage(err)));
    api.get("/api/admin/parents").then((res) => setParents(res.data)).catch(() => {});
    api.get("/api/admin/classrooms").then((res) => setClasses(res.data)).catch(() => {});
  }
  useEffect(refresh, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && String(s.class_id) !== classFilter) return false;
      if (!q) return true;
      return [s.name, s.roll_no, s.parent_name].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [students, query, classFilter]);

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalError("");
    setOpen(true);
  }

  function startEdit(s) {
    setEditing(s);
    setForm({
      name: s.name,
      dob: s.dob || "",
      gender: s.gender || "",
      parent_id: s.parent_id || "",
      class_id: s.class_id || "",
      profile_photo: s.profile_photo || "",
    });
    setModalError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    const body = {
      name: form.name,
      dob: form.dob || null,
      gender: form.gender || null,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      class_id: form.class_id ? Number(form.class_id) : null,
      profile_photo: form.profile_photo || null,
    };
    try {
      if (editing) await api.put(`/api/admin/students/${editing.student_id}`, body);
      else await api.post("/api/admin/students", body);
      setOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not save this student."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError("");
    try {
      await api.delete(`/api/admin/students/${confirm.student_id}`);
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
          <div className="section-title">Students</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>
            A roll number is issued automatically from the class name, and re-issued if the child moves class.
          </div>
        </div>
        <Button onClick={startAdd}>
          <Plus size={15} /> Enrol a student
        </Button>
      </div>

      <div className="form-row" style={{ marginTop: 16 }}>
        <Field label="Search" className="field--wide">
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--color-text-faint)" }} />
            <input
              className="input"
              style={{ paddingLeft: 33 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, roll number or parent"
            />
          </div>
        </Field>
        <Field label="Class" className="field--fixed">
          <select className="select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name}
                {c.section ? ` – ${c.section}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Banner tone="error">{error}</Banner>

      <div style={{ marginTop: 12 }}>
        <DataTable
          columns={[
            { key: "roll_no", header: "Roll no.", render: (s) => <Badge variant="accent">{s.roll_no || "—"}</Badge> },
            {
              key: "name",
              header: "Student",
              render: (s) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={s.name} src={s.profile_photo} size={30} />
                  {s.name}
                </span>
              ),
            },
            {
              key: "class_name",
              header: "Class",
              render: (s) =>
                s.class_name ? `${s.class_name}${s.section ? ` – ${s.section}` : ""}` : <span className="table-cell--muted">Unassigned</span>,
            },
            { key: "teacher_name", header: "Class teacher", render: (s) => s.teacher_name || <span className="table-cell--muted">—</span> },
            {
              key: "parent_name",
              header: "Parent",
              render: (s) =>
                s.parent_name ? (
                  <>
                    {s.parent_name}
                    <div className="table-cell--muted" style={{ fontSize: 12 }}>{s.parent_phone}</div>
                  </>
                ) : (
                  <span className="table-cell--muted">—</span>
                ),
            },
          ]}
          rows={visible}
          rowKey={(s) => s.student_id}
          actions={(s) => (
            <>
              <Button size="sm" variant="outline" onClick={() => startEdit(s)} aria-label={`Edit ${s.name}`}>
                <Pencil size={13} />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirm(s)} aria-label={`Remove ${s.name}`}>
                <Trash2 size={13} />
              </Button>
            </>
          )}
          emptyIcon={Baby}
          emptyTitle={students.length ? "No students match that search" : "No students yet"}
          emptyHint={students.length ? "Try a different name or class." : "Enrol your first child to get started."}
        />
      </div>

      <Modal open={open} title={editing ? `Edit ${editing.name}` : "Enrol a student"} onClose={() => setOpen(false)} wide>
        <form onSubmit={save}>
          <div style={{ marginBottom: 16 }}>
            <FileUpload value={form.profile_photo} onChange={(url) => setForm({ ...form, profile_photo: url })} accept="image/*" label="Student photo" />
          </div>
          <div className="form-grid">
            <Field label="Full name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Date of birth">
              <input className="input" type="date" value={form.dob || ""} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </Field>
            <Field label="Gender">
              <select className="select" value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Prefer not to say</option>
                <option value="female">Girl</option>
                <option value="male">Boy</option>
              </select>
            </Field>
            <Field label="Class">
              <select className="select" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name}
                    {c.section ? ` – ${c.section}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Parent" className="field--wide">
              <select className="select" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} required>
                <option value="">Select a parent account</option>
                {parents.map((p) => (
                  <option key={p.parent_id} value={p.parent_id}>
                    {p.name} ({p.email})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {editing && (
            <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 12 }}>
              Roll number {editing.roll_no}. Moving this child to another class issues a new one.
            </p>
          )}
          <Banner tone="error">{modalError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Enrol student"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Remove this student?"
        message={`${confirm?.name}'s attendance, fees and learning records will be deleted too. This can't be undone.`}
        confirmLabel="Remove student"
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
