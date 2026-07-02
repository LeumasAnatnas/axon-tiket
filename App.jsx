import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./auth.jsx";
import { T, css } from "./theme.js";
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
useEffect(() => { const h = () => setSwUpdate(true); window.addEventListener("sw-updated", h); return () => window.removeEventListener("sw-updated", h); }, []);
useEffect(() => {
const on = () => setIsOnline(true);
const off = () => setIsOnline(false);
window.addEventListener("online", on);
window.addEventListener("offline", off);
return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
}, []);

if (loading) return <Splash />;

const toastEl = toast && <div className="toast" style={{ background: toast.t === "error" ? T.r : T.g, color: "#fff" }}>{toast.m}</div>;
const offlineBanner = !isOnline && <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:300, background:T.y, color:T.bg, textAlign:"center", padding:"4px 0", fontSize:11, fontWeight:700, fontFamily:"'DM Sans'" }}>⚠️ Sem conexão — modo offline</div>;
const updateBanner = swUpdate && <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:200, background:T.ac, color:T.bg, padding:"10px 20px", borderRadius:10, display:"flex", alignItems:"center", gap:10, boxShadow:"0 4px 20px #0008", fontSize:13, fontFamily:"'DM Sans'" }}><span>🔄 Nova versão disponível</span><button onClick={()=>window.location.reload()} style={{ background:T.bg, color:T.ac, border:"none", borderRadius:6, padding:"4px 12px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", fontSize:12 }}>Atualizar</button></div>;

if (!profile) return <>{toastEl}{updateBanner}{offlineBanner}<Login msg={msg} /></>;

return <>
{toastEl}{updateBanner}{offlineBanner}
{profile.role === "gestor" || profile.role === "admin" ? <Gestor v={view} sv={setView} msg={msg} /> : <Motorista v={view} sv={setView} msg={msg} isOnline={isOnline} />}
</>;
}

function Splash() {
return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
<div className="logo" style={{ fontSize: 28, letterSpacing: 3 }}>AXON TIKET</div>
<div className="sp" /><div style={{ color: T.t3, fontSize: 13 }}>Carregando...</div>
</div>;
}


