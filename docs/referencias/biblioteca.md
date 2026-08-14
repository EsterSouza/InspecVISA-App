# Biblioteca de legislações — REF-02

**Última verificação de vigência:** 05/08/2026 · **Fonte de verdade:**
[`src/data/legislationLibrary.ts`](../../src/data/legislationLibrary.ts)

Este documento é a evidência da checagem exigida pelo card REF-02 ("verificar vigência antes de
cadastrar"). A tabela abaixo é gerada a partir da biblioteca em código; se a biblioteca mudar,
este arquivo precisa ser regerado junto.

## Como a biblioteca se liga aos roteiros

O item do roteiro cita a norma em texto livre (`legislation`, ex.: `"Art. 8º, RDC 502/2021; Art.
276, Lei Municipal 1.812/2014"`). A biblioteca é quem sabe a URL oficial. A cola entre os dois é a
**chave canônica** de `src/utils/legislationRefs.ts`:

```
"RDC 502/2021"  ─┐
"RDC nº 502/21"  ├─→  RDC|502|2021  ─→  entrada da biblioteca  ─→  URL oficial
"RDC ANVISA nº 502/2021" ─┘
```

Consequências práticas:

- Nenhum item precisa carregar a URL. `checklist_items.legislation_url` continua existindo como
  **override manual**, mas quando está vazio o app resolve pela biblioteca
  (`legislationUrlForItem`). Foi por isso que os mapas `URLS` duplicados nos roteiros de estética
  puderam ser removidos.
- Corrigir uma URL na biblioteca corrige todos os itens que citam aquela norma, de uma vez.
- O teste `src/__tests__/data/legislationLibrary.test.ts` trava o invariante: **todo item legal,
  nos 6 roteiros e nos 4 suplementos regionais, resolve uma URL**.

## Método da verificação

Para cada ato: busca pela situação atual (vigente / vigente com alterações / revogada), preferindo
fonte oficial — planalto.gov.br, bvsms.saude.gov.br (Saúde Legis), in.gov.br, gov.br do órgão e os
portais dos entes federativos. Nenhuma norma foi citada de memória.

Dois achados de vigência mudaram o conteúdo dos roteiros, e não só da biblioteca:

| Achado | Onde estava | O que foi feito |
|---|---|---|
| **Resolução COFEN nº 358/2009 está revogada** pela Resolução COFEN nº 736/2024, que também trocou "SAE" por "Processo de Enfermagem" | `bh-enf-003`, no suplemento de Belo Horizonte — norma revogada citada como vigente num roteiro em uso | Citação e descrição atualizadas para a 736/2024 |
| **Decreto 9.013/2017 (RIISPOA) NÃO foi revogado** pelo Decreto 10.468/2020, que apenas o altera | Risco de trocar a norma por engano; a primeira busca sugeriu "superseded" | Mantido como vigente com alterações, com a ressalva registrada na ementa |

## Atos catalogados

| Ato | Ementa | Vigência (05/08/2026) | Abrangência | Segmentos | Fonte |
|---|---|---|---|---|---|
| ABNT NBR 13534 | Instalações elétricas de baixa tensão — requisitos específicos para estabelecimentos assistenciais de saúde. Versão vigente: 2008. | Vigente | Federal | saude, estetica | [texto oficial](https://www.abntcatalogo.com.br/pnm.aspx?Q=czJRSjEzNTM0) |
| ABNT NBR 9050 | Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos. Versão vigente: NBR 9050:2020, versão corrigida de 25/01/2021. | Vigente | Federal | ilpi, saude, estetica | [texto oficial](https://www.abntcatalogo.com.br/pnm.aspx?Q=czJRSjkwNTA=) |
| CBO 5162-10 - Cuidador de Idosos | Descrição da ocupação de cuidador de idosos na Classificação Brasileira de Ocupações. | Vigente | Federal | ilpi | [texto oficial](https://cbo.mte.gov.br/cbosite/pages/pesquisas/BuscaPorTitulo.jsf) |
| Decreto Federal nº 9.013/2017 | RIISPOA — Regulamento da Inspeção Industrial e Sanitária de Produtos de Origem Animal; base do registro SIF/SIE/SIM. Alterado pelo Decreto 10.468/2020, não revogado. | Vigente com alterações | Federal | alimentos | [texto oficial](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/decreto/d9013.htm) |
| Decreto Federal nº 94.406/1987 | Regulamenta a Lei 7.498/1986 (exercício da enfermagem) e delimita as atribuições de enfermeiro, técnico e auxiliar. | Vigente | Federal | ilpi, saude | [texto oficial](https://www.planalto.gov.br/ccivil_03/decreto/1980-1989/d94406.htm) |
| Decreto Municipal 1.601/1992 (RJ Capital) | Aprova o Regulamento de Alimentos do Município do Rio de Janeiro. | Vigente com alterações | RJ | alimentos | [texto oficial](http://www.rio.rj.gov.br/dlstatic/storage/proprio/arquivo/8/9/8/3134/Decreto1601.pdf) |
| Decreto Municipal nº 17.944/2022 - Belo Horizonte | Regulamenta os procedimentos para concessão do Alvará de Autorização Sanitária em Belo Horizonte. | Vigente | MG | — | [texto oficial](https://www.legisweb.com.br/legislacao/?legislacao=430959) |
| Decreto Rio nº 45.585/2018 | Regulamento administrativo do Código de Vigilância Sanitária do município do Rio de Janeiro: licenciamento sanitário e procedimentos fiscalizatórios. | Vigente com alterações | RJ | alimentos, saude, estetica, ilpi | [texto oficial](http://www.rio.rj.gov.br/dlstatic/10112/10308893/4263216/DecretoRio455852018CONSOLIDADO06122019.pdf) |
| Decreto Rio nº 57.501/2026 | Código Sanitário do município do Rio de Janeiro. | Vigente | RJ | — | [texto oficial](https://vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2026/04/Decreto-N%C2%B0-57501_2026.pdf) |
| Lei Complementar nº 123/2006 | Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte; base do tratamento diferenciado em obrigações acessórias. | Vigente com alterações | Federal | — | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm) |
| Lei Estadual nº 16.140/2007 - Goiás | Dispõe sobre o SUS no Estado de Goiás e sobre a organização, fiscalização e controle das ações e serviços de saúde nas esferas estadual e municipal. | Vigente com alterações | GO | ilpi, saude, estetica, alimentos | [texto oficial](https://legisla.casacivil.go.gov.br/pesquisa_legislacao/86552/lei-16140) |
| Lei Federal nº 10.741/2003 | Estatuto da Pessoa Idosa; direitos da pessoa idosa e deveres das instituições de atendimento. | Vigente com alterações | Federal | ilpi | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741compilado.htm) |
| Lei Federal nº 13.589/2018 | Obriga edifícios de uso público e coletivo com climatização artificial a manter Plano de Manutenção, Operação e Controle (PMOC). | Vigente | Federal | saude, estetica, ilpi, alimentos | [texto oficial](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13589.htm) |
| Lei Federal nº 13.709/2018 | Lei Geral de Proteção de Dados Pessoais (LGPD); disciplina o tratamento de dados de saúde e o acesso ao prontuário. | Vigente com alterações | Federal | saude, estetica, ilpi | [texto oficial](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) |
| Lei Federal nº 14.423/2022 | Atualiza a nomenclatura legal de "idoso" para "pessoa idosa" no Estatuto da Pessoa Idosa. | Vigente | Federal | ilpi | [texto oficial](https://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2022/Lei/L14423.htm) |
| Lei Federal nº 14.602/2023 | Altera a Lei do Exercício da Enfermagem para garantir local de descanso à equipe de enfermagem. | Vigente | Federal | ilpi, saude | [texto oficial](https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2023/Lei/L14602.htm) |
| Lei Federal nº 6.360/1976 | Vigilância sanitária a que ficam sujeitos os medicamentos, cosméticos, saneantes e produtos correlatos; exige regularização junto à Anvisa. | Vigente com alterações | Federal | saude, estetica | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/l6360.htm) |
| Lei Federal nº 6.437/1977 | Configura infrações à legislação sanitária federal e estabelece as sanções respectivas. | Vigente com alterações | Federal | — | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/l6437.htm) |
| Lei Federal nº 8.078/1990 | Código de Defesa do Consumidor; base do dever de informação e do termo de consentimento na relação com o cliente. | Vigente com alterações | Federal | saude, estetica, ilpi | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm) |
| Lei Federal nº 8.080/1990 | Lei Orgânica da Saúde; organiza o SUS e as ações de promoção, proteção e recuperação da saúde. | Vigente com alterações | Federal | — | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/l8080.htm) |
| Lei Federal nº 8.742/1993 | Lei Orgânica da Assistência Social (LOAS); organiza a assistência social e disciplina o registro das entidades no CNAS. | Vigente com alterações | Federal | ilpi | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/l8742compilado.htm) |
| Lei Federal nº 8.842/1994 | Institui a Política Nacional do Idoso e orienta ações de autonomia, integração e participação social. | Vigente com alterações | Federal | ilpi | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/l8842.htm) |
| Lei Federal nº 9.294/1996 | Restringe o uso de produtos fumígenos; com a redação da Lei 12.546/2011, proíbe fumar em recinto coletivo fechado. | Vigente com alterações | Federal | saude, estetica, ilpi, alimentos | [texto oficial](https://www.planalto.gov.br/ccivil_03/leis/l9294.htm) |
| Lei Municipal nº 1.812/2014 - Senador Canedo | Institui o Código Sanitário do Município de Senador Canedo (GO); base municipal do licenciamento e da fiscalização sanitária local. | Vigente | GO | ilpi, saude, estetica, alimentos | [texto oficial](https://leismunicipais.com.br/a/go/s/senador-canedo/lei-ordinaria/2014/182/1812/lei-ordinaria-n-1812-2014-institui-o-codigo-sanitario-do-municipio-de-senador-canedo-e-da-outras-providencias) |
| Lei Municipal nº 7.031/1996 - Belo Horizonte | Institui o Código Sanitário Municipal de Belo Horizonte. | Vigente com alterações | MG | — | [texto oficial](https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1996/704/7031/lei-ordinaria-n-7031-1996-dispoe-sobre-a-normatizacao-complementar-dos-procedimentos-relativos-a-saude-pelo-codigo-sanitario-municipal-e-da-outras-providencias) |
| Lei Municipal nº 7.930/1999 - Belo Horizonte | Institui a Política Municipal do Idoso em Belo Horizonte. | Vigente | MG | ilpi | [texto oficial](https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1999/793/7930/lei-ordinaria-n-7930-1999-institui-a-politica-municipal-do-idoso) |
| Lei Municipal RJ nº 8.618/2024 | Obriga sala ou local de descanso para a equipe de enfermagem em estabelecimentos de saúde do município do Rio de Janeiro. | Vigente | RJ | ilpi, saude | [texto oficial](https://www.cofen.gov.br/prefeitura-do-rio-de-janeiro-sanciona-lei-de-descanso-digno-para-a-categoria/) |
| Lei Ordinária RJ nº 8.049/2018 | Estabelece normas para o funcionamento das ILPI no âmbito do Estado do Rio de Janeiro. | Vigente | RJ | ilpi | [texto oficial](https://leisestaduais.com.br/rj/lei-ordinaria-n-8049-2018-rio-de-janeiro-estabelece-normas-para-o-funcionamento-das-instituicoes-de-longa-permanencia-de-idosos-ilpis-no-ambito-do-estado-do-rio-de-janeiro) |
| Nota Técnica Anvisa nº 2/2024 | Esclarece a aplicação das normas sanitárias aos serviços de estética e delimita a fronteira entre embelezamento e serviço de saúde. Substitui a NT 15/2023. | Vigente | Federal | estetica | [texto oficial](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos) |
| NR-1 | Disposições gerais de Segurança e Saúde no Trabalho e gerenciamento de riscos ocupacionais (PGR). | Vigente com alterações | Federal | saude, estetica, ilpi, alimentos | [texto oficial](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1) |
| NR-10 | Segurança em instalações e serviços em eletricidade; medidas de controle e sistemas preventivos. | Vigente com alterações | Federal | saude, estetica, ilpi, alimentos | [texto oficial](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-10) |
| NR-24 | Condições sanitárias e de conforto nos locais de trabalho: sanitários, vestiário e guarda de pertences. | Vigente com alterações | Federal | saude, estetica, ilpi, alimentos | [texto oficial](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-24) |
| NR-32 | Segurança e Saúde no Trabalho em Serviços de Saúde; risco biológico, vacinação ocupacional e perfurocortantes. | Vigente com alterações | Federal | saude, estetica, ilpi | [texto oficial](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-32) |
| NR-6 | Equipamento de Proteção Individual (EPI); obriga o fornecimento gratuito e o registro de entrega, com CA válido. | Vigente com alterações | Federal | saude, estetica, ilpi, alimentos | [texto oficial](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-6) |
| NR-7 | Programa de Controle Médico de Saúde Ocupacional (PCMSO); exames admissional, periódico e demissional. | Vigente com alterações | Federal | saude, estetica, ilpi, alimentos | [texto oficial](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-7) |
| Parecer COFEN nº 022/2022 | Trata da capacitação de cuidador leigo pelo enfermeiro em assistência específica no domicílio. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/parecer-de-camara-tecnica-no-0081-2021-ctln-cofen/) |
| Portaria 2619/2011 (SP Capital) | Regulamento Técnico de Boas Práticas para alimentos no município de São Paulo. | Vigente | SP | alimentos | [texto oficial](https://www.prefeitura.sp.gov.br/cidade/secretarias/upload/chamadas/portaria_2619_2011_1323348123.pdf) |
| Portaria CVS 5/2013 | Boas práticas para estabelecimentos comerciais de alimentos e serviços de alimentação no Estado de São Paulo. | Vigente | SP | alimentos | [texto oficial](https://www.cvs.saude.sp.gov.br/zip/A_Portaria%20CVS%205_2013.pdf) |
| Portaria de Consolidação GM/MS nº 4/2017 | Consolida as normas sobre os sistemas e subsistemas do SUS; o Anexo V traz a Lista Nacional de Notificação Compulsória, atualizada em 2026. | Vigente com alterações | Federal | saude, estetica, ilpi | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0004_03_10_2017.html) |
| Portaria GM/MS nº 888/2021 | Padrão de potabilidade e procedimentos de controle e vigilância da qualidade da água para consumo humano (Anexo XX da PRC 5/2017). | Vigente | Federal | saude, estetica, ilpi, alimentos | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/gm/2021/prt0888_07_05_2021.html) |
| Portaria IVISA-RIO nº 002/2020 | Regulamento técnico de Boas Práticas para estabelecimentos de alimentos no município do Rio de Janeiro; complementa a RDC 216/2004. | Vigente | RJ | alimentos | [texto oficial](https://vigilanciasanitaria.prefeitura.rio/licenciamento-sanitario/licenciamento-sanitario-legislacao/) |
| Portaria SMS nº 12/2015 - Belo Horizonte | Padrão mínimo de funcionamento das ILPI no município de Belo Horizonte. | Vigente | MG | ilpi | [texto oficial](https://www.legisweb.com.br/legislacao/?id=283029) |
| Portaria SMSA/SUS-BH nº 0221/2022 | Procedimentos do licenciamento sanitário e classificação de risco em Belo Horizonte. | Vigente | MG | — | [texto oficial](https://visabh.webnode.page/portarias-visa-bh-/) |
| Portaria SVS/MS nº 344/1998 | Regulamento Técnico sobre substâncias e medicamentos sujeitos a controle especial. | Vigente com alterações | Federal | saude, estetica, ilpi | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/svs/1998/prt0344_12_05_1998_rep.html) |
| RDC Anvisa nº 15/2012 | Requisitos de boas práticas para o processamento de produtos para saúde. | Vigente | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2012/rdc0015_15_03_2012.html) |
| RDC Anvisa nº 156/2006 | Dispõe sobre o registro, rotulagem e reprocessamento de produtos médicos; obriga a rotulagem "proibido reprocessar" quando aplicável. | Vigente | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2006/res0156_11_08_2006.html) |
| RDC Anvisa nº 216/2004 | Regulamento Técnico de Boas Práticas para Serviços de Alimentação. Aplica-se a qualquer serviço de alimentação, sem exceção por porte. | Vigente | Federal | alimentos | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html) |
| RDC Anvisa nº 218/2005 | Procedimentos higiênico-sanitários para manipulação de alimentos e bebidas preparados com vegetais. | Vigente | Federal | alimentos | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2005/rdc0218_29_07_2005.html) |
| RDC Anvisa nº 222/2018 | Regulamenta as Boas Práticas de Gerenciamento dos Resíduos de Serviços de Saúde (PGRSS). Substitui a RDC 306/2004, revogada. | Vigente | Federal | ilpi, saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0222_28_03_2018.pdf) |
| RDC Anvisa nº 36/2013 | Institui ações para a segurança do paciente em serviços de saúde. | Vigente | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2013/rdc0036_25_07_2013.html) |
| RDC Anvisa nº 42/2010 | Obrigatoriedade de disponibilização de preparação alcoólica para fricção antisséptica das mãos pelos serviços de saúde. | Vigente | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0042_25_10_2010.html) |
| RDC Anvisa nº 430/2020 | Boas Práticas de Distribuição, Armazenagem e de Transporte de Medicamentos, incluindo controle de temperatura de termolábeis. Alterada pela RDC 653/2022. | Vigente com alterações | Federal | ilpi, saude | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0430_08_10_2020.pdf) |
| RDC Anvisa nº 50/2002 | Regulamento técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde. | Vigente com alterações | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0050_21_02_2002.html) |
| RDC Anvisa nº 502/2021 | Dispõe sobre o funcionamento de Instituição de Longa Permanência para Idosos (ILPI). Revogou as RDC 283/2005 e 94/2007. | Vigente | Federal | ilpi | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0502_27_05_2021.pdf) |
| RDC Anvisa nº 503/2021 | Fixa os requisitos mínimos exigidos para a Terapia de Nutrição Enteral (TNE). | Vigente | Federal | ilpi, saude | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0503_27_05_2021.pdf) |
| RDC Anvisa nº 509/2021 | Dispõe sobre o gerenciamento de tecnologias em saúde em estabelecimentos de saúde, do recebimento ao descarte do equipamento. | Vigente | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0509_27_05_2021.pdf) |
| RDC Anvisa nº 51/2011 | Requisitos mínimos para análise, avaliação e aprovação dos projetos físicos de estabelecimentos de saúde (Projeto Básico de Arquitetura). | Vigente | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/rdc0051_06_10_2011.html) |
| RDC Anvisa nº 56/2009 | Proíbe em todo o território nacional o uso de equipamento de bronzeamento artificial com emissão de radiação ultravioleta para fins estéticos. | Vigente | Federal | estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2009/rdc0056_09_11_2009.html) |
| RDC Anvisa nº 63/2011 | Dispõe sobre os Requisitos de Boas Práticas de Funcionamento para os Serviços de Saúde. | Vigente | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/res0063_25_11_2011.html) |
| RDC Anvisa nº 67/2007 | Boas Práticas de Manipulação de preparações magistrais e oficinais para uso humano em farmácias. É a norma de origem do produto manipulado que a clínica utiliza. | Vigente com alterações | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2007/rdc0067_08_10_2007.html) |
| RDC Anvisa nº 751/2022 | Requisitos sanitários aplicáveis aos serviços de saúde que utilizam equipamentos emissores de radiações ionizantes para diagnóstico. | Vigente | Federal | saude, estetica | [texto oficial](https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-751-de-21-de-setembro-de-2022-430929547) |
| RDC Nº 7/2010 | Requisitos mínimos para o funcionamento de Unidades de Terapia Intensiva. | Vigente | Federal | saude | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0007_24_02_2010.html) |
| RE Anvisa nº 2.605/2006 | Estabelece a lista de produtos médicos enquadrados como de uso único cujo reprocessamento é proibido. | Vigente | Federal | saude, estetica | [texto oficial](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2006/res2605_11_08_2006.html) |
| Resolução CNAS nº 109/2009 | Aprova a Tipificação Nacional dos Serviços Socioassistenciais; enquadra o acolhimento institucional de pessoa idosa na proteção social especial de alta complexidade. | Vigente com alterações | Federal | ilpi | [texto oficial](https://www.mds.gov.br/webarquivos/public/resolucao_cnas_n109_%202009.pdf) |
| Resolução CNDI nº 33/2017 | Diretrizes para o contrato de prestação de serviços entre ILPI ou casa-lar e pessoa idosa. | Vigente | Federal | ilpi | [texto oficial](https://www.gov.br/participamaisbrasil/resolucao-n-33-de-24-de-maio-de-2017) |
| Resolução COFEN nº 450/2013 | Normatiza o procedimento de sondagem vesical no âmbito da equipe de enfermagem. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-04502013-4/) |
| Resolução COFEN nº 557/2017 | Normatiza a atuação da enfermagem no procedimento de aspiração de vias aéreas. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-05572017/) |
| Resolução COFEN nº 582/2018 | Veda a participação do enfermeiro no ensino de práticas privativas de enfermagem em capacitação de cuidador de idosos. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-582-2018_64391.html) |
| Resolução COFEN nº 619/2019 | Normatiza a atuação da enfermagem em sondagem oro/nasogástrica e nasoentérica. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-619-2019/) |
| Resolução COFEN nº 620/2019 | Normatiza as atribuições dos profissionais de enfermagem em Instituição de Longa Permanência para Idosos. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-620-2019/) |
| Resolução COFEN nº 725/2023 | Normas e diretrizes para o sistema de fiscalização dos Conselhos de Enfermagem. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-725-de-15-de-setembro-de-2023/) |
| Resolução COFEN nº 736/2024 | Dispõe sobre a implementação do Processo de Enfermagem. REVOGOU a Resolução COFEN 358/2009 e eliminou o termo "SAE". | Vigente | Federal | ilpi, saude | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-736-de-17-de-janeiro-de-2024/) |
| Resolução COFEN nº 746/2024 | Normatiza a contenção mecânica de pacientes, sob supervisão direta do enfermeiro. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-746-de-20-de-marco-de-2024/) |
| Resolução COFEN nº 787/2025 | Regulamenta a atuação da enfermagem no cuidado a pessoas com lesões cutâneas. | Vigente | Federal | ilpi | [texto oficial](https://www.cofen.gov.br/resolucao-cofen-no-787-de-21-de-agosto-de-2025/) |
| Resolução CREMERJ nº 192/2021 | Disciplina a direção técnica e a responsabilidade técnica médica nos estabelecimentos de saúde do Estado do Rio de Janeiro. | Vigente | RJ | saude, ilpi | [texto oficial](https://www.cremerj.org.br/resolucoes/) |
| Resolução SES/MG nº 7.426/2021 | Regras estaduais de licenciamento sanitário e prazos de liberação em Minas Gerais. | Vigente | MG | — | [texto oficial](https://www.saude.mg.gov.br/wp-content/uploads/2020/11/2.-Resolucao-n-7426_2021%E2%80%AF-1de.pdf) |
| Resolução SES/RJ nº 1.568/2017 | Critérios e procedimentos para o licenciamento sanitário no Estado do Rio de Janeiro. | Vigente | RJ | — | [texto oficial](https://www.saude.rj.gov.br/legislacao) |
| Resolução SES/RJ nº 1.822/2019 | Aprova a relação de documentos para regularização de estabelecimentos sujeitos à vigilância sanitária no Estado do Rio de Janeiro. Revogou a Resolução SES 1.480/2016. | Vigente | RJ | — | [texto oficial](https://sistemas.saude.rj.gov.br/protocoloonline/Documentos/Resolucoes/Res_1822.html) |

## Cobertura

| Medida | Antes do REF-02 | Depois |
|---|---|---|
| Entradas na biblioteca | 42 | **79** — 78 no REF-02, mais a Lei Federal nº 5.991/1973 no REF-04 |
| Atos citados pelos roteiros vivos que estão na biblioteca | 13 de 41 (32%) | **41 de 41 (100%)** |
| Entradas com UF declarada | 10 | **19** |
| Normas regionais sem UF (o app as trataria como federais) | 3 — Decreto Rio 57.501/2026, Lei Municipal RJ 8.618/2024, Portaria SMSA/SUS-BH 0221/2022 | **0** — travado por teste |
| Entradas sem segmento | 16 | 10, e agora por decisão: 4 federais de aplicação geral e 6 licenciamentos regionais que valem para todo segmento daquela UF |
| Itens legais em código sem URL de legislação | 387 (a coluna do item era a única fonte) | **0** — travado por teste, contando os 4 suplementos regionais |
| Itens no banco sem `legislation_url` | 800 de 918 | **53** depois do REF-04 (eram 72), **todos `good_practice`** — item `legal` sem URL: **0** |
| Itens no banco apontando para `datalegis` | 106 | **0** |

A meta "100% dos roteiros vivos" foi escolhida pela Ester em 05/08/2026, entre as três opções
apresentadas com o inventário em mãos.

## O que ficou de fora, e por quê

**Atos citados apenas por roteiro arquivado (5).** Ficam registrados aqui e não foram catalogados,
por decisão de escopo. Se um relatório antigo for regerado, essas normas aparecem na página de
referências com a formatação de fallback (sem ementa) — não somem, graças ao REF-03.

| Ato | Onde é citado | Situação depois do REF-04 (06/08/2026) |
|---|---|---|
| Lei nº 5.991/1973 | [ARQUIVADO] Clínica de Estética e Saúde \| RJ | **Catalogada.** Era lacuna real — ato vigente citado por 2 itens. Ementa e vigência conferidas no Planalto em 06/08 |
| Portaria MS nº 2.616/1998 | [ARQUIVADO] Estética e Beleza (v2027 e anterior) | continua fora |
| RDC nº 864/2024 | [ARQUIVADO] Estética e Beleza (v2027 e anterior) | continua fora |
| Resolução CNS nº 466/2012 | [ARQUIVADO] Estética e Beleza (v2027 e anterior) | **não é mais citada** — os itens de TCLE foram reancorados na Lei nº 8.078/1990, art. 6º, III |
| "Lei do Exercício Profissional" (sem número) | [ARQUIVADO] Estética e Beleza — não é citação catalogável | **não é mais citada** — reancorada na Nota Técnica Anvisa nº 2/2024 |

**O balde `OUTRO`.** Citações sem forma normativa reconhecível — "Boas Práticas", "manual do
fabricante", "Critério técnico de…", "Roteiro MPGO/UTPSS", "ROI ANVISA ILPI". Não são atos; a
maioria ancora itens `good_practice`, que por definição não têm base legal vigente. O teste de
cobertura os exclui explicitamente, e não por acidente.

> **Estar no balde `OUTRO` não autoriza remover a citação.** Decisão da Ester em 06/08/2026 sobre o
> **Roteiro MPGO/UTPSS**, citado por 13 itens do ILPI Goiás sempre ao lado de um ato real: *"o
> roteiro do Ministério Público é muito importante para qualquer ILPI; pode abaixar o peso do item,
> mas não retirar a citação."* O balde diz que a fonte não é ato normativo e por isso não resolve
> URL — não que ela seja descartável. Graças ao REF-03 ela aparece na página de referências com a
> formatação de fallback. Vale avaliar catalogá-la. O mesmo raciocínio protege o "ROI ANVISA ILPI".

**Os itens do ILPI Base Federal que divergem entre banco e código.** Medido de novo em 06/08/2026,
descrição a descrição: **103 no banco, 97 no código, 12 só no banco e 6 só no código** — a contagem
anterior ("6 itens que existem no banco e não no código") estava incompleta. A Resolução CNAS nº
109/2009 apareceu por causa do item de PIA e está catalogada. Os 12 do banco foram conferidos contra
a RDC 502/2021 e **estão bem ancorados** (Arts. 21, 23, 24 II, 29 XIII, 46 IV, 51), então a
reconciliação é trazê-los para `src/data/`, não descartá-los. **É o card REF-05**, e é precondição
da curadoria de `requirement_type` — sem ela, um reseed apaga os 12.

Também em 06/08: **o item de circulações internas (`fed-004`) estava errado no código** — exigia
1,50m nas principais, quando o Art. 25 da RDC 502/2021 exige 1,00m e reserva o 1,50m para o limiar
de corrimão dos dois lados (§ 1º). O banco já estava correto; o código foi alinhado. Nenhuma
inspeção foi julgada pelo texto errado.

## Efeito colateral no inventário do REF-01

As correções de chave canônica (número com ponto de milhar, tipo `RE`, ano de dois dígitos, zeros à
esquerda e artigo solto) mudam o agrupamento de
[`inventario.csv`](inventario.csv), que **não foi regerado** — regerá-lo exige um dump de produção,
e a chave `SUPABASE_SERVICE_ROLE_KEY` do `.env.vercel.production.local` vem vazia do Vercel.

Recomputando a chave sobre o próprio CSV, as 57 linhas do REF-01 viram 54; regerando a partir do
`legislation_name` bruto viram **52**, porque duas fusões só aparecem com o texto original:

| Chave nova | Vinha de | Motivo |
|---|---|---|
| `DECRETO\|45585\|2018` | `DECRETO\|45585\|` | ano "/18" não era lido |
| `PORTARIA\|344\|1998` | `PORTARIA\|344\|` + `PORTARIA\|344\|1998` | "344/98" e "344/1998" eram atos diferentes |
| `NOTA TECNICA\|2\|2024` | `NOTA TECNICA\|2\|2024` + `NOTA TECNICA\|02\|2024` | zero à esquerda |
| `PORTARIA\|2\|2020` | `PORTARIA\|002\|2020` | zero à esquerda |
| `RE\|2605\|2006` | `OUTRO\|2605\|2006` + `OUTRO\|2\|` | tipo `RE` não existia; e "2.605" era cortado no ponto |
| *(deixam de existir)* | `OUTRO\|21\|`, `OUTRO\|51\|` | "Art. 21" solto não é ato |

Para regerar: `node scripts/ref02-dump.mjs` (precisa de service role) e depois
`npx tsx scripts/ref01-build-inventory.ts`.

## Estado em produção — 05/08/2026

Biblioteca carregada (migration `20260805200700`) e backfill aplicado: 834 itens atualizados, 918
lidos, 0 URLs de `datalegis` restantes, 41 URLs distintas em uso — uma por ato. Reexecutar o
backfill não grava nada.

Sobraram **72 itens sem URL, 48 deles marcados como `legal`**. Nenhum cita ato normativo: são
"Boas Práticas", "Legislação Municipal", "Normas do Corpo de Bombeiros". A causa é que
`requirement_type` só foi curado nos roteiros de estética — em `templateService.ts` o padrão é
`'legal'`, então ILPI e alimentos nasceram inteiramente legais. Reclassificar esses 48 é decisão
sanitária, não de código.

---

# REF-07 — a citação passa a vir da curadoria (14/08/2026)

## O que mudou no relatório

1. **A página de referências lista só o que foi usado.** Antes, o passo 1 do
   `PdfPreviewModal` somava as normas citadas nos itens avaliados **com toda a biblioteca
   que casasse UF+segmento**, tudo pré-marcado, e essa lista ia crua para o PDF (tinha
   precedência sobre o extrator filtrado). O relatório citava norma que a inspeção não
   avaliou. Agora vêm marcadas só as citadas pelos itens avaliados; as da UF/segmento
   aparecem numa lista separada, **desmarcadas**.
2. **Autoria e ementa vêm do verbete, nunca de dedução.** `formatABNT` adivinhava o órgão
   por regex sobre o texto do item e carimbava `BRASIL.` em qualquer string. Resultados
   reais no PDF: "BRASIL. Critério técnico de higiene das mãos.", "BRASIL. Manuais do
   Fabricante." e — pior — "BRASIL. Ministério da Saúde. Portaria n. 002", que é a
   **Portaria IVISA-RIO 002/2020, municipal**, citada por 102 itens. Toda essa dedução
   saiu. O campo `authority` é agora a única fonte de órgão, e está preenchido nos 79
   verbetes.
3. **Norma revogada sai das sugestões** e, se algum item ainda a citar, o relatório imprime
   `[REVOGADA — substituída por …]` em vez de tratá-la como vigente. `LegislationStatus`
   ganhou `'revogada'` e o campo `replacedBy`.
4. **UF em texto livre parou de derrubar a legislação estadual.** `isLegislationApplicable`
   só conhecia 'RJ', 'MG' e 'SP'; um cliente cadastrado como "Goias" saía com zero norma
   estadual, sem erro nenhum. Agora usa `toUF()` (`src/utils/state.ts`) com as 27 UFs, e o
   campo Estado do cadastro de cliente virou `<select>`.

## Achados de vigência

### Decreto Rio nº 45.585/2018 — REVOGADO desde 02/02/2026

Art. 72 do **Decreto Rio nº 57.501/2026**: *"Ficam revogados, a partir de 02 de fevereiro de
2026: I - o Decreto Rio nº 45.585, de 27 de dezembro de 2018"*. Conferido no texto do próprio
decreto. Marcado `status: 'revogada'`, `replacedBy: 'Decreto Rio nº 57.501/2026'`.

**Pendência sanitária:** 24 itens de roteiro ainda citam o 45.585. Reapontá-los para o
57.501/2026 exige conferir a correspondência de artigos — é decisão da consultora, não de
código, e mexer no campo `legislation` de um item muda o fundamento da pergunta.

### RDC Anvisa nº 751/2022 — ementa era de outra norma

O verbete descrevia *"requisitos sanitários aplicáveis aos serviços de saúde que utilizam
equipamentos emissores de radiações ionizantes para diagnóstico"* — que é a **RDC 611/2022**.
A 751/2022 dispõe sobre classificação de risco, notificação/registro e rotulagem de
**dispositivos médicos** (conferido no texto oficial, anvisalegis.datalegis.net). Os 5 itens
que a citam falam de regularização de equipamento na Anvisa, então a norma citada estava
certa e só a ementa estava trocada. Corrigida.

## Links — `npx tsx scripts/ref07-valida-links.ts`

O script percorre a biblioteca, faz GET em cada URL e separa **quebrado** (o servidor
respondeu e o documento não está lá) de **inacessível** (a conexão nem se estabeleceu —
costuma ser filtro de saída da rede de quem roda, não link morto). Só o primeiro grupo
derruba o código de saída.

Rodada de 14/08/2026: 79 verificados · **7 quebrados** · 39 inacessíveis · 0 sem URL.

Corrigidos nesta rodada: as URLs de **NR-6, NR-7, NR-10, NR-24 e NR-32** davam 404 — o portal
do MTE mudou o slug de `/nr-32` para `/norma-regulamentadora-no-32-nr-32`. E a URL da RDC
751/2022 (in.gov.br, 404) passou para o texto oficial no datalegis.

**Os 7 que sobraram** precisam de fonte oficial e não foram resolvidos daqui:

| Verbete | Problema |
|---|---|
| Lei Ordinária RJ nº 8.049/2018 | aponta para `leisestaduais.com.br` — **site privado**, 403. Fonte oficial é a ALERJ |
| Lei Municipal nº 1.812/2014 - Senador Canedo | `leismunicipais.com.br`, 403, site privado |
| Lei Municipal nº 7.031/1996 - Belo Horizonte | idem |
| Lei Municipal nº 7.930/1999 - Belo Horizonte | idem |
| Resolução SES/RJ nº 1.568/2017 | aponta para `saude.rj.gov.br/legislacao` — 404, e é **listagem**, não o ato |
| Portaria 2619/2011 (SP Capital) | 404 em `prefeitura.sp.gov.br` |
| Decreto Municipal 1.601/1992 (RJ Capital) | 404 em `rio.rj.gov.br` |

Os quatro primeiros violam também a regra 2 do cabeçalho de `legislationLibrary.ts`: a URL
deve apontar para fonte oficial, e `leismunicipais.com.br`/`leisestaduais.com.br` são
serviços comerciais que exigem sessão.

Nota: o verbete do **Decreto Rio nº 57.501/2026** aponta para um PDF hospedado no site oficial
da vigilância sanitária do Rio, mas o PDF em si é uma impressão do `leis.org`. Responde 200 e o
conteúdo confere; vale trocar pelo D.O.Rio quando houver link estável.

## Lacunas — `npx tsx scripts/ref07-lacunas.ts`

Roda sobre `src/data` (roteiros + suplementos regionais), sem rede nem credencial, e lista o
que os itens citam mas a biblioteca não tem. Como a página de referências passou a exigir
verbete, esta lista é exatamente o que falta cadastrar para a norma voltar a ser citada.

Rodada de 14/08/2026: **79 verbetes · 33 citações sem verbete · 46 itens afetados**.

O resultado desmente o `inventario.csv` (05/08), que apontava 40 chaves sem verbete: aquele
CSV foi gerado antes das correções de chave canônica do REF-02 e nunca foi regerado.
**Nenhuma das 33 lacunas atuais é ato normativo** — RDCs, leis, portarias e notas técnicas
estão todas cadastradas. As lacunas são de dois tipos:

**Documentos reais, valem cadastro** (a regra é curadoria, não formato — roteiro e manual
são fonte legítima desde que verificados):

| Citação | Itens | O que é |
|---|---|---|
| ROI ANVISA ILPI | 6 | Roteiro de Inspeção da Anvisa para ILPI |
| Roteiro MPGO/UTPSS (+ 6 variantes por área) | 12 | Roteiro do Ministério Público de Goiás |
| Legislação Estadual de Goiás — CBMGO | 1 | precisa virar a norma concreta do Corpo de Bombeiros |

**Paráfrases, não são fonte** — ficam fora da página de referências, e o fundamento continua
visível no corpo do item: "Critério técnico de …" (14 itens), "Consenso técnico de …",
"Plano interno de …", "Política interna de …", "manual do fabricante" genérico,
"legislação estadual" genérico.

## Revisão dos itens que citavam o Decreto Rio nº 45.585/2018 (14/08/2026)

Aplicado tanto em `src/data/templates_alimentos*.ts` quanto na tabela `checklist_items`
de produção — os dois estavam com as mesmas 24 citações, todas no roteiro "Serviços de
Alimentação (Município RJ)". Só o campo `legislation_name` mudou: pergunta, id e peso
ficaram iguais, então nenhuma resposta existente foi afetada e nenhum relatório entregue
mudou (os concluídos já ficam congelados por snapshot, REF-06).

**O 57.501/2026 não serve como substituto de conteúdo.** Ele regulamenta licenciamento,
infrações, fiscalização e classificação de risco; seus Anexos I e II são tabelas de risco
por segmento. Os itens citavam a numeração do **roteiro anexo** ao 45.585 (5.5.9, 6.4.1,
7.1 …), que trata de requisito técnico — higienização, temperatura, EPI, controle de
pragas. Reapontar mecanicamente para o 57.501 criaria 24 citações falsas, exatamente o
problema que o REF-07 corrige.

| Situação | Itens | O que foi feito |
|---|---|---|
| Citava o 45.585 **junto com** RDC 216/2004 e/ou Portaria IVISA-RIO 002/2020 | 20 | removida a citação ao decreto revogado; a norma vigente que já estava lá passa a ser a base |
| "Funcionários de caixa não manipulam alimentos" | 1 | passou a citar **Portaria IVISA-RIO 002/2020, Art. 97** — correspondência literal, incluindo o parágrafo único ("Os funcionários responsáveis por essa atividade não devem manipular alimentos preparados") |
| Sem base vigente encontrada | 3 | mantida a citação ao 45.585; o PDF agora imprime `[REVOGADA — substituída por Decreto Rio nº 57.501/2026]` |

**Os 3 pendentes**, marcados com comentário no código:

- `rj-f-087` — "Não possui exposição de gêneros alimentícios fora da área física do
  estabelecimento."
- `rj-exc-010` — "Sistema de recepção de utensílios sujos separado do ponto de distribuição
  de alimentos." Os arts. 28 e 49 da Portaria IVISA-RIO 002/2020 tratam de fluxo ordenado
  sem cruzamento e de barreira entre área limpa e suja, mas a correspondência não é literal.
- `rj-exc-011` — "Identificação ao cliente sobre o franqueamento à visitação da cozinha."
  O art. 7º da Portaria trata de visitantes na área de manipulação, o que não é o mesmo
  requisito.

O texto oficial da Portaria IVISA-RIO 002/2020 está em
`vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2023/03/Portaria-N-I-VISA-Rio-002-11.11.2020.pdf`
— vale trocar a URL do verbete, que hoje aponta para a página de listagem.
