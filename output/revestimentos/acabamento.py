from pathlib import Path
p=Path('output/revestimentos/gerar.py');s=p.read_text(encoding='utf-8')
a=s.index('def tile(m):');b=s.index('\nROOT=',a)
s=s[:a]+'''def tile(m):
 return {'P01':0,'P02':0,'P03':0,'P04':0,'P05':1,'P06':2,'P07':2,'J01':0,'J02':0,'J03':0,'W01':0,'W02':0,'W03':3,'W04':3,'T01':3,'T02':3,'B01':4,'B02':5,'B03':6,'R01':0,'M01':7}.get(m['id'],-1)
'''+s[b:]
s=s.replace('background-position:{(tile(m)%4)', 'background-image:{"none" if tile(m)<0 else "url(assets/materiais.png)"};background-position:{(tile(m)%4)')
s=s.replace("p(m['status'],small),Sample(tile(m))]", "p(m['status'],small)]+([Sample(tile(m))] if tile(m)>=0 else [])")
s=s.replace('<section id="pratica"><h2>Da escolha à inspeção</h2>', '<section id="pratica"><h2>Da escolha à inspeção</h2><figure><img src="assets/encontros.svg" alt="Peça e rejunte, rodapé alinhado e emenda de manta"><figcaption>Esquemas sem escala. O detalhe de execução depende do sistema especificado.</figcaption></figure>')
s=s.replace("flow=start('Clínicas, consultórios e estética','contexto')", "flow=start('Clínicas, consultórios e estética','contexto')\n diagram(120)")
p.write_text(s,encoding='utf-8')
