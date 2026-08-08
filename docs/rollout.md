# Rollout, prova de produção e rollback

Procedimento de liberação do InspecVISA, criado no **P360-015**. Vale para toda
onda daqui em diante.

A regra que organiza o documento é uma só: **nenhuma feature é declarada em
produção só porque o CI publicou.** O Vercel publica em segundos; o navegador do
cliente pode continuar servindo o bundle antigo por dias, e uma migration
aplicada no projeto errado não avisa ninguém.

---

## 1. O que existe para liberar por partes

Não há um sistema genérico de feature flags. O que existe são dois níveis, e
ambos servem de trava de rollout:

**Por tenant** — `public.client_portal_settings`, uma linha por tenant:

| Coluna | O que liga |
|---|---|
| `quick_access_enabled` | bloco de acessos rápidos do portal |
| `multi_purpose_schedule` | agenda multiuso (reunião, orientação, treinamento) |
| `action_plan_enabled` | plano de ação no portal |
| `service_requests_enabled` | solicitações de consultoria |
| `overdue_grace_days` | tolerância antes de o atraso suspender o agendamento |

Escrita pela RPC `admin_save_client_portal_settings` (e
`admin_set_portal_overdue_grace_days`).

**Por conta de cliente** — `public.client_portal_account_features`, com estado
`liberado` / `oculto` / `programado` e a trava `lock_when_overdue`. Escrita por
`admin_set_portal_feature`. A leitura é sempre por `private.portal_account_gates`,
nunca direto na tabela.

> **Estado em 08/08/2026:** no tenant de produção (`Ester Souza`) as quatro flags
> já estão ligadas. As ondas do Portal 360 foram liberadas antes de existir este
> procedimento — o valor dele é daqui em diante, mais a prova (seção 4) de que o
> que está no ar hoje é íntegro.

---

## 2. Antes de cada flag — revisão de RLS, RPC e Storage

Rodar e conferir, sem exceção:

```bash
npx tsx scripts/prod-smoke.ts
```

E no banco, pelo MCP do Supabase ou pelo editor SQL:

1. **Advisors de segurança** — `get_advisors` com `type: security`. Nenhum nível
   `ERROR` é aceitável. Os `WARN` de `security definer` executável por `anon` são
   esperados: são as RPCs do portal por token e do agendamento público.
2. **Toda tabela nova em `public` nasce com `ALL` para `anon` e `authenticated`.**
   Revogar no fim da migration. Ver a memória sobre default privileges.
3. **Toda RPC pública precisa de grant para `anon` *e* `authenticated`** — o app usa
   um cliente Supabase só; com sessão de staff aberta, a chamada pública sai como
   `authenticated`. Já quebrou em produção por isso.
4. **Storage**: bucket novo nasce privado, com `file_size_limit` e
   `allowed_mime_types`; policy sempre casando o primeiro nível da pasta com o
   `tenant_id`.

---

## 3. A sequência de uma onda

| # | Passo | Como se prova |
|---|---|---|
| 1 | Migration aplicada | `apply_migration` pelo MCP (registra no ledger sozinho) e o arquivo local renomeado com a versão que o ledger gravou. Nunca `supabase db push`. |
| 2 | CI verde | GitHub Actions no SHA que vai ser publicado: `build`, `test` e as 15 suítes SQL. |
| 3 | Deploy | Vercel, a partir do push em `main`. |
| 4 | Smoke | `npx tsx scripts/prod-smoke.ts` — confere o SHA publicado, o SHA do HTML, os cabeçalhos sem cache e a string distintiva da onda dentro dos chunks. |
| 5 | E2E | `npx playwright test` contra o ambiente publicado, com o tenant de homologação. |
| 6 | Flag | Ligar primeiro no tenant de homologação, conferir, só então no de produção. |
| 7 | Registro | Preencher a tabela da seção 6 com data/hora BRT, SHA, migration e rollback. |

**Marcador distintivo.** Ao liberar uma onda, acrescente uma linha em
`MARCADORES`, em `scripts/prod-smoke.ts`. Tem de ser uma **string literal da
interface** — nome de variável some na minificação, texto de botão não. É isso que
separa "o CI publicou" de "a feature está no ar".

---

## 4. Prova feita em 08/08/2026

Comparação do bundle publicado com o build local do SHA `33c11fd`: idênticos
byte a byte depois de normalizar os hashes dos nomes de arquivo. Todos os 65
chunks conferem, e os seis marcadores de onda estão presentes.

**Uma única diferença de conteúdo em todo o bundle**, e vale registrar porque é
uma armadilha silenciosa:

```
produção: cleanTenantId("﻿60191f17-6733-4439-9fd4-cceace47bf30")
local:    cleanTenantId("60191f17-6733-4439-9fd4-cceace47bf30")
```

A variável `VITE_DEFAULT_TENANT_ID` configurada na Vercel tem um **BOM (U+FEFF)**
no começo. Hoje não quebra nada: `cleanTenantId`, em
`src/services/publicAppointmentService.ts`, remove `﻿` explicitamente — sinal
de que alguém já tropeçou nisso antes. O risco é o próximo consumidor: quem ler
`import.meta.env.VITE_DEFAULT_TENANT_ID` sem passar por `cleanTenantId` funciona
no local e falha em produção, com um UUID que não casa com nada. Ou se limpa a
variável no painel da Vercel, ou todo leitor novo passa pela função.

---

### Os headers do `vercel.json` não estão sendo aplicados

Achado pelo próprio smoke, na primeira execução contra produção. O `vercel.json`
declara `no-cache, no-store, must-revalidate` para `/`, `/index.html`, `/sw.js` e
`/build-info.json`. Produção responde:

```
Cache-Control: public, max-age=0, must-revalidate
```

Esse é o **default da Vercel**, não o que o arquivo pede. A causa é a propriedade
legada `routes`: quando ela está presente, a Vercel ignora `headers`, `redirects`
e `rewrites`. O bloco de headers nunca valeu — e nada avisa.

**Gravidade real: baixa.** `max-age=0, must-revalidate` também obriga o navegador
a revalidar antes de reusar, então o cliente não fica preso em bundle velho. O que
se perde é a diferença entre "revalida" e "nem guarda".

**Correção proposta** (não aplicada: mexe no roteamento de produção e merece uma
janela própria) — trocar `routes` pelas propriedades modernas:

- o 308 do domínio `*.vercel.app` vira `redirects`;
- `handle: filesystem` some, porque `rewrites` já roda depois do filesystem;
- `/(.*)` → `/index.html` vira `rewrites`;
- a regra `/assets/(.*)` → 404 é a que precisa de atenção: ela existe para que um
  asset inexistente devolva 404 em vez do `index.html`, e não tem equivalente
  direto em `rewrites`. Sem ela, um navegador pedindo um chunk antigo recebe HTML
  com status 200 — que é como o app quebra com "Unexpected token '<'".

Vale conferir com o smoke depois: ele passa a exigir `no-store` de verdade.

---

## 5. Rollback

**Da flag** (segundos, sem deploy) — é sempre o primeiro recurso:

```sql
-- por tenant
select public.admin_save_client_portal_settings(
  '<tenant_id>', <tutorial_pdf_url>, <support_whatsapp>,
  <quick_access>, <multi_purpose>, <action_plan>, false  -- a flag da onda
);

-- por conta
select public.admin_set_portal_feature(
  '<account_id>', '<feature>', 'oculto', null, null, false, 'rollback P360-0XX'
);
```

As duas RPCs exigem sessão de staff do tenant: rodam pelo app, não pelo service
role.

**Da aplicação** — no painel da Vercel, *Deployments* → o deployment anterior →
*Promote to Production*. Confirmar com o smoke apontando para o SHA antigo:

```bash
npx tsx scripts/prod-smoke.ts --sha <sha-anterior>
```

**Da migration** — não há rollback automático. Toda migration que muda
comportamento precisa nascer com o `drop`/`create or replace` inverso escrito no
próprio card, antes de aplicar.

**O que o rollback de aplicação não desfaz:** o service worker já instalado no
navegador do cliente. Depois de promover a versão anterior, o cliente ainda pode
abrir a nova por um ciclo. `skipWaiting` e `clientsClaim` estão ligados, então uma
recarga resolve — mas conte com uma, não com zero.

---

## 6. Registro das liberações

| Data (BRT) | Onda | SHA | Migration | Flag ligada em | Rollback testado |
|---|---|---|---|---|---|
| 08/08/2026 15:24 | P360-015 (procedimento, sem feature de usuário) | `38987a6` | nenhuma | — | flag: sim (por RPC); aplicação: documentado |

---

## 7. Ambiente de homologação

Dois tenants dentro do projeto de produção, com ids fixos começando em
`aaaa0015` e tudo prefixado com `[HOMOLOG]`:

- `aaaa0015-0000-4000-8000-00000000000a` — **Tenant A**, com duas unidades (uma
  com pasta personalizada, outra sem), conta em dia, conta em atraso, visita
  concluída e duas pendências no plano de ação;
- `aaaa0015-0000-4000-8000-00000000000b` — **Tenant B**, uma unidade e uma conta,
  existe só para provar que um tenant não enxerga o outro.

Criar ou recriar:

```bash
psql "$DATABASE_URL" -v senha_staff="'...'" -v codigo_ok="'...'" -v codigo_atraso="'...'" -v codigo_outro="'...'" -f supabase/homolog/seed.sql
```

Apagar (confere em zero e aborta se sobrar alguma coisa):

```bash
psql "$DATABASE_URL" -f supabase/homolog/teardown.sql
```

As credenciais ficam em `.env.homolog`, fora do versionamento, e nos secrets do
GitHub para o job `e2e`. O `teardown.sql` não toca no Storage: se algum teste de
evidência tiver subido arquivo, apague os objetos cujo primeiro nível de pasta
seja um dos dois tenants.

Cada rodada do teste de reserva concorrente deixa **uma** solicitação para trás — a
que ganhou a corrida. Para limpar sem desmontar o ambiente inteiro:

```sql
delete from public.appointment_requests
where tenant_id in ('aaaa0015-0000-4000-8000-00000000000a','aaaa0015-0000-4000-8000-00000000000b')
  and unit_name like '[HOMOLOG] E2E%';
```

**O teste de reserva concorrente não passa pela tela de propósito.** A página
`/agendar` usa o `VITE_DEFAULT_TENANT_ID` do bundle, que em produção é o tenant
real — um teste de corrida pela interface criaria solicitações de verdade na
agenda da consultoria. O teste chama a RPC passando o tenant de homologação no
payload, que é o mesmo caminho de código sem o efeito colateral.

---

## 8. Rodar os testes

```bash
npm test
```

```bash
npx playwright test
```

```bash
npx tsx scripts/prod-smoke.ts
```

Contra o ambiente publicado, aponte a base:

```bash
E2E_BASE_URL=https://inspecvisa.consultorasanitaria.com.br npx playwright test
```
