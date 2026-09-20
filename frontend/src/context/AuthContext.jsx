import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

function readStored() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return {
    token,
    role: localStorage.getItem("role"),
    name: localStorage.getItem("name"),
    userId: localStorage.getItem("user_id"),
    photo: localStorage.getItem("photo") || "",
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStored);

  async function login(email, password, role) {
    const res = await api.post("/api/auth/login", { email, password, role });
    const { access_token, role: returnedRole, name, user_id, profile_photo } = res.data;

    localStorage.setItem("token", access_token);
    localStorage.setItem("role", returnedRole);
    localStorage.setItem("name", name);
    localStorage.setItem("user_id", user_id);
    localStorage.setItem("photo", profile_photo || "");

    setUser({ token: access_token, role: returnedRole, name, userId: user_id, photo: profile_photo || "" });
    return returnedRole;
  }

  /** Keeps the sidebar name and photo in step after a profile edit. */
  const applyProfile = useCallback((profile) => {
    if (!profile) return;
    localStorage.setItem("name", profile.name || "");
    localStorage.setItem("photo", profile.profile_photo || "");
    setUser((prev) => (prev ? { ...prev, name: profile.name, photo: profile.profile_photo || "" } : prev));
  }, []);

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  // Refresh the display details once on load so a profile edited elsewhere shows up.
  useEffect(() => {
    if (!user?.token) return;
    api.get("/api/auth/me").then((res) => applyProfile(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, applyProfile }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
