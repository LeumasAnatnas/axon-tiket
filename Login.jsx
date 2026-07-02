import { useState, useEffect } from "react";
import { useAuth } from "./auth.jsx";
import { SB_URL, SB_KEY } from "./config.js";
import { T } from "./theme.js";

function Login({ msg, tenant }) {
const { login } = useAuth();
const [e, setE] = useState("");
const [p, setP] = useState("");
const [ld, setLd] = useState(false);
const [conn, setConn] = useState(null);

const accentColor = tenant?.primary_color || T.ac;

useEffect(() => {
fetch(`${SB_URL}/rest/v1/classes?select=name&limit=1`, { headers: { apikey: SB_KEY } })
.then(r => setConn(r.ok ? "ok" : "err")).catch(() => setConn("err"));
}, []);

const go = async () => {
if (!e || !p) return msg("Preencha e-mail e senha", "error");
setLd(true);
try { await login(e, p); msg("Login realizado!"); }
catch (err) { const m = err.message?.includes("fetch") ? "Sem conexão com o servidor" : err.message; msg(m, "error"); }
finally { setLd(false); }
};

return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
<div className="fi" style={{ width: "100%", maxWidth: 380 }}>
<div style={{ textAlign: "center", marginBottom: 40 }}>
{tenant?.logo_url
  ? <img src={tenant.logo_url} alt={tenant.name} style={{ maxHeight: 60, objectFit: "contain", marginBottom: 12 }} />
  : <div className="logo" style={{ fontSize: 32, letterSpacing: 3, marginBottom: 8 }}>{tenant?.name || "AXON TIKET"}</div>}
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
<button className="btn bp bw" style={{ background: accentColor }} onClick={go} disabled={ld}>
{ld ? <><span className="sp" style={{ width: 16, height: 16 }} /> Entrando...</> : "Entrar"}
</button>
</div>
{tenant && <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: T.t3 }}>Powered by AXON TIKET</div>}
</div>
</div>;
}


export default Login;
