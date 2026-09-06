from pathlib import Path
import json,re,hashlib
from PIL import Image,ImageDraw
from pypdf import PdfReader
from conteudo import MATERIALS,RULES
from areas import AMBIENTES,ESTADOS,ONDE
from complementos import COSTS,SEM_PRECO,MARCA,UF_PADRAO
from precos import PRECOS,UFS
import fitz, fichas, pagina
# O texto publicado é o de fichas.py, o mesmo que gerar.py aplica.
fichas.aplicar(MATERIALS)
root=Path(__file__).resolve().parent
pdf=PdfReader(root/'revestimentos.pdf')
text='\n'.join(p.extract_text() for p in pdf.pages)
md=(root/'biblioteca.md').read_text(encoding='utf-8')
web=(root/'index.html').read_text(encoding='utf-8')
for m in MATERIALS:
 assert m['name'] in text and m['name'] in md and m['name'] in web,m['id']
 for field in ['description','use','limit','spec','proof','inspect']:
  assert m[field] in md
for r in RULES:assert r[1] in text
# A matriz de ambientes e o que responde "posso usar na minha sala?". Sem ficha
# de fora, sem estado invalido e com a legenda ancorada onde a ficha aponta.
assert set(ONDE)=={m['id'] for m in MATERIALS},'ficha sem linha em areas.py'
assert 'id="como-ler"' in web,'legenda da matriz fora da capa'
for m in MATERIALS:
 linha=ONDE[m['id']]
 assert len(linha)==5 and linha[4].strip(),m['id']
 for e in linha[:4]:assert e in ESTADOS or e is None,(m['id'],e)
 ficha=(root/'publicar'/pagina.slug(m['name'])/'index.html').read_text(encoding='utf-8')
 assert 'class="onde"' in ficha,m['id']
 for _,nome,_ in AMBIENTES:assert nome in ficha,(m['id'],nome)
 assert linha[4] in ficha and linha[4] in md,m['id']
assert '—' not in md
links=sum(len(p.get('/Annots',[])) for p in pdf.pages)
assert links>30
# As miniaturas são refeitas a cada validação: página antiga guardada em disco
# já escondeu um PDF quebrado antes.
for old in (root/'qa').glob('pagina-*.png'):old.unlink()
doc=fitz.open(root/'revestimentos.pdf')
for i,page in enumerate(doc,1):
 page.get_pixmap(dpi=110).save(root/'qa'/f'pagina-{i:02d}.png')
doc.close()
pages=sorted((root/'qa').glob('pagina-*.png'))
assert len(pages)==len(pdf.pages)
# Toda ficha precisa ter preço verificado ou o motivo escrito da falta, nunca as duas
# coisas e nunca nenhuma: é o que impede a calculadora de inventar um valor.
comPreco={i for x in COSTS for i in x['ids']}
for m in MATERIALS:
 assert (m['id'] in comPreco)!=(m['id'] in SEM_PRECO),m['id']
 assert (SEM_PRECO[m['id']][0] if m['id'] in SEM_PRECO else m['name']) in web
# O codigo da composicao precisa estar legivel, nao so dentro do JSON: e ele que
# permite conferir o valor na tabela da Caixa. Saiu da capa junto com os cartoes
# e passou a viver na pagina de cada ficha.
paginas_txt=' '.join(f.read_text(encoding='utf-8') for f in (root/'publicar').glob('*/index.html'))
for x in COSTS:
 for codigo in x['parts']:assert codigo in md and codigo in paginas_txt,codigo
# Todo estado precisa ter valor para toda composição citada: o seletor não pode
# oferecer uma UF que devolve tela em branco.
for codigo,valores in PRECOS.items():
 assert len(valores)==len(UFS),(codigo,len(valores))
 assert all(v>0 for v in valores.values()),codigo
# Autoria e titularidade aparecem nos três formatos.
for campo in ['titular','cnpj','autora','instagramRotulo','siteRotulo']:
 assert MARCA[campo] in web,campo
for campo in ['titular','cnpj','autora']:
 assert MARCA[campo] in text,campo
# A página publicada não distribui o PDF nem o Markdown: eles ficam locais.
for arquivo in ['revestimentos.pdf','biblioteca.md','biblioteca.json']:
 assert arquivo not in web,arquivo
# A página servida em /biblioteca precisa ser a mesma que acabou de ser gerada.
# Sem esta conferência, uma cópia esquecida deixa o site no ar numa edição velha.
# Cada ficha tem página própria, e a capa aponta para todas: 29 endereços
# indexáveis. Um slug repetido ou um link solto some sem erro nenhum.
paginas=sorted((root/'publicar').glob('*/index.html'))
assert len(paginas)==len(MATERIALS),f'{len(paginas)} páginas de ficha para {len(MATERIALS)} fichas'
for pag in paginas:
 texto=pag.read_text(encoding='utf-8')
 assert '<h1>' in texto and 'BreadcrumbList' in texto,pag.parent.name
 assert 'clarity.ms' in texto and 'fbevents' in texto,'medição faltando em '+pag.parent.name
 assert f'href="../index.html' in texto,'sem volta para a capa em '+pag.parent.name
 assert f'/biblioteca/{pag.parent.name}/' in texto,'canônico errado em '+pag.parent.name
for pag in paginas:
 assert f'{pag.parent.name}/' in web,'a capa não liga a ficha '+pag.parent.name
mapa=(root.parent.parent/'public'/'sitemap.xml').read_text(encoding='utf-8')
for pag in paginas:
 assert f'/biblioteca/{pag.parent.name}/' in mapa,'fora do sitemap: '+pag.parent.name

# Foto de ambiente e de ficha entram pelo nome do arquivo. Nome fora da
# convencao e ignorado sem erro: o gerador nao acha e a pagina sai sem a foto.
# Esta conferencia acusa a foto que ficou pelo caminho.
fonte=root/'assets'/'fichas'
web_fotos=root/'assets'/'fotos'
validos=pagina.FOTOS_FIXAS|{m['id'].lower() for m in MATERIALS}
if fonte.is_dir():
 for f in fonte.iterdir():
  if f.suffix.lower() not in ('.png','.jpg','.jpeg','.webp'):continue
  stem=f.stem.lower()
  ids={m['id'].lower() for m in MATERIALS}
  ok=stem in validos or (stem.split('-')[0] in ids and '-' in stem)
  assert ok,f'foto com nome fora da convencao: {f.name} (ver assets/fichas/LEIA-ME.txt)'
  saida=web_fotos/(stem+'.jpg')
  assert saida.is_file(),'foto nao otimizada: '+f.name
  assert saida.stat().st_size<400_000,f'{saida.name} tem {saida.stat().st_size//1024} kB, pesado demais para a pagina'
  assert (root/'publicar'/'assets'/'fotos'/saida.name).is_file(),'foto nao publicada: '+saida.name

publicada=root.parent.parent/'public'/'biblioteca'/'index.html'
assert publicada.is_file(),'public/biblioteca/index.html não existe: rode gerar.py'
assert publicada.read_bytes()==(root/'publicar'/'index.html').read_bytes(),'public/biblioteca está desatualizada'

for start in range(0,len(pages),4):
 board=Image.new('RGB',(1100,1610),'#b7bdc5');draw=ImageDraw.Draw(board)
 for i,path in enumerate(pages[start:start+4]):
  im=Image.open(path).convert('RGB');im.thumbnail((540,775))
  x=(i%2)*550;y=(i//2)*805
  board.paste(im,(x,y+23));draw.text((x+8,y+4),path.stem,fill='black')
 board.save(root/'qa'/f'contato-{start//4+1}.jpg')
(root/'qa'/'validacao.json').write_text(json.dumps(dict(pages=len(pdf.pages),materials=len(MATERIALS),rules=len(RULES),links=links,selectable_text=True,all_material_titles_in_three_formats=True),indent=2))
print('OK:',len(pdf.pages),'páginas;',len(MATERIALS),'fichas;',links,'links/anotações')
