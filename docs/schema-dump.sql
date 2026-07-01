-- ============================================
-- AXON TIKET — Schema Dump
-- Gerado em: 01/07/2026 | Fase 4.5
-- Supabase Project: slappxegoqzcmkgtpieq
-- ============================================

-- ==================== TABELAS ====================

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['motorista','gestor','admin'])),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix text NOT NULL,
  plate text NOT NULL,
  class_id uuid NOT NULL REFERENCES classes(id),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE form_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(id),
  label text NOT NULL,
  photo_rule text NOT NULL DEFAULT 'optional' CHECK (photo_rule IN ('mandatory','optional','none')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number serial,
  form_id uuid NOT NULL REFERENCES forms(id),
  equipment_id uuid NOT NULL REFERENCES equipment(id),
  driver_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'triagem' CHECK (status IN ('triagem','em_atendimento','processado','atendido')),
  assigned_to uuid REFERENCES profiles(id),
  conclusion_text text,
  conclusion_photo text,
  reinspection_requested boolean NOT NULL DEFAULT false,
  reinspection_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  concluded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  eval_status text CHECK (eval_status IN ('totalmente_atendido','parcialmente','nao_atendido')),
  eval_rating smallint CHECK (eval_rating >= 0 AND eval_rating <= 10),
  eval_notes text,
  eval_at timestamptz
);

CREATE TABLE checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES checklists(id),
  form_item_id uuid NOT NULL REFERENCES form_items(id),
  answer text NOT NULL CHECK (answer IN ('ok','problem','na')),
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE checklist_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES checklists(id),
  action text NOT NULL,
  from_status text,
  to_status text,
  performed_by uuid NOT NULL,
  performed_by_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Valor padrão
INSERT INTO settings (key, value) VALUES ('email_domain', 'axontiket.com');

-- ==================== VIEWS ====================

CREATE VIEW v_checklist_items AS
SELECT cr.id, cr.checklist_id, cr.answer, cr.photo_url, cr.notes,
  fi.label, fi.sort_order, fi.photo_rule
FROM checklist_responses cr
JOIN form_items fi ON fi.id = cr.form_item_id
ORDER BY fi.sort_order;

CREATE VIEW v_kanban AS
SELECT c.id, c.ticket_number, c.status, c.submitted_at, c.concluded_at, c.conclusion_text,
  c.reinspection_requested, c.reinspection_notes, c.assigned_to,
  c.eval_status, c.eval_rating, c.eval_notes, c.eval_at,
  e.prefix AS equipment_prefix, e.plate AS equipment_plate,
  cl.name AS class_name, f.name AS form_name,
  d.name AS driver_name, d.id AS driver_id,
  g.name AS assigned_to_name,
  (SELECT count(*) FROM checklist_responses cr WHERE cr.checklist_id=c.id AND cr.answer='problem') AS problem_count,
  (SELECT count(*) FROM checklist_responses cr WHERE cr.checklist_id=c.id) AS total_items
FROM checklists c
JOIN equipment e ON e.id=c.equipment_id
JOIN classes cl ON cl.id=e.class_id
JOIN forms f ON f.id=c.form_id
JOIN profiles d ON d.id=c.driver_id
LEFT JOIN profiles g ON g.id=c.assigned_to
ORDER BY c.submitted_at DESC;

CREATE VIEW v_driver_history AS
SELECT c.id, c.ticket_number, c.status, c.submitted_at, c.concluded_at, c.conclusion_text,
  c.reinspection_requested, c.reinspection_notes,
  c.eval_status, c.eval_rating, c.eval_notes, c.eval_at,
  c.assigned_to, e.prefix AS equipment_prefix, e.plate AS equipment_plate,
  f.name AS form_name, c.driver_id, g.name AS gestor_name,
  (SELECT count(*) FROM checklist_responses cr WHERE cr.checklist_id=c.id AND cr.answer='problem') AS problem_count
FROM checklists c
JOIN equipment e ON e.id=c.equipment_id
JOIN forms f ON f.id=c.form_id
LEFT JOIN profiles g ON g.id=c.assigned_to
ORDER BY c.submitted_at DESC;

-- ==================== RLS ====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY profiles_insert_managed ON profiles FOR INSERT WITH CHECK (
  is_admin() OR (
    (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'gestor' AND role = 'motorista'
  )
);
CREATE POLICY profiles_update_managed ON profiles FOR UPDATE USING (
  is_admin() OR (
    (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'gestor' AND role = 'motorista'
  )
) WITH CHECK (
  is_admin() OR (
    (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'gestor' AND role = 'motorista'
  )
);

-- classes, equipment, forms, form_items (padrão: SELECT public, INSERT/UPDATE/DELETE gestor)
CREATE POLICY classes_select ON classes FOR SELECT USING (true);
CREATE POLICY classes_insert ON classes FOR INSERT WITH CHECK (is_gestor());
CREATE POLICY classes_update ON classes FOR UPDATE USING (is_gestor());

CREATE POLICY equipment_select ON equipment FOR SELECT USING (true);
CREATE POLICY equipment_insert ON equipment FOR INSERT WITH CHECK (is_gestor());
CREATE POLICY equipment_update ON equipment FOR UPDATE USING (is_gestor());

CREATE POLICY forms_select ON forms FOR SELECT USING (true);
CREATE POLICY forms_insert ON forms FOR INSERT WITH CHECK (is_gestor());
CREATE POLICY forms_update ON forms FOR UPDATE USING (is_gestor());

CREATE POLICY form_items_select ON form_items FOR SELECT USING (true);
CREATE POLICY form_items_insert ON form_items FOR INSERT WITH CHECK (is_gestor());
CREATE POLICY form_items_update ON form_items FOR UPDATE USING (is_gestor());
CREATE POLICY form_items_delete ON form_items FOR DELETE USING (is_gestor());

-- checklists
CREATE POLICY checklists_select_driver ON checklists FOR SELECT USING (driver_id = auth.uid());
CREATE POLICY checklists_select_gestor ON checklists FOR SELECT USING (is_gestor());
CREATE POLICY checklists_insert_driver ON checklists FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY checklists_update_gestor ON checklists FOR UPDATE USING (is_gestor());

-- checklist_responses
CREATE POLICY responses_select_driver ON checklist_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM checklists c WHERE c.id = checklist_responses.checklist_id AND c.driver_id = auth.uid())
);
CREATE POLICY responses_select_gestor ON checklist_responses FOR SELECT USING (is_gestor());
CREATE POLICY responses_insert ON checklist_responses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM checklists c WHERE c.id = checklist_responses.checklist_id AND c.driver_id = auth.uid())
);

-- checklist_history
CREATE POLICY history_select_driver ON checklist_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM checklists c WHERE c.id = checklist_history.checklist_id AND c.driver_id = auth.uid())
);
CREATE POLICY history_select_gestor ON checklist_history FOR SELECT USING (is_gestor());
CREATE POLICY history_insert ON checklist_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- settings
CREATE POLICY settings_select ON settings FOR SELECT USING (true);
CREATE POLICY settings_insert_admin ON settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY settings_update_admin ON settings FOR UPDATE USING (is_admin());

-- ==================== FUNCTIONS (resumo) ====================
-- Nota: definições completas das functions estão nas migrações do Supabase.
-- Todas são SECURITY DEFINER e LANGUAGE plpgsql.

-- is_gestor() → true para gestor e admin
-- is_admin() → true só para admin
-- handle_new_user() → trigger em auth.users, cria profile
-- handle_updated_at() → trigger para updated_at
-- move_checklist(checklist_id, new_status, ...) → move card, limpa eval ao sair de atendido
-- request_reinspection(checklist_id, ...) → gestor pede re-inspeção
-- close_reinspection(old_id, ...) → fecha antigo mantendo reinspection_requested=true
-- submit_evaluation(checklist_id, status, rating, notes) → motorista avalia
-- get_dashboard(p_days) → JSONB com todas métricas (exclui reinspeção exceto reação)
-- get_driver_dashboard(driver_id, p_days) → JSONB dashboard motorista
-- get_audit_report(driver_id, from, to) → JSONB completo para PDF/Excel
-- reset_user_password(target_id, pw) → hierarquia: gestor→motorista, admin→todos
-- update_user_email(target_id, email) → atualiza auth.users + profiles
-- change_email_domain(old, new) → troca em massa (admin)
-- get_setting(key) → leitura de settings

-- ==================== TRIGGERS ====================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- handle_updated_at aplicado em: profiles, classes, equipment, forms, form_items, checklists

-- ==================== STORAGE ====================

-- Bucket: checklist-photos (public read, authenticated write)
-- RLS: INSERT/UPDATE com bucket_id = 'checklist-photos' AND auth.uid() IS NOT NULL
