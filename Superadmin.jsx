import { useState, useEffect } from "react";
import { sb } from "./config.js";
import { T } from "./theme.js";

function Superadmin({ tk, msg, onEnter, onLogout }) {
const [data, setData] = useState(null);
const [ld, setLd] = useState(true);
const [showNew, setShowNew] = useState(false);
const [nf, setNf] = useState({ name:"", slug:"", primary_color:"#1976d2" });
const [saving, setSaving] = useState(false);
const [adminFor, setAdminFor] = useState(null);
const [af, setAf] = useState({ name:"", email:"", password:"" });
const [adminSaving, setAdminSaving] = useState(false);

const load = async () => {
setLd(true);
try { const r = await sb.rpc("get_superadmin_panel", {}, tk); setData(r); }
catch(e) { msg(e.message, "error"); }
setLd(false);
};
useEffect(() => { load(); }, []);

const slugify = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

const createTenant = async () => {
if (!nf.name.trim()) return msg("Nome obrigatório", "error");
const slug = nf.slug.trim() || slugify(nf.name);
setSaving(true);
try {
  await sb.ins("tenants", { name: nf.name.trim(), slug, primary_color: nf.primary_color }, tk);
  msg("Empresa criada"); setShowNew(false); setNf({ name:"", slug:"", primary_color:"#1976d2" }); load();
} catch(e) { msg(e.message.includes("duplicate") ? "Slug já existe" : e.message, "error"); }
setSaving(false);
};

const createAdmin = async (tenantId) => {
if (!af.name.trim() || !af.email.trim() || !af.password.trim()) return msg("Preencha todos os campos", "error");
if (af.password.length < 6) return msg("Senha mínima: 6 caracteres", "error");
setAdminSaving(true);
try {
  await sb.createUser(af.email.trim(), af.password.trim(), { name: af.name.trim(), role: "admin", tenant_id: tenantId });
  msg("Admin criado!"); setAdminFor(null); setAf({ name:"", email:"", password:"" }); setTimeout(load, 1500);
} catch(e) { msg(e.message, "error"); }
setAdminSaving(false);
};

const toggleActive = async (t) => {
if (!window.confirm(`${t.active ? "Desativar" : "Reativar"} "${t.name}"?`)) return;
try { await sb.upd("tenants", { active: !t.active }, { id: t.id }, tk); msg(t.active ? "Desativada" : "Reativada"); load(); }
catch(e) { msg(e.message, "error"); }
};

const enterTenant = async (t) => {
try {
  await sb.rpc("set_superadmin_tenant", { p_tenant_id: t.id }, tk);
  onEnter({ id: t.id, name: t.name, slug: t.slug, logo_url: t.logo_url, primary_color: t.primary_color });
} catch(e) { msg(e.message, "error"); }
};

const tenants = data?.tenants || [];
const totalEmpresas = tenants.length;
const totalAtivas = tenants.filter(t => t.active).length;
const totalUsers = tenants.reduce((s, t) => s + (t.admins||0) + (t.gestores||0) + (t.motoristas||0), 0);
const totalChecklists = tenants.reduce((s, t) => s + (t.checklists_total||0), 0);

return <div style={{ minHeight:"100vh", background:T.bg, color:T.tx, fontFamily:"'DM Sans'" }}>
<div className="topbar">
<div className="logo">AXON TIKET</div>
<div style={{ display:"flex", alignItems:"center", gap:12 }}>
<span className="badge" style={{ background:"#f59e0b20", color:"#f59e0b" }}>DONO</span>
<button className="btn bg bs" onClick={onLogout}>Sair</button>
</div>
</div>

<div className="pg fi">
<h2 style={{ fontSize:22, marginBottom:4 }}>Painel do Dono</h2>
<div style={{ color:T.t3, fontSize:13, marginBottom:20 }}>Gerencie todas as empresas do sistema</div>

{ld ? <div style={{ textAlign:"center", padding:40 }}><div className="sp" /></div> : <>

<div className="kpig" style={{ marginBottom:20 }}>
{[["🏢", "Empresas", totalEmpresas, T.ac],["✅", "Ativas", totalAtivas, T.g],["👥", "Usuários", totalUsers, "#3b82f6"],["📋", "Checklists", totalChecklists, T.y]].map(([ic,lb,val,co],i) =>
<div key={i} style={{ background:T.c1, border:`1px solid ${T.bd}`, borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
<span style={{ fontSize:20 }}>{ic}</span>
<div><div style={{ fontSize:20, fontWeight:700, fontFamily:"'JetBrains Mono'", color:co }}>{val}</div>
<div style={{ fontSize:9, color:T.t2, textTransform:"uppercase", letterSpacing:.3 }}>{lb}</div></div></div>)}
</div>

<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
<div style={{ fontWeight:600, fontSize:15 }}>Empresas cadastradas</div>
<button className="btn bp" onClick={() => setShowNew(!showNew)}>{showNew ? "✕ Cancelar" : "+ Nova Empresa"}</button>
</div>

{showNew && <div className="card" style={{ marginBottom:16 }}>
<div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
<div style={{ flex:2, minWidth:180 }}>
<label className="lbl">Nome</label>
<input className="inp" placeholder="Ex: Transportadora Silva" value={nf.name} onChange={e => setNf(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))} />
</div>
<div style={{ flex:1, minWidth:120 }}>
<label className="lbl">Slug</label>
<input className="inp" value={nf.slug} onChange={e => setNf(f => ({ ...f, slug: slugify(e.target.value) }))} />
</div>
<div style={{ width:50 }}>
<label className="lbl">Cor</label>
<input type="color" value={nf.primary_color} onChange={e => setNf(f => ({ ...f, primary_color: e.target.value }))} style={{ width:40, height:34, border:"none", borderRadius:6, cursor:"pointer", padding:0 }} />
</div>
<button className="btn bp" onClick={createTenant} disabled={saving}>{saving ? "..." : "Criar"}</button>
</div>
</div>}

{tenants.map(t => <div key={t.id} className="card" style={{ marginBottom:10, opacity: t.active ? 1 : 0.5 }}>
<div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
<div style={{ width:40, height:40, borderRadius:10, background:t.primary_color || T.ac, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:18, flexShrink:0 }}>
{t.name.charAt(0).toUpperCase()}
</div>
<div style={{ flex:1, minWidth:160 }}>
<div style={{ fontWeight:700, fontSize:15 }}>{t.name}
{!t.active && <span className="badge" style={{ background:T.r+"20", color:T.r, marginLeft:8, fontSize:9 }}>Inativa</span>}
</div>
<div style={{ fontSize:11, color:T.t3, fontFamily:"'JetBrains Mono'" }}>/t/{t.slug}</div>
</div>
<div style={{ display:"flex", gap:12, fontSize:11, color:T.t2, flexWrap:"wrap" }}>
<span>👤 {t.admins||0} adm</span>
<span>🔧 {t.gestores||0} gest</span>
<span>🚛 {t.motoristas||0} mot</span>
<span>📋 {t.checklists_total||0} chk</span>
<span style={{ color:T.ac }}>📊 {t.checklists_7d||0} /7d</span>
</div>
<div style={{ display:"flex", gap:4, flexShrink:0 }}>
{t.active && <button className="btn bp" style={{ fontSize:11, padding:"6px 14px" }} onClick={() => enterTenant(t)}>Entrar</button>}
{t.active && <button className="btn bg bs" style={{ fontSize:11, padding:"6px 10px" }} onClick={() => { setAdminFor(adminFor===t.id?null:t.id); setAf({ name:"", email:"", password:"" }); }}>+Admin</button>}
<button className="btn bg bs" style={{ fontSize:11, padding:"6px 10px", color: t.active ? T.r : T.g }} onClick={() => toggleActive(t)}>
{t.active ? "🚫" : "✅"}
</button>
</div>
</div>

{adminFor === t.id && <div style={{ marginTop:12, padding:"12px 14px", background:T.c2, borderRadius:8 }}>
<div style={{ fontWeight:600, fontSize:12, marginBottom:8 }}>Criar Admin para {t.name}</div>
<div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
<input className="inp" placeholder="Nome" style={{ flex:1, minWidth:120 }} value={af.name} onChange={e => setAf(f => ({ ...f, name: e.target.value }))} />
<input className="inp" placeholder="email@empresa.com" style={{ flex:1, minWidth:160 }} value={af.email} onChange={e => setAf(f => ({ ...f, email: e.target.value }))} />
<input className="inp" type="password" placeholder="Senha (mín 6)" style={{ flex:1, minWidth:100 }} value={af.password} onChange={e => setAf(f => ({ ...f, password: e.target.value }))} />
<button className="btn bp" onClick={() => createAdmin(t.id)} disabled={adminSaving}>{adminSaving ? "..." : "Criar"}</button>
</div>
</div>}
</div>)}
</>}
</div>
</div>;
}

export default Superadmin;
