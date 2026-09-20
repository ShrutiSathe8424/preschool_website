import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import FileUpload from "../../components/ui/FileUpload";
import { Banner } from "../../components/ui/Feedback";
import { QrCode } from "lucide-react";

/** School details and the UPI QR code parents scan to pay fees. */
export default function SettingsTab() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/settings")
      .then((res) => setForm(res.data))
      .catch((err) => setError(errorMessage(err, "Could not load school settings.")));
  }, []);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage("");
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await api.put("/api/admin/settings", form);
      setForm(res.data);
      setMessage("School settings saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save settings."));
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <Card>
        <Banner tone="error">{error}</Banner>
        {!error && <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>Loading settings…</p>}
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="section-title">School details</div>
        <div className="section-sub">Shown to parents on the fee payment screen.</div>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="School name">
              <input className="input" value={form.school_name || ""} onChange={(e) => set("school_name", e.target.value)} />
            </Field>
            <Field label="Office email">
              <input className="input" type="email" value={form.contact_email || ""} onChange={(e) => set("contact_email", e.target.value)} />
            </Field>
            <Field label="Office phone">
              <input className="input" value={form.contact_phone || ""} onChange={(e) => set("contact_phone", e.target.value)} />
            </Field>
          </div>

          <div className="section-title" style={{ marginTop: 26 }}>Fee payments</div>
          <div className="section-sub">
            Upload the QR code from your UPI app. Parents scan it, pay, then enter the reference number so you can match it.
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <Field label="UPI ID">
                  <input className="input mono" value={form.upi_id || ""} onChange={(e) => set("upi_id", e.target.value)} placeholder="school@okbank" />
                </Field>
                <FileUpload
                  value={form.payment_qr_url}
                  onChange={(url) => set("payment_qr_url", url)}
                  accept="image/*"
                  label="Payment QR code"
                  hint="A screenshot from GPay, PhonePe or your bank app works."
                />
                <Field label="Note for parents">
                  <input className="input" value={form.payment_note || ""} onChange={(e) => set("payment_note", e.target.value)} placeholder="Scan in any UPI app, then enter the reference number." />
                </Field>
              </div>
            </div>
            <div>
              {form.payment_qr_url ? (
                <img className="qr-panel__img" src={mediaUrl(form.payment_qr_url)} alt="Fee payment QR code" />
              ) : (
                <div className="qr-panel__img" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-faint)", flexDirection: "column", gap: 8 }}>
                  <QrCode size={34} />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>No QR uploaded</span>
                </div>
              )}
            </div>
          </div>

          <Banner tone="error">{error}</Banner>
          <Banner tone="success">{message}</Banner>
          <div className="form-actions">
            <Button type="submit" loading={saving}>Save settings</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
