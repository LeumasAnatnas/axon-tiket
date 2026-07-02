import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "./auth.jsx";
import { sb, SB_URL, erroMsg } from "./config.js";
import { T, KAN } from "./theme.js";
import { ClassMgr, FormMgr, UserMgr, GestorMgr, EquipMgr } from "./Managers.jsx";
import ConfigMgr from "./ConfigMgr.jsx";
import TenantMgr from "./TenantMgr.jsx";
import Dashboard from "./Dashboard.jsx";
import PwChange from "./PwChange.jsx";

function Gestor({ v, sv, msg, tenant }) {
const { profile, tk, logout } = useAuth();
const [kan, setKan] = useState([]);
const [cls, setCls] = useState([]);
const [ld, setLd] = useState(true);
const [mt, setMt] = useState("classes");
const [selCard, setSelCard] = useState(null);
const [viewers, setViewers] = useState({});
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
try { await sb.rpc("cleanup_stale_viewers",{},tk); } catch{}
try {
const vw = await sb.q("card_viewers",tk,"select=checklist_id,viewer_id,viewer_name");
const vmap = {};
vw.forEach(v => { if(!vmap[v.checklist_id]) vmap[v.checklist_id]=[]; if(v.viewer_id!==profile.id) vmap[v.checklist_id].push(v.viewer_name); });
setViewers(vmap);
} catch{}
} catch (e) { msg(erroMsg(e), "error"); }
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
}
setKan(fresh);
lastKanLen.current = fresh.length;
try {
await sb.rpc("cleanup_stale_viewers",{},tk);
const vw = await sb.q("card_viewers",tk,"select=checklist_id,viewer_id,viewer_name");
const vmap = {};
vw.forEach(v => { if(!vmap[v.checklist_id]) vmap[v.checklist_id]=[]; if(v.viewer_id!==profile.id) vmap[v.checklist_id].push(v.viewer_name); });
setViewers(vmap);
} catch{}
} catch(e){} };
lastKanLen.current = kan.length;
const id = setInterval(poll, 15000);
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

const registerViewer = async (cid) => {
try { await sb.ins("card_viewers",{checklist_id:cid,viewer_id:profile.id,viewer_name:profile.name,viewed_at:new Date().toISOString()},tk).catch(async()=>{
await sb.upd("card_viewers",{viewed_at:new Date().toISOString()},{checklist_id:cid,viewer_id:profile.id},tk);
}); } catch{}
};
const removeViewer = async (cid) => {
try { await fetch(`${SB_URL}/rest/v1/card_viewers?checklist_id=eq.${cid}&viewer_id=eq.${profile.id}`,{method:"DELETE",headers:sb.h(tk)}); } catch{}
};
const closeCard = () => { if(selCard) removeViewer(selCard.id); setSelCard(null); setMoveTo(null); setConcl(""); setCardHistory([]); setCardResps([]); setReinspNotes(""); setShowReinsp(false); };
const [reinspNotes, setReinspNotes] = useState("");
const [showReinsp, setShowReinsp] = useState(false);
useEffect(() => {
if(!selCard) return;
registerViewer(selCard.id);
const hb = setInterval(() => registerViewer(selCard.id), 25000);
return () => { clearInterval(hb); removeViewer(selCard.id); };
}, [selCard?.id]);

const requestReinsp = async (id) => {
if (!reinspNotes.trim()) return msg("Informe o motivo da re-inspeção", "error");
try {
await sb.rpc("request_reinspection", { p_checklist_id: id, p_performed_by: profile.id, p_performed_by_name: profile.name, p_notes: reinspNotes.trim(), p_expected_status: selCard.status }, tk);
msg("Re-inspeção solicitada!"); closeCard(); load();
} catch (e) { msg(erroMsg(e), "error"); }
};

const move = async (id, status) => {
if (status === "atendido" && !concl.trim()) return msg("Justificativa obrigatória", "error");
try {
await sb.rpc("move_checklist", { p_checklist_id: id, p_new_status: status, p_performed_by: profile.id, p_performed_by_name: profile.name, p_conclusion_text: status === "atendido" ? concl : null, p_expected_status: selCard.status }, tk);
msg(`Movido para ${KAN.find(k => k.id === status)?.label}`);
closeCard(); load();
} catch (e) { msg(erroMsg(e), "error"); }
};

// Helper: formata data/hora pt-BR compacto
const fmtDt = (iso) => new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });

return <>
<div className="topbar"><div className="logo">{tenant?.name || "AXON TIKET"}</div>
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
{viewers[cl.id]?.length > 0 && <div style={{ fontSize:9, color:T.y, marginBottom:4, display:"flex", alignItems:"center", gap:4 }}>👁 {viewers[cl.id].join(", ")}</div>}
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
{[[profile.role==="admin"&&"gestors","Gestores"],["classes","Classes"],["forms","Formulários"],["users","Motoristas"],["equip","Equipamentos"],[profile.role==="admin"&&"tenants","🏢 Empresas"],[profile.role==="admin"&&"config","⚙ Config"]].filter(([k])=>k).map(([k,l]) =>
<button key={k} className={`tab ${mt===k?"on":""}`} onClick={() => setMt(k)}>{l}</button>)}
</div>
{mt === "gestors" && profile.role==="admin" && <GestorMgr tk={tk} msg={msg} domain={emailDomain} tenant={tenant} />}
{mt === "classes" && <ClassMgr tk={tk} cls={cls} reload={load} msg={msg} />}
{mt === "forms" && <FormMgr tk={tk} cls={cls} reload={load} msg={msg} pid={profile.id} />}
{mt === "users" && <UserMgr tk={tk} msg={msg} domain={emailDomain} tenant={tenant} />}
{mt === "equip" && <EquipMgr tk={tk} cls={cls} reload={load} msg={msg} />}
{mt === "tenants" && profile.role==="admin" && <TenantMgr tk={tk} msg={msg} />}
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
{viewers[selCard.id]?.length > 0 && <div style={{ fontSize:10, color:T.y, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>👁 {viewers[selCard.id].join(", ")} verificando</div>}
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


export default Gestor;
