import { useState, useEffect } from "react";
import { sb } from "./config.js";
import { T } from "./theme.js";

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


export default DriverDashboard;
