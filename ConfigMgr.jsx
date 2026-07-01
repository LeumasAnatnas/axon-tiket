import { useState } from "react";
import { sb } from "./config.js";
import { T } from "./theme.js";

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


export default ConfigMgr;
