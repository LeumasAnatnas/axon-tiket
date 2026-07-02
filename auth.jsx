import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { sb, SB_URL, SB_KEY } from "./config.js";
import { cacheGet, cacheSet } from "./offlineStore.js";

const Ctx = createContext(null);
function AuthProvider({ children }) {
const [session, setSession] = useState(null);
const [profile, setProfile] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
const s = localStorage.getItem("axon_s");
if (s) { try { const p = JSON.parse(s); initSession(p); } catch { setLoading(false); } }
else setLoading(false);
}, []);

const initSession = async (p) => {
try {
// tenta refresh para garantir token válido
const d = await sb.refresh(p.rt);
const ns = { tk: d.access_token, rt: d.refresh_token, uid: d.user.id };
localStorage.setItem("axon_s", JSON.stringify(ns));
setSession(ns);
loadProfile(ns.tk, ns.uid);
} catch {
// refresh falhou, tenta com token existente
setSession(p);
loadProfile(p.tk, p.uid);
}
};

const loadProfile = async (tk, uid) => {
try {
const ps = await sb.q("profiles", tk, `id=eq.${uid}&select=*`);
if (ps.length > 0) { setProfile(ps[0]); cacheSet("profile_" + uid, ps[0]).catch(() => {}); }
else throw new Error("not_found");
} catch (e) {
if (e.message === "not_found") { localStorage.removeItem("axon_s"); setSession(null); }
else {
const cached = await cacheGet("profile_" + uid);
if (cached) { setProfile(cached); }
else { localStorage.removeItem("axon_s"); setSession(null); }
}
}
finally { setLoading(false); }
};

// FIX #9: auto-refresh JWT a cada 50min
useEffect(() => {
if (!session?.rt) return;
const doRefresh = async () => {
try {
const d = await sb.refresh(session.rt);
const s = { tk: d.access_token, rt: d.refresh_token, uid: d.user.id };
localStorage.setItem("axon_s", JSON.stringify(s));
setSession(s);
} catch (e) { if (navigator.onLine) { localStorage.removeItem("axon_s"); setSession(null); setProfile(null); } }
};
const id = setInterval(doRefresh, 50 * 60 * 1000);
return () => clearInterval(id);
}, [session?.rt]);

const login = async (email, pw) => {
const d = await sb.signIn(email, pw);
const s = { tk: d.access_token, rt: d.refresh_token, uid: d.user.id };
localStorage.setItem("axon_s", JSON.stringify(s));
setSession(s);
setLoading(true);
await loadProfile(d.access_token, d.user.id);
};

const logout = async () => {
if (session?.tk) sb.signOut(session.tk);
localStorage.removeItem("axon_s");
setSession(null); setProfile(null);
};

return <Ctx.Provider value={{ session, profile, tk: session?.tk, loading, login, logout }}>{children}</Ctx.Provider>;
}
const useAuth = () => useContext(Ctx);


export { AuthProvider, useAuth };
