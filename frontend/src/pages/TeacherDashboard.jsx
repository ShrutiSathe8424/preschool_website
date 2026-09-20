import { useEffect, useState } from "react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AppShell, { PageHeader } from "../components/AppShell";
import ProfilePanel from "../components/ProfilePanel";
import ContentManager from "../components/ContentManager";
import AttendanceTab from "./teacher/AttendanceTab";
import HomeworkTab from "./teacher/HomeworkTab";
import ActivitiesTab from "./teacher/ActivitiesTab";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import { Banner, EmptyState } from "../components/ui/Feedback";
import { CalendarCheck2, BookOpen, Palette, School, Clapperboard, UserCog, ClipboardList } from "lucide-react";

const NAV = [
  { key: "Attendance", label: "Attendance", icon: CalendarCheck2 },
  { key: "Homework", label: "Homework", icon: BookOpen },
  { key: "Activities", label: "Activities", icon: Palette },
  { key: "Learning", label: "Learning World", icon: Clapperboard },
  { group: "You" },
  { key: "MyAttendance", label: "My attendance", icon: ClipboardList },
  { key: "Profile", label: "My profile", icon: UserCog },
];

const COPY = {
  Attendance: ["Attendance", "Mark the register, and reopen any past day to fix it."],
  Homework: ["Homework", "Set tasks with a worksheet or photo attached."],
  Activities: ["Activities", "Share what the class did today."],
  Learning: ["Learning World", "Add videos and lessons for your class's Child Mode."],
  MyAttendance: ["My attendance", "Your own record, as marked by the office."],
  Profile: ["My profile", "Your name, photo and password."],
};

export default function TeacherDashboard() {
  const [tab, setTab] = useState("Attendance");
  const [myClass, setMyClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const { user, logout } = useAuth();

  useEffect(() => {
    api
      .get("/api/teacher/my-class")
      .then((res) => setMyClass(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoaded(true));
    api.get("/api/teacher/students").then((res) => setStudents(res.data)).catch(() => {});
  }, []);

  const [title, description] = COPY[tab] || [tab, ""];
  const classLabel = myClass ? `${myClass.class_name}${myClass.section ? ` – ${myClass.section}` : ""}` : null;
  const needsClass = ["Attendance", "Homework", "Activities", "Learning"].includes(tab);

  return (
    <AppShell
      role="teacher"
      roleLabel={classLabel ? `Class teacher · ${classLabel}` : "Teacher"}
      navItems={NAV}
      activeNav={tab}
      onNavChange={setTab}
      userName={user?.name}
      userPhoto={user?.photo}
      onLogout={logout}
    >
      <PageHeader
        eyebrow={classLabel ? `${classLabel} · ${students.length} children` : "Teacher"}
        title={title}
        description={description}
      />

      <Banner tone="error">{error}</Banner>

      {loaded && !myClass && needsClass ? (
        <Card>
          <EmptyState
            icon={School}
            title="No class assigned yet"
            hint="Ask the office to put you in charge of a class, then everything here unlocks."
          />
        </Card>
      ) : (
        <>
          {tab === "Attendance" && myClass && <AttendanceTab classId={myClass.class_id} students={students} />}
          {tab === "Homework" && myClass && <HomeworkTab classId={myClass.class_id} />}
          {tab === "Activities" && myClass && <ActivitiesTab classId={myClass.class_id} />}
          {tab === "Learning" && myClass && <ContentManager role="teacher" classes={myClass ? [myClass] : []} />}
        </>
      )}

      {tab === "MyAttendance" && <MyAttendance />}
      {tab === "Profile" && <ProfilePanel />}
    </AppShell>
  );
}

function MyAttendance() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/teacher/my-attendance").then((res) => setRows(res.data)).catch((err) => setError(errorMessage(err)));
  }, []);

  const present = rows.filter((r) => r.status === "present").length;

  return (
    <Card>
      <div className="section-title">Your record</div>
      <div className="section-sub">
        {rows.length ? `${present} of the last ${rows.length} working days marked present.` : "Marked by the school office."}
      </div>
      <Banner tone="error">{error}</Banner>
      <DataTable
        columns={[
          { key: "att_date", header: "Date" },
          { key: "status", header: "Status", render: (r) => <Badge variant={r.status}>{r.status}</Badge> },
          { key: "note", header: "Note" },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        emptyIcon={ClipboardList}
        emptyTitle="Nothing marked yet"
        emptyHint="Your attendance appears here once the office starts the staff register."
      />
    </Card>
  );
}
