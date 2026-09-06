# -*- coding: utf-8 -*-
"""Onde cada ficha pode ser usada.

Quatro ambientes e tres estados. A RDC 50 nao proibe material por nome: ela
exige propriedade. "Nao atende" quer dizer que o material, pela natureza dele,
nao entrega a propriedade que aquele ambiente exige. A unica proibicao nominal
usada aqui e a do rejunte de cimento sem aditivo antiabsorvente em area
critica, que e expressa no texto da norma.
"""
AMBIENTES = [
    ('nao', 'Não crítica', 'Sala administrativa, espera, corredor sem procedimento.'),
    ('semi', 'Semicrítica', 'Consultório, sala de curativo, internação de baixo risco.'),
    ('crit', 'Crítica', 'Sala cirúrgica, procedimento invasivo, paciente imunodeprimido.'),
    ('mol', 'Área molhada', 'Banheiro, pia, expurgo e sala de utilidades.'),
]

ESTADOS = {
    'sim': ('Atende', 'O material entrega a propriedade que o ambiente exige.'),
    'talvez': ('Só com comprovação', 'Depende do produto: peça o documento do fabricante.'),
    'nao': ('Não atende', 'Pela natureza do material, o critério do ambiente não é alcançado.'),
}

# id: (não crítica, semicrítica, crítica, área molhada, por quê)
ONDE = {
 'P01': ('sim', 'talvez', 'talvez', 'talvez',
  'Em semicrítica precisa suportar lavagem e desinfetante; em crítica, absorção de até 4% na peça e no rejunte. Em área molhada, confirme o acabamento antiderrapante com o piso molhado.'),
 'P02': ('sim', 'talvez', 'talvez', 'talvez',
  'Mesma exigência do porcelanato. O grês costuma ter absorção maior: o ensaio do modelo escolhido decide, não o nome da família.'),
 'P03': ('sim', 'talvez', 'talvez', 'talvez',
  'Semi-grês é o nome comercial da classe BIIa, que vai de 3% a 6% de absorção: parte da faixa passa do limite de 4% da área crítica e parte não. A família não responde, só o valor medido do modelo escolhido. Em banheiro e expurgo, confirme também o acabamento antiderrapante.'),
 'P04': ('sim', 'talvez', 'talvez', 'talvez',
  'Esmalte é acabamento, não classe de absorção: existe peça esmaltada com absorção baixíssima. Em abril de 2026 o Centro Cerâmico do Brasil listava 27 produtos certificados como BIa esmaltado, a classe de menor absorção. A resposta em área crítica vem do valor na ficha técnica, não do esmalte. Em área molhada, confirme que a peça é própria para piso e antiderrapante.'),
 'P05': ('sim', 'sim', 'sim', 'talvez',
  'A pintura de epóxi forma um piso monolítico, sem junta: é o acabamento que a norma manda priorizar. Em área molhada, peça acabamento antiderrapante, porque o epóxi liso fica escorregadio.'),
 'P06': ('sim', 'talvez', 'talvez', 'nao',
  'Réguas e placas têm emenda. Fora da área seca, só com sistema que suporte a lavagem e mantenha os encontros fechados. Em banheiro e expurgo a água entra pelos encaixes e chega à base.'),
 'P07': ('sim', 'sim', 'talvez', 'talvez',
  'A manta com emenda soldada fica contínua, sem junta aberta. Em crítica, comprove a resistência aos desinfetantes do serviço. Em área molhada, siga o manual da marca e confirme a classe antiderrapante.'),
 'P08': ('sim', 'nao', 'nao', 'nao',
  'Carpete, madeira e laminado não suportam a lavagem e a desinfecção exigidas fora da área seca, e incham em contato com água. São opções de sala administrativa.'),
 'J01': ('sim', 'sim', 'sim', 'sim',
  'O rejunte epóxi atende à absorção e resiste aos saneantes nos quatro ambientes.'),
 'J02': ('sim', 'sim', 'talvez', 'talvez',
  'O aditivo antiabsorvente é o que permite o uso. Em crítica, comprove a absorção de até 4%; em área molhada, a resistência à água permanente.'),
 'J03': ('sim', 'talvez', 'nao', 'nao',
  'A RDC 50 veda expressamente o cimento sem aditivo antiabsorvente para rejuntar peça cerâmica em área crítica. Em área molhada a vedação não é nominal, mas o rejunte absorve a água e perde a higiene.'),
 'W01': ('sim', 'talvez', 'talvez', 'sim',
  'Mesma lógica do piso cerâmico, aplicada à parede: lavagem e desinfetante na semicrítica, absorção de até 4% na crítica. Em área molhada é uma solução usual.'),
 'W02': ('sim', 'talvez', 'nao', 'sim',
  'Azulejo é o nome da classe cerâmica porosa, acima de 10% de absorção: está muito longe do limite de 4% da área crítica. Peça de parede que fica em 4% ou menos não é azulejo, é a ficha W01. Em parede de banheiro e expurgo o azulejo é a solução clássica.'),
 'W03': ('sim', 'talvez', 'talvez', 'sim',
  'Comprove a resistência à lavagem e aos desinfetantes usados. Em área crítica a tinta não pode ser aplicada com pincel. É a linha desenhada para área molhada.'),
 'W04': ('sim', 'talvez', 'talvez', 'talvez',
  'Drywall e placa cimentícia são base, não acabamento: quem cumpre o critério é o revestimento aplicado por cima. Em área molhada, só a placa cimentícia ou a chapa resistente à umidade.'),
 'W05': ('sim', 'talvez', 'nao', 'nao',
  'A RDC 50 não permite divisória removível em área crítica. Em área molhada, o perfil e a fresta retêm água e não permitem a limpeza completa.'),
 'T01': ('sim', 'sim', 'sim', 'talvez',
  'Acabamento contínuo sobre laje ou gesso: sem placa solta e sem fresta, é o que a área crítica exige. Em área molhada, use pintura própria; gesso sem proteção sofre com o vapor.'),
 'T02': ('sim', 'sim', 'talvez', 'talvez',
  'Com as juntas tratadas o forro fica contínuo. Em crítica, comprove o tratamento das juntas; em área molhada, use chapa resistente à umidade.'),
 'T03': ('sim', 'talvez', 'nao', 'talvez',
  'O forro modular removível não entrega a continuidade que a área crítica cobra, especialmente em sala cirúrgica ou similar. Em área molhada, o módulo de PVC é uma opção usual.'),
 'B01': ('sim', 'sim', 'talvez', 'talvez',
  'A pedra natural varia muito: granito polido atende, pedra porosa não. Comprove absorção e resistência química, inclusive no recorte da cuba.'),
 'B02': ('sim', 'sim', 'sim', 'sim',
  'O quartzo industrializado tem absorção muito baixa e superfície contínua nos quatro ambientes.'),
 'B03': ('sim', 'sim', 'sim', 'sim',
  'O aço inoxidável é a referência de bancada para área crítica e para o expurgo.'),
 'B04': ('sim', 'nao', 'nao', 'nao',
  'MDF e madeira incham com água. O revestimento fino não protege o núcleo na borda nem no recorte da cuba, justamente onde a água chega.'),
 'R01': ('sim', 'talvez', 'talvez', 'talvez',
  'O alinhamento com a parede só resolve se o encontro com o piso permitir limpar o canto por inteiro. Em área molhada, a vedação do encontro decide.'),
 'R02': ('sim', 'sim', 'sim', 'sim',
  'A meia-cana é a solução que a norma descreve para o encontro entre piso e parede: canto limpável, sem ressalto.'),
 'R03': ('sim', 'talvez', 'nao', 'nao',
  'Aqui não é questão de produto e sim de geometria: sobrepor à parede cria o ressalto que a RDC 50 critica em C.2, e nenhum modelo de rodapé sobreposto desfaz esse degrau. Em área molhada, a água ainda entra pela fresta posterior.'),
 'M01': ('sim', 'sim', 'talvez', None,
  'Só com cobertura lisa, impermeável e resistente aos saneantes, e sem costura aberta. Estofado de pano, sem essa cobertura, não atende ao art. 56 em nenhum ambiente assistencial. Em crítica, comprove a resistência ao desinfetante do serviço.'),
 'M02': ('sim', 'talvez', 'nao', None,
  'A rotina de desinfecção da área crítica solta a fita de borda e expõe o núcleo de MDF. Fora dali, depende de guarda seca e de integridade.'),
 'M03': ('sim', 'nao', 'nao', None,
  'Tecido sem cobertura impermeável, palha, rattan e madeira crua retêm sujeira na trama e não suportam a desinfecção. Em espera, o estofado do serviço também responde ao art. 56.'),
}
