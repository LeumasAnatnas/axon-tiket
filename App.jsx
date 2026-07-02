import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./auth.jsx";
import { T, css } from "./theme.js";
import { getTenantSlug, fetchTenant } from "./config.js";
import Login from "./Login.jsx";
import Motorista from "./Motorista.jsx";
import Gestor from "./Gestor.jsx";

export default function AxonTiket() {
return <AuthProvider><style>{css}</style><div className="app"><Router /></div></AuthProvider>;
}

function Router() {
const { profile, loading } = useAuth();
const [view, setView] = useState("home");
const [toast, setToast] = useState(null);
const msg = useCallback((m, t = "success") => { setToast({ m, t }); setTimeout(() => setToast(null), 3000); }, []);
const [swUpdate, setSwUpdate] = useState(false);
const [isOnline, setIsOnline] = useState(navigator.onLine);

// Tenant detection (5.1.3)
const [tenant, setTenant] = useState(null);
const [tenantLoading, setTenantLoading] = useState(true);
const [tenantError, setTenantError] = useState(false);

useEffect(() => {
const slug = getTenantSlug();
fetchTenant(slug).then(t => {
  if (!t && slug) setTenantError(true);
  setTenant(t);
  setTenantLoading(false);
}).catch(() => setTenantLoading(false));
}, []);

useEffect(() => { const h = () => setSwUpdate(true); window.addEventListener("sw-updated", h); return () => window.removeEventListener("sw-updated", h); }, []);
useEffect(() => {
const on = () => setIsOnline(true);
const off = () => setIsOnline(false);
window.addEventListener("online", on);
window.addEventListener("offline", off);
return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
}, []);

if (loading || tenantLoading) return <Splash tenant={tenant} />;

if (tenantError) return <TenantNotFound />;

const toastEl = toast && <div className="toast" style={{ background: toast.t === "error" ? T.r : T.g, color: "#fff" }}>{toast.m}</div>;
const offlineBanner = !isOnline && <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:300, background:T.y, color:T.bg, textAlign:"center", padding:"4px 0", fontSize:11, fontWeight:700, fontFamily:"'DM Sans'" }}>⚠️ Sem conexão — modo offline</div>;
const updateBanner = swUpdate && <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:200, background:T.ac, color:T.bg, padding:"10px 20px", borderRadius:10, display:"flex", alignItems:"center", gap:10, boxShadow:"0 4px 20px #0008", fontSize:13, fontFamily:"'DM Sans'" }}><span>🔄 Nova versão disponível</span><button onClick={()=>window.location.reload()} style={{ background:T.bg, color:T.ac, border:"none", borderRadius:6, padding:"4px 12px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", fontSize:12 }}>Atualizar</button></div>;

if (!profile) return <>{toastEl}{updateBanner}{offlineBanner}<Login msg={msg} tenant={tenant} /></>;

return <>
{toastEl}{updateBanner}{offlineBanner}
{profile.role === "gestor" || profile.role === "admin" ? <Gestor v={view} sv={setView} msg={msg} tenant={tenant} /> : <Motorista v={view} sv={setView} msg={msg} isOnline={isOnline} tenant={tenant} />}
</>;
}

function Splash({ tenant }) {
const name = tenant?.name || "AXON TIKET";
return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
{tenant?.logo_url
  ? <img src={tenant.logo_url} alt={name} style={{ maxHeight: 56, objectFit: "contain" }} />
  : <div className="logo" style={{ fontSize: 28, letterSpacing: 3 }}>{name}</div>}
<div className="sp" /><div style={{ color: T.t3, fontSize: 13 }}>Carregando...</div>
</div>;
}

function TenantNotFound() {
return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 20 }}>
<div className="logo" style={{ fontSize: 24, letterSpacing: 3 }}>AXON TIKET</div>
<div style={{ color: T.r, fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans'" }}>Empresa não encontrada</div>
<div style={{ color: T.t3, fontSize: 13, textAlign: "center", maxWidth: 300, fontFamily: "'DM Sans'" }}>O endereço informado não corresponde a nenhuma empresa cadastrada. Verifique a URL e tente novamente.</div>
</div>;
}
