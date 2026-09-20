import { useEffect, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/ui/DataTable";
import FileUpload from "../../components/ui/FileUpload";
import Modal, { ConfirmDialog } from "../../components/ui/Modal";
import { Banner } from "../../components/ui/Feedback";
import { GraduationCap, Pencil, Trash2, Plus } from "lucide-react";

const BLANK = { name: "", email: "", password: "", employee_id: "", phone: "", address: "", profile_photo: "", class_id: "" };

export default function TeachersTab() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    api.get("/api/admin/teachers").then((res) => setTeachers(res.data)).catch((err) => setError(errorMessage(err)));
    api.get("/api/admin/classrooms").then((res) => setClasses(res.data)).catch(() => {});
  }
  useEffect(refresh, []);

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalError("");
    setOpen(true);
  }

  function startEdit(t) {
    setEditing(t);
    setForm({ ...BLANK, ...t, password: "", class_id: t.class_id || "" });
    setModalError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    const body = {
      name: form.name,
      email: form.email,
      employee_id: form.employee_id || null,
      phone: form.phone || null,
      address: form.address || null,
      profile_photo: form.profile_photo || null,
      class_id: form.class_id ? Number(form.class_id) : null,
    };
    if (form.password) body.password = form.password;

    try {
      if (editing) await api.put(`/api/admin/teachers/${editing.teacher_id}`, body);
      else await api.post("/api/admin/teachers", { ...body, password: form.password });
      setOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not save this teacher."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError("");
    try {
      await api.delete(`/api/admin/teachers/${confirm.teacher_id}`);
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
      setConfirm(null);
    }
  }

  const classLabel = (id) => {
    const c = classes.find((c) => c.class_id === id);
    return c ? `${c.class_name}${c.section ? ` – ${c.section}` : ""}` : null;
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="section-title">Teachers</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>
            Every teacher gets a staff ID. Leave it blank and the next free one is used.
          </div>
        </div>
        <Button onClick={startAdd}>
          <Plus size={15} /> Add a teacher
        </Button>
      </div>

      <Banner tone="error">{error}</Banner>

      <div style={{ marginTop: 18 }}>
        <DataTable
          columns={[
            { key: "employee_id", header: "Staff ID", render: (t) => <Badge variant="accent">{t.employee_id || "—"}</Badge> },
            {
              key: "name",
              header: "Name",
              render: (t) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={t.name} src={t.profile_photo} size={30} />
                  {t.name}
                </span>
              ),
            },
            { key: "email", header: "Email" },
            { key: "phone", header: "Phone" },
            { key: "class_id", header: "Class", render: (t) => classLabel(t.class_id) || <span className="table-cell--muted">Unassigned</span> },
          ]}
          rows={teachers}
          rowKey={(t) => t.teacher_id}
          actions={(t) => (
            <>
              <Button size="sm" variant="outline" onClick={() => startEdit(t)} aria-label={`Edit ${t.name}`}>
                <Pencil size={13} />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirm(t)} aria-label={`Remove ${t.name}`}>
                <Trash2 size={13} />
              </Button>
            </>
          )}
          emptyIcon={GraduationCap}
          emptyTitle="No teachers yet"
          emptyHint="Add a staff account so someone can take the register."
        />
      </div>

      <Modal open={open} title={editing ? `Edit ${editing.name}` : "Add a teacher"} onClose={() => setOpen(false)} wide>
        <form onSubmit={save}>
          <div style={{ marginBottom: 16 }}>
            <FileUpload value={form.profile_photo} onChange={(url) => setForm({ ...form, profile_photo: url })} accept="image/*" label="Profile photo" />
          </div>
          <div className="form-grid">
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Staff ID" hint="Left blank, we assign the next one.">
              <input className="input" value={form.employee_id || ""} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="TCH-004" />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label={editing ? "New password" : "Password"} hint={editing ? "Leave blank to keep the current one." : undefined}>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editing}
              />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Class">
              <select className="select" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">No class yet</option>
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name}
                    {c.section ? ` – ${c.section}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Address" className="field--wide">
              <input className="input" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <Banner tone="error">{modalError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add teacher"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Remove this teacher?"
        message={`${confirm?.name} will lose access and be unassigned from their class.`}
        confirmLabel="Remove teacher"
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
