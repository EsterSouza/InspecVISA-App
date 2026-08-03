# Handoff — pendências pós P360-007

Cards que **não** foram executados na sessão do P360-007. Cada um é autossuficiente:
dá para abrir uma sessão nova (Sonnet 5 dá conta de todos) sem ler o histórico.

Contexto mínimo comum a todos:

- Repo: `C:\Users\miche\OneDrive - MSFT\TreinaVISA\App`, branch `main`.
- Stack: React 19 + Vite + TypeScript, Supabase (Postgres + RPCs `security definer`), deploy na Vercel
  em `inspecvisa.consultorasanitaria.com.br`, disparado por push na `main`.
- Supabase de produção: project ref `pfjacmawaigndqclgvpn`. Tenant principal:
  `60191f17-6733-4439-9fd4-cceace47bf30`.
- O app usa **um único cliente Supabase** (`src/lib/supabase.ts`) para o app interno e para as
  páginas públicas. Consequência: se houver sessão de staff no navegador, as RPCs públicas são
  chamadas com papel `authenticated`, não `anon`. Toda RPC pública precisa de grant para **os dois**.
- Testes: `npm test` (vitest). Os testes SQL em `supabase/tests/*.test.sql` rodam em Postgres puro:

  ```bash
  docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test postgres:16-alpine
  ```

  Depois `docker cp supabase pgtest:/work` e
  `MSYS_NO_PATHCONV=1 docker exec -w //work/tests pgtest psql -U postgres -d test -v ON_ERROR_STOP=1 -f <arquivo>.test.sql`.
  Os cinco arquivos de teste passam hoje.

---

## Card A — `client_portal_payment_acknowledge` não existe (o botão sempre dá erro)

**Prioridade: alta.** É um erro visível para o cliente pagante.

`src/services/clientPortalService.ts:243` chama
`supabase.rpc('client_portal_payment_acknowledge', { p_token, p_note, p_user_agent })`.
Essa função **não existe em nenhuma migration do repositório nem no banco de produção** — confirmado por:

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'client_portal_payment_acknowledge';
-- 0 linhas
```

`acknowledgePayment` propaga o erro, e `ClientPortal.tsx` (`handlePaymentAcknowledgement`) mostra a
mensagem no lugar de confirmar. Ou seja: o cliente clica em "avisar pagamento" e recebe erro.

**O que fazer**

1. Escrever a migration criando a função, no molde de `client_portal_audit_event` do Card B:
   valida `p_token` contra `public.client_portal_accounts` (`portal_token = p_token and is_active`),
   registra o aviso e retorna `jsonb`. Decidir com a Ester **onde** registrar — provavelmente uma
   coluna `payment_acknowledged_at` em `client_portal_accounts` mais uma linha de auditoria.
2. `security definer`, `set search_path = ''`, no padrão dos arquivos em `supabase/migrations/`.
3. Grants: `revoke all ... from public` e `grant execute ... to anon, authenticated`
   (os dois, pelo motivo do contexto acima).
4. Teste SQL novo em `supabase/tests/`, no molde de `public_briefing_only.test.sql`.
5. **Perguntar antes de aplicar em produção.**

Alternativa mais barata, se a Ester não quiser o recurso: remover o botão e o método do serviço.
Vale confirmar com ela qual dos dois caminhos.

---

## Card B — auditoria do portal não grava nada (lacuna de LGPD)

**Prioridade: média-alta.**

`src/services/clientPortalService.ts:206` (`audit`) chama `client_portal_audit_event`. A função e a
tabela `client_portal_audit_events` **não existem em produção**. Como o `catch` só faz
`console.warn`, o app parece funcionar: login, visualização de painel, download de relatório e
aviso de pagamento **não deixam rastro nenhum**.

A migration local existe e nunca foi aplicada: `supabase/migrations/20260613125641_client_portal_audit.sql`.

**O que fazer**

1. Ler a migration inteira e conferir se ela ainda casa com o schema atual — ela é de junho/2026 e
   várias migrations posteriores redefiniram tabelas do portal. Atenção especial a colunas de
   `appointment_requests` e `client_portal_accounts` que possam ter mudado.
2. Rodar no Postgres descartável (comandos no topo) **antes** de qualquer coisa em produção.
3. Conferir os grants: precisa de `anon` **e** `authenticated`.
4. Confirmar que os `ClientPortalAuditEventType` usados no frontend batem com o `check` da tabela.
   Fonte: `src/types/index.ts` (buscar `ClientPortalAuditEventType`).
5. **Perguntar antes de aplicar em produção.**

---

## Card C — reconciliar o ledger de migrations com o Supabase remoto

**Prioridade: média.** É a causa dos cards A e B passarem despercebidos.

O histórico remoto (`supabase_migrations.schema_migrations`) não bate com `supabase/migrations/`:

- Sete arquivos locais não constam no remoto, entre eles `20260611091522_client_portal_access_email_calendar`,
  `20260611101800_client_portal_access_links_and_folder`, `20260611132931_persist_consultant_settings`,
  `20260611202749_lock_down_public_portal_token_access`, `20260612101234_portal_account_contact_and_payment_due_date`,
  `20260612113611_client_contacts_and_payment_links` e `20260613125641_client_portal_audit`.
- Outros foram aplicados sob versões diferentes: `20260709060000` virou `20260709082424`,
  `20260717090000` virou `20260717135804`, e o P360-006 foi registrado como
  versão `20260803162735` com o nome `20260802115342_portal_public_request_purpose`.
- Existe ainda uma pasta legada `migrations/` na raiz (numeração `001_`, `002_`…), separada de
  `supabase/migrations/`. Vale documentar se ela está morta.

**O que fazer**

1. Levantar, arquivo por arquivo, se o **conteúdo** já está no banco (comparando funções, colunas e
   constraints reais), e não só se a versão consta no ledger. Muitos foram aplicados por outro
   caminho e sobrescritos por migrations posteriores.
2. Produzir uma tabela em `docs/` com: arquivo local → aplicado? → sob qual versão → observação.
3. **Não** aplicar nada em massa. Cada aplicação precisa de decisão individual — várias dessas
   migrations recriam funções que foram redefinidas depois, e reaplicar reverteria comportamento.
4. Só depois, decidir se vale realinhar as versões (`supabase migration repair`) ou apenas documentar.

Ferramenta útil: MCP Supabase `list_migrations` e `execute_sql` (somente leitura para o levantamento).

---

## Card D — margem pública de 4 horas é a mesma para inspeção de 12 h e briefing de 15 min

**Prioridade: baixa.** É uma decisão de produto, não um defeito.

`private.appointment_has_conflict` recebe `p_public_buffer interval` e as RPCs públicas passam
sempre `interval '4 hours'` (ver `supabase/migrations/20260802105852_appointment_availability_intervals.sql`).
A margem foi pensada para inspeção presencial, que envolve deslocamento das consultoras. Aplicada a
um briefing online de 15 min, ela bloqueia mais de 8 horas de agenda em volta de um compromisso curto.

Não foi mexido de propósito: fazer certo exige margem **por registro** (o que está sendo bloqueado),
não por chamada — a assinatura atual só sabe a margem de quem está consultando.

**O que fazer, se a Ester priorizar**

1. Levar a margem para uma coluna/derivação por `appointment_type` (ex.: inspeção 4 h, demais 30 min)
   e fazer `appointment_has_conflict` usar a margem do **registro existente**, não um parâmetro único.
2. Cuidado com o caso real: briefing online logo após uma inspeção presencial — a consultora pode
   ainda estar em deslocamento. A margem grande precisa continuar valendo do lado da inspeção.
3. Cobrir em `supabase/tests/appointment_availability.test.sql`, que já tem casos de margem.

---

## Card E — dívida de lint (425 erros, 10 avisos)

**Prioridade: baixa, mas é bloqueio para colocar lint no CI.**

`npm run lint` falha no projeto inteiro, majoritariamente `@typescript-eslint/no-explicit-any`.
Não tem relação com o P360-006/007 — os arquivos tocados nesses cards passam limpos
(`npx eslint src/pages/PublicSchedule.tsx src/utils/appointmentType.ts src/utils/publicAppointmentForm.ts src/services/publicAppointmentService.ts`
retorna 0 erros).

**O que fazer**

1. `npx eslint . -f json` e agrupar por regra e por diretório para dimensionar.
2. Atacar por fatia, começando por `src/services/` (onde `any` esconde erro de contrato com o Supabase).
   Um PR por fatia, sem misturar com mudança de comportamento.
3. Só ligar o lint no CI quando a fatia estiver zerada; até lá, um `--max-warnings` por diretório
   já evita regressão.

---

## Card F — outras pontas soltas observadas

- **`sala-estetica.html` na raiz** importa `three`, `three/addons/...`, que não estão no
  `package.json`. O `vite dev` loga erro de resolução toda vez. Ou instalar a dependência, ou tirar o
  arquivo do escopo do Vite, ou removê-lo.
- **`public/` ainda pesa ~1,3 MB** depois da limpeza do P360-007. Restam `pwa-512x512.png` (376 KB) e
  `pwa-maskable-512.png` (188 KB), que são grandes para ícones — dá para comprimir sem perda visível.
- **`globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` em `vite.config.ts:35`** faz o service
  worker pré-carregar **todo** PNG do build. Vale restringir para os ícones do PWA, senão qualquer
  imagem nova volta a inflar o precache silenciosamente.
- **Arquivos de negócio soltos na raiz** (`ROI ILPI 2024.pdf`, `ROI estetica II.pdf`,
  `ROI ESTÉTICA II.xlsx`, `Inspecao_REDE_SENIOR_*.pdf`, `5-repos-claude-code.pdf`,
  `inspec-visa-backup-2026-05-16.json`). A Ester optou por mantê-los. Se um dia quiser limpar,
  o destino natural é `docs/` ou fora do repo.
