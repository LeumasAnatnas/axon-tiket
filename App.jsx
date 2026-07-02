import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./auth.jsx";
import { T, css } from "./theme.js";
import { getTenantSlug, fetchTenant, sb } from "./config.js";
import Login from "./Login.jsx";
import Motorista from "./Motorista.jsx";
import Gestor from "./Gestor.jsx";
import Superadmin from "./Superadmin.jsx";

export default function AxonTiket() {
return <AuthProvider><style>{css}</style><div className="app"><Router /></div></AuthProvider>;
}

function Router() {
const { profile, loading, logout, tk } = useAuth();
const [view, setView] = useState("home");
const [toast, setToast] = useState(null);
const msg = useCallback((m, t = "success") => { setToast({ m, t }); setTimeout(() => setToast(null), 3000); }, []);
const [swUpdate, setSwUpdate] = useState(false);
const [isOnline, setIsOnline] = useState(navigator.onLine);

// Tenant detection (5.1.3)
const [tenantSlug] = useState(() => getTenantSlug());
const [tenant, setTenant] = useState(null);
const [tenantLoading, setTenantLoading] = useState(true);
const [tenantError, setTenantError] = useState(false);

// Superadmin: tenant ativo (5.2.3)
const [saTenant, setSaTenant] = useState(null);

useEffect(() => {
fetchTenant(tenantSlug).then(t => {
  if (!t && tenantSlug) setTenantError(true);
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

const isSuperadmin = profile?.role === "superadmin";

// 5.2.2: cross-tenant validation
const tenantMismatch = profile && tenantSlug && tenant && !isSuperadmin && profile.tenant_id !== tenant.id;

const toastEl = toast && <div className="toast" style={{ background: toast.t === "error" ? T.r : T.g, color: "#fff" }}>{toast.m}</div>;
const offlineBanner = !isOnline && <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:300, background:T.y, color:T.bg, textAlign:"center", padding:"4px 0", fontSize:11, fontWeight:700, fontFamily:"'DM Sans'" }}>⚠️ Sem conexão — modo offline</div>;
const updateBanner = swUpdate && <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:200, background:T.ac, color:T.bg, padding:"10px 20px", borderRadius:10, display:"flex", alignItems:"center", gap:10, boxShadow:"0 4px 20px #0008", fontSize:13, fontFamily:"'DM Sans'" }}><span>🔄 Nova versão disponível</span><button onClick={()=>window.location.reload()} style={{ background:T.bg, color:T.ac, border:"none", borderRadius:6, padding:"4px 12px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", fontSize:12 }}>Atualizar</button></div>;

if (!profile) return <>{toastEl}{updateBanner}{offlineBanner}<Login msg={msg} tenant={tenant} /></>;
if (tenantMismatch) return <>{toastEl}<TenantMismatch tenant={tenant} logout={logout} /></>;

// Superadmin flow (5.2.3/5.2.4)
if (isSuperadmin && !tenantSlug) {
  // Superadmin acessou / (sem slug)
  if (!saTenant) {
    // Painel do Dono
    const handleEnter = (t) => { setSaTenant(t); setView("home"); };
    return <>{toastEl}{updateBanner}{offlineBanner}<Superadmin tk={tk} msg={msg} onEnter={handleEnter} onLogout={logout} /></>;
  }
  // Superadmin entrou em um tenant
  const handleBack = async () => {
    try { await sb.rpc("clear_superadmin_tenant", {}, tk); } catch {}
    setSaTenant(null); setView("home");
  };
  const saBanner = <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:300, background:"#f59e0b", color:T.bg, textAlign:"center", padding:"6px 0", fontSize:12, fontWeight:700, fontFamily:"'DM Sans'", display:"flex", justifyContent:"center", alignItems:"center", gap:12 }}>
    <span>🔧 Gerenciando: {saTenant.name}</span>
    <button onClick={handleBack} style={{ background:T.bg, color:"#f59e0b", border:"none", borderRadius:6, padding:"3px 12px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", fontSize:11 }}>← Voltar ao Painel</button>
  </div>;
  return <>{toastEl}{updateBanner}{saBanner}<div style={{ paddingTop:32 }}><Gestor v={view} sv={setView} msg={msg} tenant={saTenant} /></div></>;
}

// Superadmin acessou via /t/slug — funciona como admin desse tenant
const effectiveTenant = isSuperadmin ? (tenant || saTenant) : tenant;

return <>
{toastEl}{updateBanner}{offlineBanner}
{profile.role === "gestor" || profile.role === "admin" || isSuperadmin
  ? <Gestor v={view} sv={setView} msg={msg} tenant={effectiveTenant} />
  : <Motorista v={view} sv={setView} msg={msg} isOnline={isOnline} tenant={effectiveTenant} />}
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

function TenantMismatch({ tenant, logout }) {
return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 20 }}>
<div className="logo" style={{ fontSize: 24, letterSpacing: 3 }}>AXON TIKET</div>
<div style={{ color: T.r, fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans'" }}>Acesso negado</div>
<div style={{ color: T.t3, fontSize: 13, textAlign: "center", maxWidth: 340, fontFamily: "'DM Sans'", lineHeight: 1.6 }}>
Sua conta não pertence à empresa <strong style={{ color: T.tx }}>{tenant?.name}</strong>. Faça logout e entre com as credenciais corretas desta empresa.
</div>
<button className="btn bp" onClick={logout} style={{ marginTop: 8 }}>Sair e trocar de conta</button>
</div>;
}
