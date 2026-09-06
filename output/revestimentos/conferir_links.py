"""Confere se todo link publicado responde. Roda separado do validar.py porque
depende de rede: um site fora do ar não pode reprovar a geração dos arquivos."""
import json,re,ssl,sys
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError

RAIZ=Path(__file__).resolve().parent
CABECALHO={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'}

def urls():
 achados=[]
 for arquivo in ['index.html','biblioteca.md','biblioteca.json']:
  texto=(RAIZ/arquivo).read_text(encoding='utf-8')
  for u in re.findall(r'https?://[^\s"\'<>)\\]+',texto):
   u=u.rstrip('.,;')
   if u not in achados:achados.append(u)
 return achados

def conferir(u):
 ctx=ssl.create_default_context()
 ctx.check_hostname=False;ctx.verify_mode=ssl.CERT_NONE
 try:
  # HEAD é recusado por vários portais de governo; GET com leitura curta basta.
  with urlopen(Request(u,headers=CABECALHO),timeout=45,context=ctx) as r:
   corpo=r.read(4000)
   return r.status,len(corpo),r.geturl()
 except HTTPError as e:return e.code,0,u
 except (URLError,TimeoutError,ssl.SSLError,OSError) as e:return str(e)[:70],0,u

# caixa.gov.br e ibge.gov.br respondem 302/403 para script e abrem normalmente no
# navegador: e trava de robo, nao link quebrado. Conferido a mao em 06/09/2026.
TOLERADOS={'www.caixa.gov.br':302,'www.ibge.gov.br':403}

def main():
 falhas=0
 for u in urls():
  status,tam,final=conferir(u)
  ok=status==200
  if not ok:
   from urllib.parse import urlparse
   if TOLERADOS.get(urlparse(u).netloc)==status:
    print(f'TRAVA {status} {u}')
    print('      trava de robo; abre no navegador')
    continue
   falhas+=1
  print(('OK  ' if ok else 'FALHA')+f' {status} {u}')
  if final!=u:print(f'      redireciona para {final}')
 print(f'\n{len(urls())} links, {falhas} com problema')
 return 1 if falhas else 0

if __name__=='__main__':sys.exit(main())
