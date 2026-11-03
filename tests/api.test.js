import {test} from 'node:test';import assert from 'node:assert/strict';
import auth from '../api/auth.js';import state from '../api/state.js';
const uid='11111111-1111-4111-8111-111111111111';
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.signature';
function request(method,body,cookie){return {method,body,headers:{origin:'https://teste.vercel.app','content-type':'application/json',cookie:cookie||'', 'x-vercel-forwarded-for':'192.0.2.1'}};}
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.body=JSON.parse(text);}};}
test('API: credenciais privadas ficam no servidor, cookie, RLS e conflito',async()=>{
 Object.assign(process.env,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test',CPF_HMAC_SECRET:'a'.repeat(32),APP_URL:'https://teste.vercel.app'});
 const old=globalThis.fetch;const calls=[];let conflict=false;
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(input.toString());const headers=new Headers(options.headers);const body=options.body?JSON.parse(options.body):undefined;calls.push({url,headers,body});
  let data={},status=200;
  if(url.pathname.endsWith('/rpc/porquinho_tentar_requisicao'))data=true;
  else if(url.pathname==='/rest/v1/porquinho_login_cpf')data={usuario_id:uid};
  else if(url.pathname.startsWith('/auth/v1/admin/users'))data={id:uid,email:'teste@example.com',identities:[{id:'1'}]};
  else if(url.pathname==='/auth/v1/token')data={access_token:token,refresh_token:'refreshtoken',expires_in:3600,token_type:'bearer',user:{id:uid,email:'teste@example.com'}};
  else if(url.pathname==='/auth/v1/user')data={id:uid,email:'teste@example.com'};
  else if(url.pathname.endsWith('/rpc/porquinho_carregar_estado'))data={perfil:{nome:'Teste'},transacoes:[],revisao:1};
  else if(url.pathname.endsWith('/rpc/porquinho_salvar_estado')){if(conflict){data={code:'P0001',message:'REVISAO_DIVERGENTE'};status=400;}else data={revisao:2};}
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 };
 try{
  let res=response();await auth(request('POST',{acao:'login',cpf:'52998224725',senha:'teste1234'}),res);assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);assert(!JSON.stringify(res.body).includes(token));assert(res.headers['Set-Cookie'][0].includes('HttpOnly'));
  const cookie='pf_access='+token+'; pf_refresh=refreshtoken';
  res=response();await state(request('GET',undefined,cookie),res);assert.equal(res.statusCode,200);const rpc=calls.find(c=>c.url.pathname.endsWith('carregar_estado'));assert.equal(rpc.headers.get('authorization'),'Bearer '+token);assert.equal(rpc.headers.get('apikey'),'sb_publishable_test');
  const estado={perfil:{nome:'Teste',tratamento:''},categorias:[],transacoes:[],ultimoMes:'2026-11',padraoCriado:true};res=response();await state(request('PUT',{estado,revisao:1},cookie),res);assert.equal(res.statusCode,200);
  conflict=true;res=response();await state(request('PUT',{estado,revisao:1},cookie),res);assert.equal(res.statusCode,409);
  res=response();await state(request('GET'),res);assert.equal(res.statusCode,401);
  res=response();const cross=request('POST',{acao:'sair'},cookie);cross.headers.origin='https://outro.example';await auth(cross,res);assert.equal(res.statusCode,403);
 }finally{globalThis.fetch=old;}
});
