// Dados financeiros ficam apenas na memoria da aba ate a confirmacao do servidor.
const memoriaSessao=new Map();
const armazenamentoSessao={getItem:k=>memoriaSessao.get(k)??null,setItem(k,v){memoriaSessao.set(k,String(v));agendarNuvem();},removeItem(k){memoriaSessao.delete(k);agendarNuvem();}};
const nuvem={pronto:false,ocupado:false,pendente:false,revisao:0,timer:null,conflito:false};
function statusNuvem(texto,tipo='normal'){
 const el=document.getElementById('sync-texto');if(!el)return;el.textContent=texto;
 document.getElementById('sync-status').dataset.tipo=tipo;
 document.getElementById('sync-tentar').hidden=tipo!=='erro';
 document.getElementById('sync-recarregar').hidden=tipo!=='conflito';
}
async function requisitar(url,method='GET',data){
 let r;try{r=await fetch(url,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store'});}catch{throw Object.assign(new Error('Sem conexão. Mantenha esta página aberta e tente novamente.'),{status:0});}
 let out;try{out=await r.json();}catch{throw new Error('O servidor não respondeu corretamente. Tente novamente.');}
 if(!r.ok)throw Object.assign(new Error(out.erro||'Não foi possível concluir.'),{status:r.status});return out;
}
function instantaneoNuvem(){return {perfil:{...estado.perfil},categorias:todasCategorias(),transacoes:JSON.parse(JSON.stringify(estado.transacoes)),ultimoMes:estado.ultimoMes,padraoCriado:armazenamentoSessao.getItem('porquinho_categorias_padrao_v1')==='1'};}
function agendarNuvem(){if(!nuvem.pronto)return;nuvem.pendente=true;statusNuvem('Alterações pendentes de salvamento.');clearTimeout(nuvem.timer);nuvem.timer=setTimeout(salvarNaNuvem,350);}
async function salvarNaNuvem(){
 if(!nuvem.pronto||nuvem.conflito)return false;
 if(nuvem.ocupado)return false;
 if(!nuvem.pendente)return true;
 nuvem.ocupado=true;nuvem.pendente=false;statusNuvem('Salvando na sua conta…');
 try{
  const out=await requisitar('/api/state','PUT',{estado:instantaneoNuvem(),revisao:nuvem.revisao});nuvem.revisao=out.revisao;
  statusNuvem(nuvem.pendente?'Há novas alterações para salvar.':'✓ Salvo na sua conta');
 }catch(e){nuvem.pendente=true;
  if(e.status===409){nuvem.conflito=true;document.getElementById('aplicativo').inert=true;statusNuvem(e.message+' As alterações pendentes desta aba não foram salvas.','conflito');}
  else statusNuvem(e.message+' Suas alterações ainda não foram salvas.','erro');
  nuvem.ocupado=false;return false;
 }
 nuvem.ocupado=false;if(nuvem.pendente)return salvarNaNuvem();return true;
}
async function carregarConta(){
 const d=await requisitar('/api/state');
 nuvem.pronto=false;memoriaSessao.clear();
 for(const [k,v] of Object.entries({perfil:JSON.stringify(d.perfil),lista:JSON.stringify(d.categorias),transacoes:JSON.stringify(d.transacoes),mes:d.ultimoMes||'',padrao_v1:d.padraoCriado?'1':'0'}))memoriaSessao.set('porquinho_categorias_'+k,v);
 estado={categorias:carregarCategorias(),perfil:d.perfil,transacoes:normalizarRegistros(d.transacoes),ultimoMes:d.ultimoMes||'',mesAtivo:mesAtualChave(),metodoSelecionado:'pix',filtroAtual:'todos'};
 nuvem.revisao=d.revisao;nuvem.pendente=false;nuvem.conflito=false;nuvem.pronto=true;
 ultimaExclusao=null;ultimaOperacaoParcelas=null;
 document.getElementById('auth-area').hidden=true;document.getElementById('aplicativo').hidden=false;document.getElementById('aplicativo').inert=false;document.getElementById('sync-status').hidden=false;
 atualizarCategorias();verificarPerfil();if(estado.perfil.nome)verificarViradaMes();renderizar();if(window.lucide)lucide.createIcons();statusNuvem('✓ Conta conectada');
 if(!d.padraoCriado)agendarNuvem();
}
let modoConta='login';
function mostrarAcesso(modo='login'){
 modoConta=modo;document.getElementById('auth-area').hidden=false;document.getElementById('aplicativo').hidden=true;document.getElementById('sync-status').hidden=true;
 for(const el of document.querySelectorAll('[data-modos]'))el.hidden=!el.dataset.modos.split(' ').includes(modo);
 const titulo={login:'Entre na sua conta',cadastro:'Crie sua conta',recuperar:'Recupere sua senha',senha:'Crie uma nova senha',reenviar:'Reenviar confirmação',confirmar:'Confira seu e-mail'};
 document.getElementById('auth-titulo').textContent=titulo[modo];document.getElementById('auth-enviar').textContent={login:'Entrar',cadastro:'Criar conta',recuperar:'Enviar link por e-mail',senha:'Salvar nova senha',reenviar:'Reenviar confirmação'}[modo];
 for(const id of ['auth-nome','auth-cpf','auth-email','auth-senha','auth-confirmar-senha']){const el=document.getElementById(id);el.required=!el.closest('[data-modos]').hidden;}
 document.getElementById('auth-form').hidden=modo==='confirmar';
 document.getElementById('auth-confirmacao').hidden=modo!=='confirmar';
 for(const id of ['auth-senha','auth-confirmar-senha']){document.getElementById(id).value='';document.getElementById(id).type='password';const btn=document.querySelector('[aria-controls="'+id+'"]');btn.setAttribute('aria-pressed','false');btn.setAttribute('aria-label',id==='auth-senha'?'Mostrar senha':'Mostrar confirmação de senha');btn.innerHTML='<i data-lucide="eye" aria-hidden="true"></i>'; }
 if(window.lucide)lucide.createIcons();
 document.getElementById('auth-senha').autocomplete=modo==='login'?'current-password':'new-password';
 document.getElementById('auth-aviso').textContent='';document.getElementById('auth-senha').value='';
}
async function enviarAcesso(event){event.preventDefault();const btn=document.getElementById('auth-enviar');btn.disabled=true;const aviso=document.getElementById('auth-aviso');aviso.textContent='Aguarde…';try{
 const acao=modoConta;
 if((acao==='cadastro'||acao==='senha')&&document.getElementById('auth-senha').value!==document.getElementById('auth-confirmar-senha').value){aviso.textContent='As senhas não coincidem. Digite a mesma senha nos dois campos.';document.getElementById('auth-confirmar-senha').focus();return;}
 const emailInformado=document.getElementById('auth-email').value.trim();
 const out=await requisitar('/api/auth','POST',{acao,nome:document.getElementById('auth-nome').value,cpf:document.getElementById('auth-cpf').value,email:document.getElementById('auth-email').value,senha:document.getElementById('auth-senha').value,confirmacaoSenha:document.getElementById('auth-confirmar-senha').value});
 document.getElementById('auth-senha').value='';
 if(acao==='login'||(acao==='cadastro'&&!out.confirmarEmail)||acao==='senha'){history.replaceState(null,'','/');await carregarConta();}
 else if(acao==='cadastro'||acao==='reenviar'){mostrarAcesso('confirmar');document.getElementById('auth-email-destino').textContent=emailInformado;aviso.textContent=out.mensagem;}
 else {mostrarAcesso('login');aviso.textContent=out.mensagem;}
 }catch(e){aviso.textContent=e.message;}finally{btn.disabled=false;}}
async function iniciarLoginOnline(){
 document.getElementById('auth-form').addEventListener('submit',enviarAcesso);
 document.getElementById('auth-cpf').addEventListener('input',event=>{const d=event.target.value.replace(/\D/g,'').slice(0,11);event.target.value=d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})(\d{1,2})$/,'$1-$2');});
 mostrarAcesso('login');document.getElementById('auth-aviso').textContent='Verificando sua sessão…';
 try{if(new URLSearchParams(location.search).get('redefinir')==='1'){await requisitar('/api/state');mostrarAcesso('senha');}else await carregarConta();}
 catch(e){mostrarAcesso('login');document.getElementById('auth-aviso').textContent=e.status===401?'':e.message;}
}
async function sairDaConta(){
 const btn=document.getElementById('sync-sair');btn.disabled=true;
 try{if(nuvem.ocupado){statusNuvem('Aguarde o salvamento terminar e toque em Sair novamente.');return;}if(nuvem.pendente&&!(await salvarNaNuvem()))return;
 await requisitar('/api/auth','POST',{acao:'sair'});nuvem.pronto=false;memoriaSessao.clear();location.replace('/');
 }catch(e){statusNuvem(e.message,'erro');}finally{btn.disabled=false;}}
function recarregarConta(){if(confirm('As alterações pendentes desta aba serão descartadas. Carregar os dados salvos na conta?')){nuvem.pendente=false;location.reload();}}
window.addEventListener('beforeunload',e=>{if(nuvem.pendente||nuvem.ocupado){e.preventDefault();e.returnValue='';}});

function alternarVisibilidadeSenha(id,botao){
 const input=document.getElementById(id),mostrar=input.type==='password';input.type=mostrar?'text':'password';botao.setAttribute('aria-pressed',String(mostrar));const nome=id==='auth-senha'?'senha':'confirmação de senha';botao.setAttribute('aria-label',(mostrar?'Ocultar ':'Mostrar ')+nome);botao.innerHTML='<i data-lucide="'+(mostrar?'eye-off':'eye')+'" aria-hidden="true"></i>';if(window.lucide)lucide.createIcons();
}
