import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';import {validarEstado} from '../lib/core.js';
async function page({logged=true,color,theme}={}){
 const errors=[],saves=[];let revision=0,fail=false,conflict=false;const authCalls=[];
 const initial={perfil:{nome:'Teste',tratamento:'',...(color?{cor:color}:{}),...(theme?{tema:theme}:{})},categorias:['Mercado','Compras'],transacoes:[],ultimoMes:new Date().toISOString().slice(0,7),padraoCriado:true,revisao:0};
 const source=fs.readFileSync('public/index.html','utf8').replace('<script src="/aparencia.js"></script>','<script>'+fs.readFileSync('public/aparencia.js','utf8')+'</script>').replace('<script src="/nuvem.js"></script>','<script>'+fs.readFileSync('public/nuvem.js','utf8')+'</script>');
 const dom=new JSDOM(source,{url:'https://teste.vercel.app',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.alert=m=>errors.push(m);w.confirm=()=>true;w.fetch=async(url,opts)=>{
  if(url==='/api/state'&&opts.method==='GET')return {ok:logged,status:logged?200:401,json:async()=>logged?initial:{erro:'Entre na sua conta'}};
  if(url==='/api/state'){if(fail)throw new Error('offline');if(conflict)return {ok:false,status:409,json:async()=>({erro:'Conflito entre abas.'})};const data=JSON.parse(opts.body);saves.push(data);Object.assign(initial,structuredClone(data.estado),{revisao:revision+1});return {ok:true,status:200,json:async()=>({revisao:++revision})};}
  authCalls.push(JSON.parse(opts.body));return {ok:true,status:200,json:async()=>({ok:true})};
 };}});
 await new Promise(r=>setTimeout(r,30));return {w:dom.window,dom,errors,saves,authCalls,offline:()=>fail=true,online:()=>fail=false,conflict:()=>conflict=true};
}
const get=(w,code)=>w.eval(code);
function entry(w,{description='Feira',value='R$ 50,90',type='gasto',category='Mercado'}={}){w.document.getElementById('descricao').value=description;w.document.getElementById('valor').value=value;w.document.getElementById('tipo').value=type;w.document.getElementById('categoria-gasto').value=category;w.salvarTransacao({preventDefault(){}});}
test('interface: gastos/ganhos, categorias opcionais, reais, falha recuperavel e conflito',async()=>{
 const p=await page();const {w}=p;try{
 assert.equal(w.document.getElementById('aplicativo').hidden,false);assert.equal(w.document.getElementById('auth-area').hidden,true);
 entry(w);assert.equal(get(w,'estado.transacoes[0].valor'),50.9);assert.equal(w.document.getElementById('categoria-gasto').value,'');
 entry(w,{description:'Salário',value:'R$ 1.200,00',type:'ganho',category:''});await w.salvarNaNuvem();assert.equal(p.saves.length,1);assert.equal(p.saves[0].estado.transacoes.length,2);assert(validarEstado(p.saves[0].estado));
 w.document.getElementById('tipo').value='gasto';w.selecionarMetodo('cartao');w.document.querySelector('input[name="tipoCartao"][value="parcelado"]').checked=true;w.document.getElementById('num-parcelas').value='3';entry(w,{description:'Geladeira',value:'R$ 100,00'});await w.salvarNaNuvem();const e=p.saves.at(-1).estado;assert(validarEstado(e));assert.equal(e.transacoes.filter(t=>t.compraId).reduce((s,t)=>s+t.valor,0),100);
 p.offline();entry(w,{category:''});assert.equal(await w.salvarNaNuvem(),false);assert(w.document.getElementById('sync-texto').textContent.includes('não foram salvas'));assert.equal(w.document.getElementById('sync-tentar').hidden,false);
 p.online();assert(await w.salvarNaNuvem());assert.equal(p.saves.at(-1).estado.transacoes.length,6);
 p.conflict();entry(w);assert.equal(await w.salvarNaNuvem(),false);assert.equal(w.document.getElementById('sync-recarregar').hidden,false);assert.equal(w.document.getElementById('aplicativo').inert,true);
 assert.equal(w.localStorage.length,0);assert.deepEqual(p.errors,[]);
 }finally{w.close();}
});
test('interface: sem sessao mostra login e nao mostra dados financeiros',async()=>{const p=await page({logged:false});try{assert.equal(p.w.document.getElementById('aplicativo').hidden,true);assert.equal(p.w.document.getElementById('auth-area').hidden,false);p.w.mostrarAcesso('recuperar');assert.equal(p.w.document.getElementById('auth-email').required,true);assert.equal(p.w.document.getElementById('auth-cpf').required,false);}finally{p.w.close();}});

test('temas: dois cartoes, troca imediata, persistencia, recarga e nome sem perder tema',async()=>{
 const p=await page();const {w}=p;const d=w.document;const prop=n=>d.documentElement.style.getPropertyValue('--cor-'+n);
 try{
  assert.equal(get(w,'estado.perfil.tema'),'azul');w.abrirModalPerfil();assert.equal(d.getElementById('perfil-aparencia').open,false);
  assert.equal(d.querySelectorAll('[data-escolher-tema]').length,2);assert.equal(d.querySelectorAll('input[type=color]').length,0);
  d.getElementById('perfil-aparencia').open=true;d.querySelector('[data-escolher-tema=rosa]').click();
  assert.equal(prop('primaria'),'#dfa6bb');assert.equal(prop('fundo'),'#fcf8fa');assert.equal(prop('texto-base'),'#493540');
  assert.equal(d.querySelector('[data-escolher-tema=rosa]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('[data-escolher-tema=rosa] .tema-indicacao').textContent,'✓ Ativo');
  await w.salvarNaNuvem();assert.equal(p.saves.at(-1).estado.perfil.tema,'rosa');assert(validarEstado(p.saves.at(-1).estado));
  w.fecharModalPerfil();await w.carregarConta();assert.equal(prop('primaria'),'#dfa6bb');
  w.abrirModalPerfil();assert.equal(d.getElementById('perfil-aparencia').open,false);d.getElementById('perfil-nome').value='Novo nome';w.salvarPerfil();await w.salvarNaNuvem();assert.equal(p.saves.at(-1).estado.perfil.tema,'rosa');
  w.abrirModalPerfil();w.selecionarTemaPerfil('azul');await w.salvarNaNuvem();assert.equal(prop('fundo'),'#f8fafc');assert.equal(prop('primaria'),'#2563eb');
  assert.deepEqual(p.errors,[]);
 }finally{w.close();}
});
test('temas: prefere azul para personalizacao antiga e trata falha de rede sem sair',async()=>{
 const p=await page({color:'#db2777'});const {w}=p;try{
  assert.equal(get(w,'estado.perfil.tema'),'azul');assert.equal(get(w,'estado.perfil.cor'),undefined);
  w.abrirModalPerfil();p.offline();w.selecionarTemaPerfil('rosa');assert.equal(await w.salvarNaNuvem(),false);assert.equal(w.document.getElementById('sync-tentar').hidden,false);await w.sairDaConta();assert.equal(p.authCalls.length,0);
  p.online();assert(await w.salvarNaNuvem());assert.equal(p.saves.at(-1).estado.perfil.tema,'rosa');
 }finally{w.close();}
});
test('temas: paleta legivel, mensagens e indicadores financeiros preservados',async()=>{
 const p=await page({theme:'rosa'});const {w}=p;try{
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>(Math.max(rgb(a),rgb(b))+.05)/(Math.min(rgb(a),rgb(b))+.05);
  const themes=get(w,'TEMAS_PERFIL');for(const t of Object.values(themes)){const c=t.cores;assert(ratio(c.primaria,c.botao)>=4.5);assert(ratio(c['texto-base'],c.principal)>=4.5);assert(ratio(c.texto,c.suave)>=4.5);assert(ratio(c['texto-suave'],c.principal)>=4.5);assert(ratio(c.contorno,c.principal)>=3);}
  entry(w,{type:'ganho',value:'100,00',category:''});entry(w,{value:'150,00'});assert(w.document.getElementById('card-saldo').classList.contains('text-rose-600'));assert(w.document.getElementById('mensagem-mascote').innerText.includes('Atenção'));assert.equal(w.document.getElementById('icone-mascote').getAttribute('data-lucide'),'frown');
  w.abrirModalPerfil();w.selecionarTemaPerfil('azul');w.renderizar();assert(w.document.getElementById('mensagem-mascote').innerText.includes('Atenção'));assert(w.document.getElementById('card-saldo').classList.contains('text-rose-600'));assert.equal(w.document.documentElement.dataset.tema,'azul');
  assert.deepEqual(p.errors,[]);
 }finally{w.close();}
});
