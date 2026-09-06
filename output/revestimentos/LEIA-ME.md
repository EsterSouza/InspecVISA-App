# Biblioteca de revestimentos | TreinaVISA

Edição 2.2, 06/09/2026. Para profissionais de saúde sem formação em arquitetura.

Elaborado por Ester Caiafa, enfermeira sanitarista e consultora sanitária. Conteúdo de propriedade intelectual da TreinaVISA, HUB TREINAVISA SERVIÇOS LTDA, CNPJ 53.297.694/0001-37. consultorasanitaria.com.br · @consultora.sanitaria.

Abra index.html para consulta local. A biblioteca funciona sem instalação, com busca, filtros, seletor de estado e 29 fichas expansíveis. O PDF revestimentos.pdf fica só nesta pasta: é o arquivo de entrega e impressão A4 vertical, compartilhado à parte quando ela quiser. Nenhuma publicação ou integração no aplicativo foi executada.

## O que mudou na edição 2.2

- **Preço dos 27 estados.** A edição 2.1 tinha só o Rio de Janeiro. Agora são 31 composições da SINAPI extraídas para todos os estados, e o leitor escolhe o dele no alto da seção de custo. A escolha atualiza os cartões, as barras, a linha de preço dentro de cada ficha, as comparações das lacunas e a calculadora, e fica guardada no navegador para a próxima visita.
- **Trocar de estado não fecha nenhuma lacuna.** Foi conferido composição por composição: manta vinílica soldada, rejunte isolado, tinta epóxi de parede, porcelanato de parede interna, bancada de quartzo, rodapé em meia-cana e mobiliário não existem no catálogo da SINAPI em estado nenhum; laminado, carpete e divisória removível existem, mas sem custo publicado em nenhum dos 27 estados em 07/2026. Não é lacuna do Rio: é lacuna do país. O texto das lacunas passou a dizer isso, sem citar valor de estado nenhum.
- **Menos texto dentro das fichas.** O parágrafo sobre a natureza da recomendação aparecia 29 vezes, uma por ficha; agora aparece uma vez, na abertura da biblioteca. A explicação de preço dentro da ficha virou uma linha só, que leva para "Quanto pode custar". A nota sobre a escala das barras saiu das cinco repetições e ficou uma.
- **Autoria e direitos.** Assinatura no cabeçalho da página, bloco completo no rodapé e uma página final no PDF, com titularidade, CNPJ, endereço, site, Instagram e a isenção: é orientação técnica, não tem caráter oficial da Anvisa nem de vigilância sanitária, e não substitui projeto, laudo ou decisão da autoridade local.
- **Pasta publicar/ e a página no ar.** O botão de baixar o PDF saiu da página. `python gerar.py` monta `publicar/` com os seis arquivos que vão para a rede: index.html, estilo.css, consulta.js e três imagens, 448 kB no total. Sem PDF, sem zip, sem Markdown e sem JSON junto. O mesmo comando copia essa pasta para `public/biblioteca/` do aplicativo, que é o que o Vercel serve em `inspecvisa.consultorasanitaria.com.br/biblioteca/`. O `validar.py` falha se as duas cópias divergirem.
- **Convite no fim da página.** Um bloco antes do rodapé leva ao WhatsApp profissional, com a mensagem já escrita. A página dá o critério e a ordem de grandeza; o projeto de verdade depende do ambiente, da rotina de limpeza e da vigilância local, e é isso que o convite diz. O head ganhou descrição, endereço canônico, Open Graph e um JSON-LD de TechArticle com autoria e titularidade, para a página ser achada na busca e abrir bonita quando alguém compartilhar o link.
- **PDF de 8,5 MB para 1,2 MB.** A prancha fotográfica em PNG tem 2,7 MB e o PDF a embutia duas vezes, o que respondia por 6,7 MB do arquivo: pesado demais para mandar por WhatsApp. O gerador passou a fazer duas cópias em JPEG a partir do mesmo PNG, uma de 250 kB e progressiva para a página, em rede móvel, e uma de impressão para o PDF, que sai a 228 dpi na capa. O PNG fica só como original editável. Conferido no recorte da capa: sem artefato visível.
- **Três correções da segunda auditoria da RDC 50** (adiante).

Cobertura de preço: 15 fichas com referência verificada nos 27 estados, 14 com o motivo da falta escrito. Nenhum preço foi inventado para preencher lacuna.

## Segunda auditoria da RDC 50

As 12 regras foram conferidas uma a uma contra o texto consolidado no AnvisaLegis, e a RDC 63/2011 conferida nos arts. 34, 36, 37, 42, 52, 54 e 56. Três faltas reais foram corrigidas:

1. O item A.2 fala em procedimentos de risco **com ou sem pacientes**. A classificação de ambiente e a regra correspondente tinham perdido a segunda metade.
2. O item C.1 abre mandando seguir o manual *Processamento de Artigos e Superfícies em Estabelecimentos de Saúde* do Ministério da Saúde, 2ª edição, 1994, "ou o que vier a substituí-lo". A regra de limpeza não citava a fonte.
3. O item C.3 qualifica a exigência de forro **especialmente nas salas de procedimentos cirúrgicos ou similares**. A qualificação tinha sumido da regra.

Links: `python conferir_links.py` percorre os endereços publicados nos três formatos e responde 12 links, 0 com problema. caixa.gov.br devolve 302 e ibge.gov.br devolve 403 para script; os dois abrem normalmente no navegador, conferidos à mão em 06/09/2026. O script marca esses casos como TRAVA, não como falha.

## Arquivos editáveis

- conteudo.py: critérios normativos, fontes, estrutura das fichas e vínculo com os dispositivos.
- fichas.py: o texto de cada ficha em linguagem de leigo. É o que o leitor vê; gerar.py aplica sobre a estrutura de conteudo.py.
- complementos.py: classificação de áreas, glossário, referências de custo (COSTS), motivos das lacunas (SEM_PRECO), unidade por família (UNIDADE) e os dados de marca e autoria (MARCA).
- precos.py: preço por estado, um dicionário por composição. **Gerado, não editar à mão.**
- extrair_precos.py: lê a planilha oficial e reescreve precos.py. Rode só quando trocar o mês de referência, com o pacote novo em qa/.
- gerar.py: regenera HTML, Markdown, JSON, PDF e a pasta publicar/; requer Python com reportlab, pypdf e Pillow, e as fontes Segoe UI do Windows.
- estilo.css e consulta.js: apresentação, busca, seletor de estado e calculadora.
- biblioteca.json: versão 2.2.0, marca, critérios, materiais, classificações, glossário, custos, preços por estado, lacunas, dados da calculadora e fontes.
- INTEGRACAO.md: orientação para integração futura no repositório examinado.

Execute `python gerar.py` nesta pasta e depois `python validar.py`. Os scripts atualizar.py, visual_pdf.py, acabamento.py e calculadora_build.py foram auxiliares de construção e não precisam ser executados novamente.

## Trocar o mês de referência da SINAPI

1. Baixe o pacote do mês no canal de downloads da Caixa e salve em `qa/SINAPI-AAAA-MM.zip`.
2. Aponte `PACOTE` em extrair_precos.py para o arquivo novo e rode `python extrair_precos.py`. Ele lê a aba CSD, sem desoneração, e escreve precos.py com referência, data de emissão e os 27 estados.
3. Rode `python gerar.py` e `python validar.py`. A validação falha se alguma composição citada ficar sem preço em algum estado.

Depois de trocar o mês, o `gerar.py` já deixa `public/biblioteca/` atualizada; falta commitar e subir, porque é o git que alimenta o deploy.

## Como a página chega ao ar

`public/biblioteca/` é servida como arquivo estático, sem passar pelo React. Três peças sustentam isso e nenhuma pode ser mexida sozinha:

- `vercel.json`: `/biblioteca` redireciona para `/biblioteca/` e essa rota entrega o `index.html` da pasta. O redirecionamento não é firula: sem a barra final, os caminhos relativos das imagens escapariam para a raiz do site, onde existe uma regra que responde 404 para `/assets/`.
- `vite.config.ts`: a pasta fica fora do precache do service worker (`globIgnores`) e fora do fallback de navegação (`navigateFallbackDenylist`). Sem o segundo, o service worker responderia `/biblioteca/` com o index.html do InspecVISA e a página simplesmente não abriria.
- `navConfig.ts`: o item "Revestimentos" do menu é marcado como `external`, então Sidebar e BottomNav renderizam um link de verdade. Um `NavLink` faria o router procurar a rota dentro do React, não achar e cair no catch-all.

O código da composição na planilha vem dentro de uma fórmula HYPERLINK: lido com data_only ele volta zero. Por isso o extrator abre a planilha duas vezes, uma para as fórmulas e outra para os valores, e pega o último número da fórmula. Se a Caixa mudar o formato, é aqui que quebra.

## Verificação

`python validar.py` renderiza as 39 páginas do PDF, monta as pranchas de contato em qa e confere: título das 29 fichas nos três formatos, os seis campos editoriais no Markdown, critérios no PDF, ausência de travessão, texto selecionável, 67 links/anotações, preço nos 27 estados para todas as composições citadas, os dados de autoria no HTML e no PDF, a ausência de link para PDF, zip, Markdown e JSON na página, e a regra que sustenta a honestidade da calculadora: cada ficha tem preço verificado **ou** motivo escrito da falta, nunca os dois e nunca nenhum. As miniaturas são apagadas e refeitas a cada execução: página antiga guardada em disco já escondeu um PDF quebrado antes.

No navegador, em 06/09/2026: busca, filtros, calculadora, troca de estado (Rio R$ 132,79/m² para São Paulo R$ 110,74/m² no porcelanato, com a barra acompanhando) e celular a 375 px sem rolagem horizontal, com cabeçalho, seletor, cartões de custo, ficha aberta e rodapé de autoria conferidos.

## Alcance

Núcleo federal conferido em fontes primárias. Não foram auditadas regras locais, produtos comerciais específicos nem textos integrais das NBR mencionadas no original. Os preços são custos de serviço da SINAPI, referência 07/2026, emitida em 11/08/2026, sem desoneração e sem BDI. Não são médias nacionais, orçamento de reforma nem preço de loja, e não comprovam adequação sanitária de material nenhum.

## Imagens

Logo original fornecida pela usuária, preservada. assets/materiais.png foi gerada pela ferramenta imagegen como prancha fotográfica ilustrativa de oito amostras; assets/materiais.jpg é a mesma prancha comprimida para a web. Não representam produtos comerciais, ensaios ou instalações aprovadas. As miniaturas são recortes de apresentação da prancha. assets/encontros.svg é esquema vetorial sem escala, editável no gerador.

Prompt utilizado: Create one refined editorial photographic contact sheet for a Brazilian healthcare surface-materials guide. Landscape image, exactly 4 columns and 2 rows, no text, no logos, no people. Samples: ivory porcelain with grout, sage epoxy, gray vinyl seam, ivory paint, dark granite, offwhite engineered quartz, brushed stainless steel, blue synthetic upholstery. Soft daylight, realistic restrained textures. Illustrative sample board, not certified products.

## Calculadora

Escolha o estado e depois a ficha; a lista de preços mostra as referências verificadas daquela ficha naquele estado e sempre a opção "informar a minha cotação". A medida entra em m², em comprimento × largura, em metros lineares ou em quantidade de peças, conforme a família; a calculadora restringe sozinha os modos que não fazem sentido. O resultado é medida × preço, sem perdas de corte, sem conserto de base e sem BDI.

Verificados no navegador: P07 sem preço, cotação própria de R$ 310,50 e 18,5 m² = R$ 5.744,25; B01 com referência de granito, 3 peças = R$ 1.208,52; T03 mostrando "Restrição expressa" ao lado do link da ficha; medida vazia ou não positiva recusada. Os campos aceitam vírgula decimal: 18,5 e 1.250,75 funcionam.
