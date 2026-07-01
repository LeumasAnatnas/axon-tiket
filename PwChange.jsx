import { useState } from "react";
import { useAuth } from "./auth.jsx";
import { sb } from "./config.js";
import { T } from "./theme.js";

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


export default PwChange;
