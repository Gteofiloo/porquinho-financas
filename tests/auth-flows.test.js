import {test} from 'node:test';import assert from 'node:assert/strict';import auth from '../api/auth.js';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const uid='11111111-1111-4111-8111-111111111111';
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.'+Buffer.from('test-signature').toString('base64url');
const req=b=>({method:'POST',body:b,headers:{origin:'https://teste.vercel.app','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.2'}});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}});
test('cadastro, confirmacao e login preservam a senha; confirmacao pendente tem mensagem propria',async()=>{
 Object.assign(process.env,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test',CPF_HMAC_SECRET:'a'.repeat(32),APP_URL:'https://teste.vercel.app'});
 const original=globalThis.fetch;let mapped=false,confirmed=false,password,createdCount=0,resends=0,updates=0;
 const user=()=>({id:uid,email:'teste@example.com',email_confirmed_at:confirmed?'2026-11-06T00:00:00Z':null});
 globalThis.fetch=async(input,options={})=>{
  const path=new URL(input.toString()).pathname,b=options.body?JSON.parse(options.body):{},method=options.method||'GET';let data={},status=200;
  if(path.endsWith('/rpc/porquinho_tentar_requisicao'))data=true;
  else if(path==='/rest/v1/porquinho_login_cpf'){if(method==='POST'){mapped=true;status=201;data=null;}else data=mapped?{usuario_id:uid}:null;}
  else if(path==='/rest/v1/porquinho_perfis'){status=201;data=null;}
  else if(path==='/auth/v1/admin/users'&&method==='POST'){createdCount++;password=b.password;assert.equal(b.email_confirm,false);data=user();}
  else if(path.startsWith('/auth/v1/admin/users/'))data=user();
  else if(path==='/auth/v1/resend'){resends++;data={};}
  else if(path==='/auth/v1/token'){
   if(b.password!==password){status=400;data={code:'invalid_credentials',msg:'Invalid login credentials'};}
   else if(!confirmed){status=400;data={code:'email_not_confirmed',msg:'Email not confirmed'};}
   else data={access_token:token,refresh_token:'refresh',expires_in:3600,token_type:'bearer',user:user()};
  }else if(path==='/auth/v1/user'){if(method==='PUT'){updates++;password=b.password;}data=user();}
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','x-supabase-api-version':'2024-01-01'}});
 };
 const signup={acao:'cadastro',nome:'Teste',cpf:'52998224725',email:'TESTE@example.com',senha:'Senha-Com-Letras 42!'};
 try{
  let r=res();await auth(req({...signup,confirmacaoSenha:'Outra senha'}),r);assert.equal(r.statusCode,400);assert.equal(createdCount,0);
  r=res();await auth(req({...signup,confirmacaoSenha:signup.senha}),r);assert.equal(r.statusCode,200);assert.equal(r.body.confirmarEmail,true);assert.equal(password,signup.senha);assert.equal(resends,1);
  r=res();await auth(req({acao:'login',cpf:signup.cpf,senha:signup.senha}),r);assert.equal(r.statusCode,403);assert.match(r.body.erro,/Você precisa verificar seu e-mail/);assert.equal(r.body.codigo,'email_nao_verificado');
  confirmed=true;r=res();await auth(req({acao:'login',cpf:signup.cpf,senha:signup.senha}),r);assert.equal(r.statusCode,200);assert.equal(updates,0);assert.equal(password,signup.senha);
  r=res();await auth(req({acao:'login',cpf:signup.cpf,senha:'Senha errada'}),r);assert.equal(r.statusCode,400);assert.match(r.body.erro,/CPF ou senha inválidos/);
  r=res();await auth(req({acao:'reenviar',email:signup.email}),r);assert.equal(r.statusCode,200);assert.equal(password,signup.senha);
  const reset=req({acao:'senha',senha:'Nova-Senha 456',confirmacaoSenha:'Outra'});reset.headers.cookie='pf_access='+token+'; pf_refresh=refresh';r=res();await auth(reset,r);assert.equal(r.statusCode,400);assert.equal(updates,0);
  reset.body.confirmacaoSenha=reset.body.senha;r=res();await auth(reset,r);assert.equal(r.statusCode,200,r.body.erro);assert.equal(updates,1);r=res();await auth(req({acao:'login',cpf:signup.cpf,senha:reset.body.senha}),r);assert.equal(r.statusCode,200);
 }finally{globalThis.fetch=original;}
});
test('interface: confirmacao de senha, olhos e aviso destacado apos cadastro',async()=>{
 const calls=[];const source=fs.readFileSync('public/index.html','utf8').replace('<script src="/aparencia.js"></script>','<script>'+fs.readFileSync('public/aparencia.js','utf8')+'</script>').replace('<script src="/nuvem.js"></script>','<script>'+fs.readFileSync('public/nuvem.js','utf8')+'</script>');
 const dom=new JSDOM(source,{url:'https://teste.vercel.app',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.fetch=async(url,options={})=>{if(url==='/api/state')return{ok:false,status:401,json:async()=>({erro:'Entre'})};const b=JSON.parse(options.body);calls.push(b);return{ok:true,status:200,json:async()=>({ok:true,confirmarEmail:true,mensagem:'Confirme seu cadastro no e-mail.'})}}}});
 const w=dom.window,d=w.document;try{
  await new Promise(r=>setTimeout(r,30));w.mostrarAcesso('cadastro');assert.equal(d.getElementById('auth-confirmar-senha').required,true);
  const eye=d.querySelector('[aria-controls="auth-senha"]');d.getElementById('auth-senha').value='Senha-Tipo 42!';eye.click();assert.equal(d.getElementById('auth-senha').type,'text');assert.equal(eye.getAttribute('aria-label'),'Ocultar senha');eye.click();assert.equal(d.getElementById('auth-senha').type,'password');
  d.getElementById('auth-nome').value='Teste';d.getElementById('auth-cpf').value='52998224725';d.getElementById('auth-email').value='teste@example.com';d.getElementById('auth-confirmar-senha').value='Diferente';await w.enviarAcesso({preventDefault(){}});assert.equal(calls.length,0);assert.match(d.getElementById('auth-aviso').textContent,/não coincidem/);assert.equal(d.getElementById('auth-enviar').disabled,false);
  d.getElementById('auth-confirmar-senha').value=d.getElementById('auth-senha').value;await w.enviarAcesso({preventDefault(){}});assert.equal(calls[0].senha,calls[0].confirmacaoSenha);assert.equal(d.getElementById('auth-form').hidden,true);assert.equal(d.getElementById('auth-confirmacao').hidden,false);assert.equal(d.getElementById('auth-email-destino').textContent,'teste@example.com');assert.equal(d.getElementById('auth-senha').value,'');
  w.mostrarAcesso('login');assert.equal(d.getElementById('auth-confirmar-senha').required,false);assert.equal(d.getElementById('auth-form').hidden,false);assert.equal(d.getElementById('auth-senha').autocomplete,'current-password');
  w.mostrarAcesso('senha');assert.equal(d.getElementById('auth-confirmar-senha').required,true);w.mostrarAcesso('reenviar');assert.equal(d.getElementById('auth-email').required,true);assert.equal(d.getElementById('auth-senha').required,false);
 }finally{w.close();}
});
test('reenvio aparece apenas no erro de email nao verificado e limpa ao trocar dados ou tela',async()=>{
 const source=fs.readFileSync('public/index.html','utf8').replace('<script src="/aparencia.js"></script>','<script>'+fs.readFileSync('public/aparencia.js','utf8')+'</script>').replace('<script src="/nuvem.js"></script>','<script>'+fs.readFileSync('public/nuvem.js','utf8')+'</script>');
 let codigo='email_nao_verificado';
 const dom=new JSDOM(source,{url:'https://teste.vercel.app',runScripts:'dangerously',beforeParse(w){w.fetch=async()=>({ok:false,status:403,json:async()=>({erro:'Você precisa verificar seu e-mail',codigo})});}});
 const w=dom.window,d=w.document;
 try{
  await new Promise(r=>setTimeout(r,30));
  const button=d.getElementById('auth-reenviar-verificacao');
  assert.equal(button.hidden,true);
  assert.equal(d.querySelector('.auth-links').textContent.includes('Reenviar'),false);
  await w.enviarAcesso({preventDefault(){}});assert.equal(button.hidden,false);
  d.getElementById('auth-cpf').dispatchEvent(new w.Event('input'));assert.equal(button.hidden,true);
  await w.enviarAcesso({preventDefault(){}});button.click();
  assert.equal(button.hidden,true);assert.equal(d.getElementById('auth-email').required,true);
  w.mostrarAcesso('login');codigo='invalid_credentials';
  await w.enviarAcesso({preventDefault(){}});assert.equal(button.hidden,true);
  codigo=undefined;await w.enviarAcesso({preventDefault(){}});assert.equal(button.hidden,true);
  codigo='email_nao_verificado';await w.enviarAcesso({preventDefault(){}});assert.equal(button.hidden,false);
  w.mostrarAcesso('cadastro');assert.equal(button.hidden,true);
 }finally{w.close();}
});
