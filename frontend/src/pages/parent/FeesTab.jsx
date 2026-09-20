import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Banner, EmptyState } from "../../components/ui/Feedback";
import { Wallet, QrCode, Copy, Check } from "lucide-react";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** Pay screen: the school's QR, then the reference number so the office can match it. */
export default function FeesTab({ student }) {
  const [fees, setFees] = useState([]);
  const [info, setInfo] = useState(null);
  const [paying, setPaying] = useState(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  function refresh() {
    if (!student) return;
    api
      .get(`/api/parent/fees/${student.student_id}`)
      .then((res) => setFees(res.data))
      .catch((err) => setError(errorMessage(err)));
  }

  useEffect(refresh, [student]);
  useEffect(() => {
    api.get("/api/parent/payment-info").then((res) => setInfo(res.data)).catch(() => setInfo(null));
  }, []);

  const outstanding = fees.filter((f) => f.status !== "paid");
  const dueTotal = outstanding.reduce((n, f) => n + Number(f.amount || 0), 0);

  function startPay(fee) {
    setPaying(fee);
    setReference("");
    setModalError("");
  }

  async function submitPayment(e) {
    e.preventDefault();
    setBusy(true);
    setModalError("");
    try {
      await api.post(`/api/parent/fees/${paying.fee_id}/pay`, { paid_via: "upi", payment_ref: reference });
      setPaying(null);
      setMessage("Payment recorded. The school office will confirm it shortly.");
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not record the payment."));
    } finally {
      setBusy(false);
    }
  }

  function copyUpi() {
    navigator.clipboard?.writeText(info.upi_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <Card>
        <div className="section-title">Fees for {student?.name}</div>
        <div className="section-sub">
          {outstanding.length ? `${money(dueTotal)} outstanding across ${outstanding.length} invoice(s).` : "Everything is settled."}
        </div>

        <Banner tone="error">{error}</Banner>
        <Banner tone="success">{message}</Banner>

        {fees.length === 0 ? (
          <EmptyState icon={Wallet} title="No fees raised yet" hint="Invoices from the school office will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>For</th>
                  <th>Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.fee_id}>
                    <td>{f.title || "Fee"}</td>
                    <td className="mono">{money(f.amount)}</td>
                    <td>{f.due_date || "—"}</td>
                    <td>
                      <Badge variant={f.status}>{f.status}</Badge>
                      {f.payment_ref && <div className="table-cell--muted" style={{ fontSize: 12 }}>Ref {f.payment_ref}</div>}
                    </td>
                    <td className="is-actions">
                      {f.status !== "paid" && (
                        <Button size="sm" onClick={() => startPay(f)}>
                          Pay {money(f.amount)}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="section-title">How to pay</div>
        <div className="section-sub">
          {info?.payment_note || "Scan the school's QR code in any UPI app, then come back and enter the reference number."}
        </div>
        <div className="qr-panel">
          {info?.payment_qr_url ? (
            <img className="qr-panel__img" src={mediaUrl(info.payment_qr_url)} alt="School fee payment QR code" />
          ) : (
            <div className="qr-panel__img" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", color: "var(--color-text-faint)" }}>
              <QrCode size={34} />
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: "center" }}>The school hasn't uploaded a QR code yet</span>
            </div>
          )}
          <div style={{ flex: "1 1 240px" }}>
            {info?.upi_id && (
              <Field label="UPI ID">
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input mono" value={info.upi_id} readOnly />
                  <Button variant="outline" onClick={copyUpi}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </Field>
            )}
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 14, lineHeight: 1.6 }}>
              After paying, press <strong>Pay</strong> on the invoice above and enter the 12-digit UPI reference from your
              payment app. The office matches it against the bank statement and confirms.
            </p>
            {info?.contact_phone && (
              <p style={{ fontSize: 12.5, color: "var(--color-text-faint)", marginTop: 10 }}>
                Trouble paying? Call the office on {info.contact_phone}.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Modal open={!!paying} title={`Pay ${money(paying?.amount)}`} subtitle={paying?.title} onClose={() => setPaying(null)}>
        <form onSubmit={submitPayment}>
          <p style={{ fontSize: 13.5, color: "var(--ink-700)", marginBottom: 16 }}>
            Pay using the QR code or UPI ID on this page, then enter the reference number your app shows.
          </p>
          <Field label="UPI reference number">
            <input
              className="input mono"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. 428193765512"
              required
            />
          </Field>
          <Banner tone="error">{modalError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
            <Button type="submit" loading={busy}>Record payment</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
