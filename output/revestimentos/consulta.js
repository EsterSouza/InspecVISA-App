const search=document.querySelector('#busca');
const category=document.querySelector('#categoria');
const cards=[...document.querySelectorAll('#fichas article')];
for(const card of cards){const heading=card.querySelector('h3');heading.after(card.querySelector('.category'));}
const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function filter(){
 const terms=normalize(search.value).trim().split(/\s+/).filter(Boolean);
 let count=0;
 for(const card of cards){
  const text=normalize(card.textContent);
  const match=(!category.value||card.dataset.category===category.value)&&terms.every(term=>text.includes(term));
  card.hidden=!match;if(match)count++;
 }
 document.querySelector('#contagem').textContent=`${count} de ${cards.length} fichas`;
 document.querySelector('#vazio').hidden=count!==0;
}
search.addEventListener('input',filter);category.addEventListener('change',filter);
document.querySelector('#limpar').addEventListener('click',()=>{search.value='';category.value='';filter();search.focus();});
function openRule(){const target=document.getElementById(location.hash.slice(1));if(target?.tagName==='DETAILS')target.open=true;}
window.addEventListener('hashchange',openRule);openRule();filter();
// Preço e calculadora. O preço muda por estado: a SINAPI publica um valor por UF,
// e a diferença entre a ponta barata e a cara do país passa de 50% em vários
// serviços. Toda ficha entra na lista da calculadora; onde a tabela não tem o
// serviço, aparece o motivo e o campo para a cotação própria.
const costData=JSON.parse(document.querySelector('#cost-data').textContent);
const calcData=JSON.parse(document.querySelector('#calc-data').textContent);
const precoData=JSON.parse(document.querySelector('#preco-data').textContent);
const uf=document.querySelector('#uf');
const cm=document.querySelector('#calc-material'),price=document.querySelector('#calc-price'),mode=document.querySelector('#calc-mode');
const ownRow=document.querySelector('#calc-own-row'),own=document.querySelector('#calc-own'),ownUnit=document.querySelector('#calc-own-unit');
const quantity=document.querySelector('#calc-quantity'),length=document.querySelector('#calc-length'),width=document.querySelector('#calc-width');
const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const MODOS={'m²':['area','dimensions'],'m linear':['linear'],'unidade':['unit']};
const rotulo=unit=>unit==='unidade'?'peça':unit;
const nomeUF=sigla=>(precoData.ufs.find(par=>par[0]===sigla)||[,sigla])[1];
const fonte=()=>`SINAPI ${nomeUF(uf.value)}, referência de ${precoData.referencia}, sem desoneração`;
// Ela digita 18,5 e não 18.5. O ponto só vale como milhar quando vem antes de
// três dígitos, senão 20.5 viraria 205.
const num=campo=>{const t=campo.value.trim();if(t==='')return NaN;return Number(t.includes(',')?t.replace(/\./g,'').replace(',','.'):t.replace(/\.(?=\d{3}\b)/g,''));};
function valorRef(x,estado){
 let total=0;
 for(const codigo of x.parts){
  const v=(precoData.precos[codigo]||{})[estado];
  if(v===undefined)return null;
  total+=v;
 }
 return Math.round(total*100)/100;
}
function lista(itens){return itens.map(x=>`${x.name}, ${brl.format(x.value)}/${x.unit}`).join('; ');}
function aplicarEstado(){
 const estado=uf.value;
 for(const x of costData)x.value=valorRef(x,estado);
 const teto={};
 for(const x of costData)if(x.value!==null)teto[x.group]=Math.max(teto[x.group]||0,x.value);
 for(const card of document.querySelectorAll('[data-cost]')){
  const x=costData[Number(card.dataset.cost)];
  const preco=card.querySelector('[data-preco]'),barra=card.querySelector('[data-barra]');
  preco.textContent=x.value===null?'sem preço neste estado':`${brl.format(x.value)}/${x.unit}`;
  if(barra)barra.style.width=x.value===null?'0%':(x.value/teto[x.group]*100).toFixed(1)+'%';
 }
 for(const alvo of document.querySelectorAll('[data-preco-ficha]')){
  const refs=costData.filter(x=>x.ids.includes(alvo.dataset.precoFicha)&&x.value!==null);
  alvo.textContent='Preço: '+(refs.length?lista(refs):'sem preço neste estado');
  const link=document.createElement('a');link.href='#custos';link.textContent='Calcular para o meu espaço';
  alvo.append(' · ',link);
 }
 for(const alvo of document.querySelectorAll('[data-comparar]')){
  const ficha=calcData.find(f=>f.id===alvo.dataset.comparar);
  const itens=((ficha||{}).compare||[]).map(i=>costData[i]).filter(x=>x.value!==null);
  alvo.textContent=itens.length?`Para ter ordem de grandeza: ${lista(itens)}.`:'';
 }
 try{localStorage.setItem('uf',estado);}catch(e){}
 fillPrices();calculate();
}
function fillPrices(){
 const ficha=calcData[Number(cm.value)];
 const disponiveis=ficha.refs.filter(i=>costData[i].value!==null);
 price.textContent='';
 for(const i of disponiveis){
  const c=costData[i],option=document.createElement('option');
  option.value=String(i);option.textContent=`${c.name} · ${brl.format(c.value)}/${c.unit}`;price.append(option);
 }
 const minha=document.createElement('option');minha.value='own';
 minha.textContent=disponiveis.length?'Informar a minha cotação':'Sem preço verificado: informar a minha cotação';
 price.append(minha);
 price.value=disponiveis.length?String(disponiveis[0]):'own';
}
function calculate(){
 const ficha=calcData[Number(cm.value)];
 const ref=price.value==='own'?null:costData[Number(price.value)];
 const unit=ref?ref.unit:ficha.unit;
 ownRow.hidden=Boolean(ref);ownUnit.textContent=rotulo(unit);
 const permitido=MODOS[unit]||['area'];
 for(const option of mode.options)option.disabled=!permitido.includes(option.value);
 if(!permitido.includes(mode.value))mode.value=permitido[0];
 const dimensions=mode.value==='dimensions';
 document.querySelector('#calc-quantity-label').hidden=dimensions;
 document.querySelector('#calc-length-label').hidden=!dimensions;
 document.querySelector('#calc-width-label').hidden=!dimensions;
 document.querySelector('#calc-unit-label').textContent=mode.value==='linear'?'Comprimento efetivo (m linear)':mode.value==='unit'?'Quantidade de peças':'Área (m²)';
 const valor=ref?ref.value:num(own);
 const campos=dimensions?[length,width]:[quantity];
 const medidaOk=campos.every(x=>Number.isFinite(num(x))&&num(x)>0);
 const precoOk=Number.isFinite(valor)&&valor>0;
 const medida=dimensions?num(length)*num(width):num(quantity);
 const result=document.querySelector('#calc-result');
 if(!precoOk)result.textContent=`Informe o valor da sua cotação, em reais por ${rotulo(unit)}.`;
 else if(!medidaOk)result.textContent='Informe medidas válidas, maiores que zero.';
 else result.textContent=`${medida.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${unit==='unidade'?'peça(s)':unit} × ${brl.format(valor)} = ${brl.format(medida*valor)} estimados`;
 const scope=document.querySelector('#calc-scope');
 scope.textContent='';
 if(ref){
  scope.textContent=`${ref.scope} Fonte: ${fonte()}, composição ${ref.parts.join(' + ')}, custo sem BDI. `;
  const link=document.createElement('a');link.href=precoData.url;link.textContent='Abrir a tabela SINAPI';scope.append(link);
 }else if(ficha.gap)scope.textContent=`${ficha.gap} `;
 else if(ficha.refs.length)scope.textContent=`A SINAPI não publicou preço deste serviço para ${nomeUF(uf.value)} em ${precoData.referencia}. `;
 else scope.textContent='Você informou o valor. A biblioteca não confere cotação. ';
 if(ficha.id){
  const link=document.createElement('a');link.href='#'+ficha.id;link.textContent=`Abrir a ficha ${ficha.id}`;
  scope.append(' · ',link);
  if(ficha.status&&ficha.status!=='Uso condicionado'){
   const aviso=document.createElement('b');aviso.textContent=` · ${ficha.status}`;scope.append(aviso);
  }
 }
}
cm.addEventListener('change',()=>{fillPrices();calculate();});
uf.addEventListener('change',aplicarEstado);
for(const campo of [price,mode])campo.addEventListener('change',calculate);
for(const campo of [quantity,length,width,own])campo.addEventListener('input',calculate);
try{
 const salvo=localStorage.getItem('uf');
 if(salvo&&[...uf.options].some(o=>o.value===salvo))uf.value=salvo;
}catch(e){}
aplicarEstado();

// Link para fora abre em guia nova, inclusive o que a calculadora cria depois de
// a pagina carregar: quem chegou pela busca nao perde a biblioteca no caminho.
function externos(){document.querySelectorAll('a[href^="http"]:not([target])').forEach(function(a){a.target='_blank';a.rel='noopener';});}
externos();
document.addEventListener('click',externos,true);

// Comparador lado a lado. A pergunta de quem decide e "este ou aquele", e a
// resposta mora em quatro linhas: onde serve, quando evitar, quanto custa no
// estado escolhido e o que a norma cobra.
(function(){
const alvo=document.getElementById('comparador');
const dados=document.getElementById('compara-data');
if(!alvo||!dados)return;
const COMPARA=JSON.parse(dados.textContent);
const escolhas=[...document.querySelectorAll('.comparar-escolha')];
const LINHAS=[['Superfície','category'],['Indicação editorial','status'],['Onde pode ser usado','use'],
 ['Quando evitar','limit'],['O que olhar depois de pronto','inspect']];
function precoDe(o){
 const estado=uf?uf.value:precoData.padrao;
 const vs=o.refs.map(i=>valorRef(costData[i],estado)).filter(v=>v!==null);
 if(!vs.length)return o.gap?'Sem referência na SINAPI. '+o.gap.split('. ')[0]+'.':'Sem referência na SINAPI.';
 return vs.map(v=>brl.format(v)+'/'+o.unit).join(' · ')+' em '+nomeUF(estado);
}
function desenhar(){
 const sel=escolhas.map(s=>s.value===''?null:COMPARA[Number(s.value)]).filter(Boolean);
 if(sel.length<2){alvo.innerHTML='<p class="ref">Escolha dois materiais para ver a comparação.</p>';return;}
 // No celular a tabela vira uma pilha de blocos e o cabecalho some, entao cada
 // celula carrega o nome do material em data-col e os links saem numa lista.
 let html='<p class="comparados-rot">Abrir a ficha de</p><ul class="comparados">'+sel.map(o=>'<li><a href="'+o.slug+'/">'+o.id+' · '+o.name+'</a></li>').join('')+'</ul>';
 html+='<table class="comparacao"><thead><tr><th scope="col">Comparando</th>';
 sel.forEach(o=>{html+='<th scope="col"><a href="'+o.slug+'/">'+o.id+' · '+o.name+'</a></th>';});
 html+='</tr></thead><tbody>';
 LINHAS.forEach(function(par){
  html+='<tr><th scope="row">'+par[0]+'</th>';
  sel.forEach(o=>{html+='<td data-col="'+o.id+' · '+o.name+'">'+String(o[par[1]]).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</td>';});
  html+='</tr>';
 });
 html+='<tr><th scope="row">Quanto pode custar</th>';
 sel.forEach(o=>{html+='<td data-col="'+o.id+'">'+precoDe(o)+'</td>';});
 html+='</tr><tr><th scope="row">O que a norma cobra</th>';
 sel.forEach(o=>{html+='<td data-col="'+o.id+'">'+(o.rules.join('; ')||'Sem critério ligado')+'</td>';});
 html+='</tr></tbody></table>';
 alvo.innerHTML=html;
 marcar('comparar_materiais',{materiais:sel.map(o=>o.id).join('+')});
}
escolhas.forEach(function(s,k){
 if(k<2)s.selectedIndex=k+1;
 s.addEventListener('change',desenhar);
});
if(uf)uf.addEventListener('change',desenhar);
desenhar();
})();

// Medicao: so os eventos que dizem se a pagina esta cumprindo o papel dela.
function marcar(evento,dados){
 try{if(window.gtag)window.gtag('event',evento,dados||{});}catch(e){}
 try{if(window.clarity)window.clarity('event',evento);}catch(e){}
}
document.querySelectorAll('[data-vistoria]').forEach(function(a){
 a.addEventListener('click',function(){
  marcar('contato_whatsapp',{origem:location.pathname});
  try{if(window.fbq)window.fbq('track','Contact');}catch(e){}
 });
});
document.querySelectorAll('.material').forEach(function(d){
 d.addEventListener('toggle',function(){if(d.open)marcar('abrir_ficha',{ficha:d.closest('article').id});});
});
if(uf)uf.addEventListener('change',function(){marcar('trocar_estado',{estado:uf.value});});

