# AXON TIKET — Documentação Técnica Completa
**Versão:** Fase 4.5 | **Data:** 01/07/2026 | **Proprietário:** Samuel Luis Santana

---

## 1. VISÃO GERAL

Sistema web (PWA) de checklist e gestão de manutenção de frotas. Motoristas aplicam checklists em cavalos mecânicos e semirreboques, gestores gerenciam o fluxo via Kanban, e o sistema gera métricas SLA e relatórios de auditoria.

**URL Produção:** https://axon-tiket.vercel.app

---

## 2. INFRAESTRUTURA

| Serviço | Detalhes |
|---------|----------|
| **Frontend** | React (App.jsx único, ~1456 linhas), Vite, hospedado na Vercel |
| **Backend** | Supabase (PostgreSQL + Auth + Storage) |
| **Repositório** | github.com/LeumasAnatnas/axon-tiket |
| **Deploy** | Auto-deploy: commit na branch `main` → Vercel build (~1min) |
| **PWA** | manifest.json + sw.js + ícones em `public/` |

### Credenciais e IDs
| Item | Valor |
|------|-------|
| Supabase Project ID | `slappxegoqzcmkgtpieq` |
| Supabase URL | `https://slappxegoqzcmkgtpieq.supabase.co` |
| Vercel Project ID | `prj_xdzC1BnNH0csQjXArwKJZTjiSkZT` |
| Vercel Team ID | `team_tVvkBPHpBr64G4D4A6r6aEuy` |
| Conta Admin | samuel@axontiket.com |

### Limites do Free Tier
| Recurso | Limite | Uso Atual |
|---------|--------|-----------|
| DB | 500MB | ~11MB |
| Storage | 1GB | Gargalo para fotos em escala |
| Auth | 50k MAU | Baixo |

---

## 3. PERFIS DE USUÁRIO

| Role | Capacidades |
|------|-------------|
| **admin** | Tudo do gestor + CRUD gestores + config domínio e-mail + troca em massa |
| **gestor** | Kanban, CRUD motoristas/classes/formulários/equipamentos, dashboard, exportar relatórios |
| **motorista** | Enviar checklists, histórico, avaliar atendimentos, dashboard pessoal |

**Hierarquia de permissões:**
- `is_gestor()` retorna true para gestor E admin (backward-compatible)
- `is_admin()` retorna true apenas para admin
- Gestor só cria/edita motoristas. Admin cria/edita todos.
- Motorista NÃO tem RLS UPDATE — sempre via SECURITY DEFINER

---

## 4. SCHEMA DO BANCO

### 4.1 Tabelas

**profiles** — Usuários do sistema
| Coluna | Tipo | Obs |
|--------|------|-----|
| id | uuid PK | = auth.users.id |
| name | text | Único por role (validação frontend) |
| email | text | Domínio controlado por settings |
| role | text | CHECK: motorista, gestor, admin |
| active | boolean | Soft-delete |

**classes** — Tipos de equipamento (Cavalo Mecânico, Caçamba, etc.)
| Coluna | Tipo |
|--------|------|
| id, name, description, active, created_by, created_at, updated_at |

**equipment** — Veículos/semirreboques
| Coluna | Tipo | Obs |
|--------|------|-----|
| id, prefix, plate, class_id (FK), active, notes, created_by |

**forms** — Formulários de checklist
| Coluna | Tipo |
|--------|------|
| id, class_id (FK), name, description, active, version, created_by |

**form_items** — Itens de verificação do formulário
| Coluna | Tipo | Obs |
|--------|------|-----|
| id, form_id (FK), label, photo_rule (mandatory/optional/none), sort_order, active |

**checklists** — Checklist enviado pelo motorista
| Coluna | Tipo | Obs |
|--------|------|-----|
| id | uuid PK | |
| ticket_number | serial | Sequencial, rastreável |
| form_id, equipment_id, driver_id | uuid FK | |
| status | text | triagem → em_atendimento → processado → atendido |
| assigned_to | uuid | Gestor responsável |
| conclusion_text, conclusion_photo | text | Justificativa do gestor ao concluir |
| concluded_at | timestamptz | Limpo quando sai de "atendido" |
| reinspection_requested | boolean | true = substituído por re-inspeção |
| reinspection_notes | text | Motivo da re-inspeção |
| eval_status | text | totalmente_atendido/parcialmente/nao_atendido |
| eval_rating | smallint | 0-10 |
| eval_notes, eval_at | | Avaliação do motorista |
| submitted_at, created_at, updated_at | timestamptz | |

**checklist_responses** — Respostas de cada item
| Coluna | Tipo | Obs |
|--------|------|-----|
| id, checklist_id (FK), form_item_id (FK), answer (ok/problem/na), photo_url, notes |

**checklist_history** — Log de movimentações
| Coluna | Tipo |
|--------|------|
| id, checklist_id (FK), action, from_status, to_status, performed_by, performed_by_name, notes, created_at |

**settings** — Configurações key-value
| Coluna | Tipo | Obs |
|--------|------|-----|
| key | text PK | Ex: "email_domain" |
| value | text | Ex: "axontiket.com" |

### 4.2 Views

| View | Descrição |
|------|-----------|
| **v_kanban** | Checklists + equipment + driver + gestor + problem_count + total_items + eval data + ticket_number |
| **v_driver_history** | Checklists do motorista + equipment + form + gestor_name + problem_count + eval data |
| **v_checklist_items** | Respostas + label do form_item + photo_rule |

### 4.3 Functions (RPCs)

| Função | Parâmetros | Descrição |
|--------|-----------|-----------|
| **move_checklist** | checklist_id, new_status, performed_by, performed_by_name, notes, conclusion_text, conclusion_photo | Move card no Kanban. Limpa concluded_at/eval quando sai de atendido |
| **request_reinspection** | checklist_id, performed_by, performed_by_name, notes | Gestor solicita re-inspeção |
| **close_reinspection** | old_id, performed_by, performed_by_name | Fecha checklist antigo quando motorista submete novo. Mantém reinspection_requested=true |
| **submit_evaluation** | checklist_id, status, rating, notes | Motorista avalia atendimento. Só atendidos sem reinspection |
| **get_dashboard** | p_days | KPIs + SLA + backlog + gestor + daily + problemas + equipamentos + avaliações + feedback. Exclui reinspecionados (exceto reação) |
| **get_driver_dashboard** | driver_id, p_days | Dashboard do motorista. Exclui reinspecionados |
| **get_audit_report** | driver_id, from, to | Relatório completo para PDF/Excel com items + history |
| **reset_user_password** | target_user_id, new_password | SECURITY DEFINER. Hierarquia: gestor→motorista, admin→todos |
| **update_user_email** | target_user_id, new_email | Atualiza auth.users + profiles |
| **change_email_domain** | old_domain, new_domain | Troca domínio em massa (admin) |
| **get_setting** | key | Leitura de settings |
| **is_gestor** | — | true para gestor e admin |
| **is_admin** | — | true só para admin |
| **handle_new_user** | trigger | Cria profile quando auth.users recebe INSERT |
| **handle_updated_at** | trigger | Atualiza updated_at |

### 4.4 RLS Policies

**Princípio geral:** SELECT público (authenticated), INSERT/UPDATE/DELETE via `is_gestor()` ou regras específicas.

**profiles:** admin pode tudo, gestor só INSERT/UPDATE motoristas, todos UPDATE próprio.
**checklists:** motorista insere (driver_id=auth.uid()), seleciona próprios. Gestor seleciona/atualiza todos.
**settings:** todos leem, admin insere/atualiza.

---

## 5. FRONTEND (App.jsx)

### 5.1 Estrutura

Arquivo único React (~1456 linhas) com componentes inline:

| Componente | Função |
|-----------|--------|
| **App** | Auth context, routing, toast |
| **Login** | Tela de login |
| **Splash** | Loading inicial |
| **Motorista** | Home (equipamentos + alertas), checklist, histórico |
| **Gestor** | Kanban, gerenciamento, relatórios |
| **DriverDashboard** | Dashboard do motorista |
| **Dashboard** | Dashboard do gestor com export |
| **ClassMgr, FormMgr, UserMgr, GestorMgr, EquipMgr** | CRUDs |
| **ConfigMgr** | Config de domínio (admin) |
| **PwChange** | Perfil + alterar senha + editar perfil (admin) |

### 5.2 Client Supabase (sb)

Objeto `sb` com métodos fetch-based (sem SDK):
- `signIn(email, pw)` — Login
- `signOut(tk)` — Logout
- `refresh(rt)` — Refresh JWT
- `updatePassword(tk, pw)` — Alterar senha
- `q(table, tk, filter)` — GET query
- `ins(table, data, tk)` — POST insert
- `upd(table, data, match, tk)` — PATCH update
- `rpc(fn, params, tk)` — POST RPC call
- `upload(bucket, path, file, tk)` — Upload storage
- `createUser(email, pw, meta)` — Signup

### 5.3 Funcionalidades-Chave

**Kanban:** 4 colunas (triagem/processado/em_atendimento/atendido), filtros (equipamento/motorista/urgência/data/ticket), KPIs, polling 30s.

**Re-inspeção:** Gestor solicita → motorista vê alerta → preenche novo → antigo fecha automaticamente (SECURITY DEFINER).

**Avaliação:** Apenas para checklists com problemas e sem re-inspeção. Motorista classifica (totalmente/parcialmente/não atendido) + nota 0-10.

**Notificações:** Polling 30s + badge + beep (Web Audio API 880Hz) + push browser.

**Export PDF:** HTML renderizado em nova aba → browser print. Inclui todos os itens, fotos, histórico, avaliações.

**Export Excel:** SheetJS (CDN). 3 abas: Checklists, Respostas, Histórico.

**Domínio e-mail:** Input split (username + @domain readonly). Admin configura e troca em massa.

---

## 6. MÉTRICAS DO DASHBOARD

**Regra geral:** checklists com `reinspection_requested=true` são excluídos de TODAS as métricas, exceto reação.

| Métrica | Fórmula |
|---------|---------|
| Checklists Válidos | count WHERE NOT reinspection |
| Com Problemas | count WHERE problem_count > 0 AND NOT reinspection |
| Tempo Total Médio | avg(concluded_at - submitted_at) WHERE atendido AND NOT reinspection |
| Backlog Pendente | triagem + em_atendimento (exclui processado e reinspection) |
| Reação Média/Pior | 1ª saída de triagem - submitted_at (INCLUI reinspection) |
| Atendimento Médio/Pior | em_atendimento → atendido AND NOT reinspection |
| Desempenho Gestor | tempo atendimento médio por gestor AND NOT reinspection |

---

## 7. DEPLOY

### Caminho padrão
1. Claude gera `App.jsx` via `present_files`
2. Samuel baixa o arquivo
3. Upload no GitHub via web ("Add file → Upload files")
4. Commit na `main`
5. Vercel auto-deploy (~1min)

### Verificação
- `Vercel:list_deployments` confirma deploy
- `web_fetch_vercel_url` verifica assets

---

## 8. TROUBLESHOOTING

| Problema | Causa | Solução |
|----------|-------|---------|
| Tela branca | useState após if/return | Mover hooks para ANTES de qualquer early return |
| Toast não aparece no login | Toast renderizava só após login | Toast extraído para variável, renderiza em todas as telas |
| "Invalid login credentials" em inglês | Campo de erro variável | `.includes("Invalid login")` ao invés de `===` |
| Datas erradas (hoje/ontem) | Cálculo por horas, não calendário | `calDays()` compara datas do calendário local |
| PostgREST `or` filter falha | Encoding problemático | Filtrar em JS-side com `.filter()` |
| Views não aceitam CREATE OR REPLACE com novas colunas | PostgreSQL limitation | DROP + CREATE |
| `neq` não matcha NULL | PostgREST behavior | Usar `or=(field.eq.false,field.is.null)` ou JS filter |

---

## 9. LIÇÕES APRENDIDAS

1. React hooks NUNCA após early return
2. Views DROP+CREATE quando mudam colunas
3. PostgREST `neq` não matcha NULL
4. RPC void: `r.text()` + `JSON.parse()`
5. Motorista sem RLS UPDATE — sempre SECURITY DEFINER
6. `close_reinspection` deve manter `reinspection_requested=true`
7. `move_checklist` deve limpar concluded_at/eval quando card sai de atendido
8. Colunas reais: `label` (não description), `sort_order` (não position), `answer` (não value), `notes`
9. Toast precisa renderizar fora do bloco condicional de profile
10. Datas: comparar calendário local, não diferença em milissegundos
11. CDN jsPDF falha — usar HTML-to-print para PDF
12. Domínio: Supabase Auth já garante unicidade de e-mail
13. Free tier Storage 1GB é gargalo — Pro $25/mês resolve
14. Service Worker do PWA pode cachear versão antiga — forçar refresh
15. Introspectar schema ANTES de qualquer migração
