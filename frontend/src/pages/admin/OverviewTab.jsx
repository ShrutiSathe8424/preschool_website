import { useEffect, useState } from "react";
import api, { errorMessage } from "../../api/client";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import { Banner, Skeleton } from "../../components/ui/Feedback";
import { Baby, GraduationCap, CalendarCheck2, Wallet, CalendarClock, Building2, ArrowRight } from "lucide-react";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** Each tile opens the module it counts, so the numbers are a way in, not a dead end. */
export default function OverviewTab({ onOpen }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/dashboard")
      .then((res) => setStats(res.data))
      .catch((err) => setError(errorMessage(err, "Could not load the dashboard. Is the backend running?")));
  }, []);

  if (error) return <Banner tone="error">{error}</Banner>;

  if (!stats) {
    return (
      <div className="stat-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <Skeleton width="60%" />
            <Skeleton width="40%" height={28} style={{ marginTop: 12 }} />
          </Card>
        ))}
      </div>
    );
  }

  const tiles = [
    { key: "Students", icon: Baby, label: "Students", value: stats.total_students, tone: "grape", hint: "Tap to see the roll" },
    { key: "Teachers", icon: GraduationCap, label: "Teachers", value: stats.total_teachers, tone: "tangerine", hint: "Staff IDs and classes" },
    { key: "Classes", icon: Building2, label: "Classes", value: stats.total_classes, tone: "teal", hint: "Rooms and their teacher" },
    {
      key: "Attendance",
      icon: CalendarCheck2,
      label: "Present today",
      value: stats.today_attendance,
      tone: "leaf",
      hint: `${stats.attendance_rate}% of the school · ${stats.staff_present_today} staff in`,
    },
    {
      key: "Fees",
      icon: Wallet,
      label: "Fees pending",
      value: stats.pending_fees,
      tone: "sunshine",
      hint: `${money(stats.pending_amount)} due · ${money(stats.collected_amount)} collected`,
    },
    { key: "Events", icon: CalendarClock, label: "Upcoming events", value: stats.upcoming_events, tone: "bubblegum", hint: "Photos and dates" },
  ];

  return (
    <>
      <div className="stat-grid">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onOpen(t.key)}
            style={{ border: "none", background: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
          >
            <StatCard icon={t.icon} label={t.label} value={t.value} hint={t.hint} tone={t.tone} />
          </button>
        ))}
      </div>

      <Card>
        <div className="section-title">Start here</div>
        <div className="section-sub">The usual first jobs of a school morning.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={() => onOpen("Attendance")}>
            Take today's attendance <ArrowRight size={14} />
          </Button>
          <Button variant="outline" onClick={() => onOpen("Students")}>
            Enrol a student <ArrowRight size={14} />
          </Button>
          <Button variant="outline" onClick={() => onOpen("Fees")}>
            Raise a fee <ArrowRight size={14} />
          </Button>
          <Button variant="outline" onClick={() => onOpen("Events")}>
            Post an event <ArrowRight size={14} />
          </Button>
        </div>
      </Card>
    </>
  );
}
