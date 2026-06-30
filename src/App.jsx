import { useState, useEffect, useRef } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, provider, db } from "./firebase";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const FREQ_OPTIONS = ["Daily","Weekly","Custom"];
const EMOJIS = ["💪","📚","🏃","🧘","💧","🥗","😴","✍️","🎯","🎨","🎵","🧹"];
const COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#14b8a6"];
const REMARKS = [
  {msg:"⭐ Gold Star for you!",color:"#f59e0b"},
  {msg:"🌟 Excellent!",color:"#6366f1"},
  {msg:"🏆 Wunderbar!",color:"#10b981"},
  {msg:"🎉 You're a STAR!",color:"#ec4899"},
  {msg:"💪 Keep it up!",color:"#3b82f6"},
  {msg:"🔥 On fire today!",color:"#ef4444"},
  {msg:"✨ Superb!",color:"#8b5cf6"},
  {msg:"🎯 Bullseye!",color:"#14b8a6"},
  {msg:"👏 Brilliant!",color:"#f59e0b"},
  {msg:"🦸 Superhero vibes!",color:"#6366f1"},
];

// Preset habit suggestions with icons
const PRESET_HABITS = [
  {name:"Walking",emoji:"🚶"},
  {name:"Yoga",emoji:"🧘"},
  {name:"Meditation",emoji:"🧘‍♂️"},
  {name:"Taking Supplements",emoji:"💊"},
  {name:"Drinking 2L Water",emoji:"💧"},
  {name:"Morning Run",emoji:"🏃"},
  {name:"Reading",emoji:"📚"},
  {name:"Journaling",emoji:"✍️"},
  {name:"Healthy Eating",emoji:"🥗"},
  {name:"Sleep 8 Hours",emoji:"😴"},
  {name:"Stretching",emoji:"🤸"},
  {name:"No Sugar",emoji:"🚫"},
  {name:"Gym Workout",emoji:"🏋️"},
  {name:"Skincare",emoji:"🧴"},
  {name:"Gratitude Practice",emoji:"🙏"},
  {name:"Custom Habit...",emoji:"✏️"},
];

const fmtDate = (d) => d.toISOString().slice(0,10);
const getToday = () => fmtDate(new Date());
const getWeekDates = () => {
  const today = new Date();
  return Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()-today.getDay()+i);return fmtDate(d);});
};
const getLast7Days = () => Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return fmtDate(d);});
const getLast30Days = () => Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-29+i);return fmtDate(d);});
const prettyDate = (dateStr) => {
  const d = new Date(dateStr+"T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(today.getDate()-1);
  if(dateStr===fmtDate(today)) return "Today";
  if(dateStr===fmtDate(yest)) return "Yesterday";
  return d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
};

const calcStreak = (c=[]) => {
  if(!c.length)return 0;
  const s=[...new Set(c)].sort().reverse();
  let n=0,cur=new Date();
  for(const d of s){const diff=Math.round((cur-new Date(d))/86400000);if(diff<=1){n++;cur=new Date(d);}else break;}
  return n;
};
const calcLongest = (c=[]) => {
  if(!c.length)return 0;
  const s=[...new Set(c)].sort();
  let max=1,n=1;
  for(let i=1;i<s.length;i++){const diff=Math.round((new Date(s[i])-new Date(s[i-1]))/86400000);n=diff===1?n+1:1;max=Math.max(max,n);}
  return max;
};
const emptyForm = () => ({name:"",emoji:"💪",color:COLORS[0],freq:"Daily",days:[],reminder:""});

export default function App() {
  const [dark,setDark] = useState(false);
  const [user,setUser] = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [screen,setScreen] = useState("home");
  const [habits,setHabits] = useState([]);
  const [habitsLoading,setHabitsLoading] = useState(false);
  const [habitForm,setHabitForm] = useState(null);
  const [selected,setSelected] = useState(null);
  const [view,setView] = useState("today");
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [dashRange,setDashRange] = useState("weekly");
  const [remark,setRemark] = useState(null);
  const [showPresetDropdown,setShowPresetDropdown] = useState(false);
  const [showHelp,setShowHelp] = useState(false);
  const [helpStep,setHelpStep] = useState(0);
  const [activeDate,setActiveDate] = useState(getToday()); // selected day for "today" tab
  const reminderTimeouts = useRef({});

  const bg=dark?"#0f172a":"#f9fafb", card=dark?"#1e293b":"#fff", border=dark?"#334155":"#f3f4f6";
  const text=dark?"#f1f5f9":"#111", sub=dark?"#94a3b8":"#888";
  const mutedBg=dark?"#283548":"#f3f4f6", mutedText=dark?"#94a3b8":"#555";

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      setUser(u);
      setAuthLoading(false);
      if(u) await loadHabits(u.uid);
      const seenHelp = u && localStorage_get(`help_seen_${u.uid}`);
    });
    return ()=>unsub();
  },[]);

  // Show help popup for first-time users (per session, safe fallback if no localStorage)
  function localStorage_get(){ return null; } // placeholder, in-memory only environment

  useEffect(()=>{
    if(user && !habitsLoading && screen==="home"){
      // show on very first home render
    }
  },[user]);

  // Set up reminder notifications
  useEffect(()=>{
    // clear old timeouts
    Object.values(reminderTimeouts.current).forEach(t=>clearTimeout(t));
    reminderTimeouts.current = {};
    if(!("Notification" in window)) return;
    habits.forEach(h=>{
      if(!h.reminder) return;
      const [hh,mm] = h.reminder.split(":").map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(hh,mm,0,0);
      if(target <= now) target.setDate(target.getDate()+1);
      const delay = target - now;
      if(delay > 0 && delay < 2147483647){
        reminderTimeouts.current[h.id] = setTimeout(()=>{
          if(Notification.permission === "granted"){
            new Notification(`⏰ Time for: ${h.name}`, {body:"Tap to mark it complete in HabitFlow!", icon:"🎯"});
          }
        }, delay);
      }
    });
    return ()=>Object.values(reminderTimeouts.current).forEach(t=>clearTimeout(t));
  },[habits]);

  const loadHabits = async (uid) => {
    setHabitsLoading(true);
    try {
      const ref = doc(db,"users",uid);
      const snap = await getDoc(ref);
      if(snap.exists()) setHabits(snap.data().habits || []);
      else setHabits([]);
    } catch(e){ console.error(e); setHabits([]); }
    setHabitsLoading(false);
  };

  const saveHabitsToDb = async (uid, data) => {
    try { await setDoc(doc(db,"users",uid),{habits:data},{merge:true}); }
    catch(e){ console.error(e); }
  };

  const updateHabits = (next) => {
    setHabits(next);
    if(user) saveHabitsToDb(user.uid, next);
  };

  const loginWithGoogle = async () => {
    try { await signInWithPopup(auth, provider); }
    catch(e){ console.error(e); alert("Sign-in failed: "+e.message); }
  };

  const logout = async () => { await signOut(auth); setHabits([]); setScreen("home"); };

  const toggleComplete = (id, date) => {
    let completing = false;
    const next = habits.map(h=>{
      if(h.id!==id)return h;
      const c=h.completions||[];
      const done=c.includes(date);
      if(!done) completing=true;
      return{...h,completions:done?c.filter(x=>x!==date):[...c,date]};
    });
    updateHabits(next);
    if(completing){
      const r=REMARKS[Math.floor(Math.random()*REMARKS.length)];
      setRemark(r);
      setTimeout(()=>setRemark(null),2000);
    }
  };

  const requestNotifPermission = () => {
    if("Notification" in window && Notification.permission !== "granted"){
      Notification.requestPermission();
    }
  };

  const saveHabit = () => {
    if(!habitForm.name.trim())return;
    requestNotifPermission();
    const next=habitForm.id
      ?habits.map(h=>h.id===habitForm.id?{...habitForm}:h)
      :[...habits,{...habitForm,id:Date.now().toString(),completions:[]}];
    updateHabits(next); setHabitForm(null); setScreen("home");
  };

  const deleteHabit = (id) => {
    updateHabits(habits.filter(h=>h.id!==id));
    setDeleteConfirm(null); setSelected(null); setScreen("home");
  };

  const openAdd = () => {setHabitForm(emptyForm());setShowPresetDropdown(true);setScreen("add");};
  const openEdit = (h) => {setHabitForm({...h});setShowPresetDropdown(false);setScreen("add");};
  const pickPreset = (p) => {
    if(p.name==="Custom Habit..."){
      setHabitForm(f=>({...f,name:"",emoji:"💪"}));
    } else {
      setHabitForm(f=>({...f,name:p.name,emoji:p.emoji}));
    }
    setShowPresetDropdown(false);
  };

  const today=getToday(), weekDates=getWeekDates();
  const isDueOn = (h,dateStr) => {
    const dow=new Date(dateStr+"T00:00:00").getDay();
    if(h.freq==="Daily")return true;
    if(h.freq==="Weekly")return dow===0;
    if(h.freq==="Custom")return(h.days||[]).includes(dow);
    return true;
  };
  const activeDueHabits = habits.filter(h=>isDueOn(h,activeDate));
  const completedActive = activeDueHabits.filter(h=>(h.completions||[]).includes(activeDate)).length;

  const last3Days = [2,1,0].map(off=>{const d=new Date();d.setDate(d.getDate()-off);return fmtDate(d);});

  const iStyle={width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${border}`,fontSize:14,marginBottom:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:card,color:text};
  const btnP={width:"100%",padding:12,borderRadius:10,background:"#6366f1",color:"#fff",border:"none",fontWeight:700,fontSize:15,cursor:"pointer"};
  const labelSt={display:"block",fontSize:13,fontWeight:600,color:mutedText,marginBottom:6};
  const hdrSt={display:"flex",justifyContent:"space-between",alignItems:"center",background:card,borderBottom:`1px solid ${border}`,position:"sticky",top:0,zIndex:10,padding:"14px 16px"};

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );

  const RemarkToast = () => remark?(
    <div style={{position:"fixed",top:"max(16px, env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",background:remark.color,color:"#fff",padding:"10px 20px",borderRadius:50,fontWeight:800,fontSize:"clamp(14px,4vw,18px)",boxShadow:"0 6px 24px #0003",zIndex:300,whiteSpace:"nowrap",animation:"popIn .3s ease",maxWidth:"90vw"}}>
      <style>{`@keyframes popIn{0%{transform:translateX(-50%) scale(0.5);opacity:0}70%{transform:translateX(-50%) scale(1.1)}100%{transform:translateX(-50%) scale(1);opacity:1}}`}</style>
      {remark.msg}
    </div>
  ):null;

  const DeleteModal = ({id,name}) => (
    <div style={{position:"fixed",inset:0,background:"#0008",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:card,borderRadius:16,padding:24,width:"100%",maxWidth:300,textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:8}}>🗑️</div>
        <h3 style={{margin:"0 0 8px",color:text}}>Delete Habit?</h3>
        <p style={{color:sub,fontSize:14,margin:"0 0 20px"}}>"{name}" and all its progress will be permanently deleted.</p>
        <button onClick={()=>deleteHabit(id)} style={{...btnP,background:"#ef4444",marginBottom:10}}>Yes, Delete</button>
        <button onClick={()=>setDeleteConfirm(null)} style={{...btnP,background:mutedBg,color:mutedText}}>Cancel</button>
      </div>
    </div>
  );

  // ---- HELP / DEMO MODAL ----
  const HELP_STEPS = [
    {icon:"➕",title:"Add a Habit",desc:"Tap the floating + button to create a new habit. Pick from popular presets like Yoga or Walking, or create your own custom one."},
    {icon:"📅",title:"Daily / Weekly / Custom",desc:"Daily = every day. Weekly = once a week (Sunday). Custom = pick exactly which days of the week it repeats."},
    {icon:"✓",title:"Mark Complete",desc:"Tap the circle button next to a habit to mark it done for that day. You'll get a fun reward message!"},
    {icon:"⏪",title:"Catch Up On Past Days",desc:"Forgot to check off yesterday? Use the date strip at the top of the Today tab to go back and mark any of the last 3 days complete."},
    {icon:"📊",title:"Dashboard",desc:"See your weekly & monthly stats, completion charts, and how consistent each habit has been."},
    {icon:"🔔",title:"Reminders",desc:"Set a reminder time when creating a habit. Allow notifications when prompted so HabitFlow can remind you!"},
    {icon:"🗑️",title:"Delete a Habit",desc:"Tap the trash icon on any habit card, or inside the edit screen, to permanently remove it."},
  ];
  const HelpModal = () => !showHelp ? null : (
    <div style={{position:"fixed",inset:0,background:"#0008",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:card,borderRadius:20,padding:28,width:"100%",maxWidth:340,textAlign:"center"}}>
        <div style={{fontSize:44,marginBottom:12}}>{HELP_STEPS[helpStep].icon}</div>
        <h3 style={{margin:"0 0 8px",color:text,fontSize:18}}>{HELP_STEPS[helpStep].title}</h3>
        <p style={{color:sub,fontSize:14,lineHeight:1.5,margin:"0 0 20px"}}>{HELP_STEPS[helpStep].desc}</p>
        <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>
          {HELP_STEPS.map((_,i)=>(
            <div key={i} style={{width:7,height:7,borderRadius:"50%",background:i===helpStep?"#6366f1":border}}/>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setShowHelp(false)} style={{...btnP,background:mutedBg,color:mutedText,flex:1}}>Skip</button>
          <button onClick={()=>helpStep<HELP_STEPS.length-1?setHelpStep(s=>s+1):setShowHelp(false)} style={{...btnP,flex:1}}>
            {helpStep<HELP_STEPS.length-1?"Next":"Got it!"}
          </button>
        </div>
      </div>
    </div>
  );

  const Dashboard = () => {
    const dates=dashRange==="weekly"?getLast7Days():getLast30Days();
    const dayCounts=dates.map(d=>({date:d,count:habits.reduce((a,h)=>(h.completions||[]).includes(d)?a+1:a,0),label:dashRange==="weekly"?DAYS[new Date(d+"T00:00:00").getDay()].slice(0,3):new Date(d+"T00:00:00").getDate()}));
    const maxCount=Math.max(...dayCounts.map(d=>d.count),1);
    const totalCompletions=habits.reduce((a,h)=>(h.completions||[]).length+a,0);
    const bestStreak=habits.reduce((a,h)=>Math.max(a,calcLongest(h.completions)),0);
    const avgPerDay=dates.length?(dayCounts.reduce((a,d)=>a+d.count,0)/dates.length).toFixed(1):0;
    const habitStats=habits.map(h=>{const done=dates.filter(d=>(h.completions||[]).includes(d)).length;return{...h,done,pct:dates.length?Math.round((done/dates.length)*100):0};}).sort((a,b)=>b.pct-a.pct);
    return(
      <div style={{padding:"16px 16px 90px"}}>
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
          {["weekly","monthly"].map(r=>(
            <button key={r} onClick={()=>setDashRange(r)} style={{padding:"7px 18px",borderRadius:20,border:"none",background:dashRange===r?"#6366f1":mutedBg,color:dashRange===r?"#fff":mutedText,cursor:"pointer",fontWeight:700,fontSize:13}}>{r==="weekly"?"Last 7 Days":"Last 30 Days"}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          {[["✅","Total Completions",totalCompletions],["📊","Avg / Day",avgPerDay],["🔥","Best Streak",bestStreak+" days"],["🎯","Habits Tracked",habits.length]].map(([icon,label,val])=>(
            <div key={label} style={{background:card,borderRadius:14,padding:"14px",boxShadow:"0 1px 6px #0001"}}>
              <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
              <div style={{fontSize:"clamp(18px,5vw,22px)",fontWeight:800,color:"#6366f1"}}>{val}</div>
              <div style={{fontSize:11,color:sub,marginTop:2}}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{background:card,borderRadius:16,padding:"16px 14px",marginBottom:20,boxShadow:"0 1px 6px #0001",overflowX:"auto"}}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:700,color:text}}>Completions — {dashRange==="weekly"?"Last 7 Days":"Last 30 Days"}</h3>
          <div style={{display:"flex",alignItems:"flex-end",gap:dashRange==="weekly"?8:3,height:120,minWidth:dashRange==="monthly"?420:"auto"}}>
            {dayCounts.map((d,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:dashRange==="weekly"?0:10}}>
                {d.count>0&&<div style={{fontSize:9,color:"#6366f1",fontWeight:700}}>{d.count}</div>}
                <div style={{width:"100%",borderRadius:4,background:d.count>0?"#6366f1":mutedBg,height:`${Math.max((d.count/maxCount)*90,4)}px`,transition:"height .3s"}}/>
                <div style={{fontSize:dashRange==="weekly"?10:8,color:sub,whiteSpace:"nowrap"}}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:card,borderRadius:16,padding:"16px 14px",boxShadow:"0 1px 6px #0001"}}>
          <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:text}}>Habit Breakdown</h3>
          {habitStats.length===0?<p style={{color:sub,fontSize:13,textAlign:"center"}}>No habits yet.</p>:habitStats.map(h=>(
            <div key={h.id} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,gap:8}}>
                <span style={{fontSize:13,fontWeight:600,color:text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.emoji} {h.name}</span>
                <span style={{fontSize:12,color:sub,flexShrink:0}}>{h.done}/{dates.length} · {h.pct}%</span>
              </div>
              <div style={{height:8,background:mutedBg,borderRadius:99}}>
                <div style={{height:8,borderRadius:99,background:h.color,width:`${h.pct}%`,transition:"width .4s"}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---- AUTH LOADING ----
  if(authLoading) return(
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",color:sub}}>
        <div style={{fontSize:40,marginBottom:12}}>🎯</div>
        <p style={{fontSize:14}}>Loading HabitFlow...</p>
      </div>
    </div>
  );

  // ---- LOGIN ----
  if(!user) return(
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:16,boxSizing:"border-box"}}>
      <div style={{background:card,borderRadius:20,padding:"32px 28px",width:"100%",maxWidth:340,boxShadow:"0 4px 24px #0002",textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button onClick={()=>setDark(x=>!x)} style={{background:mutedBg,border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:16}}>{dark?"☀️":"🌙"}</button>
        </div>
        <div style={{fontSize:48,marginBottom:8}}>🎯</div>
        <h1 style={{margin:"0 0 6px",fontSize:24,fontWeight:800,color:text}}>HabitFlow</h1>
        <p style={{margin:"0 0 28px",color:sub,fontSize:14}}>Build better habits, one day at a time</p>
        <button onClick={loginWithGoogle}
          style={{...btnP,display:"flex",alignItems:"center",justifyContent:"center",gap:12,background:card,color:text,border:`1.5px solid ${border}`,padding:"14px 20px"}}>
          <GoogleIcon/>
          <span style={{fontWeight:700}}>Continue with Google</span>
        </button>
        <p style={{fontSize:11,color:sub,marginTop:16}}>Your habits are private and saved to your account</p>
      </div>
    </div>
  );

  // ---- ADD/EDIT ----
  if(screen==="add"&&habitForm) return(
    <div style={{minHeight:"100vh",background:bg,fontFamily:"system-ui,sans-serif",maxWidth:480,margin:"0 auto"}}>
      {deleteConfirm&&<DeleteModal {...deleteConfirm}/>}
      <div style={hdrSt}>
        <button onClick={()=>{setHabitForm(null);setScreen("home");}} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontWeight:600,fontSize:14}}>← Back</button>
        <h2 style={{margin:0,fontSize:16,fontWeight:700,color:text}}>{habitForm.id?"Edit Habit":"New Habit"}</h2>
        <button onClick={()=>{setHelpStep(0);setShowHelp(true);}} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontSize:18}}>❓</button>
      </div>
      <HelpModal/>
      <div style={{padding:"16px 16px 40px"}}>

        {!habitForm.id && (
          <>
            <label style={labelSt}>Quick Pick a Habit</label>
            <div style={{position:"relative",marginBottom:16}}>
              <button onClick={()=>setShowPresetDropdown(s=>!s)}
                style={{...iStyle,marginBottom:0,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                <span>{habitForm.name ? `${habitForm.emoji} ${habitForm.name}` : "Choose from popular habits..."}</span>
                <span style={{fontSize:12,color:sub}}>{showPresetDropdown?"▲":"▼"}</span>
              </button>
              {showPresetDropdown && (
                <div style={{position:"absolute",top:"105%",left:0,right:0,background:card,border:`1.5px solid ${border}`,borderRadius:10,maxHeight:260,overflowY:"auto",zIndex:50,boxShadow:"0 8px 24px #0002"}}>
                  {PRESET_HABITS.map(p=>(
                    <div key={p.name} onClick={()=>pickPreset(p)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${border}`,fontSize:14,color:text}}
                      onMouseDown={e=>e.preventDefault()}>
                      <span style={{fontSize:18}}>{p.emoji}</span>{p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <label style={labelSt}>Name</label>
        <input placeholder="e.g. Morning Run" value={habitForm.name}
          onChange={e=>setHabitForm(f=>({...f,name:e.target.value}))} style={iStyle}/>

        <label style={labelSt}>Icon</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
          {EMOJIS.map(e=>(<button key={e} onClick={()=>setHabitForm(f=>({...f,emoji:e}))} style={{fontSize:20,background:habitForm.emoji===e?"#ede9fe":mutedBg,border:habitForm.emoji===e?"2px solid #6366f1":"2px solid transparent",borderRadius:10,padding:"6px 9px",cursor:"pointer"}}>{e}</button>))}
        </div>

        <label style={labelSt}>Color</label>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {COLORS.map(c=>(<button key={c} onClick={()=>setHabitForm(f=>({...f,color:c}))} style={{width:26,height:26,borderRadius:"50%",background:c,border:habitForm.color===c?`3px solid ${text}`:"3px solid transparent",cursor:"pointer"}}/>))}
        </div>

        <label style={labelSt}>Frequency</label>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {FREQ_OPTIONS.map(f=>(<button key={f} onClick={()=>setHabitForm(hf=>({...hf,freq:f}))} style={{padding:"6px 16px",borderRadius:20,border:"none",background:habitForm.freq===f?"#6366f1":mutedBg,color:habitForm.freq===f?"#fff":mutedText,cursor:"pointer",fontWeight:600,fontSize:13}}>{f}</button>))}
        </div>
        <p style={{fontSize:11,color:sub,marginTop:-10,marginBottom:16}}>
          {habitForm.freq==="Daily" && "Repeats every single day."}
          {habitForm.freq==="Weekly" && "Repeats once a week, on Sunday."}
          {habitForm.freq==="Custom" && "Pick exactly which days it repeats below."}
        </p>

        {habitForm.freq==="Custom"&&(
          <>
            <label style={labelSt}>Days</label>
            <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              {DAYS.map((d,i)=>(<button key={d} onClick={()=>setHabitForm(f=>({...f,days:f.days.includes(i)?f.days.filter(x=>x!==i):[...f.days,i]}))} style={{padding:"5px 8px",borderRadius:8,border:"none",background:(habitForm.days||[]).includes(i)?"#6366f1":mutedBg,color:(habitForm.days||[]).includes(i)?"#fff":mutedText,cursor:"pointer",fontSize:12,fontWeight:600}}>{d}</button>))}
            </div>
          </>
        )}

        <label style={labelSt}>Reminder Time (optional)</label>
        <input type="time" value={habitForm.reminder||""} onChange={e=>setHabitForm(f=>({...f,reminder:e.target.value}))} style={{...iStyle,width:160,maxWidth:"100%"}}/>
        <p style={{fontSize:11,color:sub,marginTop:-10,marginBottom:16}}>You'll get a browser notification at this time daily (allow notifications when asked).</p>

        <button onClick={saveHabit} style={{...btnP,marginTop:4}}>{habitForm.id?"Update Habit":"Add Habit"}</button>
        {habitForm.id&&<button onClick={()=>setDeleteConfirm({id:habitForm.id,name:habitForm.name})} style={{...btnP,background:"#fee2e2",color:"#ef4444",marginTop:10}}>🗑️ Delete Habit</button>}
      </div>
    </div>
  );

  // ---- DETAIL ----
  if(screen==="detail"&&selected){
    const h=habits.find(x=>x.id===selected);
    if(!h){setScreen("home");return null;}
    const streak=calcStreak(h.completions),longest=calcLongest(h.completions),total=(h.completions||[]).length;
    return(
      <div style={{minHeight:"100vh",background:bg,fontFamily:"system-ui,sans-serif",maxWidth:480,margin:"0 auto"}}>
        {deleteConfirm&&<DeleteModal {...deleteConfirm}/>}
        <div style={hdrSt}>
          <button onClick={()=>setScreen("home")} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontWeight:600,fontSize:14}}>← Back</button>
          <h2 style={{margin:0,fontSize:16,fontWeight:700,color:text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{h.emoji} {h.name}</h2>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>openEdit(h)} style={{background:"none",border:"none",color:"#6366f1",fontWeight:600,cursor:"pointer",fontSize:13}}>Edit</button>
            <button onClick={()=>setDeleteConfirm({id:h.id,name:h.name})} style={{background:"none",border:"none",color:"#ef4444",fontWeight:600,cursor:"pointer",fontSize:18}}>🗑️</button>
          </div>
        </div>
        <div style={{padding:"16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
            {[["🔥 Streak",streak+" days"],["🏆 Longest",longest+" days"],["✅ Total",total+" days"]].map(([l,v])=>(
              <div key={l} style={{background:mutedBg,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                <div style={{fontSize:"clamp(14px,4vw,18px)",fontWeight:700,color:text}}>{v}</div>
                <div style={{fontSize:10,color:sub,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          <h3 style={{fontSize:14,fontWeight:600,color:sub,marginBottom:10}}>This Week</h3>
          <div style={{display:"flex",gap:5,marginBottom:20}}>
            {weekDates.map((dd,i)=>{
              const done=(h.completions||[]).includes(dd),isT=dd===today;
              const future = new Date(dd) > new Date(today);
              return(<div key={dd} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,color:isT?"#6366f1":sub,fontWeight:isT?700:400,marginBottom:4}}>{DAYS[i]}</div>
                <div onClick={()=>!future && toggleComplete(h.id,dd)} style={{width:"100%",aspectRatio:"1",borderRadius:8,background:done?h.color:mutedBg,border:isT?`2px solid ${h.color}`:"2px solid transparent",cursor:future?"default":"pointer",opacity:future?0.4:1,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff"}}>{done?"✓":""}</div>
              </div>);
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---- HOME ----
  return(
    <div style={{minHeight:"100vh",background:bg,fontFamily:"system-ui,sans-serif",maxWidth:480,margin:"0 auto",position:"relative",width:"100%",boxSizing:"border-box"}}>
      <RemarkToast/>
      {deleteConfirm&&<DeleteModal {...deleteConfirm}/>}
      <HelpModal/>
      <div style={hdrSt}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
          {user.photoURL&&<img src={user.photoURL} style={{width:32,height:32,borderRadius:"50%",flexShrink:0}} alt="avatar"/>}
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13,color:text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.displayName}</div>
            <div style={{fontSize:10,color:sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          <button onClick={()=>{setHelpStep(0);setShowHelp(true);}} style={{background:mutedBg,border:"none",borderRadius:20,padding:"5px 9px",cursor:"pointer",fontSize:14}}>❓</button>
          <button onClick={()=>setDark(x=>!x)} style={{background:mutedBg,border:"none",borderRadius:20,padding:"5px 9px",cursor:"pointer",fontSize:14}}>{dark?"☀️":"🌙"}</button>
          <button onClick={logout} style={{background:"none",border:"none",color:sub,cursor:"pointer",fontSize:12}}>Sign out</button>
        </div>
      </div>

      <div style={{display:"flex",background:card,borderBottom:`1px solid ${border}`,padding:"0 12px",overflowX:"auto"}}>
        {["today","week","dashboard"].map(t=>(
          <button key={t} onClick={()=>setView(t)} style={{padding:"12px 12px",border:"none",borderBottom:view===t?"2px solid #6366f1":"2px solid transparent",background:"none",color:view===t?"#6366f1":sub,fontWeight:view===t?700:500,fontSize:12.5,cursor:"pointer",whiteSpace:"nowrap"}}>
            {t==="today"?"Today":t==="week"?"This Week":"📊 Dashboard"}
          </button>
        ))}
      </div>

      {habitsLoading?(
        <div style={{textAlign:"center",padding:"60px 0",color:sub}}>
          <div style={{fontSize:32,marginBottom:10}}>⏳</div>
          <p style={{fontSize:14}}>Loading your habits...</p>
        </div>
      ):view==="dashboard"?<Dashboard/>:view==="today"?(
        <div style={{padding:"14px 16px 90px"}}>
          {/* Date strip for catching up on past days */}
          <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto"}}>
            {last3Days.map(d=>(
              <button key={d} onClick={()=>setActiveDate(d)}
                style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:"none",background:activeDate===d?"#6366f1":mutedBg,color:activeDate===d?"#fff":mutedText,fontWeight:600,fontSize:12.5,cursor:"pointer",whiteSpace:"nowrap"}}>
                {prettyDate(d)}
              </button>
            ))}
          </div>

          <div style={{background:mutedBg,borderRadius:12,padding:"14px 16px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:600,color:mutedText}}>{prettyDate(activeDate)}'s Progress</span>
              <span style={{fontSize:13,fontWeight:700,color:"#6366f1"}}>{completedActive}/{activeDueHabits.length}</span>
            </div>
            <div style={{height:6,background:border,borderRadius:99}}>
              <div style={{height:6,borderRadius:99,background:"#6366f1",width:activeDueHabits.length?`${(completedActive/activeDueHabits.length)*100}%`:"0%",transition:"width .3s"}}/>
            </div>
          </div>

          {habits.length===0?(
            <div style={{textAlign:"center",padding:"48px 0",color:sub}}>
              <div style={{fontSize:40,marginBottom:10}}>🌱</div>
              <p style={{fontSize:14}}>No habits yet — tap + to add your first one!</p>
            </div>
          ):activeDueHabits.length===0?(
            <div style={{textAlign:"center",padding:"40px 0",color:sub,fontSize:14}}>No habits scheduled for {prettyDate(activeDate).toLowerCase()}.</div>
          ):activeDueHabits.map(h=>{
            const done=(h.completions||[]).includes(activeDate),streak=calcStreak(h.completions);
            return(<div key={h.id} style={{background:card,borderRadius:14,padding:"12px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10,boxShadow:"0 1px 6px #0001",border:done?`1.5px solid ${h.color}`:`1.5px solid ${border}`}}>
              <div style={{width:38,height:38,borderRadius:10,background:h.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{h.emoji}</div>
              <div style={{flex:1,cursor:"pointer",minWidth:0}} onClick={()=>{setSelected(h.id);setScreen("detail");}}>
                <div style={{fontWeight:600,fontSize:14,color:text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
                <div style={{fontSize:11,color:sub}}>🔥 {streak} day streak · {h.freq}</div>
              </div>
              <button onClick={()=>setDeleteConfirm({id:h.id,name:h.name})} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16,padding:"0 2px",flexShrink:0}}>🗑️</button>
              <button onClick={()=>toggleComplete(h.id,activeDate)} style={{width:32,height:32,borderRadius:"50%",border:"none",background:done?h.color:mutedBg,color:done?"#fff":sub,fontSize:16,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button>
            </div>);
          })}
        </div>
      ):(
        <div style={{padding:"14px 16px 90px"}}>
          {habits.length===0?(
            <div style={{textAlign:"center",padding:"48px 0",color:sub}}>
              <div style={{fontSize:40,marginBottom:10}}>🌱</div>
              <p style={{fontSize:14}}>No habits yet — tap + to add your first one!</p>
            </div>
          ):habits.map(h=>{
            const weekDone=weekDates.filter(dd=>(h.completions||[]).includes(dd)).length;
            return(<div key={h.id} style={{background:card,borderRadius:14,padding:"12px 14px",marginBottom:10,boxShadow:"0 1px 6px #0001"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:16}}>{h.emoji}</span>
                <span style={{fontWeight:600,fontSize:13,color:text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</span>
                <button onClick={()=>setDeleteConfirm({id:h.id,name:h.name})} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14}}>🗑️</button>
                <span style={{marginLeft:"auto",fontSize:11,color:sub,flexShrink:0}}>{weekDone}/7</span>
              </div>
              <div style={{display:"flex",gap:4}}>
                {weekDates.map((dd,i)=>{
                  const done=(h.completions||[]).includes(dd),isT=dd===today;
                  const future = new Date(dd) > new Date(today);
                  return(<div key={dd} style={{flex:1,textAlign:"center"}}>
                    <div style={{fontSize:9,color:isT?"#6366f1":sub,marginBottom:3}}>{DAYS[i]}</div>
                    <div onClick={()=>!future && toggleComplete(h.id,dd)} style={{height:22,borderRadius:6,background:done?h.color:mutedBg,border:isT?`1.5px solid ${h.color}`:"1.5px solid transparent",cursor:future?"default":"pointer",opacity:future?0.4:1}}/>
                  </div>);
                })}
              </div>
            </div>);
          })}
        </div>
      )}
      {view!=="dashboard"&&(
        <button onClick={openAdd} style={{position:"fixed",bottom:"max(24px, env(safe-area-inset-bottom))",right:20,width:54,height:54,borderRadius:"50%",background:"#6366f1",color:"#fff",fontSize:28,border:"none",cursor:"pointer",boxShadow:"0 4px 16px #6366f155",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
      )}
    </div>
  );
}