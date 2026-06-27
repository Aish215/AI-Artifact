import { useState, useEffect } from "react";
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

const getToday = () => new Date().toISOString().slice(0,10);
const getWeekDates = () => {
  const today = new Date();
  return Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()-today.getDay()+i);return d.toISOString().slice(0,10);});
};
const getLast7Days = () => Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(0,10);});
const getLast30Days = () => Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-29+i);return d.toISOString().slice(0,10);});

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

  const bg=dark?"#0f172a":"#f9fafb", card=dark?"#1e293b":"#fff", border=dark?"#334155":"#f3f4f6";
  const text=dark?"#f1f5f9":"#111", sub=dark?"#94a3b8":"#888";
  const mutedBg=dark?"#283548":"#f3f4f6", mutedText=dark?"#94a3b8":"#555";

  // Listen for auth state changes
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      setUser(u);
      setAuthLoading(false);
      if(u) await loadHabits(u.uid);
    });
    return ()=>unsub();
  },[]);

  // Load habits from Firestore
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

  // Save habits to Firestore
  const saveHabits = async (uid, data) => {
    try {
      await setDoc(doc(db,"users",uid),{habits:data},{merge:true});
    } catch(e){ console.error(e); }
  };

  const updateHabits = (next) => {
    setHabits(next);
    if(user) saveHabits(user.uid, next);
  };

  const loginWithGoogle = async () => {
    try { await signInWithPopup(auth, provider); }
    catch(e){ console.error(e); }
  };

  const logout = async () => {
    await signOut(auth);
    setHabits([]); setScreen("home");
  };

  const toggleComplete = (id, date=getToday()) => {
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

  const saveHabit = () => {
    if(!habitForm.name.trim())return;
    const next=habitForm.id
      ?habits.map(h=>h.id===habitForm.id?{...habitForm}:h)
      :[...habits,{...habitForm,id:Date.now().toString(),completions:[]}];
    updateHabits(next); setHabitForm(null); setScreen("home");
  };

  const deleteHabit = (id) => {
    updateHabits(habits.filter(h=>h.id!==id));
    setDeleteConfirm(null); setSelected(null); setScreen("home");
  };

  const openAdd = () => {setHabitForm(emptyForm());setScreen("add");};
  const openEdit = (h) => {setHabitForm({...h});setScreen("add");};

  const today=getToday(), weekDates=getWeekDates();
  const isDueToday = h=>{
    const dow=new Date().getDay();
    if(h.freq==="Daily")return true;
    if(h.freq==="Weekly")return dow===0;
    if(h.freq==="Custom")return(h.days||[]).includes(dow);
    return true;
  };
  const todayHabits=habits.filter(isDueToday);
  const completedToday=todayHabits.filter(h=>(h.completions||[]).includes(today)).length;

  const iStyle={width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${border}`,fontSize:14,marginBottom:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:card,color:text};
  const btnP={width:"100%",padding:12,borderRadius:10,background:"#6366f1",color:"#fff",border:"none",fontWeight:700,fontSize:15,cursor:"pointer"};
  const labelSt={display:"block",fontSize:13,fontWeight:600,color:mutedText,marginBottom:6};
  const hdrSt={display:"flex",justifyContent:"space-between",alignItems:"center",background:card,borderBottom:`1px solid ${border}`,position:"sticky",top:0,zIndex:10,padding:"14px 20px"};

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );

  const RemarkToast = () => remark?(
    <div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",background:remark.color,color:"#fff",padding:"12px 28px",borderRadius:50,fontWeight:800,fontSize:18,boxShadow:"0 6px 24px #0003",zIndex:200,whiteSpace:"nowrap",animation:"popIn .3s ease"}}>
      <style>{`@keyframes popIn{0%{transform:translateX(-50%) scale(0.5);opacity:0}70%{transform:translateX(-50%) scale(1.1)}100%{transform:translateX(-50%) scale(1);opacity:1}}`}</style>
      {remark.msg}
    </div>
  ):null;

  const DeleteModal = ({id,name}) => (
    <div style={{position:"fixed",inset:0,background:"#0008",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:card,borderRadius:16,padding:24,width:300,textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:8}}>🗑️</div>
        <h3 style={{margin:"0 0 8px",color:text}}>Delete Habit?</h3>
        <p style={{color:sub,fontSize:14,margin:"0 0 20px"}}>"{name}" and all its progress will be permanently deleted.</p>
        <button onClick={()=>deleteHabit(id)} style={{...btnP,background:"#ef4444",marginBottom:10}}>Yes, Delete</button>
        <button onClick={()=>setDeleteConfirm(null)} style={{...btnP,background:mutedBg,color:mutedText}}>Cancel</button>
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
      <div style={{padding:"16px 20px 80px"}}>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {["weekly","monthly"].map(r=>(
            <button key={r} onClick={()=>setDashRange(r)} style={{padding:"7px 20px",borderRadius:20,border:"none",background:dashRange===r?"#6366f1":mutedBg,color:dashRange===r?"#fff":mutedText,cursor:"pointer",fontWeight:700,fontSize:13}}>{r==="weekly"?"Last 7 Days":"Last 30 Days"}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          {[["✅","Total Completions",totalCompletions],["📊","Avg / Day",avgPerDay],["🔥","Best Streak",bestStreak+" days"],["🎯","Habits Tracked",habits.length]].map(([icon,label,val])=>(
            <div key={label} style={{background:card,borderRadius:14,padding:"16px 14px",boxShadow:"0 1px 6px #0001"}}>
              <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
              <div style={{fontSize:22,fontWeight:800,color:"#6366f1"}}>{val}</div>
              <div style={{fontSize:12,color:sub,marginTop:2}}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{background:card,borderRadius:16,padding:"18px 16px",marginBottom:20,boxShadow:"0 1px 6px #0001"}}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:700,color:text}}>Completions — {dashRange==="weekly"?"Last 7 Days":"Last 30 Days"}</h3>
          <div style={{display:"flex",alignItems:"flex-end",gap:dashRange==="weekly"?10:3,height:120}}>
            {dayCounts.map((d,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                {d.count>0&&<div style={{fontSize:9,color:"#6366f1",fontWeight:700}}>{d.count}</div>}
                <div style={{width:"100%",borderRadius:4,background:d.count>0?"#6366f1":mutedBg,height:`${Math.max((d.count/maxCount)*90,4)}px`,transition:"height .3s"}}/>
                <div style={{fontSize:dashRange==="weekly"?10:8,color:sub,whiteSpace:"nowrap"}}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:card,borderRadius:16,padding:"18px 16px",boxShadow:"0 1px 6px #0001"}}>
          <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:text}}>Habit Breakdown</h3>
          {habitStats.length===0?<p style={{color:sub,fontSize:13,textAlign:"center"}}>No habits yet.</p>:habitStats.map(h=>(
            <div key={h.id} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13,fontWeight:600,color:text}}>{h.emoji} {h.name}</span>
                <span style={{fontSize:12,color:sub}}>{h.done}/{dates.length} · {h.pct}%</span>
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
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:card,borderRadius:20,padding:36,width:320,boxShadow:"0 4px 24px #0002",textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button onClick={()=>setDark(x=>!x)} style={{background:mutedBg,border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:16}}>{dark?"☀️":"🌙"}</button>
        </div>
        <div style={{fontSize:52,marginBottom:8}}>🎯</div>
        <h1 style={{margin:"0 0 6px",fontSize:26,fontWeight:800,color:text}}>HabitFlow</h1>
        <p style={{margin:"0 0 32px",color:sub,fontSize:14}}>Build better habits, one day at a time</p>
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
        <h2 style={{margin:0,fontSize:17,fontWeight:700,color:text}}>{habitForm.id?"Edit Habit":"New Habit"}</h2>
        <div style={{width:48}}/>
      </div>
      <div style={{padding:"16px 20px 40px"}}>
        <label style={labelSt}>Name</label>
        <input placeholder="e.g. Morning Run" value={habitForm.name} onChange={e=>setHabitForm(f=>({...f,name:e.target.value}))} style={iStyle}/>
        <label style={labelSt}>Icon</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
          {EMOJIS.map(e=>(<button key={e} onClick={()=>setHabitForm(f=>({...f,emoji:e}))} style={{fontSize:22,background:habitForm.emoji===e?"#ede9fe":mutedBg,border:habitForm.emoji===e?"2px solid #6366f1":"2px solid transparent",borderRadius:10,padding:"6px 10px",cursor:"pointer"}}>{e}</button>))}
        </div>
        <label style={labelSt}>Color</label>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {COLORS.map(c=>(<button key={c} onClick={()=>setHabitForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:habitForm.color===c?`3px solid ${text}`:"3px solid transparent",cursor:"pointer"}}/>))}
        </div>
        <label style={labelSt}>Frequency</label>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {FREQ_OPTIONS.map(f=>(<button key={f} onClick={()=>setHabitForm(hf=>({...hf,freq:f}))} style={{padding:"6px 16px",borderRadius:20,border:"none",background:habitForm.freq===f?"#6366f1":mutedBg,color:habitForm.freq===f?"#fff":mutedText,cursor:"pointer",fontWeight:600,fontSize:13}}>{f}</button>))}
        </div>
        {habitForm.freq==="Custom"&&(
          <>
            <label style={labelSt}>Days</label>
            <div style={{display:"flex",gap:6,marginBottom:16}}>
              {DAYS.map((d,i)=>(<button key={d} onClick={()=>setHabitForm(f=>({...f,days:f.days.includes(i)?f.days.filter(x=>x!==i):[...f.days,i]}))} style={{padding:"5px 8px",borderRadius:8,border:"none",background:(habitForm.days||[]).includes(i)?"#6366f1":mutedBg,color:(habitForm.days||[]).includes(i)?"#fff":mutedText,cursor:"pointer",fontSize:12,fontWeight:600}}>{d}</button>))}
            </div>
          </>
        )}
        <label style={labelSt}>Reminder Time (optional)</label>
        <input type="time" value={habitForm.reminder||""} onChange={e=>setHabitForm(f=>({...f,reminder:e.target.value}))} style={{...iStyle,width:"160px"}}/>
        <button onClick={saveHabit} style={{...btnP,marginTop:12}}>{habitForm.id?"Update Habit":"Add Habit"}</button>
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
          <h2 style={{margin:0,fontSize:17,fontWeight:700,color:text}}>{h.emoji} {h.name}</h2>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>openEdit(h)} style={{background:"none",border:"none",color:"#6366f1",fontWeight:600,cursor:"pointer",fontSize:14}}>Edit</button>
            <button onClick={()=>setDeleteConfirm({id:h.id,name:h.name})} style={{background:"none",border:"none",color:"#ef4444",fontWeight:600,cursor:"pointer",fontSize:18}}>🗑️</button>
          </div>
        </div>
        <div style={{padding:"16px 20px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
            {[["🔥 Streak",streak+" days"],["🏆 Longest",longest+" days"],["✅ Total",total+" days"]].map(([l,v])=>(
              <div key={l} style={{background:mutedBg,borderRadius:12,padding:"14px 10px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:700,color:text}}>{v}</div>
                <div style={{fontSize:11,color:sub,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          <h3 style={{fontSize:14,fontWeight:600,color:sub,marginBottom:10}}>This Week</h3>
          <div style={{display:"flex",gap:6,marginBottom:20}}>
            {weekDates.map((dd,i)=>{
              const done=(h.completions||[]).includes(dd),isT=dd===today;
              return(<div key={dd} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:11,color:isT?"#6366f1":sub,fontWeight:isT?700:400,marginBottom:4}}>{DAYS[i]}</div>
                <div onClick={()=>toggleComplete(h.id,dd)} style={{width:"100%",aspectRatio:"1",borderRadius:8,background:done?h.color:mutedBg,border:isT?`2px solid ${h.color}`:"2px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff"}}>{done?"✓":""}</div>
              </div>);
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---- HOME ----
  return(
    <div style={{minHeight:"100vh",background:bg,fontFamily:"system-ui,sans-serif",maxWidth:480,margin:"0 auto",position:"relative"}}>
      <RemarkToast/>
      {deleteConfirm&&<DeleteModal {...deleteConfirm}/>}
      <div style={hdrSt}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {user.photoURL&&<img src={user.photoURL} style={{width:34,height:34,borderRadius:"50%"}} alt="avatar"/>}
          <div>
            <div style={{fontWeight:700,fontSize:14,color:text}}>{user.displayName}</div>
            <div style={{fontSize:11,color:sub}}>{user.email}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setDark(x=>!x)} style={{background:mutedBg,border:"none",borderRadius:20,padding:"5px 10px",cursor:"pointer",fontSize:15}}>{dark?"☀️":"🌙"}</button>
          <button onClick={logout} style={{background:"none",border:"none",color:sub,cursor:"pointer",fontSize:13}}>Sign out</button>
        </div>
      </div>

      <div style={{display:"flex",background:card,borderBottom:`1px solid ${border}`,padding:"0 20px"}}>
        {["today","week","dashboard"].map(t=>(
          <button key={t} onClick={()=>setView(t)} style={{padding:"12px 16px",border:"none",borderBottom:view===t?"2px solid #6366f1":"2px solid transparent",background:"none",color:view===t?"#6366f1":sub,fontWeight:view===t?700:500,fontSize:13,cursor:"pointer"}}>
            {t==="today"?"Today":t==="week"?"This Week":"📊 Dashboard"}
          </button>
        ))}
      </div>

      {habitsLoading?(
        <div style={{textAlign:"center",padding:"60px 0",color:sub}}>
          <div style={{fontSize:32,marginBottom:10}}>⏳</div>
          <p style={{fontSize:14}}>Loading your habits...</p>
        </div>
      ):view==="dashboard"?<Dashboard/>:(
        <div style={{padding:"16px 20px 80px"}}>
          {view==="today"&&(
            <div style={{background:mutedBg,borderRadius:12,padding:"14px 16px",marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:mutedText}}>Today's Progress</span>
                <span style={{fontSize:13,fontWeight:700,color:"#6366f1"}}>{completedToday}/{todayHabits.length}</span>
              </div>
              <div style={{height:6,background:border,borderRadius:99}}>
                <div style={{height:6,borderRadius:99,background:"#6366f1",width:todayHabits.length?`${(completedToday/todayHabits.length)*100}%`:"0%",transition:"width .3s"}}/>
              </div>
            </div>
          )}
          {habits.length===0?(
            <div style={{textAlign:"center",padding:"48px 0",color:sub}}>
              <div style={{fontSize:44,marginBottom:10}}>🌱</div>
              <p style={{fontSize:14}}>No habits yet — tap + to add your first one!</p>
            </div>
          ):view==="today"?(
            todayHabits.length===0
              ?<div style={{textAlign:"center",padding:"40px 0",color:sub,fontSize:14}}>No habits scheduled for today.</div>
              :todayHabits.map(h=>{
                const done=(h.completions||[]).includes(today),streak=calcStreak(h.completions);
                return(<div key={h.id} style={{background:card,borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 6px #0001",border:done?`1.5px solid ${h.color}`:`1.5px solid ${border}`}}>
                  <div style={{width:40,height:40,borderRadius:10,background:h.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{h.emoji}</div>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>{setSelected(h.id);setScreen("detail");}}>
                    <div style={{fontWeight:600,fontSize:15,color:text}}>{h.name}</div>
                    <div style={{fontSize:12,color:sub}}>🔥 {streak} day streak · {h.freq}</div>
                  </div>
                  <button onClick={()=>setDeleteConfirm({id:h.id,name:h.name})} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:18,padding:"0 4px"}}>🗑️</button>
                  <button onClick={()=>toggleComplete(h.id)} style={{width:34,height:34,borderRadius:"50%",border:"none",background:done?h.color:mutedBg,color:done?"#fff":sub,fontSize:18,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button>
                </div>);
              })
          ):(
            habits.map(h=>{
              const weekDone=weekDates.filter(dd=>(h.completions||[]).includes(dd)).length;
              return(<div key={h.id} style={{background:card,borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 6px #0001"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <span style={{fontSize:18}}>{h.emoji}</span>
                  <span style={{fontWeight:600,fontSize:14,color:text}}>{h.name}</span>
                  <button onClick={()=>setDeleteConfirm({id:h.id,name:h.name})} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16}}>🗑️</button>
                  <span style={{marginLeft:"auto",fontSize:12,color:sub}}>{weekDone}/7</span>
                </div>
                <div style={{display:"flex",gap:5}}>
                  {weekDates.map((dd,i)=>{
                    const done=(h.completions||[]).includes(dd),isT=dd===today;
                    return(<div key={dd} style={{flex:1,textAlign:"center"}}>
                      <div style={{fontSize:10,color:isT?"#6366f1":sub,marginBottom:3}}>{DAYS[i]}</div>
                      <div onClick={()=>toggleComplete(h.id,dd)} style={{height:24,borderRadius:6,background:done?h.color:mutedBg,border:isT?`1.5px solid ${h.color}`:"1.5px solid transparent",cursor:"pointer"}}/>
                    </div>);
                  })}
                </div>
              </div>);
            })
          )}
        </div>
      )}
      {view!=="dashboard"&&(
        <button onClick={openAdd} style={{position:"fixed",bottom:28,right:24,width:54,height:54,borderRadius:"50%",background:"#6366f1",color:"#fff",fontSize:28,border:"none",cursor:"pointer",boxShadow:"0 4px 16px #6366f155",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
      )}
    </div>
  );
}