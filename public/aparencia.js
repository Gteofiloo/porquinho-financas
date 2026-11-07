const COR_ORIGINAL='#2563eb';
const TEMAS_PERFIL={
 azul:{nome:'Azul Original',cores:{primaria:'#2563eb',texto:'#1d4ed8',botao:'#ffffff',suave:'#eff6ff',borda:'#dbeafe',contorno:'#2563eb',principal:'#ffffff',fundo:'#f8fafc',subfundo:'#f1f5f9','texto-base':'#1e293b','texto-suave':'#64748b','borda-neutra':'#e2e8f0','borda-forte':'#cbd5e1','texto-900':'#0f172a','texto-800':'#1e293b','texto-700':'#334155','texto-600':'#475569','texto-500':'#64748b','texto-400':'#64748b'}},
 rosa:{nome:'Rosa Delicado',cores:{primaria:'#dfa6bb',texto:'#85445f',botao:'#493540',suave:'#f8eaf0',borda:'#ebd5df',contorno:'#85445f',principal:'#ffffff',fundo:'#fcf8fa',subfundo:'#f8eaf0','texto-base':'#493540','texto-suave':'#715362','borda-neutra':'#ebd5df','borda-forte':'#ebd5df','texto-900':'#493540','texto-800':'#493540','texto-700':'#493540','texto-600':'#715362','texto-500':'#715362','texto-400':'#715362'}}
};
let focoAntesPerfil=null;
function normalizarTema(tema){return tema==='rosa'?'rosa':'azul';}
function aplicarAparenciaPerfil(perfil={}){
 const tema=normalizarTema(perfil.tema),root=document.documentElement;
 root.dataset.tema=tema;
 for(const [nome,cor]of Object.entries(TEMAS_PERFIL[tema].cores))root.style.setProperty('--cor-'+nome,cor);
}
function prepararAparenciaPerfil(){
 focoAntesPerfil=document.activeElement;document.getElementById('perfil-status').textContent='';
 document.getElementById('perfil-aparencia').open=false;atualizarSelecaoTema();
}
function atualizarSelecaoTema(){
 const ativo=normalizarTema(estado.perfil.tema);
 for(const b of document.querySelectorAll('[data-escolher-tema]')){
  const selected=b.dataset.escolherTema===ativo;b.setAttribute('aria-pressed',String(selected));
  b.querySelector('.tema-indicacao').textContent=selected?'✓ Ativo':'Selecionar';
 }
}
function selecionarTemaPerfil(tema){
 if(!Object.hasOwn(TEMAS_PERFIL,tema))return;
 const anterior=estado.perfil;
 estado.perfil={nome:anterior.nome,tratamento:anterior.tratamento,tema};
 if(!gravarArmazenamento('porquinho_categorias_perfil',JSON.stringify(estado.perfil))){estado.perfil=anterior;document.getElementById('perfil-status').textContent='Não foi possível salvar o tema. Tente novamente.';return;}
 aplicarAparenciaPerfil(estado.perfil);atualizarSelecaoTema();
 document.getElementById('perfil-status').textContent='Tema aplicado. Acompanhe a confirmação de salvamento na sua conta.';
}
function fecharModalPerfil(){document.getElementById('modal-perfil').classList.add('hidden');aplicarAparenciaPerfil(estado.perfil);if(focoAntesPerfil?.isConnected)focoAntesPerfil.focus();}
document.addEventListener('keydown',event=>{
 const modal=document.getElementById('modal-perfil');if(!modal||modal.classList.contains('hidden'))return;
 if(event.key==='Escape'){event.preventDefault();fecharModalPerfil();}
 if(event.key==='Tab'){
  const focus=[...modal.querySelectorAll('button:not(:disabled),input,select,summary')].filter(el=>el.tabIndex>=0&&!el.hidden&&(!el.closest('details')||el.matches('summary')||el.closest('details').open));const first=focus[0],last=focus.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
});
