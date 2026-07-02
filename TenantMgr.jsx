import { useState, useEffect } from "react";
import { sb } from "./config.js";
import { T } from "./theme.js";

function slugify(text) {
return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

function TenantMgr({ tk, msg }) {
const [tenants, setTenants] = useState([]);
const [ld, setLd] = useState(true);
const [showForm, setShowForm] = useState(false);
const [editId, setEditId] = useState(null);
const [form, setForm] = useState({ name:"", slug:"", primary_color:"#1976d2", logo_url:"" });
const [saving, setSaving] = useState(false);

const load = async () => {
setLd(true);
try { const r = await sb.q("tenants", tk, "order=created_at.asc"); setTenants(r); }
catch(e) { msg(e.message, "error"); }
setLd(false);
};
useEffect(() => { load(); }, []);

const resetForm = () => { setForm({ name:"", slug:"", primary_color:"#1976d2", logo_url:"" }); setEditId(null); setShowForm(false); };

const startEdit = (t) => {
setForm({ name: t.name, slug: t.slug, primary_color: t.primary_color || "#1976d2", logo_url: t.logo_url || "" });
setEditId(t.id);
setShowForm(true);
};

const save = async () => {
if (!form.name.trim()) return msg("Nome obrigatório", "error");
const slug = form.slug.trim() || slugify(form.name);
if (slug.length < 3) return msg("Slug deve ter no mínimo 3 caracteres", "error");

setSaving(true);
try {
if (editId) {
  await sb.upd("tenants", { name: form.name.trim(), slug, primary_color: form.primary_color, logo_url: form.logo_url.trim() || null }, { id: editId }, tk);
  msg("Empresa atualizada");
} else {
  await sb.ins("tenants", { name: form.name.trim(), slug, primary_color: form.primary_color, logo_url: form.logo_url.trim() || null }, tk);
  msg("Empresa cadastrada");
}
resetForm();
await load();
} catch(e) {
const m = e.message;
msg(m.includes("duplicate") || m.includes("unique") ? "Já existe uma empresa com esse slug" : m, "error");
}
setSaving(false);
};

const toggleActive = async (t) => {
const action = t.active ? "desativar" : "reativar";
if (!window.confirm(`Deseja ${action} "${t.name}"?`)) return;
try {
  await sb.upd("tenants", { active: !t.active }, { id: t.id }, tk);
  msg(`Empresa ${t.active ? "desativada" : "reativada"}`);
  await load();
} catch(e) { msg(e.message, "error"); }
};

return <>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
<div style={{ fontWeight:600, fontSize:15 }}>Empresas (Tenants)</div>
{!showForm && <button className="btn bp" onClick={() => { resetForm(); setShowForm(true); }}>+ Nova Empresa</button>}
</div>

{showForm && <div className="card" style={{ marginBottom:16 }}>
<div style={{ fontWeight:600, marginBottom:12 }}>{editId ? "Editar Empresa" : "Nova Empresa"}</div>

<div style={{ marginBottom:12 }}>
<label className="lbl">Nome da empresa</label>
<input className="inp" placeholder="Ex: Transportadora Silva" value={form.name}
  onChange={e => { setForm(f => ({ ...f, name: e.target.value, slug: editId ? f.slug : slugify(e.target.value) })); }} />
</div>

<div style={{ marginBottom:12 }}>
<label className="lbl">Slug (usado na URL)</label>
<div style={{ display:"flex", alignItems:"center", gap:4 }}>
<span style={{ fontSize:11, color:T.t3, whiteSpace:"nowrap" }}>/t/</span>
<input className="inp" placeholder="transportadora-silva" value={form.slug}
  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} style={{ flex:1 }} />
</div>
<div style={{ fontSize:10, color:T.t3, marginTop:4 }}>URL: axon-tiket.vercel.app/t/{form.slug || "..."}</div>
</div>

<div style={{ marginBottom:12 }}>
<label className="lbl">Cor primária</label>
<div style={{ display:"flex", alignItems:"center", gap:8 }}>
<input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
  style={{ width:40, height:34, border:"none", borderRadius:6, cursor:"pointer", padding:0 }} />
<input className="inp" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
  style={{ flex:1, fontFamily:"'JetBrains Mono'", fontSize:12 }} />
<div style={{ width:24, height:24, borderRadius:6, background:form.primary_color, border:`1px solid ${T.bd}` }} />
</div>
</div>

<div style={{ marginBottom:16 }}>
<label className="lbl">URL do logo (opcional)</label>
<input className="inp" placeholder="https://exemplo.com/logo.png" value={form.logo_url}
  onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} />
{form.logo_url && <div style={{ marginTop:8, textAlign:"center" }}>
<img src={form.logo_url} alt="Preview" style={{ maxHeight:40, objectFit:"contain", borderRadius:4 }}
  onError={e => { e.target.style.display="none"; }} />
</div>}
</div>

<div style={{ display:"flex", gap:8 }}>
<button className="btn bp bw" onClick={save} disabled={saving} style={{ flex:1 }}>
{saving ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar empresa"}
</button>
<button className="btn bg bs" onClick={resetForm} style={{ color:T.t2 }}>Cancelar</button>
</div>
</div>}

{ld ? <div style={{ textAlign:"center", padding:20 }}><span className="sp" /></div>
: tenants.length === 0 ? <div className="card" style={{ textAlign:"center", color:T.t3, padding:20 }}>Nenhuma empresa cadastrada</div>
: tenants.map(t => <div key={t.id} className="card" style={{ marginBottom:8, display:"flex", alignItems:"center", gap:12, opacity: t.active ? 1 : 0.5 }}>
<div style={{ width:32, height:32, borderRadius:8, background:t.primary_color || T.ac, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:14, flexShrink:0 }}>
{t.name.charAt(0).toUpperCase()}
</div>
<div style={{ flex:1, minWidth:0 }}>
<div style={{ fontWeight:600, fontSize:14 }}>{t.name}{!t.active && <span className="badge" style={{ background:T.r+"20", color:T.r, marginLeft:8, fontSize:9 }}>Inativa</span>}</div>
<div style={{ fontSize:11, color:T.t3, fontFamily:"'JetBrains Mono'" }}>/t/{t.slug}</div>
</div>
<div style={{ display:"flex", gap:4, flexShrink:0 }}>
<button className="btn bg bs" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => startEdit(t)}>✏️</button>
<button className="btn bg bs" style={{ fontSize:11, padding:"4px 10px", color: t.active ? T.r : T.g }} onClick={() => toggleActive(t)}>
{t.active ? "🚫" : "✅"}
</button>
</div>
</div>)}
</>;
}

export default TenantMgr;
