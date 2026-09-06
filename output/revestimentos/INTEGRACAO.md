# Preparação para o InspecVISA

Nenhuma alteração no aplicativo, publicação, migração ou implantação foi realizada. Esta entrega é uma biblioteca independente.

## Repositório identificado

Checkout `C:\Saas\App`, remoto `https://github.com/EsterSouza/InspecVISA-App.git`, HEAD consultado `ff41b09afebf9dd161ee90d8f3f2ae4e6933a914`. Não foram encontrados AGENTS.md no checkout nem nos diretórios ascendentes consultados. Não alterar arquivos de outros trabalhos presentes no checkout.

## Conteúdo reutilizável

`biblioteca.json` contém versão, data de revisão, introdução, regras, fichas, encerramento e fontes. Cada ficha tem ID estável, categoria, nome, indicação editorial, campos de uso, limites, especificação, comprovação, inspeção e IDs de critérios. Cada critério contém natureza, dispositivo e fonte. Os status das fichas são editoriais, não respostas de conformidade.

`conteudo.py` é a fonte editorial única. `gerar.py` exporta HTML, Markdown, JSON e PDF. Não editar as exportações separadamente. Os SVG são diagramas sem escala; não servem como detalhe executivo.

## Pontos concretos de integração

1. Criar uma consulta da biblioteca usando `biblioteca.json`, sem acoplar seu acesso a dados de clientes. Reutilizar navegação, componentes e controle de acesso do aplicativo. O HTML fornecido demonstra a interação sem exigir framework novo.
2. Em `src/data/saude/roteiro-servicos-saude.ts`, avaliar o vínculo do item `sau-026` aos critérios de revestimentos e do `sau-027` ao art. 56 da RDC 63/2011. As orientações atuais repetem afirmações do original, como posição obrigatória de cuba e impossibilidade de reparar MDF. Revisar o campo `guidance`; não sobrescrever silenciosamente a descrição ou respostas históricas.
3. Em `src/types/index.ts`, `ChecklistItem` já possui `guidance`, `legislation`, `legislationUrl`, `legislationId` e `requirementType`. Não converter todos os parágrafos da biblioteca em itens pontuáveis. `good_practice` ainda influencia a pontuação no modelo atual; recomendações de escolha devem permanecer como orientação, a menos que haja decisão explícita de produto.
4. `src/data/legislationLibrary.ts` reexporta `@visa/legislacao`. As fontes legais canônicas devem ser atualizadas no repositório do pacote, cuja localização e HEAD precisam ser confirmados antes de alterar; não duplicar verbetes nessa ponte. Os IDs R50/R63/R51 desta entrega são locais, não IDs presumidos do aplicativo.
5. `src/services/templateService.ts` já transporta `guidance` e `requirement_type`. O seed `scripts/seed-roteiro-saude.ts` precisa ser revisado antes de qualquer execução. Não executar seed remoto para simplesmente disponibilizar uma biblioteca de leitura.
6. Reutilizar a base federal e suplementos locais sem duplicação. Manter a classificação de ambiente separada da categoria comercial do cliente. No roteiro atual, serviços de saúde ainda usam a categoria `estetica`; não inventar categoria nova sem revisar os consumidores.

## Registro de evidência recomendado

Manter, por inspeção autorizada, ambiente, atividade, classificação e justificativa, material/fabricante/produto, condição avaliada, documento técnico, achado, foto, critério aplicável, conclusão fundamentada e versão da referência. Ausência de documento não equivale a medição de absorção acima do limite. Não classificar automaticamente por foto ou palavra-chave.

## Verificação antes de publicar no aplicativo

Testar busca com e sem acentos, filtros e navegação por teclado; leitura de referências; resposta histórica preservada; orientação sem mudança indevida de pontuação; acesso autenticado com perfis autorizados; isolamento entre clientes se evidências forem armazenadas. Rodar os testes existentes de integridade e guidance e o build. Só declarar integração ou produção depois de executar e conferir a versão publicada em sessão autenticada.

## Fontes de entrada e correções

Foram lidos os dois anexos atuais; o HTML temporário foi comparado integralmente, sem diferenças de linhas, com o código colado. O artefato Claude abriu posteriormente no navegador e seu conteúdo completo foi lido. Os caminhos antigos sob `C:\Users\miche.codex\attachments` não existem.

Correções principais: retirados veredictos universais por material, percentuais de classes ABNT sem texto integral verificado, estatística inventada de “metade” do semi-grês, exclusividade do rejunte epóxi, junta mínima universal, azulejo/porcelanato até o teto como obrigação, solda química universal, proibições por nome de material, posição obrigatória de cuba, impossibilidade universal de reparo e preços não comprovados. Adicionado art. 56 da RDC 63/2011 para estofados. Preservada a qualificação de C.3 sobre forros que interferem na assepsia.

## Gerar novamente

Usar Python com `reportlab`, `pypdf` e `Pillow`, com fontes Segoe UI disponíveis no Windows. Executar `python gerar.py`. Para visualizar a biblioteca, abrir `index.html`; os arquivos adjacentes devem permanecer juntos. Para servir localmente: `python -m http.server 8769 --bind 127.0.0.1` nesta pasta. Em seguida, `python validar.py`: ele mesmo renderiza `qa/pagina-XX.png` com PyMuPDF, apaga as miniaturas antigas e falha se alguma conferência não passar.

As versões HTML, Markdown e PDF compartilham as fichas e critérios; o PDF referencia critérios por seus títulos e contém links às fontes. A HTML abre o critério correspondente. Alterações futuras exigem nova revisão normativa, não apenas regeneração de arquivos.

## Atualização da edição 2.0

A biblioteca agora inclui areaClasses, context, glossary, costs e costNote no JSON. Não transformar os custos em requisito de inspeção nem a criticidade em enquadramento automático por CNAE. Custos devem manter código, data-base, unidade, escopo e fonte. Fotografias geradas são ilustrativas. Público principal: profissionais de saúde leigos em arquitetura. A integração continua apenas preparada, sem alteração de código do aplicativo.

## Atualização da edição 2.1

O texto de cada ficha passou a viver em `fichas.py`, separado de `conteudo.py`: a estrutura, os critérios e o vínculo normativo continuam em `conteudo.py`, e `fichas.py` traz a redação para leigos que `gerar.py` aplica antes de exportar. Ao reaproveitar `biblioteca.json`, o campo novo é `description` ("o que é"), que antecede `use`.

O JSON ganhou `costRef`, `costUrl`, `priceGaps` e `calculator`. `priceGaps` é o mapa de ficha para o motivo de não haver preço; `calculator` lista, por ficha, a unidade de medida e os índices das referências em `costs`. Ao integrar, manter a regra: ficha tem preço verificado ou motivo escrito da falta, nunca as duas coisas e nunca nenhuma. Não preencher lacuna com estimativa própria e não converter preço em requisito de inspeção.

Os custos passaram a ser da SINAPI do Rio de Janeiro, julho de 2026, sem desoneração e **sem BDI**. A edição anterior trazia valores com BDI de 23,73% embutido: comparar números das duas edições sem observar isso leva a conclusão errada.

## Atualização da edição 2.2

O JSON mudou de forma na parte de custo. Cada item de `costs` deixou de guardar um valor e passou a guardar `key` e `parts`: `parts` é a lista de composições SINAPI que compõem a referência, e o valor sai da soma delas no estado escolhido. Os números vivem em `prices`, um mapa de composição para um dicionário de UF, ao lado de `states`, `defaultState`, `priceReference` e `priceIssued`. Quem integrar precisa calcular, não ler um campo pronto: se qualquer parte faltar naquele estado, a referência inteira não tem valor ali e não pode ser exibida com um número parcial.

`prices` vem de `precos.py`, gerado por `extrair_precos.py` a partir da planilha oficial. Não editar preço à mão em lugar nenhum: o valor precisa ser rastreável até a composição e o mês de referência. Ao mostrar preço, mostrar junto o estado, a referência, a data de emissão e o fato de ser sem desoneração e sem BDI. Sem esses quatro dados o número induz a erro.

`brand` é novo e traz titularidade, CNPJ, autoria, credencial, site, Instagram, endereço, direitos e isenção. Se a biblioteca for exibida dentro do aplicativo, esses dados vão junto: o conteúdo é propriedade intelectual da TreinaVISA e a consulta é livre, mas reprodução, adaptação, redistribuição e uso comercial dependem de autorização por escrito. A isenção também vai junto, porque distingue orientação técnica de ato de vigilância sanitária.

A entrega em rede é a pasta `publicar/`, montada pelo `gerar.py`: index.html, estilo.css, consulta.js e três imagens. O PDF, o Markdown e o JSON ficam fora dela de propósito, e a página não tem link para nenhum deles. Se algum dia a página for hospedada, é essa pasta que sobe.

A biblioteca deixou de ser só preparação: a pasta `publicar/` é copiada pelo `gerar.py` para `public/biblioteca/` e vai ao ar como página estática em `/biblioteca/`, aberta, sem login, com um item "Revestimentos" no menu da equipe. Isso não altera o aplicativo: nenhuma rota React, nenhum dado de cliente, nenhuma consulta ao Supabase. O que existe são três amarras, descritas em LEIA-ME.md: a rota no `vercel.json`, as duas exclusões do service worker no `vite.config.ts` e o `external` do item de menu. Quem mexer em qualquer uma delas sem as outras derruba a página em silêncio, e o `validar.py` só pega a divergência entre as duas cópias do arquivo.

A leitura continua valendo para o item 1 daqui: reaproveitar `biblioteca.json` dentro do aplicativo é outro trabalho, com navegação e controle de acesso do próprio app. A página em `/biblioteca/` é conteúdo público de marca, não módulo do produto.

Três correções normativas entraram nesta edição e importam para quem reaproveitar as regras: A.2 fala em procedimentos de risco com ou sem pacientes; C.1 manda seguir o manual do Ministério da Saúde de processamento de artigos e superfícies, 2ª edição de 1994, ou o que vier a substituí-lo; C.3 qualifica a exigência de forro especialmente nas salas de procedimentos cirúrgicos ou similares. Quem já tiver copiado o texto anterior das regras precisa recopiar.
