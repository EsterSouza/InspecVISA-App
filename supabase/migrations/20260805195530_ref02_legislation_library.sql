-- REF-02 — carga da biblioteca de legislações saneada.
--
-- GERADO por scripts/ref02-build-migration.ts a partir de
-- src/data/legislationLibrary.ts. Não editar à mão: altere a biblioteca e
-- regenere, senão o código e o banco divergem de novo.
--
-- O que faz:
--   * atualiza as 41 linhas que já existem (ementa, URL oficial, uf, segmentos),
--     casadas por chave canônica — não por nome, porque grafias como
--     "Decreto Nº 57501 DE 30/01/2026" e "Decreto Rio nº 57.501/2026" são o
--     mesmo ato e um upsert por nome criaria duplicata;
--   * insere as 37 entradas novas, de forma idempotente (insert ... where not exists).
--
-- O que NÃO faz, de propósito:
--   * não apaga nenhuma linha. A biblioteca é editável pela LegislationsManager;
--     linha criada pela Ester não pode sumir numa migration. As linhas do banco
--     sem correspondência na biblioteca ficam como estão:
--       OUTRO|| — Constituição da República Federativa do Brasil
--   * não mexe em checklist_items. O backfill de legislation_url é o
--     scripts/ref02-backfill-item-urls.mjs, que reusa a mesma resolução do app.
--
-- Reexecutável: os updates são por id e os inserts são condicionais.

begin;

-- ── Linhas existentes: ementa, URL oficial, UF e segmentos ──────────────────
-- RDC|63|2011  (renomeia: RDC ANVISA nº 63/2011)
update public.legislations set
  name = 'RDC Anvisa nº 63/2011',
  summary = 'Dispõe sobre os Requisitos de Boas Práticas de Funcionamento para os Serviços de Saúde.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/res0063_25_11_2011.html',
  uf = null,
  segments = array['saude', 'estetica']::text[]
where id = '9ce086e8-fce0-4383-a179-bc677b3cdfcf';

-- RDC|50|2002  (renomeia: RDC ANVISA nº 50/2002)
update public.legislations set
  name = 'RDC Anvisa nº 50/2002',
  summary = 'Regulamento técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0050_21_02_2002.html',
  uf = null,
  segments = array['saude', 'estetica']::text[]
where id = '88f74734-dac2-4f9a-bfa9-20c05ceee1f4';

-- RDC|15|2012  (renomeia: RDC ANVISA nº 15/2012)
update public.legislations set
  name = 'RDC Anvisa nº 15/2012',
  summary = 'Requisitos de boas práticas para o processamento de produtos para saúde.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2012/rdc0015_15_03_2012.html',
  uf = null,
  segments = array['saude', 'estetica']::text[]
where id = 'c8b239ac-f650-43c9-9989-cfcdefb7ac2e';

-- RDC|36|2013  (renomeia: RDC ANVISA nº 36/2013)
update public.legislations set
  name = 'RDC Anvisa nº 36/2013',
  summary = 'Institui ações para a segurança do paciente em serviços de saúde.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2013/rdc0036_25_07_2013.html',
  uf = null,
  segments = array['saude', 'estetica']::text[]
where id = '0c6871f2-2e0f-4273-8d59-4f999fa38013';

-- RDC|222|2018  (renomeia: RDC ANVISA nº 222/2018)
update public.legislations set
  name = 'RDC Anvisa nº 222/2018',
  summary = 'Regulamenta as Boas Práticas de Gerenciamento dos Resíduos de Serviços de Saúde (PGRSS). Substitui a RDC 306/2004, revogada.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0222_28_03_2018.pdf',
  uf = null,
  segments = array['ilpi', 'saude', 'estetica']::text[]
where id = '06ecbc90-58a5-4d29-8209-f41a1fa266ea';

-- RDC|751|2022  (renomeia: RDC ANVISA nº 751/2022)
update public.legislations set
  name = 'RDC Anvisa nº 751/2022',
  summary = 'Requisitos sanitários aplicáveis aos serviços de saúde que utilizam equipamentos emissores de radiações ionizantes para diagnóstico.',
  url = 'https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-751-de-21-de-setembro-de-2022-430929547',
  uf = null,
  segments = array['saude', 'estetica']::text[]
where id = '826e9660-e6ec-484b-a2c7-f94ae9360560';

-- RDC|7|2010
update public.legislations set
  name = 'RDC Nº 7/2010',
  summary = 'Requisitos mínimos para o funcionamento de Unidades de Terapia Intensiva.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0007_24_02_2010.html',
  uf = null,
  segments = array['saude']::text[]
where id = '39fe1c06-6d02-44fd-b282-d434b9ff3c57';

-- RDC|502|2021  (renomeia: RDC ANVISA nº 502/2021)
update public.legislations set
  name = 'RDC Anvisa nº 502/2021',
  summary = 'Dispõe sobre o funcionamento de Instituição de Longa Permanência para Idosos (ILPI). Revogou as RDC 283/2005 e 94/2007.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0502_27_05_2021.pdf',
  uf = null,
  segments = array['ilpi']::text[]
where id = '9b5af7b2-4f53-45d9-9b57-092cef99069a';

-- RDC|216|2004  (renomeia: RDC ANVISA nº 216/2004)
update public.legislations set
  name = 'RDC Anvisa nº 216/2004',
  summary = 'Regulamento Técnico de Boas Práticas para Serviços de Alimentação. Aplica-se a qualquer serviço de alimentação, sem exceção por porte.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html',
  uf = null,
  segments = array['alimentos']::text[]
where id = 'ecec061a-bc56-434c-8b05-9706bbd5258c';

-- LEI|6437|1977
update public.legislations set
  name = 'Lei Federal nº 6.437/1977',
  summary = 'Configura infrações à legislação sanitária federal e estabelece as sanções respectivas.',
  url = 'https://www.planalto.gov.br/ccivil_03/leis/l6437.htm',
  uf = null,
  segments = null
where id = '7fffb46e-0ebe-4f9b-b5db-a0d38f1abcd8';

-- LEI|8078|1990
update public.legislations set
  name = 'Lei Federal nº 8.078/1990',
  summary = 'Código de Defesa do Consumidor; base do dever de informação e do termo de consentimento na relação com o cliente.',
  url = 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  uf = null,
  segments = array['saude', 'estetica', 'ilpi']::text[]
where id = '00fd31f3-dc5c-4729-a3cd-20609b7df60b';

-- LEI|8080|1990
update public.legislations set
  name = 'Lei Federal nº 8.080/1990',
  summary = 'Lei Orgânica da Saúde; organiza o SUS e as ações de promoção, proteção e recuperação da saúde.',
  url = 'https://www.planalto.gov.br/ccivil_03/leis/l8080.htm',
  uf = null,
  segments = null
where id = '3c30f258-260a-4fde-b649-b22b883a19a7';

-- LEI|8842|1994
update public.legislations set
  name = 'Lei Federal nº 8.842/1994',
  summary = 'Institui a Política Nacional do Idoso e orienta ações de autonomia, integração e participação social.',
  url = 'https://www.planalto.gov.br/ccivil_03/leis/l8842.htm',
  uf = null,
  segments = array['ilpi']::text[]
where id = 'e22cce96-a538-4883-a039-ce781525d305';

-- LEI|10741|2003
update public.legislations set
  name = 'Lei Federal nº 10.741/2003',
  summary = 'Estatuto da Pessoa Idosa; direitos da pessoa idosa e deveres das instituições de atendimento.',
  url = 'https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741compilado.htm',
  uf = null,
  segments = array['ilpi']::text[]
where id = '1789b058-ee5d-45fc-ade8-11c35f860119';

-- LEI|14423|2022
update public.legislations set
  name = 'Lei Federal nº 14.423/2022',
  summary = 'Atualiza a nomenclatura legal de "idoso" para "pessoa idosa" no Estatuto da Pessoa Idosa.',
  url = 'https://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2022/Lei/L14423.htm',
  uf = null,
  segments = array['ilpi']::text[]
where id = '73ebc7a1-e317-434c-904f-c95a9ff864ee';

-- LEI|14602|2023
update public.legislations set
  name = 'Lei Federal nº 14.602/2023',
  summary = 'Altera a Lei do Exercício da Enfermagem para garantir local de descanso à equipe de enfermagem.',
  url = 'https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2023/Lei/L14602.htm',
  uf = null,
  segments = array['ilpi', 'saude']::text[]
where id = 'c85daa03-c1cf-485b-9659-92f20e41e052';

-- PORTARIA|344|1998
update public.legislations set
  name = 'Portaria SVS/MS nº 344/1998',
  summary = 'Regulamento Técnico sobre substâncias e medicamentos sujeitos a controle especial.',
  url = 'https://bvsms.saude.gov.br/bvs/saudelegis/svs/1998/prt0344_12_05_1998_rep.html',
  uf = null,
  segments = array['saude', 'estetica', 'ilpi']::text[]
where id = '4a4cd390-a864-48e5-bc71-8870566371c3';

-- NR|32|
update public.legislations set
  name = 'NR-32',
  summary = 'Segurança e Saúde no Trabalho em Serviços de Saúde; risco biológico, vacinação ocupacional e perfurocortantes.',
  url = 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-32',
  uf = null,
  segments = array['saude', 'estetica', 'ilpi']::text[]
where id = 'd8e41207-0873-4213-a0b0-f3f2ff8962f2';

-- NBR|9050|
update public.legislations set
  name = 'ABNT NBR 9050',
  summary = 'Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos. Versão vigente: NBR 9050:2020, versão corrigida de 25/01/2021.',
  url = 'https://www.abntcatalogo.com.br/pnm.aspx?Q=czJRSjkwNTA=',
  uf = null,
  segments = array['ilpi', 'saude', 'estetica']::text[]
where id = '6d3f480f-35b8-49e5-b06b-98278daecba3';

-- DECRETO|57501|2026  (renomeia: Decreto Nº 57501 DE 30/01/2026)
update public.legislations set
  name = 'Decreto Rio nº 57.501/2026',
  summary = 'Código Sanitário do município do Rio de Janeiro.',
  url = 'https://vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2026/04/Decreto-N%C2%B0-57501_2026.pdf',
  uf = 'RJ',
  segments = null
where id = '6ae8b52a-a87b-402c-a6eb-1d1de15e61d9';

-- DECRETO|1601|1992
update public.legislations set
  name = 'Decreto Municipal 1.601/1992 (RJ Capital)',
  summary = 'Aprova o Regulamento de Alimentos do Município do Rio de Janeiro.',
  url = 'http://www.rio.rj.gov.br/dlstatic/storage/proprio/arquivo/8/9/8/3134/Decreto1601.pdf',
  uf = 'RJ',
  segments = array['alimentos']::text[]
where id = '0184e2c4-b66e-4614-b75d-65f0b14e3ba8';

-- LEI|8618|2024
update public.legislations set
  name = 'Lei Municipal RJ nº 8.618/2024',
  summary = 'Obriga sala ou local de descanso para a equipe de enfermagem em estabelecimentos de saúde do município do Rio de Janeiro.',
  url = 'https://www.cofen.gov.br/prefeitura-do-rio-de-janeiro-sanciona-lei-de-descanso-digno-para-a-categoria/',
  uf = 'RJ',
  segments = array['ilpi', 'saude']::text[]
where id = '92d27e75-244c-4e71-be35-4a965bdddc30';

-- LEI|8049|2018
update public.legislations set
  name = 'Lei Ordinária RJ nº 8.049/2018',
  summary = 'Estabelece normas para o funcionamento das ILPI no âmbito do Estado do Rio de Janeiro.',
  url = 'https://leisestaduais.com.br/rj/lei-ordinaria-n-8049-2018-rio-de-janeiro-estabelece-normas-para-o-funcionamento-das-instituicoes-de-longa-permanencia-de-idosos-ilpis-no-ambito-do-estado-do-rio-de-janeiro',
  uf = 'RJ',
  segments = array['ilpi']::text[]
where id = 'fa9ebc85-4b9a-46ea-a58d-b2b039098083';

-- RESOLUCAO|1568|2017  (renomeia: Resolução SES Nº 1568/2017 (RJ))
update public.legislations set
  name = 'Resolução SES/RJ nº 1.568/2017',
  summary = 'Critérios e procedimentos para o licenciamento sanitário no Estado do Rio de Janeiro.',
  url = 'https://www.saude.rj.gov.br/legislacao',
  uf = 'RJ',
  segments = null
where id = '36d32187-10a3-4531-90f5-5d11a1773c0e';

-- PORTARIA|5|2013
update public.legislations set
  name = 'Portaria CVS 5/2013',
  summary = 'Boas práticas para estabelecimentos comerciais de alimentos e serviços de alimentação no Estado de São Paulo.',
  url = 'https://www.cvs.saude.sp.gov.br/zip/A_Portaria%20CVS%205_2013.pdf',
  uf = 'SP',
  segments = array['alimentos']::text[]
where id = '40d6dc14-1707-444d-8a62-c34f40a20d91';

-- PORTARIA|2619|2011
update public.legislations set
  name = 'Portaria 2619/2011 (SP Capital)',
  summary = 'Regulamento Técnico de Boas Práticas para alimentos no município de São Paulo.',
  url = 'https://www.prefeitura.sp.gov.br/cidade/secretarias/upload/chamadas/portaria_2619_2011_1323348123.pdf',
  uf = 'SP',
  segments = array['alimentos']::text[]
where id = 'f3f7a46b-7feb-435d-8231-39213eefc754';

-- RESOLUCAO|7426|2021
update public.legislations set
  name = 'Resolução SES/MG nº 7.426/2021',
  summary = 'Regras estaduais de licenciamento sanitário e prazos de liberação em Minas Gerais.',
  url = 'https://www.saude.mg.gov.br/wp-content/uploads/2020/11/2.-Resolucao-n-7426_2021%E2%80%AF-1de.pdf',
  uf = 'MG',
  segments = null
where id = '2b1ab37f-6dd1-4ce9-84b7-2ed8817538e7';

-- LEI|7031|1996
update public.legislations set
  name = 'Lei Municipal nº 7.031/1996 - Belo Horizonte',
  summary = 'Institui o Código Sanitário Municipal de Belo Horizonte.',
  url = 'https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1996/704/7031/lei-ordinaria-n-7031-1996-dispoe-sobre-a-normatizacao-complementar-dos-procedimentos-relativos-a-saude-pelo-codigo-sanitario-municipal-e-da-outras-providencias',
  uf = 'MG',
  segments = null
where id = '3ceeefc4-e5da-4a4f-bec2-f037bcaa0a87';

-- LEI|7930|1999
update public.legislations set
  name = 'Lei Municipal nº 7.930/1999 - Belo Horizonte',
  summary = 'Institui a Política Municipal do Idoso em Belo Horizonte.',
  url = 'https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1999/793/7930/lei-ordinaria-n-7930-1999-institui-a-politica-municipal-do-idoso',
  uf = 'MG',
  segments = array['ilpi']::text[]
where id = '5fa8df23-8b58-4800-ab47-516ebfbf4002';

-- DECRETO|17944|2022
update public.legislations set
  name = 'Decreto Municipal nº 17.944/2022 - Belo Horizonte',
  summary = 'Regulamenta os procedimentos para concessão do Alvará de Autorização Sanitária em Belo Horizonte.',
  url = 'https://www.legisweb.com.br/legislacao/?legislacao=430959',
  uf = 'MG',
  segments = null
where id = 'f44ec428-2308-4457-91a3-c74b1c3a5721';

-- PORTARIA|12|2015
update public.legislations set
  name = 'Portaria SMS nº 12/2015 - Belo Horizonte',
  summary = 'Padrão mínimo de funcionamento das ILPI no município de Belo Horizonte.',
  url = 'https://www.legisweb.com.br/legislacao/?id=283029',
  uf = 'MG',
  segments = array['ilpi']::text[]
where id = 'f8a1e953-a9e1-4d48-9641-6f76aec941ee';

-- PORTARIA|221|2022
update public.legislations set
  name = 'Portaria SMSA/SUS-BH nº 0221/2022',
  summary = 'Procedimentos do licenciamento sanitário e classificação de risco em Belo Horizonte.',
  url = 'https://visabh.webnode.page/portarias-visa-bh-/',
  uf = 'MG',
  segments = null
where id = '34ae3cbb-7d60-4b5d-b561-5ad71987d77d';

-- RESOLUCAO|33|2017
update public.legislations set
  name = 'Resolução CNDI nº 33/2017',
  summary = 'Diretrizes para o contrato de prestação de serviços entre ILPI ou casa-lar e pessoa idosa.',
  url = 'https://www.gov.br/participamaisbrasil/resolucao-n-33-de-24-de-maio-de-2017',
  uf = null,
  segments = array['ilpi']::text[]
where id = '84e2a4ed-1b45-4121-8dfa-e12dc728c206';

-- CBO|5162|
update public.legislations set
  name = 'CBO 5162-10 - Cuidador de Idosos',
  summary = 'Descrição da ocupação de cuidador de idosos na Classificação Brasileira de Ocupações.',
  url = 'https://cbo.mte.gov.br/cbosite/pages/pesquisas/BuscaPorTitulo.jsf',
  uf = null,
  segments = array['ilpi']::text[]
where id = 'b1692068-5748-4ae5-af0b-597ff880e863';

-- RESOLUCAO|450|2013
update public.legislations set
  name = 'Resolução COFEN nº 450/2013',
  summary = 'Normatiza o procedimento de sondagem vesical no âmbito da equipe de enfermagem.',
  url = 'https://www.cofen.gov.br/resolucao-cofen-no-04502013-4/',
  uf = null,
  segments = array['ilpi']::text[]
where id = 'a2d2e21f-e1cc-41a3-bb59-42a26ee4836d';

-- RESOLUCAO|557|2017
update public.legislations set
  name = 'Resolução COFEN nº 557/2017',
  summary = 'Normatiza a atuação da enfermagem no procedimento de aspiração de vias aéreas.',
  url = 'https://www.cofen.gov.br/resolucao-cofen-no-05572017/',
  uf = null,
  segments = array['ilpi']::text[]
where id = 'a814841c-be14-44f1-b8eb-f970fd19d72c';

-- RESOLUCAO|619|2019
update public.legislations set
  name = 'Resolução COFEN nº 619/2019',
  summary = 'Normatiza a atuação da enfermagem em sondagem oro/nasogástrica e nasoentérica.',
  url = 'https://www.cofen.gov.br/resolucao-cofen-no-619-2019/',
  uf = null,
  segments = array['ilpi']::text[]
where id = 'cba03998-630b-476c-87ac-f317e310ba9f';

-- RESOLUCAO|725|2023
update public.legislations set
  name = 'Resolução COFEN nº 725/2023',
  summary = 'Normas e diretrizes para o sistema de fiscalização dos Conselhos de Enfermagem.',
  url = 'https://www.cofen.gov.br/resolucao-cofen-no-725-de-15-de-setembro-de-2023/',
  uf = null,
  segments = array['ilpi']::text[]
where id = 'e58a2001-b794-4c20-bcea-84e8fce9d87b';

-- RESOLUCAO|746|2024
update public.legislations set
  name = 'Resolução COFEN nº 746/2024',
  summary = 'Normatiza a contenção mecânica de pacientes, sob supervisão direta do enfermeiro.',
  url = 'https://www.cofen.gov.br/resolucao-cofen-no-746-de-20-de-marco-de-2024/',
  uf = null,
  segments = array['ilpi']::text[]
where id = '002394ff-0fd3-4483-85e4-c22cbc5ecf12';

-- RESOLUCAO|787|2025
update public.legislations set
  name = 'Resolução COFEN nº 787/2025',
  summary = 'Regulamenta a atuação da enfermagem no cuidado a pessoas com lesões cutâneas.',
  url = 'https://www.cofen.gov.br/resolucao-cofen-no-787-de-21-de-agosto-de-2025/',
  uf = null,
  segments = array['ilpi']::text[]
where id = '7bbe8549-dc6e-4a72-92fc-83f4249c397e';

-- PARECER|22|2022
update public.legislations set
  name = 'Parecer COFEN nº 022/2022',
  summary = 'Trata da capacitação de cuidador leigo pelo enfermeiro em assistência específica no domicílio.',
  url = 'https://www.cofen.gov.br/parecer-de-camara-tecnica-no-0081-2021-ctln-cofen/',
  uf = null,
  segments = array['ilpi']::text[]
where id = '920d4eaa-d278-40ba-8bde-1bc4b018d91a';

-- ── Atos citados pelos roteiros que ainda não estavam na biblioteca ─────────
-- RDC|51|2011
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 51/2011', 'Requisitos mínimos para análise, avaliação e aprovação dos projetos físicos de estabelecimentos de saúde (Projeto Básico de Arquitetura).', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/rdc0051_06_10_2011.html', null, array['saude', 'estetica']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 51/2011');

-- RDC|42|2010
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 42/2010', 'Obrigatoriedade de disponibilização de preparação alcoólica para fricção antisséptica das mãos pelos serviços de saúde.', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0042_25_10_2010.html', null, array['saude', 'estetica']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 42/2010');

-- RDC|156|2006
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 156/2006', 'Dispõe sobre o registro, rotulagem e reprocessamento de produtos médicos; obriga a rotulagem "proibido reprocessar" quando aplicável.', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2006/res0156_11_08_2006.html', null, array['saude', 'estetica']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 156/2006');

-- RE|2605|2006
insert into public.legislations (name, summary, url, uf, segments)
select 'RE Anvisa nº 2.605/2006', 'Estabelece a lista de produtos médicos enquadrados como de uso único cujo reprocessamento é proibido.', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2006/res2605_11_08_2006.html', null, array['saude', 'estetica']::text[]
where not exists (select 1 from public.legislations where name = 'RE Anvisa nº 2.605/2006');

-- RDC|56|2009
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 56/2009', 'Proíbe em todo o território nacional o uso de equipamento de bronzeamento artificial com emissão de radiação ultravioleta para fins estéticos.', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2009/rdc0056_09_11_2009.html', null, array['estetica']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 56/2009');

-- RDC|67|2007
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 67/2007', 'Boas Práticas de Manipulação de preparações magistrais e oficinais para uso humano em farmácias. É a norma de origem do produto manipulado que a clínica utiliza.', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2007/rdc0067_08_10_2007.html', null, array['saude', 'estetica']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 67/2007');

-- RDC|509|2021
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 509/2021', 'Dispõe sobre o gerenciamento de tecnologias em saúde em estabelecimentos de saúde, do recebimento ao descarte do equipamento.', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0509_27_05_2021.pdf', null, array['saude', 'estetica']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 509/2021');

-- NOTA TECNICA|2|2024
insert into public.legislations (name, summary, url, uf, segments)
select 'Nota Técnica Anvisa nº 2/2024', 'Esclarece a aplicação das normas sanitárias aos serviços de estética e delimita a fronteira entre embelezamento e serviço de saúde. Substitui a NT 15/2023.', 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos', null, array['estetica']::text[]
where not exists (select 1 from public.legislations where name = 'Nota Técnica Anvisa nº 2/2024');

-- RDC|503|2021
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 503/2021', 'Fixa os requisitos mínimos exigidos para a Terapia de Nutrição Enteral (TNE).', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0503_27_05_2021.pdf', null, array['ilpi', 'saude']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 503/2021');

-- RDC|430|2020
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 430/2020', 'Boas Práticas de Distribuição, Armazenagem e de Transporte de Medicamentos, incluindo controle de temperatura de termolábeis. Alterada pela RDC 653/2022.', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0430_08_10_2020.pdf', null, array['ilpi', 'saude']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 430/2020');

-- RDC|218|2005
insert into public.legislations (name, summary, url, uf, segments)
select 'RDC Anvisa nº 218/2005', 'Procedimentos higiênico-sanitários para manipulação de alimentos e bebidas preparados com vegetais.', 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2005/rdc0218_29_07_2005.html', null, array['alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'RDC Anvisa nº 218/2005');

-- LEI|6360|1976
insert into public.legislations (name, summary, url, uf, segments)
select 'Lei Federal nº 6.360/1976', 'Vigilância sanitária a que ficam sujeitos os medicamentos, cosméticos, saneantes e produtos correlatos; exige regularização junto à Anvisa.', 'https://www.planalto.gov.br/ccivil_03/leis/l6360.htm', null, array['saude', 'estetica']::text[]
where not exists (select 1 from public.legislations where name = 'Lei Federal nº 6.360/1976');

-- LEI|8742|1993
insert into public.legislations (name, summary, url, uf, segments)
select 'Lei Federal nº 8.742/1993', 'Lei Orgânica da Assistência Social (LOAS); organiza a assistência social e disciplina o registro das entidades no CNAS.', 'https://www.planalto.gov.br/ccivil_03/leis/l8742compilado.htm', null, array['ilpi']::text[]
where not exists (select 1 from public.legislations where name = 'Lei Federal nº 8.742/1993');

-- LEI|9294|1996
insert into public.legislations (name, summary, url, uf, segments)
select 'Lei Federal nº 9.294/1996', 'Restringe o uso de produtos fumígenos; com a redação da Lei 12.546/2011, proíbe fumar em recinto coletivo fechado.', 'https://www.planalto.gov.br/ccivil_03/leis/l9294.htm', null, array['saude', 'estetica', 'ilpi', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'Lei Federal nº 9.294/1996');

-- LEI|13589|2018
insert into public.legislations (name, summary, url, uf, segments)
select 'Lei Federal nº 13.589/2018', 'Obriga edifícios de uso público e coletivo com climatização artificial a manter Plano de Manutenção, Operação e Controle (PMOC).', 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13589.htm', null, array['saude', 'estetica', 'ilpi', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'Lei Federal nº 13.589/2018');

-- LEI|13709|2018
insert into public.legislations (name, summary, url, uf, segments)
select 'Lei Federal nº 13.709/2018', 'Lei Geral de Proteção de Dados Pessoais (LGPD); disciplina o tratamento de dados de saúde e o acesso ao prontuário.', 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm', null, array['saude', 'estetica', 'ilpi']::text[]
where not exists (select 1 from public.legislations where name = 'Lei Federal nº 13.709/2018');

-- DECRETO|9013|2017
insert into public.legislations (name, summary, url, uf, segments)
select 'Decreto Federal nº 9.013/2017', 'RIISPOA — Regulamento da Inspeção Industrial e Sanitária de Produtos de Origem Animal; base do registro SIF/SIE/SIM. Alterado pelo Decreto 10.468/2020, não revogado.', 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/decreto/d9013.htm', null, array['alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'Decreto Federal nº 9.013/2017');

-- PORTARIA|4|2017
insert into public.legislations (name, summary, url, uf, segments)
select 'Portaria de Consolidação GM/MS nº 4/2017', 'Consolida as normas sobre os sistemas e subsistemas do SUS; o Anexo V traz a Lista Nacional de Notificação Compulsória, atualizada em 2026.', 'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0004_03_10_2017.html', null, array['saude', 'estetica', 'ilpi']::text[]
where not exists (select 1 from public.legislations where name = 'Portaria de Consolidação GM/MS nº 4/2017');

-- PORTARIA|888|2021
insert into public.legislations (name, summary, url, uf, segments)
select 'Portaria GM/MS nº 888/2021', 'Padrão de potabilidade e procedimentos de controle e vigilância da qualidade da água para consumo humano (Anexo XX da PRC 5/2017).', 'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2021/prt0888_07_05_2021.html', null, array['saude', 'estetica', 'ilpi', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'Portaria GM/MS nº 888/2021');

-- NR|1|
insert into public.legislations (name, summary, url, uf, segments)
select 'NR-1', 'Disposições gerais de Segurança e Saúde no Trabalho e gerenciamento de riscos ocupacionais (PGR).', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1', null, array['saude', 'estetica', 'ilpi', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'NR-1');

-- NR|6|
insert into public.legislations (name, summary, url, uf, segments)
select 'NR-6', 'Equipamento de Proteção Individual (EPI); obriga o fornecimento gratuito e o registro de entrega, com CA válido.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-6', null, array['saude', 'estetica', 'ilpi', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'NR-6');

-- NR|7|
insert into public.legislations (name, summary, url, uf, segments)
select 'NR-7', 'Programa de Controle Médico de Saúde Ocupacional (PCMSO); exames admissional, periódico e demissional.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-7', null, array['saude', 'estetica', 'ilpi', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'NR-7');

-- NR|10|
insert into public.legislations (name, summary, url, uf, segments)
select 'NR-10', 'Segurança em instalações e serviços em eletricidade; medidas de controle e sistemas preventivos.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-10', null, array['saude', 'estetica', 'ilpi', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'NR-10');

-- NR|24|
insert into public.legislations (name, summary, url, uf, segments)
select 'NR-24', 'Condições sanitárias e de conforto nos locais de trabalho: sanitários, vestiário e guarda de pertences.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-24', null, array['saude', 'estetica', 'ilpi', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'NR-24');

-- NBR|13534|
insert into public.legislations (name, summary, url, uf, segments)
select 'ABNT NBR 13534', 'Instalações elétricas de baixa tensão — requisitos específicos para estabelecimentos assistenciais de saúde. Versão vigente: 2008.', 'https://www.abntcatalogo.com.br/pnm.aspx?Q=czJRSjEzNTM0', null, array['saude', 'estetica']::text[]
where not exists (select 1 from public.legislations where name = 'ABNT NBR 13534');

-- PORTARIA|2|2020
insert into public.legislations (name, summary, url, uf, segments)
select 'Portaria IVISA-RIO nº 002/2020', 'Regulamento técnico de Boas Práticas para estabelecimentos de alimentos no município do Rio de Janeiro; complementa a RDC 216/2004.', 'https://vigilanciasanitaria.prefeitura.rio/licenciamento-sanitario/licenciamento-sanitario-legislacao/', 'RJ', array['alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'Portaria IVISA-RIO nº 002/2020');

-- DECRETO|45585|2018
insert into public.legislations (name, summary, url, uf, segments)
select 'Decreto Rio nº 45.585/2018', 'Regulamento administrativo do Código de Vigilância Sanitária do município do Rio de Janeiro: licenciamento sanitário e procedimentos fiscalizatórios.', 'http://www.rio.rj.gov.br/dlstatic/10112/10308893/4263216/DecretoRio455852018CONSOLIDADO06122019.pdf', 'RJ', array['alimentos', 'saude', 'estetica', 'ilpi']::text[]
where not exists (select 1 from public.legislations where name = 'Decreto Rio nº 45.585/2018');

-- RESOLUCAO|1822|2019
insert into public.legislations (name, summary, url, uf, segments)
select 'Resolução SES/RJ nº 1.822/2019', 'Aprova a relação de documentos para regularização de estabelecimentos sujeitos à vigilância sanitária no Estado do Rio de Janeiro. Revogou a Resolução SES 1.480/2016.', 'https://sistemas.saude.rj.gov.br/protocoloonline/Documentos/Resolucoes/Res_1822.html', 'RJ', null
where not exists (select 1 from public.legislations where name = 'Resolução SES/RJ nº 1.822/2019');

-- RESOLUCAO|192|2021
insert into public.legislations (name, summary, url, uf, segments)
select 'Resolução CREMERJ nº 192/2021', 'Disciplina a direção técnica e a responsabilidade técnica médica nos estabelecimentos de saúde do Estado do Rio de Janeiro.', 'https://www.cremerj.org.br/resolucoes/', 'RJ', array['saude', 'ilpi']::text[]
where not exists (select 1 from public.legislations where name = 'Resolução CREMERJ nº 192/2021');

-- LEI|16140|2007
insert into public.legislations (name, summary, url, uf, segments)
select 'Lei Estadual nº 16.140/2007 - Goiás', 'Dispõe sobre o SUS no Estado de Goiás e sobre a organização, fiscalização e controle das ações e serviços de saúde nas esferas estadual e municipal.', 'https://legisla.casacivil.go.gov.br/pesquisa_legislacao/86552/lei-16140', 'GO', array['ilpi', 'saude', 'estetica', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'Lei Estadual nº 16.140/2007 - Goiás');

-- LEI|1812|2014
insert into public.legislations (name, summary, url, uf, segments)
select 'Lei Municipal nº 1.812/2014 - Senador Canedo', 'Institui o Código Sanitário do Município de Senador Canedo (GO); base municipal do licenciamento e da fiscalização sanitária local.', 'https://leismunicipais.com.br/a/go/s/senador-canedo/lei-ordinaria/2014/182/1812/lei-ordinaria-n-1812-2014-institui-o-codigo-sanitario-do-municipio-de-senador-canedo-e-da-outras-providencias', 'GO', array['ilpi', 'saude', 'estetica', 'alimentos']::text[]
where not exists (select 1 from public.legislations where name = 'Lei Municipal nº 1.812/2014 - Senador Canedo');

-- RESOLUCAO|109|2009
insert into public.legislations (name, summary, url, uf, segments)
select 'Resolução CNAS nº 109/2009', 'Aprova a Tipificação Nacional dos Serviços Socioassistenciais; enquadra o acolhimento institucional de pessoa idosa na proteção social especial de alta complexidade.', 'https://www.mds.gov.br/webarquivos/public/resolucao_cnas_n109_%202009.pdf', null, array['ilpi']::text[]
where not exists (select 1 from public.legislations where name = 'Resolução CNAS nº 109/2009');

-- DECRETO|94406|1987
insert into public.legislations (name, summary, url, uf, segments)
select 'Decreto Federal nº 94.406/1987', 'Regulamenta a Lei 7.498/1986 (exercício da enfermagem) e delimita as atribuições de enfermeiro, técnico e auxiliar.', 'https://www.planalto.gov.br/ccivil_03/decreto/1980-1989/d94406.htm', null, array['ilpi', 'saude']::text[]
where not exists (select 1 from public.legislations where name = 'Decreto Federal nº 94.406/1987');

-- LEI|123|2006
insert into public.legislations (name, summary, url, uf, segments)
select 'Lei Complementar nº 123/2006', 'Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte; base do tratamento diferenciado em obrigações acessórias.', 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm', null, null
where not exists (select 1 from public.legislations where name = 'Lei Complementar nº 123/2006');

-- RESOLUCAO|582|2018
insert into public.legislations (name, summary, url, uf, segments)
select 'Resolução COFEN nº 582/2018', 'Veda a participação do enfermeiro no ensino de práticas privativas de enfermagem em capacitação de cuidador de idosos.', 'https://www.cofen.gov.br/resolucao-cofen-no-582-2018_64391.html', null, array['ilpi']::text[]
where not exists (select 1 from public.legislations where name = 'Resolução COFEN nº 582/2018');

-- RESOLUCAO|620|2019
insert into public.legislations (name, summary, url, uf, segments)
select 'Resolução COFEN nº 620/2019', 'Normatiza as atribuições dos profissionais de enfermagem em Instituição de Longa Permanência para Idosos.', 'https://www.cofen.gov.br/resolucao-cofen-no-620-2019/', null, array['ilpi']::text[]
where not exists (select 1 from public.legislations where name = 'Resolução COFEN nº 620/2019');

-- RESOLUCAO|736|2024
insert into public.legislations (name, summary, url, uf, segments)
select 'Resolução COFEN nº 736/2024', 'Dispõe sobre a implementação do Processo de Enfermagem. REVOGOU a Resolução COFEN 358/2009 e eliminou o termo "SAE".', 'https://www.cofen.gov.br/resolucao-cofen-no-736-de-17-de-janeiro-de-2024/', null, array['ilpi', 'saude']::text[]
where not exists (select 1 from public.legislations where name = 'Resolução COFEN nº 736/2024');

commit;
