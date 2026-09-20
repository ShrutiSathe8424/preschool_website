import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import AppShell, { PageHeader } from "../components/AppShell";
import ProfilePanel from "../components/ProfilePanel";
import ContentManager from "../components/ContentManager";
import OverviewTab from "./admin/OverviewTab";
import ClassesTab from "./admin/ClassesTab";
import TeachersTab from "./admin/TeachersTab";
import ParentsTab from "./admin/ParentsTab";
import StudentsTab from "./admin/StudentsTab";
import AttendanceTab from "./admin/AttendanceTab";
import FeesTab from "./admin/FeesTab";
import EventsTab from "./admin/EventsTab";
import SettingsTab from "./admin/SettingsTab";
import {
  LayoutGrid, Building2, GraduationCap, Users2, Baby, CalendarCheck2,
  Wallet, CalendarClock, Clapperboard, Settings, UserCog,
} from "lucide-react";

const NAV = [
  { key: "Overview", label: "Overview", icon: LayoutGrid },
  { group: "School" },
  { key: "Classes", label: "Classes", icon: Building2 },
  { key: "Teachers", label: "Teachers", icon: GraduationCap },
  { key: "Parents", label: "Parents", icon: Users2 },
  { key: "Students", label: "Students", icon: Baby },
  { group: "Day to day" },
  { key: "Attendance", label: "Attendance", icon: CalendarCheck2 },
  { key: "Fees", label: "Fees", icon: Wallet },
  { key: "Events", label: "Events", icon: CalendarClock },
  { key: "Learning", label: "Learning World", icon: Clapperboard },
  { group: "You" },
  { key: "Settings", label: "School settings", icon: Settings },
  { key: "Profile", label: "My profile", icon: UserCog },
];

const COPY = {
  Overview: ["Overview", "How the school is doing today."],
  Classes: ["Classes", "Create rooms, rename them, and pick who teaches each one."],
  Teachers: ["Teachers", "Staff accounts, IDs and class assignments."],
  Parents: ["Parents", "Family accounts with both guardians' details."],
  Students: ["Students", "The roll, with class, teacher and parent on every row."],
  Attendance: ["Attendance", "Take or correct any register, for children and staff."],
  Fees: ["Fees", "Raise invoices and confirm the payments parents send."],
  Events: ["Events", "Everything on the school calendar, with photos."],
  Learning: ["Learning World", "Choose the videos and lessons children see in Child Mode."],
  Settings: ["School settings", "Contact details and the QR code parents pay with."],
  Profile: ["My profile", "Your name, photo and password."],
};

export default function AdminDashboard() {
  const [tab, setTab] = useState("Overview");
  const [classes, setClasses] = useState([]);
  const { user, logout } = useAuth();

  useEffect(() => {
    api.get("/api/admin/classrooms").then((res) => setClasses(res.data)).catch(() => {});
  }, []);

  const [title, description] = COPY[tab] || [tab, ""];
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <AppShell
      role="admin"
      roleLabel="Administrator"
      navItems={NAV}
      activeNav={tab}
      onNavChange={setTab}
      userName={user?.name}
      userPhoto={user?.photo}
      onLogout={logout}
    >
      <PageHeader
        eyebrow="Admin"
        title={tab === "Overview" ? `Good to see you, ${firstName}` : title}
        description={description}
      />

      {tab === "Overview" && <OverviewTab onOpen={setTab} />}
      {tab === "Classes" && <ClassesTab />}
      {tab === "Teachers" && <TeachersTab />}
      {tab === "Parents" && <ParentsTab />}
      {tab === "Students" && <StudentsTab />}
      {tab === "Attendance" && <AttendanceTab />}
      {tab === "Fees" && <FeesTab />}
      {tab === "Events" && <EventsTab />}
      {tab === "Learning" && <ContentManager role="admin" classes={classes} />}
      {tab === "Settings" && <SettingsTab />}
      {tab === "Profile" && <ProfilePanel />}
    </AppShell>
  );
}
