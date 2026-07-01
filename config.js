// Supabase config
const SB_URL = "https://slappxegoqzcmkgtpieq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXBweGVnb3F6Y21rZ3RwaWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjc2NzksImV4cCI6MjA5NzcwMzY3OX0.nIUPxoFdBIYSkZcRg3xUUSyioTcegccpJa7TLX7Ek6g";


const sb = {
h(tk) {
const h = { "apikey": SB_KEY, "Content-Type": "application/json" };
if (tk) h["Authorization"] = `Bearer ${tk}`;
return h;
},
async signIn(email, password) {
const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: this.h(), body: JSON.stringify({ email, password }) });
if (!r.ok) { const e = await r.json(); const em = e.error_description||e.message||e.msg||"Login falhou"; throw new Error(em.includes("Invalid login") ? "E-mail ou senha incorretos" : em); }
return r.json();
},
async signOut(tk) { await fetch(`${SB_URL}/auth/v1/logout`, { method: "POST", headers: this.h(tk) }).catch(() => {}); },
async refresh(rt) {
const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: this.h(), body: JSON.stringify({ refresh_token: rt }) });
if (!r.ok) throw new Error("Sessão expirada");
return r.json();
},
async updatePassword(tk, pw) {
const r = await fetch(`${SB_URL}/auth/v1/user`, { method: "PUT", headers: this.h(tk), body: JSON.stringify({ password: pw }) });
if (!r.ok) throw new Error("Erro ao alterar senha");
return r.json();
},
async q(table, tk, params = "") {
const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: { ...this.h(tk), "Prefer": "return=representation" } });
if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Erro na consulta"); }
return r.json();
},
async ins(table, data, tk) {
const r = await fetch(`${SB_URL}/rest/v1/${table}`, { method: "POST", headers: { ...this.h(tk), "Prefer": "return=representation" }, body: JSON.stringify(data) });
if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Erro ao inserir"); }
return r.json();
},
async upd(table, data, match, tk) {
const p = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join("&");
const r = await fetch(`${SB_URL}/rest/v1/${table}?${p}`, { method: "PATCH", headers: { ...this.h(tk), "Prefer": "return=representation" }, body: JSON.stringify(data) });
if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Erro ao atualizar"); }
return r.json();
},
async rpc(fn, params, tk) {
const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: this.h(tk), body: JSON.stringify(params) });
if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Erro na função"); }
const txt = await r.text();
return txt ? JSON.parse(txt) : null;
},
async upload(bucket, path, file, tk) {
const r = await fetch(`${SB_URL}/storage/v1/object/${bucket}/${path}`, { method: "POST", headers: { "Authorization": `Bearer ${tk}`, "apikey": SB_KEY, "Content-Type": file.type }, body: file });
if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.message || "Erro no upload da foto"); }
return `${SB_URL}/storage/v1/object/public/${bucket}/${path}`;
},
// FIX #4: trocado /auth/v1/admin/users (requer service_role) por /auth/v1/signup (funciona com anon key)
async createUser(email, password, meta) {
const r = await fetch(`${SB_URL}/auth/v1/signup`, { method: "POST", headers: this.h(), body: JSON.stringify({ email, password, data: meta }) });
if (!r.ok) { const e = await r.json(); throw new Error(e.msg || e.error_description || "Erro ao criar usuário"); }
return r.json();
},
};


export { SB_URL, SB_KEY, sb };
