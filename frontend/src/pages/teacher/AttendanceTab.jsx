import { useEffect, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import { Banner, EmptyState } from "../../components/ui/Feedback";
import { CalendarCheck2, Save, Undo2 } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const STATUSES = ["present", "absent", "late"];

/**
 * The register saves in a single request and can be reopened for any past
 * date, so a mistake is fixed by changing it and saving again.
 */
export default function AttendanceTab({ classId, students }) {
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    setMessage("");
    api
      .get(`/api/teacher/attendance/${classId}/${date}`)
      .then((res) => {
        const map = {};
        res.data.forEach((a) => {
          map[a.student_id] = a.status;
        });
        setMarks(map);
        setSaved(map);
      })
      .catch(() => {
        setMarks({});
        setSaved({});
      })
      .finally(() => setLoading(false));
  }, [classId, date]);

  const alreadyTaken = Object.keys(saved).length > 0;
  const dirty = students.some((s) => (marks[s.student_id] || "present") !== (saved[s.student_id] || "present"));

  async function saveAll() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = students.map((s) => ({
        student_id: s.student_id,
        class_id: classId,
        att_date: date,
        status: marks[s.student_id] || "present",
      }));
      await api.post("/api/teacher/attendance/bulk", payload);
      const next = {};
      payload.forEach((p) => {
        next[p.student_id] = p.status;
      });
      setSaved(next);
      setMessage(alreadyTaken ? "Register updated." : "Register saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save the register."));
    } finally {
      setSaving(false);
    }
  }

  const counts = students.reduce((acc, s) => {
    const status = marks[s.student_id] || "present";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <div className="form-row">
        <Field label="Date" className="field--fixed">
          <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button onClick={saveAll} loading={saving} disabled={!students.length || (!dirty && alreadyTaken)}>
          <Save size={14} /> {alreadyTaken ? "Update register" : "Save register"}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setMarks(saved)}>
            <Undo2 size={14} /> Undo changes
          </Button>
        )}
        {alreadyTaken && !dirty && <Badge variant="present">Saved for this day</Badge>}
      </div>

      {students.length > 0 && !loading && (
        <div className="legend" style={{ marginTop: 14 }}>
          <span><i style={{ background: "var(--leaf-500)" }} /> {counts.present || 0} present</span>
          <span><i style={{ background: "var(--sunshine-500)" }} /> {counts.late || 0} late</span>
          <span><i style={{ background: "var(--danger-500)" }} /> {counts.absent || 0} absent</span>
        </div>
      )}

      <Banner tone="error">{error}</Banner>
      <Banner tone="success">{message}</Banner>

      <div style={{ marginTop: 14 }}>
        {students.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title="No children in your class yet" hint="The office adds children to your class." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Roll no.</th>
                  <th>Student</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const current = marks[s.student_id] || "present";
                  return (
                    <tr key={s.student_id}>
                      <td><Badge variant="accent">{s.roll_no || "—"}</Badge></td>
                      <td>{s.name}</td>
                      <td>
                        <div className="status-group">
                          {STATUSES.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              data-status={opt}
                              className={current === opt ? "is-on" : ""}
                              onClick={() => setMarks((prev) => ({ ...prev, [s.student_id]: opt }))}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
