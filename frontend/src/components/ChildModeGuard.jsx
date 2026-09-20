import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "../pages/child-mode.css";

const SESSION_MINUTES = 30; // could be made parent-configurable later

/**
 * Wraps the Child Learning screen with "Child Mode" chrome:
 *  - Requests fullscreen and blocks the browser back button
 *  - Runs a countdown session timer
 *  - Detects when the child leaves the tab/app and shows a focus warning
 *  - Requires the parent's 4-digit PIN to exit back to login
 *  - Ends the backend session (which may award a "stayed focused" star) on exit
 */
export default function ChildModeGuard({ studentId, children, onReward }) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(SESSION_MINUTES * 60);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isFocused, setIsFocused] = useState(true);
  const [timeUp, setTimeUp] = useState(false);

  const sessionIdRef = useRef(null);
  const focusBreaksRef = useRef(0);
  const endedRef = useRef(false);

  useEffect(() => {
    api
      .post("/api/child/session/start", { student_id: studentId })
      .then((res) => {
        sessionIdRef.current = res.data.session_id;
      })
      .catch(() => {});

    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Fullscreen without a direct user gesture can be blocked by the
        // browser — Child Mode still works without it.
      });
    }

    // Discourage the browser back button from leaving the learning screen
    window.history.pushState(null, "", window.location.href);
    const blockBack = () => window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", blockBack);

    // Best-effort session close if the tab/browser is closed outright —
    // sendBeacon fires even as the page is unloading, unlike a normal fetch.
    const beaconEnd = () => {
      if (endedRef.current || !sessionIdRef.current) return;
      const payload = JSON.stringify({ session_id: sessionIdRef.current, focus_breaks: focusBreaksRef.current });
      const base = api.defaults.baseURL || "";
      navigator.sendBeacon?.(`${base}/api/child/session/end`, new Blob([payload], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", beaconEnd);

    return () => {
      window.removeEventListener("popstate", blockBack);
      window.removeEventListener("beforeunload", beaconEnd);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (timeUp) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setTimeUp(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeUp]);

  const handleFocusLoss = useCallback(() => {
    setIsFocused(false);
    focusBreaksRef.current += 1;
    if (sessionIdRef.current) {
      api.post("/api/child/session/focus-break", { session_id: sessionIdRef.current }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) handleFocusLoss();
      else setIsFocused(true);
    }
    function onBlur() {
      handleFocusLoss();
    }
    function onFocus() {
      setIsFocused(true);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [handleFocusLoss]);

  async function endSession() {
    if (endedRef.current || !sessionIdRef.current) return;
    endedRef.current = true;
    try {
      const res = await api.post("/api/child/session/end", {
        session_id: sessionIdRef.current,
        focus_breaks: focusBreaksRef.current,
      });
      if (res.data.reward_earned && onReward) {
        onReward("Stayed focused for the whole session! ⭐");
      }
    } catch {
      // exiting should never get stuck on a network error
    }
  }

  async function handleExitSubmit(e) {
    e.preventDefault();
    setPinError("");
    try {
      const res = await api.post("/api/child/exit-pin/verify", { student_id: studentId, pin });
      if (res.data.valid) {
        await endSession();
        navigate("/login");
      } else {
        setPinError("That PIN isn't right. Ask a parent for help.");
        setPin("");
      }
    } catch {
      setPinError("Couldn't check the PIN. Ask a parent for help.");
    }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <div className="cm-topbar">
        <div className="cm-timer">
          ⏱ {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        <button className="cm-lock-btn" onClick={() => setShowExitPrompt(true)}>
          🔒 Parent exit
        </button>
      </div>

      {children}

      {!isFocused && !showExitPrompt && !timeUp && (
        <div className="cm-overlay">
          <div className="cm-overlay-card">
            <div className="cm-overlay-icon">👀</div>
            <h2>Stay focused!</h2>
            <p>Come back to keep learning and earn your star.</p>
          </div>
        </div>
      )}

      {timeUp && (
        <div className="cm-overlay">
          <div className="cm-overlay-card">
            <div className="cm-overlay-icon">⏰</div>
            <h2>Learning time is over!</h2>
            <p>Great job today. Ask a parent to unlock more time.</p>
            <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => setShowExitPrompt(true)}>
              Enter parent PIN
            </button>
          </div>
        </div>
      )}

      {showExitPrompt && (
        <div className="cm-overlay">
          <form className="cm-overlay-card" onSubmit={handleExitSubmit}>
            <div className="cm-overlay-icon">🔒</div>
            <h2>Parent PIN</h2>
            <p>Enter your 4-digit PIN to leave Child Mode.</p>
            <input
              className="cm-pin-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            {pinError && <p style={{ color: "var(--color-danger)", fontSize: 12.5, marginTop: 8 }}>{pinError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16, width: "100%" }}>
              <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={() => setShowExitPrompt(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>
                Exit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
