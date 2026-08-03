# Legislação verificada — roteiros de Estética

Produto dos Cards 1-4 do [HANDOFF.md](HANDOFF.md). Cada linha desta tabela é pré-requisito
para que a norma possa ser citada nos roteiros escritos nos Cards 5, 6 e 7.

**Regra absoluta (herdada da skill `visa-legislacao-sanitaria`): nenhuma linha aqui foi escrita
de memória.** Cada uma tem URL de fonte oficial e data de consulta. Norma sem fonte não entra
no roteiro.

## Método e ressalvas desta rodada

- **Fonte primária de vigência: AnvisaLegis** (`anvisalegis.datalegis.net`), portal oficial de
  legislação da Anvisa lançado em dez/2024. Ele exibe um marcador de situação
  (`Vigente` / `Vigente com Alterações` / `Revogado`) no cabeçalho de cada ato.
- **`bvsms.saude.gov.br` está fora do ar** (ECONNRESET e bloqueio de navegação nas duas vias
  testadas — mesma falha já registrada em `MedSpace Studio 3D/LEGISLACAO-MATERIAIS.md` em
  jul/2026). Onde o bvsms seria a fonte natural, a verificação usou o AnvisaLegis, o portal
  `gov.br/anvisa` ou o `planalto.gov.br`, e isso está dito na linha.
- **Lacuna do AnvisaLegis:** alguns atos antigos ainda retornam "Este ato está sendo
  processado" (confirmado para RDC 50/2002 e RDC 42/2010, em `seqAto` 000 e 001, via WebFetch
  e via navegador). Para esses, a vigência foi apurada em página oficial da Anvisa no
  `gov.br` + citação em documento oficial vigente da própria Anvisa, e a linha diz isso.
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
| RDC Anvisa nº 36/2013 | Institui ações para a segurança do paciente em serviços de saúde. | **Sim, com alterações** — AnvisaLegis marca `Vigente com Alterações` | Não revogada. **Art. 12 alterado pela RDC nº 53/2013** (prazos de estruturação do NSP e início das notificações mensais) | Plano de Segurança do Paciente, Núcleo de Segurança do Paciente, protocolos básicos, notificação mensal de eventos adversos. A NT 2/2024 a lista **"nos casos aplicáveis"** — ou seja, o roteiro não pode tratar todo item de RDC 36 como exigência absoluta para clínica de estética de pequeno porte; a redação do item precisa dizer o que é verificável | **Sim**, nos casos aplicáveis | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000036&seqAto=000&valorAno=2013&orgao=RDC%2FDC%2FANVISA%2FMS&cod_modulo=310&cod_menu=9434&pesquisa=true | 2026-08-03 |
| RDC Anvisa nº 50/2002 | Regulamento técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde. | **Sim, parcialmente revogada.** AnvisaLegis ainda não processou o ato ("Este ato está sendo processado"); a Anvisa a mantém na página oficial de legislação de serviços de saúde | **Itens 1.2.2.1 (Projeto Básico de Arquitetura), 1.3 (Responsabilidades) e 1.6 (Avaliação de Projetos) revogados pela RDC nº 51/2011** | Requisitos de ambientes, dimensões, acabamentos e instalações. Critério de acabamento é **de desempenho, não de material** (resistente a lavagem e desinfetante; superfície monolítica; absorção de água ≤ 4% em área crítica, inclusive o rejunte) — ver `MedSpace Studio 3D/LEGISLACAO-MATERIAIS.md` | **Sim** | **Não** diretamente — para serviço de interesse para a saúde a NT 2/2024 (item 1, "i") condiciona a exigência de projeto básico à atividade e à classificação de risco da IN 66/2020 c/c RDC 153/2017 | https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/seguranca-do-paciente/legislacao | 2026-08-03 |
| **RDC Anvisa nº 51/2011** *(não estava no card; entra por ser a norma que revogou parte da RDC 50)* | Requisitos para análise, avaliação e aprovação dos projetos físicos de estabelecimentos de saúde pelo SNVS. | **Sim** — consta na página oficial de legislação de serviços de saúde da Anvisa | — | É **esta** a norma que hoje rege o Projeto Básico de Arquitetura (PBA) e sua aprovação pela vigilância — não o item 1.2.2.1 da RDC 50/2002, que está revogado | **Sim** | **Não** (mesma ressalva da RDC 50) | https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/seguranca-do-paciente/legislacao | 2026-08-03 |
| Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA | Esclarecimentos sobre os serviços de estética e o atendimento às normas sanitárias aplicáveis a esses serviços. | **Sim** — publicada em 02/02/2024 e hospedada pela Anvisa na seção **"notas técnicas vigentes"**; substitui a NT nº 15/2023/GGTES/ANVISA | — (substituiu a NT 15/2023) | **Não é norma — é orientação interpretativa**, e por isso não pode ser citada como "base legal" isolada de um item. O que ela faz e que é decisivo aqui: (a) classifica os estabelecimentos de estética em **serviço de saúde** × **serviço de interesse para a saúde**; (b) afirma que **não existe norma sanitária federal específica para serviços de estética** — aplicam-se normas transversais; (c) lista nominalmente as normas aplicáveis a cada grupo; (d) registra que **esteticista não é profissional de saúde** (Resolução CNS nº 287/1998 não o inclui); (e) proíbe formol alisante e câmara de bronzeamento | **Sim** (define a classificação) | **Sim** (define a classificação) | https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos | 2026-08-03 |
| Portaria de Consolidação nº 4/2017 (GM/MS) | Consolidação das normas sobre os sistemas e os subsistemas do SUS. | **Sim** | — | Relevante à estética por **um** ponto: o **Anexo V, Anexo 1** traz a Lista Nacional de Notificação Compulsória de doenças, agravos e eventos de saúde pública, obrigatória para serviços **públicos e privados**. Lista alterada pela **Portaria GM/MS nº 3.148, de 06/02/2024** (inclusão de HTLV). É a base do item `est-103` do roteiro atual — a citação deve virar "PRC nº 4/2017, Anexo V" e não a portaria inteira | **Sim**, limitado à notificação compulsória | **Sim**, limitado à notificação compulsória (a lista alcança qualquer estabelecimento que identifique agravo notificável) | https://www.gov.br/aids/pt-br/central-de-conteudo/copy_of_portarias/2017/portaria_consolidacao_no_4_28_09_2017.pdf/view · alteração: https://bvsms.saude.gov.br/bvs/saudelegis/gm/2024/prt3148_15_02_2024.html | 2026-08-03 |
| Portaria MS nº 2.616, de 12/05/1998 | Diretrizes e normas para prevenção e controle das infecções hospitalares (PCIH). | **Sim** — AnvisaLegis marca `Vigente`. **A suspeita do card de que teria sido absorvida pela Portaria de Consolidação é refutada**: o ato segue listado como vigente e não aparece como revogado por consolidação | — | Programa de Controle de Infecção Hospitalar, CCIH, conceitos de infecção e vigilância epidemiológica de IRAS. **Ressalva de aplicabilidade:** a portaria é estruturada para **hospitais** (art. 1º, "hospitais do País"), e a Anvisa **não a inclui** na página de legislação de serviços de saúde. É a base do item `est-112` do roteiro atual, sobre vigilância de eventos adversos e surtos — mas ali a base própria é a RDC 36/2013 + RDC 63/2011, não a 2616 | **Parcialmente** — vigente, porém dirigida a hospital; usar só como reforço conceitual, nunca como base legal isolada de item de clínica de estética | **Não** | https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=POR&numeroAto=00002616&seqAto=000&valorAno=1998&orgao=MS&cod_modulo=310&cod_menu=8542&pesquisa=true | 2026-08-03 |
| RDC Anvisa nº 42/2010 | Obrigatoriedade de disponibilização de preparação alcoólica para fricção antisséptica das mãos pelos serviços de saúde. | **Sim.** AnvisaLegis ainda não processou o ato; consta na página oficial de legislação de serviços de saúde da Anvisa e é citada como aplicável pela NT 2/2024 (item 2.1). Nenhuma evidência de revogação | — | Preparação alcoólica (registrada na Anvisa ou manipulada conforme RDC 67/2007) disponível nos pontos de assistência; dispensadores em cada ponto de assistência ao paciente; cartaz de orientação de higiene das mãos | **Sim** | **Não** — a NT 2/2024 exige higiene e infraestrutura sanitária do serviço de interesse para a saúde, mas não estende a esse grupo a obrigação específica da RDC 42/2010 | https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/seguranca-do-paciente/legislacao | 2026-08-03 |
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

_Pendente._

## Card 3 — Resíduos, trabalho, estrutura

_Pendente._

## Card 4 — RJ estadual e municipal

_Pendente._
