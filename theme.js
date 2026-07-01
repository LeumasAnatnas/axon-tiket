const T = { bg: "#0f1117", c1: "#1a1d27", c2: "#252836", c3: "#2a2d3a", ac: "#00d4ff", acd: "#0099bb", tx: "#e8eaed", t2: "#8b8fa3", t3: "#5a5e72", bd: "#2a2d3a", r: "#ef4444", g: "#22c55e", y: "#f59e0b", p: "#8b5cf6" };
const KAN = [
{ id: "triagem", label: "Triagem", color: "#f59e0b", icon: "📋" },
{ id: "processado", label: "Processado", color: "#22c55e", icon: "✅" },
{ id: "em_atendimento", label: "Em Atendimento", color: "#3b82f6", icon: "🔧" },
{ id: "atendido", label: "Atendido", color: "#8b5cf6", icon: "🏁" },
];
const PHR = { mandatory: "📷 Obrigatória", optional: "📷 Opcional", none: "" };
const PHC = { mandatory: "#ef4444", optional: "#f59e0b", none: "transparent" };

const css = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:${T.bg};color:${T.tx};font-family:'DM Sans',sans-serif}
.app{min-height:100vh;background:${T.bg}}
.btn{padding:10px 20px;border:none;border-radius:8px;font-family:'DM Sans';font-weight:600;font-size:14px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.bp{background:${T.ac};color:${T.bg}}.bp:hover{background:${T.acd}}
.bg{background:transparent;color:${T.t2};border:1px solid ${T.bd}}.bg:hover{background:${T.c3};color:${T.tx}}
.bs{padding:6px 12px;font-size:12px}.bw{width:100%;justify-content:center}
.btn:disabled{opacity:.4;cursor:not-allowed}
.inp{width:100%;padding:12px 16px;background:${T.c2};border:1px solid ${T.bd};border-radius:8px;color:${T.tx};font-family:'DM Sans';font-size:14px;outline:none;transition:border-color .2s}
.inp:focus{border-color:${T.ac}}.inp::placeholder{color:${T.t3}}
select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b8fa3' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.lbl{display:block;font-size:12px;font-weight:600;color:${T.t2};margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
.card{background:${T.c1};border:1px solid ${T.bd};border-radius:12px;padding:20px;transition:all .2s}
.badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.topbar{position:sticky;top:0;z-index:50;background:${T.c1}ee;backdrop-filter:blur(12px);border-bottom:1px solid ${T.bd};padding:12px 20px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:16px;color:${T.ac};letter-spacing:1px}
.nav{position:fixed;bottom:0;left:0;right:0;z-index:50;background:${T.c1}ee;backdrop-filter:blur(12px);border-top:1px solid ${T.bd};padding:8px 0 12px;display:flex;justify-content:space-around}
.ni{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;color:${T.t3};cursor:pointer;padding:4px 12px;border:none;background:none;font-family:'DM Sans';position:relative}
.ni.on{color:${T.ac}}
.pg{padding:16px 20px 100px;max-width:1400px;margin:0 auto}
.kpig{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.filtrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
@media(max-width:640px){.kpig{grid-template-columns:repeat(2,1fr)}.filtrow .finp{width:100%;min-width:0!important}}
.fi{animation:fi .3s ease}@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.toast{position:fixed;top:20px;right:20px;z-index:200;padding:14px 20px;border-radius:10px;font-weight:600;font-size:14px;animation:si .3s ease,so .3s ease 2.7s forwards;box-shadow:0 8px 24px #00000060}
@keyframes si{from{opacity:0;transform:translateX(40px)}}@keyframes so{to{opacity:0;transform:translateX(40px)}}
.sp{width:20px;height:20px;border:2px solid ${T.bd};border-top-color:${T.ac};border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.tabs{display:flex;gap:4px;background:${T.c2};padding:4px;border-radius:10px;margin-bottom:20px}
.tab{flex:1;padding:10px;border:none;border-radius:8px;background:transparent;color:${T.t2};font-weight:600;font-size:13px;cursor:pointer;font-family:'DM Sans'}.tab.on{background:${T.ac};color:${T.bg}}
.kb{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding-bottom:20px}
@media(max-width:900px){.kb{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.kb{grid-template-columns:1fr}}
.kc{background:${T.c2};border-radius:12px;padding:12px;min-height:200px}
.kch{display:flex;align-items:center;gap:8px;padding:8px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.5px}
.kk{background:${T.c1};border:1px solid ${T.bd};border-radius:10px;padding:14px;cursor:pointer;transition:all .2s;margin-bottom:8px}
.kk:hover{border-color:${T.ac}50;transform:translateY(-2px)}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.rbtn{padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans';transition:all .2s;border:2px solid ${T.bd};background:transparent;color:${T.t2}}
.hist-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid ${T.bd}}
.hist-row:last-child{border-bottom:none}
`;


export { T, KAN, PHR, PHC, css };
