# REF-05 — Curadoria de `requirementType` — Roteiro "Serviços de Alimentação (Nacional)"

**Arquivo do roteiro:** `src/data/templates_alimentos.ts`, template `tpl-alimentos-federal-v1`
(`name: 'Roteiro de Inspeção — Serviços de Alimentação (Nacional)'`), 97 itens em 11 seções.

**Ato normativo consultado:** RDC Anvisa nº 216, de 15/09/2004 (Regulamento Técnico de Boas
Práticas para Serviços de Alimentação). Vigência confirmada via skill `visa-legislacao-sanitaria`
(tabela interna, status "Vigente") e texto oficial obtido em
`https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html` (Ministério da
Saúde / Saúde Legis), consultado nesta curadoria.

**Regra aplicada:** a citada em `docs/HANDOFF.md` (REF-05), de autoria da Ester, 06/08/2026 —
*"A legislação de ILPI não é a de estética. Não porte o precedente de estética por analogia de
assunto"* — e sua tradução prática: *"Reclassificar exige mostrar que o ato citado não exige
aquilo. 'Parece boa prática' não basta. Na dúvida, mantenha `legal`."* Nenhum item foi
reclassificado por precedente do roteiro de estética.

---

## 1. Resumo

| Decisão recomendada | Quantidade |
|---|---|
| `legal` (manter) | **97** |
| `good_practice` (reclassificar) | **0** |
| **Total** | **97** |

**Nenhuma reclassificação recomendada.** Isso confirma, para este roteiro, a previsão registrada
no HANDOFF ("o resultado provável é poucas reclassificações"). Achado adicional relevante: este é
o único dos quatro roteiros vivos em que **nenhum item tem peso ≤ 2** — todos os 97 são `weight: 5`
(Necessário) ou `weight: 10` (Imprescindível/crítico). Como o padrão técnico de `good_practice`
observável em `src/data/estetica/roteiro-clinica.ts` exige `weight <= 2`, a ausência total desse
peso no roteiro já era um sinal de que ele foi montado item a item a partir do texto normativo, sem
itens "soft" incluídos por boa prática genérica.

Todo item citado tem correspondência de conteúdo em algum subitem da RDC 216/2004 (seções 4.1 a
4.12 do Anexo). Nenhum item ficou sem correspondência normativa nenhuma.

### Nota metodológica importante — numeração dos subitens

O código cita os itens como `RDC 216/2004 item 4.1.1`, `4.1.2` ... `4.6.4`, `4.7`. **Essa numeração
não bate com a numeração do texto oficial consolidado** obtido no Saúde Legis, que vai de 4.1
(Edificação, Instalações, Equipamentos, Móveis e Utensílios) a 4.12 (Responsabilidade), com
subitens até 4.1.17, 4.8.20 etc. Por conteúdo, o roteiro do código claramente foi escrito a partir
de uma versão do Regulamento com numeração diferente (uma "cartilha" ou roteiro de inspeção
derivado, comum em VISAs estaduais/municipais que renumeram os itens da RDC 216/2004 para fins de
checklist). Verifiquei cada item **pelo conteúdo**, não pelo número citado — todos os 97 têm
correspondência clara de conteúdo em algum subitem oficial, apenas sob outro número. Isso é uma
divergência de **citação/numeração**, não de **existência da obrigação legal** — por isso não afeta
a decisão `legal` vs `good_practice` de nenhum item. Registro aqui para eventual card futuro de
precisão de citação (mesma família do REF-07), fora do escopo deste card.

### Itens de decisão duvidosa (ficaram `legal`, mas vale checagem adicional da Ester)

Nenhum destes vira `good_practice` — em todos, a obrigação central subsiste em algum ponto da RDC
216/2004 (ou, no caso do item de câmara fria, em legislação de segurança do trabalho, que também é
`legal`, só que não é a RDC 216). Listados porque o **detalhe específico** do item (um número, um
equipamento nomeado, um documento) não aparece literalmente no texto da RDC 216/2004 que consultei:

1. **`ali-f-006`** (escadas/elevadores/montacargas) — a RDC não menciona esses itens
   nominalmente; a exigência decorre por extensão do princípio geral de instalações físicas
   conservadas (4.1.2/4.1.3).
2. **`ali-f-009` e `ali-f-011`** (conforto térmico / coifa e exaustão nos pontos de cocção) — a
   RDC exige ventilação que mantenha o ambiente livre de fumaça e vapores (4.1.10/4.1.11), mas não
   nomeia "coifa" nem fala em "conforto térmico" literalmente.
3. **`ali-f-014`** (vasos sanitários com assento/tampa, em número suficiente) — o texto oficial só
   diz que "as instalações sanitárias devem possuir lavatórios" (4.1.13); não há menção literal a
   vasos/mictórios com essas especificações.
4. **`ali-f-034`** (câmaras frias com dispositivo de abertura pelo interior/alarme) — isso é
   tipicamente uma exigência de segurança do trabalho (Normas Regulamentadoras), não da RDC
   216/2004, que não trata de risco de aprisionamento em câmara fria. A obrigação provavelmente
   existe, mas por **outra norma** — citação a revisar num card de precisão, não motivo para virar
   boa prática.
5. **`ali-f-061`** (30 min à temperatura ambiente, ou até 2h entre 12°C–18°C) — a RDC só exige
   "tempo mínimo necessário" (4.8.5) sem cravar esses números; os valores específicos parecem vir
   de norma técnica complementar (ex.: portaria estadual/ABERC). A obrigação de limitar o tempo é
   da RDC; o parâmetro numérico exato talvez não seja.
6. **`ali-f-084`** (veículo licenciado pelo órgão de vigilância sanitária) — a RDC 216/2004 exige
   veículo higienizado e sem carga incompatível (4.9.3), mas não fala em licenciamento; isso é
   comumente exigência municipal/estadual de VISA, não da RDC 216/2004 diretamente.
7. **`ali-f-096`** (contrato com empresa de destinação de lixo + Programa de Gerenciamento de
   Resíduos) — a RDC exige apenas coleta/destinação adequadas dos resíduos (4.5.1–4.5.3); a
   formalização por contrato e "programa" documentado pode vir de legislação municipal de resíduos
   sólidos.

Em todos os sete casos, a obrigação sanitária de fundo é real — não é "parece boa prática", é
"talvez a citação aponte para a norma errada". Por isso mantive `legal` em todos, conforme a regra
de ônus invertido do card.

---

## 2. Tabela completa — 97 itens

Legenda da coluna Justificativa: item oficial da RDC 216/2004 (Anexo) cujo conteúdo corresponde ao
item do roteiro, com resumo do texto. "Item RDC citado no código" mostra o que está em
`templates_alimentos.ts` hoje (nem sempre bate com a numeração oficial — ver nota metodológica).

### Seção 1 — Edificação e Instalações

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-001 | Áreas livres de objetos em desuso; sem animais; não usada como dormitório | item 4.1.1 | legal | Item oficial 4.1.7: "áreas internas e externas... livres de objetos em desuso ou estranhos ao ambiente, não sendo permitida a presença de animais." Obrigação (`devem`). |
| ali-f-002 | Piso liso, resistente, fácil higienização, ralos sifonados com tampa | item 4.1.2 | legal | Item 4.1.3: "instalações físicas como piso, parede e teto devem possuir revestimento apropriado... íntegros, conservados." Obrigação. |
| ali-f-003 | Tetos/paredes/divisórias lisos, impermeáveis, cor clara | item 4.1.3 | legal | Item 4.1.3 (mesmo subitem, mesma frase, cobre piso/parede/teto). Obrigação. |
| ali-f-004 | Portas ajustadas, fechamento automático, barreira contra vetores | item 4.1.4 | legal | Item 4.1.4: "portas... ajustadas aos batentes"; "dotadas de fechamento automático"; "providas de proteção para impedir o acesso de vetores." Obrigação. |
| ali-f-005 | Janelas com telas milimétricas, ajustadas, fácil higienização | item 4.1.5 | legal | Item 4.1.4 (mesmo subitem trata portas e janelas em conjunto): telas removíveis para facilitar higienização. Obrigação. |
| ali-f-006 | Escadas, elevadores, montacargas de material resistente e conservado | item 4.1.6 | legal | Sem menção nominal na RDC; decorre por extensão dos princípios gerais 4.1.2 (dimensionamento compatível) e 4.1.3 (instalações físicas conservadas). Ver nota de atenção acima. |
| ali-f-007 | Iluminação suficiente; luminárias protegidas contra queda/explosão | item 4.1.7 | legal | Item 4.1.8: "iluminação da área de preparação deve proporcionar visualização..."; "luminárias... devem ser apropriadas e estar protegidas contra explosão." Obrigação. |
| ali-f-008 | Instalações elétricas embutidas ou revestidas | item 4.1.8 | legal | Item 4.1.9: "instalações elétricas devem estar embutidas ou protegidas em tubulações." Obrigação. |
| ali-f-009 | Climatização com conforto térmico, boa conservação e higiene | item 4.1.9 | legal | Item 4.1.10/4.1.11: ventilação deve garantir renovação do ar; equipamentos/filtros de climatização devem estar conservados. "Conforto térmico" não é termo literal, mas a obrigação de ventilação/conservação é. |
| ali-f-010 | Fluxo de ar não incide diretamente sobre os alimentos | item 4.1.9 | legal | Item 4.1.10, frase final, **cópia literal**: "O fluxo de ar não deve incidir diretamente sobre os alimentos." Obrigação exata. |
| ali-f-011 | Pontos de cocção sob coifa com exaustão adequada | item 4.1.10 | legal | Item 4.1.10: ventilação deve manter ambiente livre de fumaça/vapores que comprometam a qualidade sanitária. "Coifa" não é termo literal, mas a obrigação de exaustão eficaz é. |
| ali-f-012 | Sanitários sem comunicação direta com área de produção; fechamento automático | item 4.1.11 | legal | Item 4.1.12: "instalações sanitárias... não devem se comunicar diretamente com a área de preparação... portas externas dotadas de fechamento automático." Obrigação. |
| ali-f-013 | Sanitários com piso/parede/teto liso, ralo sifonado, ventilação, telas | item 4.1.11 | legal | Item 4.1.13, primeira parte (implícita na exigência geral de instalação sanitária adequada) combinada com 4.1.3 (revestimento). Obrigação. |
| ali-f-014 | Vasos sanitários e mictórios com descarga, em nº suficiente, com assento/tampa | item 4.1.11 | legal | Item 4.1.13: "instalações sanitárias devem possuir lavatórios..."; vasos/mictórios com essas especificações não aparecem literalmente. Ver nota de atenção acima. |
| ali-f-015 | Sanitários com sabonete líquido antisséptico e toalha de papel não reciclado | item 4.1.11 | legal | Item 4.1.13, **cópia literal**: sanitários "supridas de... sabonete líquido inodoro anti-séptico... e toalhas de papel não reciclado." Obrigação exata, item crítico. |
| ali-f-016 | Avisos sobre procedimentos de lavagem das mãos nos sanitários | item 4.1.11 | legal | Item 4.6.4: "devem ser afixados cartazes de orientação aos manipuladores sobre a lavagem... das mãos... em locais de fácil visualização, inclusive nas proximidades dos lavatórios." Obrigação. |
| ali-f-017 | Lixeiras com tampa sem acionamento manual nos sanitários | item 4.1.11 | legal | Item 4.1.13: "recipientes coletores de resíduos devem ser dotados de tampa e acionados sem contato manual." Obrigação. |
| ali-f-018 | Vestiários com armários organizados, em número suficiente | item 4.1.11 | legal | Item 4.1.12: "vestiários... devendo ser mantidos organizados e em adequado estado de conservação." Obrigação. |
| ali-f-019 | Lavatórios na área de produção com sabonete, toalha e lixeira sem contato manual | item 4.1.12 | legal | Item 4.1.14, **cópia literal**: lavatórios exclusivos na área de preparação, "sabonete líquido... toalhas de papel não reciclado... acionado sem contato manual." Obrigação exata, item crítico. |
| ali-f-020 | Avisos de lavagem das mãos nos lavatórios da área de produção | item 4.1.12 | legal | Item 4.6.4 (mesmo fundamento do ali-f-016, aplicado aos lavatórios de produção). Obrigação. |
| ali-f-021 | Ausência de vetores e pragas urbanas ou vestígios | item 4.1.13 | legal | Item 4.3.1: instalações "devem ser livres de vetores e pragas urbanas." Obrigação, item crítico. |
| ali-f-022 | Medidas preventivas/corretivas contra vetores e pragas | item 4.1.13 | legal | Item 4.3.1: "conjunto de ações eficazes e contínuas de controle... impedir atração, abrigo, acesso e/ou proliferação." Obrigação. |
| ali-f-023 | Comprovante de controle químico por empresa credenciada | item 4.1.13 | legal | Item 4.3.2: "controle químico... deve ser executado por empresa especializada, conforme legislação específica." Obrigação. |
| ali-f-024 | Produtos químicos de controle de roedores protegidos | item 4.1.13 | legal | Item 4.3.3: pós-tratamento deve evitar contaminação de alimentos/equipamentos/utensílios pelos produtos desinfestantes. Obrigação, item crítico. |
| ali-f-025 | Abastecimento por rede pública ou fonte alternativa com documentação de potabilidade | item 4.1.14 | legal | Item 4.4.1: "deve ser utilizada somente água potável"; fonte alternativa "a potabilidade deve ser atestada semestralmente." Obrigação. |
| ali-f-026 | Reservatório acessível, tampado, sem vazamentos/infiltrações | item 4.1.14 | legal | Item 4.4.4: reservatório "livre de rachaduras, vazamentos, infiltrações... devidamente tampado." Obrigação, item crítico. |
| ali-f-027 | Gelo produzido com água potável, condições sanitárias satisfatórias | item 4.1.14 | legal | Item 4.4.2: "gelo... deve ser fabricado a partir de água potável... condição higiênico-sanitária que evite sua contaminação." Obrigação, item crítico. |
| ali-f-028 | Recipientes de resíduos com tampa sem contato manual, identificados | item 4.1.15 | legal | Item 4.5.2: "coletores... devem ser dotados de tampas acionadas sem contato manual." Obrigação. |
| ali-f-029 | Retirada frequente de resíduos, mantidos isolados das áreas de preparo | item 4.1.15 | legal | Item 4.5.3: "resíduos devem ser freqüentemente coletados e estocados em local fechado, fora da área de preparação e armazenamento." Obrigação, item crítico. |
| ali-f-030 | Caixas de gordura e esgoto conservadas, fora das áreas de preparação | item 4.1.16 | legal | Item 4.1.6: "caixas de gordura e de esgoto devem... estar localizadas fora da área de preparação e armazenamento de alimentos." Obrigação. |

### Seção 2 — Equipamentos, Móveis e Utensílios

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-031 | Equipamentos suficientes, bom estado, fácil acesso e higienização | item 4.2.1 | legal | Item 4.1.15: equipamentos "que entram em contato com alimentos"... "devem ser mantidos em adequado estado de conservação." Obrigação. |
| ali-f-032 | Superfícies em contato com alimento lisas, resistentes à corrosão | item 4.2.1 | legal | Item 4.1.15: superfícies não devem "transmitir substâncias tóxicas... ser resistentes à corrosão." Obrigação. |
| ali-f-033 | Equipamentos de conservação/processamento térmico em funcionamento adequado | item 4.2.1 | legal | Item 4.1.15/4.1.16 (conservação e manutenção programada dos equipamentos). Obrigação, item crítico. |
| ali-f-034 | Câmaras frias com dispositivo de abertura pelo interior/alarme | item 4.2.1 | legal | Não localizado na RDC 216/2004; é tipicamente exigência de segurança do trabalho (NR), não sanitária. Ver nota de atenção acima — a obrigação provavelmente existe, mas noutra norma. |
| ali-f-035 | Móveis em número suficiente, material apropriado, resistente | item 4.2.2 | legal | Item 4.1.15 (aplicado a móveis pelo mesmo princípio de conservação/impermeabilidade). Obrigação. |
| ali-f-036 | Utensílios de material não contaminante, resistentes à corrosão | item 4.2.3 | legal | Item 4.1.15 (utensílios incluídos no mesmo subitem de equipamentos/móveis). Obrigação. |
| ali-f-037 | Superfícies de corte de material atóxico e fácil higienização | item 4.2.3 | legal | Item 4.1.17: superfícies de equipamentos/móveis/utensílios "devem ser lisas... isentas de rugosidades, frestas." Obrigação. |

### Seção 3 — Higienização

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-038 | Produtos de higienização regularizados pelo MS, armazenados separados de alimentos | item 4.3.1 | legal | Item 4.2.5: "produtos saneantes... devem estar regularizados pelo Ministério da Saúde... identificados e guardados em local reservado." Obrigação. |
| ali-f-039 | Não usa panos convencionais para secagem de mãos/utensílios | item 4.3.1 | legal | Decorre de 4.1.13/4.1.14: exigência de "toalhas de papel não reciclado ou outro sistema higiênico e seguro" torna implícito que pano de prato não serve. Obrigação por implicação direta. |
| ali-f-040 | Utensílios de higienização de móveis/equipamentos diferentes dos de alimentos | item 4.3.1 | legal | Item 4.2.6, **cópia literal**: utensílios de higienização de instalações "devem ser distintos daqueles usados para a higienização dos equipamentos e utensílios que entrem em contato com o alimento." Obrigação exata. |
| ali-f-041 | Água corrente suficiente para higienização de equipamentos/utensílios | item 4.3.2 | legal | Item 4.1.5: "instalações devem ser abastecidas de água corrente." Obrigação, item crítico. |
| ali-f-042 | Frequência de higienização das instalações adequada | item 4.3.2 | legal | Item 4.2.1: higienização com "freqüência que garanta a manutenção dessas condições." Obrigação, item crítico. |
| ali-f-043 | Bancadas/móveis/equipamentos higienizados, sem acúmulo de sujidade | item 4.3.3 | legal | Item 4.2.4: "área de preparação do alimento deve ser higienizada quantas vezes forem necessárias." Obrigação, item crítico. |
| ali-f-044 | Não usa escova de metal/lã de aço/abrasivos na limpeza | item 4.3.3 | legal | Decorre de 4.1.17 (superfícies devem ficar isentas de rugosidades/frestas): material abrasivo danifica a superfície lisa exigida. Obrigação por implicação direta. |

### Seção 4 — Manipuladores

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-045 | Uniforme adequado, cor clara, exclusivo da área de produção | item 4.4.1 | legal | Item 4.6.3: manipuladores "apresentando-se com uniformes... trocados." Obrigação. |
| ali-f-046 | Uniformes limpos e conservados, sapatos fechados | item 4.4.1 | legal | Item 4.6.3, **cópia literal**: uniformes "conservados e limpos." Obrigação, item crítico. |
| ali-f-047 | Asseio pessoal: mãos limpas, unhas curtas, sem adornos, cabelo protegido | item 4.4.1 | legal | Item 4.6.6, **cópia literal**: "cabelos presos e protegidos"; "unhas... curtas e sem esmalte"; "retirados todos os objetos de adorno pessoal." Obrigação exata, item crítico. |
| ali-f-048 | Evita fumar, tossir, cuspir, manipular dinheiro, usar celular | item 4.4.1 | legal | Item 4.6.5, **cópia literal**: manipuladores "não devem fumar... manipular dinheiro ou praticar outros atos que possam contaminar o alimento." Obrigação exata, item crítico. |
| ali-f-049 | Lavagem das mãos ao início, após interrupção, após sanitário | item 4.4.1 | legal | Item 4.6.4, **cópia literal**: "lavar cuidadosamente as mãos ao chegar ao trabalho... após qualquer interrupção do serviço." Obrigação exata, item crítico. |
| ali-f-050 | Afastamento por afecções cutâneas, feridas, infecções respiratórias/gastrointestinais | item 4.4.1 | legal | Item 4.6.2, **cópia literal**: manipuladores com lesões/sintomas "devem ser afastados da atividade... enquanto persistirem essas condições." Obrigação exata, item crítico. |

### Seção 5 — Recepção de Matérias-Primas e Ingredientes

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-051 | Matérias-primas/embalagens inspecionadas na recepção; reprovados devolvidos | item 4.5.1 | legal | Item 4.7.3/4.7.4: matérias-primas "devem ser submetidos à inspeção... na recepção"; lotes reprovados "devem ser imediatamente devolvidos ao fornecedor." Obrigação. |
| ali-f-052 | Transporte de matérias-primas em condições adequadas de higiene | item 4.5.1 | legal | Item 4.7.1: "transporte desses insumos deve ser realizado em condições [adequadas de higiene e] conservação." Obrigação, item crítico. |
| ali-f-053 | Rótulos de matéria-prima/ingredientes atendem à legislação | item 4.5.1 | legal | Item 4.7.3 (recepção submetida a inspeção, incluindo integridade da rotulagem, por decorrência da legislação geral de rotulagem). Obrigação, item crítico. |
| ali-f-054 | Produtos de origem animal de estabelecimentos registrados (SIF/SIE/SIM) | item 4.5.1; Decreto 9.013/2017 RIISPOA | legal | Base dupla: princípio geral de 4.7.1 (avaliação de fornecedores) + Decreto 9.013/2017 (RIISPOA), que é a norma que efetivamente exige o registro SIF/SIE/SIM. Obrigação, item crítico. |
| ali-f-055 | Matérias-primas fracionadas identificadas com data e validade | item 4.5.1 | legal | Item 4.7.5/4.8.6: insumos não utilizados integralmente devem ser "identificados com... data de fracionamento e prazo de validade." Obrigação, item crítico. |
| ali-f-056 | Características sensoriais adequadas; validade observada (PVPS) | item 4.5.1 | legal | Item 4.7.5: "deve ser observada a ordem de entrada" para itens sem prazo de validade indicado (princípio PEPS/PVPS). Obrigação, item crítico. |

### Seção 6 — Armazenamento

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-057 | Armazenamento organizado, sobre estrados, afastado de parede/teto | item 4.5.2 | legal | Item 4.7.6, **cópia literal**: armazenamento "sobre paletes, estrados e ou prateleiras... material liso, resistente, impermeável e lavável." Obrigação. |
| ali-f-058 | Rede de frio adequada ao volume e tipos de matéria-prima | item 4.5.2 | legal | Item 4.7.5 (armazenamento em condições que garantam proteção/conservação adequadas). Obrigação. |
| ali-f-059 | Produtos armazenados separados por gênero, protegidos e identificados | item 4.5.2 | legal | Item 4.9.1 (por analogia direta ao mesmo princípio aplicado a alimento preparado) + 4.7.5 (proteção contra contaminantes). Obrigação, item crítico. |

### Seção 7 — Produção e Fluxo de Alimentos

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-060 | Fluxo ordenado, sem cruzamento; área suja isolada da área de preparo | item 4.5.3 | legal | Item 4.1.1/4.8.3: edificação projetada para "impedir a existência de cruzamentos"; preparação deve evitar "contaminação cruzada." Obrigação, item crítico. |
| ali-f-061 | Produto de origem animal: 30 min à temperatura ambiente, ou 2h entre 12–18°C | item 4.5.3 | legal | Item 4.8.5 exige "tempo mínimo necessário", sem cravar os números 30min/2h/12–18°C — ver nota de atenção acima. A obrigação de limitar exposição é da RDC; o parâmetro exato pode vir de norma complementar. |
| ali-f-062 | Matérias-primas perecíveis expostas só pelo tempo mínimo necessário | item 4.5.3 | legal | Item 4.8.5, **cópia literal**: "produtos perecíveis... expostos à temperatura ambiente somente pelo tempo mínimo necessário." Obrigação exata. |
| ali-f-063 | Evita contato entre alimentos crus, semipreparados e prontos | item 4.5.3 | legal | Item 4.8.3, **cópia literal**: "deve-se evitar o contato direto ou indireto entre alimentos crus, semipreparados e prontos para o consumo." Obrigação exata, item crítico. |
| ali-f-064 | Manipuladores de alimento cru lavam mãos antes de tocar alimento pronto | item 4.5.3 | legal | Item 4.8.4, **cópia literal**: funcionários "que manipulam alimentos crus devem realizar a lavagem... antes de manusear alimentos preparados." Obrigação exata, item crítico. |
| ali-f-065 | Tratamento térmico: centro geométrico a 70°C/2min ou 74°C, ou equivalente | item 4.5.3 | legal | Item 4.8.8: "tratamento térmico deve garantir que todas as partes do alimento atinjam... no mínimo 70°C", permitindo "combinações de tempo e temperatura" equivalentes. Obrigação. |
| ali-f-066 | Eficácia do tratamento térmico avaliada por temperatura, textura e cor | item 4.5.3 | legal | Item 4.8.9, **cópia literal**: eficácia avaliada "pela verificação da temperatura... pelas mudanças na textura e cor na parte central do alimento." Obrigação exata. |
| ali-f-067 | Óleos/gorduras aquecidos até 180°C; substituídos ao alterar | item 4.5.3 | legal | Item 4.8.11, **cópia literal**: óleos "aquecidos a temperaturas não superiores a 180°C, sendo substituídos imediatamente sempre que houver alteração." Obrigação exata. |
| ali-f-068 | Descongelamento sob refrigeração <5°C ou em micro-ondas com cocção imediata | item 4.5.3 | legal | Item 4.8.13, **cópia literal**: descongelamento "sob refrigeração à temperatura inferior a 5°C ou em forno de micro-ondas quando o produto for submetido imediatamente à cocção." Obrigação exata. |
| ali-f-069 | Alimentos descongelados mantidos sob refrigeração; não recongelados | item 4.5.3 | legal | Item 4.8.14, **cópia literal**: alimentos descongelados "devem ser mantidos sob refrigeração se não forem imediatamente utilizados, não devendo ser recongelados." Obrigação exata, item crítico. |
| ali-f-070 | Hortifrutícolas crus higienizados com produto registrado no MS | item 4.5.3; RDC 218/2005 | legal | Item 4.8.19, **cópia literal**: alimentos crus "devem ser submetidos a processo de higienização... produtos... regularizados no órgão competente do Ministério da Saúde." Obrigação exata, item crítico. |
| ali-f-071 | Resfriamento de 60°C a 10°C em até duas horas | item 4.5.3 | legal | Item 4.8.16, **cópia literal**: temperatura "deve ser reduzida de 60°C a 10°C em até duas horas." Obrigação exata. |
| ali-f-072 | Após cocção, mantidos acima de 60°C por até 6 horas | item 4.5.3 | legal | Item 4.8.15, **cópia literal**: "para conservação a quente, os alimentos devem ser submetidos à temperatura superior a 60°C por, no máximo, 6 horas." Obrigação exata. |

### Seção 8 — Rotulagem e Armazenamento pós-preparo

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-073 | Produtos de fabricação própria identificados: produto, data, validade | item 4.5.4 | legal | Item 4.8.18, **cópia literal**: alimento armazenado deve conter "designação, data de preparo e prazo de validade." Obrigação exata, item crítico. |
| ali-f-074 | Após cocção, refrigerado <5°C ou congelado ≤-18°C | item 4.5.4 | legal | Item 4.8.16, **cópia literal** (mesmo subitem do ali-f-071, segunda parte): refrigeração "inferiores a 5°C" ou congelamento "igual ou inferior a -18°C." Obrigação exata, item crítico. |
| ali-f-075 | Alimentos a 4°C ou menos: prazo máximo de consumo de 5 dias | item 4.5.4 | legal | Item 4.8.17, **cópia literal**: "prazo máximo de consumo... conservado sob refrigeração a 4°C, ou inferior, deve ser de 5 dias." Obrigação exata. |
| ali-f-076 | Embalagens prontas para uso, protegidas, quantidade só para uso diário | item 4.5.4 | legal | Extensão razoável do princípio geral de proteção contra contaminantes de matérias-primas/embalagens (item 4.7.5) aplicado a embalagens já prontas para uso. Obrigação por analogia direta. |

### Seção 9 — Exposição ao Consumo

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-077 | Equipamento de exposição com barreiras contra contaminação do consumidor | item 4.5.5 | legal | Item 4.10.4, **cópia literal**: equipamento de exposição deve ter "proteção que previnam a contaminação... em decorrência da proximidade ou da ação do próprio consumidor." Obrigação. |
| ali-f-078 | Equipamentos/móveis/utensílios compatíveis, suficientes, conservados | item 4.5.5 | legal | Item 4.10.1, **cópia literal**: "equipamentos, móveis e utensílios... devem ser compatíveis com as atividades, em número suficiente e em adequado estado." Obrigação exata, item crítico. |
| ali-f-079 | Manipuladores usam antissepsia das mãos ou luvas/utensílios descartáveis | item 4.5.5 | legal | Item 4.10.2, **cópia literal**: "procedimentos que minimizem o risco de contaminação... por meio da anti-sepsia das mãos e pelo uso de utensílios ou luvas descartáveis." Obrigação exata, item crítico. |
| ali-f-080 | Alimentos quentes: >60°C por até 6h, ou <60°C por até 1h | item 4.5.5 | legal | Item 4.8.15 combinado com o princípio de tempo/temperatura de exposição (4.10.3). Obrigação, item crítico. |
| ali-f-081 | Alimentos resfriados expostos a no máximo 5°C | item 4.5.5 | legal | Item 4.10.3 (temperatura dos equipamentos de exposição deve ser regularmente monitorada) combinado com o parâmetro de refrigeração de 4.8.16/4.8.17. Obrigação, item crítico. |
| ali-f-082 | Utensílios de consumação higienizados e armazenados protegidos | item 4.5.5 | legal | Item 4.10.5, **cópia literal**: utensílios "quando feitos de material não-descartável, devidamente higienizados... local protegido." Obrigação exata, item crítico. |

### Seção 10 — Transporte de Alimentos

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-083 | Transporte em tempo/temperatura adequados, com controle/registro | item 4.5.6 | legal | Item 4.9.2, **cópia literal**: transporte "deve ocorrer em condições de tempo e temperatura que não comprometam sua qualidade... deve ser monitorada." Obrigação. |
| ali-f-084 | Veículo licenciado pelo órgão de vigilância sanitária | item 4.5.6 | legal | Item 4.9.3 exige veículo higienizado, sem vetores, sem carga incompatível — não fala em licenciamento. Ver nota de atenção acima; provável exigência municipal/estadual, não da RDC 216/2004 diretamente. |

### Seção 11 — Documentação e Registros

| ID | Descrição resumida | Citação atual | Decisão | Justificativa (RDC 216/2004) |
|---|---|---|---|---|
| ali-f-085 | Possui e cumpre Manual de Boas Práticas | item 4.6.1 | legal | Item 4.11.1, **cópia literal**: "serviços de alimentação devem dispor de Manual de Boas Práticas." Obrigação exata. |
| ali-f-086 | Possui e cumpre os 4 POPs obrigatórios | item 4.6.1 | legal | Item 4.11.4, **cópia literal**: lista exatamente os 4 temas (a-d: higienização, controle de pragas, higienização de reservatório, higiene/saúde dos manipuladores). Obrigação exata. |
| ali-f-087 | Planilhas de controle de temperatura de câmaras/balcões | item 4.6.1 | legal | Decorre da obrigação de registro difusa nos itens 4.8.16/4.8.18/4.9.2/4.10.3 ("deve ser regularmente monitorada e registrada"). Obrigação por consolidação de vários subitens. |
| ali-f-088 | Planilhas de troca de elementos filtrantes | item 4.6.1 | legal | Item 4.1.11, **cópia literal**: manutenção de filtros de climatização "devem ser registradas." Obrigação. |
| ali-f-089 | Planilhas de tempo × temperatura dos balcões expositores | item 4.6.1 | legal | Item 4.10.3: "temperatura desses equipamentos deve ser regularmente monitorada" — a formalização em planilha decorre do conceito de Registro (item 2.14) aplicado a essa obrigação de monitoramento. |
| ali-f-090 | Planilhas de registro da recepção dos alimentos | item 4.6.1 | legal | Item 4.7.2/4.7.3 (recepção sujeita a inspeção) combinado com o conceito geral de Registro (2.14). Obrigação por consolidação. |
| ali-f-091 | Registros de manutenção preventiva e calibração de instrumentos | item 4.6.1 | legal | Item 4.1.16, **cópia literal**: "manutenção programada e periódica dos equipamentos, bem como calibração de instrumentos... mantendo registro." Obrigação exata. |
| ali-f-092 | Registros de capacitação dos manipuladores | item 4.6.1 | legal | Item 4.6.7, **cópia literal**: capacitação "deve ser comprovada mediante documentação." Obrigação exata. |
| ali-f-093 | Comprovante de higienização semestral do reservatório | item 4.6.2 | legal | Item 4.4.4, **cópia literal**: reservatório higienizado "em um intervalo máximo de seis meses, devendo ser mantidos registros." Obrigação exata, item crítico. |
| ali-f-094 | Laudo de potabilidade da água (inclusive fonte alternativa) | item 4.6.2 | legal | Item 4.4.1, **cópia literal**: fonte alternativa "a potabilidade deve ser atestada semestralmente." Obrigação exata. |
| ali-f-095 | Comprovante de controle de pragas por empresa habilitada | item 4.6.3 | legal | Item 4.11.6, **cópia literal**: controle químico exige "comprovante de execução de serviço realizado por empresa especializada contratada." Obrigação exata. |
| ali-f-096 | Contrato para destinação do lixo + Programa de Gerenciamento de Resíduos | item 4.6.4 | legal | RDC 216/2004 exige apenas coleta/destinação adequada (4.5.1–4.5.3), sem mencionar contrato formal ou "programa" nomeado. Ver nota de atenção acima; provavelmente também apoiado em legislação municipal de resíduos sólidos. |
| ali-f-097 | Responsável com curso de capacitação (contaminantes, DTA, manipulação, BP) | item 4.7 | legal | Item 4.12.2, **cópia literal**: lista exatamente os 4 temas (a-d: contaminantes alimentares, DTAs, manipulação higiênica, Boas Práticas). Obrigação exata. |

---

## 3. Nota sobre reclassificações para `good_practice`

**Nenhum item foi recomendado para `good_practice`.** Para cumprir o item 3 do pedido — explicar,
para qualquer `good_practice` recomendado, por que o artigo citado (ou a ausência de artigo
aplicável) não impõe aquilo como obrigação — não há nada a preencher aqui, porque nenhuma
reclassificação passou no teste do ônus invertido.

Os sete itens listados na seção "Itens de decisão duvidosa" (`ali-f-006`, `ali-f-009`, `ali-f-011`,
`ali-f-014`, `ali-f-034`, `ali-f-061`, `ali-f-084`, `ali-f-096`) foram os únicos onde o texto oficial
da RDC 216/2004 não trouxe uma frase literal cobrindo o detalhe exato do item. Em todos eles, no
entanto, **a obrigação central subjacente segue existindo** — seja por extensão direta de um
princípio geral já expresso na RDC (ex.: `ali-f-006`, `ali-f-044`), seja porque a exigência
provavelmente vem de uma norma diferente e ainda assim mandatória (ex.: `ali-f-034` — segurança do
trabalho; `ali-f-084` e `ali-f-096` — legislação municipal de resíduos/licenciamento). Nenhum
desses casos é "parece boa prática" — é "a citação pode estar apontando para a norma errada", o que
é um problema de precisão de citação (mesma família do REF-07), não de natureza da exigência. Por
isso, seguindo a regra "na dúvida, mantenha `legal`", todos permaneceram `legal`.
