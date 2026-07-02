import { useState, useEffect } from "react";
import { sb } from "./config.js";
import { T, PHR, PHC } from "./theme.js";

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

function UserMgr({ tk, msg, domain, tenant }) {
const [us,setUs]=useState([]); const [n,setN]=useState(""); const [eu,setEu]=useState(""); const [p,setP]=useState("");
const [editId,setEditId]=useState(null); const [eN,setEN]=useState(""); const [eE,setEE]=useState("");
const [showAll,setShowAll]=useState(false);
useEffect(()=>{loadU();},[showAll]);
const loadU = async () => setUs(await sb.q("profiles",tk,`role=eq.motorista${showAll?"":"&active=eq.true"}&select=*&order=name`));
const add = async () => { if(!n.trim()||!eu.trim()||!p.trim()) return msg("Preencha tudo","error");
const email = domain ? `${eu.trim()}@${domain}` : eu.trim();
if(us.filter(u=>u.active!==false).some(u=>u.name.toLowerCase()===n.trim().toLowerCase())) return msg("Já existe motorista com esse nome","error");
try{
  await sb.createUser(email,p.trim(),{name:n.trim(),role:"motorista",tenant_id:tenant?.id||null});
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

function GestorMgr({ tk, msg, domain, tenant }) {
const [gs,setGs]=useState([]); const [n,setN]=useState(""); const [eu,setEu]=useState(""); const [p,setP]=useState("");
const [editId,setEditId]=useState(null); const [eN,setEN]=useState(""); const [eE,setEE]=useState("");
const [showAll,setShowAll]=useState(false);
useEffect(()=>{loadG();},[showAll]);
const loadG = async () => setGs(await sb.q("profiles",tk,`role=eq.gestor${showAll?"":"&active=eq.true"}&select=*&order=name`));
const add = async () => { if(!n.trim()||!eu.trim()||!p.trim()) return msg("Preencha tudo","error");
const email = domain ? `${eu.trim()}@${domain}` : eu.trim();
if(gs.filter(g=>g.active!==false).some(g=>g.name.toLowerCase()===n.trim().toLowerCase())) return msg("Já existe gestor com esse nome","error");
try{
  await sb.createUser(email,p.trim(),{name:n.trim(),role:"gestor",tenant_id:tenant?.id||null});
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


export { ClassMgr, FormMgr, UserMgr, GestorMgr, EquipMgr };
