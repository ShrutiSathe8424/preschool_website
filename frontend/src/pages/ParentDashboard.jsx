import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errorMessage, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AppShell, { PageHeader } from "../components/AppShell";
import ProfilePanel from "../components/ProfilePanel";
import AttendanceTab from "./parent/AttendanceTab";
import UpdatesTab from "./parent/UpdatesTab";
import FeesTab from "./parent/FeesTab";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import Badge from "../components/ui/Badge";
import Avatar from "../components/ui/Avatar";
import StatCard from "../components/ui/StatCard";
import Modal from "../components/ui/Modal";
import { Banner, EmptyState } from "../components/ui/Feedback";
import {
  Users2, CalendarCheck2, BookOpen, Palette, Wallet, CalendarClock,
  UserCog, Lock, Play, Star, Clock, Trophy, MapPin,
} from "lucide-react";

const NAV = [
  { key: "Home", label: "My children", icon: Users2 },
  { group: "Their day" },
  { key: "Attendance", label: "Attendance", icon: CalendarCheck2 },
  { key: "Homework", label: "Homework", icon: BookOpen },
  { key: "Activities", label: "Activities", icon: Palette },
  { group: "School" },
  { key: "Fees", label: "Fees", icon: Wallet },
  { key: "Events", label: "Events", icon: CalendarClock },
  { key: "Profile", label: "My profile", icon: UserCog },
];

const COPY = {
  Home: ["My children", "Their report card, and the way into Learning World."],
  Attendance: ["Attendance", "How often they've been in, month by month."],
  Homework: ["Homework", "What's been set, and the worksheets to open."],
  Activities: ["Activities", "Photos and notes from their day."],
  Fees: ["Fees", "What's due, and how to pay it."],
  Events: ["Events", "What's coming up at school."],
  Profile: ["My profile", "Your details, both guardians, and your password."],
};

export default function ParentDashboard() {
  const [tab, setTab] = useState("Home");
  const [children, setChildren] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState("");
  const { user, logout } = useAuth();

  useEffect(() => {
    api
      .get("/api/parent/children")
      .then((res) => {
        setChildren(res.data);
        if (res.data.length) setActiveId(res.data[0].student_id);
      })
      .catch((err) => setError(errorMessage(err, "Could not load your children's details.")));
  }, []);

  const student = children.find((c) => c.student_id === activeId) || null;
  const [title, description] = COPY[tab] || [tab, ""];
  const childScoped = ["Attendance", "Homework", "Activities", "Fees"].includes(tab);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={NAV}
      activeNav={tab}
      onNavChange={setTab}
      userName={user?.name}
      userPhoto={user?.photo}
      onLogout={logout}
    >
      <PageHeader
        eyebrow="Parent"
        title={tab === "Home" ? `Hello, ${user?.name?.split(" ")[0] || ""}` : title}
        description={description}
        actions={
          childScoped && children.length > 1 ? (
            <Field label="Child">
              <select className="select" value={activeId || ""} onChange={(e) => setActiveId(Number(e.target.value))}>
                {children.map((c) => (
                  <option key={c.student_id} value={c.student_id}>{c.name}</option>
                ))}
              </select>
            </Field>
          ) : null
        }
      />

      <Banner tone="error">{error}</Banner>

      {childScoped && !student ? (
        <Card>
          <EmptyState icon={Users2} title="No children linked yet" hint="Ask the school office to link your child to this account." />
        </Card>
      ) : (
        <>
          {tab === "Home" && <ChildrenHome children={children} />}
          {tab === "Attendance" && <AttendanceTab student={student} />}
          {tab === "Homework" && <UpdatesTab student={student} kind="homework" />}
          {tab === "Activities" && <UpdatesTab student={student} kind="activities" />}
          {tab === "Fees" && <FeesTab student={student} />}
        </>
      )}

      {tab === "Events" && <EventsFeed />}
      {tab === "Profile" && <ProfilePanel />}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ home */
function ChildrenHome({ children }) {
  const [pinSet, setPinSet] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [reports, setReports] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/parent/child-pin/status").then((res) => setPinSet(res.data.pin_set)).catch(() => setPinSet(false));
  }, []);

  useEffect(() => {
    children.forEach((c) => {
      api
        .get(`/api/parent/report/${c.student_id}`)
        .then((res) => setReports((prev) => ({ ...prev, [c.student_id]: res.data })))
        .catch(() => {});
    });
  }, [children]);

  async function savePin(e) {
    e.preventDefault();
    setPinError("");
    if (!/^\d{4}$/.test(pin)) {
      setPinError("The PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setPinError("The two PINs don't match.");
      return;
    }
    setPinBusy(true);
    try {
      await api.post("/api/parent/child-pin", { pin });
      setPinSet(true);
      setPinOpen(false);
      setPin("");
      setConfirmPin("");
    } catch (err) {
      setPinError(errorMessage(err, "Could not save the PIN."));
    } finally {
      setPinBusy(false);
    }
  }

  function enterChildMode(studentId) {
    if (!pinSet) {
      setPinError("Set a PIN first — you'll need it to get back out of Child Mode.");
      setPinOpen(true);
      return;
    }
    navigate(`/child/${studentId}`);
  }

  return (
    <>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ background: "var(--sunshine-50)", color: "var(--sunshine-600)", borderRadius: 10, padding: 9, display: "flex" }}>
              <Lock size={17} />
            </div>
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>Child Mode PIN</div>
              <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>
                {pinSet
                  ? "Set. Your child can't leave Learning World without it."
                  : "Not set yet. Choose one before handing over the tablet."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPinOpen(true)}>
            {pinSet ? "Change PIN" : "Set a PIN"}
          </Button>
        </div>
      </Card>

      {children.length === 0 ? (
        <Card>
          <EmptyState icon={Users2} title="No children linked yet" hint="Ask the school office to link your child to this account." />
        </Card>
      ) : (
        children.map((c) => {
          const report = reports[c.student_id];
          return (
            <Card key={c.student_id}>
              <div className="child-card">
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <Avatar name={c.name} src={c.profile_photo} size={46} />
                  <div>
                    <h3 style={{ margin: 0 }}>{c.name}</h3>
                    <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
                      <span className="child-card__id">{c.roll_no}</span>
                      {c.class_name && <Badge>{c.class_name}{c.section ? ` – ${c.section}` : ""}</Badge>}
                      {c.teacher_name && (
                        <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>
                          Teacher: {c.teacher_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button onClick={() => enterChildMode(c.student_id)}>
                  <Play size={15} /> Open Learning World
                </Button>
              </div>

              {report && (
                <div className="stat-grid" style={{ marginTop: 20, marginBottom: 0, paddingTop: 18, borderTop: "1px solid var(--line-soft)" }}>
                  <StatCard icon={Clock} label="Minutes learned" value={report.total_minutes_learned} tone="teal" />
                  <StatCard icon={BookOpen} label="Lessons finished" value={report.lessons_completed} tone="grape" />
                  <StatCard icon={Trophy} label="Quizzes tried" value={report.quizzes_attempted} tone="tangerine" />
                  <StatCard icon={Star} label="Stars earned" value={report.rewards_earned} tone="sunshine" />
                </div>
              )}

              {report?.recent_rewards?.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {report.recent_rewards.map((r) => (
                    <Badge key={r.reward_id} variant="warn">⭐ {r.reward_name}</Badge>
                  ))}
                </div>
              )}
            </Card>
          );
        })
      )}

      <Modal
        open={pinOpen}
        title={pinSet ? "Change your PIN" : "Set your Child Mode PIN"}
        subtitle="Four digits. You'll type this to bring your child out of Learning World."
        onClose={() => setPinOpen(false)}
      >
        <form onSubmit={savePin}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Field label="New PIN">
              <input
                className="input mono"
                style={{ width: 110, letterSpacing: 8, textAlign: "center" }}
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </Field>
            <Field label="Confirm PIN">
              <input
                className="input mono"
                style={{ width: 110, letterSpacing: 8, textAlign: "center" }}
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          <Banner tone="error">{pinError}</Banner>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setPinOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pinBusy}>Save PIN</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ---------------------------------------------------------------- events */
function EventsFeed() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get("/api/parent/events").then((res) => setEvents(res.data)).catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <Card>
      <Banner tone="error">{error}</Banner>
      {events.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nothing planned right now" hint="School events and holidays will show up here." />
      ) : (
        events.map((ev) => (
          <div className="list-row" key={ev.event_id}>
            {ev.photo_url ? (
              <img className="list-row__media" src={mediaUrl(ev.photo_url)} alt="" />
            ) : (
              <div className="list-row__media" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-faint)" }}>
                <CalendarClock size={22} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="list-row__title">{ev.title}</span>
                {ev.event_date >= today && <Badge variant="present">Coming up</Badge>}
              </div>
              <div className="list-row__meta">
                {new Date(ev.event_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                {ev.venue && (
                  <>
                    {" · "}
                    <MapPin size={11} style={{ verticalAlign: -1 }} /> {ev.venue}
                  </>
                )}
              </div>
              {ev.description && <div className="list-row__body">{ev.description}</div>}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
