# Legislação verificada — roteiros de Estética

Produto dos Cards 1-4 do [HANDOFF.md](HANDOFF.md). Cada linha desta tabela é pré-requisito
para que a norma possa ser citada nos roteiros escritos nos Cards 5, 6 e 7.

**Regra absoluta (herdada da skill `visa-legislacao-sanitaria`): nenhuma linha aqui foi escrita
de memória.** Cada uma tem URL de fonte oficial e data de consulta. Norma sem fonte não entra
no roteiro.

## Método e ressalvas desta rodada

- **Fonte primária de vigência das normas da Anvisa: o Estoque Regulatório da própria Anvisa**,
  planilha oficial baixada pela Ester em 03/08/2026 e mantida em
  `planilha regulatório anvisa agosto 2026.xlsx` (raiz do repo, **fora do versionamento** — é
  binário de 2,5 MB). Ela cobre 3.894 atos, de 1966 a 2026, com as colunas `Status do Ato`
  (`Vigente` / `Vigente com alterações` / `Revogado` / `Caduco`) e `Normas que Alteram ou
  Revogam este Ato`. Consultada por script (`openpyxl`). É a fonte mais forte disponível: é o
  controle interno da Anvisa sobre o próprio acervo.
- **Fonte secundária/confirmatória: AnvisaLegis** (`anvisalegis.datalegis.net`), portal oficial
  de legislação da Anvisa lançado em dez/2024, que exibe o marcador de situação no cabeçalho
  de cada ato. Usado nas linhas do Card 1 antes de a planilha estar disponível; onde os dois
  divergiram em detalhe, **prevalece a planilha** e a linha registra isso.
- **`bvsms.saude.gov.br` está fora do ar** (ECONNRESET e bloqueio de navegação nas duas vias
  testadas — mesma falha já registrada em `MedSpace Studio 3D/LEGISLACAO-MATERIAIS.md` em
  jul/2026). Onde o bvsms seria a fonte natural, a verificação usou o AnvisaLegis, o portal
  `gov.br/anvisa` ou o `planalto.gov.br`, e isso está dito na linha.
- **Lacuna do AnvisaLegis:** alguns atos antigos ainda retornam "Este ato está sendo
  processado" (confirmado para RDC 50/2002 e RDC 42/2010, em `seqAto` 000 e 001, via WebFetch
  e via navegador). Esses dois foram depois resolvidos direto na planilha do Estoque
  Regulatório.
- **O que a planilha não cobre:** ela é o acervo da Anvisa. NRs (Ministério do Trabalho),
  normas ABNT, portarias do GM/MS que não passaram pela Anvisa (2.616/1998, 888/2021,
  2.095/2013), leis fora do escopo da Anvisa (5.991/1973, 9.294/1996, 13.589/2018) e toda a
  legislação estadual e municipal foram verificadas em fonte própria, indicada linha a linha.
- **Corpus local usado para o conteúdo** ("o que exige"), não para vigência:
  `TreinaVISA/MedSpace Studio 3D/legislações/` (textos integrais de RDC 63/2011, RDC 50/2002,
  RDC 36/2013, RDC 42/2010, RDC 15/2012, RDC 222/2018, RDC 509/2021, RE 2605/2006, IN 66/2020
  e da NT 2/2024) e a pasta do Drive usada no ERP
  (`drive.google.com/drive/folders/1qiABtCJm8mpdzXSGPEXqadb78dwgi8TG`).
- **Critério das duas últimas colunas.** A divisão clínica × embelezamento não é invenção do
  projeto: é a classificação da própria Anvisa na NT 2/2024 — **serviço de saúde** (atividade
  executada por profissional de saúde ou sob sua supervisão) × **serviço de interesse para a
  saúde** (não exige profissional de saúde). A NT lista, no item 2.1, quais normas se aplicam
  ao primeiro grupo, e no item 1 o que se exige do segundo. As colunas seguem essa lista.

## Card 1 — Estruturantes de serviço de saúde

Consulta feita em **2026-08-03**.

| Norma | Ementa em 1 linha | Vigente? | Revogada por | O que exige (aplicável a estética) | Aplica a clínica? | Aplica a embelezamento? | URL oficial | Consultado em |
|---|---|---|---|---|---|---|---|---|
| RDC Anvisa nº 63/2011 | Requisitos de Boas Práticas de Funcionamento para os Serviços de Saúde. | **Sim** — AnvisaLegis marca `Vigente`, sem nota de revogação | — | Núcleo do roteiro de clínica: licença sanitária e RT (arts. 10, 14, 16, 31); RH habilitado e capacitação (arts. 17, 32, 33); POPs (arts. 7º, 23, 51); prontuário (arts. 24-28); segurança do paciente (art. 8º); higiene das mãos (art. 59); PGRSS (art. 23, X); qualidade da água e limpeza de reservatório (arts. 23, VI e 39); infraestrutura e emergência (arts. 34, 51, 53, 58); iluminação e ventilação (art. 38); gestão de equipamentos (arts. 7º, 23, 53, 55). Art. 3º: aplica-se a **todos** os serviços de saúde do país | **Sim** — é a norma central. NT 2/2024, item 2.1, cita o art. 3º expressamente | **Não** — a NT 2/2024 só a lista para serviços classificados como serviço de saúde | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000063&seqAto=000&valorAno=2011&orgao=RDC%2FDC%2FANVISA%2FMS&cod_menu=9434&cod_modulo=310&pesquisa=true | 2026-08-03 |
| RDC Anvisa nº 36/2013 | Institui ações para a segurança do paciente em serviços de saúde. | **Sim, com alterações** — AnvisaLegis marca `Vigente com Alterações` | Não revogada. **Art. 12 alterado pela RDC nº 53, de 14/11/2013** (prazos de estruturação do NSP e início das notificações mensais). Detalhe apurado na planilha: a própria RDC 53/2013 foi depois revogada (pela RDC nº 292/2019, por sua vez revogada pela RDC nº 407/2020) — revogação de norma alteradora **não repristina** o texto anterior, então o art. 12 permanece com a redação dada em 2013 | Plano de Segurança do Paciente, Núcleo de Segurança do Paciente, protocolos básicos, notificação mensal de eventos adversos. A NT 2/2024 a lista **"nos casos aplicáveis"** — ou seja, o roteiro não pode tratar todo item de RDC 36 como exigência absoluta para clínica de estética de pequeno porte; a redação do item precisa dizer o que é verificável | **Sim**, nos casos aplicáveis | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000036&seqAto=000&valorAno=2013&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| RDC Anvisa nº 50/2002 | Regulamento técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde. | **Sim** — Estoque Regulatório: `Vigente com alterações` | **"Alterado por 8 RDC's"** (Estoque Regulatório). A alteração que importa ao roteiro: **itens 1.2.2.1 (Projeto Básico de Arquitetura), 1.3 (Responsabilidades) e 1.6 (Avaliação de Projetos) revogados pela RDC nº 51/2011** | Requisitos de ambientes, dimensões, acabamentos e instalações. Critério de acabamento é **de desempenho, não de material** (resistente a lavagem e desinfetante; superfície monolítica; absorção de água ≤ 4% em área crítica, inclusive o rejunte) — ver `MedSpace Studio 3D/LEGISLACAO-MATERIAIS.md` | **Sim** | **Não** diretamente — para serviço de interesse para a saúde a NT 2/2024 (item 1, "i") condiciona a exigência de projeto básico à atividade e à classificação de risco da IN 66/2020 c/c RDC 153/2017 | https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/seguranca-do-paciente/legislacao | 2026-08-03 |
| **RDC Anvisa nº 51/2011** *(não estava no card; entra por ser a norma que revogou parte da RDC 50)* | Requisitos para análise, avaliação e aprovação dos projetos físicos de estabelecimentos de saúde pelo SNVS. | **Sim** — consta na página oficial de legislação de serviços de saúde da Anvisa | — | É **esta** a norma que hoje rege o Projeto Básico de Arquitetura (PBA) e sua aprovação pela vigilância — não o item 1.2.2.1 da RDC 50/2002, que está revogado | **Sim** | **Não** (mesma ressalva da RDC 50) | https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/seguranca-do-paciente/legislacao | 2026-08-03 |
| Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA | Esclarecimentos sobre os serviços de estética e o atendimento às normas sanitárias aplicáveis a esses serviços. | **Sim** — publicada em 02/02/2024 e hospedada pela Anvisa na seção **"notas técnicas vigentes"**; substitui a NT nº 15/2023/GGTES/ANVISA | — (substituiu a NT 15/2023) | **Não é norma — é orientação interpretativa**, e por isso não pode ser citada como "base legal" isolada de um item. O que ela faz e que é decisivo aqui: (a) classifica os estabelecimentos de estética em **serviço de saúde** × **serviço de interesse para a saúde**; (b) afirma que **não existe norma sanitária federal específica para serviços de estética** — aplicam-se normas transversais; (c) lista nominalmente as normas aplicáveis a cada grupo; (d) registra que **esteticista não é profissional de saúde** (Resolução CNS nº 287/1998 não o inclui); (e) proíbe formol alisante e câmara de bronzeamento | **Sim** (define a classificação) | **Sim** (define a classificação) | https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos | 2026-08-03 |
| Portaria de Consolidação nº 4/2017 (GM/MS) | Consolidação das normas sobre os sistemas e os subsistemas do SUS. | **Sim** | — | Relevante à estética por **um** ponto: o **Anexo V, Anexo 1** traz a Lista Nacional de Notificação Compulsória de doenças, agravos e eventos de saúde pública, obrigatória para serviços **públicos e privados**. Lista alterada pela **Portaria GM/MS nº 3.148, de 06/02/2024** (inclusão de HTLV). É a base do item `est-103` do roteiro atual — a citação deve virar "PRC nº 4/2017, Anexo V" e não a portaria inteira | **Sim**, limitado à notificação compulsória | **Sim**, limitado à notificação compulsória (a lista alcança qualquer estabelecimento que identifique agravo notificável) | https://www.gov.br/aids/pt-br/central-de-conteudo/copy_of_portarias/2017/portaria_consolidacao_no_4_28_09_2017.pdf/view · alteração: https://bvsms.saude.gov.br/bvs/saudelegis/gm/2024/prt3148_15_02_2024.html | 2026-08-03 |
| Portaria MS nº 2.616, de 12/05/1998 | Diretrizes e normas para prevenção e controle das infecções hospitalares (PCIH). | **Sim** — AnvisaLegis marca `Vigente`. **A suspeita do card de que teria sido absorvida pela Portaria de Consolidação é refutada**: o ato segue listado como vigente e não aparece como revogado por consolidação | — | Programa de Controle de Infecção Hospitalar, CCIH, conceitos de infecção e vigilância epidemiológica de IRAS. **Ressalva de aplicabilidade:** a portaria é estruturada para **hospitais** (art. 1º, "hospitais do País"), e a Anvisa **não a inclui** na página de legislação de serviços de saúde. É a base do item `est-112` do roteiro atual, sobre vigilância de eventos adversos e surtos — mas ali a base própria é a RDC 36/2013 + RDC 63/2011, não a 2616 | **Parcialmente** — vigente, porém dirigida a hospital; usar só como reforço conceitual, nunca como base legal isolada de item de clínica de estética | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=POR&numeroAto=00002616&seqAto=000&valorAno=1998&orgao=MS&cod_modulo=310&cod_menu=8542&pesquisa=true | 2026-08-03 |
| RDC Anvisa nº 42/2010 | Obrigatoriedade de disponibilização de preparação alcoólica para fricção antisséptica das mãos pelos serviços de saúde. | **Sim** — Estoque Regulatório: `Vigente`, sem alteração registrada | — | Preparação alcoólica (registrada na Anvisa ou manipulada conforme RDC 67/2007) disponível nos pontos de assistência; dispensadores em cada ponto de assistência ao paciente; cartaz de orientação de higiene das mãos | **Sim** | **Não** — a NT 2/2024 exige higiene e infraestrutura sanitária do serviço de interesse para a saúde, mas não estende a esse grupo a obrigação específica da RDC 42/2010 | https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/seguranca-do-paciente/legislacao | 2026-08-03 |
| **RDC Anvisa nº 509/2021** *(não estava no card; entra por ser citada pela NT 2/2024 e pelo ROI oficial da Anvisa)* | Gerenciamento de tecnologias em saúde em estabelecimentos de saúde. | **Sim** — AnvisaLegis marca `Vigente` | — | Plano de Gerenciamento de Tecnologias elaborado por profissional de nível superior com registro ativo, cobrindo seleção, aquisição, armazenamento, instalação, funcionamento, manutenções, notificação de queixa técnica e evento adverso, descarte e rastreabilidade — inclusive de equipamentos, produtos de higiene, medicamentos e saneantes (art. 5º e §2º do art. 7º) | **Sim** | **Não** — mas a NT 2/2024 exige do serviço de interesse para a saúde gestão equivalente de equipamentos (manutenção preventiva/corretiva, uso conforme manual do fabricante), sem citar a RDC 509 | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000509&seqAto=000&valorAno=2021&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| Resolução CNS nº 466/2012 | Diretrizes e normas regulamentadoras de pesquisas envolvendo seres humanos. | **Sim** — não revogada pela Resolução CNS nº 674/2022, que a complementa (a 674 invoca a 466 nos seus consideranda) | — (a própria 466 revogou as Resoluções CNS 196/96, 303/2000 e 404/2008) | **Regula pesquisa com seres humanos, não atendimento assistencial.** O TCLE de que trata é o *termo de consentimento de participante de pesquisa* | **Não**, salvo se a clínica realizar pesquisa com seres humanos. **O item `est-009` do roteiro atual está com base legal errada**: TCLE de procedimento estético de rotina não decorre da CNS 466/2012 — decorre do dever de informação do CDC (Lei 8.078/1990, art. 6º, III) e dos códigos de ética dos conselhos profissionais | **Não**, mesma ressalva | https://www.gov.br/conselho-nacional-de-saude/pt-br/atos-normativos/resolucoes/2012/resolucao-no-466.pdf/view | 2026-08-03 |
| Lei nº 13.709/2018 (LGPD) | Dispõe sobre a proteção de dados pessoais e altera o Marco Civil da Internet. | **Sim** — Planalto publica texto compilado, sem nota de revogação | — (alterada pela Lei nº 13.853/2019, inclusive no nome oficial "Lei Geral de Proteção de Dados Pessoais (LGPD)") | Dado referente à saúde é **dado pessoal sensível** (art. 5º, II) e seu tratamento tem hipóteses restritas (art. 11). No roteiro sustenta guarda, sigilo e acesso controlado ao prontuário e às fotos de antes/depois, e a base do consentimento para uso de imagem | **Sim** | **Sim** — salão e barbearia também tratam dado pessoal de cliente (ficha de anamnese, foto, contato) | https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709.htm | 2026-08-03 |

### Conclusões do Card 1 que mudam o roteiro

1. **`est-009` (TCLE) muda de base legal.** Resolução CNS 466/2012 é de pesquisa com seres
   humanos. Trocar por CDC (Lei 8.078/1990, art. 6º, III) + código de ética do conselho, ou
   marcar como `good_practice` se a Ester preferir não sustentar em conselho profissional.
2. **`est-112` perde a Portaria 2616/98 como base.** A portaria está vigente, mas é dirigida a
   hospitais e a Anvisa não a arrola entre as normas de serviços de saúde aplicáveis à
   estética. Base correta: RDC 36/2013 + RDC 63/2011.
3. **Item de PBA passa a citar RDC 51/2011**, não RDC 50/2002 — o item 1.2.2.1 da RDC 50 (que
   é justamente o do Projeto Básico de Arquitetura) está revogado.
4. **`est-103` (notificação compulsória)** deve citar "Portaria de Consolidação nº 4/2017,
   Anexo V", não a portaria inteira.
5. **RDC 509/2021 precisa entrar no roteiro de clínica.** É citada pela NT 2/2024 e pelo ROI
   oficial da Anvisa (item 6, Gerenciamento de Tecnologias), e não existe hoje no
   `tpl-estetica-v1` nem em nenhum dos Cards 1-4.
6. **A RDC 36/2013 não é exigência integral** — a NT 2/2024 a qualifica com "nos casos
   aplicáveis". A redação do item precisa ser verificável em campo, não "cumpre a RDC 36".

### Normas citadas pela NT 2/2024 que não estão em nenhum dos Cards 1-4

Ficam registradas aqui para decisão nos Cards 2 e 3 — **ainda não verificadas**:
RE nº 2.606/2006 (protocolos de reprocessamento), RDC nº 6/2012 (processamento de roupas),
Portaria MS nº 2.095/2013 (protocolos básicos de segurança do paciente), Portaria MS nº
1.377/2013 (protocolo de higiene das mãos), Portaria MS nº 529/2013 (PNSP), Lei nº 6.437/1977
(infrações sanitárias), RDC nº 153/2017 e IN nº 66/2020 (classificação de risco / licenciamento),
RDC nº 409/2020 e IN nº 124/2022 (alisantes capilares).

### Fonte de apoio encontrada: ROI oficial de estética da Anvisa

`TreinaVISA/MedSpace Studio 3D/legislações/copy_of_RoteirodeEsttica_GGTES_verso1.md` é o
**Roteiro Objetivo de Inspeção: Serviços de Estética classificados como Serviços de Saúde**, da
GGTES/Anvisa, **versão 1.3 de 16/12/2025**. Ele traz item a item o artigo exato de cada norma —
é a melhor referência para a redação dos itens do Card 5, e serve como evidência adicional de
vigência (documento oficial da Anvisa de dez/2025 citando essas normas como exigíveis).

## Card 2 — Processamento, produtos e equipamentos

Consulta feita em **2026-08-03**. Fonte de vigência de todas as normas da Anvisa desta seção:
**Estoque Regulatório da Anvisa, planilha oficial de agosto/2026** (ver "Método" acima). A URL
oficial de cada norma vai na coluna própria.

| Norma | Ementa em 1 linha | Vigente? | Revogada por | O que exige (aplicável a estética) | Aplica a clínica? | Aplica a embelezamento? | URL oficial | Consultado em |
|---|---|---|---|---|---|---|---|---|
| RDC Anvisa nº 15/2012 | Requisitos de boas práticas para o processamento de produtos para a saúde. | **Sim** — Estoque Regulatório: `Vigente`, sem alteração registrada | — | Classificação de artigo em crítico / semicrítico / não crítico; etapas de limpeza, desinfecção e esterilização; CME e sua estrutura; validação e monitoramento de autoclave (indicador físico, químico e biológico); rastreabilidade da carga; proibição de esterilização por estufa para artigo crítico embalado. A NT 2/2024 a invoca **duas vezes**: como norma aplicável ao serviço de saúde (item 2.1) **e**, para o serviço de interesse para a saúde, como a fonte das definições de limpeza, desinfecção e esterilização (item 1, "g") | **Sim** | **Sim, parcialmente** — não como regime completo de CME, mas os **conceitos e o padrão de limpeza/desinfecção/esterilização de alicate, pinça e afins** vêm daqui, por remissão expressa da NT 2/2024 | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000015&seqAto=000&valorAno=2012&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| RDC Anvisa nº 156/2006 | Registro, rotulagem e reprocessamento de produtos médicos. | **Sim** — Estoque Regulatório: `Vigente`, sem alteração registrada | — | Define o que pode e o que não pode ser reprocessado e obriga o serviço a ter protocolo de reprocessamento validado para o que reprocessa | **Sim** | **Não** — o estabelecimento de embelezamento não reprocessa produto médico; o que ele faz com alicate/pinça é regido pelas definições da RDC 15/2012 | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000156&seqAto=000&valorAno=2006&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| RE Anvisa nº 2.605/2006 | Lista de produtos médicos enquadrados como de uso único, proibidos de ser reprocessados. | **Sim** — Estoque Regulatório: `Vigente`, sem alteração registrada | — | Lista fechada do que é proibido reprocessar. Sustenta o item de "política documentada que proíbe reprocessamento de artigo de uso único" e o item de agulha/cânula/lâmina descartável | **Sim** | **Sim** — lâmina de barbear, agulha de micropigmentação e afins são de uso único; a proibição alcança qualquer estabelecimento | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RE&numeroAto=00002605&seqAto=000&valorAno=2006&orgao=RE%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| **RE Anvisa nº 2.606/2006** *(não estava no card; entra por ser citada pela NT 2/2024)* | Diretrizes para elaboração, validação e implantação de protocolos de reprocessamento de produtos médicos. | **Sim, com alterações** — Estoque Regulatório: `Vigente com alterações` | Não revogada. Retificada no DOU nº 160, de 21/08/2006; **alterada pela RE nº 2.305, de 31/07/2007** | É o par obrigatório da RDC 156/2006: quem reprocessa precisa de protocolo **validado**, não só escrito | **Sim**, se reprocessa | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RE&numeroAto=00002606&seqAto=000&valorAno=2006&orgao=RE%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| RDC Anvisa nº 751/2022 | Classificação de risco, regimes de notificação e registro, e requisitos de rotulagem e instruções de uso de **dispositivos médicos**. | **Sim, com alterações** — Estoque Regulatório: `Vigente com alterações` | Não revogada. **Alterada pela RDC nº 777, de 01/03/2023 e pela RDC nº 810, de 17/08/2023** (ambas `Vigente`) | Todo equipamento estético (laser, luz intensa pulsada, radiofrequência, ultrassom, criolipólise, alta frequência) é dispositivo médico e precisa estar **regularizado na Anvisa**, com rotulagem e instruções de uso. O ROI oficial da Anvisa cita "Art. 2º da RDC nº 751/22" junto com a RDC 63/2011 no item de gestão de equipamentos | **Sim** | **Sim** — a NT 2/2024 exige do serviço de interesse para a saúde que "equipamentos e produtos utilizados" estejam regularizados na Anvisa e sejam usados conforme o manual do fabricante, inclusive quanto a **qual profissional pode operar** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000751&seqAto=000&valorAno=2022&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| **RDC Anvisa nº 864/2024** | Permissão **temporária** de dispensação de medicamentos sujeitos a Notificação de Receita (Portaria SVS/MS nº 344/98) por Receita de Controle Especial em 2 vias, diante de ocorrência excepcional. | **Não — `Caduco`.** O Estoque Regulatório registra: "Tornada caduca pela perda da validade/vigência por decurso do prazo previsto no art. 7º" | Não foi revogada: **caducou por decurso de prazo**. Foi alterada pela RDC nº 888, de 30/07/2024, antes de caducar | **Nada, para estética.** A norma **existe**, ao contrário do que o card suspeitava, mas seu objeto é dispensação emergencial de medicamento controlado — não tem relação alguma com equipamento estético | **Não** | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000864&seqAto=000&valorAno=2024&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| Lei nº 6.360/1976 | Vigilância sanitária a que ficam sujeitos os medicamentos, drogas, insumos farmacêuticos e correlatos, **cosméticos**, saneantes e outros produtos. | **Sim, com alterações** — Estoque Regulatório: `Vigente com alterações` | Não revogada. Alterada, entre outras, pelas Leis nº 13.235/2015, 13.236/2015 e 13.411/2016 | Base legal de que **produto cosmético é de uso exclusivamente externo** (arts. 3º c/c 5º e 59, citados expressamente pela NT 2/2024) — é o que sustenta o item crítico contra uso injetável de cosmético. Também exige regularização de todo produto usado | **Sim** | **Sim** | https://www.planalto.gov.br/ccivil_03/leis/l6360.htm | 2026-08-03 |
| RDC Anvisa nº 67/2007 | Boas práticas de manipulação de preparações magistrais e oficinais para uso humano em farmácias. | **Sim, com alterações** — Estoque Regulatório: `Vigente com alterações` | Não revogada. Alterada pelas RDC nº 24/2008, 49/2008, 87/2008 e 21/2009 | **Aplica-se a farmácia, não a clínica de estética.** Entra no roteiro só por remissão: a RDC 42/2010 admite preparação alcoólica manipulada **desde que** em farmácia que siga a RDC 67/2007. Não gera item próprio — gera a exigência de nota fiscal/procedência da preparação alcoólica manipulada | **Indiretamente**, só como origem válida da preparação alcoólica | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000067&seqAto=000&valorAno=2007&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| RDC Anvisa nº 56/2009 | **Proíbe** em todo o território nacional o uso de equipamentos de bronzeamento artificial com finalidade estética por radiação UV. | **Sim** — Estoque Regulatório: `Vigente` (com retificação no DOU nº 216, de 12/11/2009) | — | Proibição total: **uso, importação, recebimento em doação, aluguel e comercialização**. Item crítico de resposta binária — a câmara existe no estabelecimento ou não existe. Reafirmada nominalmente pela NT 2/2024 | **Sim** | **Sim** — a NT 2/2024 traz a proibição justamente na seção do serviço de interesse para a saúde | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000056&seqAto=000&valorAno=2009&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| Lei nº 5.991/1973 | Controle sanitário do **comércio** de drogas, medicamentos, insumos farmacêuticos e correlatos. | **Sim** — Planalto, sem nota de revogação | — | Art. 1º: rege o **comércio** de medicamentos. Clínica de estética **não é unidade de dispensação** — a lei só a alcança se houver comércio ou dispensação de medicamento, o que em regra não é o caso. O que a clínica precisa é de guarda adequada e receituário, e isso vem da Portaria SVS/MS nº 344/98 e da RDC 63/2011, não daqui | **Não**, salvo se dispensar/comercializar medicamento | **Não** | https://www.planalto.gov.br/ccivil_03/leis/l5991.htm | 2026-08-03 |
| **RDC Anvisa nº 906/2024** *(não estava no card; entra por revogar norma citada pela NT 2/2024)* | Procedimentos e requisitos para a regularização de produtos cosméticos para alisar ou ondular os cabelos. | **Sim** — Estoque Regulatório: `Vigente` (retificada duas vezes no DOU em 2024) | — | Substitui a **RDC nº 409/2020**, que a NT 2/2024 cita e que está **`Revogado`** desde 19/09/2024. Sustenta o item de alisante capilar regularizado | **Sim**, se usa alisante | **Sim** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000906&seqAto=000&valorAno=2024&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| **IN Anvisa nº 220/2023** *(idem)* | Lista de ativos permitidos em produtos cosméticos para alisar ou ondular os cabelos. | **Sim** — Estoque Regulatório: `Vigente` | — | Substitui a **IN nº 124/2022**, citada pela NT 2/2024 e **`Revogado`** desde 13/04/2023. É a lista que permite dizer se o alisante em uso tem ativo permitido (e sustenta a proibição do formol como alisante) | **Sim**, se usa alisante | **Sim** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=IN&numeroAto=00000220&seqAto=000&valorAno=2023&orgao=IN%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| **RDC Anvisa nº 894/2024** *(não estava no card; achada na pasta do Drive do ERP)* | Boas Práticas de Cosmetovigilância para as empresas titulares da regularização de produtos cosméticos. | **Sim** — Estoque Regulatório: `Vigente`, sem alteração registrada | — | **Obriga a empresa titular do registro, não o salão nem a clínica.** Fica registrada aqui para evitar que entre no roteiro por engano: o dever do estabelecimento é **notificar** o evento adverso, não manter sistema de cosmetovigilância | **Não** (o dever de notificar vem da RDC 36/2013 e do Notivisa) | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000894&seqAto=000&valorAno=2024&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| **RDC Anvisa nº 153/2017 + IN Anvisa nº 66/2020** *(não estavam no card; entram por serem a base do licenciamento)* | Classificação do grau de risco das atividades econômicas sujeitas à vigilância sanitária, para fins de licenciamento (153) e a lista de CNAE por grau de risco (66). | **Sim.** Estoque Regulatório: RDC 153/2017 `Vigente com alterações` (alterada pela RDC nº 418, de 01/09/2020); IN 66/2020 `Vigente`, sem alteração | — | É o que decide **se** o estabelecimento precisa de licença e **se** precisa de projeto básico de arquitetura. A NT 2/2024 (item 1, "i") remete expressamente a essas duas normas para responder à pergunta "esse salão precisa de PBA?" | **Sim** | **Sim** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000153&seqAto=000&valorAno=2017&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |

### Conclusões do Card 2 que mudam o roteiro

1. **RDC 864/2024 sai do roteiro.** Ela existe (a suspeita de alucinação era só parcialmente
   procedente), mas está **caduca** e trata de dispensação emergencial de medicamento
   controlado. O item que hoje cita `'RDC nº 36/2013; RDC 751/2022; RDC 864/2024'` fica só com
   as duas primeiras.
2. **RDC 751/2022 precisa citar as alterações** (RDC 777/2023 e RDC 810/2023) ou, melhor, ser
   citada sem número de artigo, já que a numeração mudou.
3. **Lei 5.991/1973 sai do roteiro de clínica de estética.** Rege comércio de medicamento;
   clínica não é unidade de dispensação. A guarda de medicamento se sustenta na Portaria
   SVS/MS nº 344/98 e na RDC 63/2011.
4. **RDC 67/2007 não gera item próprio** — só entra como qualificador da preparação alcoólica
   manipulada, dentro do item da RDC 42/2010.
5. **A NT 2/2024 está desatualizada em dois pontos** e o roteiro não pode copiá-la cegamente:
   ela cita a RDC 409/2020 (revogada pela RDC 906/2024) e a IN 124/2022 (revogada pela IN
   220/2023). Usar as normas novas.
6. **RDC 15/2012 é a ponte para o roteiro de embelezamento.** Não como CME completo, mas
   porque a NT 2/2024 manda usar as definições dela para limpeza/desinfecção/esterilização de
   alicate e pinça — é isso que dá base legal ao item de esterilização em salão, que hoje no
   roteiro aparece como "Boas Práticas".

## Card 3 — Resíduos, trabalho, estrutura

Consulta feita em **2026-08-03**.

| Norma | Ementa em 1 linha | Vigente? | Revogada por | O que exige (aplicável a estética) | Aplica a clínica? | Aplica a embelezamento? | URL oficial | Consultado em |
|---|---|---|---|---|---|---|---|---|
| RDC Anvisa nº 222/2018 | Boas Práticas de Gerenciamento dos Resíduos de Serviços de Saúde. | **Sim** — Estoque Regulatório: `Vigente`, sem alteração registrada | — (substituiu a RDC 306/2004) | PGRSS implementado e correspondente à rotina real; classificação dos grupos A/B/D/E; segregação, acondicionamento, coleta interna, armazenamento, transporte e destinação; contrato e licença ambiental da empresa coletora; abrigo de resíduos | **Sim** | **Sim** — a NT 2/2024 (item 1.6) diz expressamente que o serviço de interesse para a saúde que gera resíduo similar ao de serviço de saúde deve observar a RDC 222/2018, **inclusive apresentando PGRSS, contrato e licença ambiental da coletora** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000222&seqAto=000&valorAno=2018&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| NR-1 | Disposições Gerais e Gerenciamento de Riscos Ocupacionais (GRO/PGR). | **Sim** — consta na lista oficial de NRs vigentes do MTE | — | Programa de Gerenciamento de Riscos (PGR) com inventário de riscos e plano de ação; ordens de serviço; treinamento. **Ressalva:** microempresa e EPP de grau de risco 1 e 2 têm tratamento simplificado — o item do roteiro precisa refletir isso, senão reprova salão pequeno indevidamente | **Sim** | **Sim** | https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes | 2026-08-03 |
| NR-6 | Equipamento de Proteção Individual (EPI). | **Sim** — lista oficial de NRs vigentes do MTE | — | EPI com Certificado de Aprovação (CA) válido, fornecido gratuitamente, em quantidade, com registro de entrega e treinamento de uso. Em estética: luva, óculos/protetor facial, máscara, avental | **Sim** | **Sim** | idem acima | 2026-08-03 |
| NR-7 | Programa de Controle Médico de Saúde Ocupacional (PCMSO). | **Sim** — lista oficial de NRs vigentes do MTE | — | PCMSO com ASO admissional, periódico, de mudança de risco e demissional. Vinculado ao PGR da NR-1 | **Sim** | **Sim** | idem acima | 2026-08-03 |
| NR-10 | Segurança em Instalações e Serviços em Eletricidade. | **Sim** — lista oficial de NRs vigentes do MTE | — | Prontuário das instalações elétricas, aterramento, quadro identificado e sinalizado, laudo/ART quando exigível. Em estética entra pela carga dos equipamentos (laser, IPL) | **Sim** | **Sim, parcialmente** — quadro elétrico identificado e instalação segura; o prontuário completo da NR-10 é exigível conforme a carga instalada, não por ser salão | idem acima | 2026-08-03 |
| NR-24 | Condições Sanitárias e de Conforto nos Locais de Trabalho. | **Sim** — lista oficial de NRs vigentes do MTE | — | Sanitário por sexo, vestiário/armário quando há troca de roupa, água potável, local de refeição. É a base **trabalhista** dos itens de sanitário e vestiário — distinta da base sanitária da RDC 50/2002 | **Sim** | **Sim** | idem acima | 2026-08-03 |
| NR-32 | Segurança e Saúde no Trabalho em **Serviços de Saúde**. | **Sim** — lista oficial de NRs vigentes do MTE; versão atualizada em 2023 publicada no portal | — | Programa de prevenção de acidente com perfurocortante; vacinação do trabalhador (hepatite B, tétano/difteria) com registro; proibição de reencape de agulha; coletor de perfurocortante em altura e volume corretos; proibição de calçado aberto e de adorno; conduta pós-exposição | **Sim** | **Não formalmente** — a NR-32 se aplica a serviço de saúde. **Mas** o risco biológico do salão que usa lâmina e agulha existe e é coberto pela NR-1/NR-6/NR-9. No roteiro de embelezamento o item de perfurocortante **não deve citar NR-32**: cita RDC 222/2018 (descarte) + NR-6/NR-1 (proteção do trabalhador) | idem acima | 2026-08-03 |
| ABNT NBR 9050 | Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos. | **Sim — edição 9050:2020** (reuniu a 9050:2015 com a Emenda 1 de ago/2020, que cancelou a de 2015; errata de 2021 incorporada). Confirmada pela ABNT em dez/2025 — confirmação **não** é nova edição | — | Rota acessível, largura de porta, sanitário acessível, desnível e rampa, sinalização. **Norma técnica, não lei** — a obrigatoriedade vem da Lei 13.146/2015 e do código de obras municipal, e a exigibilidade depende da data da edificação/reforma | **Sim** | **Sim** | https://www.confea.org.br/acessibilidade-de-acordo-com-norma-abnt-nbr-90502020 · catálogo: https://www.abntcatalogo.com.br | 2026-08-03 |
| ABNT NBR 13534 | Instalações elétricas de baixa tensão — requisitos específicos para instalação em **estabelecimentos assistenciais de saúde**. | **Sim — edição 13534:2008** | — | Classificação dos locais (grupo 0/1/2), sistema IT médico onde exigível e sua verificação anual, equipotencialização. **Aplica-se a EAS.** Em clínica de estética de pequeno porte só alcança ambiente equiparável a local do grupo 1 | **Sim, parcialmente** — conforme os ambientes existentes; não gerar item genérico "cumpre a NBR 13534" | **Não** | https://www.abntcatalogo.com.br | 2026-08-03 |
| Lei nº 13.589/2018 | Manutenção de instalações e equipamentos de sistemas de climatização de ambientes (PMOC). | **Sim** — Planalto, sem nota de revogação | — | Art. 1º: **todo edifício de uso público e coletivo** com ambiente climatizado artificialmente deve ter PMOC. Não depende de ser serviço de saúde — depende de ter ar-condicionado e receber público | **Sim** | **Sim** | https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13589.htm | 2026-08-03 |
| Lei nº 9.294/1996 | Restrições ao uso e à propaganda de produtos fumígeros, bebidas alcoólicas, medicamentos, terapias e defensivos agrícolas. | **Sim, com alterações** — Planalto, texto com redação dada pela Lei nº 12.546/2011 | — | Art. 2º (redação da Lei 12.546/2011): **proibido fumar em recinto coletivo fechado, público ou privado** — sem exceção de área para fumantes, que a redação de 1996 admitia e a de 2011 eliminou. O item do roteiro deve refletir a regra atual | **Sim** | **Sim** | https://www.planalto.gov.br/ccivil_03/leis/l9294.htm | 2026-08-03 |
| Portaria SVS/MS nº 344/1998 | Regulamento técnico sobre substâncias e medicamentos sujeitos a controle especial. | **Sim, com alterações** — Estoque Regulatório: `Vigente com alterações`, com **3 republicações, alterada por 121 RDC's e 3 PRT's** | — | Guarda sob chave, escrituração, receituário e balanço de substância controlada. Em estética alcança quem usa anestésico e toxina botulínica. **A citação precisa ser "Portaria SVS/MS nº 344/98 e suas atualizações"** — citar artigo isolado de um texto alterado 124 vezes é frágil | **Sim**, se usa substância controlada | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=PRT&numeroAto=00000344&seqAto=000&valorAno=1998&orgao=SVS%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| Portaria GM/MS nº 888/2021 | Procedimentos de controle e de vigilância da qualidade da água para consumo humano e seu padrão de potabilidade — **na forma do Anexo XX da Portaria de Consolidação nº 5/2017**. | **Sim** — publicada em 04/05/2021, alterou o Anexo XX da PRC nº 5/2017; nenhuma revogação localizada | — | Padrão de potabilidade e plano de amostragem. **Recai principalmente sobre o responsável pelo sistema ou solução alternativa de abastecimento**, não sobre a clínica. Para o estabelecimento, o dever direto é o da RDC 63/2011 (arts. 23, VI e 39): garantir a qualidade da água, limpar o reservatório **a cada seis meses** e manter registro. É exatamente assim que o ROI oficial da Anvisa pareia as duas normas | **Sim**, como padrão de referência do laudo de potabilidade | **Sim**, mesma lógica | https://bvsms.saude.gov.br/bvs/saudelegis/gm/2021/prt0888_07_05_2021.html | 2026-08-03 |

### Conclusões do Card 3 que mudam o roteiro

1. **NR-32 sai do roteiro de embelezamento.** Ela é de serviço de saúde. O item de
   perfurocortante em salão passa a citar RDC 222/2018 + NR-6/NR-1.
2. **Lei 9.294/1996 mudou de redação.** A regra vigente (Lei 12.546/2011) proíbe fumar em
   recinto coletivo fechado **sem** ressalva de área para fumantes. O item atual (`est-097`)
   está certo no conteúdo, mas a base deve citar a redação vigente.
3. **NBR 9050 e NBR 13534 são normas técnicas, não leis** — e a NBR 13534 é para EAS. Nenhuma
   das duas deve gerar item genérico "atende à norma X". A NBR 13534 provavelmente vira
   `good_practice` no roteiro de clínica de pequeno porte, e some do de embelezamento.
4. **Portaria SVS/MS 344/98 nunca deve ser citada por artigo** — 121 alterações. Citar a
   portaria "e suas atualizações".
5. **Portaria GM/MS 888/2021 não é a base direta do item de água** — a base é a RDC 63/2011,
   arts. 23, VI e 39 (limpeza semestral do reservatório com registro). A 888 entra como padrão
   de potabilidade do laudo.
6. **NR-1 precisa de ressalva de porte** no item, para não reprovar microempresa de grau de
   risco 1-2 que tem tratamento simplificado.

## Card 4 — RJ estadual e municipal

Consulta feita em **2026-08-03**.

| Norma | Ementa em 1 linha | Vigente? | Revogada por | O que exige (aplicável a estética) | Aplica a clínica? | Aplica a embelezamento? | URL oficial | Consultado em |
|---|---|---|---|---|---|---|---|---|
| Resolução SES/RJ nº 1.822, de 19/03/2019 | Aprova a relação de documentos necessários para a regularização de estabelecimentos sujeitos à vigilância sanitária no Estado do RJ. | **Sim** — publicada no DOE de 28/03/2019, no sistema oficial de protocolo da SES/RJ | — (foi ela que revogou as Resoluções SES/RJ nº 213/2012, 827/2013 e 1.480/2016) | Relação de documentos para licença inicial, revalidação (prazo: **30 de abril**), alteração de razão social/endereço/atividade/responsabilidade técnica, e procedimentos suplementares. **Achado relevante: a resolução não menciona estética, embelezamento, salão de beleza nem clínica de estética** — as categorias cobertas são estabelecimentos médico-assistenciais e indústrias/comércio de produtos sujeitos a vigilância | **Sim, como estabelecimento assistencial** — a clínica de estética classificada como serviço de saúde entra pela categoria assistencial | **Não** — o estabelecimento de embelezamento não está nas categorias listadas; no RJ ele é licenciado pelo **município** | https://sistemas.saude.rj.gov.br/protocoloonline/Documentos/Resolucoes/Res_1822.html · índice: https://www.saude.rj.gov.br/vigilancia-sanitaria/legislacao | 2026-08-03 |
| **Lei Complementar Municipal (Rio) nº 197, de 27/12/2018** | Institui o **Código de Vigilância Sanitária, de Vigilância de Zoonoses e de Inspeção Agropecuária do Município do Rio de Janeiro**. | **Sim** — texto oficial na Câmara Municipal do Rio | — (o art. 72 revogou as Leis nº 871/1986 e nº 3.715/2003) | Institui o licenciamento sanitário municipal e suas modalidades: **LSF** (Licença Sanitária de Funcionamento), **LSAR** (Licença Sanitária de Atividades Relacionadas), **LSAT** (transitórias), **ASP** (autorização provisória) e REPA. O art. 8º, §1º inclui **"produtos para estética"** entre os bens regulados; o art. 10 trata das atividades **relacionadas** — categoria em que o IVISA-Rio enquadra salão, barbearia, manicure, depilação, estética, tatuagem, massagem, podologia | **Sim** | **Sim** | https://e.camara.rj.gov.br/Arquivo/Documents/legislacao/HTML/C1972018.html | 2026-08-03 |
| **Decreto Rio nº 57.501, de 30/01/2026** | Regulamenta a LC nº 197/2018 e o §1º do art. 3º da LC nº 238/2021, dispondo sobre licenciamento, infrações, fiscalização e transformação digital no âmbito da vigilância sanitária e da defesa agropecuária. | **Sim.** O IVISA-Rio publica o PDF no próprio site com o rótulo **"NORMA EM VIGOR"** | — (substitui, na prática regulamentar, o Decreto Rio nº 45.585/2018, que era o regulamento administrativo anterior da LC 197/2018) | **O art. 9º define as modalidades de licenciamento aplicáveis a cada tipo de estabelecimento.** Obrigações concretas verificáveis em campo: solicitação do licenciamento em **até 30 dias após a emissão do alvará** pela SMF; **revalidação anual até o último dia útil de abril**; licença inicial concedida entre 1º/01 e 30/04 vale até 30/04 do ano seguinte | **Sim** | **Sim** | https://vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2026/04/Decreto-N%C2%B0-57501_2026.pdf · página do IVISA-Rio: https://vigilanciasanitaria.prefeitura.rio/licenciamento-sanitario/ | 2026-08-03 |

### Conclusões do Card 4 — as duas perguntas do card, respondidas

1. **O Decreto Rio nº 57.501/2026 NÃO é alucinação.** Ele existe, é de **30 de janeiro de
   2026**, regulamenta a LC 197/2018 e está publicado como norma em vigor no site do
   IVISA-Rio. O roteiro do codex acertou a citação. Isso não valida o resto daquele roteiro —
   valida só esta norma.
2. **A hipótese de que o município do Rio não tem legislação sanitária própria para
   estética/embelezamento é REFUTADA.** O Rio tem código sanitário municipal próprio (LC
   197/2018), regulamento administrativo próprio (Decreto Rio 57.501/2026) e um órgão
   municipal específico (IVISA-Rio) que licencia e fiscaliza nominalmente salão, barbearia,
   manicure, depilação, estética, tatuagem, massagem e podologia, pela modalidade **LSAR**.

**Consequência direta para o Card 7, passo 2: `src/data/estetica/suplemento-rj.ts` deve nascer
com itens.** O que ele precisa conter, pela tabela de dedup do handoff:

- **Caso (b) — local mais restritiva:** o item federal de licença sanitária é substituído
  (`replacesItemId`) pelo item RJ, que soma os prazos municipais verificáveis: licenciamento
  solicitado em até 30 dias após o alvará e **revalidação até o último dia útil de abril**. A
  base legal do item passa a citar as duas — RDC 63/2011, art. 10 **e** Decreto Rio
  nº 57.501/2026.
- **Caso (d) — exigência que a federal não trata:** modalidade correta de licença (LSF para a
  clínica classificada como serviço de saúde; **LSAR** para o estabelecimento de embelezamento),
  conforme o art. 9º do Decreto Rio nº 57.501/2026.
- **Estado (SES/RJ 1.822/2019):** entra **só no roteiro de clínica**, no item de documentação
  para regularização/revalidação (prazo estadual de 30 de abril). **Não** gera item no roteiro
  de embelezamento — a resolução estadual não alcança essas categorias.

**Isto resolve o problema do licenciamento cobrado 3× no roteiro do codex** (itens 1.1/8.1/9.1):
vira **um único item**, no suplemento RJ, pelo caso (b).

### Pendências honestas desta rodada

- **Decreto Rio nº 57.501/2026:** o PDF oficial do IVISA-Rio é imagem comprimida e a extração
  automática devolveu conteúdo de outro decreto. As obrigações acima vieram da **página oficial
  de licenciamento do IVISA-Rio**, que cita o art. 9º e os prazos. **Antes de escrever o
  `suplemento-rj.ts` (Card 7), abrir o PDF manualmente e conferir o art. 9º** — os prazos estão
  seguros, a lista de modalidades por tipo de estabelecimento não foi lida no texto do decreto.
- **Resolução SES/RJ nº 1.822/2019:** duas datas circulam (09/03 e 19/03/2019). O texto no
  sistema da própria SES/RJ diz **19 de março de 2019, DOE de 28/03/2019** — é essa que vale;
  a página de notícias da SES/RJ que traz 09/03 está errada.
- **ABNT NBR 9050 e NBR 13534:** o catálogo da ABNT é pago e não abre para leitura. A edição
  vigente foi confirmada por conselho profissional oficial (Confea) e por publicação de CAU,
  não pela página do catálogo. Suficiente para citar a norma; **não** suficiente para citar
  item numerado dela no roteiro.
- **Cards 2 e 3 não incluem verificação de legislação municipal de resíduos** (licença
  ambiental da coletora é exigência da RDC 222/2018, mas o órgão licenciador é estadual/
  municipal) — se o roteiro pedir número de licença ambiental, isso precisa de uma linha nova.
