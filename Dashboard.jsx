import { useState, useEffect } from "react";
import { sb } from "./config.js";
import { T } from "./theme.js";

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
const LineChart = ({ data, color = "#3b82f6" }) => {
if (!data?.length) return null;
const W = 500, H = 160, P = { t: 20, r: 16, b: 36, l: 36 };
const cw = W - P.l - P.r, ch = H - P.t - P.b;
const mx = Math.max(...data.map(d => d.total), 1);
const pts = data.map((d, i) => [P.l + (data.length > 1 ? i * cw / (data.length - 1) : cw / 2), P.t + ch - (d.total / mx) * ch]);
const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
const area = `${pts[0][0]},${P.t + ch} ${line} ${pts[pts.length - 1][0]},${P.t + ch}`;
const step = mx <= 4 ? 1 : Math.ceil(mx / 4);
const yTicks = [];
for (let v = 0; v <= mx; v += step) yTicks.push(v);
if (yTicks[yTicks.length - 1] < mx) yTicks.push(mx);
return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
{yTicks.map(v => { const y = P.t + ch - (v / mx) * ch; return <g key={v}><line x1={P.l} x2={W - P.r} y1={y} y2={y} stroke={T.bd} strokeWidth={0.5} /><text x={P.l - 6} y={y + 3} fill={T.t3} fontSize={8} textAnchor="end" fontFamily="'JetBrains Mono'">{v}</text></g>; })}
<polygon points={area} fill={color} opacity={0.12} />
<polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill={color} />)}
{data.map((d, i) => { const [x] = pts[i]; const lbl = new Date(d.day + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); const show = data.length <= 15 || i % Math.ceil(data.length / 12) === 0 || i === data.length - 1; return show ? <text key={i} x={x} y={H - 6} fill={T.t3} fontSize={7} textAnchor="middle" fontFamily="'DM Sans'">{lbl}</text> : null; })}
{pts.map(([x, y], i) => <text key={"v" + i} x={x} y={y - 8} fill={T.t1} fontSize={7} textAnchor="middle" fontFamily="'JetBrains Mono'" fontWeight={700}>{data[i].total}</text>)}
</svg>;
};
const Donut = ({ segments, centerLabel, centerValue }) => {
const total = segments.reduce((s, x) => s + x.value, 0);
if (!total) return null;
const R = 50, C = 2 * Math.PI * R;
let offset = 0;
return <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
<svg viewBox="0 0 140 140" style={{ width: 120, height: 120 }}>
{segments.filter(s => s.value > 0).map((s, i) => { const dash = (s.value / total) * C; const o = offset; offset += dash; return <circle key={i} cx={70} cy={70} r={R} fill="none" stroke={s.color} strokeWidth={18} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} transform="rotate(-90 70 70)" />; })}
<text x={70} y={64} fill={T.t1} fontSize={20} fontWeight={700} textAnchor="middle" fontFamily="'JetBrains Mono'">{centerValue}</text>
<text x={70} y={80} fill={T.t3} fontSize={8} textAnchor="middle" fontFamily="'DM Sans'" textTransform="uppercase">{centerLabel}</text>
</svg>
<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
{segments.filter(s => s.value > 0).map((s, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
<div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
<span style={{ color: T.t2 }}>{s.label}: <span style={{ fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono'" }}>{s.value}</span></span>
</div>)}
</div></div>;
};
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
<LineChart data={data.daily} />
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
{(data.evaluation.totalmente>0||data.evaluation.parcialmente>0||data.evaluation.nao_atendido>0) && <div style={{ marginTop:4 }}>
<Donut segments={[{label:"Totalmente",value:data.evaluation.totalmente,color:T.g},{label:"Parcialmente",value:data.evaluation.parcialmente,color:T.y},{label:"Não atendido",value:data.evaluation.nao_atendido,color:T.r}]} centerValue={data.evaluation.avg_rating} centerLabel="nota média" />
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

export default Dashboard;
