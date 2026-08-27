-- Alimentos 08/2026
--
-- As duas cargas remotas abaixo são versões legadas e duplicadas. A base
-- federal auditada passa a ser o roteiro empacotado/versionado no app; os
-- requisitos do Rio entram por suplemento em código. Renomear preserva toda
-- referência histórica e apenas impede a escolha em novas inspeções.

update public.checklist_templates
set
  name = '[ARQUIVADO] Roteiro de Inspeção — Serviços de Alimentação (Nacional) — carga anterior a 08/2026',
  version = 'legado-2026'
where category = 'alimentos'
  and name = 'Roteiro de Inspeção — Serviços de Alimentação (Nacional)';

update public.checklist_templates
set
  name = '[ARQUIVADO] Roteiro de Inspeção — Serviços de Alimentação (Município RJ) — substituído por base + suplemento',
  version = 'legado-2026'
where category = 'alimentos'
  and name = 'Roteiro de Inspeção — Serviços de Alimentação (Município RJ)';
