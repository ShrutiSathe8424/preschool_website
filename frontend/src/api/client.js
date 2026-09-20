import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

// Attach the saved token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is invalid or expired, send the user back to the login screen
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

/** Turns a stored "/uploads/x.png" path into a full URL the browser can load. */
export function mediaUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Pulls a readable message out of an axios error. */
export function errorMessage(err, fallback = "Something went wrong. Try again.") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (err?.message === "Network Error") return "Can't reach the server. Is the backend running?";
  return fallback;
}

export default api;
