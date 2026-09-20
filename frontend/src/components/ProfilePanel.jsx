import { useEffect, useState } from "react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Field from "./ui/Field";
import Avatar from "./ui/Avatar";
import FileUpload from "./ui/FileUpload";
import { Banner } from "./ui/Feedback";

/** Editable profile, shared by Admin, Teacher and Parent. */
export default function ProfilePanel() {
  const { user, applyProfile } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((res) => setForm(res.data))
      .catch((err) => setError(errorMessage(err, "Could not load your profile.")));
  }, []);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage("");
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const body = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        profile_photo: form.profile_photo,
      };
      if (user?.role === "parent") {
        Object.assign(body, {
          father_name: form.father_name,
          father_phone: form.father_phone,
          mother_name: form.mother_name,
          mother_phone: form.mother_phone,
        });
      }
      const res = await api.put("/api/auth/me", body);
      setForm(res.data);
      applyProfile(res.data);
      setMessage("Profile saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwError("");
    setPwMessage("");
    if (pw.new_password !== pw.confirm) {
      setPwError("The two new passwords don't match.");
      return;
    }
    setPwBusy(true);
    try {
      await api.post("/api/auth/change-password", {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPw({ current_password: "", new_password: "", confirm: "" });
      setPwMessage("Password updated.");
    } catch (err) {
      setPwError(errorMessage(err, "Could not change your password."));
    } finally {
      setPwBusy(false);
    }
  }

  if (!form) {
    return (
      <Card>
        <Banner tone="error">{error}</Banner>
        {!error && <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>Loading your profile…</p>}
      </Card>
    );
  }

  return (
    <>
      <Card>
        <form onSubmit={save}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <Avatar name={form.name} src={form.profile_photo} size={62} />
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <FileUpload
                value={form.profile_photo}
                onChange={(url) => set("profile_photo", url)}
                accept="image/*"
                label="Profile picture"
                hint="A square photo works best."
              />
            </div>
          </div>

          <div className="form-grid">
            <Field label="Name">
              <input className="input" value={form.name || ""} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Email" hint="This is also your login.">
              <input className="input" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} required />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            {form.employee_id && (
              <Field label="Staff ID" hint="Set by the school office.">
                <input className="input" value={form.employee_id} disabled />
              </Field>
            )}
            <Field label="Address" className="field--wide">
              <input className="input" value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </div>

          {user?.role === "parent" && (
            <>
              <div className="section-title" style={{ marginTop: 24 }}>Guardians</div>
              <div className="section-sub">Both parents can be reached by the school.</div>
              <div className="form-grid">
                <Field label="Father's name">
                  <input className="input" value={form.father_name || ""} onChange={(e) => set("father_name", e.target.value)} />
                </Field>
                <Field label="Father's mobile">
                  <input className="input" value={form.father_phone || ""} onChange={(e) => set("father_phone", e.target.value)} />
                </Field>
                <Field label="Mother's name">
                  <input className="input" value={form.mother_name || ""} onChange={(e) => set("mother_name", e.target.value)} />
                </Field>
                <Field label="Mother's mobile">
                  <input className="input" value={form.mother_phone || ""} onChange={(e) => set("mother_phone", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          <Banner tone="error">{error}</Banner>
          <Banner tone="success">{message}</Banner>

          <div className="form-actions">
            <Button type="submit" loading={saving}>Save profile</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="section-title">Change password</div>
        <div className="section-sub">Use at least 6 characters.</div>
        <form onSubmit={savePassword}>
          <div className="form-grid">
            <Field label="Current password">
              <input className="input" type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
            </Field>
            <Field label="New password">
              <input className="input" type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required />
            </Field>
            <Field label="Confirm new password">
              <input className="input" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            </Field>
          </div>
          <Banner tone="error">{pwError}</Banner>
          <Banner tone="success">{pwMessage}</Banner>
          <div className="form-actions">
            <Button type="submit" variant="outline" loading={pwBusy}>Update password</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
