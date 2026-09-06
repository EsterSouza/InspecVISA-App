from pathlib import Path
p=Path('output/revestimentos/gerar.py')
s=p.read_text(encoding='utf-8')
s=s.replace('from conteudo import DATE,SOURCES,RULES,INTRO,MATERIALS,END','''from conteudo import DATE,SOURCES,RULES,INTRO,MATERIALS,END
from complementos import AREAS,CONTEXT,GLOSSARY,COSTS,COST_NOTE,COST_URL
SOURCES['CUSTO']={'title':'Município de Lages: orçamento público, páginas 4 e 5','url':COST_URL,'status':COST_NOTE}
SOURCES['ESTETICA']={'title':'Anvisa, Nota Técnica 2/2024','url':'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos','status':'Orientação institucional consultada na coleção de notas vigentes. Introdução e seção 2.7: enquadramento e infraestrutura dos serviços de estética.'}
SOURCES['SINAPI']['status']='Canal oficial das composições. Nesta edição, custos extraídos de orçamento público identificado em CUSTO, sem tratar o valor como média nacional.'
END[:]=[(t,p.replace('Os preços originais não foram confirmados em documentação oficial e não integram esta edição.','Os preços desta edição são referências localizadas, com escopo e fonte próprios, e não validam os preços do original.')) for t,p in END]
def money(v):return ('R$ %.2f'%v).replace('.',',')
def tile(m):
 n=m['name'].lower()
 return 1 if 'epóxi' in n else 2 if 'vinílico' in n or 'manta' in n else 4 if 'granito' in n else 5 if 'quartzo' in n or 'solid' in n else 6 if 'inox' in n else 7 if m['category']=='Mobiliário' else 3 if m['category'] in ['Paredes','Tetos'] else 0
''')
s=s.replace("version='1.0.0'","version='2.0.0',areaClasses=AREAS,context=CONTEXT,glossary=GLOSSARY,costs=COSTS,costNote=COST_NOTE")
s=s.replace("parts.append('<section class=\"intro\">'", """parts.append('<figure class="photo"><img src="assets/materiais.png" alt="Amostras ilustrativas de porcelanato, epóxi, vinílico, pintura, granito, quartzo, inox e estofado"><figcaption>Biblioteca visual: porcelanato · epóxi · vinílico · pintura / granito · quartzo · inox · estofado. Imagem gerada por IA, ilustrativa; não representa produtos certificados nem detalhes de execução aprovados.</figcaption></figure>')
parts.append('<section id="areas"><h2>Primeiro, entenda o seu ambiente</h2><div class="area-grid">'+''.join(f'<div class="area"><span>0{i+1}</span><h3>{E(t)}</h3><p>{E(d)}</p><p class="example">{E(ex)}</p></div>' for i,(t,d,ex) in enumerate(AREAS))+'</div>'+''.join(f'<h3>{E(t)}</h3><p>{E(d)}</p>' for t,d in CONTEXT)+'<p class="ref">'+refhtml('R50','Parte III, 6.2 A.2')+' · '+refhtml('ESTETICA','Introdução e seção 2.7')+'</p></section>')
parts.append('<section id="glossario"><h2>Palavras que você vai encontrar</h2><div class="glossary">'+''.join(f'<details><summary>{E(t)}</summary><p>{E(d)}</p></details>' for t,d in GLOSSARY)+'</div></section>')
parts.append('<section id="custos"><h2>Quanto pode custar?</h2><p>'+E(COST_NOTE)+'</p>')
for group in dict.fromkeys(x['group'] for x in COSTS):
 parts.append('<h3>'+group+'</h3>')
 for x in [v for v in COSTS if v['group']==group]:
  parts.append(f'<div class="cost"><div><b>{E(x["name"])}</b><strong>{money(x["value"])}/{x["unit"]}</strong></div><div class="bar" style="width:{x["value"]/162.26*100:.1f}%"></div><p>{E(x["scope"])} <a href="{COST_URL}#page={x["page"]}">SINAPI {x["code"]}, p. {x["page"]}</a></p></div>')
parts.append('<p>Entre os dois pisos desta referência, a pintura epóxi tem menor custo inicial. Isso não define o material mais barato ou mais caro em qualquer obra. Bancadas, vinílicos e demais sistemas: solicitar cotação; não há faixa verificada nesta edição.</p></section>')
parts.append('<section class="intro">'""")
s=s.replace('<a href="#criterios">Entenda os critérios</a>', '<a href="#areas">Qual é o meu ambiente?</a><a href="#glossario">Entenda os termos</a><a href="#custos">Compare os custos</a><a href="#criterios">Entenda os critérios</a>')
s=s.replace("parts.append(f'<article id=", "parts.append(f'<article id=")
s=s.replace('<div class="material-heading"><div>', '<details class="material"><summary><span class="swatch" style="background-position:{(tile(m)%4)*100/3}% {(tile(m)//4)*100}%" aria-hidden="true"></span><span class="material-heading"><span>')
s=s.replace('</h3></div><span class="status">{E(m["status"])}</span></div><div class="fields">', '</h3></span><span class="status">{E(m["status"])}</span></span><span class="expand">Abrir ficha +</span></summary><div class="fields">')
s=s.replace("+'</div></article>')", "+'</div></details></article>')")
s=s.replace("for t,p in INTRO:md.extend", """md.extend(['## Entenda o ambiente']+[f'### {t}\\n\\n{d}\\n\\n{ex}' for t,d,ex in AREAS])
md.extend([f'### {t}\\n\\n{d}' for t,d in CONTEXT])
md.extend(['## Glossário']+[f'**{t}:** {d}' for t,d in GLOSSARY])
md.extend(['## Custos de referência',COST_NOTE]+[f'**{x["name"]}: {money(x["value"])}/{x["unit"]}.** {x["scope"]} [SINAPI {x["code"]}, p. {x["page"]}]({COST_URL}#page={x["page"]})' for x in COSTS])
for t,p in INTRO:md.extend""")
s=s.replace("diagram(190)","c.drawImage(str(ROOT/'assets'/'materiais.png'),42,169,511,190,mask='auto')")
s=s.replace("c.drawString(42,169,'Esquemas ilustrativos, sem escala. Não substituem detalhes de projeto.')", "c.drawString(42,150,'Amostras ilustrativas geradas por IA. Não representam produtos certificados.')")
s=s.replace("flow=start('Como consultar esta biblioteca','inicio')", """flow=start('Qual é o meu ambiente?','areas')
for t,d,ex in AREAS:flow.extend([p(t,h3),p(d),p(ex,small),Spacer(1,12)])
flow.append(p('RDC 50/2002, Parte III, 6.2 A.2. Exemplos explicativos, sujeitos ao enquadramento das atividades reais.',small));finish(flow)
flow=start('Clínicas, consultórios e estética','contexto')
for t,d in CONTEXT:flow.extend([p(t,h3),p(d),Spacer(1,16)])
finish(flow)
for off in range(0,len(GLOSSARY),7):
 flow=start('Palavras que ajudam a escolher','glossario'+str(off))
 for t,d in GLOSSARY[off:off+7]:flow.extend([p(t,h3),p(d)])
 finish(flow)
flow=start('Quanto pode custar?','custos')
flow.append(p(COST_NOTE))
for x in COSTS:
 flow.extend([p(x['name']+' | '+money(x['value'])+'/'+x['unit'],h3),p(x['scope'],small),rich(f'<link href="{COST_URL}#page={x["page"]}" color="#765420">SINAPI {x["code"]}, página {x["page"]}</link>',small)])
flow.append(p('Compare preços dentro da mesma superfície e do mesmo escopo. Demais materiais: sob cotação. A referência não determina a solução sanitariamente adequada.',small));finish(flow)
flow=start('Como consultar esta biblioteca','inicio')""")
s=s.replace("for offset in [0,3]:\n flow=start('Referências", "for offset in range(0,len(SOURCES),3):\n flow=start('Referências")
s=s.replace('Edição 1.0','Edição 2.0')
p.write_text(s,encoding='utf-8')
