import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";

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
if (!r.ok) { const e = await r.json(); throw new Error(e.error_description || e.msg || "Login falhou"); }
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
.ni{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;color:${T.t3};cursor:pointer;padding:4px 12px;border:none;background:none;font-family:'DM Sans'}
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

if (loading) return <Splash />;
if (!profile) return <Login msg={msg} />;

return <>
{toast && <div className="toast" style={{ background: toast.t === "error" ? T.r : T.g, color: "#fff" }}>{toast.m}</div>}
{profile.role === "gestor" ? <Gestor v={view} sv={setView} msg={msg} /> : <Motorista v={view} sv={setView} msg={msg} />}
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

const load = async () => {
try {
const [eq, cl, ch, ri] = await Promise.all([
sb.q("equipment", tk, "active=eq.true&select=*&order=prefix"),
sb.q("classes", tk, "active=eq.true&select=*&order=name"),
sb.q("v_driver_history", tk, `driver_id=eq.${profile.id}&order=submitted_at.desc&limit=20`),
sb.q("checklists", tk, `driver_id=eq.${profile.id}&reinspection_requested=eq.true&select=id,equipment_id,form_id,reinspection_notes`),
]);
setEqs(eq); setCls(cl); setHist(ch); setReinsps(ri||[]);
} catch (e) { msg("Erro: " + e.message, "error"); }
finally { setLd(false); }
};
useEffect(() => { load(); }, []);

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
<div style={{ fontSize:12, color:T.t2, marginTop:2 }}>{cl.equipment_prefix} — {cl.equipment_plate}</div>
<div style={{ fontSize:11, color:T.t3, marginTop:2 }}>{new Date(cl.submitted_at).toLocaleDateString("pt-BR")} às {new Date(cl.submitted_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div></div>
<div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
<span className="badge" style={{ background:col?.color+"20", color:col?.color }}>{col?.icon} {col?.label}</span>
<span style={{ fontSize:10, color:T.ac }}>ver detalhes →</span></div></div>
{cl.reinspection_requested && <div style={{ marginTop:8, fontSize:12, color:T.y }}>⚠ Re-inspeção: {cl.reinspection_notes}</div>}
{cl.conclusion_text && <div style={{ marginTop:8, fontSize:12, color:T.g }}>✓ {cl.conclusion_text}</div>}
</div>;
})}

{/* Modal detalhe do histórico */}
{selHist && <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setSelHist(null)}>
<div className="card fi" style={{ maxWidth:500, width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
<div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
<h3 style={{ fontSize:16 }}>Detalhes do Checklist</h3>
<button style={{ background:"none", border:"none", color:T.t2, cursor:"pointer", fontSize:18 }} onClick={()=>setSelHist(null)}>✕</button></div>
<div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.t2 }}>Equipamento</div>
<div style={{ fontWeight:700, fontFamily:"'JetBrains Mono'" }}>{selHist.equipment_prefix} — {selHist.equipment_plate}</div></div>
<div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.t2 }}>Formulário</div><div style={{ fontWeight:600 }}>{selHist.form_name}</div></div>
<div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.t2 }}>Enviado em</div>
<div>{new Date(selHist.submitted_at).toLocaleDateString("pt-BR")} às {new Date(selHist.submitted_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div></div>
{selHist.conclusion_text && <div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.t2 }}>Conclusão</div><div style={{ color:T.g }}>✓ {selHist.conclusion_text}</div></div>}
{selHist.reinspection_requested && <div style={{ marginBottom:8, color:T.y }}>⚠ Re-inspeção solicitada: {selHist.reinspection_notes}</div>}
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
</>}
</div>
<nav className="nav">
<button className={`ni ${v==="home"?"on":""}`} onClick={() => sv("home")}>🚛 <span>Equipamentos</span></button>
<button className={`ni ${v==="m_hist"?"on":""}`} onClick={() => { sv("m_hist"); load(); }}>🕐 <span>Histórico</span></button>
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
const [kSearch, setKSearch] = useState("");
const [expandCol, setExpandCol] = useState({});
const MAX_VIS = 6;

const relDt = (iso) => { const d=new Date(iso), now=new Date(), df=Math.floor((now-d)/864e5); return df===0?"Hoje":df===1?"Ontem":df<7?df+"d":d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}); };
const fmtTm = (iso) => new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});

const kanFiltered = useMemo(() => {
const now = new Date();
return kan.filter(c => {
if (c.reinspection_requested) return false;
const df = Math.floor((now - new Date(c.submitted_at)) / 864e5);
if (period==="today"&&df>0) return false;
if (period==="7d"&&df>7) return false;
if (period==="30d"&&df>30) return false;
if (filtEq && c.equipment_prefix!==filtEq) return false;
if (filtDr && c.driver_name!==filtDr) return false;
if (filtUr==="problem" && c.problem_count===0) return false;
if (filtUr==="ok" && c.problem_count>0) return false;
if (kSearch) { const s=kSearch.toLowerCase(); if(!`${c.equipment_prefix} ${c.equipment_plate} ${c.driver_name} ${c.form_name}`.toLowerCase().includes(s)) return false; }
return true;
});
}, [kan, period, filtEq, filtDr, filtUr, kSearch]);

const kpis = useMemo(() => {
const t=kanFiltered.filter(c=>c.status==="triagem").length;
const ea=kanFiltered.filter(c=>c.status==="em_atendimento").length;
const tProb=kanFiltered.filter(c=>c.status==="triagem"&&c.problem_count>0).length;
return { triagem:t, emAtendimento:ea, triagemProblema:tProb, atendidos:kanFiltered.filter(c=>c.status==="atendido").length };
}, [kanFiltered]);

const hasKFilter = filtEq||filtDr||filtUr||kSearch;
const clearKFilters = () => { setFiltEq("");setFiltDr("");setFiltUr("");setKSearch(""); };

const load = async () => {
try {
const [k, c] = await Promise.all([
sb.q("v_kanban", tk, "order=submitted_at.desc"),
sb.q("classes", tk, "active=eq.true&select=*&order=name"),
]);
setKan(k); setCls(c);
} catch (e) { msg("Erro: " + e.message, "error"); }
finally { setLd(false); }
};
useEffect(() => { load(); }, []);

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
<span className="badge" style={{ background:T.ac+"20", color:T.ac }}>Gestor</span>
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
<input placeholder="🔍 Buscar..." value={kSearch} onChange={e=>setKSearch(e.target.value)}
className="inp finp" style={{ padding:"7px 12px", fontSize:12, width:200, minWidth:160 }} />
<select className="inp finp" style={{ width:"auto", padding:"7px 10px", fontSize:11, minWidth:120 }} value={filtEq} onChange={e=>setFiltEq(e.target.value)}>
<option value="">Equipamento</option>{[...new Set(kan.map(c=>c.equipment_prefix))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
<select className="inp finp" style={{ width:"auto", padding:"7px 10px", fontSize:11, minWidth:120 }} value={filtDr} onChange={e=>setFiltDr(e.target.value)}>
<option value="">Motorista</option>{[...new Set(kan.map(c=>c.driver_name))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
<select className="inp finp" style={{ width:"auto", padding:"7px 10px", fontSize:11, minWidth:120 }} value={filtUr} onChange={e=>setFiltUr(e.target.value)}>
<option value="">Urgência</option><option value="problem">⚠ Com problemas</option><option value="ok">✓ Sem problemas</option></select>
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
<span style={{ fontWeight:700, fontSize:12, fontFamily:"'JetBrains Mono'" }}>{cl.equipment_prefix} <span style={{ color:T.t3, fontWeight:400, fontSize:10 }}>— {cl.equipment_plate}</span></span>
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
{[["classes","Classes"],["forms","Formulários"],["users","Motoristas"],["equip","Equipamentos"]].map(([k,l]) =>
<button key={k} className={`tab ${mt===k?"on":""}`} onClick={() => setMt(k)}>{l}</button>)}
</div>
{mt === "classes" && <ClassMgr tk={tk} cls={cls} reload={load} msg={msg} />}
{mt === "forms" && <FormMgr tk={tk} cls={cls} reload={load} msg={msg} pid={profile.id} />}
{mt === "users" && <UserMgr tk={tk} msg={msg} />}
{mt === "equip" && <EquipMgr tk={tk} cls={cls} reload={load} msg={msg} />}
</>}
{v === "g_pw" && <PwChange msg={msg} />}
</>}
</div>

{selCard && <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={closeCard}>
<div className="card fi" style={{ maxWidth:500, width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
<div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
<h3 style={{ fontSize:16 }}>Detalhes do Checklist</h3>
<button style={{ background:"none", border:"none", color:T.t2, cursor:"pointer", fontSize:18 }} onClick={closeCard}>✕</button></div>

<div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:T.t2 }}>Equipamento</div>
<div style={{ fontWeight:700, fontFamily:"'JetBrains Mono'" }}>{selCard.equipment_prefix} — {selCard.equipment_plate}</div></div>
<div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:T.t2 }}>Motorista</div><div style={{ fontWeight:600 }}>{selCard.driver_name}</div></div>
<div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:T.t2 }}>Formulário</div><div>{selCard.form_name}</div></div>
<div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:T.t2 }}>Itens</div><div>{selCard.total_items} total — <span style={{ color:T.r }}>{selCard.problem_count} com problema</span></div></div>

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
<button className={`ni ${v==="home"?"on":""}`} onClick={() => { sv("home"); load(); }}>📋 <span>Kanban</span></button>
<button className={`ni ${v==="g_mgmt"?"on":""}`} onClick={() => { sv("g_mgmt"); load(); }}>⚙️ <span>Gerenciar</span></button>
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

function UserMgr({ tk, msg }) {
const [us,setUs]=useState([]); const [n,setN]=useState(""); const [e,setE]=useState(""); const [p,setP]=useState("");
useEffect(()=>{loadU();},[]);
const loadU = async () => setUs(await sb.q("profiles",tk,"role=eq.motorista&active=eq.true&select=*&order=name"));
// FIX #4: createUser sem tk, usa /auth/v1/signup internamente
const add = async () => { if(!n.trim()||!e.trim()||!p.trim()) return msg("Preencha tudo","error");
try{
  await sb.createUser(e.trim(),p.trim(),{name:n.trim(),role:"motorista"});
  setN("");setE("");setP("");
  msg("Motorista cadastrado! Perfil atualizado automaticamente.");
  setTimeout(() => loadU(), 1500); // aguarda trigger do Supabase
}catch(err){msg(err.message,"error");} };
return <><div className="card" style={{ marginBottom:20 }}>
<div style={{ fontWeight:600, marginBottom:12 }}>Cadastrar Motorista</div>
<div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
<input className="inp" placeholder="Nome" style={{ flex:1, minWidth:140 }} value={n} onChange={x=>setN(x.target.value)} />
<input className="inp" placeholder="E-mail" style={{ flex:1, minWidth:140 }} value={e} onChange={x=>setE(x.target.value)} />
<input className="inp" type="password" placeholder="Senha" style={{ flex:1, minWidth:110 }} value={p} onChange={x=>setP(x.target.value)} />
<button className="btn bp" onClick={add}>+</button></div></div>
<div style={{ display:"grid", gap:8 }}>{us.map(u => <div key={u.id} className="card" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<div><div style={{ fontWeight:600 }}>{u.name}</div><div style={{ fontSize:12, color:T.t2 }}>{u.email}</div></div>
<div style={{ display:"flex", gap:4 }}>
<button className="btn bg bs" onClick={async()=>{const pw=window.prompt(`Nova senha para ${u.name} (mín. 6 caracteres):`);if(!pw) return;try{await sb.rpc("reset_user_password",{target_user_id:u.id,new_password:pw},tk);msg("Senha resetada!");}catch(err){msg(err.message,"error");}}}>🔑</button>
<button className="btn bg bs" style={{ color:T.r }} onClick={async()=>{if(!window.confirm(`Desativar motorista "${u.name}"?`))return;try{await sb.upd("profiles",{active:false},{id:u.id},tk);msg("Motorista desativado");loadU();}catch(err){msg(err.message,"error");}}}>🗑</button></div>
</div>)}</div></>;
}

function EquipMgr({ tk, cls, reload, msg }) {
const [eqs,setEqs]=useState([]); const [px,setPx]=useState(""); const [pl,setPl]=useState(""); const [ci,setCi]=useState("");
const [editId,setEditId]=useState(null); const [ePx,setEPx]=useState(""); const [ePl,setEPl]=useState(""); const [eCi,setECi]=useState("");
useEffect(()=>{loadE();},[]);
const loadE = async () => setEqs(await sb.q("equipment",tk,"active=eq.true&select=*&order=prefix"));
const add = async () => { if(!px.trim()||!pl.trim()||!ci) return msg("Preencha tudo","error");
try{await sb.ins("equipment",{prefix:px.trim(),plate:pl.trim().toUpperCase(),class_id:ci},tk); setPx("");setPl("");setCi(""); msg("Equipamento cadastrado!"); loadE(); reload();}catch(e){msg(e.message,"error");} };
const save = async (id) => { if(!ePx.trim()||!ePl.trim()||!eCi) return; try{await sb.upd("equipment",{prefix:ePx.trim(),plate:ePl.trim().toUpperCase(),class_id:eCi},{id},tk); setEditId(null); msg("Equipamento atualizado"); loadE(); reload();}catch(e){msg(e.message,"error");} };
const del = async (eq) => { if(!window.confirm(`Desativar "${eq.prefix} — ${eq.plate}"?`)) return; try{await sb.upd("equipment",{active:false},{id:eq.id},tk); msg("Equipamento removido"); loadE(); reload();}catch(e){msg(e.message,"error");} };
return <><div className="card" style={{ marginBottom:20 }}>
<div style={{ fontWeight:600, marginBottom:12 }}>Cadastrar Equipamento</div>
<div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
<input className="inp" placeholder="Prefixo (ex: CM-001)" style={{ flex:1, minWidth:120 }} value={px} onChange={e=>setPx(e.target.value)} />
<input className="inp" placeholder="Placa (ex: ABC1D23)" style={{ flex:1, minWidth:120 }} value={pl} onChange={e=>setPl(e.target.value)} />
<select className="inp" style={{ flex:1, minWidth:140 }} value={ci} onChange={e=>setCi(e.target.value)}>
<option value="">Classe...</option>{cls.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
<button className="btn bp" onClick={add}>+</button></div></div>
<div style={{ display:"grid", gap:8 }}>{eqs.map(eq => { const c=cls.find(x=>x.id===eq.class_id);
return <div key={eq.id} className="card" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
{editId===eq.id ? <div style={{ display:"flex", gap:6, flex:1, flexWrap:"wrap", alignItems:"center" }}>
<input className="inp" style={{ flex:1, minWidth:100 }} value={ePx} onChange={e=>setEPx(e.target.value)} />
<input className="inp" style={{ flex:1, minWidth:100 }} value={ePl} onChange={e=>setEPl(e.target.value)} />
<select className="inp" style={{ flex:1, minWidth:120 }} value={eCi} onChange={e=>setECi(e.target.value)}>{cls.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
<button className="btn bp bs" onClick={()=>save(eq.id)}>✓</button>
<button className="btn bg bs" onClick={()=>setEditId(null)}>✕</button></div>
: <><div><div style={{ fontWeight:700, fontFamily:"'JetBrains Mono'" }}>{eq.prefix} — {eq.plate}</div><div style={{ fontSize:12, color:T.t2 }}>{c?.name}</div></div>
<div style={{ display:"flex", gap:4 }}>
<button className="btn bg bs" onClick={()=>{setEditId(eq.id);setEPx(eq.prefix);setEPl(eq.plate);setECi(eq.class_id);}}>✎</button>
<button className="btn bg bs" style={{ color:T.r }} onClick={()=>del(eq)}>🗑</button></div></>}
</div>;
})}</div></>;
}

function PwChange({ msg }) {
const { tk, profile } = useAuth();
const [np,setNp]=useState(""); const [cp,setCp]=useState(""); const [ld,setLd]=useState(false);
const go = async () => { if(np.length<6) return msg("Mín. 6 caracteres","error"); if(np!==cp) return msg("Senhas não conferem","error");
setLd(true); try{await sb.updatePassword(tk,np); msg("Senha alterada!"); setNp("");setCp("");}catch(e){msg(e.message,"error");}finally{setLd(false);} };
return <><h2 style={{ fontSize:20, marginBottom:20 }}>Meu Perfil</h2>
<div className="card" style={{ marginBottom:16 }}>
<div style={{ fontSize:12, color:T.t2 }}>Nome</div><div style={{ fontWeight:600, fontSize:18 }}>{profile.name}</div>
<div style={{ fontSize:12, color:T.t2, marginTop:8 }}>E-mail</div><div>{profile.email}</div>
<div style={{ fontSize:12, color:T.t2, marginTop:8 }}>Perfil</div>
<span className="badge" style={{ background:T.ac+"20", color:T.ac, marginTop:4 }}>{profile.role==="gestor"?"Gestor de Manutenção":"Motorista"}</span></div>
<div className="card">
<div style={{ fontWeight:600, marginBottom:12 }}>Alterar Senha</div>
<div style={{ marginBottom:10 }}><input className="inp" type="password" placeholder="Nova senha (mín. 6)" value={np} onChange={e=>setNp(e.target.value)} /></div>
<div style={{ marginBottom:16 }}><input className="inp" type="password" placeholder="Confirmar" value={cp} onChange={e=>setCp(e.target.value)} /></div>
<button className="btn bp" onClick={go} disabled={ld}>{ld?"Salvando...":"Alterar Senha"}</button></div></>;
}
