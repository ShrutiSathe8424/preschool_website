import { useEffect, useMemo, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/ui/DataTable";
import Modal, { ConfirmDialog } from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import { Banner } from "../../components/ui/Feedback";
import { Wallet, Pencil, Trash2, Plus, CheckCircle2, IndianRupee } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const BLANK = { student_id: "", title: "Term fee", amount: "", due_date: today(), status: "pending" };

export default function FeesTab() {
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    api.get("/api/admin/fees").then((res) => setFees(res.data)).catch((err) => setError(errorMessage(err)));
    api.get("/api/admin/students").then((res) => setStudents(res.data)).catch(() => {});
  }
  useEffect(refresh, []);

  const totals = useMemo(() => {
    const paid = fees.filter((f) => f.status === "paid");
    const due = fees.filter((f) => f.status !== "paid");
    return {
      collected: paid.reduce((n, f) => n + Number(f.amount || 0), 0),
      outstanding: due.reduce((n, f) => n + Number(f.amount || 0), 0),
      dueCount: due.length,
    };
  }, [fees]);

  const visible = statusFilter ? fees.filter((f) => f.status === statusFilter) : fees;

  function startAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalError("");
    setOpen(true);
  }

  function startEdit(f) {
    setEditing(f);
    setForm({
      student_id: f.student_id,
      title: f.title || "Term fee",
      amount: f.amount,
      due_date: f.due_date || today(),
      status: f.status,
    });
    setModalError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    try {
      if (editing) {
        await api.put(`/api/admin/fees/${editing.fee_id}`, {
          title: form.title,
          amount: Number(form.amount),
          due_date: form.due_date || null,
          status: form.status,
        });
      } else {
        await api.post("/api/admin/fees", {
          student_id: Number(form.student_id),
          title: form.title,
          amount: Number(form.amount),
          due_date: form.due_date || null,
          status: form.status,
        });
      }
      setOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not save this fee."));
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(fee) {
    setError("");
    try {
      await api.put(`/api/admin/fees/${fee.fee_id}`, { status: "paid" });
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/admin/fees/${confirm.fee_id}`);
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
      setConfirm(null);
    }
  }

  return (
    <>
      <div className="stat-grid">
        <StatCard icon={IndianRupee} label="Collected" value={money(totals.collected)} tone="leaf" />
        <StatCard icon={Wallet} label="Outstanding" value={money(totals.outstanding)} hint={`${totals.dueCount} unpaid invoice(s)`} tone="sunshine" />
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div className="section-title">Fees</div>
            <div className="section-sub" style={{ marginBottom: 0 }}>
              Parents pay with the QR code from Settings and enter their reference — confirm those here.
            </div>
          </div>
          <Button onClick={startAdd}>
            <Plus size={15} /> Raise a fee
          </Button>
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <Field label="Show" className="field--fixed">
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Everything</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
        </div>

        <Banner tone="error">{error}</Banner>

        <div style={{ marginTop: 12 }}>
          <DataTable
            columns={[
              { key: "student_name", header: "Student" },
              { key: "title", header: "For" },
              { key: "amount", header: "Amount", render: (f) => <span className="mono">{money(f.amount)}</span> },
              { key: "due_date", header: "Due" },
              { key: "status", header: "Status", render: (f) => <Badge variant={f.status}>{f.status}</Badge> },
              {
                key: "payment_ref",
                header: "Payment",
                render: (f) =>
                  f.payment_ref ? (
                    <>
                      <span className="mono">{f.payment_ref}</span>
                      <div className="table-cell--muted" style={{ fontSize: 12 }}>
                        {f.paid_via} · {f.payment_date}
                      </div>
                    </>
                  ) : (
                    <span className="table-cell--muted">—</span>
                  ),
              },
            ]}
            rows={visible}
            rowKey={(f) => f.fee_id}
            actions={(f) => (
              <>
                {f.status !== "paid" && (
                  <Button size="sm" variant="outline" onClick={() => markPaid(f)}>
                    <CheckCircle2 size={13} /> Mark paid
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => startEdit(f)} aria-label="Edit fee">
                  <Pencil size={13} />
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirm(f)} aria-label="Delete fee">
                  <Trash2 size={13} />
                </Button>
              </>
            )}
            emptyIcon={Wallet}
            emptyTitle="No fees raised yet"
            emptyHint="Raise a term fee and it shows up on the parent's dashboard."
          />
        </div>

        <Modal open={open} title={editing ? "Edit fee" : "Raise a fee"} onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <div className="form-grid">
              {!editing && (
                <Field label="Student" className="field--wide">
                  <select className="select" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
                    <option value="">Select a student</option>
                    {students.map((s) => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.name} ({s.roll_no})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="What it's for">
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Term 2 fee" required />
              </Field>
              <Field label="Amount (₹)">
                <input className="input mono" type="number" min="0" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </Field>
              <Field label="Due date">
                <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">Paid</option>
                </select>
              </Field>
            </div>
            <Banner tone="error">{modalError}</Banner>
            <div className="form-actions">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? "Save changes" : "Raise fee"}</Button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          open={!!confirm}
          title="Delete this fee?"
          message={`${confirm?.title} for ${confirm?.student_name} will be removed from the parent's dashboard.`}
          onConfirm={remove}
          onClose={() => setConfirm(null)}
        />
      </Card>
    </>
  );
}
