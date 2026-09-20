import { useEffect, useMemo, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Tabs from "../../components/ui/Tabs";
import Badge from "../../components/ui/Badge";
import { Banner, EmptyState } from "../../components/ui/Feedback";
import { CalendarCheck2, Save } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const CHILD_STATUSES = ["present", "absent", "late"];
const STAFF_STATUSES = ["present", "absent", "late", "leave"];

function StatusPicker({ value, onChange, options }) {
  return (
    <div className="status-group">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          data-status={opt}
          className={value === opt ? "is-on" : ""}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/** Admins can correct any register, for any class, on any date. */
export default function AttendanceTab() {
  const [who, setWho] = useState("children");
  return (
    <>
      <Tabs
        tabs={[
          { key: "children", label: "Children" },
          { key: "staff", label: "Teachers" },
        ]}
        active={who}
        onChange={setWho}
      />
      {who === "children" ? <ChildrenRegister /> : <StaffRegister />}
    </>
  );
}

function ChildrenRegister() {
  const [date, setDate] = useState(today());
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/admin/classrooms").then((res) => {
      setClasses(res.data);
      if (res.data.length && !classId) setClassId(String(res.data[0].class_id));
    }).catch((err) => setError(errorMessage(err)));
    api.get("/api/admin/students").then((res) => setStudents(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roll = useMemo(
    () => students.filter((s) => String(s.class_id) === String(classId)),
    [students, classId]
  );

  useEffect(() => {
    if (!classId || !date) return;
    setMessage("");
    api
      .get("/api/admin/attendance", { params: { att_date: date, class_id: classId } })
      .then((res) => {
        const map = {};
        res.data.forEach((a) => {
          map[a.student_id] = a.status;
        });
        setMarks(map);
      })
      .catch(() => setMarks({}));
  }, [classId, date]);

  async function saveAll() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await Promise.all(
        roll.map((s) =>
          api.post("/api/admin/attendance", {
            student_id: s.student_id,
            class_id: Number(classId),
            att_date: date,
            status: marks[s.student_id] || "present",
          })
        )
      );
      setMessage(`Register saved for ${new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`);
    } catch (err) {
      setError(errorMessage(err, "Could not save the register."));
    } finally {
      setSaving(false);
    }
  }

  const counts = roll.reduce(
    (acc, s) => {
      const status = marks[s.student_id] || "present";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <Card>
      <div className="form-row">
        <Field label="Class" className="field--fixed">
          <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name}
                {c.section ? ` – ${c.section}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" className="field--fixed">
          <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button onClick={saveAll} loading={saving} disabled={!roll.length}>
          <Save size={14} /> {saving ? "Saving" : "Save register"}
        </Button>
      </div>

      {roll.length > 0 && (
        <div className="legend" style={{ marginTop: 14 }}>
          <span><i style={{ background: "var(--leaf-500)" }} /> {counts.present || 0} present</span>
          <span><i style={{ background: "var(--sunshine-500)" }} /> {counts.late || 0} late</span>
          <span><i style={{ background: "var(--danger-500)" }} /> {counts.absent || 0} absent</span>
        </div>
      )}

      <Banner tone="error">{error}</Banner>
      <Banner tone="success">{message}</Banner>

      <div style={{ marginTop: 14 }}>
        {roll.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title="No children in this class" hint="Enrol students, then take the register here." />
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
                {roll.map((s) => (
                  <tr key={s.student_id}>
                    <td><Badge variant="accent">{s.roll_no || "—"}</Badge></td>
                    <td>{s.name}</td>
                    <td>
                      <StatusPicker
                        value={marks[s.student_id] || "present"}
                        options={CHILD_STATUSES}
                        onChange={(status) => setMarks((prev) => ({ ...prev, [s.student_id]: status }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function StaffRegister() {
  const [date, setDate] = useState(today());
  const [teachers, setTeachers] = useState([]);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/admin/teachers").then((res) => setTeachers(res.data)).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    setMessage("");
    api
      .get("/api/admin/teacher-attendance", { params: { att_date: date } })
      .then((res) => {
        const map = {};
        res.data.forEach((a) => {
          map[a.teacher_id] = a.status;
        });
        setMarks(map);
      })
      .catch(() => setMarks({}));
  }, [date]);

  async function saveAll() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await Promise.all(
        teachers.map((t) =>
          api.post("/api/admin/teacher-attendance", {
            teacher_id: t.teacher_id,
            att_date: date,
            status: marks[t.teacher_id] || "present",
          })
        )
      );
      setMessage("Staff register saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save the staff register."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="form-row">
        <Field label="Date" className="field--fixed">
          <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button onClick={saveAll} loading={saving} disabled={!teachers.length}>
          <Save size={14} /> {saving ? "Saving" : "Save register"}
        </Button>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="success">{message}</Banner>

      <div style={{ marginTop: 14 }}>
        {teachers.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title="No staff yet" hint="Add teachers before marking staff attendance." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Teacher</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.teacher_id}>
                    <td><Badge variant="accent">{t.employee_id || "—"}</Badge></td>
                    <td>{t.name}</td>
                    <td>
                      <StatusPicker
                        value={marks[t.teacher_id] || "present"}
                        options={STAFF_STATUSES}
                        onChange={(status) => setMarks((prev) => ({ ...prev, [t.teacher_id]: status }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
