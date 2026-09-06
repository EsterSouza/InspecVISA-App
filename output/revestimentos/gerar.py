from pathlib import Path
import json, html, hashlib, shutil
from PIL import Image
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Frame, CondPageBreak, Spacer, Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from conteudo import DATE,SOURCES,RULES,INTRO,MATERIALS,END
from complementos import AREAS,CONTEXT,GLOSSARY,COSTS,COST_NOTE,COST_SCALE,COST_URL,SEM_PRECO,UNIDADE,UF_PADRAO,MARCA,PUBLICACAO
from precos import PRECOS,UFS,REFERENCIA,EMISSAO
import fichas
import pagina
# O texto das fichas vive em fichas.py, escrito para quem cuida do serviço de saúde
# e não é da área de obra. Aqui ele substitui o texto técnico de conteudo.py.
fichas.aplicar(MATERIALS)
SOURCES['ESTETICA']={'title':'Anvisa, Nota Técnica 2/2024','url':'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos','status':'Orientação institucional consultada na coleção de notas vigentes. Introdução e seção 2.7: enquadramento e infraestrutura dos serviços de estética.'}
SOURCES['SINAPI']={'title':'SINAPI: tabela de preços de obra da Caixa','url':COST_URL,'status':COST_NOTE}
END[:]=[(t,p.replace('Os preços originais não foram confirmados em documentação oficial e não integram esta edição.','Os preços desta edição são referências localizadas, com escopo e fonte próprios, e não validam os preços do original.')) for t,p in END]
def money(v):return ('R$ %.2f'%v).replace('.',',')
UFNOME=dict(UFS)
MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
def mesano(x):
 # A SINAPI publica dia exato; na leitura o que importa é o mês da referência.
 partes=x.split('/')
 return MESES[int(partes[-2])-1]+' de '+partes[-1]
def cost_ref(uf):return f'SINAPI {UFNOME[uf]}, referência {REFERENCIA}, sem desoneração'
# O valor de uma referência é a soma das composições que a formam, no estado
# escolhido. Composição sem preço naquele estado derruba a referência inteira.
def valor(x,uf=UF_PADRAO):
 vs=[PRECOS[c].get(uf) for c in x['parts']]
 return round(sum(vs),2) if all(v is not None for v in vs) else None
def tile(m):
 return {'P01':0,'P02':0,'P03':0,'P04':0,'P05':1,'P06':2,'P07':2,'J01':0,'J02':0,'J03':0,'W01':0,'W02':0,'W03':3,'W04':3,'T01':3,'T02':3,'B01':4,'B02':5,'B03':6,'R01':0,'M01':7}.get(m['id'],-1)

ROOT=Path(__file__).resolve().parent
E=html.escape
rulemap={r[0]:r for r in RULES}
# Cada ficha aponta para as referências de preço que existem e, quando não existe
# nenhuma, para o motivo. É o que a calculadora usa para nunca inventar um valor.
CHAVE={x['key']:i for i,x in enumerate(COSTS)}
CALC=[dict(id=m['id'],name=m['name'],category=m['category'],status=m['status'],unit=UNIDADE[m['category']],
 refs=[i for i,x in enumerate(COSTS) if m['id'] in x['ids']],
 gap=SEM_PRECO[m['id']][0] if m['id'] in SEM_PRECO else '',
 compare=[CHAVE[k] for k in SEM_PRECO[m['id']][1]] if m['id'] in SEM_PRECO else []) for m in MATERIALS]
CALC+=[dict(id='',name=x['name'],category='Outras referências',status='',unit=x['unit'],refs=[i],gap='',compare=[]) for i,x in enumerate(COSTS) if not x['ids']]
# Os formatos estáticos mostram um estado só; a página troca ao vivo.
ISO='2026-09-06'
SLUG={m['id']:pagina.slug(m['name']) for m in MATERIALS}
COMPARA=[dict(id=m['id'],name=m['name'],category=m['category'],status=m['status'],slug=SLUG[m['id']],
 use=m['use'],limit=m['limit'],inspect=m['inspect'],unit=UNIDADE[m['category']],
 refs=[i for i,x in enumerate(COSTS) if m['id'] in x['ids']],
 gap=SEM_PRECO[m['id']][0] if m['id'] in SEM_PRECO else '',
 rules=[rulemap[r][1] for r in m['rules']]) for m in MATERIALS]
assert len(set(SLUG.values()))==len(SLUG),'dois materiais com o mesmo endereço'
COSTS_JSON=[dict(x,value=valor(x)) for x in COSTS]
LACUNAS={k:dict(motivo=v[0],comparar=[CHAVE[c] for c in v[1]]) for k,v in SEM_PRECO.items()}
DATA=dict(version='2.3.0',brand=MARCA,areaClasses=AREAS,context=CONTEXT,glossary=GLOSSARY,costs=COSTS_JSON,costNote=COST_NOTE,costUrl=COST_URL,priceReference=REFERENCIA,priceIssued=EMISSAO,defaultState=UF_PADRAO,states=UFS,prices=PRECOS,priceGaps=LACUNAS,unitByCategory=UNIDADE,calculator=CALC,reviewedAt='2026-09-06',title='Revestimentos em serviços de saúde',intro=INTRO,rules=[dict(zip(['id','title','text','device','source','kind'],r)) for r in RULES],materials=MATERIALS,closing=END,sources=SOURCES)
(ROOT/'biblioteca.json').write_text(json.dumps(DATA,ensure_ascii=False,indent=2),encoding='utf-8')
def refs(m):
 result=[]
 for key in m['rules']:
  r=rulemap[key]; item=(r[4],r[3])
  if item not in result: result.append(item)
 for key in m['extra']:result.append((key,SOURCES[key]['title']))
 return result
def refhtml(key,device):return f'<a href="{E(SOURCES[key]["url"],quote=True)}" target="_blank" rel="noopener">{E(key+": "+device)}</a>'
FIELDS=[('description','O que é'),('use','Onde pode ser usado'),('limit','Quando evitar'),('spec','Como pedir a instalação'),('proof','O que perguntar ao fornecedor'),('inspect','O que olhar depois de pronto')]

DIAGRAM='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 260" role="img" aria-labelledby="dtitle ddesc"><title id="dtitle">Três encontros que merecem atenção</title><desc id="ddesc">Esquemas sem escala: peça e rejunte são verificados separadamente; rodapé alinhado à parede; emenda fechada no sistema de manta.</desc><g font-family="Segoe UI, sans-serif" fill="#26354a"><rect width="760" height="260" fill="#edf1f4"/><g stroke="#26354a" stroke-width="2" fill="#c5d4df"><path d="M28 102h85v50H28zM127 102h85v50h-85z"/><path d="M294 52h30v118h120v30H294z"/><path d="M552 135h72v20h-72zM634 135h88v20h-88z"/></g><path d="M113 102h14v50h-14zM324 152h14v18h-14zM624 135h10v20h-10z" fill="#987032"/><g font-size="15"><text x="28" y="36">Peça + rejunte</text><text x="294" y="36">Piso + parede</text><text x="552" y="36">Manta + emenda</text><text x="28" y="190">Duas verificações</text><text x="294" y="228">Canto acessível à limpeza</text><text x="552" y="190">Fechamento do sistema</text></g><g stroke="#987032" stroke-width="1.5" fill="none"><path d="M120 98V68h65M342 159h75v-45M629 130V84h60"/></g><g font-size="12"><text x="140" y="61">junta</text><text x="371" y="107">alinhamento</text><text x="653" y="77">solda</text></g></g></svg>'''
(ROOT/'assets'/'encontros.svg').write_text(DIAGRAM,encoding='utf-8')

# Fotos de ambiente e de ficha. A Ester salva em public/biblioteca/imagens
# geradas/, que o gerador reconstroi do zero a cada execucao: por isso o que
# estiver la e recolhido para assets/fichas/, que e a fonte versionada, antes de
# qualquer rmtree. O nome do arquivo decide onde a foto entra; a convencao esta
# em assets/fichas/LEIA-ME.txt.
ENTRADA=ROOT.parent.parent/'public'/'biblioteca'/'imagens geradas'
FOTOS_ORIG=ROOT/'assets'/'fichas'
FOTOS_WEB=ROOT/'assets'/'fotos'
FOTOS_ORIG.mkdir(parents=True,exist_ok=True);FOTOS_WEB.mkdir(parents=True,exist_ok=True)
if ENTRADA.is_dir():
 for f in ENTRADA.iterdir():
  if f.suffix.lower() in ('.png','.jpg','.jpeg','.webp'):shutil.copy2(f,FOTOS_ORIG/f.name)
LIMITE={'planta':(1600,90),'planta-celular':(1000,90)}
def foto(nome):
 """Devolve o caminho web da foto, otimizada, ou '' se ela ainda nao existe."""
 orig=next((f for f in FOTOS_ORIG.iterdir() if f.stem.lower()==nome and f.suffix.lower() in ('.png','.jpg','.jpeg','.webp')),None)
 if not orig:return ''
 largura,qualidade=LIMITE.get(nome,(1200,82))
 saida=FOTOS_WEB/(nome+'.jpg')
 if not saida.exists() or saida.stat().st_mtime<orig.stat().st_mtime:
  im=Image.open(orig).convert('RGB')
  if im.width>largura:im=im.resize((largura,round(im.height*largura/im.width)),Image.LANCZOS)
  im.save(saida,'JPEG',quality=qualidade,optimize=True,progressive=True)
 return 'assets/fotos/'+nome+'.jpg'
AREA_FOTO={'Área crítica':'ambiente-critica','Área semicrítica':'ambiente-semicritica','Área não crítica':'ambiente-nao-critica'}
# Foto com nome fora da convencao seria ignorada em silencio, e o trabalho de
# gerar a imagem se perderia sem ninguem notar. O gerador avisa na saida; o
# validar.py trava.
NOMES_VALIDOS={'ambiente-critica','ambiente-semicritica','ambiente-nao-critica','planta','planta-celular'}|{m['id'].lower() for m in MATERIALS}
SOBRANDO=[f.name for f in FOTOS_ORIG.iterdir()
 if f.suffix.lower() in ('.png','.jpg','.jpeg','.webp') and f.stem.lower() not in NOMES_VALIDOS]
if SOBRANDO:
 print('AVISO: foto com nome fora da convencao, nao entra em pagina nenhuma:')
 for n in SOBRANDO:print('  -',n)
 print('  renomeie conforme assets/fichas/LEIA-ME.txt')

PLANTA='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 460" role="img" aria-labelledby="ptitulo pdesc" class="planta">
<title id="ptitulo">Planta esquemática de um serviço de saúde com as três classes de ambiente</title>
<desc id="pdesc">Recepção e sala administrativa como área não crítica; consultório e sala de exame como área semicrítica; sala de procedimentos e expurgo como área crítica. A classificação vem do que se faz na sala, não do tamanho dela.</desc>
<g font-family="Segoe UI, sans-serif">
<rect width="720" height="460" rx="14" fill="#f5f2ec"/>
<g stroke="#243d43" stroke-width="2.5" fill="none"><rect x="26" y="60" width="668" height="330" rx="6"/></g>
<g stroke="#243d43" stroke-width="2">
<rect x="26" y="60" width="250" height="150" fill="#e8eef0"/>
<rect x="26" y="210" width="250" height="180" fill="#e8eef0"/>
<rect x="276" y="60" width="200" height="330" fill="#ece6d7"/>
<rect x="476" y="60" width="218" height="180" fill="#f0e1d9"/>
<rect x="476" y="240" width="218" height="150" fill="#f0e1d9"/>
</g>
<g fill="#243d43" font-size="17" font-weight="600">
<text x="46" y="92">Recepção e espera</text>
<text x="46" y="242">Sala administrativa</text>
<text x="296" y="92">Consultório</text>
<text x="296" y="118">e sala de exame</text>
<text x="496" y="92">Sala de</text>
<text x="496" y="114">procedimentos</text>
<text x="496" y="272">Expurgo e</text>
<text x="496" y="294">processamento</text>
</g>
<g fill="#4a6068" font-size="14">
<text x="46" y="116">Sem procedimento</text>
<text x="46" y="136">e sem paciente em</text>
<text x="46" y="156">atendimento</text>
<text x="46" y="266">Uso exclusivo</text>
<text x="46" y="286">da equipe</text>
<text x="296" y="146">Paciente presente,</text>
<text x="296" y="166">exame sem invadir</text>
<text x="296" y="186">pele ou mucosa</text>
<text x="496" y="140">Procedimento de</text>
<text x="496" y="160">risco, com ou sem</text>
<text x="496" y="180">paciente na sala</text>
<text x="496" y="320">Artigo contaminado</text>
<text x="496" y="340">circula aqui</text>
</g>
<g font-size="13" font-weight="700" letter-spacing="0.06em">
<text x="46" y="370" fill="#3f6070">NÃO CRÍTICA</text>
<text x="296" y="370" fill="#7a6533">SEMICRÍTICA</text>
<text x="496" y="370" fill="#8f4f30">CRÍTICA</text>
</g>
<g font-size="15" fill="#243d43">
<text x="26" y="36" font-weight="600">O que a sala faz decide a classe, não o tamanho nem o nome na porta</text>
<text x="26" y="428" fill="#4a6068">Esquema sem escala. A mesma sala muda de classe quando muda o procedimento realizado nela.</text>
</g>
</g></svg>'''
(ROOT/'assets'/'ambientes.svg').write_text(PLANTA,encoding='utf-8')
# A mesma planta, empilhada. No celular a versao larga so cabia com rolagem
# lateral, e a coluna de area critica ficava fora da tela: quem abria pelo
# telefone via duas das tres classes e nao sabia que faltava uma.
PLANTA_CEL='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 686" role="img" aria-labelledby="pvtitulo pvdesc" class="planta">
<title id="pvtitulo">Planta esquemática de um serviço de saúde com as três classes de ambiente</title>
<desc id="pvdesc">Recepção e sala administrativa como área não crítica; consultório e sala de exame como área semicrítica; sala de procedimentos e expurgo como área crítica. A classificação vem do que se faz na sala, não do tamanho dela.</desc>
<g font-family="Segoe UI, sans-serif">
<rect width="380" height="686" rx="12" fill="#f5f2ec"/>
<g fill="#243d43" font-size="15" font-weight="600">
<text x="18" y="26">O que a sala faz decide a classe,</text>
<text x="18" y="48">não o tamanho nem o nome na porta</text>
</g>
<g stroke="#243d43" stroke-width="2">
<rect x="18" y="66" width="344" height="166" fill="#e8eef0"/>
<rect x="18" y="244" width="344" height="152" fill="#ece6d7"/>
<rect x="18" y="408" width="344" height="232" fill="#f0e1d9"/>
</g>
<g font-size="13" font-weight="700" letter-spacing="0.06em">
<text x="34" y="92" fill="#3f6070">NÃO CRÍTICA</text>
<text x="34" y="270" fill="#7a6533">SEMICRÍTICA</text>
<text x="34" y="434" fill="#8f4f30">CRÍTICA</text>
</g>
<g fill="#243d43" font-size="17" font-weight="600">
<text x="34" y="120">Recepção e espera</text>
<text x="34" y="190">Sala administrativa</text>
<text x="34" y="298">Consultório e sala de exame</text>
<text x="34" y="462">Sala de procedimentos</text>
<text x="34" y="560">Expurgo e processamento</text>
</g>
<g fill="#4a6068" font-size="15">
<text x="34" y="144">Sem procedimento e sem</text>
<text x="34" y="164">paciente em atendimento</text>
<text x="34" y="214">Uso exclusivo da equipe</text>
<text x="34" y="322">Paciente presente, exame</text>
<text x="34" y="342">sem invadir pele ou mucosa</text>
<text x="34" y="366">A sala muda de classe se o</text>
<text x="34" y="386">procedimento mudar</text>
<text x="34" y="486">Procedimento de risco, com</text>
<text x="34" y="506">ou sem paciente na sala</text>
<text x="34" y="528">Piso, parede e teto laváveis</text>
<text x="34" y="584">Artigo contaminado</text>
<text x="34" y="604">circula aqui</text>
<text x="34" y="626">Encontros fechados</text>
</g>
<text x="18" y="668" font-size="13" fill="#4a6068">Esquema sem escala.</text>
</g></svg>'''
(ROOT/'assets'/'ambientes-celular.svg').write_text(PLANTA_CEL,encoding='utf-8')


# A prancha em PNG tem 2,7 MB e o PDF a embutia duas vezes: 6,7 MB dos 8,5 MB do
# arquivo, pesado demais para mandar por WhatsApp. Duas cópias em JPEG resolvem: a
# de 250 kB para a página, em rede móvel, e a de impressão para o PDF, que sai a
# 228 dpi na capa. O PNG fica só como original editável.
_prancha=Image.open(ROOT/'assets'/'materiais.png').convert('RGB')
_prancha.save(ROOT/'assets'/'materiais.jpg',quality=82,optimize=True,progressive=True)
_prancha.save(ROOT/'assets'/'materiais-impressao.jpg',quality=92,optimize=True)

LD_SITE=[dict({'@context':'https://schema.org','@type':'TechArticle'},**{
 'headline':'Revestimentos em serviços de saúde','description':PUBLICACAO['descricao'],
 'inLanguage':'pt-BR','url':PUBLICACAO['url'],'image':PUBLICACAO['url']+'assets/materiais.jpg',
 'datePublished':'2026-09-06','author':{'@type':'Person','name':MARCA['autora'],'jobTitle':MARCA['credencial'],'url':MARCA['site']},
 'publisher':{'@type':'Organization','name':MARCA['marca'],'url':MARCA['site']},'license':MARCA['direitos']})]
parts=[pagina.cabeca('Revestimentos em serviços de saúde | TreinaVISA',PUBLICACAO['descricao'],PUBLICACAO['url'],'',LD_SITE),
pagina.barra()
+'<div class="shell"><main id="topo"><section class="hero"><div>'
+'<p class="selo">RDC 50/2002 e normas complementares · Edição 2.3</p>'
+'<h1>Revestimentos em<br>serviços de saúde</h1>'
+'<p class="lead">Uma biblioteca para escolher, especificar e inspecionar superfícies com clareza.</p>'
+'<p class="autoria">Elaborado por <b>'+E(MARCA['autora'])+'</b>, '+E(MARCA['credencial'].lower())+'.<span> <a href="'+MARCA['site']+'" target="_blank" rel="noopener">'+E(MARCA['siteRotulo'])+'</a> · <a href="'+MARCA['instagram']+'" target="_blank" rel="noopener">'+E(MARCA['instagramRotulo'])+'</a></span></p>'
+'<p class="acoes">'+pagina.zap(PUBLICACAO['whatsappRotulo'])+'<a class="secundario" href="#consulta">Ver as 29 fichas</a></p>'
+'</div><nav class="indice" aria-label="Índice">'+''.join(f'<a href="{h}">{E(t)}</a>' for h,t in pagina.INDICE)+'</nav></section>'
+'<figure><img src="assets/encontros.svg" alt="Esquemas de peça e rejunte, rodapé alinhado e emenda de manta"><figcaption>Encontros que merecem atenção. Esquemas ilustrativos, sem escala; não substituem detalhes de projeto.</figcaption></figure>']
parts.append('<figure class="photo"><img src="assets/materiais.jpg" alt="Amostras ilustrativas de porcelanato, epóxi, vinílico, pintura, granito, quartzo, inox e estofado"><figcaption>Biblioteca visual: porcelanato · epóxi · vinílico · pintura / granito · quartzo · inox · estofado. Imagem gerada por IA, ilustrativa; não representa produtos certificados nem detalhes de execução aprovados.</figcaption></figure>')
parts.append('<section id="areas"><h2>Primeiro, entenda o seu ambiente</h2>'
 +'<p>A RDC 50 não classifica material: classifica ambiente. O que a sala faz decide o que ela exige do piso, da parede e do teto. Comece aqui.</p>'
 +'<figure class="planta-figura"><picture>'
 +f'<source media="(min-width:720px)" srcset="{foto("planta") or "assets/ambientes.svg"}">'
 +f'<img src="{foto("planta-celular") or "assets/ambientes-celular.svg"}" alt="Planta de um serviço de saúde com as três classes de ambiente. Recepção e espera e sala administrativa são área não crítica: sem procedimento e sem paciente em atendimento. Consultório e sala de exame são área semicrítica: paciente presente, exame sem invadir pele ou mucosa. Sala de procedimentos e expurgo são área crítica: procedimento de risco, com ou sem paciente na sala, e circulação de artigo contaminado. O que a sala faz decide a classe, não o tamanho nem o nome na porta.">'
 +'</picture>'+('' if foto('planta') else '<figcaption>Esquema sem escala. A mesma sala muda de classe quando muda o procedimento realizado nela.</figcaption>')+'</figure>'
 +'<div class="area-grid">'+''.join(f'<div class="area">'+(f'<img class="area-foto" src="{foto(AREA_FOTO[t])}" alt="Exemplo de {E(t.lower())} em serviço de saúde" loading="lazy">' if foto(AREA_FOTO.get(t,"")) else '')+f'<span>0{i+1}</span><h3>{E(t)}</h3><p>{E(d)}</p><p class="example">{E(ex)}</p></div>' for i,(t,d,ex) in enumerate(AREAS))+'</div>'+''.join(f'<h3>{E(t)}</h3><p>{E(d)}</p>' for t,d in CONTEXT)+'<p class="ref">'+refhtml('R50','Parte III, 6.2 A.2')+' · '+refhtml('ESTETICA','Introdução e seção 2.7')+'</p></section>')
parts.append('<section id="glossario"><h2>Palavras que você vai encontrar</h2><div class="glossary">'+''.join(f'<details><summary>{E(t)}</summary><p>{E(d)}</p></details>' for t,d in GLOSSARY)+'</div></section>')
parts.append('<section id="custos"><h2>Quanto pode custar?</h2><p>'+E(COST_NOTE)+'</p>')
parts.append('<div class="tools estado"><label>Escolha o seu estado<select id="uf">'+''.join(f'<option value="{u}"{" selected" if u==UF_PADRAO else ""}>{E(n)}</option>' for u,n in UFS)+'</select></label></div>')
parts.append('<p class="ref">Fonte de todos os valores: <a href="'+COST_URL+'" target="_blank" rel="noopener">tabela SINAPI da Caixa</a>, referência de '+mesano(REFERENCIA)+', emitida em '+mesano(EMISSAO)+', sem desoneração e sem BDI.</p>')
parts.append(f'<h3>Fichas sem preço verificado</h3><p>São {len(SEM_PRECO)} das {len(MATERIALS)} fichas, e trocar de estado não muda isso: a SINAPI simplesmente não tem esses serviços. A biblioteca não inventa valor para eles; diz o motivo e o que pedir na cotação.</p><div class="glossary">'+''.join(f'<details id="lacuna-{m["id"]}"><summary>{E(m["id"]+" · "+m["name"])}</summary><p>{E(SEM_PRECO[m["id"]][0])}</p>'+(f'<p class="ref" data-comparar="{m["id"]}"></p>' if SEM_PRECO[m["id"]][1] else '')+f'<p class="ref"><a href="#{m["id"]}">Abrir a ficha {m["id"]}</a></p></details>' for m in MATERIALS if m['id'] in SEM_PRECO)+'</div>')
grupos=[]
for cat in dict.fromkeys(o['category'] for o in CALC):
 grupos.append(f'<optgroup label="{E(cat)}">'+''.join(f'<option value="{i}">{E((o["id"]+" · " if o["id"] else "")+o["name"])}</option>' for i,o in enumerate(CALC) if o['category']==cat)+'</optgroup>')
parts.append('<div class="calculator"><h3>Calcule uma referência para o seu espaço</h3><p>Todas as fichas estão na lista, com o preço do estado escolhido acima. Onde a SINAPI não tem o serviço, a calculadora diz o motivo e deixa você usar o valor da sua própria cotação. Para paredes, informe a área das paredes, não a do piso.</p><div class="tools"><label>Ficha da biblioteca<select id="calc-material">'+''.join(grupos)+'</select></label><label>Preço a usar<select id="calc-price"></select></label></div><div class="tools" id="calc-own-row" hidden><label>Valor da sua cotação, em reais por <span id="calc-own-unit">m²</span><input id="calc-own" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex.: 180"></label></div><div class="tools"><label>Como informar a medida<select id="calc-mode"><option value="area">Área em m²</option><option value="dimensions">Comprimento × largura</option><option value="linear">Comprimento em metros lineares</option><option value="unit">Quantidade de peças</option></select></label><label id="calc-quantity-label"><span id="calc-unit-label">Área (m²)</span><input id="calc-quantity" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex.: 20"></label><label id="calc-length-label" hidden>Comprimento (m)<input id="calc-length" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex.: 4"></label><label id="calc-width-label" hidden>Largura (m)<input id="calc-width" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex.: 5"></label></div><div id="calc-result" role="status" aria-live="polite">Informe as medidas para calcular.</div><p id="calc-scope"></p><p class="ref">O cálculo multiplica a sua medida pelo preço escolhido. Não acrescenta perdas de corte, conserto da base, remoção do que existe hoje nem BDI, e não diz se o material serve para o seu ambiente: isso está na ficha. Para rodapé, informe o comprimento efetivo, descontando as portas.</p></div>')
parts.append('<p>O preço de cada ficha aparece na própria ficha e em <a href="#comparar">Comparar lado a lado</a>, sempre no estado escolhido aqui. Compare dentro do mesmo escopo: o mais barato pode ser justamente o que a ficha desaconselha para o seu ambiente, e o mais caro pode não resolver o seu problema. O preço entra na decisão depois do critério, não antes.</p></section>')
parts.append('<section class="intro">'+''.join(f'<div><h2>{E(t)}</h2><p>{E(p)}</p></div>' for t,p in INTRO)+'</section>')
parts.append('<section id="criterios"><h2>O que a norma exige</h2><p>Abra cada critério para consultar o alcance e o dispositivo exato.</p>')
for rid,title,txt,device,source,kind in RULES:parts.append(f'<details id="regra-{rid}"><summary>{E(title)}</summary><p>{E(txt)}</p><p class="ref">{refhtml(source,device)}</p></details>')
opcoes=''.join('<optgroup label="'+E(cat)+'">'+''.join(f'<option value="{i}">{E(o["id"]+" · "+o["name"])}</option>' for i,o in enumerate(COMPARA) if o['category']==cat)+'</optgroup>' for cat in dict.fromkeys(o['category'] for o in COMPARA))
parts.append('</section><section id="comparar"><h2>Comparar lado a lado</h2>'
+'<p>A pergunta de quem está decidindo raramente é "o que é porcelanato": é "porcelanato ou vinílico na minha sala de procedimento". Escolha até três e veja onde cada um serve, quando evitar, quanto custa no seu estado e o que a norma cobra.</p>'
+'<div class="tools">'
+''.join(f'<label>Material {k+1}{"" if k<2 else " (opcional)"}<select class="comparar-escolha" data-slot="{k}"><option value="">Nenhum</option>'+opcoes+'</select></label>' for k in range(3))
+'</div><div id="comparador" class="tabela-rolagem"></div>'
+'<p class="ref">'+E(pagina.DOIS_PROFISSIONAIS)+'</p></section>'
+'<section id="consulta"><h2>Biblioteca de materiais</h2><p>O filtro localiza fichas. A indicação de uso não é uma aprovação de produto: especificação e inspeção são recomendações técnicas, desempenho é comprovação do fabricante, e as obrigações estão nos critérios ligados ao pé de cada ficha.</p><div class="tools"><label>Buscar material ou cuidado<input id="busca" type="search" placeholder="Ex.: epóxi, juntas, umidade"></label><label>Superfície<select id="categoria"><option value="">Todas as superfícies</option>')
cats=list(dict.fromkeys(m['category'] for m in MATERIALS))
parts.extend(f'<option>{E(c)}</option>' for c in cats)
parts.append('</select></label><button id="limpar" type="button">Limpar filtros</button></div><p id="contagem" role="status" aria-live="polite"></p><div id="fichas">')
for m in MATERIALS:
 parts.append(f'<article id="{m["id"]}" data-category="{E(m["category"])}"><details class="material"><summary><span class="swatch" style="background-image:{"none" if tile(m)<0 else "url(assets/materiais.jpg)"};background-position:{(tile(m)%4)*100/3}% {(tile(m)//4)*100}%" aria-hidden="true"></span><span class="material-heading"><span><p class="category">{E(m["category"])} · {m["id"]}</p><h3>{E(m["name"])}</h3></span><span class="status">{E(m["status"])}</span></span><span class="expand">Abrir ficha +</span></summary><div class="fields">')
 for key,label in FIELDS:parts.append(f'<div><h4>{label}</h4><p>{E(m[key])}</p></div>')
 parts.append('</div>')
 if m['id'] in SEM_PRECO:parts.append(f'<p class="ref">Preço: sem referência na SINAPI. <a href="#lacuna-{m["id"]}">Ver o motivo</a></p>')
 else:parts.append(f'<p class="ref" data-preco-ficha="{m["id"]}">Preço: <a href="{SLUG[m["id"]]}/">ver na página desta ficha</a></p>')
 parts.append('<div class="rulelinks">'+''.join(f'<a href="#regra-{rid}">{E(rulemap[rid][1])}</a>' for rid in m['rules'])+'</div>'
 +f'<p class="ref"><a class="abrir-ficha" href="{SLUG[m["id"]]}/">Abrir a página desta ficha</a></p>'
 +'</details></article>')
parts.append('</div><p id="vazio" hidden>Nenhuma ficha encontrada. Tente outro termo ou limpe os filtros.</p></section><section id="pratica"><h2>Da escolha à inspeção</h2><figure><img src="assets/encontros.svg" alt="Peça e rejunte, rodapé alinhado e emenda de manta"><figcaption>Esquemas sem escala. O detalhe de execução depende do sistema especificado.</figcaption></figure>')
parts.extend(f'<h3>{E(t)}</h3><p>{E(p)}</p>' for t,p in END)
parts.append('</section><section id="fontes"><h2>Referências e alcance da revisão</h2><p>Fontes consultadas em '+DATE+'. Os dispositivos são indicados nos critérios. A publicação não tem caráter oficial da Anvisa.</p>')
for key,s in SOURCES.items():parts.append(f'<div class="source"><h3>{refhtml(key,s["title"])}</h3><p>{E(s["status"])}</p></div>')
parts.append('</section>'+pagina.convite())
parts.append('</main>'+pagina.rodape('','2.3',DATE)
+'<script id="cost-data" type="application/json">'+json.dumps(COSTS_JSON,ensure_ascii=False)+'</script>'
+'<script id="compara-data" type="application/json">'+json.dumps(COMPARA,ensure_ascii=False)+'</script>'
+'<script id="calc-data" type="application/json">'+json.dumps(CALC,ensure_ascii=False)+'</script>'
+'<script id="preco-data" type="application/json">'+json.dumps({'precos':PRECOS,'ufs':UFS,'padrao':UF_PADRAO,'referencia':mesano(REFERENCIA),'url':COST_URL},ensure_ascii=False)+'</script>'
+'<script src="consulta.js?v=12"></script></body></html>')
(ROOT/'index.html').write_text('\n'.join(parts),encoding='utf-8')
# Uma página por ficha. A capa responde "o que existe"; a ficha responde a busca
# de quem já sabe o nome do material e quer saber se pode usar no consultório.
# São 29 endereços indexáveis em vez de um, e cada um abre no assunto certo.
FICHA_DIR=ROOT/'fichas'
if FICHA_DIR.exists():shutil.rmtree(FICHA_DIR)
def campos_ficha(m):
 return ''.join(f'<div><h4>{label}</h4><p>{E(m[key])}</p></div>' for key,label in FIELDS)
def preco_ficha(m):
 if m['id'] in SEM_PRECO:
  motivo=SEM_PRECO[m['id']][0]
  comparar=[COSTS[CHAVE[k]] for k in SEM_PRECO[m['id']][1]]
  extra=('<p class="ref" data-comparar-ficha>'+' · '.join(E(c['name']) for c in comparar)+'</p>') if comparar else ''
  return ('<h2>Quanto pode custar</h2><p>'+E(motivo)+'</p>'+extra
  +'<p class="ref">Peça a cotação por escrito, com medidas, produto e escopo. '
  '<a href="../index.html#custos">Ver a tabela completa e a calculadora</a></p>')
 refs=[i for i,x in enumerate(COSTS) if m['id'] in x['ids']]
 linhas=''.join(f'<div class="cost" data-cost="{i}"><div><b>{E(COSTS[i]["name"])}</b>'
 f'<strong data-preco>{money(valor(COSTS[i]))}/{COSTS[i]["unit"]}</strong></div>'
 f'<p>{E(COSTS[i]["scope"])} <span class="composicao">Composição {E(" + ".join(COSTS[i]["parts"]))}.</span></p></div>' for i in refs)
 return ('<h2>Quanto pode custar</h2>'
 '<div class="tools estado"><label>Escolha o seu estado<select id="uf">'
 +''.join(f'<option value="{u}"{" selected" if u==UF_PADRAO else ""}>{E(n)}</option>' for u,n in UFS)
 +'</select></label></div>'+linhas
 +f'<p class="ref">Custo de serviço da <a href="{COST_URL}" target="_blank" rel="noopener">tabela SINAPI da Caixa</a>, '
 f'referência de {mesano(REFERENCIA)}, sem desoneração e sem BDI: a proposta que você receber costuma vir acima disso. '
 '<a href="../index.html#custos">Comparar com os outros materiais e calcular</a></p>')
for m in MATERIALS:
 sl=SLUG[m['id']]
 url=PUBLICACAO['url']+sl+'/'
 titulo=f"{m['name']} em serviço de saúde | TreinaVISA"
 desc=pagina.primeira_frase(m['description'])+f". {m['status']} segundo a RDC 50 e normas complementares."
 ld=[dict({'@context':'https://schema.org','@type':'TechArticle'},**{
  'headline':m['name'],'description':desc,'inLanguage':'pt-BR','url':url,
  'image':PUBLICACAO['url']+'assets/materiais.jpg','datePublished':'2026-09-06',
  'author':{'@type':'Person','name':MARCA['autora'],'jobTitle':MARCA['credencial'],'url':MARCA['site']},
  'publisher':{'@type':'Organization','name':MARCA['marca'],'url':MARCA['site']},
  'isPartOf':{'@type':'CreativeWork','name':'Biblioteca de revestimentos em serviços de saúde','url':PUBLICACAO['url']},
  'license':MARCA['direitos']}),
 {'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':[
  {'@type':'ListItem','position':1,'name':'Biblioteca de revestimentos','item':PUBLICACAO['url']},
  {'@type':'ListItem','position':2,'name':m['category'],'item':PUBLICACAO['url']+'#consulta'},
  {'@type':'ListItem','position':3,'name':m['name'],'item':url}]}]
 irmas=[o for o in MATERIALS if o['category']==m['category'] and o['id']!=m['id']]
 pg=[pagina.cabeca(titulo,desc,url,'../',ld),pagina.barra('../',ancora=False),
 '<div class="shell"><main id="conteudo">',
 f'<nav class="trilha" aria-label="Trilha"><a href="../index.html">Biblioteca de revestimentos</a> · '
 f'<a href="../index.html#consulta">{E(m["category"])}</a></nav>',
 f'<article class="ficha-pagina"><p class="selo">{E(m["category"])} · Ficha {m["id"]}</p>',
 f'<h1>{E(m["name"])}</h1><p class="status-linha">{E(m["status"])}</p>']
 if tile(m)>=0:
  pg.append(f'<div class="amostra" style="background-image:url(../assets/materiais.jpg);'
  f'background-position:{(tile(m)%4)*100/3}% {(tile(m)//4)*100}%" role="img" '
  f'aria-label="Textura ilustrativa da família {E(m["category"].lower(),quote=True)}"></div>'
  '<p class="ref">Textura ilustrativa da família. Confirme o produto e o acabamento com o fornecedor.</p>')
 pg.append('<div class="fields">'+campos_ficha(m)+'</div>')
 pg.append('<p class="acoes-ficha">'+pagina.compartilhar(url,m['name'])+pagina.zap('Agendar uma vistoria','zap')+'</p></article>')
 pg.append('<section class="bloco">'+preco_ficha(m)+'</section>')
 pg.append('<section class="bloco"><h2>O que a norma exige aqui</h2>')
 for rid in m['rules']:
  r=rulemap[rid]
  pg.append(f'<h3>{E(r[1])}</h3><p>{E(r[2])}</p><p class="ref">{refhtml(r[4],r[3])}</p>')
 for key in m['extra']:
  pg.append(f'<p class="ref">{refhtml(key,SOURCES[key]["title"])}</p>')
 pg.append('<p class="ref aviso">'+E(pagina.DOIS_PROFISSIONAIS)+'</p></section>')
 if irmas:
  pg.append('<section class="bloco"><h2>Outras opções de '+E(m['category'].lower())+'</h2><div class="irmas">'
  +''.join(f'<a href="../{SLUG[o["id"]]}/"><b>{E(o["name"])}</b><span>{E(o["status"])}</span></a>' for o in irmas)
  +'</div><p class="ref"><a href="../index.html#consulta">Ver as 29 fichas da biblioteca</a></p></section>')
 pg.append(pagina.convite())
 pg.append('</main>'+pagina.rodape('../','2.3',DATE)
 +'<script id="preco-data" type="application/json">'+json.dumps({'precos':PRECOS,'ufs':UFS,'padrao':UF_PADRAO,'referencia':mesano(REFERENCIA),'url':COST_URL},ensure_ascii=False)+'</script>'
 +'<script id="cost-data" type="application/json">'+json.dumps(COSTS_JSON,ensure_ascii=False)+'</script>'
 +'<script src="../ficha.js?v=1"></script></body></html>')
 destino=FICHA_DIR/sl
 destino.mkdir(parents=True)
 (destino/'index.html').write_text('\n'.join(pg),encoding='utf-8')


# publicar/ e exatamente o que sobe para a internet: a pagina, o estilo, o script
# e as imagens. PDF, Markdown, JSON e os fontes em Python ficam so aqui.
PUB=ROOT/'publicar'
if PUB.exists():shutil.rmtree(PUB)
(PUB/'assets').mkdir(parents=True)
for nome in ['index.html','estilo.css','consulta.js','ficha.js']:shutil.copy2(ROOT/nome,PUB/nome)
for pasta in sorted(FICHA_DIR.iterdir()):shutil.copytree(pasta,PUB/pasta.name)
for nome in ['materiais.jpg','encontros.svg','ambientes.svg','ambientes-celular.svg','treinavisa.png']:shutil.copy2(ROOT/'assets'/nome,PUB/'assets'/nome)
(PUB/'assets'/'fotos').mkdir(parents=True,exist_ok=True)
for f in FOTOS_WEB.glob('*.jpg'):shutil.copy2(f,PUB/'assets'/'fotos'/f.name)

# A página servida em /biblioteca é uma cópia desta pasta dentro de public/. Sem
# esta linha o site no ar fica numa edição velha em silêncio, e ninguém percebe.
# O mapa do site e escrito aqui porque e o gerador quem sabe os enderecos das
# fichas. Sem ele o Google acha a capa e descobre as 29 paginas so pelos links.
MAPA=ROOT.parent.parent/'public'/'sitemap.xml'
if MAPA.parent.is_dir():
 urls=[(PUBLICACAO['url'],'monthly','1.0')]+[(PUBLICACAO['url']+SLUG[m['id']]+'/','monthly','0.8') for m in MATERIALS]
 urls.append(('https://inspecvisa.consultorasanitaria.com.br/agendar','monthly','0.6'))
 mapa=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
 for u,freq,pri in urls:
  mapa.append(f'  <url><loc>{u}</loc><lastmod>{ISO}</lastmod><changefreq>{freq}</changefreq><priority>{pri}</priority></url>')
 mapa.append('</urlset>')
 MAPA.write_text(chr(10).join(mapa)+chr(10),encoding='utf-8')

APP=ROOT.parent.parent/'public'/'biblioteca'
if APP.parent.is_dir():
 if APP.exists():shutil.rmtree(APP)
 shutil.copytree(PUB,APP)
 # A pasta de entrada e refeita depois do rmtree para o fluxo continuar: a
 # Ester salva a foto ali e a proxima execucao recolhe. O LEIA-ME vai junto,
 # com a convencao de nome que decide onde cada foto entra.
 ENTRADA.mkdir(parents=True,exist_ok=True)
 shutil.copy2(FOTOS_ORIG/'LEIA-ME.txt',ENTRADA/'LEIA-ME.txt')

md=['# Revestimentos em serviços de saúde',f"{MARCA['marca']} · Edição 2.3 · {DATE}",
f"Elaborado por {MARCA['autora']}, {MARCA['credencial'].lower()}. {MARCA['siteRotulo']} · {MARCA['instagramRotulo']}",
f"© {MARCA['ano']} {MARCA['titular']}, CNPJ {MARCA['cnpj']}. {MARCA['direitos']}",'![Encontros entre superfícies](assets/encontros.svg)','Esquemas ilustrativos, sem escala. Peça e rejunte são verificados separadamente; rodapé alinhado; emenda fechada no sistema de manta.']
md.extend(['## Entenda o ambiente']+[f'### {t}\n\n{d}\n\n{ex}' for t,d,ex in AREAS])
md.extend([f'### {t}\n\n{d}' for t,d in CONTEXT])
md.extend(['## Glossário']+[f'**{t}:** {d}' for t,d in GLOSSARY])
md.extend(['## Custos de referência',COST_NOTE,
f'Os valores abaixo são de {UFNOME[UF_PADRAO]}. A versão em página tem os 27 estados; aqui vai um só, porque o arquivo é estático. Fonte: [tabela SINAPI da Caixa]({COST_URL}), referência de {mesano(REFERENCIA)}, emitida em {mesano(EMISSAO)}.',COST_SCALE]
+[f'**{x["name"]}: {money(valor(x))}/{x["unit"]}.** {x["scope"]} Composição {" + ".join(x["parts"])}.' for x in COSTS])
md.append('### Fichas sem preço verificado')
md.extend(f'**{m["id"]} · {m["name"]}.** {SEM_PRECO[m["id"]][0]}' for m in MATERIALS if m['id'] in SEM_PRECO)
for t,p in INTRO:md.extend(['## '+t,p])
md.append('## Critérios normativos')
for rid,title,txt,device,source,kind in RULES:md.extend(['### '+title,txt,f'**{kind}.** [{source}: {device}]({SOURCES[source]["url"]})'])
md.append('Especificação e inspeção são recomendações técnicas; desempenho é comprovação do fabricante; as obrigações estão nos critérios ligados a cada ficha.')
for m in MATERIALS:
 md.extend(['## '+m['id']+' · '+m['name'],m['category']+' · '+m['status']])
 for k,l in FIELDS:md.append(f'**{l}:** {m[k]}')
 if m['id'] in SEM_PRECO:md.append('**Preço:** sem referência na SINAPI, ver Custos de referência.')
 else:md.append('**Preço:** '+'; '.join(f'{x["name"]}, {money(valor(x))}/{x["unit"]}' for x in COSTS if m['id'] in x['ids'])+f' (em {UFNOME[UF_PADRAO]}).')
 md.extend(f'[{s}: {d}]({SOURCES[s]["url"]})' for s,d in refs(m))
for t,p in END:md.extend(['## '+t,p])
md.append('## Referências e alcance da revisão')
for k,s in SOURCES.items():md.extend([f'### [{k}: {s["title"]}]({s["url"]})',s['status']])
(ROOT/'biblioteca.md').write_text('\n\n'.join(md)+'\n',encoding='utf-8')

# A4 próprio para impressão. Cada ficha é mantida inteira; dois materiais por página.
pdfmetrics.registerFont(TTFont('Body','C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('Bold','C:/Windows/Fonts/segoeuib.ttf'))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold')
INK=HexColor('#26354a'); ACC=HexColor('#765420'); MUTE=HexColor('#526070')
style=ParagraphStyle('body',fontName='Body',fontSize=10,leading=14,textColor=INK,spaceAfter=7)
small=ParagraphStyle('small',parent=style,fontSize=8,leading=11,textColor=MUTE,spaceAfter=5)
h2=ParagraphStyle('h2',parent=style,fontName='Bold',fontSize=19,leading=23,spaceAfter=14)
h3=ParagraphStyle('h3',parent=style,fontName='Bold',fontSize=14,leading=18,spaceAfter=9)
def p(t,st=style):return Paragraph(escape(t),st)
def rich(t,st=style):return Paragraph(t,st)
c=canvas.Canvas(str(ROOT/'revestimentos.pdf'),pagesize=(595.28,841.89))
c.setTitle('Revestimentos em serviços de saúde');c.setAuthor('TreinaVISA');c.setSubject('Biblioteca de revestimentos com critérios normativos e orientações de especificação')
class Sample(Flowable):
 def __init__(self,idx):
  Flowable.__init__(self);self.idx=idx;self.width=511;self.height=42
 def draw(self):
  cc=self.canv;cc.saveState();path=cc.beginPath();path.rect(0,6,90,32);cc.clipPath(path,stroke=0)
  cc.drawImage(str(ROOT/'assets'/'materiais-impressao.jpg'),-(self.idx%4)*90,6-(1-self.idx//4)*32,360,64)
  cc.restoreState();cc.setFont('Body',8);cc.setFillColor(MUTE);cc.drawString(102,19,'Textura ilustrativa da família. Confirme o produto e o acabamento.')
PAGE=0; contents=[]
def chrome():
 global PAGE
 PAGE+=1
 c.setFillColor(INK);c.setFont('Bold',9);c.drawString(42,809,'TreinaVISA  /  Biblioteca de revestimentos')
 c.setStrokeColor(HexColor('#ced6dd'));c.line(42,797,553,797)
 c.setFillColor(MUTE);c.setFont('Body',8);c.drawString(42,28,'Edição 2.3 · '+DATE+' · '+MARCA['marca']);c.drawRightString(553,28,str(PAGE))
def start(title,anchor=None):
 chrome()
 if anchor:c.bookmarkPage(anchor);c.addOutlineEntry(title,anchor,0)
 return [p(title,h2)]
# O texto das fichas cresceu. Em vez de orçar as páginas na mão e quebrar a
# geração quando sobra conteúdo, o que não coube transborda para a página seguinte.
def finish(flow):
 while True:
  restante=len(flow)
  Frame(42,47,511,737,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0).addFromList(flow,c)
  c.showPage()
  if not flow:return
  if len(flow)==restante:raise RuntimeError(f'Bloco maior que a página inteira, na página {PAGE}')
  chrome()
def diagram(y):
 c.setFillColor(HexColor('#edf1f4'));c.rect(42,y,511,132,fill=1,stroke=0)
 c.setLineWidth(1.5);c.setStrokeColor(INK);c.setFillColor(HexColor('#c5d4df'))
 for x in [60,121]:c.rect(x,y+51,51,29,fill=1,stroke=1)
 c.setFillColor(ACC);c.rect(111,y+51,10,29,fill=1,stroke=0)
 c.setFillColor(HexColor('#c5d4df'));c.rect(240,y+27,18,70,fill=1,stroke=1);c.rect(258,y+27,67,15,fill=1,stroke=1)
 c.rect(405,y+51,52,12,fill=1,stroke=1);c.rect(462,y+51,69,12,fill=1,stroke=1)
 c.setFillColor(ACC);c.rect(457,y+51,5,12,fill=1,stroke=0)
 c.setFillColor(INK);c.setFont('Bold',10)
 c.drawString(60,y+106,'Peça + rejunte');c.drawString(235,y+106,'Piso + parede');c.drawString(397,y+106,'Manta + emenda')
 c.setFont('Body',8);c.drawString(60,y+12,'Verificar ambos');c.drawString(235,y+12,'Alinhar e permitir limpeza');c.drawString(397,y+12,'Fechar conforme o sistema')

# Capa com desenho vetorial e logo original, sem alterar o arquivo fornecido.
PAGE=1;c.setFillColor(HexColor('#f4f6f8'));c.rect(0,0,595.28,841.89,fill=1,stroke=0)
c.drawImage(str(ROOT/'assets'/'treinavisa.png'),40,642,200,200,mask='auto')
title=Paragraph('Revestimentos<br/>em serviços<br/>de saúde',ParagraphStyle('cover',parent=h2,fontSize=40,leading=46))
title.wrap(510,200);title.drawOn(c,42,468)
p('Uma biblioteca para escolher, especificar e inspecionar superfícies com clareza.',ParagraphStyle('lead',parent=style,fontSize=16,leading=23)).wrapOn(c,465,100)
lead=p('Uma biblioteca para escolher, especificar e inspecionar superfícies com clareza.',ParagraphStyle('lead2',parent=style,fontSize=16,leading=23));_,hh=lead.wrap(470,100);lead.drawOn(c,42,424-hh)
c.drawImage(str(ROOT/'assets'/'materiais-impressao.jpg'),42,169,511,190,mask='auto')
c.setFont('Body',9);c.setFillColor(MUTE);c.drawString(42,150,'Amostras ilustrativas geradas por IA. Não representam produtos certificados.')
c.setFont('Bold',12);c.setFillColor(INK);c.drawString(42,105,'RDC 50/2002 e normas complementares')
c.setFont('Body',10);c.drawString(42,86,'Elaborado por '+MARCA['autora']+' · '+MARCA['credencial'])
c.drawString(42,71,MARCA['marca']+' · Edição 2.3 · '+DATE)
c.setFont('Body',8);c.setFillColor(MUTE);c.drawString(42,56,'© '+MARCA['ano']+' '+MARCA['titular']+' · CNPJ '+MARCA['cnpj']+' · '+MARCA['siteRotulo']+' · '+MARCA['instagramRotulo']);c.showPage()
flow=start('Qual é o meu ambiente?','areas')
for t,d,ex in AREAS:flow.extend([p(t,h3),p(d),p(ex,small),Spacer(1,12)])
flow.append(p('RDC 50/2002, Parte III, 6.2 A.2. Exemplos explicativos, sujeitos ao enquadramento das atividades reais.',small));finish(flow)
flow=start('Clínicas, consultórios e estética','contexto')
diagram(120)
for t,d in CONTEXT:flow.extend([p(t,h3),p(d),Spacer(1,16)])
finish(flow)
for off in range(0,len(GLOSSARY),7):
 flow=start('Palavras que ajudam a escolher','glossario'+str(off))
 for t,d in GLOSSARY[off:off+7]:flow.extend([p(t,h3),p(d)])
 finish(flow)
flow=start('Quanto pode custar?','custos')
flow.append(p(COST_NOTE))
flow.append(rich(f'Valores de <b>{escape(UFNOME[UF_PADRAO])}</b>. A versão em página traz os 27 estados. {escape(COST_SCALE)}',small))
flow.append(rich(f'<link href="{COST_URL}" color="#765420">{escape(cost_ref(UF_PADRAO))}</link>, emitida em {mesano(EMISSAO)}, sem BDI.',small))
for group in dict.fromkeys(x['group'] for x in COSTS):
 flow.append(p(group,h3))
 for x in [v for v in COSTS if v['group']==group]:
  flow.extend([CondPageBreak(70),rich('<b>'+escape(x['name'])+'</b> · '+money(valor(x))+'/'+x['unit']),p(x['scope']+' Composição '+' + '.join(x['parts'])+'.',small),Spacer(1,7)])
flow.append(p('Fichas sem preço verificado',h3))
flow.append(p('Trocar de estado não resolve estas: a SINAPI não tem o serviço. A biblioteca não inventa valor; diz o motivo e o que pedir na cotação.'))
for m in MATERIALS:
 if m['id'] in SEM_PRECO:
  flow.extend([CondPageBreak(62),rich('<b>'+escape(m['id']+' · '+m['name'])+'</b>'),p(SEM_PRECO[m['id']][0],small),Spacer(1,5)])
flow.append(p('Compare dentro do mesmo grupo e do mesmo escopo. O preço entra na decisão depois do critério, não antes.',small));finish(flow)
flow=start('Como consultar esta biblioteca','inicio')
for t,txt in INTRO:flow.extend([p(t,h3),p(txt)])
flow.extend([Spacer(1,10),p('Percurso de leitura',h3),p('Critérios normativos → fichas de materiais → especificação e inspeção → referências. Use os marcadores do PDF para navegar entre as seções.')]);finish(flow)
for offset in range(0,len(RULES),4):
 flow=start('Critérios normativos'+(' · continuação' if offset else ''),'criterios'+str(offset))
 for rid,t,txt,device,source,kind in RULES[offset:offset+4]:
  flow.extend([p(t,h3),p(txt),rich(f'<link href="{escape(SOURCES[source]["url"],{chr(34):"&quot;"})}" color="#765420">{escape(source+": "+device)}</link>',small),Spacer(1,8)])
 finish(flow)
for cat in cats:
 subset=[m for m in MATERIALS if m['category']==cat]
 flow=start(cat,'categoria-'+cat)
 flow.append(p('Especificação e inspeção são recomendações técnicas; desempenho é comprovação do fabricante. Os dispositivos exatos estão em Critérios normativos.',small))
 for m in subset:
  flow.append(CondPageBreak(170))
  flow.extend([p(m['id']+' · '+m['name'],h3),p(m['status'],small)]+([Sample(tile(m))] if tile(m)>=0 else []))
  for key,label in FIELDS:flow.append(rich('<b>'+label+':</b> '+escape(m[key])))
  if m['id'] in SEM_PRECO:flow.append(p('Preço: sem referência na SINAPI, ver Quanto pode custar.',small))
  else:flow.append(p('Preço em '+UFNOME[UF_PADRAO]+': '+'; '.join(x['name']+', '+money(valor(x))+'/'+x['unit'] for x in COSTS if m['id'] in x['ids'])+'.',small))
  labels=[]
  for rid in m['rules']:
   r=rulemap[rid]; labels.append(r[4]+': '+r[1])
  flow.append(p('Critérios: '+'; '.join(labels)+'.',small))
  used=list(dict.fromkeys([rulemap[r][4] for r in m['rules']]+m['extra']))
  flow.append(rich(' · '.join(f'<link href="{escape(SOURCES[s]["url"],{chr(34):"&quot;"})}" color="#765420">{s}</link>' for s in used),small))
  flow.append(Spacer(1,15))
 finish(flow)
for offset in [0,3]:
 flow=start('Da escolha à inspeção' if offset==0 else 'Registro e limites','pratica'+str(offset))
 for t,txt in END[offset:offset+3]:flow.extend([p(t,h3),p(txt),Spacer(1,12)])
 finish(flow)
for offset in range(0,len(SOURCES),3):
 flow=start('Referências e alcance da revisão','fontes'+str(offset))
 for key in list(SOURCES)[offset:offset+3]:
  s=SOURCES[key];flow.extend([p(key+' · '+s['title'],h3),p(s['status']),rich(f'<link href="{escape(s["url"],{chr(34):"&quot;"})}" color="#765420">Abrir fonte de consulta</link>'),Spacer(1,16)])
 flow.append(p('Fontes consultadas em '+DATE+'.',small));finish(flow)
flow=start('Autoria e direitos','autoria')
flow.extend([p('Elaborado por '+MARCA['autora'],h3),p(MARCA['credencial']+'. '+MARCA['siteRotulo']+' · '+MARCA['instagramRotulo']),Spacer(1,10),
 p('Titularidade',h3),p(MARCA['titular']+', CNPJ '+MARCA['cnpj']+'. '+MARCA['endereco']+'.'),p(MARCA['direitos']),Spacer(1,10),
 p('Alcance',h3),p(MARCA['isencao']),Spacer(1,10),
# A página aberta é a versão viva: o preço da SINAPI muda todo mês e o PDF não.
 p('Onde está a versão atualizada',h3),p('A página '+PUBLICACAO['url']+' traz os 27 estados e a referência do mês. Para uma vistoria no imóvel junto com o projeto: '+MARCA['siteRotulo']+'.')])
finish(flow)
c.save()
print(json.dumps({'materials':len(MATERIALS),'rules':len(RULES),'pages':PAGE,'pdf':str(ROOT/'revestimentos.pdf')},ensure_ascii=False))




