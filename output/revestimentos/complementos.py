"""Explicações e referências de custo compartilhadas pelos três formatos."""
AREAS=[
('Área crítica','Ambiente com risco aumentado de transmissão de infecção. A RDC 50 enquadra aqui onde se realizam procedimentos de risco, com ou sem paciente na sala, e onde há pessoas com defesas imunológicas reduzidas. Sala vazia não deixa de ser crítica: o que classifica é o que se faz nela.','Exemplo de aplicação: sala de pequenos procedimentos cirúrgicos. Na estética em serviço de saúde, uma sala de procedimentos que rompem a pele exige avaliação pelo risco real da atividade, mesmo em uma clínica pequena.'),
('Área semicrítica','Ambiente ocupado por pacientes com doenças de baixa transmissibilidade ou doenças não infecciosas.','Exemplo de aplicação: consultório destinado a consulta e exame não invasivo, conforme o atendimento realizado. Receber pacientes não torna o ambiente automaticamente crítico.'),
('Área não crítica','Demais ambientes do serviço de saúde, sem ocupação por pacientes e sem procedimentos de risco.','Exemplo de aplicação: sala administrativa exclusiva da equipe. Não classifique a espera como não crítica apenas por não haver procedimentos: considere quem ocupa o local.')]
CONTEXT=[
('Uma clínica pode ter as três classes','Classifique cada ambiente pelas atividades e pelos pacientes, não pelo tamanho, pelo nome da clínica ou pela aparência do espaço. Os exemplos são aplicações explicativas dos critérios da RDC 50, Parte III, 6.2 A.2, e não uma lista oficial de enquadramentos.'),
('Baixo risco do serviço não significa área não crítica','A classificação usada para licenciamento sanitário tem finalidade própria e depende das regras aplicáveis. Já a criticidade do ambiente orienta o controle de infecção. Um enquadramento não substitui o outro. Informe os procedimentos ao responsável pelo projeto e à vigilância local.'),
('E na estética?','A Anvisa distingue serviços de saúde de serviços de interesse para a saúde conforme as atividades exigirem execução ou supervisão de profissional de saúde. A RDC 50 deve ser considerada no enquadramento como serviço de saúde. Não aplique automaticamente todas as regras de um estabelecimento assistencial a qualquer salão ou espaço de embelezamento. Ambos precisam cumprir a legislação aplicável e a avaliação sanitária local. Fonte: Nota Técnica Anvisa 2/2024, introdução e seção 2.7.')]
GLOSSARY=[
('Sistema completo','Material visível + base que o sustenta + cola ou argamassa + juntas e acabamentos. O resultado depende de todos.'),
('Base, substrato e contrapiso','Base ou substrato é a superfície que recebe o acabamento. Contrapiso é a camada de regularização sob o piso.'),
('Junta e rejunte','Junta é o espaço entre peças. Rejunte é o produto que preenche esse espaço. Algumas juntas permitem movimento e exigem solução própria.'),
('Monolítico e contínuo','Acabamento que se comporta como superfície contínua, com poucos encontros. Não significa que nunca terá juntas de movimentação.'),
('Absorção de água','Quanto de água o material absorve em ensaio. Não se determina pelo brilho, pela foto ou pelo nome comercial.'),
('Lavável e resistente a desinfetantes','Suportar a limpeza e os produtos usados nas condições recomendadas, sem perder integridade. Ser lavável não prova resistência a qualquer desinfetante.'),
('Área molhada','Expressão ligada à exposição à água. Não é sinônimo de área crítica, que trata de risco de infecção.'),
('Epóxi, PU e PVC','Famílias de materiais: epóxi é uma resina; PU significa poliuretano; PVC é um plástico usado em diferentes revestimentos. O nome não certifica desempenho.'),
('Primer e cura','Primer é a camada preparatória para melhorar a aplicação ou aderência. Cura é o tempo necessário para o sistema adquirir suas propriedades.'),
('Abrasão e impacto','Desgaste por atrito e esforço causado por batidas ou quedas de objetos. Importam em pisos com circulação e equipamentos.'),
('Drywall e forro','Drywall é um sistema de parede com placas sobre estrutura. Forro é o acabamento abaixo da cobertura ou laje. Avalie o sistema completo e suas juntas.'),
('Estanqueidade e vedação','Capacidade de impedir passagem de líquido nas condições previstas; vedação é o fechamento de encontros. Uma emenda fechada visualmente não comprova o desempenho.'),
('m² e metro linear','m² mede área: uma sala de 4 × 5 m tem 20 m² de piso. Metro linear mede comprimento, como rodapé. A área das paredes é calculada separadamente.'),
('SINAPI','Tabela oficial de preços de obra publicada pela Caixa Econômica Federal com o IBGE. Traz um valor por serviço, por estado e por mês. Serve para orçamento público e, aqui, só para dar ordem de grandeza: não é tabela de preço de loja nem de prestador.'),
('BDI','Sigla de Benefícios e Despesas Indiretas: a parcela que a empresa soma ao custo do serviço para cobrir administração, impostos, riscos e lucro. Os valores desta edição são custos SINAPI sem BDI, então a proposta que você receber costuma vir acima deles.'),
('Composição e código','Cada serviço da SINAPI tem um número, chamado código de composição, e uma descrição do que está incluído. Citar o código é a forma de pedir orçamento do mesmo serviço, sem ambiguidade.')]
COST_URL='https://www.caixa.gov.br/site/Paginas/downloads.aspx#categoria_888'
UF_PADRAO='RJ'
COST_NOTE='Preços de obra da tabela SINAPI, da Caixa, referência de julho de 2026, sem desoneração. Cada estado tem o seu valor, e a diferença entre o mais barato e o mais caro do país passa de 50% em vários serviços. São custos de serviço executado, somando material, mão de obra e equipamento, sem BDI: falta neles a parcela de administração, impostos e lucro que a empresa acrescenta na proposta, então o orçamento que você receber costuma vir acima destes valores. Também não entram conserto da base, remoção do que existe hoje, impermeabilização e soluções especiais. E preço não comprova adequação sanitária: um material barato pode ser inadequado para o seu ambiente, e um caro pode não resolver.'
COST_SCALE='As barras comparam os preços dentro de cada grupo. De um grupo para o outro não dá para comparar: rodapé é vendido por metro e bancada por peça.'
# parts: composições SINAPI somadas para formar o valor. O preço em si vive em
# precos.py, um por estado, porque a mesma composição custa diferente em cada UF.
COSTS=[
dict(key='porcelanato-piso-60',name='Porcelanato de piso 60 × 60 cm, sala acima de 10 m²',group='Pisos',unit='m²',parts=['87263'],ids=['P01'],scope='Inclui a placa, a argamassa, o rejunte e a mão de obra. Não inclui conserto do contrapiso nem remoção do piso antigo.'),
dict(key='porcelanato-piso-60-pequena',name='Porcelanato de piso 60 × 60 cm, sala de 5 a 10 m²',group='Pisos',unit='m²',parts=['87262'],ids=['P01'],scope='Mesma placa em ambiente menor. Sala pequena custa mais por metro quadrado: há mais recorte e mais borda para cada metro assentado.'),
dict(key='ceramica-piso-60',name='Cerâmica esmaltada de piso 60 × 60 cm',group='Pisos',unit='m²',parts=['87257'],ids=['P02','P03','P04'],scope='Mesmo serviço, com placa esmaltada comum. A tabela não declara a absorção de água da peça: o preço vale pela colocação e por uma placa de padrão médio. A classe (grês, semi-grês ou esmaltada) você confirma com o fabricante.'),
dict(key='ceramica-piso-60-pequena',name='Cerâmica esmaltada de piso 60 × 60 cm, sala de 5 a 10 m²',group='Pisos',unit='m²',parts=['87256'],ids=['P02','P03','P04'],scope='A mesma placa esmaltada em ambiente menor.'),
dict(key='ceramica-piso-45',name='Cerâmica esmaltada de piso 45 × 45 cm',group='Pisos',unit='m²',parts=['87251'],ids=['P02','P03','P04'],scope='Peça menor, mesmo serviço. Mais juntas por metro quadrado, o que pesa na limpeza do dia a dia.'),
dict(key='epoxi-piso',name='Pintura de piso em epóxi, duas demãos com primer',group='Pisos',unit='m²',parts=['102494'],ids=['P05'],scope='Inclui primer e duas demãos de tinta epóxi. Não inclui o preparo pesado da base e não é o piso autonivelante de resina espessa, que custa bem mais.'),
dict(key='vinilico-placa',name='Piso vinílico em placas de 3,2 mm, colado',group='Pisos',unit='m²',parts=['101727'],ids=['P06'],scope='Inclui a placa, a cola e a mão de obra. Não inclui a regularização da base, que o vinílico exige lisa.'),
dict(key='vinilico-regua',name='Piso vinílico em réguas de 4,0 mm, colado',group='Pisos',unit='m²',parts=['106790'],ids=['P06'],scope='Mesmo sistema, em réguas. Nem placa nem régua têm emenda soldada: isso é a manta da ficha P07.'),
dict(key='azulejo-20',name='Azulejo esmaltado de parede 20 × 20 cm, altura inteira',group='Paredes',unit='m²',parts=['87265'],ids=['W02'],scope='Parede revestida do piso ao teto. Revestir até o teto é escolha de projeto, não exigência geral da RDC 50.'),
dict(key='ceramica-parede-60',name='Cerâmica esmaltada de parede 60 × 60 cm, altura inteira',group='Paredes',unit='m²',parts=['104611'],ids=['W02'],scope='Peça grande, menos juntas. Mesmo serviço, do piso ao teto.'),
dict(key='pintura-acrilica-parede',name='Pintura acrílica de parede, com selador e massa',group='Paredes',unit='m²',parts=['88485','88497','88489'],ids=[],scope='Soma de três serviços: selador, massa com lixamento e pintura látex acrílica premium em duas demãos. É a pintura comum de parede: não comprova resistência a desinfetantes e não substitui a tinta epóxi da ficha W03.'),
dict(key='drywall-simples',name='Parede de drywall, duas faces simples',group='Paredes',unit='m²',parts=['96358'],ids=['W04'],scope='É a parede em si, sem vãos: estrutura metálica e uma chapa de cada lado. O acabamento (massa, pintura ou cerâmica) é cobrado à parte.'),
dict(key='drywall-dupla',name='Parede de drywall, duas faces duplas',group='Paredes',unit='m²',parts=['96368'],ids=['W04'],scope='Versão reforçada, com duas chapas de cada lado e guias duplas. Também sem o acabamento.'),
dict(key='teto-pintado',name='Teto de laje com massa, selador e pintura',group='Tetos e forros',unit='m²',parts=['88496','88484','88488'],ids=['T01'],scope='Soma de três serviços aplicados no teto: massa com lixamento, selador e pintura látex em duas demãos. É o teto contínuo, sem forro.'),
dict(key='forro-gesso',name='Forro em placas de gesso',group='Tetos e forros',unit='m²',parts=['96113'],ids=['T01'],scope='Forro de gesso com acabamento contínuo, para ambiente comercial, com a estrutura de fixação incluída.'),
dict(key='forro-drywall',name='Forro em drywall com estrutura',group='Tetos e forros',unit='m²',parts=['96114'],ids=['T02'],scope='Chapas sobre estrutura. O tratamento das juntas é o que faz o forro se comportar como superfície contínua: confirme que está no orçamento.'),
dict(key='forro-mineral',name='Forro em fibra mineral com estrutura',group='Tetos e forros',unit='m²',parts=['104757'],ids=['T03'],scope='Forro modular, removível placa a placa. Leia a ficha T03 antes de orçar: a biblioteca registra restrição expressa para área crítica.'),
dict(key='forro-pvc',name='Forro em réguas de PVC',group='Tetos e forros',unit='m²',parts=['96116'],ids=['T03'],scope='Réguas frisadas encaixadas sobre estrutura. As frestas entre as réguas são o ponto de atenção.'),
dict(key='bancada-granito-050',name='Bancada de granito 0,50 × 0,60 m, para lavatório',group='Bancadas',unit='unidade',parts=['86895'],ids=['B01'],scope='Preço por peça, fornecida e instalada. Cuba, torneira e sifão são cobrados à parte.'),
dict(key='bancada-granito-200',name='Bancada de granito 2,00 × 0,60 m, para lavatório',group='Bancadas',unit='unidade',parts=['106780'],ids=['B01'],scope='Peça maior, também por unidade. Cuba, torneira e sifão à parte.'),
dict(key='pia-inox',name='Pia de aço inox 0,55 × 1,20 m, com uma cuba',group='Bancadas',unit='unidade',parts=['106772'],ids=['B03'],scope='Pia inteiriça em inox, fornecida e instalada. É a peça pronta, não uma bancada de apoio revestida.'),
dict(key='cuba-inox',name='Cuba de embutir em inox 46 × 30 × 12 cm',group='Bancadas',unit='unidade',parts=['86900'],ids=['B03'],scope='Só a cuba, para embutir em uma bancada. Some com o preço da bancada escolhida.'),
dict(key='rodape-ceramico',name='Rodapé cerâmico de 7 cm',group='Rodapés',unit='m linear',parts=['88650'],ids=['R01','R03'],scope='Cobrado por metro de parede, não por m². A altura de 7 cm é a da composição, não uma exigência da RDC 50.'),
dict(key='rodape-granito',name='Rodapé de granito de 10 cm',group='Rodapés',unit='m linear',parts=['98685'],ids=['R01','R03'],scope='Por metro. Pedra cortada e assentada.'),
dict(key='rodape-borracha',name='Rodapé de borracha de 7 cm, colado',group='Rodapés',unit='m linear',parts=['101742'],ids=['R01','R03'],scope='Por metro. É o rodapé que costuma acompanhar o piso vinílico.'),
dict(key='rodape-poliestireno',name='Rodapé de poliestireno de 5 cm',group='Rodapés',unit='m linear',parts=['98688'],ids=['R01','R03'],scope='Por metro. Peça plástica colada na parede.'),
dict(key='rodape-epoxi',name='Pintura de rodapé com tinta epóxi',group='Rodapés',unit='m linear',parts=['102496'],ids=['R01','R03'],scope='Por metro. É pintar um rodapé que já existe, não fornecer rodapé novo.')]
# Fichas sem preço verificado: o motivo da falta e, quando faz sentido, as
# referências que servem só para dar ordem de grandeza.
SEM_PRECO={
'P07':('A SINAPI não tem composição de manta vinílica com emenda soldada. Peça cotação do sistema inteiro: manta, cola, solda das emendas e rodapé em meia-cana, lembrando que a solda é serviço à parte.',['vinilico-placa','vinilico-regua']),
'P08':('As composições de piso laminado e de carpete existem na SINAPI, mas sem custo publicado em estado nenhum nesta referência. Não é lacuna do seu estado: é do país. Antes de orçar, leia a ficha: são pisos que costumam não atender aos critérios de limpeza em serviço de saúde.',[]),
'J01':('Na SINAPI o rejunte já está embutido no preço do revestimento cerâmico, e a composição usa rejunte cimentício comum. O epóxi é comprado à parte: peça cotação por m² de revestimento, informando a largura da junta e o tamanho da peça.',[]),
'J02':('Também não tem preço próprio: o rejunte vem embutido no revestimento cerâmico. Peça ao fornecedor a diferença de preço entre o rejunte comum e o com aditivo, por m² de revestimento.',[]),
'J03':('Sem preço próprio porque já vem embutido no revestimento cerâmico. Antes de orçar por ele, leia a ficha: esta biblioteca registra restrição expressa ao uso em área crítica.',[]),
'W01':('A SINAPI não traz porcelanato assentado em parede interna em nenhum estado. O trabalho de assentamento se parece com o da cerâmica esmaltada de parede: use esse valor só para a ordem de grandeza da mão de obra e peça cotação da placa.',['ceramica-parede-60']),
'W03':('A SINAPI tem pintura epóxi de piso, mas não de parede. Peça cotação do sistema completo: preparo da base, primer, tipo de tinta e número de demãos. A pintura acrílica serve só de comparação, e ela não comprova resistência a desinfetantes.',['pintura-acrilica-parede']),
'W05':('As composições de divisória removível existem na SINAPI, mas sem custo publicado em estado nenhum nesta referência. Leia a ficha antes de orçar: esta biblioteca registra restrição expressa.',[]),
'B02':('A SINAPI não tem composição de bancada em quartzo. Peça cotação por peça, informando medidas, espessura, tipo de cuba e acabamento das bordas. A bancada de granito serve de comparação.',['bancada-granito-200']),
'B04':('Sem composição na SINAPI. Antes de orçar, leia a ficha: em bancada exposta à água esses materiais pedem cautela.',[]),
'R02':('A SINAPI não tem composição de rodapé em meia-cana. Ele costuma vir junto com o sistema de piso, vinílico ou epóxi: peça cotação do conjunto. O rodapé de borracha reto dá a ordem de grandeza.',['rodape-borracha']),
'M01':('Mobiliário não entra na SINAPI, que é uma tabela de obra. Peça cotação por peça e exija por escrito que o revestimento é lavável e resiste aos desinfetantes que você usa.',[]),
'M02':('Mobiliário não entra na SINAPI. Peça cotação por peça e pergunte como as bordas e o fundo são vedados.',[]),
'M03':('Mobiliário não entra na SINAPI. Leia a ficha antes de orçar: são materiais que a biblioteca desaconselha em ambiente assistencial.',[])}
# Como cada família costuma ser medida no orçamento.
UNIDADE={'Pisos':'m²','Rejuntes':'m²','Paredes':'m²','Tetos e forros':'m²','Bancadas':'unidade','Rodapés':'m linear','Mobiliário':'unidade'}
# Autoria e titularidade. A biblioteca é publicada, então isso aparece na página,
# no PDF e no JSON.
MARCA=dict(
 ano='2026',
 titular='HUB TREINAVISA SERVIÇOS LTDA',
 cnpj='53.297.694/0001-37',
 marca='TreinaVISA · Hub de Educação Sanitária',
 autora='Ester Caiafa',
 credencial='Enfermeira sanitarista e consultora sanitária',
 site='https://www.consultorasanitaria.com.br',
 siteRotulo='consultorasanitaria.com.br',
 instagram='https://www.instagram.com/consultora.sanitaria',
 instagramRotulo='@consultora.sanitaria',
 endereco='Av. Embaixador Abelardo Bueno, 01, Edifício Lagoa 1, sala 153-D, Barra Olímpica, Rio de Janeiro',
 direitos='Conteúdo de propriedade intelectual da TreinaVISA. A consulta é livre. Reprodução, adaptação, redistribuição ou uso comercial dependem de autorização por escrito.',
 isencao='Publicação de orientação técnica. Não tem caráter oficial da Anvisa nem de qualquer vigilância sanitária, e não substitui projeto, laudo ou decisão da autoridade sanitária local.')
