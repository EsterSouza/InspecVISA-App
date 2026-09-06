// Script da página de ficha. Faz três coisas e só: troca o estado do preço,
// compartilha a ficha assinada e avisa a medição quando alguém pede vistoria.
(function(){
const dados=document.getElementById('preco-data');
const custos=document.getElementById('cost-data');
const precoData=dados?JSON.parse(dados.textContent):null;
const COSTS=custos?JSON.parse(custos.textContent):[];
const uf=document.getElementById('uf');
const CHAVE='biblioteca-revestimentos-uf';

const money=v=>'R$ '+v.toFixed(2).replace('.',',');
const nomeUF=sigla=>{const p=(precoData.ufs||[]).find(x=>x[0]===sigla);return p?p[1]:sigla;};
function valorRef(x,estado){
 const vs=x.parts.map(c=>(precoData.precos[c]||{})[estado]);
 return vs.every(v=>v!==undefined&&v!==null)?Math.round(vs.reduce((a,b)=>a+b,0)*100)/100:null;
}
function aplicarEstado(){
 if(!uf||!precoData)return;
 const estado=uf.value;
 document.querySelectorAll('.cost[data-cost]').forEach(function(card){
  const x=COSTS[Number(card.dataset.cost)];
  const v=valorRef(x,estado);
  const alvo=card.querySelector('[data-preco]');
  if(alvo)alvo.textContent=v===null?'sem preço em '+nomeUF(estado):money(v)+'/'+x.unit;
 });
 try{localStorage.setItem(CHAVE,estado);}catch(e){}
}
if(uf){
 try{const salvo=localStorage.getItem(CHAVE);if(salvo&&[...uf.options].some(o=>o.value===salvo))uf.value=salvo;}catch(e){}
 uf.addEventListener('change',aplicarEstado);
 aplicarEstado();
}

// Compartilhar leva a assinatura junto: quem receber o link sabe de quem é.
document.querySelectorAll('.compartilhar').forEach(function(botao){
 botao.addEventListener('click',async function(){
  const url=botao.dataset.url;
  const titulo=botao.dataset.titulo;
  const texto=titulo+' — ficha da Biblioteca de revestimentos em serviços de saúde, de Ester Caiafa, consultora sanitária. '+url;
  marcar('compartilhar_ficha',{ficha:titulo});
  if(navigator.share){try{await navigator.share({title:titulo,text:texto,url:url});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(texto);botao.textContent='Link copiado';
   setTimeout(function(){botao.textContent='Compartilhar esta ficha';},2500);return;}catch(e){}
  window.open('https://wa.me/?text='+encodeURIComponent(texto),'_blank','noopener');
 });
});

function marcar(evento,dados){
 try{if(window.gtag)window.gtag('event',evento,dados||{});}catch(e){}
 try{if(window.clarity)window.clarity('event',evento);}catch(e){}
}
window.marcarEvento=marcar;
document.querySelectorAll('[data-vistoria]').forEach(function(a){
 a.addEventListener('click',function(){
  marcar('contato_whatsapp',{origem:location.pathname});
  try{if(window.fbq)window.fbq('track','Contact');}catch(e){}
 });
});

// Link para fora abre em guia nova: quem chegou pela busca nao perde a ficha.
document.querySelectorAll('a[href^="http"]:not([target])').forEach(function(a){a.target='_blank';a.rel='noopener';});
})();
