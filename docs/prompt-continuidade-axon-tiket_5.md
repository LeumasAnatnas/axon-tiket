=== PROMPT DE CONTINUIDADE — AXON TIKET (v5) ===
Cole este prompt no início da próxima conversa.

---

Atue como gestor sênior multidisciplinar (projetos, inovação, desenvolvimento web/app, automação, manutenção mecânica de frotas). Abordagem híbrida: planejamento estruturado + execução incremental. Seja direto, técnico e econômico com tokens.

# PROJETO: AXON TIKET

Sistema web (PWA) de checklist e gestão de manutenção de frotas (cavalos mecânicos e semirreboques). Três perfis: motorista, gestor, admin. PWA instalável. Dashboard com SLA. Notificações em tempo real. Sistema de avaliação. Export PDF/Excel.

## INFRAESTRUTURA

- **App produção:** https://axon-tiket.vercel.app
- **Repositório:** github.com/LeumasAnatnas/axon-tiket (estrutura flat + pasta `public/`)
- **Banco:** Supabase — projeto `slappxegoqzcmkgtpieq`, URL: `https://slappxegoqzcmkgtpieq.supabase.co`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXBweGVnb3F6Y21rZ3RwaWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjc2NzksImV4cCI6MjA5NzcwMzY3OX0.nIUPxoFdBIYSkZcRg3xUUSyioTcegccpJa7TLX7Ek6g`
- **Vercel:** Project ID `prj_xdzC1BnNH0csQjXArwKJZTjiSkZT`, Team ID `team_tVvkBPHpBr64G4D4A6r6aEuy`
- **Auto-deploy:** commits na main → Vercel auto-build (~1min)
- **Admin login:** samuel@axontiket.com (role: admin)
- **MCP disponíveis:** Supabase, Vercel, Claude in Chrome
- **Supabase Free Tier:** DB 500MB (~11MB usado), Storage 1GB (gargalo para fotos em escala), Auth 50k MAU

## SCHEMA DO BANCO

**Tabelas (9):** profiles (role: motorista|gestor|admin), classes, equipment, forms, form_items, checklists (com ticket_number serial), checklist_responses, checklist_history, settings (key-value)

**Views (3):** v_kanban (ticket_number, plate, problem_count, total_items, eval data, reinspection_requested), v_driver_history (ticket_number, problem_count, gestor_name), v_checklist_items (photo_url, notes, label)

**Functions (15):** move_checklist (limpa concluded_at/eval ao sair de atendido), request_reinspection, close_reinspection (mantém reinspection_requested=true), submit_evaluation (só com problemas, sem reinspeção), get_dashboard (exclui reinspeção exceto reação), get_driver_dashboard (exclui reinspeção), get_audit_report (relatório completo para PDF/Excel), reset_user_password (hierarquia), update_user_email (auth+profiles), change_email_domain (massa), get_setting, is_gestor (inclui admin), is_admin, handle_new_user (trigger), handle_updated_at (trigger)

**Storage:** bucket `checklist-photos` (público leitura, RLS authenticated upload)
**Auth:** "Confirm email" DESATIVADO, signup ATIVADO
**Settings:** `email_domain` = domínio padrão para cadastro

**Colunas importantes:**
- `profiles`: id, email, name, role (motorista|gestor|admin), active
- `form_items`: id, form_id, label, photo_rule (mandatory/optional/none), sort_order, active
- `checklist_responses`: id, checklist_id, form_item_id, answer (ok/problem/na), photo_url, notes
- `checklists`: ticket_number (serial), status (triagem|em_atendimento|processado|atendido), submitted_at, concluded_at, assigned_to, reinspection_requested, reinspection_notes, eval_status, eval_rating, eval_notes, eval_at, conclusion_text

## APP (~1456 linhas)

- Arquivo único: `App.jsx`, fetch-based Supabase client `sb` (sem SDK)
- JWT auto-refresh: refresh on boot + intervalo 50min
- Componentes: Login, Splash, Motorista, Gestor, DriverDashboard, Dashboard, ClassMgr, FormMgr, UserMgr, GestorMgr, EquipMgr, ConfigMgr, PwChange
- Kanban v2: grid 4 colunas, filtros (período/equipamento/motorista/urgência/data/ticket), KPIs, borda urgência, badge reinspeção (solicitada/atendida)
- Re-inspeção: gestor solicita → motorista alerta → novo checklist → antigo fecha (SECURITY DEFINER, mantém flag true)
- Avaliação: só checklists com problemas e sem reinspeção. 3 classificações + nota 0-10
- Dashboard gestor: KPIs + SLA + backlog + gestor + daily + top problemas + equipamento + avaliação + feedback motoristas + export
- Dashboard motorista: KPIs + status + avaliações dadas + últimos envios
- Notificações: polling 30s + badge + beep (Web Audio API 880Hz) + push browser
- Export PDF: HTML em nova aba → print (todos itens, fotos, histórico, avaliações)
- Export Excel: SheetJS CDN (3 abas: Checklists, Respostas, Histórico)
- Domínio e-mail: input split (username + @domain readonly), admin configura/troca em massa
- PWA: manifest.json, sw.js, icons em public/
- Responsive: grid 4→2→1 col

## TUDO QUE FOI ENTREGUE (Fases 1-4.5)

### Fase 1 — MVP
Login, seleção equipamento com filtro, checklist completo (ok/problem/na + fotos + observações), Kanban 4 colunas, modal detalhes, CRUD completo com soft-delete, histórico motorista, reset senha, JWT auto-refresh.

### Fase 2 — Evolução
Kanban v2 (filtros/KPIs/responsive/urgência/ver mais), re-inspeção flow completo.

### Fase 3 — PWA/Dashboard/Notificações
PWA instalável, Dashboard v2 (SLA/backlog/gestor/daily/top problemas/equipamento), notificações (polling+badge+beep+push).

### Fase 4 — Hierarquia/Avaliação/Dashboard Motorista/Export
1. ✅ Hierarquia admin/gestor/motorista — role "admin", is_admin(), RLS segmentada
2. ✅ Avaliação do atendimento — motorista avalia gestor (só com problemas, sem reinspeção)
3. ✅ Dashboard motorista — KPIs, status, avaliações, últimos envios
4. ✅ Export relatórios — PDF (HTML-to-print, registros completos), Excel (SheetJS, base de dados)

### Fase 4.5 — Fundação SaaS
- ✅ Tabela settings (key-value) com email_domain
- ✅ Domínio fixo no cadastro (input split username + @domain)
- ✅ Admin configura domínio + troca em massa (RPC change_email_domain)
- ✅ Validação nome único (frontend)
- ✅ Ticket number sequencial (serial em checklists, exibido em todos os pontos)
- ✅ Métricas refinadas (reinspeção excluída de tudo exceto reação)
- ✅ Login com mensagem de erro em português
- ✅ Data calendário local (não UTC)
- ✅ Toast renderiza em todas as telas (inclusive login)

## MÉTRICAS DO DASHBOARD — REGRAS

Checklists com `reinspection_requested=true` são EXCLUÍDOS de tudo, EXCETO reação:
- Checklists Válidos: count WHERE NOT reinspection
- Com Problemas: idem
- Tempo Total Médio: submitted→concluded WHERE atendido AND NOT reinspection
- Backlog: triagem + em_atendimento (exclui processado e reinspection)
- Reação Média/Pior: INCLUI reinspection
- Atendimento Médio/Pior: NOT reinspection
- Desempenho Gestor: tempo atendimento médio NOT reinspection
- Checklists por Dia, Top Problemas, Por Equipamento: NOT reinspection

## ROADMAP APROVADO

| Fase | Escopo | Status |
|------|--------|--------|
| 4.7 | Polimento (SW inteligente, reativar usuários, gráficos) | ⬜ Próximo |
| 5.0 | Modularização + Offline-first | ⬜ |
| 5.1 | Multi-tenant SaaS | ⬜ |
| 5.2 | Assinatura digital | ⬜ |

## LIÇÕES APRENDIDAS (acumulado)

1. **Deploy path:** App.jsx → present_files → download → GitHub Upload Files → commit → Vercel auto-deploy
2. Chrome MCP: `file-attachment.attach([files])` funciona. NÃO editar CodeMirror 6.
3. Chrome MCP tools descarregam com muitos MCPs conectados. Fallback para path 1.
4. `execute_sql` ~4000 chars — chunkar se maior
5. Views: DROP+CREATE quando mudam colunas (não CREATE OR REPLACE)
6. RPC void: `r.text()` + `JSON.parse()`
7. Auth free tier: ~3 emails/hora, confirm email desativado
8. Storage: público=leitura anon, write=RLS authenticated
9. Colunas: `label` (não description), `sort_order` (não position), `answer` (não value), `notes`
10. Motorista NÃO tem RLS UPDATE — sempre SECURITY DEFINER
11. Sempre introspectar schema antes de migrar
12. `sb.rpc()` dashboard: JSONB com múltiplas seções em uma chamada
13. PWA: arquivos estáticos em `public/` no Vite → copiados para build root
14. Web Audio API para beep (sem arquivo externo), Notification API para push
15. Storage 1GB é gargalo — Pro ($25/mês) resolve
16. Para baixar App.jsx: `curl -s https://raw.githubusercontent.com/LeumasAnatnas/axon-tiket/main/App.jsx`
17. React hooks NUNCA após if/return — causa tela branca silenciosa
18. `close_reinspection` DEVE manter reinspection_requested=true
19. `move_checklist` DEVE limpar concluded_at/eval ao sair de atendido
20. Toast DEVE renderizar fora do bloco condicional de profile
21. Datas: comparar calendário local (calDays), não milissegundos UTC
22. CDN jsPDF falha — usar HTML-to-print para PDF
23. PostgREST `or` filter: encoding problemático — filtrar em JS-side quando possível
24. Ticket search: se input é só número, busca exata; se texto, busca por contains
