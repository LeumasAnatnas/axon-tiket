import { useState, useEffect } from "react";
import { useAuth } from "./auth.jsx";
import { sb, erroMsg } from "./config.js";
import { T, KAN, PHR, PHC } from "./theme.js";
import PwChange from "./PwChange.jsx";
import DriverDashboard from "./DriverDash.jsx";
import { cacheGet, cacheSet, queueAdd, queueGetAll, queueRemove, queueCount, fileToBase64, base64ToBlob } from "./offlineStore.js";

function Motorista({ v, sv, msg, isOnline = true }) {
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
const [pendingSync, setPendingSync] = useState(0);
const [syncing, setSyncing] = useState(false);
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

const cachedFetch = async (key, fetcher) => {
try {
const data = await fetcher();
cacheSet(key, data).catch(() => {});
return data;
} catch (e) {
const cached = await cacheGet(key);
if (cached) return cached;
throw e;
}
};
const load = async () => {
try {
const pid = profile.id;
const [eq, cl, ch, ri, pe] = await Promise.all([
cachedFetch("m_equipment", () => sb.q("equipment", tk, "active=eq.true&select=*&order=prefix")),
cachedFetch("m_classes", () => sb.q("classes", tk, "active=eq.true&select=*&order=name")),
cachedFetch(`m_history_${pid}`, () => sb.q("v_driver_history", tk, `driver_id=eq.${pid}&order=submitted_at.desc&limit=20`)),
cachedFetch(`m_reinsps_${pid}`, () => sb.q("checklists", tk, `driver_id=eq.${pid}&reinspection_requested=eq.true&status=neq.atendido&select=id,equipment_id,form_id,reinspection_notes`)),
cachedFetch(`m_evals_${pid}`, () => sb.q("v_driver_history", tk, `driver_id=eq.${pid}&status=eq.atendido&eval_status=is.null&order=submitted_at.desc`)),
]);
setEqs(eq); setCls(cl); setHist(ch); setReinsps(ri||[]);
setPendingEvals((pe||[]).filter(c => c.problem_count > 0 && !c.reinspection_requested));
} catch (e) { msg(erroMsg(e), "error"); }
finally { setLd(false); }
};
useEffect(() => { load(); queueCount().then(n => setPendingSync(n)); }, []);

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
const f = await cachedFetch(`m_forms_${eq.class_id}`, () => sb.q("forms", tk, `class_id=eq.${eq.class_id}&active=eq.true&select=*`));
setForms(f);
if (f.length === 1) pickForm(f[0]);
else if (f.length === 0) msg("Nenhum formulário para esta classe", "error");
else sv("m_pickf");
} catch (e) { msg(erroMsg(e), "error"); }
};

const pickForm = async (f) => {
setSelForm(f);
try {
const it = await cachedFetch(`m_items_${f.id}`, () => sb.q("form_items", tk, `form_id=eq.${f.id}&active=eq.true&select=*&order=sort_order`));
setItems(it); setResp({}); setPhotos({}); setNotes({}); sv("m_fill");
} catch (e) { msg(erroMsg(e), "error"); }
};

const setR = (id, val) => setResp(p => ({ ...p, [id]: val }));
const setPhoto = (id, file) => setPhotos(p => ({ ...p, [id]: file }));
const setNote = (id, txt) => setNotes(p => ({ ...p, [id]: txt }));
const canSend = () => items.length > 0 && items.every(i => resp[i.id]) && items.filter(i => i.photo_rule === "mandatory").every(i => photos[i.id]);

const sendOnline = async () => {
const [ck] = await sb.ins("checklists", { form_id: selForm.id, equipment_id: selEq.id, driver_id: profile.id, status: "triagem" }, tk);
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
const oldRi = reinsps.filter(r => r.equipment_id === selEq.id);
for (const ri of oldRi) {
  try { await sb.rpc("close_reinspection", { p_old_id: ri.id, p_performed_by: profile.id, p_performed_by_name: profile.name }, tk); } catch {}
}
msg("Checklist enviado com sucesso!");
};

const sendOffline = async () => {
const photoData = {};
for (const i of items) {
  if (photos[i.id]) {
    photoData[i.id] = { base64: await fileToBase64(photos[i.id]), ext: photos[i.id].name?.split(".").pop() || "jpg" };
  }
}
await queueAdd({
  form_id: selForm.id, equipment_id: selEq.id, driver_id: profile.id, driver_name: profile.name,
  responses: items.map(i => ({ form_item_id: i.id, answer: resp[i.id], notes: notes[i.id] || null, photo: photoData[i.id] || null })),
  reinsps: reinsps.filter(r => r.equipment_id === selEq.id).map(r => r.id),
  queued_at: new Date().toISOString()
});
const n = await queueCount(); setPendingSync(n);
msg("Checklist salvo! Será enviado ao reconectar.");
};

const syncQueue = async () => {
const q = await queueGetAll();
if (!q.length) return;
setSyncing(true);
let ok = 0;
for (const entry of q) {
  try {
    const [ck] = await sb.ins("checklists", { form_id: entry.form_id, equipment_id: entry.equipment_id, driver_id: entry.driver_id, status: "triagem" }, tk);
    const resps = [];
    for (const r of entry.responses) {
      let photo_url = null;
      if (r.photo) {
        const blob = base64ToBlob(r.photo.base64);
        const path = `${ck.id}/${r.form_item_id}.${r.photo.ext}`;
        photo_url = await sb.upload("checklist-photos", path, blob, tk);
      }
      resps.push({ checklist_id: ck.id, form_item_id: r.form_item_id, answer: r.answer, photo_url, notes: r.notes });
    }
    await sb.ins("checklist_responses", resps, tk);
    await sb.ins("checklist_history", { checklist_id: ck.id, action: "Checklist enviado (sync offline)", performed_by: entry.driver_id, performed_by_name: entry.driver_name }, tk);
    for (const riId of (entry.reinsps || [])) {
      try { await sb.rpc("close_reinspection", { p_old_id: riId, p_performed_by: entry.driver_id, p_performed_by_name: entry.driver_name }, tk); } catch {}
    }
    await queueRemove(entry.id);
    ok++;
  } catch { break; }
}
const remaining = await queueCount(); setPendingSync(remaining);
if (ok > 0) { msg(`${ok} checklist${ok>1?"s":""} sincronizado${ok>1?"s":""}!`); load(); }
setSyncing(false);
};

const send = async () => {
if (!canSend()) return;
setSending(true);
try {
  if (navigator.onLine) { await sendOnline(); } else { await sendOffline(); }
  sv("home"); load();
} catch (e) { msg(erroMsg(e), "error"); }
finally { setSending(false); }
};

// Auto-sync quando reconecta
useEffect(() => {
if (isOnline && !syncing) { syncQueue(); }
}, [isOnline]);

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
{pendingSync > 0 && <div style={{ marginBottom:14, padding:"10px 14px", background:T.y+"18", border:`1px solid ${T.y}40`, borderRadius:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<div><div style={{ fontSize:12, fontWeight:700, color:T.y }}>{syncing ? "⏳" : "📤"} {pendingSync} checklist{pendingSync>1?"s":""} pendente{pendingSync>1?"s":""}</div>
<div style={{ fontSize:10, color:T.t3 }}>{syncing ? "Sincronizando..." : "Aguardando conexão"}</div></div>
{!syncing && navigator.onLine && <button className="btn bp bs" style={{ fontSize:10 }} onClick={syncQueue}>Sincronizar</button>}
</div>}
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


export default Motorista;
