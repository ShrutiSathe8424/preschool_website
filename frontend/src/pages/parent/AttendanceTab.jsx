import { useEffect, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import StatCard from "../../components/ui/StatCard";
import { Banner, EmptyState } from "../../components/ui/Feedback";
import { CalendarCheck2, Flame, CalendarX2, Clock } from "lucide-react";

const monthLabel = (m) => {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("en-IN", { month: "short" });
};

/** The rolled-up view: a rate, a streak, six months of bars, and the last fortnight. */
export default function AttendanceTab({ student }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!student) return;
    setData(null);
    api
      .get(`/api/parent/attendance/${student.student_id}/analysis`)
      .then((res) => setData(res.data))
      .catch((err) => setError(errorMessage(err, "Could not load attendance.")));
  }, [student]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Card><p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>Loading attendance…</p></Card>;

  if (!data.total_days) {
    return (
      <Card>
        <EmptyState
          icon={CalendarCheck2}
          title="No attendance recorded yet"
          hint={`${student.name}'s register appears here once their teacher starts marking it.`}
        />
      </Card>
    );
  }

  const max = Math.max(...data.monthly.map((m) => m.present + m.absent + m.late), 1);

  return (
    <>
      <Card>
        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <div className="ring" style={{ "--pct": data.percentage }}>
            <div className="ring__inner">
              <div className="ring__value">{data.percentage}%</div>
              <div className="ring__label">attended</div>
            </div>
          </div>
          <div style={{ flex: "1 1 260px" }}>
            <div className="section-title">
              {data.percentage >= 90
                ? "Excellent attendance"
                : data.percentage >= 75
                ? "Good attendance"
                : "Attendance needs a look"}
            </div>
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginTop: 4 }}>
              {student.name} has attended {data.present + data.late} of {data.total_days} recorded days.
              A late arrival still counts as attending.
            </p>
            <div className="legend" style={{ marginTop: 12 }}>
              <span><i style={{ background: "var(--leaf-500)" }} /> Present</span>
              <span><i style={{ background: "var(--sunshine-500)" }} /> Late</span>
              <span><i style={{ background: "var(--danger-500)" }} /> Absent</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="stat-grid" style={{ marginTop: 18 }}>
        <StatCard icon={CalendarCheck2} label="Days present" value={data.present} tone="leaf" />
        <StatCard icon={Clock} label="Late arrivals" value={data.late} tone="sunshine" />
        <StatCard icon={CalendarX2} label="Days absent" value={data.absent} tone="bubblegum" />
        <StatCard icon={Flame} label="Current streak" value={data.current_streak} hint="days in a row" tone="teal" />
      </div>

      {data.monthly.length > 0 && (
        <Card>
          <div className="section-title">Month by month</div>
          <div className="section-sub">The last six months with any record.</div>
          <div className="att-bars">
            {data.monthly.map((m) => {
              const total = m.present + m.absent + m.late;
              return (
                <div className="att-bar" key={m.month}>
                  <div className="att-bar__stack" style={{ height: `${(total / max) * 100}%` }}>
                    {m.absent > 0 && <div className="att-bar__seg att-bar__seg--absent" style={{ height: `${(m.absent / total) * 100}%` }} />}
                    {m.late > 0 && <div className="att-bar__seg att-bar__seg--late" style={{ height: `${(m.late / total) * 100}%` }} />}
                    {m.present > 0 && <div className="att-bar__seg att-bar__seg--present" style={{ height: `${(m.present / total) * 100}%` }} />}
                  </div>
                  <span className="att-bar__label">{monthLabel(m.month)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="section-title">Recent days</div>
        <div className="section-sub">The last two weeks of the register.</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.attendance_id}>
                  <td>{new Date(r.att_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td><Badge variant={r.status}>{r.status}</Badge></td>
                  <td>{r.note || <span className="table-cell--muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
