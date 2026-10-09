import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api, { mediaUrl } from "../api/client";
import ChildModeGuard from "../components/ChildModeGuard";
import {
  playCorrect,
  playPop,
  playTap,
  playTryAgain,
  speak,
  speakThen,
  stopSpeaking,
  useVoice,
} from "../utils/voice";
import "./child-mode.css";

/* ------------------------------------------------------------------ cast */
/** Three cartoon friends who greet the child on the way in. */
function Bear() {
  return (
    <svg viewBox="0 0 120 140" fill="none" aria-hidden="true">
      <circle cx="30" cy="34" r="16" fill="#B07A4E" /><circle cx="90" cy="34" r="16" fill="#B07A4E" />
      <circle cx="30" cy="34" r="8" fill="#E9C6A4" /><circle cx="90" cy="34" r="8" fill="#E9C6A4" />
      <rect x="28" y="86" width="64" height="50" rx="24" fill="#FF8A3D" />
      <circle cx="60" cy="58" r="38" fill="#C98A58" />
      <ellipse cx="60" cy="72" rx="20" ry="15" fill="#F0D6BA" />
      <ellipse cx="60" cy="64" rx="7" ry="5" fill="#4A3220" />
      <path d="M53 74c3 4 11 4 14 0" stroke="#4A3220" strokeWidth="3" strokeLinecap="round" />
      <circle cx="46" cy="50" r="4.5" fill="#3A2A20" /><circle cx="74" cy="50" r="4.5" fill="#3A2A20" />
      <circle cx="47.5" cy="48.5" r="1.6" fill="#fff" /><circle cx="75.5" cy="48.5" r="1.6" fill="#fff" />
    </svg>
  );
}

function Bunny() {
  return (
    <svg viewBox="0 0 120 150" fill="none" aria-hidden="true">
      <ellipse cx="44" cy="30" rx="11" ry="27" fill="#F5F0FF" />
      <ellipse cx="76" cy="30" rx="11" ry="27" fill="#F5F0FF" />
      <ellipse cx="44" cy="32" rx="5" ry="18" fill="#FFC3D8" />
      <ellipse cx="76" cy="32" rx="5" ry="18" fill="#FFC3D8" />
      <rect x="30" y="96" width="60" height="48" rx="23" fill="#7BC6FF" />
      <circle cx="60" cy="76" r="33" fill="#F5F0FF" />
      <circle cx="48" cy="72" r="4.2" fill="#3A2A20" /><circle cx="72" cy="72" r="4.2" fill="#3A2A20" />
      <circle cx="49.4" cy="70.6" r="1.5" fill="#fff" /><circle cx="73.4" cy="70.6" r="1.5" fill="#fff" />
      <path d="M60 82c-3 0-5 2-5 4s2 4 5 4 5-2 5-4-2-4-5-4Z" fill="#FF8FB0" />
      <circle cx="40" cy="82" r="5" fill="#FFC3D8" opacity="0.8" />
      <circle cx="80" cy="82" r="5" fill="#FFC3D8" opacity="0.8" />
    </svg>
  );
}

function Owl() {
  return (
    <svg viewBox="0 0 120 140" fill="none" aria-hidden="true">
      <path d="M26 44c0-18 15-32 34-32s34 14 34 32v44c0 22-15 38-34 38S26 110 26 88V44Z" fill="#9B7BE8" />
      <path d="M26 44c6-4 14-14 12-24 9 2 16 8 20 14M94 44c-6-4-14-14-12-24-9 2-16 8-20 14" fill="#8A68DF" />
      <ellipse cx="60" cy="104" rx="26" ry="22" fill="#CBBDF7" />
      <circle cx="44" cy="58" r="16" fill="#fff" /><circle cx="76" cy="58" r="16" fill="#fff" />
      <circle cx="44" cy="58" r="7" fill="#2B2156" /><circle cx="76" cy="58" r="7" fill="#2B2156" />
      <circle cx="46" cy="56" r="2.4" fill="#fff" /><circle cx="78" cy="56" r="2.4" fill="#fff" />
      <path d="M60 68l-8 9h16l-8-9Z" fill="#FFC53D" />
    </svg>
  );
}

function Hills() {
  return (
    <svg className="cm-hills" viewBox="0 0 1200 190" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 96c150-40 260 22 420 6s250-56 400-38 250 54 380 44v82H0V96Z" fill="#8FE3AE" />
      <path d="M0 132c180-32 300 16 470 2s250-40 400-26 230 36 330 30v52H0v-58Z" fill="#5FD38A" />
      <circle cx="170" cy="150" r="10" fill="#FFF3B0" opacity="0.8" />
      <circle cx="980" cy="160" r="8" fill="#FFF3B0" opacity="0.8" />
    </svg>
  );
}

/* ------------------------------------------------------------- mini games */
const COLOURS = [
  { name: "Red", hex: "#E5484D" },
  { name: "Blue", hex: "#3BA0FF" },
  { name: "Yellow", hex: "#FFC53D" },
  { name: "Green", hex: "#34C77B" },
  { name: "Purple", hex: "#8A63E8" },
  { name: "Orange", hex: "#FF7A18" },
];

// What Hoot says when a colour is tapped, tied to something a child knows.
const COLOUR_LINES = {
  Red: "Red! Like a juicy apple.",
  Blue: "Blue! Like the sky.",
  Yellow: "Yellow! Like the bright sun.",
  Green: "Green! Like the grass.",
  Purple: "Purple! Like a sweet grape.",
  Orange: "Orange! Like an orange.",
};

function ColourGame({ onSay }) {
  useEffect(() => {
    speak("Tap a colour and I will tell you its name!");
    return () => stopSpeaking();
  }, []);

  return (
    <div className="cm-swatches">
      {COLOURS.map((c) => (
        <button
          key={c.name}
          className="cm-swatch"
          style={{ background: c.hex }}
          onClick={() => {
            playTap();
            speak(COLOUR_LINES[c.name] || `${c.name}!`);
            onSay(c.name);
          }}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five"];

function CountingGame({ onScore }) {
  const [round, setRound] = useState(() => newCountingRound());
  const [picked, setPicked] = useState(null);

  function newCountingRound() {
    const count = Math.floor(Math.random() * 5) + 1;
    const emoji = ["🍎", "🐤", "⭐", "🎈", "🐟", "🌻"][Math.floor(Math.random() * 6)];
    const options = new Set([count]);
    while (options.size < 3) options.add(Math.floor(Math.random() * 5) + 1);
    return { count, emoji, options: [...options].sort(() => Math.random() - 0.5) };
  }

  // Ask the question each time a new round appears.
  useEffect(() => {
    speak("How many do you see?");
    return () => stopSpeaking();
  }, [round]);

  function choose(n) {
    setPicked(n);
    if (n === round.count) {
      onScore(true);
      playCorrect();
      // Let Hoot finish the praise before the next round replaces it.
      speakThen(`Yes! There are ${NUMBER_WORDS[round.count]}. Well done!`, () => {
        setPicked(null);
        setRound(newCountingRound());
      });
    } else {
      onScore(false);
      playTryAgain();
      // A wrong answer becomes a mini counting lesson.
      const counting = NUMBER_WORDS.slice(1, round.count + 1).join(", ");
      speak(`Not quite. Let's count together. ${counting}. Now try again!`);
      setTimeout(() => setPicked(null), 800);
    }
  }

  return (
    <div>
      <div className="cm-counter">{round.emoji.repeat(round.count)}</div>
      <p style={{ textAlign: "center", fontSize: 20, fontWeight: 700 }}>How many do you see?</p>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <button type="button" className="cm-sound-toggle cm-sound-toggle--on" onClick={() => speak("How many do you see?")}>
          🔊 Listen again
        </button>
      </div>
      <div className="cm-choices">
        {round.options.map((n) => (
          <button
            key={n}
            className={`cm-choice ${picked === n ? (n === round.count ? "is-right" : "is-wrong") : ""}`}
            onClick={() => choose(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

const LETTER_WORDS = [
  { letter: "A", options: ["Apple", "Ball", "Cat"], answer: "Apple" },
  { letter: "B", options: ["Dog", "Ball", "Egg"], answer: "Ball" },
  { letter: "C", options: ["Cat", "Fish", "Hat"], answer: "Cat" },
  { letter: "D", options: ["Sun", "Duck", "Moon"], answer: "Duck" },
  { letter: "E", options: ["Egg", "Tree", "Star"], answer: "Egg" },
];

function LetterGame({ onScore }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const round = LETTER_WORDS[index % LETTER_WORDS.length];

  const question = `Which word starts with the letter ${round.letter}?`;

  // Say the letter and ask the question each time a new letter appears.
  useEffect(() => {
    speak(`The letter ${round.letter}. ${question}`);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function choose(word) {
    setPicked(word);
    const right = word === round.answer;
    onScore(right);
    if (right) {
      playCorrect();
      // Let Hoot finish the praise before the next letter replaces it.
      speakThen(`Yes! ${word} starts with ${round.letter}. Well done!`, () => {
        setPicked(null);
        setIndex((i) => i + 1);
      });
    } else {
      playTryAgain();
      speak(`${word}. Not quite. Try again!`);
      setTimeout(() => setPicked(null), 900);
    }
  }

  return (
    <div>
      <div className="cm-counter">{round.letter}</div>
      <p style={{ textAlign: "center", fontSize: 20, fontWeight: 700 }}>
        Which word starts with {round.letter}?
      </p>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <button type="button" className="cm-sound-toggle cm-sound-toggle--on" onClick={() => speak(question)}>
          🔊 Listen again
        </button>
      </div>
      <div className="cm-choices">
        {round.options.map((w) => (
          <button
            key={w}
            className={`cm-choice ${picked === w ? (w === round.answer ? "is-right" : "is-wrong") : ""}`}
            style={{ fontSize: 22 }}
            onClick={() => choose(w)}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- AI buddy */
const QUICK_ASKS = ["Tell me a story", "Sing a rhyme", "Teach me ABC", "Ask me a riddle", "What is a cow?", "Tell me a joke"];
const HOOT_GREETING = "Hi friend! I'm Hoot. Ask me for a story, a rhyme, a riddle, or anything about animals, letters and numbers!";
const HISTORY_TURNS = 10; // how much of the chat Hoot gets to remember

function AIBuddy({ studentId }) {
  const [messages, setMessages] = useState([{ from: "buddy", text: HOOT_GREETING }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const chatRef = useRef(null);

  // Hoot greets the child when the chat opens, and goes quiet when they leave.
  useEffect(() => {
    speak(HOOT_GREETING);
    return () => stopSpeaking();
  }, []);

  // Keep the newest message in view (long stories scroll).
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  function buddySays(text) {
    setMessages((m) => [...m, { from: "buddy", text }]);
    playPop();
    speak(text);
  }

  async function send(text) {
    const message = (text ?? draft).trim();
    if (!message || busy) return;

    // What was said so far, so "tell me another one" makes sense to Hoot.
    const history = messages
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.from === "buddy" ? "assistant" : "user", text: m.text }));

    stopSpeaking(); // a new question interrupts the old story
    setMessages((m) => [...m, { from: "child", text: message }]);
    setDraft("");
    setBusy(true);
    try {
      const res = await api.post(
        "/api/child/ai-buddy/chat",
        { student_id: Number(studentId), user_type: "child", message, history },
        { timeout: 60000 },
      );
      buddySays(res.data.reply);
    } catch {
      // The child should never see an error message — Hoot just asks again.
      buddySays("Hmm, let me think again. Can you ask me one more time?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="cm-chat" ref={chatRef}>
        {messages.map((m, i) => (
          <div key={i} className={`cm-bubble cm-bubble--${m.from}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="cm-bubble cm-bubble--buddy">Thinking…</div>}
      </div>

      <form
        className="cm-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="cm-chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something to Hoot…"
        />
        <button className="cm-send" type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>

      <div className="cm-quick">
        {QUICK_ASKS.map((q) => (
          <button key={q} onClick={() => send(q)} type="button">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */
const BUILT_IN = [
  { key: "colours", emoji: "🎨", title: "Colours", meta: "Tap and learn", tone: "pink" },
  { key: "counting", emoji: "🔢", title: "Counting", meta: "Count the things", tone: "blue" },
  { key: "letters", emoji: "🔤", title: "Letters", meta: "A B C", tone: "yellow" },
  { key: "buddy", emoji: "🦉", title: "Ask Hoot", meta: "Your learning buddy", tone: "purple" },
];

const TILE_TONES = ["green", "pink", "blue", "yellow", "purple"];

/** One switch for all of Child Mode's sound, plus a Stop button while Hoot is mid-story. */
function SoundBar() {
  const { muted, speaking, setMuted, stop } = useVoice();
  return (
    <div className="cm-chat-toolbar">
      {speaking && (
        <button type="button" className="cm-sound-toggle cm-sound-toggle--on" onClick={stop}>
          ⏹ Stop
        </button>
      )}
      <button
        type="button"
        className={`cm-sound-toggle ${muted ? "" : "cm-sound-toggle--on"}`}
        onClick={() => setMuted(!muted)}
        aria-pressed={!muted}
        title={muted ? "Turn sound on" : "Turn sound off"}
      >
        {muted ? "🔇 Sound off" : "🔊 Sound on"}
      </button>
    </div>
  );
}

export default function ChildDashboard() {
  const { studentId } = useParams();
  const [started, setStarted] = useState(false);
  const [view, setView] = useState(null); // null = tile grid
  const [videos, setVideos] = useState([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [reward, setReward] = useState("");

  useEffect(() => {
    api
      .get(`/api/child/content/${studentId}`)
      .then((res) => setVideos(res.data))
      .catch(() => setVideos([]));
  }, [studentId]);

  // Every 5 right answers is worth a star, recorded against the child's quizzes.
  useEffect(() => {
    if (score > 0 && score % 5 === 0) {
      api
        .post("/api/child/quiz-result", {
          student_id: Number(studentId),
          quiz_name: "Play and learn",
          score: 100,
        })
        .then((res) => {
          if (res.data.reward) showReward("You earned a star! ⭐");
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  function showReward(text) {
    setReward(text);
    playCorrect(); // a chime rather than speech, so it never cuts off Hoot mid-sentence
    setTimeout(() => setReward(""), 3200);
  }

  function onScore(right) {
    setFeedback(right ? "Yes! Well done! 🎉" : "Not quite — try again!");
    if (right) setScore((s) => s + 1);
    setTimeout(() => setFeedback(""), 1400);
  }

  const openVideo = useMemo(() => videos.find((v) => `video-${v.content_id}` === view), [videos, view]);

  if (!started) {
    return (
      <div className="cm">
        <div className="cm-sun" />
        <div className="cm-cloud cm-cloud--a" />
        <div className="cm-cloud cm-cloud--b" />
        <div className="cm-splash">
          <div className="cm-splash__cast">
            <Bear />
            <Bunny />
            <Owl />
          </div>
          <div className="cm-splash__hello">Welcome to Learning World!</div>
          <div className="cm-splash__sub">Bruno, Bella and Hoot are waiting to play.</div>
          <button
            className="cm-bigbtn"
            onClick={() => {
              playPop();
              speak("Welcome to Learning World! Bruno, Bella and Hoot are waiting to play. What shall we do today?");
              setStarted(true);
            }}
          >
            Let's play! 🎈
          </button>
        </div>
        <Hills />
      </div>
    );
  }

  return (
    <ChildModeGuard studentId={Number(studentId)} onReward={showReward}>
      <div className="cm">
        <div className="cm-sun" />
        <div className="cm-cloud cm-cloud--a" />
        <div className="cm-cloud cm-cloud--b" />

        <div className="cm-stage">
          <SoundBar />
          {!view && (
            <>
              <div className="cm-greeting">What shall we do today?</div>
              <div className="cm-sub">Tap a picture to start playing.</div>
              {score > 0 && (
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <span className="cm-score">⭐ {score} right answers</span>
                </div>
              )}

              <div className="cm-tiles">
                {BUILT_IN.map((t) => (
                  <button
                    key={t.key}
                    className={`cm-tile cm-tile--${t.tone}`}
                    onClick={() => {
                      playTap();
                      setView(t.key);
                    }}
                  >
                    <span className="cm-tile__emoji">{t.emoji}</span>
                    <span className="cm-tile__title">{t.title}</span>
                    <span className="cm-tile__meta">{t.meta}</span>
                  </button>
                ))}
              </div>

              {videos.length > 0 && (
                <>
                  <div className="cm-section-title">Watch and learn 🎬</div>
                  <div className="cm-tiles">
                    {videos.map((v, i) => (
                      <button
                        key={v.content_id}
                        className={`cm-tile cm-tile--${TILE_TONES[i % TILE_TONES.length]}`}
                        onClick={() => {
                          stopSpeaking(); // don't talk over the video
                          playTap();
                          setView(`video-${v.content_id}`);
                        }}
                      >
                        <span className="cm-tile__emoji">{v.emoji || "🎬"}</span>
                        <span className="cm-tile__title">{v.title}</span>
                        <span className="cm-tile__meta">{v.category}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {view && (
            <div className="cm-panel">
              <div className="cm-panel__head">
                <div className="cm-panel__title">
                  {view === "colours" && "🎨 Colours"}
                  {view === "counting" && "🔢 Counting"}
                  {view === "letters" && "🔤 Letters"}
                  {view === "buddy" && "🦉 Ask Hoot"}
                  {openVideo && `${openVideo.emoji || "🎬"} ${openVideo.title}`}
                </div>
                <button className="cm-back" onClick={() => setView(null)}>
                  ← Back
                </button>
              </div>

              {view === "colours" && <ColourGame onSay={(name) => setFeedback(`That's ${name}! 🌈`)} />}
              {view === "counting" && <CountingGame onScore={onScore} />}
              {view === "letters" && <LetterGame onScore={onScore} />}
              {view === "buddy" && <AIBuddy studentId={studentId} />}

              {openVideo && (
                <div>
                  {openVideo.content_type === "link" ? (
                    <a className="cm-bigbtn" href={openVideo.media_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", textDecoration: "none" }}>
                      Watch now ▶
                    </a>
                  ) : (
                    <video className="cm-video" src={mediaUrl(openVideo.media_url)} controls autoPlay playsInline />
                  )}
                  {openVideo.description && <p className="cm-video-note">{openVideo.description}</p>}
                </div>
              )}

              {feedback && <div className="cm-feedback">{feedback}</div>}
            </div>
          )}
        </div>

        <Hills />
        {reward && <div className="cm-reward">{reward}</div>}
      </div>
    </ChildModeGuard>
  );
}
