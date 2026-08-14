-- REF-07 — autoria curada e situação de vigência na biblioteca de legislações.
--
-- Por que: a citação ABNT do PDF deduzia o órgão por regex sobre o texto do item,
-- o que atribuía ao Ministério da Saúde atos municipais (Portaria IVISA-RIO
-- 002/2020, citada por 102 itens) e carimbava "BRASIL." em qualquer texto solto.
-- A autoria passa a ser dado curado, editável na LegislationsManager; sem ela a
-- norma é citada só pelo nome, e o gerador não deduz órgão nenhum.
--
-- `status` ganha 'revogada' (+ `replaced_by`) para que norma revogada saia das
-- sugestões e o relatório aponte a substituta em vez de citá-la como vigente. O
-- caso concreto é o Decreto Rio nº 45.585/2018, revogado em 02/02/2026 pelo art.
-- 72, I do Decreto Rio nº 57.501/2026 e ainda citado por 24 itens de roteiro.
--
-- GERADO de src/data/legislationLibrary.ts. Reexecutável: casa por nome canônico
-- (saneado pela REF-02), não cria e não apaga linha nenhuma.

alter table public.legislations
  add column if not exists authority text,
  add column if not exists status text,
  add column if not exists replaced_by text;

comment on column public.legislations.authority is
  'Autoria ABNT do ato (ex.: BRASIL. Ministério da Saúde). Única fonte de autoria da citação no PDF.';
comment on column public.legislations.status is
  'vigente | vigente_com_alteracoes | revogada. NULL = ainda não verificado.';
comment on column public.legislations.replaced_by is
  'Ato que substituiu este, quando status = revogada.';

-- ── Autoria e vigência dos 79 verbetes curados ────────────────────────────
-- `authority` só é gravada onde ainda está vazia: a coluna é editável no admin e
-- uma correção feita lá não pode ser desfeita por reexecução.
update public.legislations l set
  authority   = coalesce(l.authority, b.authority),
  status      = b.status,
  replaced_by = b.replaced_by
from (values
  ('RDC Anvisa nº 63/2011', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 50/2002', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente_com_alteracoes', null),
  ('RDC Anvisa nº 51/2011', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 15/2012', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 36/2013', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 222/2018', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 42/2010', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 156/2006', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RE Anvisa nº 2.605/2006', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 56/2009', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 67/2007', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente_com_alteracoes', null),
  ('RDC Anvisa nº 509/2021', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 751/2022', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('Nota Técnica Anvisa nº 2/2024', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Nº 7/2010', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 502/2021', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 503/2021', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 430/2020', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente_com_alteracoes', null),
  ('RDC Anvisa nº 216/2004', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('RDC Anvisa nº 218/2005', 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)', 'vigente', null),
  ('Lei Federal nº 5.991/1973', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 6.360/1976', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 6.437/1977', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 8.078/1990', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 8.080/1990', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 8.742/1993', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 8.842/1994', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 9.294/1996', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 10.741/2003', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 13.589/2018', 'BRASIL', 'vigente', null),
  ('Lei Federal nº 13.709/2018', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Lei Federal nº 14.423/2022', 'BRASIL', 'vigente', null),
  ('Lei Federal nº 14.602/2023', 'BRASIL', 'vigente', null),
  ('Decreto Federal nº 9.013/2017', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Portaria SVS/MS nº 344/1998', 'BRASIL. Ministério da Saúde', 'vigente_com_alteracoes', null),
  ('Portaria de Consolidação GM/MS nº 4/2017', 'BRASIL. Ministério da Saúde', 'vigente_com_alteracoes', null),
  ('Portaria GM/MS nº 888/2021', 'BRASIL. Ministério da Saúde', 'vigente', null),
  ('NR-1', 'BRASIL. Ministério do Trabalho e Emprego', 'vigente_com_alteracoes', null),
  ('NR-6', 'BRASIL. Ministério do Trabalho e Emprego', 'vigente_com_alteracoes', null),
  ('NR-7', 'BRASIL. Ministério do Trabalho e Emprego', 'vigente_com_alteracoes', null),
  ('NR-10', 'BRASIL. Ministério do Trabalho e Emprego', 'vigente_com_alteracoes', null),
  ('NR-24', 'BRASIL. Ministério do Trabalho e Emprego', 'vigente_com_alteracoes', null),
  ('NR-32', 'BRASIL. Ministério do Trabalho e Emprego', 'vigente_com_alteracoes', null),
  ('ABNT NBR 9050', 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS (ABNT)', 'vigente', null),
  ('ABNT NBR 13534', 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS (ABNT)', 'vigente', null),
  ('Portaria IVISA-RIO nº 002/2020', 'RIO DE JANEIRO (Município). Instituto Municipal de Vigilância Sanitária (IVISA-RIO)', 'vigente', null),
  ('Decreto Rio nº 45.585/2018', 'RIO DE JANEIRO (Município)', 'revogada', 'Decreto Rio nº 57.501/2026'),
  ('Decreto Rio nº 57.501/2026', 'RIO DE JANEIRO (Município)', 'vigente', null),
  ('Decreto Municipal 1.601/1992 (RJ Capital)', 'RIO DE JANEIRO (Município)', 'vigente_com_alteracoes', null),
  ('Lei Municipal RJ nº 8.618/2024', 'RIO DE JANEIRO (Município)', 'vigente', null),
  ('Lei Ordinária RJ nº 8.049/2018', 'RIO DE JANEIRO (Estado)', 'vigente', null),
  ('Resolução SES/RJ nº 1.568/2017', 'RIO DE JANEIRO (Estado). Secretaria de Estado de Saúde (SES/RJ)', 'vigente', null),
  ('Resolução SES/RJ nº 1.822/2019', 'RIO DE JANEIRO (Estado). Secretaria de Estado de Saúde (SES/RJ)', 'vigente', null),
  ('Resolução CREMERJ nº 192/2021', 'RIO DE JANEIRO (Estado). Conselho Regional de Medicina do Estado do Rio de Janeiro (CREMERJ)', 'vigente', null),
  ('Lei Estadual nº 16.140/2007 - Goiás', 'GOIÁS (Estado)', 'vigente_com_alteracoes', null),
  ('Lei Municipal nº 1.812/2014 - Senador Canedo', 'SENADOR CANEDO (GO)', 'vigente', null),
  ('Portaria CVS 5/2013', 'SÃO PAULO (Estado). Centro de Vigilância Sanitária (CVS)', 'vigente', null),
  ('Portaria 2619/2011 (SP Capital)', 'SÃO PAULO (Município). Secretaria Municipal da Saúde', 'vigente', null),
  ('Resolução SES/MG nº 7.426/2021', 'MINAS GERAIS (Estado). Secretaria de Estado de Saúde (SES/MG)', 'vigente', null),
  ('Lei Municipal nº 7.031/1996 - Belo Horizonte', 'BELO HORIZONTE (MG)', 'vigente_com_alteracoes', null),
  ('Lei Municipal nº 7.930/1999 - Belo Horizonte', 'BELO HORIZONTE (MG)', 'vigente', null),
  ('Decreto Municipal nº 17.944/2022 - Belo Horizonte', 'BELO HORIZONTE (MG)', 'vigente', null),
  ('Portaria SMS nº 12/2015 - Belo Horizonte', 'BELO HORIZONTE (MG). Secretaria Municipal de Saúde (SMS)', 'vigente', null),
  ('Portaria SMSA/SUS-BH nº 0221/2022', 'BELO HORIZONTE (MG). Secretaria Municipal de Saúde (SMSA/SUS-BH)', 'vigente', null),
  ('Resolução CNAS nº 109/2009', 'BRASIL. Conselho Nacional de Assistência Social (CNAS)', 'vigente_com_alteracoes', null),
  ('Resolução CNDI nº 33/2017', 'BRASIL. Conselho Nacional dos Direitos da Pessoa Idosa (CNDI)', 'vigente', null),
  ('CBO 5162-10 - Cuidador de Idosos', 'BRASIL. Ministério do Trabalho e Emprego', 'vigente', null),
  ('Decreto Federal nº 94.406/1987', 'BRASIL', 'vigente', null),
  ('Lei Complementar nº 123/2006', 'BRASIL', 'vigente_com_alteracoes', null),
  ('Resolução COFEN nº 450/2013', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Resolução COFEN nº 557/2017', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Resolução COFEN nº 619/2019', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Resolução COFEN nº 582/2018', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Resolução COFEN nº 620/2019', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Resolução COFEN nº 736/2024', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Resolução COFEN nº 725/2023', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Resolução COFEN nº 746/2024', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Resolução COFEN nº 787/2025', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null),
  ('Parecer COFEN nº 022/2022', 'BRASIL. Conselho Federal de Enfermagem (COFEN)', 'vigente', null)
) as b(name, authority, status, replaced_by)
where l.name = b.name;

-- ── Ementa e URL corrigidas nesta rodada ────────────────────────────────────
-- Só estes verbetes. A ementa da RDC 751/2022 cadastrada era a da RDC 611/2022
-- (radiologia diagnóstica); as URLs das NRs davam 404 desde que o portal do MTE
-- trocou o slug de "/nr-32" para "/norma-regulamentadora-no-32-nr-32".
update public.legislations l set
  summary = b.summary,
  url     = b.url
from (values
  ('RDC Anvisa nº 751/2022', 'Dispõe sobre a classificação de risco, os regimes de notificação e de registro, e os requisitos de rotulagem e instruções de uso de dispositivos médicos. Substituiu as RDC 185/2001, 15/2014 e 40/2015.', 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000751&seqAto=000&valorAno=2022&orgao=RDC%2FDC%2FANVISA%2FMS&codTipo=&desItem=&desItemFim=&cod_menu=1696&cod_modulo=134&pesquisa=true'),
  ('NR-6', 'Equipamento de Proteção Individual (EPI); obriga o fornecimento gratuito e o registro de entrega, com CA válido.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-6-nr-6'),
  ('NR-7', 'Programa de Controle Médico de Saúde Ocupacional (PCMSO); exames admissional, periódico e demissional.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-7-nr-7'),
  ('NR-10', 'Segurança em instalações e serviços em eletricidade; medidas de controle e sistemas preventivos.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-10-nr-10'),
  ('NR-24', 'Condições sanitárias e de conforto nos locais de trabalho: sanitários, vestiário e guarda de pertences.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-24-nr-24'),
  ('NR-32', 'Segurança e Saúde no Trabalho em Serviços de Saúde; risco biológico, vacinação ocupacional e perfurocortantes.', 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-32-nr-32')
) as b(name, summary, url)
where l.name = b.name;
