import { useEffect, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import DataTable from "../../components/ui/DataTable";
import Modal, { ConfirmDialog } from "../../components/ui/Modal";
import { Banner } from "../../components/ui/Feedback";
import { Users2, Pencil, Trash2, Plus } from "lucide-react";

const BLANK = {
  name: "",
  email: "",
  password: "",
  phone: "",
  address: "",
  father_name: "",
  father_phone: "",
  mother_name: "",
  mother_phone: "",
};

export default function ParentsTab() {
  const [parents, setParents] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    api.get("/api/admin/parents").then((res) => setParents(res.data)).catch((err) => setError(errorMessage(err)));
  }
  useEffect(refresh, []);

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalError("");
    setOpen(true);
  }

  function startEdit(p) {
    setEditing(p);
    setForm({ ...BLANK, ...p, password: "" });
    setModalError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    const body = { ...form };
    if (!body.password) delete body.password;
    try {
      if (editing) await api.put(`/api/admin/parents/${editing.parent_id}`, body);
      else await api.post("/api/admin/parents", body);
      setOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not save this parent."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError("");
    try {
      await api.delete(`/api/admin/parents/${confirm.parent_id}`);
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
          <div className="section-title">Parents</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>
            One login per family. Record both guardians so either can be called.
          </div>
        </div>
        <Button onClick={startAdd}>
          <Plus size={15} /> Add a parent
        </Button>
      </div>

      <Banner tone="error">{error}</Banner>

      <div style={{ marginTop: 18 }}>
        <DataTable
          columns={[
            { key: "name", header: "Account name" },
            { key: "email", header: "Email" },
            {
              key: "father_name",
              header: "Father",
              render: (p) =>
                p.father_name ? (
                  <>
                    {p.father_name}
                    <div className="table-cell--muted" style={{ fontSize: 12 }}>{p.father_phone}</div>
                  </>
                ) : (
                  <span className="table-cell--muted">—</span>
                ),
            },
            {
              key: "mother_name",
              header: "Mother",
              render: (p) =>
                p.mother_name ? (
                  <>
                    {p.mother_name}
                    <div className="table-cell--muted" style={{ fontSize: 12 }}>{p.mother_phone}</div>
                  </>
                ) : (
                  <span className="table-cell--muted">—</span>
                ),
            },
            { key: "phone", header: "Main phone" },
          ]}
          rows={parents}
          rowKey={(p) => p.parent_id}
          actions={(p) => (
            <>
              <Button size="sm" variant="outline" onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`}>
                <Pencil size={13} />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirm(p)} aria-label={`Remove ${p.name}`}>
                <Trash2 size={13} />
              </Button>
            </>
          )}
          emptyIcon={Users2}
          emptyTitle="No parents yet"
          emptyHint="Add a family account, then link their child from the Students tab."
        />
      </div>

      <Modal open={open} title={editing ? `Edit ${editing.name}` : "Add a parent"} onClose={() => setOpen(false)} wide>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="Account name" hint="Shown on their dashboard.">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Email" hint="Their login.">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label={editing ? "New password" : "Password"} hint={editing ? "Leave blank to keep the current one." : undefined}>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
            </Field>
            <Field label="Main phone">
              <input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>

          <div className="section-title" style={{ marginTop: 22 }}>Guardians</div>
          <div className="section-sub">Either number may be used for pick-up and emergencies.</div>
          <div className="form-grid">
            <Field label="Father's name">
              <input className="input" value={form.father_name || ""} onChange={(e) => setForm({ ...form, father_name: e.target.value })} />
            </Field>
            <Field label="Father's mobile">
              <input className="input" value={form.father_phone || ""} onChange={(e) => setForm({ ...form, father_phone: e.target.value })} />
            </Field>
            <Field label="Mother's name">
              <input className="input" value={form.mother_name || ""} onChange={(e) => setForm({ ...form, mother_name: e.target.value })} />
            </Field>
            <Field label="Mother's mobile">
              <input className="input" value={form.mother_phone || ""} onChange={(e) => setForm({ ...form, mother_phone: e.target.value })} />
            </Field>
            <Field label="Home address" className="field--wide">
              <input className="input" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>

          <Banner tone="error">{modalError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add parent"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Remove this parent?"
        message={`${confirm?.name} will lose access to the app. Any linked children must be re-linked first.`}
        confirmLabel="Remove parent"
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
