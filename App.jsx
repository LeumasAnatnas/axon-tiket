import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from "react";

// ==================== SUPABASE CONFIG ====================
const SB_URL = "https://slappxegoqzcmkgtpieq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXBweGVnb3F6Y21rZ3RwaWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjc2NzksImV4cCI6MjA5NzcwMzY3OX0.nIUPxoFdBIYSkZcRg3xUUSyioTcegccpJa7TLX7Ek6g";

// ==================== FETCH-BASED SUPABASE CLIENT ====================
const sb = {
h(tk) {
const h = { "apikey": SB_KEY, "Content-Type": "application/json" };
if (tk) h["Authorization"] = `Bearer ${tk}`;
return h;
},
async signIn(email, password) {
const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: this.h(), body: JSON.stringify({ email, password }) });
if (!r.ok) { const e = await r.json(); const em = e.error_description||e.message||e.msg||"Login falhou"; throw new Error(em.includes("Invalid login") ? "E-mail ou senha incorretos" : em); }
return r.json();
},
async signOut(tk) { await fetch(`${SB_URL}/auth/v1/logout`, { method: "POST", headers: this.h(tk) }).catch(() => {}); },
async refresh(rt) {
const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: this.h(), body: JSON.stringify({ refresh_token: rt }) });
if (!r.ok) throw new Error("Sessão expirada");
return r.json();
},
async updatePassword(tk, pw) {
const r = await fetch(`${SB_URL}/auth/v1/user`, { method: "PUT", headers: this.h(tk), body: JSON.stringify({ password: pw }) });
if (!r.ok) throw new Error("Erro ao alterar senha");
return r.json();
},
async q(table, tk, params = "") {
const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: { ...this.h(tk), "Prefer": "return=representation" } });
if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Erro na consulta"); }
return r.json();
},
async ins(table, data, tk) {
const r = await fetch(`${SB_URL}/rest/v1/${table}`, { method: "POST", headers: { ...this.h(tk), "Prefer": "return=representation" }, body: JSON.stringify(data) });
if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Erro ao inserir"); }
return r.json();
},
async upd(table, data, match, tk) {
const p = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join("&");
const r = await fetch(`${SB_URL}/rest/v1/${table}?${p}`, { method: "PATCH", headers: { ...this.h(tk), "Prefer": "return=representation" }, body: JSON.stringify(data) });
if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Erro ao atualizar"); }
return r.json();
},
async rpc(fn, params, tk) {
const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: this.h(tk), body: JSON.stringify(params) });
if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Erro na função"); }
const txt = await r.text();
return txt ? JSON.parse(txt) : null;
},
async upload(bucket, path, file, tk) {
const r = await fetch(`${SB_URL}/storage/v1/object/${bucket}/${path}`, { method: "POST", headers: { "Authorization": `Bearer ${tk}`, "apikey": SB_KEY, "Content-Type": file.type }, body: file });
if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.message || "Erro no upload da foto"); }
return `${SB_URL}/storage/v1/object/public/${bucket}/${path}`;
},
// FIX #4: trocado /auth/v1/admin/users (requer service_role) por /auth/v1/signup (funciona com anon key)
async createUser(email, password, meta) {
const r = await fetch(`${SB_URL}/auth/v1/signup`, { method: "POST", headers: this.h(), body: JSON.stringify({ email, password, data: meta }) });
if (!r.ok) { const e = await r.json(); throw new Error(e.msg || e.error_description || "Erro ao criar usuário"); }
return r.json();
},
};

// ==================== AUTH CONTEXT ====================
const Ctx = createContext(null);
function AuthProvider({ children }) {
const [session, setSession] = useState(null);
const [profile, setProfile] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
const s = localStorage.getItem("axon_s");
if (s) { try { const p = JSON.parse(s); initSession(p); } catch { setLoading(false); } }
else setLoading(false);
}, []);

const initSession = async (p) => {
try {
// tenta refresh para garantir token válido
const d = await sb.refresh(p.rt);
const ns = { tk: d.access_token, rt: d.refresh_token, uid: d.user.id };
localStorage.setItem("axon_s", JSON.stringify(ns));
setSession(ns);
loadProfile(ns.tk, ns.uid);
} catch {
// refresh falhou, tenta com token existente
setSession(p);
loadProfile(p.tk, p.uid);
}
};

const loadProfile = async (tk, uid) => {
try {
const ps = await sb.q("profiles", tk, `id=eq.${uid}&select=*`);
if (ps.length > 0) setProfile(ps[0]);
else throw new Error("Perfil não encontrado");
} catch { localStorage.removeItem("axon_s"); setSession(null); }
finally { setLoading(false); }
};

// FIX #9: auto-refresh JWT a cada 50min
useEffect(() => {
if (!session?.rt) return;
const doRefresh = async () => {
try {
const d = await sb.refresh(session.rt);
const s = { tk: d.access_token, rt: d.refresh_token, uid: d.user.id };
localStorage.setItem("axon_s", JSON.stringify(s));
setSession(s);
} catch { localStorage.removeItem("axon_s"); setSession(null); setProfile(null); }
};
const id = setInterval(doRefresh, 50 * 60 * 1000);
return () => clearInterval(id);
}, [session?.rt]);

const login = async (email, pw) => {
const d = await sb.signIn(email, pw);
const s = { tk: d.access_token, rt: d.refresh_token, uid: d.user.id };
localStorage.setItem("axon_s", JSON.stringify(s));
setSession(s);
setLoading(true);
await loadProfile(d.access_token, d.user.id);
};

const logout = async () => {
if (session?.tk) sb.signOut(session.tk);
localStorage.removeItem("axon_s");
setSession(null); setProfile(null);
};

return <Ctx.Provider value={{ session, profile, tk: session?.tk, loading, login, logout }}>{children}</Ctx.Provider>;
}
const useAuth = () => useContext(Ctx);

// ==================== THEME ====================
const T = { bg: "#0f1117", c1: "#1a1d27", c2: "#252836", c3: "#2a2d3a", ac: "#00d4ff", acd: "#0099bb", tx: "#e8eaed", t2: "#8b8fa3", t3: "#5a5e72", bd: "#2a2d3a", r: "#ef4444", g: "#22c55e", y: "#f59e0b", p: "#8b5cf6" };
const KAN = [
{ id: "triagem", label: "Triagem", color: "#f59e0b", icon: "📋" },
{ id: "processado", label: "Processado", color: "#22c55e", icon: "✅" },
{ id: "em_atendimento", label: "Em Atendimento", color: "#3b82f6", icon: "🔧" },
{ id: "atendido", label: "Atendido", color: "#8b5cf6", icon: "🏁" },
];
const PHR = { mandatory: "📷 Obrigatória", optional: "📷 Opcional", none: "" };
const PHC = { mandatory: "#ef4444", optional: "#f59e0b", none: "transparent" };

const css = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:${T.bg};color:${T.tx};font-family:'DM Sans',sans-serif}
.app{min-height:100vh;background:${T.bg}}
.btn{padding:10px 20px;border:none;border-radius:8px;font-family:'DM Sans';font-weight:600;font-size:14px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.bp{background:${T.ac};color:${T.bg}}.bp:hover{background:${T.acd}}
.bg{background:transparent;color:${T.t2};border:1px solid ${T.bd}}.bg:hover{background:${T.c3};color:${T.tx}}
.bs{padding:6px 12px;font-size:12px}.bw{width:100%;justify-content:center}
.btn:disabled{opacity:.4;cursor:not-allowed}
.inp{width:100%;padding:12px 16px;background:${T.c2};border:1px solid ${T.bd};border-radius:8px;color:${T.tx};font-family:'DM Sans';font-size:14px;outline:none;transition:border-color .2s}
.inp:focus{border-color:${T.ac}}.inp::placeholder{color:${T.t3}}
select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b8fa3' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.lbl{display:block;font-size:12px;font-weight:600;color:${T.t2};margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
.card{background:${T.c1};border:1px solid ${T.bd};border-radius:12px;padding:20px;transition:all .2s}
.badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.topbar{position:sticky;top:0;z-index:50;background:${T.c1}ee;backdrop-filter:blur(12px);border-bottom:1px solid ${T.bd};padding:12px 20px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:16px;color:${T.ac};letter-spacing:1px}
.nav{position:fixed;bottom:0;left:0;right:0;z-index:50;background:${T.c1}ee;backdrop-filter:blur(12px);border-top:1px solid ${T.bd};padding:8px 0 12px;display:flex;justify-content:space-around}
.ni{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;color:${T.t3};cursor:pointer;padding:4px 12px;border:none;background:none;font-family:'DM Sans';position:relative}
.ni.on{color:${T.ac}}
.pg{padding:16px 20px 100px;max-width:1400px;margin:0 auto}
.kpig{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.filtrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
@media(max-width:640px){.kpig{grid-template-columns:repeat(2,1fr)}.filtrow .finp{width:100%;min-width:0!important}}
.fi{animation:fi .3s ease}@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.toast{position:fixed;top:20px;right:20px;z-index:200;padding:14px 20px;border-radius:10px;font-weight:600;font-size:14px;animation:si .3s ease,so .3s ease 2.7s forwards;box-shadow:0 8px 24px #00000060}
@keyframes si{from{opacity:0;transform:translateX(40px)}}@keyframes so{to{opacity:0;transform:translateX(40px)}}
.sp{width:20px;height:20px;border:2px solid ${T.bd};border-top-color:${T.ac};border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.tabs{display:flex;gap:4px;background:${T.c2};padding:4px;border-radius:10px;margin-bottom:20px}
.tab{flex:1;padding:10px;border:none;border-radius:8px;background:transparent;color:${T.t2};font-weight:600;font-size:13px;cursor:pointer;font-family:'DM Sans'}.tab.on{background:${T.ac};color:${T.bg}}
.kb{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding-bottom:20px}
@media(max-width:900px){.kb{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.kb{grid-template-columns:1fr}}
.kc{background:${T.c2};border-radius:12px;padding:12px;min-height:200px}
.kch{display:flex;align-items:center;gap:8px;padding:8px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.5px}
.kk{background:${T.c1};border:1px solid ${T.bd};border-radius:10px;padding:14px;cursor:pointer;transition:all .2s;margin-bottom:8px}
.kk:hover{border-color:${T.ac}50;transform:translateY(-2px)}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.rbtn{padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans';transition:all .2s;border:2px solid ${T.bd};background:transparent;color:${T.t2}}
.hist-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid ${T.bd}}
.hist-row:last-child{border-bottom:none}
`;

// ==================== MAIN APP ====================
export default function AxonTiket() {
return <AuthProvider><style>{css}</style><div className="app"><Router /></div></AuthProvider>;
}

function Router() {
const { profile, loading } = useAuth();
const [view, setView] = useState("home");
const [toast, setToast] = useState(null);
const msg = useCallback((m, t = "success") => { setToast({ m, t }); setTimeout(() => setToast(null), 3000); }, []);
const [swUpdate, setSwUpdate] = useState(false);
useEffect(() => { const h = () => setSwUpdate(true); window.addEventListener("sw-updated", h); return () => window.removeEventListener("sw-updated", h); }, []);

if (loading) return <Splash />;

const toastEl = toast && <div className="toast" style={{ background: toast.t === "error" ? T.r : T.g, color: "#fff" }}>{toast.m}</div>;
const updateBanner = swUpdate && <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:200, background:T.ac, color:T.bg, padding:"10px 20px", borderRadius:10, display:"flex", alignItems:"center", gap:10, boxShadow:"0 4px 20px #0008", fontSize:13, fontFamily:"'DM Sans'" }}><span>🔄 Nova versão disponível</span><button onClick={()=>window.location.reload()} style={{ background:T.bg, color:T.ac, border:"none", borderRadius:6, padding:"4px 12px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", fontSize:12 }}>Atualizar</button></div>;

if (!profile) return <>{toastEl}{updateBanner}<Login msg={msg} /></>;

return <>
{toastEl}{updateBanner}
{profile.role === "gestor" || profile.role === "admin" ? <Gestor v={view} sv={setView} msg={msg} /> : <Motorista v={view} sv={setView} msg={msg} />}
</>;
}

function Splash() {
return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
<div className="logo" style={{ fontSize: 28, letterSpacing: 3 }}>AXON TIKET</div>
<div className="sp" /><div style={{ color: T.t3, fontSize: 13 }}>Carregando...</div>
</div>;
}

// ==================== LOGIN ====================
function Login({ msg }) {
const { login } = useAuth();
const [e, setE] = useState("");
const [p, setP] = useState("");
const [ld, setLd] = useState(false);
const [conn, setConn] = useState(null);

useEffect(() => {
fetch(`${SB_URL}/rest/v1/classes?select=name&limit=1`, { headers: { apikey: SB_KEY } })
.then(r => setConn(r.ok ? "ok" : "err")).catch(() => setConn("err"));
}, []);

const go = async () => {
if (!e || !p) return msg("Preencha e-mail e senha", "error");
setLd(true);
try { await login(e, p); msg("Login realizado!"); }
catch (err) { msg(err.message, "error"); }
finally { setLd(false); }
};

return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
<div className="fi" style={{ width: "100%", maxWidth: 380 }}>
<div style={{ textAlign: "center", marginBottom: 40 }}>
<div className="logo" style={{ fontSize: 32, letterSpacing: 3, marginBottom: 8 }}>AXON TIKET</div>
<div style={{ color: T.t3, fontSize: 14 }}>Sistema de Checklist & Manutenção</div>
{conn && <div style={{ marginTop: 8, fontSize: 11, color: conn === "ok" ? T.g : T.r }}>
{conn === "ok" ? "● Conectado ao Supabase" : "● Sem conexão com o Supabase"}
</div>}
</div>
<div className="card" style={{ padding: 28 }}>
<div style={{ marginBottom: 16 }}><label className="lbl">E-mail</label>
<input className="inp" type="email" placeholder="seu@email.com" value={e} onChange={x => setE(x.target.value)} /></div>
<div style={{ marginBottom: 24 }}><label className="lbl">Senha</label>
<input className="inp" type="password" placeholder="••••••" value={p} onChange={x => setP(x.target.value)} onKeyDown={x => x.key === "Enter" && go()} /></div>
<button className="btn bp bw" onClick={go} disabled={ld}>
{ld ? <><span className="sp" style={{ width: 16, height: 16 }} /> Entrando...</> : "Entrar"}
</button>
</div>
</div>
</div>;
}

// ==================== MOTORISTA ====================
function Motorista({ v, sv, msg }) {
const { profile, tk, logout } = useAuth();
const [eqs, setEqs] = useState([]);
const [cls, setCls] = useState([]);
const [hist, setHist] = useState([]);
const [ld, setLd] = useState(true);
const [selEq, setSelEq] = useState(null);
const [forms, setForms] = useState([]);
const [selForm, setSelForm] = useState(null);
const [items, setItems] = useState([]);
const [resp, setResp] = useState({});
const [photos, setPhotos] = useState({});
const [notes, setNotes] = useState({});
const [sending, setSending] = useState(false);
const [filtCls, setFiltCls] = useState("");
const [eqSearch, setEqSearch] = useState("");
const [selHist, setSelHist] = useState(null);
const [histResps, setHistResps] = useState([]);
const [histRespLd, setHistRespLd] = useState(false);
const [reinsps, setReinsps] = useState([]);
const [pendingEvals, setPendingEvals] = useState([]);
const [evalModal, setEvalModal] = useState(null);
const [evalStatus, setEvalStatus] = useState("");
const [evalRating, setEvalRating] = useState(5);
const [evalNotes, setEvalNotes] = useState("");
const [evalResps, setEvalResps] = useState([]);

const load = async () => {
try {
const [eq, cl, ch, ri, pe] = await Promise.all([
sb.q("equipment", tk, "active=eq.true&select=*&order=prefix"),
sb.q("classes", tk, "active=eq.true&select=*&order=name"),
sb.q("v_driver_history", tk, `driver_id=eq.${profile.id}&order=submitted_at.desc&limit=20`),
sb.q("checklists", tk, `driver_id=eq.${profile.id}&reinspection_requested=eq.true&status=neq.atendido&select=id,equipment_id,form_id,reinspection_notes`),
sb.q("v_driver_history", tk, `driver_id=eq.${profile.id}&status=eq.atendido&eval_status=is.null&order=submitted_at.desc`),
]);
setEqs(eq); setCls(cl); setHist(ch); setReinsps(ri||[]);
setPendingEvals((pe||[]).filter(c => c.problem_count > 0 && !c.reinspection_requested));
} catch (e) { msg("Erro: " + e.message, "error"); }
finally { setLd(false); }
};
useEffect(() => { load(); }, []);

const submitEval = async () => {
  if(!evalStatus) return msg("Selecione a classificação","error");
  if(evalStatus !== "totalmente_atendido" && !evalNotes.trim()) return msg("Observação obrigatória","error");
  try{
    await sb.rpc("submit_evaluation",{p_checklist_id:evalModal.id,p_status:evalStatus,p_rating:evalRating,p_notes:evalNotes.trim()||null},tk);
    msg("Avaliação enviada!"); setEvalModal(null); setEvalStatus(""); setEvalRating(5); setEvalNotes(""); load();
  }catch(err){msg(err.message,"error");}
};

const pickEq = async (eq) => {
setSelEq(eq);
try {
const f = await sb.q("forms", tk, `class_id=eq.${eq.class_id}&active=eq.true&select=*`);
setForms(f);
if (f.length === 1) pickForm(f[0]);
else if (f.length === 0) msg("Nenhum formulário para esta classe", "error");
else sv("m_pickf");
} catch (e) { msg("Erro: " + e.message, "error"); }
};

const pickForm = async (f) => {
setSelForm(f);
try {
const it = await sb.q("form_items", tk, `form_id=eq.${f.id}&active=eq.true&select=*&order=sort_order`);
setItems(it); setResp({}); setPhotos({}); setNotes({}); sv("m_fill");
} catch (e) { msg("Erro: " + e.message, "error"); }
};

const setR = (id, val) => setResp(p => ({ ...p, [id]: val }));
const setPhoto = (id, file) => setPhotos(p => ({ ...p, [id]: file }));
const setNote = (id, txt) => setNotes(p => ({ ...p, [id]: txt }));
const canSend = () => items.length > 0 && items.every(i => resp[i.id]) && items.filter(i => i.photo_rule === "mandatory").every(i => photos[i.id]);

const send = async () => {
if (!canSend()) return;
setSending(true);
try {
const [ck] = await sb.ins("checklists", { form_id: selForm.id, equipment_id: selEq.id, driver_id: profile.id, status: "triagem" }, tk);
// Upload fotos e montar respostas com photo_url
const resps = [];
for (const i of items) {
  let photo_url = null;
  if (photos[i.id]) {
    const ext = photos[i.id].name?.split(".").pop() || "jpg";
    const path = `${ck.id}/${i.id}.${ext}`;
    photo_url = await sb.upload("checklist-photos", path, photos[i.id], tk);
  }
  resps.push({ checklist_id: ck.id, form_item_id: i.id, answer: resp[i.id], photo_url, notes: notes[i.id] || null });
}
await sb.ins("checklist_responses", resps, tk);
await sb.ins("checklist_history", { checklist_id: ck.id, action: "Checklist enviado", performed_by: profile.id, performed_by_name: profile.name }, tk);
// Auto-fechar re-inspeções antigas do mesmo equipamento
const oldRi = reinsps.filter(r => r.equipment_id === selEq.id);
for (const ri of oldRi) {
  try { await sb.rpc("close_reinspection", { p_old_id: ri.id, p_performed_by: profile.id, p_performed_by_name: profile.name }, tk); } catch {}
}
msg("Checklist enviado com sucesso!"); sv("home"); load();
} catch (e) { msg("Erro: " + e.message, "error"); }
finally { setSending(false); }
};

const loadHistDetail = async (cl) => {
setSelHist(cl); setHistRespLd(true); setHistResps([]);
try { const r = await sb.q("v_checklist_items", tk, `checklist_id=eq.${cl.id}&select=*&order=sort_order`); setHistResps(r||[]); }
catch { setHistResps([]); }
finally { setHistRespLd(false); }
};

return <>
<div className="topbar"><div className="logo">AXON TIKET</div>
<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<span style={{ fontSize: 13, color: T.t2 }}>{profile.name}</span>
<button className="btn bg bs" onClick={logout}>Sair</button></div></div>
<div className="pg fi">
{ld ? <div style={{ textAlign: "center", padding: 40 }}><div className="sp" /></div> : <>
{v === "home" && <>
<h2 style={{ fontSize: 20, marginBottom: 4 }}>Olá, {profile.name.split(" ")[0]} 👋</h2>
<p style={{ color: T.t2, fontSize: 14, marginBottom: 16 }}>Selecione um equipamento para iniciar</p>
{/* Avaliações pendentes */}
{pendingEvals.length > 0 && <div style={{ marginBottom:16 }}>
<div style={{ fontSize:12, fontWeight:700, color:T.p, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>⭐ Avaliações pendentes ({pendingEvals.length})</div>
{pendingEvals.map(pe => <div key={pe.id} className="card" onClick={async()=>{setEvalModal(pe);setEvalStatus("");setEvalRating(5);setEvalNotes("");try{const r=await sb.q("v_checklist_items",tk,`checklist_id=eq.${pe.id}&answer=eq.problem`);setEvalResps(r||[]);}catch{setEvalResps([]);}}} style={{ cursor:"pointer", borderColor:T.p+"60", marginBottom:8 }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<div><div style={{ fontWeight:700, fontSize:14, fontFamily:"'JetBrains Mono'" }}><span style={{ color:T.t3, fontSize:11 }}>#{pe.ticket_number}</span> {pe.equipment_prefix} <span style={{ color:T.t3 }}>— {pe.equipment_plate}</span></div>
<div style={{ fontSize:12, color:T.t2, marginTop:2 }}>{pe.form_name}</div>
<div style={{ fontSize:11, color:T.t3, marginTop:2 }}>{new Date(pe.submitted_at).toLocaleDateString("pt-BR")} às {new Date(pe.submitted_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} • {pe.problem_count} problema{pe.problem_count>1?"s":""}</div>
<div style={{ fontSize:12, color:T.p, marginTop:4 }}>Toque para avaliar</div></div>
<span style={{ color:T.p, fontSize:20 }}>⭐</span></div></div>)}
</div>}
{/* Alertas de re-inspeção */}
{reinsps.length > 0 && <div style={{ marginBottom:16 }}>
<div style={{ fontSize:12, fontWeight:700, color:T.y, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>🔄 Re-inspeções solicitadas</div>
{reinsps.map(ri => {
const eq = eqs.find(e => e.id === ri.equipment_id);
if (!eq) return null;
return <div key={ri.id} className="card" onClick={() => pickEq(eq)} style={{ cursor:"pointer", borderColor:T.y+"60", marginBottom:8 }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<div><div style={{ fontWeight:700, fontSize:14, fontFamily:"'JetBrains Mono'" }}>{eq.prefix} <span style={{ color:T.t3 }}>— {eq.plate}</span></div>
<div style={{ fontSize:12, color:T.y, marginTop:4 }}>⚠ {ri.reinspection_notes}</div></div>
<span style={{ color:T.y, fontSize:20 }}>→</span></div></div>;
})}</div>}
{eqs.length === 0 ? <div className="card" style={{ textAlign: "center", color: T.t3, padding: 40 }}>Nenhum equipamento cadastrado. Aguarde o gestor cadastrar.</div>
: <>
{/* Filtro por classe */}
<div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
<button onClick={()=>setFiltCls("")} style={{ padding:"6px 14px", border:"none", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'", background:!filtCls?T.ac:"transparent", color:!filtCls?T.bg:T.t2, border:`1px solid ${!filtCls?T.ac:T.bd}` }}>Todos</button>
{cls.map(c=><button key={c.id} onClick={()=>setFiltCls(c.id)} style={{ padding:"6px 14px", border:`1px solid ${filtCls===c.id?T.ac:T.bd}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'", background:filtCls===c.id?T.ac:"transparent", color:filtCls===c.id?T.bg:T.t2 }}>{c.name}</button>)}
</div>
{/* Busca */}
<input className="inp" placeholder="🔍 Buscar por prefixo ou placa..." value={eqSearch} onChange={e=>setEqSearch(e.target.value)} style={{ marginBottom:12, fontSize:13 }} />
{/* Grid de equipamentos */}
<div style={{ display: "grid", gap: 10 }}>{eqs.filter(eq => {
if (filtCls && eq.class_id !== filtCls) return false;
if (eqSearch) { const s=eqSearch.toLowerCase(); if(!`${eq.prefix} ${eq.plate}`.toLowerCase().includes(s)) return false; }
return true;
}).map(eq => {
const c = cls.find(x => x.id === eq.class_id);
return <div key={eq.id} className="card" onClick={() => pickEq(eq)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<div><div style={{ fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono'" }}>{eq.prefix}<span style={{ color: T.t3 }}> — {eq.plate}</span></div>
<div style={{ fontSize: 12, color: T.t2, marginTop: 4 }}>{c?.name}</div></div>
<span style={{ color: T.ac, fontSize: 20 }}>→</span></div>;
})}</div></>}
</>}

{v === "m_pickf" && selEq && <>
<button className="btn bg bs" onClick={() => sv("home")} style={{ marginBottom: 16 }}>← Voltar</button>
<h2 style={{ fontSize: 18, marginBottom: 4 }}>Selecione o formulário</h2>
<p style={{ color: T.t2, fontSize: 13, marginBottom: 20 }}>{selEq.prefix} — {selEq.plate}</p>
<div style={{ display: "grid", gap: 10 }}>{forms.map(f =>
<div key={f.id} className="card" onClick={() => pickForm(f)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<div style={{ fontWeight: 600 }}>{f.name}</div><span style={{ color: T.ac }}>→</span></div>
)}</div>
</>}

{v === "m_fill" && selForm && <>
<button className="btn bg bs" onClick={() => sv("home")} style={{ marginBottom: 16 }}>← Cancelar</button>
<h2 style={{ fontSize: 18 }}>{selForm.name}</h2>
<div style={{ fontSize: 13, color: T.t2, marginTop: 4, marginBottom: 20 }}>{selEq.prefix} — {selEq.plate}</div>
{items.map((it, idx) => {
const a = resp[it.id];
return <div key={it.id} style={{ background: T.c2, border: `1px solid ${a === "problem" ? T.r+"50" : a === "ok" ? T.g+"30" : T.bd}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
<div><span style={{ fontSize: 12, color: T.t3, fontFamily: "'JetBrains Mono'" }}>#{idx+1}</span>
<div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{it.label}</div></div>
{it.photo_rule !== "none" && <span className="badge" style={{ background: PHC[it.photo_rule]+"20", color: PHC[it.photo_rule], fontSize: 10 }}>{PHR[it.photo_rule]}</span>}
</div>
<div style={{ display: "flex", gap: 8 }}>
{[["ok","✓ Sem problemas",T.g],["problem","✕ Com problema",T.r],["na","— Não possui",T.y]].map(([val,lbl,col]) =>
<button key={val} className="rbtn" onClick={() => setR(it.id,val)}
style={{ border:`2px solid ${a===val?col:T.bd}`, background:a===val?col+"15":"transparent", color:a===val?col:T.t2 }}>{lbl}</button>)}
</div>
{a === "problem" && <textarea className="inp" placeholder="Descreva o problema encontrado..." value={notes[it.id]||""} onChange={e=>setNote(it.id,e.target.value)} rows={2} style={{ marginTop:8, fontSize:12, resize:"vertical" }} />}
{it.photo_rule !== "none" && <div style={{ marginTop:10 }}>
<label style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:T.c3, borderRadius:8, cursor:"pointer", fontSize:13, color: photos[it.id] ? T.g : it.photo_rule==="mandatory" ? T.r : T.t2 }}>
📷 {photos[it.id] ? photos[it.id].name.substring(0,20) : it.photo_rule==="mandatory" ? "Tirar foto (obrigatória)" : "Tirar foto (opcional)"}
<input type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e => { if(e.target.files[0]) setPhoto(it.id, e.target.files[0]); }} />
</label>
{photos[it.id] && <img src={URL.createObjectURL(photos[it.id])} alt="" style={{ marginTop:6, maxWidth:"100%", maxHeight:120, borderRadius:8, objectFit:"cover" }} />}
</div>}
</div>;
})}
<div style={{ position: "sticky", bottom: 80, background: T.bg, padding: "16px 0" }}>
<button className="btn bp bw" disabled={!canSend()||sending} onClick={send} style={{ padding: "14px 24px", fontSize: 16 }}>
{sending ? <><span className="sp" style={{width:16,height:16}}/> Enviando...</> : "Enviar Checklist"}</button>
{!canSend() && items.length > 0 && <div style={{ fontSize:11, color:T.r, textAlign:"center", marginTop:8 }}>Preencha todos os itens{items.some(i=>i.photo_rule==="mandatory"&&!photos[i.id])?" e fotos obrigatórias":""}</div>}
</div>
</>}

{v === "m_hist" && <>
<h2 style={{ fontSize: 20, marginBottom: 20 }}>Meus Checklists</h2>
{hist.length === 0 ? <div className="card" style={{ textAlign:"center", color:T.t3, padding:40 }}>Nenhum checklist enviado</div>
: hist.map(cl => {
const col = KAN.find(k => k.id === cl.status);
return <div key={cl.id} className="card" style={{ marginBottom: 10, cursor:"pointer" }} onClick={()=>loadHistDetail(cl)}>
<div style={{ display:"flex", justifyContent:"space-between" }}>
<div><div style={{ fontWeight:700, fontSize:14 }}>{cl.form_name}</div>
<div style={{ fontSize:12, color:T.t2, marginTop:2 }}><span style={{ fontFamily:"'JetBrains Mono'", color:T.t3 }}>#{cl.ticket_number}</span> {cl.equipment_prefix} — {cl.equipment_plate}</div>
<div style={{ fontSize:11, color:T.t3, marginTop:2 }}>{new Date(cl.submitted_at).toLocaleDateString("pt-BR")} às {new Date(cl.submitted_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div></div>
<div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
<span className="badge" style={{ background:col?.color+"20", color:col?.color }}>{col?.icon} {col?.label}</span>
<span style={{ fontSize:10, color:T.ac }}>ver detalhes →</span></div></div>
{cl.reinspection_requested && <div style={{ marginTop:8, fontSize:12, color:T.y }}>⚠ Re-inspeção: {cl.reinspection_notes}</div>}
{cl.conclusion_text && <div style={{ marginTop:8, fontSize:12, color:T.g }}>✓ {cl.gestor_name ? `${cl.gestor_name}: ` : ""}{cl.conclusion_text}</div>}
{cl.eval_status && <div style={{ marginTop:6, fontSize:11, color:T.p }}>⭐ {cl.eval_rating}/10 — {cl.eval_status==="totalmente_atendido"?"Totalmente atendido":cl.eval_status==="parcialmente"?"Parcialmente":"Não atendido"}</div>}
{cl.status==="atendido" && !cl.eval_status && !cl.reinspection_requested && <div style={{ marginTop:6, fontSize:11, color:T.p, fontWeight:600 }}>⭐ Pendente de avaliação</div>}
</div>;
})}

{/* Modal detalhe do histórico */}
{selHist && <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setSelHist(null)}>
<div className="card fi" style={{ maxWidth:500, width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
<div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
<h3 style={{ fontSize:16 }}>Detalhes do Checklist</h3>
<button style={{ background:"none", border:"none", color:T.t2, cursor:"pointer", fontSize:18 }} onClick={()=>setSelHist(null)}>✕</button></div>
<div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.t2 }}>Equipamento</div>
<div style={{ fontSize:11, color:T.t3, fontFamily:"'JetBrains Mono'", marginBottom:2 }}>Ticket #{selHist.ticket_number}</div>
<div style={{ fontWeight:700, fontFamily:"'JetBrains Mono'" }}>{selHist.equipment_prefix} — {selHist.equipment_plate}</div></div>
<div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.t2 }}>Formulário</div><div style={{ fontWeight:600 }}>{selHist.form_name}</div></div>
<div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.t2 }}>Enviado em</div>
<div>{new Date(selHist.submitted_at).toLocaleDateString("pt-BR")} às {new Date(selHist.submitted_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div></div>
{selHist.conclusion_text && <div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.t2 }}>Conclusão do Gestor{selHist.gestor_name ? ` — ${selHist.gestor_name}` : ""}</div><div style={{ color:T.g }}>✓ {selHist.conclusion_text}</div>
{selHist.concluded_at && <div style={{ fontSize:10, color:T.t3, marginTop:2 }}>{new Date(selHist.concluded_at).toLocaleDateString("pt-BR")} às {new Date(selHist.concluded_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>}
</div>}
{selHist.reinspection_requested && <div style={{ marginBottom:8, color:T.y }}>⚠ Re-inspeção solicitada: {selHist.reinspection_notes}</div>}
{selHist.eval_status && <div style={{ marginBottom:8, padding:"10px 14px", background:T.p+"15", border:`1px solid ${T.p}40`, borderRadius:8 }}>
<div style={{ fontSize:12, color:T.t2, marginBottom:4 }}>Como você avaliou este atendimento</div>
<div style={{ fontWeight:700, color:T.p }}>⭐ {selHist.eval_rating}/10 — {selHist.eval_status==="totalmente_atendido"?"Totalmente atendido":selHist.eval_status==="parcialmente"?"Parcialmente atendido":"Não atendido"}</div>
{selHist.eval_notes && <div style={{ fontSize:12, color:T.t2, marginTop:4, fontStyle:"italic" }}>💬 {selHist.eval_notes}</div>}
<div style={{ fontSize:10, color:T.t3, marginTop:4 }}>{new Date(selHist.eval_at).toLocaleDateString("pt-BR")} às {new Date(selHist.eval_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
</div>}
<div style={{ fontSize:12, fontWeight:700, color:T.t2, textTransform:"uppercase", letterSpacing:.5, marginTop:12, marginBottom:8 }}>Respostas</div>
{histRespLd ? <div style={{ textAlign:"center", padding:12 }}><span className="sp" style={{width:16,height:16}}/></div>
: histResps.length === 0 ? <div style={{ fontSize:12, color:T.t3 }}>Nenhuma resposta encontrada</div>
: histResps.map((r,i) => {
const ans=r.answer, color=ans==="ok"?T.g:ans==="problem"?T.r:T.y;
const icon=ans==="ok"?"✓":ans==="problem"?"✕":"—";
const lbl=ans==="ok"?"Sem problemas":ans==="problem"?"Com problema":"Não possui";
return <div key={i} style={{ padding:"6px 0", borderBottom:`1px solid ${T.bd}` }}>
<div style={{ display:"flex", alignItems:"center", gap:8 }}>
<span style={{ color, fontWeight:700, fontSize:14, minWidth:20 }}>{icon}</span>
<span style={{ flex:1, fontSize:13 }}>{r.label||"Item"}</span>
<span className="badge" style={{ background:color+"20", color, fontSize:9 }}>{lbl}</span></div>
{r.notes && <div style={{ marginTop:3, marginLeft:28, fontSize:11, color:T.y, fontStyle:"italic" }}>💬 {r.notes}</div>}
{r.photo_url && <a href={r.photo_url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block", marginTop:3, marginLeft:28 }}>
<img src={r.photo_url} alt="Foto" style={{ width:60, height:60, objectFit:"cover", borderRadius:6, border:`1px solid ${T.bd}` }} /></a>}
</div>; })}
</div></div>}
</>}
{v === "m_pw" && <PwChange msg={msg} />}
{v === "m_dash" && <DriverDashboard tk={tk} pid={profile.id} />}

{/* Evaluation Modal */}
{evalModal && <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setEvalModal(null)}>
<div className="card fi" style={{ maxWidth:440, width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
<div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
<h3 style={{ fontSize:16 }}>⭐ Avaliar Atendimento</h3>
<button style={{ background:"none", border:"none", color:T.t2, cursor:"pointer", fontSize:18 }} onClick={()=>setEvalModal(null)}>✕</button></div>
<div style={{ marginBottom:12 }}><div style={{ fontSize:11, color:T.t3, fontFamily:"'JetBrains Mono'", marginBottom:2 }}>Ticket #{evalModal.ticket_number}</div>
<div style={{ fontWeight:700, fontFamily:"'JetBrains Mono'" }}>{evalModal.equipment_prefix} — {evalModal.equipment_plate}</div>
<div style={{ fontSize:12, color:T.t2 }}>{evalModal.form_name}</div>
<div style={{ fontSize:11, color:T.t3, marginTop:4 }}>Enviado em {new Date(evalModal.submitted_at).toLocaleDateString("pt-BR")} às {new Date(evalModal.submitted_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
</div>
{evalModal.gestor_name && <div style={{ marginBottom:12, padding:"10px 14px", background:T.g+"12", border:`1px solid ${T.g}30`, borderRadius:8 }}>
<div style={{ fontSize:11, fontWeight:700, color:T.g, marginBottom:4 }}>✅ Conclusão do Gestor</div>
<div style={{ fontSize:12, color:T.t1 }}>{evalModal.gestor_name}</div>
{evalModal.concluded_at && <div style={{ fontSize:10, color:T.t3, marginTop:2 }}>{new Date(evalModal.concluded_at).toLocaleDateString("pt-BR")} às {new Date(evalModal.concluded_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>}
{evalModal.conclusion_text && <div style={{ fontSize:12, color:T.t2, marginTop:6, fontStyle:"italic" }}>💬 {evalModal.conclusion_text}</div>}
</div>}
{evalResps.length > 0 && <div style={{ marginBottom:12, padding:"10px 14px", background:T.r+"10", border:`1px solid ${T.r}30`, borderRadius:8 }}>
<div style={{ fontSize:11, fontWeight:700, color:T.r, marginBottom:8 }}>⚠️ Problemas reportados ({evalResps.length})</div>
{evalResps.map((r,i) => <div key={i} style={{ padding:"6px 0", borderBottom:i<evalResps.length-1?`1px solid ${T.bd}`:"none" }}>
<div style={{ fontSize:13, fontWeight:600 }}>{r.label||"Item"}</div>
{r.notes && <div style={{ fontSize:11, color:T.y, marginTop:2, fontStyle:"italic" }}>💬 {r.notes}</div>}
{r.photo_url && <img src={r.photo_url} alt="" style={{ width:60, height:60, objectFit:"cover", borderRadius:6, border:`1px solid ${T.bd}`, marginTop:4 }} />}
</div>)}
</div>}
<div className="lbl">Como foi o atendimento?</div>
<div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
{[["totalmente_atendido","✅ Totalmente atendido",T.g],["parcialmente","⚠️ Parcialmente atendido",T.y],["nao_atendido","❌ Não atendido",T.r]].map(([v,l,c])=>
<button key={v} onClick={()=>setEvalStatus(v)} style={{ padding:"10px 14px", borderRadius:8, border:`2px solid ${evalStatus===v?c:T.bd}`, background:evalStatus===v?c+"15":"transparent", color:evalStatus===v?c:T.t2, fontFamily:"'DM Sans'", fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"left" }}>{l}</button>)}
</div>
<div className="lbl">Nota (0 a 10)</div>
<div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:16 }}>
{[...Array(11)].map((_,i)=><button key={i} onClick={()=>setEvalRating(i)} style={{ width:32, height:32, borderRadius:8, border:`2px solid ${evalRating===i?T.ac:T.bd}`, background:evalRating===i?T.ac:"transparent", color:evalRating===i?T.bg:T.t2, fontFamily:"'JetBrains Mono'", fontSize:13, fontWeight:700, cursor:"pointer" }}>{i}</button>)}
</div>
{evalStatus && evalStatus !== "totalmente_atendido" && <>
<div className="lbl">Observação (obrigatória)</div>
<textarea className="inp" rows={3} placeholder="Descreva o que não foi atendido..." value={evalNotes} onChange={e=>setEvalNotes(e.target.value)} style={{ resize:"vertical", fontSize:13, marginBottom:16 }} /></>}
<button className="btn bp bw" onClick={submitEval}>Enviar Avaliação</button>
</div></div>}
</>}
</div>
<nav className="nav">
<button className={`ni ${v==="home"?"on":""}`} onClick={() => sv("home")}>🚛 <span>Equipamentos</span></button>
<button className={`ni ${v==="m_hist"?"on":""}`} onClick={() => { sv("m_hist"); load(); }}>🕐 <span>Histórico</span></button>
<button className={`ni ${v==="m_dash"?"on":""}`} onClick={() => sv("m_dash")}>📊 <span>Relatórios</span></button>
<button className={`ni ${v==="m_pw"?"on":""}`} onClick={() => sv("m_pw")}>👤 <span>Perfil</span></button>
</nav>
</>;
}

// ==================== GESTOR ====================
function Gestor({ v, sv, msg }) {
const { profile, tk, logout } = useAuth();
const [kan, setKan] = useState([]);
const [cls, setCls] = useState([]);
const [ld, setLd] = useState(true);
const [mt, setMt] = useState("classes");
const [selCard, setSelCard] = useState(null);
const [moveTo, setMoveTo] = useState(null);
const [concl, setConcl] = useState("");
// FIX #2: estado para histórico do card selecionado
const [cardHistory, setCardHistory] = useState([]);
const [cardResps, setCardResps] = useState([]);
const [histLd, setHistLd] = useState(false);
// KANBAN V2: filtros e expansão
const [period, setPeriod] = useState("7d");
const [filtEq, setFiltEq] = useState("");
const [filtDr, setFiltDr] = useState("");
const [filtUr, setFiltUr] = useState("");
const [filtDate, setFiltDate] = useState("");
const [kSearch, setKSearch] = useState("");
const [expandCol, setExpandCol] = useState({});
const MAX_VIS = 6;
const [newCount, setNewCount] = useState(0);
const [emailDomain, setEmailDomain] = useState("");
const lastKanLen = useRef(0);
const beep = () => { try { const a=new AudioContext(),o=a.createOscillator(),g=a.createGain(); o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.value=0.3;o.start();o.stop(a.currentTime+0.15); } catch(e){} };
const notifyNew = (n) => { if(n<=0) return; beep(); setNewCount(n); document.title=`(${n}) AXON TIKET`; if(Notification.permission==="granted") new Notification("AXON TIKET",{body:`${n} novo${n>1?"s":""} checklist${n>1?"s":""}`,icon:"/icon-192.png"}); };

const calDays = (iso) => { const d=new Date(iso), n=new Date(); return Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5); };
const relDt = (iso) => { const d=new Date(iso), df=calDays(iso); const dt=d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}); const rel=df===0?"Hoje":df===1?"Ontem":df+"d"; return `${dt} (${rel})`; };
const fmtTm = (iso) => new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});

const kanFiltered = useMemo(() => {
return kan.filter(c => {
const df = calDays(c.submitted_at);
if (period==="today"&&df>0) return false;
if (period==="7d"&&df>7) return false;
if (period==="30d"&&df>30) return false;
if (filtEq && c.equipment_prefix!==filtEq) return false;
if (filtDr && c.driver_name!==filtDr) return false;
if (filtUr==="problem" && c.problem_count===0) return false;
if (filtUr==="ok" && c.problem_count>0) return false;
if (filtDate) { const d=new Date(c.submitted_at); const ld=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; if(ld!==filtDate) return false; }
if (kSearch) { const s=kSearch.trim().toLowerCase(); if(/^\d+$/.test(s)){if(String(c.ticket_number)!==s) return false;} else if(!`${c.equipment_prefix} ${c.equipment_plate} ${c.driver_name} ${c.form_name}`.toLowerCase().includes(s)) return false; }
return true;
});
}, [kan, period, filtEq, filtDr, filtUr, filtDate, kSearch]);

const kpis = useMemo(() => {
const t=kanFiltered.filter(c=>c.status==="triagem").length;
const ea=kanFiltered.filter(c=>c.status==="em_atendimento").length;
const tProb=kanFiltered.filter(c=>c.status==="triagem"&&c.problem_count>0).length;
return { triagem:t, emAtendimento:ea, triagemProblema:tProb, atendidos:kanFiltered.filter(c=>c.status==="atendido").length };
}, [kanFiltered]);

const hasKFilter = filtEq||filtDr||filtUr||filtDate||kSearch;
const clearKFilters = () => { setFiltEq("");setFiltDr("");setFiltUr("");setFiltDate("");setKSearch(""); };

const load = async () => {
try {
const [k, c] = await Promise.all([
sb.q("v_kanban", tk, "order=submitted_at.desc"),
sb.q("classes", tk, "active=eq.true&select=*&order=name"),
]);
setKan(k); setCls(c);
try { const d = await sb.rpc("get_setting",{p_key:"email_domain"},tk); if(d) setEmailDomain(d); } catch{}
} catch (e) { msg("Erro: " + e.message, "error"); }
finally { setLd(false); }
};
useEffect(() => { load(); if(Notification.permission==="default") Notification.requestPermission(); }, []);

// Polling 30s para novos checklists
useEffect(() => {
const poll = async () => { try {
const fresh = await sb.q("v_kanban", tk, "order=submitted_at.desc");
if(lastKanLen.current > 0 && fresh.length > lastKanLen.current) {
const diff = fresh.length - lastKanLen.current;
notifyNew(diff);
setKan(fresh);
}
lastKanLen.current = fresh.length;
} catch(e){} };
lastKanLen.current = kan.length;
const id = setInterval(poll, 30000);
return () => clearInterval(id);
}, [kan.length]);

// FIX #2: busca histórico completo do checklist
const loadCardHistory = async (id) => {
setHistLd(true);
setCardHistory([]);
setCardResps([]);
try {
const [h, r] = await Promise.all([
sb.q("checklist_history", tk, `checklist_id=eq.${id}&order=created_at.asc&select=*`),
sb.q("v_checklist_items", tk, `checklist_id=eq.${id}&select=*&order=sort_order`)
]);
setCardHistory(h);
setCardResps(r||[]);
} catch(e) { setCardHistory([]); setCardResps([]); }
finally { setHistLd(false); }
};

const closeCard = () => { setSelCard(null); setMoveTo(null); setConcl(""); setCardHistory([]); setCardResps([]); setReinspNotes(""); setShowReinsp(false); };
const [reinspNotes, setReinspNotes] = useState("");
const [showReinsp, setShowReinsp] = useState(false);

const requestReinsp = async (id) => {
if (!reinspNotes.trim()) return msg("Informe o motivo da re-inspeção", "error");
try {
await sb.rpc("request_reinspection", { p_checklist_id: id, p_performed_by: profile.id, p_performed_by_name: profile.name, p_notes: reinspNotes.trim() }, tk);
msg("Re-inspeção solicitada!"); closeCard(); load();
} catch (e) { msg("Erro: " + e.message, "error"); }
};

const move = async (id, status) => {
if (status === "atendido" && !concl.trim()) return msg("Justificativa obrigatória", "error");
try {
await sb.rpc("move_checklist", { p_checklist_id: id, p_new_status: status, p_performed_by: profile.id, p_performed_by_name: profile.name, p_conclusion_text: status === "atendido" ? concl : null }, tk);
msg(`Movido para ${KAN.find(k => k.id === status)?.label}`);
closeCard(); load();
} catch (e) { msg(e.message, "error"); }
};

// Helper: formata data/hora pt-BR compacto
const fmtDt = (iso) => new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });

return <>
<div className="topbar"><div className="logo">AXON TIKET</div>
<div style={{ display:"flex", alignItems:"center", gap:12 }}>
<span className="badge" style={{ background:T.ac+"20", color:T.ac }}>{profile.role==="admin"?"Admin":"Gestor"}</span>
<span style={{ fontSize:13, color:T.t2 }}>{profile.name}</span>
<button className="btn bg bs" onClick={logout}>Sair</button></div></div>
<div className="pg fi">
{ld ? <div style={{ textAlign:"center", padding:40 }}><div className="sp"/></div> : <>
{v === "home" && <>
{/* Title + Period tabs */}
<div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:10 }}>
<h2 style={{ fontSize:20, margin:0 }}>Kanban de Manutenção</h2>
<div style={{ display:"flex", gap:2, background:T.c2, padding:3, borderRadius:8 }}>
{[["today","Hoje"],["7d","7 dias"],["30d","30 dias"],["all","Todos"]].map(([id,lb]) =>
<button key={id} onClick={()=>setPeriod(id)} style={{ padding:"5px 12px", border:"none", borderRadius:6, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'", background:period===id?T.ac:"transparent", color:period===id?T.bg:T.t2 }}>{lb}</button>)}
</div>
<span style={{ fontSize:11, color:T.t3 }}>{kanFiltered.length} de {kan.length}</span>
</div>
{/* KPIs */}
<div className="kpig">
{[["📋","Triagem",kpis.triagem,T.y],["🔧","Em Atendimento",kpis.emAtendimento,"#3b82f6"],["⚠️","Triagem c/ Problemas",kpis.triagemProblema,T.r],["✅","Atendidos",kpis.atendidos,T.g]].map(([ic,lb,val,co],i) =>
<div key={i} style={{ background:T.c1, border:`1px solid ${T.bd}`, borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
<span style={{ fontSize:20 }}>{ic}</span>
<div><div style={{ fontSize:20, fontWeight:700, fontFamily:"'JetBrains Mono'", color:co }}>{val}</div>
<div style={{ fontSize:9, color:T.t2, textTransform:"uppercase", letterSpacing:.3 }}>{lb}</div></div></div>)}
</div>
{/* Filters */}
<div className="filtrow">
<input placeholder="🔍 Ticket, equip, motorista..." value={kSearch} onChange={e=>setKSearch(e.target.value)}
className="inp finp" style={{ padding:"7px 12px", fontSize:12, width:200, minWidth:160 }} />
<select className="inp finp" style={{ width:"auto", padding:"7px 10px", fontSize:11, minWidth:120 }} value={filtEq} onChange={e=>setFiltEq(e.target.value)}>
<option value="">Equipamento</option>{[...new Set(kan.map(c=>c.equipment_prefix))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
<select className="inp finp" style={{ width:"auto", padding:"7px 10px", fontSize:11, minWidth:120 }} value={filtDr} onChange={e=>setFiltDr(e.target.value)}>
<option value="">Motorista</option>{[...new Set(kan.map(c=>c.driver_name))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
<select className="inp finp" style={{ width:"auto", padding:"7px 10px", fontSize:11, minWidth:120 }} value={filtUr} onChange={e=>setFiltUr(e.target.value)}>
<option value="">Urgência</option><option value="problem">⚠ Com problemas</option><option value="ok">✓ Sem problemas</option></select>
<input type={filtDate?"date":"text"} placeholder="📅 Data" className="inp finp" style={{ width:"auto", padding:"7px 10px", fontSize:11, minWidth:130 }} value={filtDate} onChange={e=>setFiltDate(e.target.value)} onFocus={e=>{e.target.type="date";}} onBlur={e=>{if(!e.target.value) e.target.type="text";}} />
{hasKFilter && <button className="btn bg bs" style={{ color:T.r, fontSize:10 }} onClick={clearKFilters}>✕ Limpar</button>}
</div>
{/* Kanban Grid */}
<div className="kb">{KAN.map(col => {
const allCards = kanFiltered.filter(c => c.status === col.id);
const probTotal = allCards.reduce((s,c) => s + c.problem_count, 0);
const expanded = expandCol[col.id];
const visCards = expanded ? allCards : allCards.slice(0, MAX_VIS);
const hiddenN = allCards.length - MAX_VIS;
return <div key={col.id} className="kc">
<div className="kch"><span className="dot" style={{ background:col.color }}/><span style={{ color:col.color }}>{col.label}</span>
<span style={{ marginLeft:"auto", fontSize:12, color:T.t3 }}>{allCards.length}</span>
{probTotal > 0 && <span style={{ fontSize:10, color:T.r, fontWeight:700 }}>⚠{probTotal}</span>}</div>
{visCards.map(cl => { const urg = cl.problem_count>=3?T.r:cl.problem_count>0?T.y:T.g;
return <div key={cl.id} className="kk" style={{ borderLeft:`3px solid ${urg}`, padding:"8px 10px", marginBottom:5 }} onClick={() => { setSelCard(cl); setMoveTo(null); setConcl(""); loadCardHistory(cl.id); }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<span style={{ fontWeight:700, fontSize:12, fontFamily:"'JetBrains Mono'" }}><span style={{ color:T.t3, fontSize:10 }}>#{cl.ticket_number}</span> {cl.equipment_prefix} <span style={{ color:T.t3, fontWeight:400, fontSize:10 }}>— {cl.equipment_plate}</span></span>
{cl.reinspection_requested && <span style={{ fontSize:8, color:T.y, fontWeight:700, marginLeft:6 }}>{cl.status==="atendido"?"🔄 REINSPEÇÃO ATENDIDA":"🔄 REINSPEÇÃO SOLICITADA"}</span>}
{cl.problem_count > 0 ? <span style={{ fontSize:9, fontWeight:700, color:cl.problem_count>=3?T.r:T.y, background:(cl.problem_count>=3?T.r:T.y)+"15", padding:"1px 5px", borderRadius:10 }}>⚠ {cl.problem_count}</span>
: <span style={{ fontSize:9, color:T.g }}>✓</span>}</div>
<div style={{ fontSize:10, color:T.t2, marginTop:2 }}>{cl.form_name}</div>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:3 }}>
<span style={{ fontSize:9, color:T.t3 }}>{cl.driver_name}</span>
<span style={{ fontSize:8, color:T.t3, fontFamily:"'JetBrains Mono'" }}>{relDt(cl.submitted_at)} {fmtTm(cl.submitted_at)}</span></div>
{cl.assigned_to_name && <div style={{ marginTop:2, fontSize:9, color:T.ac }}>👤 {cl.assigned_to_name}</div>}
{cl.reinspection_requested && <div style={{ marginTop:2, fontSize:9, color:T.y, fontWeight:600 }}>🔄 Re-inspeção solicitada</div>}
</div>; })}
{hiddenN > 0 && !expanded && <button onClick={() => setExpandCol(p=>({...p,[col.id]:true}))} style={{ width:"100%", padding:"7px 0", border:`1px dashed ${T.bd}`, borderRadius:8, background:"transparent", color:T.ac, fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'", marginTop:2 }}>↓ Ver mais {hiddenN}</button>}
{expanded && allCards.length > MAX_VIS && <button onClick={() => setExpandCol(p=>({...p,[col.id]:false}))} style={{ width:"100%", padding:"5px 0", border:"none", borderRadius:8, background:"transparent", color:T.t3, fontSize:9, cursor:"pointer", fontFamily:"'DM Sans'", marginTop:2 }}>↑ Recolher</button>}
{!allCards.length && <div style={{ padding:16, textAlign:"center", color:T.t3, fontSize:11 }}>Vazio</div>}
</div>;
})}</div>
</>}

{v === "g_mgmt" && <>
<h2 style={{ fontSize:20, marginBottom:16 }}>Gerenciamento</h2>
<div className="tabs">
{[[profile.role==="admin"&&"gestors","Gestores"],["classes","Classes"],["forms","Formulários"],["users","Motoristas"],["equip","Equipamentos"],[profile.role==="admin"&&"config","⚙ Config"]].filter(([k])=>k).map(([k,l]) =>
<button key={k} className={`tab ${mt===k?"on":""}`} onClick={() => setMt(k)}>{l}</button>)}
</div>
{mt === "gestors" && profile.role==="admin" && <GestorMgr tk={tk} msg={msg} domain={emailDomain} />}
{mt === "classes" && <ClassMgr tk={tk} cls={cls} reload={load} msg={msg} />}
{mt === "forms" && <FormMgr tk={tk} cls={cls} reload={load} msg={msg} pid={profile.id} />}
{mt === "users" && <UserMgr tk={tk} msg={msg} domain={emailDomain} />}
{mt === "equip" && <EquipMgr tk={tk} cls={cls} reload={load} msg={msg} />}
{mt === "config" && profile.role==="admin" && <ConfigMgr tk={tk} msg={msg} domain={emailDomain} setDomain={setEmailDomain} />}
</>}
{v === "g_pw" && <PwChange msg={msg} />}
{v === "g_dash" && <Dashboard tk={tk} />}
</>}
</div>

{selCard && <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={closeCard}>
<div className="card fi" style={{ maxWidth:500, width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
<div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
<h3 style={{ fontSize:16 }}>Detalhes do Checklist</h3>
<button style={{ background:"none", border:"none", color:T.t2, cursor:"pointer", fontSize:18 }} onClick={closeCard}>✕</button></div>

<div style={{ marginBottom:4, fontSize:11, color:T.t3, fontFamily:"'JetBrains Mono'" }}>Ticket #{selCard.ticket_number}</div>
<div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:T.t2 }}>Equipamento</div>
<div style={{ fontWeight:700, fontFamily:"'JetBrains Mono'" }}>{selCard.equipment_prefix} — {selCard.equipment_plate}</div></div>
<div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:T.t2 }}>Motorista</div><div style={{ fontWeight:600 }}>{selCard.driver_name}</div></div>
<div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:T.t2 }}>Formulário</div><div>{selCard.form_name}</div></div>
<div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:T.t2 }}>Itens</div><div>{selCard.total_items} total — <span style={{ color:T.r }}>{selCard.problem_count} com problema</span></div></div>

{selCard.conclusion_text && <div style={{ marginBottom:12, padding:"10px 14px", background:T.g+"12", border:`1px solid ${T.g}30`, borderRadius:8 }}>
<div style={{ fontSize:11, fontWeight:700, color:T.g, marginBottom:4 }}>✅ Conclusão do Gestor{selCard.assigned_to_name ? ` — ${selCard.assigned_to_name}` : ""}</div>
<div style={{ fontSize:12, color:T.t2 }}>{selCard.conclusion_text}</div>
{selCard.concluded_at && <div style={{ fontSize:10, color:T.t3, marginTop:4 }}>{new Date(selCard.concluded_at).toLocaleDateString("pt-BR")} às {new Date(selCard.concluded_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>}
</div>}

{/* Itens individuais do checklist */}
{cardResps.length > 0 && <div style={{ marginBottom:12 }}>
<div style={{ fontSize:12, fontWeight:700, color:T.t2, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Respostas</div>
{cardResps.map((r, i) => {
const ans = r.answer;
const color = ans === "ok" ? T.g : ans === "problem" ? T.r : T.y;
const icon = ans === "ok" ? "✓" : ans === "problem" ? "✕" : "—";
const lbl = ans === "ok" ? "Sem problemas" : ans === "problem" ? "Com problema" : "Não possui";
return <div key={i} style={{ padding:"6px 0", borderBottom:`1px solid ${T.bd}` }}>
<div style={{ display:"flex", alignItems:"center", gap:8 }}>
<span style={{ color, fontWeight:700, fontSize:14, minWidth:20 }}>{icon}</span>
<span style={{ flex:1, fontSize:13 }}>{r.label || "Item"}</span>
<span className="badge" style={{ background:color+"20", color, fontSize:9 }}>{lbl}</span>
</div>
{r.photo_url && <a href={r.photo_url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block", marginTop:4, marginLeft:28 }}>
<img src={r.photo_url} alt="Foto" style={{ width:60, height:60, objectFit:"cover", borderRadius:6, border:`1px solid ${T.bd}`, cursor:"pointer" }} />
</a>}
{r.notes && <div style={{ marginTop:4, marginLeft:28, fontSize:11, color:T.y, fontStyle:"italic" }}>💬 {r.notes}</div>}
</div>;
})}
</div>}

{/* FIX #2: Histórico de movimentações */}
<div style={{ marginTop:20, marginBottom:8 }}>
<div style={{ fontSize:12, fontWeight:700, color:T.t2, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>📋 Histórico</div>
{histLd
  ? <div style={{ textAlign:"center", padding:12 }}><span className="sp" style={{ width:16, height:16 }}/></div>
  : cardHistory.length === 0
    ? <div style={{ fontSize:12, color:T.t3, padding:"8px 0" }}>Nenhum registro encontrado</div>
    : cardHistory.map(h => <div key={h.id} className="hist-row">
        <div style={{ fontSize:10, color:T.t3, minWidth:72, flexShrink:0, paddingTop:2 }}>{fmtDt(h.created_at)}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.tx }}>{h.action}</div>
          <div style={{ fontSize:11, color:T.t2 }}>{h.performed_by_name}</div>
          {h.conclusion_text && <div style={{ fontSize:11, color:T.g, marginTop:3, fontStyle:"italic" }}>"{h.conclusion_text}"</div>}
        </div>
      </div>)
}
</div>

{/* Re-inspeção */}
{!selCard.reinspection_requested && <div style={{ marginTop:16 }}>
<button className="btn bg bs" style={{ color:T.y, borderColor:T.y+"40", width:"100%" }} onClick={()=>setShowReinsp(!showReinsp)}>🔄 Solicitar Re-inspeção ao motorista</button>
{showReinsp && <div className="fi" style={{ marginTop:8 }}>
<textarea className="inp" rows={2} placeholder="O que precisa ser re-inspecionado..." value={reinspNotes} onChange={e=>setReinspNotes(e.target.value)} style={{ resize:"vertical", fontSize:12 }} />
<button className="btn bp bw" style={{ marginTop:8, background:T.y }} onClick={()=>requestReinsp(selCard.id)}>Confirmar re-inspeção</button></div>}
</div>}
{selCard.reinspection_requested && <div style={{ marginTop:16, padding:"10px 14px", background:T.y+"15", border:`1px solid ${T.y}40`, borderRadius:8 }}>
<div style={{ fontSize:11, fontWeight:700, color:T.y }}>🔄 Re-inspeção solicitada</div>
<div style={{ fontSize:12, color:T.t2, marginTop:4 }}>{selCard.reinspection_notes}</div></div>}

{selCard.eval_status && <div style={{ marginTop:16, padding:"10px 14px", background:T.p+"15", border:`1px solid ${T.p}40`, borderRadius:8 }}>
<div style={{ fontSize:11, fontWeight:700, color:T.p }}>⭐ Avaliação do Motorista</div>
<div style={{ fontSize:14, fontWeight:700, color:T.p, marginTop:4 }}>{selCard.eval_rating}/10 — {selCard.eval_status==="totalmente_atendido"?"Totalmente atendido":selCard.eval_status==="parcialmente"?"Parcialmente atendido":"Não atendido"}</div>
{selCard.eval_notes && <div style={{ fontSize:12, color:T.t2, marginTop:4, fontStyle:"italic" }}>💬 {selCard.eval_notes}</div>}
<div style={{ fontSize:10, color:T.t3, marginTop:4 }}>{selCard.eval_at && new Date(selCard.eval_at).toLocaleDateString("pt-BR")}</div></div>}
{selCard.status==="atendido" && !selCard.eval_status && !selCard.reinspection_requested && <div style={{ marginTop:16, padding:"8px 14px", background:T.p+"10", border:`1px dashed ${T.p}40`, borderRadius:8, fontSize:11, color:T.p }}>⭐ Aguardando avaliação do motorista</div>}

<div style={{ marginTop:20, fontSize:12, fontWeight:700, color:T.t2, textTransform:"uppercase", marginBottom:8 }}>Mover para</div>
<div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
{KAN.filter(k => k.id !== selCard.status).map(k =>
<button key={k.id} className="btn bg bs" style={moveTo===k.id?{background:k.color+"20",borderColor:k.color,color:k.color}:{}} onClick={() => setMoveTo(k.id)}>{k.icon} {k.label}</button>)}
</div>
{moveTo === "atendido" && <div className="fi" style={{ marginTop:12 }}><label className="lbl">Justificativa *</label>
<textarea className="inp" rows={3} placeholder="O que foi feito..." value={concl} onChange={e => setConcl(e.target.value)} style={{ resize:"vertical" }} /></div>}
{moveTo && <button className="btn bp bw" style={{ marginTop:12 }} onClick={() => move(selCard.id, moveTo)}>Confirmar movimentação</button>}
</div>
</div>}

<nav className="nav">
<button className={`ni ${v==="home"?"on":""}`} onClick={() => { sv("home"); load(); setNewCount(0); document.title="AXON TIKET"; }}>📋 <span>Kanban</span>{newCount>0&&<span style={{ position:"absolute",top:2,right:8,background:T.r,color:"#fff",fontSize:9,fontWeight:700,borderRadius:10,padding:"1px 5px",minWidth:14,textAlign:"center",lineHeight:"14px",fontFamily:"'JetBrains Mono'" }}>{newCount}</span>}</button>
<button className={`ni ${v==="g_mgmt"?"on":""}`} onClick={() => { sv("g_mgmt"); load(); }}>⚙️ <span>Gerenciar</span></button>
<button className={`ni ${v==="g_dash"?"on":""}`} onClick={() => sv("g_dash")}>📊 <span>Relatórios</span></button>
<button className={`ni ${v==="g_pw"?"on":""}`} onClick={() => sv("g_pw")}>👤 <span>Perfil</span></button>
</nav>
</>;
}

// ==================== CRUD ====================
function ClassMgr({ tk, cls, reload, msg }) {
const [n, setN] = useState("");
const [editId, setEditId] = useState(null);
const [editName, setEditName] = useState("");
const add = async () => { if (!n.trim()) return; try { await sb.ins("classes",{name:n.trim()},tk); setN(""); msg("Classe criada"); reload(); } catch(e){msg(e.message,"error");} };
const save = async (id) => { if(!editName.trim()) return; try { await sb.upd("classes",{name:editName.trim()},{id},tk); setEditId(null); msg("Classe atualizada"); reload(); } catch(e){msg(e.message,"error");} };
const del = async (id,name) => { if(!window.confirm(`Desativar a classe "${name}"?`)) return; try { await sb.upd("classes",{active:false},{id},tk); msg("Classe removida"); reload(); } catch(e){msg(e.message,"error");} };
return <><div style={{ display:"flex", gap:8, marginBottom:20 }}>
<input className="inp" placeholder="Nome da nova classe" value={n} onChange={e => setN(e.target.value)} onKeyDown={e => e.key==="Enter"&&add()} />
<button className="btn bp" onClick={add}>+</button></div>
<div style={{ display:"grid", gap:8 }}>{cls.map(c => <div key={c.id} className="card" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
{editId===c.id ? <div style={{ display:"flex", gap:8, flex:1 }}>
<input className="inp" value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save(c.id)} />
<button className="btn bp bs" onClick={()=>save(c.id)}>✓</button>
<button className="btn bg bs" onClick={()=>setEditId(null)}>✕</button></div>
: <><div style={{ fontWeight:600 }}>{c.name}</div>
<div style={{ display:"flex", gap:4 }}>
<button className="btn bg bs" onClick={()=>{setEditId(c.id);setEditName(c.name);}}>✎</button>
<button className="btn bg bs" style={{ color:T.r }} onClick={()=>del(c.id,c.name)}>🗑</button></div></>}
</div>)}</div></>;
}

function FormMgr({ tk, cls, reload, msg, pid }) {
const [forms, setForms] = useState([]); const [nn,setNn]=useState(""); const [nc,setNc]=useState("");
const [ef,setEf]=useState(null); const [its,setIts]=useState([]); const [nil,setNil]=useState(""); const [nip,setNip]=useState("optional");
const [eid,setEid]=useState(null); const [eil,setEil]=useState(""); const [eip,setEip]=useState("");
const [efn,setEfn]=useState(""); const [efnEdit,setEfnEdit]=useState(false);
useEffect(() => { loadF(); }, []);
const loadF = async () => setForms(await sb.q("forms",tk,"active=eq.true&select=*&order=name"));
const addF = async () => { if(!nn.trim()||!nc) return; try{await sb.ins("forms",{name:nn.trim(),class_id:nc,created_by:pid},tk); setNn(""); msg("Formulário criado"); loadF();}catch(e){msg(e.message,"error");} };
const delF = async (f) => { if(!window.confirm(`Desativar formulário "${f.name}"?`)) return; try{await sb.upd("forms",{active:false},{id:f.id},tk); if(ef?.id===f.id) setEf(null); msg("Formulário removido"); loadF();}catch(e){msg(e.message,"error");} };
const openF = async f => { setEf(f); setIts(await sb.q("form_items",tk,`form_id=eq.${f.id}&active=eq.true&select=*&order=sort_order`)); };
const addI = async () => { if(!nil.trim()||!ef) return; try{await sb.ins("form_items",{form_id:ef.id,label:nil.trim(),photo_rule:nip,sort_order:its.length},tk); setNil(""); msg("Verificação adicionada"); openF(ef);}catch(e){msg(e.message,"error");} };
const delI = async (it) => { if(!window.confirm(`Remover "${it.label}"?`)) return; try{await sb.upd("form_items",{active:false},{id:it.id},tk); msg("Item removido"); openF(ef);}catch(e){msg(e.message,"error");} };
const saveI = async (id) => { if(!eil.trim()) return; try{await sb.upd("form_items",{label:eil.trim(),photo_rule:eip},{id},tk); setEid(null); msg("Verificação atualizada"); openF(ef);}catch(e){msg(e.message,"error");} };
const saveF = async (f) => { if(!efn.trim()) return; try{await sb.upd("forms",{name:efn.trim()},{id:f.id},tk); setEfnEdit(false); setEf({...f,name:efn.trim()}); msg("Formulário renomeado"); loadF();}catch(e){msg(e.message,"error");} };

return <><div className="card" style={{ marginBottom:20 }}>
<div style={{ fontWeight:600, marginBottom:12 }}>Novo Formulário</div>
<div style={{ display:"flex", gap:8 }}>
<select className="inp" value={nc} onChange={e=>setNc(e.target.value)}><option value="">Classe...</option>{cls.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
<input className="inp" placeholder="Nome" value={nn} onChange={e=>setNn(e.target.value)} />
<button className="btn bp" onClick={addF}>+</button></div></div>
{cls.map(cl => { const cf=forms.filter(f=>f.class_id===cl.id); if(!cf.length) return null;
return <div key={cl.id} style={{ marginBottom:24 }}>
<div style={{ fontSize:12, fontWeight:700, color:T.ac, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{cl.name}</div>
{cf.map(f => <div key={f.id} className="card" style={{ marginBottom:8 }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:ef?.id===f.id?16:0 }}>
{ef?.id===f.id && efnEdit ? <div style={{ display:"flex", gap:4, flex:1 }}>
<input className="inp" style={{ flex:1, padding:"6px 10px", fontSize:13 }} value={efn} onChange={e=>setEfn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveF(f)} />
<button className="btn bp bs" style={{ fontSize:10 }} onClick={()=>saveF(f)}>✓</button>
<button className="btn bg bs" style={{ fontSize:10 }} onClick={()=>setEfnEdit(false)}>✕</button></div>
: <div style={{ fontWeight:600, cursor:ef?.id===f.id?"pointer":"default" }} onClick={()=>{if(ef?.id===f.id){setEfn(f.name);setEfnEdit(true);}}}>{f.name} {ef?.id===f.id && <span style={{ fontSize:9, color:T.t3 }}>✎</span>}</div>}
<div style={{ display:"flex", gap:4 }}>
<button className="btn bg bs" onClick={() => ef?.id===f.id?setEf(null):openF(f)}>{ef?.id===f.id?"✕":"✎"}</button>
<button className="btn bg bs" style={{ color:T.r }} onClick={()=>delF(f)}>🗑</button></div></div>
{ef?.id===f.id && <div className="fi">
{its.map((it,idx) => <div key={it.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:`1px solid ${T.bd}`, flexWrap:"wrap" }}>
{eid===it.id ? <>
<span style={{ fontSize:12, color:T.t3, fontFamily:"'JetBrains Mono'", minWidth:24 }}>#{idx+1}</span>
<input className="inp" style={{ flex:2, minWidth:140, padding:"6px 10px", fontSize:12 }} value={eil} onChange={e=>setEil(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveI(it.id)} />
<select className="inp" style={{ flex:1, minWidth:120, padding:"6px 10px", fontSize:12 }} value={eip} onChange={e=>setEip(e.target.value)}>
<option value="mandatory">📷 Obrigatória</option><option value="optional">📷 Opcional</option><option value="none">Sem foto</option></select>
<button className="btn bp bs" style={{ padding:"4px 8px", fontSize:10 }} onClick={()=>saveI(it.id)}>✓</button>
<button className="btn bg bs" style={{ padding:"4px 8px", fontSize:10 }} onClick={()=>setEid(null)}>✕</button>
</> : <>
<span style={{ fontSize:12, color:T.t3, fontFamily:"'JetBrains Mono'", minWidth:24 }}>#{idx+1}</span>
<span style={{ flex:1, fontSize:13 }}>{it.label}</span>
<span className="badge" style={{ background:(PHC[it.photo_rule]||T.t3)+"20", color:PHC[it.photo_rule]||T.t3, fontSize:9 }}>
{it.photo_rule==="mandatory"?"📷 Obrig.":it.photo_rule==="optional"?"📷 Opc.":"Sem foto"}</span>
<button className="btn bg bs" style={{ padding:"2px 6px", fontSize:10 }} onClick={()=>{setEid(it.id);setEil(it.label);setEip(it.photo_rule||"none");}}>✎</button>
<button className="btn bg bs" style={{ color:T.r, padding:"2px 6px", fontSize:10 }} onClick={()=>delI(it)}>✕</button>
</>}</div>)}
<div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
<input className="inp" placeholder="Nova verificação" style={{ flex:2, minWidth:180 }} value={nil} onChange={e=>setNil(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addI()} />
<select className="inp" style={{ flex:1, minWidth:130 }} value={nip} onChange={e=>setNip(e.target.value)}>
<option value="mandatory">📷 Obrigatória</option><option value="optional">📷 Opcional</option><option value="none">Sem foto</option></select>
<button className="btn bp bs" onClick={addI}>+ Add</button></div>
</div>}
</div>)}
</div>; })}</>;
}

function UserMgr({ tk, msg, domain }) {
const [us,setUs]=useState([]); const [n,setN]=useState(""); const [eu,setEu]=useState(""); const [p,setP]=useState("");
const [editId,setEditId]=useState(null); const [eN,setEN]=useState(""); const [eE,setEE]=useState("");
const [showAll,setShowAll]=useState(false);
useEffect(()=>{loadU();},[showAll]);
const loadU = async () => setUs(await sb.q("profiles",tk,`role=eq.motorista${showAll?"":"&active=eq.true"}&select=*&order=name`));
const add = async () => { if(!n.trim()||!eu.trim()||!p.trim()) return msg("Preencha tudo","error");
const email = domain ? `${eu.trim()}@${domain}` : eu.trim();
if(us.filter(u=>u.active!==false).some(u=>u.name.toLowerCase()===n.trim().toLowerCase())) return msg("Já existe motorista com esse nome","error");
try{
  await sb.createUser(email,p.trim(),{name:n.trim(),role:"motorista"});
  setN("");setEu("");setP(""); msg("Motorista cadastrado!"); setTimeout(()=>loadU(),1500);
}catch(err){msg(err.message,"error");} };
const saveEdit = async (u) => { if(!eN.trim()||!eE.trim()) return msg("Preencha nome e e-mail","error");
if(us.filter(x=>x.active!==false).some(x=>x.id!==u.id&&x.name.toLowerCase()===eN.trim().toLowerCase())) return msg("Nome já existe","error");
try{
  await sb.upd("profiles",{name:eN.trim()},{id:u.id},tk);
  if(eE.trim().toLowerCase()!==u.email.toLowerCase()) await sb.rpc("update_user_email",{target_user_id:u.id,new_email:eE.trim()},tk);
  setEditId(null); msg("Motorista atualizado"); loadU();
}catch(err){msg(err.message,"error");} };
return <><div className="card" style={{ marginBottom:20 }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}><div style={{ fontWeight:600 }}>Cadastrar Motorista</div><button className="btn bg bs" style={{ fontSize:10, padding:"4px 10px" }} onClick={()=>setShowAll(!showAll)}>{showAll?"👁 Ocultar inativos":"👁 Ver inativos"}</button></div>
<div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
<input className="inp" placeholder="Nome" style={{ flex:1, minWidth:140 }} value={n} onChange={x=>setN(x.target.value)} />
<div style={{ display:"flex", flex:1, minWidth:180 }}>
<input className="inp" placeholder="usuário" style={{ flex:1, borderRadius:domain?"8px 0 0 8px":"8px" }} value={eu} onChange={x=>setEu(x.target.value.replace(/[@\s]/g,""))} />
{domain && <span style={{ background:T.c3, border:`1px solid ${T.bd}`, borderLeft:"none", borderRadius:"0 8px 8px 0", padding:"8px 10px", fontSize:12, color:T.t2, whiteSpace:"nowrap" }}>@{domain}</span>}
</div>
<input className="inp" type="password" placeholder="Senha" style={{ flex:1, minWidth:110 }} value={p} onChange={x=>setP(x.target.value)} />
<button className="btn bp" onClick={add}>+</button></div></div>
<div style={{ display:"grid", gap:8 }}>{us.map(u => <div key={u.id} className="card" style={{ opacity:u.active===false?.5:1 }}>
{editId===u.id ? <div>
<div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
<input className="inp" placeholder="Nome" style={{ flex:1, minWidth:140 }} value={eN} onChange={x=>setEN(x.target.value)} />
<input className="inp" placeholder="E-mail completo" style={{ flex:1, minWidth:180 }} value={eE} onChange={x=>setEE(x.target.value)} /></div>
<div style={{ display:"flex", gap:6 }}>
<button className="btn bp bs" onClick={()=>saveEdit(u)}>✓ Salvar</button>
<button className="btn bg bs" onClick={()=>setEditId(null)}>✕ Cancelar</button></div></div>
: <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<div><div style={{ fontWeight:600 }}>{u.name} {u.active===false&&<span className="badge" style={{ background:T.r+"20", color:T.r, fontSize:9, marginLeft:6 }}>Inativo</span>}</div><div style={{ fontSize:12, color:T.t2 }}>{u.email}</div></div>
<div style={{ display:"flex", gap:4 }}>
{u.active!==false&&<><button className="btn bg bs" onClick={()=>{setEditId(u.id);setEN(u.name);setEE(u.email);}}>✎</button>
<button className="btn bg bs" onClick={async()=>{const pw=window.prompt(`Nova senha para ${u.name} (mín. 6):`);if(!pw)return;try{await sb.rpc("reset_user_password",{target_user_id:u.id,new_password:pw},tk);msg("Senha resetada!");}catch(err){msg(err.message,"error");}}}>🔑</button>
<button className="btn bg bs" style={{ color:T.r }} onClick={async()=>{if(!window.confirm(`Desativar "${u.name}"?`))return;try{await sb.upd("profiles",{active:false},{id:u.id},tk);msg("Desativado");loadU();}catch(err){msg(err.message,"error");}}}>🗑</button></>}
{u.active===false&&<button className="btn bg bs" style={{ color:T.g }} onClick={async()=>{if(!window.confirm(`Reativar "${u.name}"?`))return;try{await sb.upd("profiles",{active:true},{id:u.id},tk);msg("Reativado!");loadU();}catch(err){msg(err.message,"error");}}}>♻</button>}
</div></div>}
</div>)}</div></>;
}

function GestorMgr({ tk, msg, domain }) {
const [gs,setGs]=useState([]); const [n,setN]=useState(""); const [eu,setEu]=useState(""); const [p,setP]=useState("");
const [editId,setEditId]=useState(null); const [eN,setEN]=useState(""); const [eE,setEE]=useState("");
const [showAll,setShowAll]=useState(false);
useEffect(()=>{loadG();},[showAll]);
const loadG = async () => setGs(await sb.q("profiles",tk,`role=eq.gestor${showAll?"":"&active=eq.true"}&select=*&order=name`));
const add = async () => { if(!n.trim()||!eu.trim()||!p.trim()) return msg("Preencha tudo","error");
const email = domain ? `${eu.trim()}@${domain}` : eu.trim();
if(gs.filter(g=>g.active!==false).some(g=>g.name.toLowerCase()===n.trim().toLowerCase())) return msg("Já existe gestor com esse nome","error");
try{
  await sb.createUser(email,p.trim(),{name:n.trim(),role:"gestor"});
  setN("");setEu("");setP(""); msg("Gestor cadastrado!"); setTimeout(()=>loadG(),1500);
}catch(err){msg(err.message,"error");} };
const saveEdit = async (g) => { if(!eN.trim()||!eE.trim()) return msg("Preencha nome e e-mail","error");
if(gs.filter(x=>x.active!==false).some(x=>x.id!==g.id&&x.name.toLowerCase()===eN.trim().toLowerCase())) return msg("Nome já existe","error");
try{
  await sb.upd("profiles",{name:eN.trim()},{id:g.id},tk);
  if(eE.trim().toLowerCase()!==g.email.toLowerCase()) await sb.rpc("update_user_email",{target_user_id:g.id,new_email:eE.trim()},tk);
  setEditId(null); msg("Gestor atualizado"); loadG();
}catch(err){msg(err.message,"error");} };
return <><div className="card" style={{ marginBottom:20 }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}><div style={{ fontWeight:600 }}>Cadastrar Gestor</div><button className="btn bg bs" style={{ fontSize:10, padding:"4px 10px" }} onClick={()=>setShowAll(!showAll)}>{showAll?"👁 Ocultar inativos":"👁 Ver inativos"}</button></div>
<div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
<input className="inp" placeholder="Nome" style={{ flex:1, minWidth:140 }} value={n} onChange={x=>setN(x.target.value)} />
<div style={{ display:"flex", flex:1, minWidth:180 }}>
<input className="inp" placeholder="usuário" style={{ flex:1, borderRadius:domain?"8px 0 0 8px":"8px" }} value={eu} onChange={x=>setEu(x.target.value.replace(/[@\s]/g,""))} />
{domain && <span style={{ background:T.c3, border:`1px solid ${T.bd}`, borderLeft:"none", borderRadius:"0 8px 8px 0", padding:"8px 10px", fontSize:12, color:T.t2, whiteSpace:"nowrap" }}>@{domain}</span>}
</div>
<input className="inp" type="password" placeholder="Senha" style={{ flex:1, minWidth:110 }} value={p} onChange={x=>setP(x.target.value)} />
<button className="btn bp" onClick={add}>+</button></div></div>
<div style={{ display:"grid", gap:8 }}>{gs.map(g => <div key={g.id} className="card" style={{ opacity:g.active===false?.5:1 }}>
{editId===g.id ? <div>
<div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
<input className="inp" placeholder="Nome" style={{ flex:1, minWidth:140 }} value={eN} onChange={x=>setEN(x.target.value)} />
<input className="inp" placeholder="E-mail completo" style={{ flex:1, minWidth:180 }} value={eE} onChange={x=>setEE(x.target.value)} /></div>
<div style={{ display:"flex", gap:6 }}>
<button className="btn bp bs" onClick={()=>saveEdit(g)}>✓ Salvar</button>
<button className="btn bg bs" onClick={()=>setEditId(null)}>✕ Cancelar</button></div></div>
: <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<div><div style={{ fontWeight:600 }}>{g.name} {g.active===false&&<span className="badge" style={{ background:T.r+"20", color:T.r, fontSize:9, marginLeft:6 }}>Inativo</span>}</div><div style={{ fontSize:12, color:T.t2 }}>{g.email}</div></div>
<div style={{ display:"flex", gap:4 }}>
{g.active!==false&&<><button className="btn bg bs" onClick={()=>{setEditId(g.id);setEN(g.name);setEE(g.email);}}>✎</button>
<button className="btn bg bs" onClick={async()=>{const pw=window.prompt(`Nova senha para ${g.name} (mín. 6):`);if(!pw)return;try{await sb.rpc("reset_user_password",{target_user_id:g.id,new_password:pw},tk);msg("Senha resetada!");}catch(err){msg(err.message,"error");}}}>🔑</button>
<button className="btn bg bs" style={{ color:T.r }} onClick={async()=>{if(!window.confirm(`Desativar "${g.name}"?`))return;try{await sb.upd("profiles",{active:false},{id:g.id},tk);msg("Desativado");loadG();}catch(err){msg(err.message,"error");}}}>🗑</button></>}
{g.active===false&&<button className="btn bg bs" style={{ color:T.g }} onClick={async()=>{if(!window.confirm(`Reativar "${g.name}"?`))return;try{await sb.upd("profiles",{active:true},{id:g.id},tk);msg("Reativado!");loadG();}catch(err){msg(err.message,"error");}}}>♻</button>}
</div></div>}
</div>)}</div></>;
}

function EquipMgr({ tk, cls, reload, msg }) {
const [eqs,setEqs]=useState([]); const [px,setPx]=useState(""); const [pl,setPl]=useState(""); const [ci,setCi]=useState("");
const [editId,setEditId]=useState(null); const [ePx,setEPx]=useState(""); const [ePl,setEPl]=useState(""); const [eCi,setECi]=useState("");
const [showAll,setShowAll]=useState(false);
useEffect(()=>{loadE();},[showAll]);
const loadE = async () => setEqs(await sb.q("equipment",tk,`${showAll?"":"active=eq.true&"}select=*&order=prefix`));
const add = async () => { if(!px.trim()||!pl.trim()||!ci) return msg("Preencha tudo","error");
try{await sb.ins("equipment",{prefix:px.trim(),plate:pl.trim().toUpperCase(),class_id:ci},tk); setPx("");setPl("");setCi(""); msg("Equipamento cadastrado!"); loadE(); reload();}catch(e){msg(e.message,"error");} };
const save = async (id) => { if(!ePx.trim()||!ePl.trim()||!eCi) return; try{await sb.upd("equipment",{prefix:ePx.trim(),plate:ePl.trim().toUpperCase(),class_id:eCi},{id},tk); setEditId(null); msg("Equipamento atualizado"); loadE(); reload();}catch(e){msg(e.message,"error");} };
const del = async (eq) => { if(!window.confirm(`Desativar "${eq.prefix} — ${eq.plate}"?`)) return; try{await sb.upd("equipment",{active:false},{id:eq.id},tk); msg("Equipamento removido"); loadE(); reload();}catch(e){msg(e.message,"error");} };
return <><div className="card" style={{ marginBottom:20 }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}><div style={{ fontWeight:600 }}>Cadastrar Equipamento</div><button className="btn bg bs" style={{ fontSize:10, padding:"4px 10px" }} onClick={()=>setShowAll(!showAll)}>{showAll?"👁 Ocultar inativos":"👁 Ver inativos"}</button></div>
<div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
<input className="inp" placeholder="Prefixo (ex: CM-001)" style={{ flex:1, minWidth:120 }} value={px} onChange={e=>setPx(e.target.value)} />
<input className="inp" placeholder="Placa (ex: ABC1D23)" style={{ flex:1, minWidth:120 }} value={pl} onChange={e=>setPl(e.target.value)} />
<select className="inp" style={{ flex:1, minWidth:140 }} value={ci} onChange={e=>setCi(e.target.value)}>
<option value="">Classe...</option>{cls.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
<button className="btn bp" onClick={add}>+</button></div></div>
<div style={{ display:"grid", gap:8 }}>{eqs.map(eq => { const c=cls.find(x=>x.id===eq.class_id);
return <div key={eq.id} className="card" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", opacity:eq.active===false?.5:1 }}>
{editId===eq.id ? <div style={{ display:"flex", gap:6, flex:1, flexWrap:"wrap", alignItems:"center" }}>
<input className="inp" style={{ flex:1, minWidth:100 }} value={ePx} onChange={e=>setEPx(e.target.value)} />
<input className="inp" style={{ flex:1, minWidth:100 }} value={ePl} onChange={e=>setEPl(e.target.value)} />
<select className="inp" style={{ flex:1, minWidth:120 }} value={eCi} onChange={e=>setECi(e.target.value)}>{cls.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
<button className="btn bp bs" onClick={()=>save(eq.id)}>✓</button>
<button className="btn bg bs" onClick={()=>setEditId(null)}>✕</button></div>
: <><div><div style={{ fontWeight:700, fontFamily:"'JetBrains Mono'" }}>{eq.prefix} — {eq.plate} {eq.active===false&&<span className="badge" style={{ background:T.r+"20", color:T.r, fontSize:9, marginLeft:6 }}>Inativo</span>}</div><div style={{ fontSize:12, color:T.t2 }}>{c?.name}</div></div>
<div style={{ display:"flex", gap:4 }}>
{eq.active!==false&&<><button className="btn bg bs" onClick={()=>{setEditId(eq.id);setEPx(eq.prefix);setEPl(eq.plate);setECi(eq.class_id);}}>✎</button>
<button className="btn bg bs" style={{ color:T.r }} onClick={()=>del(eq)}>🗑</button></>}
{eq.active===false&&<button className="btn bg bs" style={{ color:T.g }} onClick={async()=>{if(!window.confirm(`Reativar "${eq.prefix} — ${eq.plate}"?`))return;try{await sb.upd("equipment",{active:true},{id:eq.id},tk);msg("Reativado!");loadE();reload();}catch(e){msg(e.message,"error");}}}>♻</button>}
</div></>}
</div>;
})}</div></>;
}

function DriverDashboard({ tk, pid }) {
const [data, setData] = useState(null); const [period, setPeriod] = useState(30); const [ld, setLd] = useState(true);
useEffect(() => { (async () => { setLd(true); try { const r = await sb.rpc("get_driver_dashboard",{p_driver_id:pid,p_days:period},tk); setData(typeof r==="string"?JSON.parse(r):r); } catch(e) { console.error(e); } finally { setLd(false); } })(); }, [period]);
if (ld) return <div style={{ textAlign:"center", padding:40 }}><div className="sp"/></div>;
if (!data) return <div style={{ padding:20, color:T.t2 }}>Sem dados</div>;
const k = data.kpis||{}, st = data.status||{}, ev = data.evals||{};
const statusColor = s => s==="atendido"?T.g:s==="em_atendimento"?T.ac:s==="triagem"?T.y:T.t3;
const statusLabel = s => s==="atendido"?"Atendido":s==="em_atendimento"?"Em atendimento":s==="triagem"?"Triagem":"Processado";
return <><h2 style={{ fontSize:20, marginBottom:4 }}>Meus Relatórios</h2>
<div style={{ display:"flex", gap:6, marginBottom:16 }}>
{[[7,"7d"],[30,"30d"],[90,"90d"]].map(([d,l])=>
<button key={d} className={`tab ${period===d?"on":""}`} onClick={()=>setPeriod(d)} style={{ fontSize:11, padding:"6px 14px" }}>{l}</button>)}
</div>
<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:14 }}>
<div className="card" style={{ textAlign:"center", padding:14 }}><div style={{ fontSize:24, fontWeight:700, color:T.ac, fontFamily:"'JetBrains Mono'" }}>{k.total||0}</div><div style={{ fontSize:10, fontWeight:700, color:T.t2, textTransform:"uppercase" }}>Checklists Válidos</div></div>
<div className="card" style={{ textAlign:"center", padding:14 }}><div style={{ fontSize:24, fontWeight:700, color:T.r, fontFamily:"'JetBrains Mono'" }}>{k.with_problems||0}</div><div style={{ fontSize:10, fontWeight:700, color:T.t2, textTransform:"uppercase" }}>Com Problemas</div></div>
<div className="card" style={{ textAlign:"center", padding:14 }}><div style={{ fontSize:24, fontWeight:700, color:T.p, fontFamily:"'JetBrains Mono'" }}>{k.avg_rating_given||"—"}</div><div style={{ fontSize:10, fontWeight:700, color:T.t2, textTransform:"uppercase" }}>Nota Média Dada</div></div>
</div>

<div className="card" style={{ marginBottom:14 }}>
<div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>Status dos Envios</div>
<div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
{[["triagem",st.triagem],["em_atendimento",st.em_atendimento],["processado",st.processado],["atendido",st.atendido]].filter(([,v])=>v>0).map(([s,v])=>
<span key={s} className="badge" style={{ background:statusColor(s)+"20", color:statusColor(s), fontSize:11 }}>{statusLabel(s)}: {v}</span>)}
</div>
{k.pending_eval>0 && <div style={{ marginTop:8, fontSize:12, color:T.p }}>⭐ {k.pending_eval} avaliação(ões) pendente(s)</div>}
</div>

{(ev.totalmente>0||ev.parcialmente>0||ev.nao_atendido>0) && <div className="card" style={{ marginBottom:14 }}>
<div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>Suas Avaliações</div>
<div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
{[["Totalmente",ev.totalmente,T.g],["Parcialmente",ev.parcialmente,T.y],["Não atendido",ev.nao_atendido,T.r]].map(([l,v,c])=>
v>0 && <span key={l} className="badge" style={{ background:c+"20", color:c, fontSize:11 }}>{l}: {v}</span>)}
</div></div>}

{data.recent?.length > 0 && <div className="card">
<div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>Últimos Envios</div>
{data.recent.map((r,i) => <div key={r.id} style={{ padding:"10px 0", borderBottom:i<data.recent.length-1?`1px solid ${T.bd}`:"none" }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
<div>
<div style={{ fontWeight:700, fontSize:13, fontFamily:"'JetBrains Mono'" }}><span style={{ color:T.t3, fontSize:10 }}>#{r.ticket_number}</span> {r.equipment}</div>
<div style={{ fontSize:11, color:T.t2 }}>{r.form_name}</div>
<div style={{ fontSize:10, color:T.t3, marginTop:2 }}>{new Date(r.submitted_at).toLocaleDateString("pt-BR")} às {new Date(r.submitted_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
</div>
<div style={{ textAlign:"right" }}>
<span className="badge" style={{ background:statusColor(r.status)+"20", color:statusColor(r.status), fontSize:9 }}>{statusLabel(r.status)}</span>
{r.problem_count>0 && <div style={{ fontSize:10, color:T.r, marginTop:3 }}>⚠ {r.problem_count} problema{r.problem_count>1?"s":""}</div>}
{r.eval_status && <div style={{ fontSize:10, color:T.p, marginTop:2 }}>⭐ {r.eval_rating}/10</div>}
</div></div>
{r.conclusion_text && <div style={{ fontSize:11, color:T.g, marginTop:4 }}>✅ {r.gestor_name}: {r.conclusion_text}</div>}
</div>)}
</div>}
</>;
}

function ConfigMgr({ tk, msg, domain, setDomain }) {
const [newDom, setNewDom] = useState("");
const [changeLd, setChangeLd] = useState(false);
const changeDomain = async () => {
  if(!newDom.trim()||newDom.trim().length<3) return msg("Domínio inválido","error");
  if(!window.confirm(`Trocar domínio de @${domain} para @${newDom.trim()} em TODOS os e-mails?`)) return;
  setChangeLd(true);
  try {
    const r = await sb.rpc("change_email_domain",{p_old_domain:domain,p_new_domain:newDom.trim()},tk);
    const res = typeof r==="string"?JSON.parse(r):r;
    msg(`Domínio atualizado! ${res.updated} e-mail(s) alterado(s)`);
    setDomain(newDom.trim()); setNewDom("");
  } catch(e) { msg(e.message,"error"); }
  setChangeLd(false);
};
return <>
<div className="card" style={{ marginBottom:16 }}>
<div style={{ fontWeight:600, marginBottom:12 }}>Domínio de E-mail</div>
<div style={{ fontSize:12, color:T.t2, marginBottom:12 }}>Ao criar motoristas e gestores, o domínio será preenchido automaticamente.</div>
<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
<span style={{ fontSize:13, color:T.t2 }}>Domínio atual:</span>
<span className="badge" style={{ background:T.ac+"20", color:T.ac, fontSize:13 }}>@{domain||"não definido"}</span>
</div>
<div style={{ fontWeight:600, fontSize:13, marginBottom:8 }}>Trocar domínio em massa</div>
<div style={{ fontSize:11, color:T.y, marginBottom:8 }}>⚠ Altera o e-mail de TODOS os usuários ativos com @{domain}</div>
<div style={{ display:"flex", gap:8 }}>
<div style={{ display:"flex", flex:1 }}>
<span style={{ background:T.c3, border:`1px solid ${T.bd}`, borderRadius:"8px 0 0 8px", padding:"8px 10px", fontSize:12, color:T.t2 }}>@</span>
<input className="inp" placeholder="novodominio.com" style={{ flex:1, borderRadius:"0 8px 8px 0", borderLeft:"none" }} value={newDom} onChange={e=>setNewDom(e.target.value.replace(/[@\s]/g,""))} />
</div>
<button className="btn bp" onClick={changeDomain} disabled={changeLd}>{changeLd?"Atualizando...":"Aplicar"}</button>
</div></div>
</>;
}

function PwChange({ msg }) {
const { tk, profile } = useAuth();
const [np,setNp]=useState(""); const [cp,setCp]=useState(""); const [ld,setLd]=useState(false);
const [editSelf,setEditSelf]=useState(false); const [sN,setSN]=useState(profile.name); const [sE,setSE]=useState(profile.email);
const go = async () => { if(np.length<6) return msg("Mín. 6 caracteres","error"); if(np!==cp) return msg("Senhas não conferem","error");
setLd(true); try{await sb.updatePassword(tk,np); msg("Senha alterada!"); setNp("");setCp("");}catch(e){msg(e.message,"error");}finally{setLd(false);} };
const saveSelf = async () => { if(!sN.trim()||!sE.trim()) return msg("Preencha nome e e-mail","error");
try{
  await sb.upd("profiles",{name:sN.trim()},{id:profile.id},tk);
  if(sE.trim().toLowerCase()!==profile.email.toLowerCase()) await sb.rpc("update_user_email",{target_user_id:profile.id,new_email:sE.trim()},tk);
  msg("Perfil atualizado!"); setEditSelf(false);
}catch(e){msg(e.message,"error");} };
return <><h2 style={{ fontSize:20, marginBottom:20 }}>Meu Perfil</h2>
<div className="card" style={{ marginBottom:16 }}>
{editSelf ? <div>
<div style={{ marginBottom:8 }}><div className="lbl">Nome</div><input className="inp" value={sN} onChange={e=>setSN(e.target.value)} /></div>
<div style={{ marginBottom:12 }}><div className="lbl">E-mail</div><input className="inp" value={sE} onChange={e=>setSE(e.target.value)} /></div>
<div style={{ display:"flex", gap:6 }}>
<button className="btn bp bs" onClick={saveSelf}>✓ Salvar</button>
<button className="btn bg bs" onClick={()=>{setEditSelf(false);setSN(profile.name);setSE(profile.email);}}>✕ Cancelar</button></div>
</div> : <div>
<div style={{ fontSize:12, color:T.t2 }}>Nome</div><div style={{ fontWeight:600, fontSize:18 }}>{profile.name}</div>
<div style={{ fontSize:12, color:T.t2, marginTop:8 }}>E-mail</div><div>{profile.email}</div>
<div style={{ fontSize:12, color:T.t2, marginTop:8 }}>Perfil</div>
<span className="badge" style={{ background:T.ac+"20", color:T.ac, marginTop:4 }}>{profile.role==="admin"?"Administrador":profile.role==="gestor"?"Gestor de Manutenção":"Motorista"}</span>
{profile.role==="admin" && <div style={{ marginTop:12 }}><button className="btn bg bs" onClick={()=>setEditSelf(true)}>✎ Editar meu perfil</button></div>}
</div>}</div>
<div className="card">
<div style={{ fontWeight:600, marginBottom:12 }}>Alterar Senha</div>
<div style={{ marginBottom:10 }}><input className="inp" type="password" placeholder="Nova senha (mín. 6)" value={np} onChange={e=>setNp(e.target.value)} /></div>
<div style={{ marginBottom:16 }}><input className="inp" type="password" placeholder="Confirmar" value={cp} onChange={e=>setCp(e.target.value)} /></div>
<button className="btn bp" onClick={go} disabled={ld}>{ld?"Salvando...":"Alterar Senha"}</button></div></>;
}

function Dashboard({ tk }) {
const [days, setDays] = useState(30);
const [data, setData] = useState(null);
const [ld, setLd] = useState(true);
const [showExport, setShowExport] = useState(false);
const [expDriver, setExpDriver] = useState("");
const [expFrom, setExpFrom] = useState("");
const [expTo, setExpTo] = useState("");
const [expLd, setExpLd] = useState(false);
const [drivers, setDrivers] = useState([]);
const load = async () => { setLd(true); try { const r = await sb.rpc("get_dashboard",{p_days:days},tk); setData(r); } catch(e){console.error(e);} setLd(false); };
useEffect(() => { load(); }, [days]);
const Bar = ({ label, value, max, color }) => <div style={{ marginBottom:8 }}>
<div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}><span style={{ color:T.t1 }}>{label}</span><span style={{ fontFamily:"'JetBrains Mono'", fontWeight:700, color }}>{value}</span></div>
<div style={{ background:T.c2, borderRadius:6, height:10, overflow:"hidden" }}><div style={{ width:`${max?Math.round(value/max*100):0}%`, height:"100%", background:color, borderRadius:6, transition:"width .3s" }}/></div></div>;
const Kpi = ({ icon, label, value, color, sub }) => <div style={{ background:T.c1, border:`1px solid ${T.bd}`, borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
<span style={{ fontSize:20 }}>{icon}</span>
<div><div style={{ fontSize:20, fontWeight:700, fontFamily:"'JetBrains Mono'", color }}>{value}</div>
<div style={{ fontSize:9, color:T.t2, textTransform:"uppercase", letterSpacing:.3 }}>{label}</div>
{sub && <div style={{ fontSize:9, color:T.t3, marginTop:2 }}>{sub}</div>}</div></div>;
const Section = ({ title, children }) => <div style={{ background:T.c1, border:`1px solid ${T.bd}`, borderRadius:10, padding:16, marginBottom:14 }}>
<div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:T.t1 }}>{title}</div>{children}</div>;
if(ld) return <div style={{ textAlign:"center", padding:40 }}><div className="sp"/></div>;
if(!data) return <div style={{ textAlign:"center", padding:40, color:T.t3 }}>Sem dados</div>;
const k = data.kpis, s = data.sla || {}, b = data.backlog || {};
const pct = k.total > 0 ? Math.round(k.with_problems/k.total*100) : 0;
const maxDaily = data.daily ? Math.max(...data.daily.map(d=>d.total)) : 0;
const maxProb = data.top_problems?.length ? data.top_problems[0].count : 0;
const maxEquip = data.by_equipment?.length ? Math.max(...data.by_equipment.map(e=>e.total)) : 0;
const maxGestor = data.by_gestor?.length ? Math.max(...data.by_gestor.map(g=>g.total)) : 0;

const openExport = async () => { setShowExport(true); if(!drivers.length) { const d=await sb.q("profiles",tk,"role=eq.motorista&active=eq.true&select=id,name&order=name"); setDrivers(d||[]); } };

const loadScript = (url) => new Promise((res,rej) => { if(document.querySelector(`script[src="${url}"]`)) return res(); const s=document.createElement("script"); s.src=url; s.onload=res; s.onerror=rej; document.head.appendChild(s); });

const generatePDF = async () => {
  setExpLd(true);
  try {
    const r = await sb.rpc("get_audit_report",{p_driver_id:expDriver||null,p_from:expFrom||null,p_to:expTo||null},tk);
    const report = typeof r==="string"?JSON.parse(r):r;
    const cls = report.checklists||[];
    if(!cls.length) { alert("Nenhum checklist encontrado no período."); setExpLd(false); return; }
    const drv = expDriver ? drivers.find(d=>d.id===expDriver)?.name : "Todos";
    const ansLabel = a => a==="ok"?"✅ OK":a==="problem"?"⚠️ Problema":"➖ N/A";
    const stLabel = s => s==="atendido"?"Atendido":s==="em_atendimento"?"Em Atendimento":s==="triagem"?"Triagem":"Processado";
    const fmtDt = iso => iso?new Date(iso).toLocaleDateString("pt-BR")+" "+new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—";
    let html = `<html><head><meta charset="utf-8"><title>AXON TIKET — Registros</title><style>
      *{margin:0;padding:0;box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#222;padding:20px;max-width:900px;margin:auto}
      h1{font-size:18px;color:#0099bb;margin-bottom:4px} .sub{font-size:10px;color:#666;margin-bottom:20px}
      .ck{border:1px solid #ccc;border-radius:8px;padding:14px;margin-bottom:16px;page-break-inside:avoid}
      .ck-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;border-bottom:2px solid #0099bb;padding-bottom:8px}
      .ck-head h2{font-size:14px;color:#0099bb;margin:0} .ck-head .meta{font-size:10px;color:#555;text-align:right}
      table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px} th{background:#e8f7fc;text-align:left;padding:5px 8px;border:1px solid #ccc;font-weight:700}
      td{padding:5px 8px;border:1px solid #ddd;vertical-align:top} .prob{background:#fff0f0} .ok{background:#f0fff0}
      .status-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:10px}
      .hist{margin:8px 0} .hist-item{padding:4px 0;border-bottom:1px solid #eee;font-size:10px}
      .eval-box{background:#f5f0ff;border:1px solid #c4b5fd;border-radius:6px;padding:8px 12px;margin:8px 0}
      .photo{width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #ccc;margin:4px 4px 0 0}
      @media print{body{padding:10px} .ck{break-inside:avoid}}
    </style></head><body>`;
    html += `<h1>AXON TIKET — Registros</h1>`;
    html += `<div class="sub">Motorista: <b>${drv}</b> • Período: <b>${expFrom?expFrom.split("-").reverse().join("/"):"—"} a ${expTo?expTo.split("-").reverse().join("/"):"—"}</b> • ${cls.length} checklist(s) • Gerado em ${fmtDt(new Date().toISOString())}</div>`;
    for (const c of cls) {
      const problems = (c.items||[]).filter(i=>i.answer==="problem");
      html += `<div class="ck"><div class="ck-head"><div><div style="font-size:10px;color:#666;font-family:monospace;margin-bottom:2px">Ticket #${c.ticket_number}</div><h2>${c.equip_prefix} — ${c.equip_plate}</h2><div style="font-size:11px;margin-top:2px">${c.form_name} • ${c.class_name}</div></div>`;
      html += `<div class="meta">Motorista: <b>${c.driver_name}</b><br>${fmtDt(c.submitted_at)}<br><span class="status-badge" style="background:${c.status==="atendido"?"#d1fae5;color:#065f46":c.status==="em_atendimento"?"#dbeafe;color:#1e40af":"#fef9c3;color:#854d0e"}">${stLabel(c.status)}</span></div></div>`;
      html += `<table><tr><th style="width:40%">Item</th><th style="width:12%">Resultado</th><th>Observação</th><th style="width:15%">Foto</th></tr>`;
      for (const it of (c.items||[])) {
        const cls2 = it.answer==="problem"?"prob":it.answer==="ok"?"ok":"";
        html += `<tr class="${cls2}"><td>${it.label}</td><td>${ansLabel(it.answer)}</td><td>${it.notes||"—"}</td>`;
        html += `<td>${it.photo_url?`<img class="photo" src="${it.photo_url}" />`:"—"}</td></tr>`;
      }
      html += `</table>`;
      if(problems.length) html += `<div style="font-size:10px;color:#dc2626;font-weight:700;margin:4px 0">⚠ ${problems.length} problema(s) identificado(s)</div>`;
      if((c.history||[]).length) {
        html += `<div class="hist"><div style="font-weight:700;font-size:10px;margin-bottom:4px">📋 Histórico de Movimentações</div>`;
        for (const h of c.history) html += `<div class="hist-item"><b>${fmtDt(h.created_at)}</b> — ${h.action} — <i>${h.performed_by_name}</i>${h.notes?` — "${h.notes}"`:""}</div>`;
        html += `</div>`;
      }
      if(c.conclusion_text) html += `<div style="margin:6px 0;padding:6px 10px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;font-size:10px"><b>✅ Conclusão (${c.gestor_name||"Gestor"}):</b> ${c.conclusion_text} — ${fmtDt(c.concluded_at)}</div>`;
      if(c.eval_status) html += `<div class="eval-box"><b>⭐ Avaliação do Motorista:</b> ${c.eval_rating}/10 — ${c.eval_status==="totalmente_atendido"?"Totalmente atendido":c.eval_status==="parcialmente"?"Parcialmente":"Não atendido"}${c.eval_notes?` — "${c.eval_notes}"`:""}</div>`;
      html += `</div>`;
    }
    html += `</body></html>`;
    const w = window.open("","_blank"); w.document.write(html); w.document.close();
  } catch(e) { alert("Erro: "+e.message); }
  setExpLd(false);
};

const generateExcel = async () => {
  setExpLd(true);
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    const XLSX = window.XLSX;
    const r = await sb.rpc("get_audit_report",{p_driver_id:expDriver||null,p_from:expFrom||null,p_to:expTo||null},tk);
    const report = typeof r==="string"?JSON.parse(r):r;
    const cls = report.checklists||[];
    if(!cls.length) { alert("Nenhum checklist encontrado."); setExpLd(false); return; }
    const wb = XLSX.utils.book_new();
    const ckRows = [["#","Equipamento","Placa","Classe","Formulário","Motorista","Data Envio","Status","Gestor","Data Conclusão","Conclusão","Problemas","Avaliação","Nota","Obs. Avaliação"],
      ...cls.map(c=>[c.ticket_number,c.equip_prefix,c.equip_plate,c.class_name,c.form_name,c.driver_name,
        c.submitted_at?new Date(c.submitted_at).toLocaleString("pt-BR"):"",c.status,c.gestor_name||"",
        c.concluded_at?new Date(c.concluded_at).toLocaleString("pt-BR"):"",c.conclusion_text||"",
        (c.items||[]).filter(i=>i.answer==="problem").length,
        c.eval_status==="totalmente_atendido"?"Totalmente":c.eval_status==="parcialmente"?"Parcialmente":c.eval_status==="nao_atendido"?"Não atendido":"",
        c.eval_rating!=null?c.eval_rating:"",c.eval_notes||""])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ckRows), "Checklists");
    const itemRows = [["#","Equipamento","Motorista","Data Envio","Item","Resultado","Observação","URL Foto"],
      ...cls.flatMap(c=>(c.items||[]).map(i=>[c.ticket_number,c.equip_prefix+" "+c.equip_plate,c.driver_name,
        c.submitted_at?new Date(c.submitted_at).toLocaleString("pt-BR"):"",
        i.label,i.answer==="ok"?"OK":i.answer==="problem"?"Problema":"N/A",i.notes||"",i.photo_url||""]))];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), "Respostas");
    const histRows = [["#","Equipamento","Data Checklist","Ação","De","Para","Responsável","Observação","Data"],
      ...cls.flatMap(c=>(c.history||[]).map(h=>[c.ticket_number,c.equip_prefix+" "+c.equip_plate,
        c.submitted_at?new Date(c.submitted_at).toLocaleString("pt-BR"):"",
        h.action,h.from_status||"",h.to_status||"",h.performed_by_name||"",h.notes||"",
        h.created_at?new Date(h.created_at).toLocaleString("pt-BR"):""]))];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(histRows), "Histórico");
    XLSX.writeFile(wb, `axon-tiket-dados-${expFrom||"all"}-${expTo||"all"}.xlsx`);
  } catch(e) { alert("Erro: "+e.message); }
  setExpLd(false);
};

return <>
{showExport && <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setShowExport(false)}>
<div className="card fi" style={{ maxWidth:420, width:"100%" }} onClick={e=>e.stopPropagation()}>
<div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}><h3 style={{ fontSize:16 }}>📥 Exportar Relatório</h3>
<button style={{ background:"none", border:"none", color:T.t2, cursor:"pointer", fontSize:18 }} onClick={()=>setShowExport(false)}>✕</button></div>
<div className="lbl">Motorista</div>
<select className="inp" style={{ marginBottom:10 }} value={expDriver} onChange={e=>setExpDriver(e.target.value)}>
<option value="">Todos os motoristas</option>{drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
<div style={{ display:"flex", gap:8, marginBottom:16 }}>
<div style={{ flex:1 }}><div className="lbl">De</div><input type="date" className="inp" value={expFrom} onChange={e=>setExpFrom(e.target.value)} /></div>
<div style={{ flex:1 }}><div className="lbl">Até</div><input type="date" className="inp" value={expTo} onChange={e=>setExpTo(e.target.value)} /></div></div>
{expLd ? <div style={{ textAlign:"center", padding:20 }}><div className="sp"/><div style={{ fontSize:11, color:T.t2, marginTop:8 }}>Gerando relatório...</div></div>
: <div style={{ display:"flex", gap:8 }}>
<button className="btn bp bw" style={{ flex:1 }} onClick={generatePDF}>📄 PDF</button>
<button className="btn bg bw" style={{ flex:1, border:`1px solid ${T.ac}`, color:T.ac }} onClick={generateExcel}>📊 Excel</button></div>}
</div></div>}
<div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:14 }}>
<h2 style={{ fontSize:20, margin:0 }}>Relatórios</h2>
<div style={{ display:"flex", gap:2, background:T.c2, padding:3, borderRadius:8 }}>
{[[7,"7d"],[30,"30d"],[90,"90d"],[9999,"Todos"]].map(([d,lb]) =>
<button key={d} onClick={()=>setDays(d)} style={{ padding:"5px 12px", border:"none", borderRadius:6, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'", background:days===d?T.ac:"transparent", color:days===d?T.bg:T.t2 }}>{lb}</button>)}
</div>
<button className="btn bg bs" style={{ fontSize:11, padding:"5px 14px", marginLeft:"auto", border:`1px solid ${T.ac}`, color:T.ac }} onClick={openExport}>📥 Exportar</button>
</div>
{/* KPIs Gerais */}
<div className="kpig">
<Kpi icon="📋" label="Checklists" value={k.total} color="#3b82f6" />
<Kpi icon="⚠️" label="Com Problemas" value={k.with_problems} color={T.r} sub={pct+"% do total"} />
<Kpi icon="⏱️" label="Tempo Total Médio" value={k.avg_hours+"h"} color={T.g} />
<Kpi icon="📦" label="Backlog Pendente" value={b.total_pendente||0} color={b.total_pendente>0?T.y:T.g} sub={b.triagem>0?b.triagem+" triagem":"tudo em andamento"} />
</div>
{/* SLA */}
<Section title="SLA — Tempos por Etapa">
<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10 }}>
{[["🔔","Reação Média",s.avg_reaction_hours+"h","#3b82f6","envio → 1ª ação"],
["🔔","Reação Pior Caso",s.max_reaction_hours+"h",s.max_reaction_hours>2?T.r:T.y,""],
["🔧","Atendimento Médio",s.avg_service_hours+"h","#3b82f6","em atend. → concluído"],
["🔧","Atendimento Pior Caso",s.max_service_hours+"h",s.max_service_hours>24?T.r:T.y,""]].map(([ic,lb,val,co,sub],i) =>
<div key={i} style={{ background:T.bg, border:`1px solid ${T.bd}`, borderRadius:8, padding:"8px 10px" }}>
<div style={{ fontSize:10, color:T.t3, textTransform:"uppercase", letterSpacing:.3, marginBottom:4 }}>{ic} {lb}</div>
<div style={{ fontSize:18, fontWeight:700, fontFamily:"'JetBrains Mono'", color:co }}>{val}</div>
{sub && <div style={{ fontSize:9, color:T.t3, marginTop:2 }}>{sub}</div>}
</div>)}
</div>
</Section>
{/* Por Gestor */}
{data.by_gestor?.length > 0 && <Section title="Desempenho por Gestor">
{data.by_gestor.map(g => <div key={g.name} style={{ marginBottom:10 }}>
<Bar label={g.name} value={g.total} max={maxGestor} color="#3b82f6" />
<div style={{ fontSize:10, color:T.t3, marginTop:-4, marginBottom:4 }}>Tempo de atendimento médio: <span style={{ color:T.y, fontFamily:"'JetBrains Mono'" }}>{g.avg_hours}h</span></div>
</div>)}
</Section>}
{/* Daily */}
{data.daily?.length > 0 && <Section title="Checklists por Dia">
{data.daily.map(d => <Bar key={d.day} label={new Date(d.day+"T12:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})} value={d.total} max={maxDaily} color="#3b82f6" />)}
</Section>}
{/* Top Problems */}
{data.top_problems?.length > 0 && <Section title="Itens com Mais Problemas">
{data.top_problems.map(t => <Bar key={t.label} label={t.label} value={t.count} max={maxProb} color={T.r} />)}
</Section>}
{/* By Equipment */}
{data.by_equipment?.length > 0 && <Section title="Por Equipamento">
{data.by_equipment.map(e => <Bar key={e.name} label={e.name+" ("+e.problems+" prob.)"} value={e.total} max={maxEquip} color="#3b82f6" />)}
</Section>}
{data.evaluation && <Section title="⭐ Avaliação do Atendimento">
<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:12 }}>
<Kpi icon="⭐" value={data.evaluation.avg_rating} label="NOTA MÉDIA" color={T.p} />
<Kpi icon="📝" value={data.evaluation.total_evaluated} label="AVALIADOS" color={T.g} />
<Kpi icon="⏳" value={data.evaluation.pending} label="PENDENTES" color={T.y} />
</div>
{(data.evaluation.totalmente>0||data.evaluation.parcialmente>0||data.evaluation.nao_atendido>0) && <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
{[["Totalmente",data.evaluation.totalmente,T.g],["Parcialmente",data.evaluation.parcialmente,T.y],["Não atendido",data.evaluation.nao_atendido,T.r]].map(([l,v,c])=>
v>0 && <span key={l} className="badge" style={{ background:c+"20", color:c, fontSize:11 }}>{l}: {v}</span>)}
</div>}
</Section>}
{data.recent_feedback?.length > 0 && <Section title="💬 Feedback dos Motoristas">
{data.recent_feedback.map((f,i) => {
const sc = f.status==="totalmente_atendido"?T.g:f.status==="parcialmente"?T.y:T.r;
const sl = f.status==="totalmente_atendido"?"Totalmente":f.status==="parcialmente"?"Parcialmente":"Não atendido";
return <div key={i} style={{ padding:"10px 0", borderBottom:i<data.recent_feedback.length-1?`1px solid ${T.bd}`:"none" }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
<div>
<span style={{ fontWeight:700, fontSize:13 }}>{f.driver}</span>
<span style={{ fontSize:11, color:T.t3, marginLeft:8, fontFamily:"'JetBrains Mono'" }}>Ticket #{f.ticket_number}</span>
<span style={{ fontSize:11, color:T.t3, marginLeft:4 }}>{f.equipment}</span>
{f.gestor && <span style={{ fontSize:10, color:T.t3, marginLeft:6 }}>→ {f.gestor}</span>}
</div>
<div style={{ display:"flex", alignItems:"center", gap:6 }}>
<span className="badge" style={{ background:sc+"20", color:sc, fontSize:9 }}>{sl}</span>
<span style={{ fontFamily:"'JetBrains Mono'", fontWeight:700, color:T.p, fontSize:13 }}>⭐{f.rating}</span>
</div></div>
{f.notes && <div style={{ fontSize:12, color:T.t2, marginTop:4, fontStyle:"italic", paddingLeft:4 }}>"{f.notes}"</div>}
<div style={{ fontSize:10, color:T.t3, marginTop:3 }}>Checklist de {new Date(f.submitted_at).toLocaleDateString("pt-BR")} • Avaliado em {new Date(f.eval_at).toLocaleDateString("pt-BR")} às {new Date(f.eval_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
</div>; })}
</Section>}
</>;
}
