"""Peças comuns às páginas do site: cabeçalho, barra fixa, rodapé, medição e a
página própria de cada ficha.

A biblioteca tem duas profundidades. A capa mora em `/biblioteca/` e as fichas em
`/biblioteca/<slug>/`, uma pasta cada, para a URL terminar em barra e os caminhos
relativos resolverem sozinhos. Toda função aqui recebe `pre`, o prefixo que leva
de volta à raiz da biblioteca: '' na capa e '../' na ficha.
"""
import html,json,re,unicodedata
from complementos import MARCA,PUBLICACAO

E=html.escape

# Os identificadores saíram dos projetos da consultora (lp-farmacia,
# lp-pasta-ilpi): o padrão dela é gtag e fbq diretos, sem contêiner do GTM.
MEDICAO=dict(clarity='y109t0glph',pixel='1573989199955202',ads='AW-16927894187')

def slug(texto):
 """`Porcelanato técnico ou esmaltado` vira `porcelanato-tecnico-ou-esmaltado`."""
 t=unicodedata.normalize('NFKD',texto).encode('ascii','ignore').decode()
 t=re.sub(r'[^a-zA-Z0-9]+','-',t).strip('-').lower()
 return re.sub(r'-+','-',t)

def primeira_frase(texto,limite=155):
 frase=texto.split('. ')[0].strip().rstrip('.')
 return frase if len(frase)<=limite else frase[:limite-1].rsplit(' ',1)[0]+'…'

def medicao():
 """Audiência, mapa de calor e público de anúncio. Carregam depois da página."""
 c=MEDICAO
 return ('<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}</script>'
 '<script async src="https://www.googletagmanager.com/gtag/js?id='+c["ads"]+'"></script>'
 '<script>gtag("js",new Date());gtag("config","'+c["ads"]+'");</script>'
 '<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};'
 'if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;'
 's=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");'
 'fbq("init","'+c["pixel"]+'");fbq("track","PageView");</script>'
 '<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};'
 't=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;'
 'y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);'
 '})(window,document,"clarity","script","'+c["clarity"]+'");</script>')

def cabeca(titulo,descricao,url,pre='',ld=None,extra=''):
 """<head> completo: título, descrição, canônico, redes, JSON-LD e medição."""
 dados=ld or []
 partes=['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1">',
 f'<title>{E(titulo)}</title>',
 f'<meta name="description" content="{E(descricao,quote=True)}">',
 f'<meta name="author" content="{E(MARCA["autora"],quote=True)}">',
 f'<link rel="canonical" href="{url}">',
 '<meta property="og:type" content="article"><meta property="og:locale" content="pt_BR">',
 f'<meta property="og:site_name" content="{E(MARCA["marca"],quote=True)}">',
 f'<meta property="og:title" content="{E(titulo.split(" | ")[0],quote=True)}">',
 f'<meta property="og:description" content="{E(descricao,quote=True)}">',
 f'<meta property="og:url" content="{url}">',
 f'<meta property="og:image" content="{PUBLICACAO["url"]}assets/materiais.jpg">',
 '<meta name="twitter:card" content="summary_large_image">']
 for bloco in dados:
  partes.append('<script type="application/ld+json">'+json.dumps(bloco,ensure_ascii=False)+'</script>')
 partes.append(medicao())
 partes.append(extra)
 partes.append(f'<link rel="stylesheet" href="{pre}estilo.css?v=13"></head><body>')
 return ''.join(partes)

ATALHOS=[('#areas','Ambientes'),('#glossario','Termos'),('#custos','Custos'),
 ('#comparar','Comparar'),('#criterios','Critérios'),('#consulta','Materiais'),('#pratica','Inspeção')]
INDICE=[('#areas','Qual é o meu ambiente?'),('#glossario','Entenda os termos'),
 ('#custos','Compare os custos'),('#comparar','Comparar lado a lado'),('#criterios','Entenda os critérios'),
 ('#consulta','Consulte os materiais'),('#pratica','Da escolha à inspeção'),
 ('#fontes','Fontes e limites')]

def zap(rotulo=None,classe='zap'):
 # Na barra do celular o botao divide a largura com a logo: ali ele diz so
 # "Vistoria", e volta ao rotulo inteiro quando ha espaco.
 dentro=(E(rotulo) if rotulo else
 '<span class="rot-curto">Vistoria</span><span class="rot-longo">'+E(PUBLICACAO['whatsappRotulo'])+'</span>')
 return (f'<a class="{classe}" href="{PUBLICACAO["whatsapp"]}" target="_blank" rel="noopener" data-vistoria>'
 +dentro+'</a>')

def barra(pre='',ancora=True):
 """Na ficha os atalhos apontam para a capa; um `#areas` solto não acharia nada."""
 base='' if ancora else pre+'index.html'
 links=''.join(f'<a href="{base}{h}">{E(t)}</a>' for h,t in ATALHOS)
 return ('<a class="skip" href="#conteudo">Ir para o conteúdo</a>'
 f'<header class="topo"><div class="shell barra"><a class="marca" href="{pre or "#topo"}" aria-label="Biblioteca de revestimentos">'
 f'<span class="logo"><img src="{pre}assets/treinavisa.png" alt="TreinaVISA"></span></a>'
 f'<nav class="atalhos" aria-label="Seções">{links}</nav>'+zap()+'</div></header>')

def convite():
 return ('<aside class="cta"><h2>'+E(PUBLICACAO['ctaTitulo'])+'</h2><p>'+E(PUBLICACAO['ctaTexto'])+'</p>'
 '<p class="acao">'+zap(PUBLICACAO['whatsappRotulo'])+'</p>'
 '<p class="ref">'+E(MARCA['autora'])+', '+E(MARCA['credencial'].lower())+'. '
 f'<a href="{MARCA["site"]}" target="_blank" rel="noopener">'+E(MARCA['siteRotulo'])+'</a></p></aside>')

def rodape(pre='',edicao='',data=''):
 base='' if pre=='' else pre+'index.html'
 links=''.join(f'<a href="{base}{h}">{E(t)}</a>' for h,t in INDICE)
 return ('<footer><div class="rodape">'
 f'<div><p class="credito"><b>Biblioteca de revestimentos em serviços de saúde</b><br>Edição {edicao} · {data} · '+E(MARCA['marca'])+'</p>'
 '<p>'+E(MARCA['direitos'])+'</p><p>'+E(MARCA['isencao'])+'</p>'
 '<p class="ref">Esta página mede audiência para saber o que é lido e o que precisa melhorar. Nenhum dado de saúde é coletado.</p></div>'
 f'<div><h3>Seções</h3><nav aria-label="Seções, rodapé">{links}</nav></div>'
 '<div><h3>Quem escreveu</h3><p>'+E(MARCA['autora'])+', '+E(MARCA['credencial'].lower())+'.</p>'
 f'<p><a href="{MARCA["site"]}" target="_blank" rel="noopener">'+E(MARCA['siteRotulo'])+'</a> · '
 f'<a href="{MARCA["instagram"]}" target="_blank" rel="noopener">'+E(MARCA['instagramRotulo'])+'</a></p>'
 '<p>'+zap(PUBLICACAO['whatsappRotulo'])+'</p>'
 '<p class="ref">© '+MARCA['ano']+' '+E(MARCA['titular'])+' · CNPJ '+E(MARCA['cnpj'])+'. '+E(MARCA['endereco'])+'.</p></div>'
 '</div></footer></div>')

# Quem aprova é a vigilância local, e quem desenha é o arquiteto. A biblioteca
# não substitui nenhum dos dois, e dizer isso alto evita a leitura de que basta
# escolher o material certo da lista.
DOIS_PROFISSIONAIS=('A aprovação depende da avaliação do seu caso pela vigilância sanitária local, '
'que tem exigências próprias e olha o ambiente inteiro, não o material isolado. '
'Na prática, o projeto pede dois profissionais: a consultora sanitária, que lê a exigência e diz o que a '
'vigilância vai cobrar, e o arquiteto ou engenheiro, que desenha e responde tecnicamente pela obra. '
'Esta biblioteca dá a base comum aos dois; ela não faz o papel de nenhum.')

def compartilhar(url,titulo):
 """Compartilhamento assinado: o texto leva a autoria junto com o endereço."""
 return (f'<button type="button" class="compartilhar" data-url="{E(url,quote=True)}" '
 f'data-titulo="{E(titulo,quote=True)}">Compartilhar esta ficha</button>')
