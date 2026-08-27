# Roteiro de alimentos — culinária japonesa e delivery no Município do Rio

Última verificação normativa: **26/08/2026**
Versão operacional do suplemento: **08/2026**

## Arquitetura vigente no InspecVISA

O roteiro selecionável é a **Base Federal de Serviços de Alimentação**. A composição
acrescenta, nesta ordem lógica:

1. módulos do segmento registrados em `foodTypes` (por exemplo, `pescados_crus` e
   `dark_kitchen`);
2. suplemento territorial do Município do Rio de Janeiro;
3. filtro das seções que não pertencem aos segmentos escolhidos;
4. ordenação pelo percurso físico da inspeção.

O roteiro municipal duplicado foi arquivado. Inspeções antigas continuam preservando
seu snapshot; novas inspeções partem da base federal e recebem somente os complementos
aplicáveis.

## Percurso de campo

1. abertura, escopo e regularização;
2. edificação e acesso;
3. recebimento de matérias-primas;
4. estoque seco, refrigerado e congelado;
5. equipamentos e bancadas;
6. produção e prevenção de contaminação cruzada;
7. estação de culinária oriental e pescado cru;
8. conservação pós-preparo e exposição ao consumo;
9. expedição, transporte e delivery;
10. higienização e DML;
11. manipuladores;
12. documentos, registros e encerramento.

Essa ordem é calculada pelos títulos das seções, e não pelos IDs. Portanto, funciona
também quando o roteiro é carregado do Supabase com UUIDs.

## Matriz normativa validada

| Ato | Situação em 26/08/2026 | Aplicação no roteiro | Fonte oficial |
|---|---|---|---|
| RDC Anvisa nº 216/2004 | vigente | base federal de boas práticas dos serviços de alimentação | [Saúde Legis](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html) |
| RDC Anvisa nº 52/2014 | vigente | altera o âmbito e disposições da RDC nº 216/2004 | [Saúde Legis](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2014/rdc0052_29_09_2014.html) |
| RDC Anvisa nº 218/2005 | vigente | alimentos e bebidas preparados com vegetais | [Saúde Legis](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2005/rdc0218_29_07_2005.html) |
| Decreto Federal nº 9.013/2017 | vigente com alterações | procedência e inspeção oficial do pescado | [Planalto](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/decreto/d9013.htm) |
| RDC Anvisa nº 724/2022 | vigente | padrões microbiológicos e sua aplicação | [DOU, p. 205](https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=06%2F07%2F2022&jornal=515&pagina=205) |
| IN Anvisa nº 161/2022 | vigente com alterações | padrões microbiológicos por categoria de alimento | [DOU, p. 235](https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=06%2F07%2F2022&jornal=515&pagina=235) |
| IN Anvisa nº 313/2024 | vigente | altera a IN nº 161/2022 | [DOU, p. 70](https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=05%2F09%2F2024&jornal=515&pagina=70) |
| Decreto Estadual RJ nº 6.538/1983 | vigente com alterações | regulamento estadual de alimentos; aplicação subsidiária no RJ | [texto integral em portal público municipal](https://areal.rj.gov.br/wp-content/uploads/2022/12/DECRETO-LEI-ESTADUAL-6538-83.pdf) |
| Lei Estadual RJ nº 6.551/2013 | vigente | visitação da cozinha, acompanhamento, placa e informação no cardápio | [ALERJ](https://alerjln1.alerj.rj.gov.br/CONTLEI.NSF/c8aa0900025feef6032564ec0060dfff/39c5fbf1e6feb2ad83257c000062c3fa) |
| Lei Complementar Rio nº 197/2018 | vigente | Código Sanitário municipal e licenciamento | [Câmara Municipal](https://e.camara.rj.gov.br/Arquivo/Documents/legislacao/html/C1972018.html) |
| Decreto Rio nº 57.501/2026 | vigente | licenciamento, fiscalização e processo administrativo sanitário | [IVISA-Rio](https://vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2026/04/Decreto-N%C2%B0-57501_2026.pdf) |
| Portaria IVISA-RIO nº 002/2020 | vigente | requisitos técnicos municipais gerais, culinária oriental e transporte | [IVISA-Rio](https://vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2023/03/Portaria-N-I-VISA-Rio-002-11.11.2020.pdf) |

## Escopo do suplemento japonês

As perguntas municipais reproduzem separadamente os arts. 113 e 116 a 128 da
Portaria IVISA-RIO nº 002/2020: equipamento de exposição, hashis, sala exclusiva e
climatizada, superfícies e esteiras, barreira de proteção, higienização, ornamentos,
exposição por até quatro horas, descarte de sobras, acidificação e controle de pH do
arroz, congelamento antiparasitário do pescado de captura em alto-mar e condições do
pescado de cativeiro.

O laudo laboratorial valida a **receita padrão** do arroz temperado. Cada preparação
exige monitoramento de pH; não se exige novo laudo laboratorial para cada lote. Nova
análise laboratorial é exigida quando a receita padrão for alterada.

## Escopo do suplemento de delivery

As perguntas municipais reproduzem separadamente os arts. 75 a 77 e 231 a 243 da
Portaria IVISA-RIO nº 002/2020: controle de tempo e temperatura, recipientes, rotulagem,
registros na expedição e recepção, exclusividade e licenciamento do veículo, caixa
isotérmica ou refrigeração, incompatibilidade de cargas, superfícies, afastamento do
piso, segregação de alimentos crus e prontos, termômetro e registros do percurso.

Lacre inviolável permanece como **boa prática operacional**, peso 2 e não crítica. Não
é apresentado como obrigação federal ou municipal do Rio sem norma específica.

## Critério de criticidade

- **Crítico — peso 10:** desvio com vínculo direto e imediato com inocuidade, como
  temperatura, pH, tratamento antiparasitário, contaminação cruzada, alimento cru sem
  procedência segura, reutilização de sobras ou falha de higienização de alimento pronto.
- **Não crítico — peso 5:** requisito legal estrutural, documental ou de rastreabilidade
  cuja falta precisa de correção, mas não prova por si só risco sanitário imediato.
- **Boa prática — peso 2:** recomendação operacional útil sem ser apresentada como
  obrigação jurídica aplicável.

Licença sanitária e documentos não são classificados automaticamente como críticos.
Durante a inspeção, uma situação concreta pode exigir medida cautelar pela autoridade
sanitária independentemente da pontuação do roteiro.

## Normas e parâmetros não importados

- O Decreto Rio nº 45.585/2018 foi revogado a partir de 02/02/2026 pelo art. 72 do
  Decreto Rio nº 57.501/2026 e não fundamenta item novo.
- O congelamento a -20 °C por sete dias usado em alguns roteiros de outros municípios
  não substitui o parâmetro próprio do Rio: indústria a -20 °C por 24 horas ou -35 °C
  por 15 horas, nos termos do art. 126 da Portaria nº 002/2020.
- O prazo de exposição de sushi no Rio é de quatro horas, não 24 horas.
- Regras de São Paulo e Porto Alegre foram usadas somente para comparar domínios de
  risco e organização de campo; seus parâmetros locais não foram convertidos em
  exigência carioca.

## Fontes comparativas

- [Portaria SMS São Paulo nº 2.619/2011](https://www.prefeitura.sp.gov.br/cidade/secretarias/upload/chamadas/portaria_2619_2011_1323348123.pdf): organização de boas práticas e controles de processo.
- Roteiros e regulamentos municipais de culinária japonesa consultados foram usados
  apenas como lista de verificação de temas. O texto exigível no suplemento é o da
  Portaria IVISA-RIO nº 002/2020 e das demais normas aplicáveis ao Rio.
