import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/client";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import { Banner } from "../components/ui/Feedback";
import { ShieldCheck, GraduationCap, Users2 } from "lucide-react";
import "./login.css";

const ROLES = [
  { value: "admin", label: "Admin", icon: ShieldCheck },
  { value: "teacher", label: "Teacher", icon: GraduationCap },
  { value: "parent", label: "Parent", icon: Users2 },
];

/** The playground below the headline: hills, a sun, and three children. */
function Scene() {
  return (
    <svg className="login__scene" viewBox="0 0 520 190" fill="none" aria-hidden="true">
      <circle cx="446" cy="40" r="26" fill="#FFC53D" opacity="0.9" />
      <ellipse cx="90" cy="34" rx="30" ry="13" fill="#fff" opacity="0.28" />
      <ellipse cx="118" cy="30" rx="20" ry="11" fill="#fff" opacity="0.28" />
      <path d="M0 132c70-34 128 10 196-8s108-46 176-28 98 40 148 34v60H0v-58Z" fill="#fff" opacity="0.14" />
      <path d="M0 152c86-26 140 6 214-10s116-30 176-14 84 28 130 26v36H0v-38Z" fill="#fff" opacity="0.2" />
      {/* child in green */}
      <g transform="translate(150 96)">
        <rect x="6" y="26" width="28" height="34" rx="12" fill="#34C77B" />
        <circle cx="20" cy="16" r="14" fill="#FFD9B8" />
        <path d="M6 14a14 14 0 0 1 28 0c-6-4-22-4-28 0Z" fill="#3A2A20" />
        <circle cx="15" cy="17" r="1.8" fill="#3A2A20" />
        <circle cx="25" cy="17" r="1.8" fill="#3A2A20" />
        <path d="M16 23c2 2 6 2 8 0" stroke="#3A2A20" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* child in pink, waving */}
      <g transform="translate(236 86)">
        <rect x="6" y="28" width="30" height="40" rx="13" fill="#FF4E8B" />
        <path d="M36 34c6-3 9-9 9-14" stroke="#FFD9B8" strokeWidth="6" strokeLinecap="round" />
        <circle cx="21" cy="17" r="15" fill="#FFD9B8" />
        <path d="M6 17a15 15 0 0 1 30 0c-3-8-27-8-30 0Z" fill="#5B3A1E" />
        <circle cx="16" cy="18" r="1.9" fill="#3A2A20" />
        <circle cx="26" cy="18" r="1.9" fill="#3A2A20" />
        <path d="M17 24c2 2.5 6 2.5 8 0" stroke="#3A2A20" strokeWidth="1.7" strokeLinecap="round" />
      </g>
      {/* child in yellow, with a book */}
      <g transform="translate(322 100)">
        <rect x="6" y="24" width="27" height="32" rx="11" fill="#FFC53D" />
        <rect x="8" y="34" width="24" height="13" rx="2.5" fill="#fff" opacity="0.9" />
        <circle cx="19" cy="14" r="13" fill="#FFD9B8" />
        <path d="M6 13a13 13 0 0 1 26 0c-5-6-21-6-26 0Z" fill="#2E2116" />
        <circle cx="14" cy="15" r="1.7" fill="#3A2A20" />
        <circle cx="24" cy="15" r="1.7" fill="#3A2A20" />
        <path d="M15 21c2 2 6 2 8 0" stroke="#3A2A20" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const returnedRole = await login(email, password, role);
      navigate(`/${returnedRole}`);
    } catch (err) {
      setError(errorMessage(err, "That email and password didn't match. Check and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`login role-${role}`}>
      <div className="login__art">
        <div className="login__brand">
          <Logo size={28} mono />
          <span>Sprout</span>
        </div>

        <div className="login__copy">
          <h1 className="login__headline">One calm place for the whole preschool day.</h1>
          <p className="login__sub">
            Attendance, homework, activities and fees for the grown-ups. A guided, PIN-locked
            Learning World for the children.
          </p>
        </div>

        <div className="login__roles">
          <span className="login__chip">Admin</span>
          <span className="login__chip">Teacher</span>
          <span className="login__chip">Parent</span>
          <span className="login__chip login__chip--child">Child Mode</span>
        </div>

        <Scene />
      </div>

      <div className="login__side">
        <form className="login__card" onSubmit={handleSubmit}>
          <h2 className="login__title">Sign in</h2>
          <p className="login__hint">Pick who you are, then use your school email.</p>

          <div className="login__roleRow">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`login__roleBtn ${role === r.value ? "is-on" : ""}`}
                aria-pressed={role === r.value}
              >
                <r.icon size={19} strokeWidth={2.2} />
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.com"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
          </div>

          <Banner tone="error">{error}</Banner>

          <Button type="submit" loading={loading} block size="lg" style={{ marginTop: 20 }}>
            {loading ? "Signing in" : "Sign in"}
          </Button>

          <p className="login__foot">
            Children don't sign in here. A parent opens Child Mode from their own dashboard.
          </p>
        </form>
      </div>
    </div>
  );
}
