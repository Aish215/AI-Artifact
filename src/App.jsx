import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQ_OPTIONS = ["Daily", "Weekly", "Custom"];
const EMOJIS = ["💪", "📚", "🏃", "🧘", "💧", "🥗", "😴", "✍️", "🎯", "🎨", "🎵", "🧹"];
const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

const getToday = () => new Date().toISOString().slice(0, 10);
const getWeekDates = () => {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i);
    return d.toISOString().slice(0, 10);
  });
};

const calcStreak = (completions = []) => {
  if (!completions.length) return 0;
  const sorted = [...new Set(completions)].sort().reverse();
  let streak = 0, cur = new Date();
  for (const d of sorted) {
    const diff = Math.round((cur - new Date(d)) / 86400000);
    if (diff <= 1) { streak++; cur = new Date(d); }
    else break;
  }
  return streak;
};

const calcLongest = (completions = []) => {
  if (!completions.length) return 0;
  const sorted = [...new Set(completions)].sort();
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000);
    cur = diff === 1 ? cur + 1 : 1;
    max = Math.max(max, cur);
  }
  return max;
};

const emptyForm = () => ({ name: "", emoji: "💪", color: COLORS[0], freq: "Daily", days: [], reminder: "" });

// Shared in-memory users store
const usersDB = {};
const habitsDB = {};

export default function App() {
  const [screen, setScreen] = useState("login");
  const [session, setSession] = useState(null);
  const [habits, setHabits] = useState([]);
  const [authForm, setAuthForm] = useState({ email: "", password: "", error: "" });
  const [habitForm, setHabitForm] = useState(null);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("today");

  const updateHabits = (next) => {
    habitsDB[session] = next;
    setHabits(next);
  };

  const login = () => {
    const { email, password } = authForm;
    if (!email || !password) return setAuthForm(f => ({ ...f, error: "Fill in all fields." }));
    if (!usersDB[email] || usersDB[email] !== password) return setAuthForm(f => ({ ...f, error: "Invalid email or password." }));
    setSession(email);
    setHabits(habitsDB[email] || []);
    setScreen("home");
  };

  const signup = () => {
    const { email, password } = authForm;
    if (!email || !password) return setAuthForm(f => ({ ...f, error: "Fill in all fields." }));
    if (!/\S+@\S+\.\S+/.test(email)) return setAuthForm(f => ({ ...f, error: "Enter a valid email." }));
    if (password.length < 6) return setAuthForm(f => ({ ...f, error: "Password must be 6+ chars." }));
    if (usersDB[email]) return setAuthForm(f => ({ ...f, error: "Email already registered." }));
    usersDB[email] = password;
    habitsDB[email] = [];
    setSession(email);
    setHabits([]);
    setScreen("home");
  };

  const logout = () => {
    setSession(null); setHabits([]);
    setAuthForm({ email: "", password: "", error: "" });
    setScreen("login");
  };

  const toggleComplete = (id, date = getToday()) => {
    const next = habits.map(h => {
      if (h.id !== id) return h;
      const c = h.completions || [];
      return { ...h, completions: c.includes(date) ? c.filter(d => d !== date) : [...c, date] };
    });
    updateHabits(next);
  };

  const saveHabit = () => {
    if (!habitForm.name.trim()) return;
    let next;
    if (habitForm.id) {
      next = habits.map(h => h.id === habitForm.id ? { ...habitForm } : h);
    } else {
      next = [...habits, { ...habitForm, id: Date.now().toString(), completions: [] }];
    }
    updateHabits(next);
    setHabitForm(null);
    setScreen("home");
  };

  const deleteHabit = (id) => {
    updateHabits(habits.filter(h => h.id !== id));
    setSelected(null); setScreen("home");
  };

  const openAdd = () => { setHabitForm(emptyForm()); setScreen("add"); };
  const openEdit = (h) => { setHabitForm({ ...h }); setScreen("add"); };

  const today = getToday();
  const weekDates = getWeekDates();

  const isDueToday = (h) => {
    const dow = new Date().getDay();
    if (h.freq === "Daily") return true;
    if (h.freq === "Weekly") return dow === 0;
    if (h.freq === "Custom") return (h.days || []).includes(dow);
    return true;
  };

  const todayHabits = habits.filter(isDueToday);
  const completedToday = todayHabits.filter(h => (h.completions || []).includes(today)).length;

  // ---- AUTH ----
  if (screen === "login" || screen === "signup") {
    const isLogin = screen === "login";
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 36, width: 320, boxShadow: "0 2px 16px #0001" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#111" }}>🎯 HabitFlow</h1>
          <p style={{ margin: "0 0 24px", color: "#888", fontSize: 14 }}>{isLogin ? "Welcome back!" : "Create your account"}</p>
          <input placeholder="Email" value={authForm.email}
            onChange={e => setAuthForm(f => ({ ...f, email: e.target.value, error: "" }))}
            style={inputStyle} />
          <input placeholder="Password" type="password" value={authForm.password}
            onChange={e => setAuthForm(f => ({ ...f, password: e.target.value, error: "" }))}
            onKeyDown={e => e.key === "Enter" && (isLogin ? login() : signup())}
            style={inputStyle} />
          {authForm.error && <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 12px" }}>{authForm.error}</p>}
          <button onClick={isLogin ? login : signup} style={btnPrimary}>{isLogin ? "Log In" : "Sign Up"}</button>
          <p style={{ textAlign: "center", fontSize: 13, color: "#888", marginTop: 16 }}>
            {isLogin ? "No account? " : "Have an account? "}
            <span onClick={() => setScreen(isLogin ? "signup" : "login")}
              style={{ color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
              {isLogin ? "Sign up" : "Log in"}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ---- ADD / EDIT ----
  if (screen === "add" && habitForm) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <button onClick={() => { setHabitForm(null); setScreen("home"); }} style={backBtn}>← Back</button>
          <h2 style={headerTitle}>{habitForm.id ? "Edit Habit" : "New Habit"}</h2>
          <div style={{ width: 48 }} />
        </div>
        <div style={{ padding: "16px 20px 40px" }}>
          <label style={labelStyle}>Name</label>
          <input placeholder="e.g. Morning Run" value={habitForm.name}
            onChange={e => setHabitForm(f => ({ ...f, name: e.target.value }))}
            style={inputStyle} />

          <label style={labelStyle}>Icon</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setHabitForm(f => ({ ...f, emoji: e }))}
                style={{ fontSize: 22, background: habitForm.emoji === e ? "#ede9fe" : "#f3f4f6", border: habitForm.emoji === e ? "2px solid #6366f1" : "2px solid transparent", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>{e}</button>
            ))}
          </div>

          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setHabitForm(f => ({ ...f, color: c }))}
                style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: habitForm.color === c ? "3px solid #111" : "3px solid transparent", cursor: "pointer" }} />
            ))}
          </div>

          <label style={labelStyle}>Frequency</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {FREQ_OPTIONS.map(f => (
              <button key={f} onClick={() => setHabitForm(hf => ({ ...hf, freq: f }))}
                style={{ padding: "6px 16px", borderRadius: 20, border: "none", background: habitForm.freq === f ? "#6366f1" : "#f3f4f6", color: habitForm.freq === f ? "#fff" : "#555", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{f}</button>
            ))}
          </div>

          {habitForm.freq === "Custom" && (
            <>
              <label style={labelStyle}>Days</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {DAYS.map((d, i) => (
                  <button key={d} onClick={() => setHabitForm(f => ({ ...f, days: f.days.includes(i) ? f.days.filter(x => x !== i) : [...f.days, i] }))}
                    style={{ padding: "5px 8px", borderRadius: 8, border: "none", background: (habitForm.days || []).includes(i) ? "#6366f1" : "#f3f4f6", color: (habitForm.days || []).includes(i) ? "#fff" : "#555", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{d}</button>
                ))}
              </div>
            </>
          )}

          <label style={labelStyle}>Reminder Time (optional)</label>
          <input type="time" value={habitForm.reminder || ""}
            onChange={e => setHabitForm(f => ({ ...f, reminder: e.target.value }))}
            style={{ ...inputStyle, width: "160px" }} />

          <button onClick={saveHabit} style={{ ...btnPrimary, marginTop: 12 }}>
            {habitForm.id ? "Update Habit" : "Add Habit"}
          </button>
          {habitForm.id && (
            <button onClick={() => deleteHabit(habitForm.id)}
              style={{ ...btnPrimary, background: "#fee2e2", color: "#ef4444", marginTop: 10 }}>
              Delete Habit
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- DETAIL ----
  if (screen === "detail" && selected) {
    const h = habits.find(x => x.id === selected);
    if (!h) { setScreen("home"); return null; }
    const streak = calcStreak(h.completions);
    const longest = calcLongest(h.completions);
    const total = (h.completions || []).length;

    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <button onClick={() => setScreen("home")} style={backBtn}>← Back</button>
          <h2 style={headerTitle}>{h.emoji} {h.name}</h2>
          <button onClick={() => openEdit(h)} style={{ background: "none", border: "none", color: "#6366f1", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Edit</button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[["🔥 Streak", streak + " days"], ["🏆 Longest", longest + " days"], ["✅ Total", total + " days"]].map(([l, v]) => (
              <div key={l} style={{ background: "#f9fafb", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>{v}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#555", marginBottom: 10 }}>This Week</h3>
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {weekDates.map((d, i) => {
              const done = (h.completions || []).includes(d);
              const isT = d === today;
              return (
                <div key={d} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: isT ? "#6366f1" : "#aaa", fontWeight: isT ? 700 : 400, marginBottom: 4 }}>{DAYS[i]}</div>
                  <div onClick={() => toggleComplete(h.id, d)}
                    style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: done ? h.color : "#f3f4f6", border: isT ? `2px solid ${h.color}` : "2px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>
                    {done ? "✓" : ""}
                  </div>
                </div>
              );
            })}
          </div>
          {h.reminder && (
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: 14 }}>
              <span style={{ fontSize: 14, color: "#555" }}>🔔 Reminder set at {h.reminder}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- HOME ----
  return (
    <div style={pageStyle}>
      <div style={{ ...headerStyle, padding: "14px 20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>🎯 HabitFlow</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{session}</p>
        </div>
        <button onClick={logout} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 13 }}>Log out</button>
      </div>

      <div style={{ padding: "16px 20px 80px" }}>
        {/* Progress */}
        <div style={{ background: "#f3f4f6", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>Today's Progress</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>{completedToday}/{todayHabits.length}</span>
          </div>
          <div style={{ height: 6, background: "#e5e7eb", borderRadius: 99 }}>
            <div style={{ height: 6, borderRadius: 99, background: "#6366f1", width: todayHabits.length ? `${(completedToday / todayHabits.length) * 100}%` : "0%", transition: "width .3s" }} />
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["today", "week"].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "6px 16px", borderRadius: 20, border: "none", background: view === v ? "#6366f1" : "#f3f4f6", color: view === v ? "#fff" : "#555", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {v === "today" ? "Today" : "This Week"}
            </button>
          ))}
        </div>

        {habits.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#bbb" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🌱</div>
            <p style={{ fontSize: 14 }}>No habits yet — tap + to add your first one!</p>
          </div>
        ) : view === "today" ? (
          todayHabits.length === 0
            ? <div style={{ textAlign: "center", padding: "40px 0", color: "#bbb", fontSize: 14 }}>No habits scheduled for today.</div>
            : todayHabits.map(h => {
              const done = (h.completions || []).includes(today);
              const streak = calcStreak(h.completions);
              return (
                <div key={h.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px #0001", border: done ? `1.5px solid ${h.color}` : "1.5px solid #f3f4f6" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: h.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{h.emoji}</div>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { setSelected(h.id); setScreen("detail"); }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: "#aaa" }}>🔥 {streak} day streak · {h.freq}</div>
                  </div>
                  <button onClick={() => toggleComplete(h.id)}
                    style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: done ? h.color : "#f3f4f6", color: done ? "#fff" : "#ccc", fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
                    ✓
                  </button>
                </div>
              );
            })
        ) : (
          habits.map(h => {
            const weekDone = weekDates.filter(d => (h.completions || []).includes(d)).length;
            return (
              <div key={h.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 6px #0001" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{h.emoji}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>{h.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>{weekDone}/7</span>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {weekDates.map((d, i) => {
                    const done = (h.completions || []).includes(d);
                    const isT = d === today;
                    return (
                      <div key={d} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: isT ? "#6366f1" : "#ccc", marginBottom: 3 }}>{DAYS[i]}</div>
                        <div onClick={() => toggleComplete(h.id, d)}
                          style={{ height: 24, borderRadius: 6, background: done ? h.color : "#f3f4f6", border: isT ? `1.5px solid ${h.color}` : "1.5px solid transparent", cursor: "pointer" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button onClick={openAdd}
        style={{ position: "fixed", bottom: 28, right: 24, width: 54, height: 54, borderRadius: "50%", background: "#6366f1", color: "#fff", fontSize: 28, border: "none", cursor: "pointer", boxShadow: "0 4px 16px #6366f155", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
        +
      </button>
    </div>
  );
}

const pageStyle = { minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui,sans-serif", maxWidth: 480, margin: "0 auto", position: "relative" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0, zIndex: 10 };
const headerTitle = { margin: 0, fontSize: 17, fontWeight: 700, color: "#111" };
const backBtn = { background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontWeight: 600, fontSize: 14, padding: 0 };
const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit" };
const btnPrimary = { width: "100%", padding: "12px", borderRadius: 10, background: "#6366f1", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 };