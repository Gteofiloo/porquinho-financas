import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
test('PostgreSQL: isolamento, centavos, parcelas, exclusao, rollback e conflito entre abas',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(let i=0;i<2;i++)for(const file of ['01_banco.sql','02_sincronizacao.sql'])await db.exec(fs.readFileSync('supabase/'+file,'utf8'));
 const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';await db.exec(`insert into auth.users values('${A}'),('${B}');set role authenticated;set request.jwt.claim.sub='${A}';`);
 const e={perfil:{nome:'A',tratamento:''},categorias:['Mercado'],ultimoMes:'2026-11',padraoCriado:true,transacoes:[1,2,3].map(n=>({id:n,descricao:'Compra '+n,tipo:'gasto',valor:n===3?33.34:33.33,mesTarget:'2026-'+(10+n),categoria:'Mercado',metodo:'cartao',compraId:'compra1',numeroParcela:n,totalParcelas:3,data:'2026-11-01T00:00:00Z'}))};e.transacoes[2].mesTarget='2027-01';
 async function save(e,r){return (await db.query('select public.porquinho_salvar_estado($1::jsonb,$2::bigint) as s',[JSON.stringify(e),r])).rows[0].s;}
 async function load(){return (await db.query('select public.porquinho_carregar_estado() as s')).rows[0].s;}
 assert.equal((await save(e,0)).revisao,1);assert.equal((await load()).transacoes.reduce((n,t)=>n+t.valor,0),100);
 await db.exec(`set request.jwt.claim.sub='${B}'`);assert.equal((await load()).transacoes.length,0);assert.equal((await load()).perfil.nome,'');
 let denied=false;try{await db.query('select * from public.porquinho_login_cpf')}catch{denied=true}assert(denied);
 await save({...e,perfil:{nome:'B',tratamento:''},transacoes:[]},0);
 await db.exec(`set request.jwt.claim.sub='${A}'`);assert.equal((await load()).transacoes.length,3);
 await assert.rejects(()=>save({...e,transacoes:[]},0),/REVISAO_DIVERGENTE/);assert.equal((await load()).transacoes.length,3);
 const bad={...e,transacoes:[{...e.transacoes[0],valor:-5}]};await assert.rejects(()=>save(bad,1));assert.equal((await load()).revisao,1);assert.equal((await load()).transacoes.length,3);
 const changed=structuredClone(e);changed.categorias.push('Compras');changed.transacoes.slice(1).forEach(t=>t.categoria='Compras');await save(changed,1);assert.deepEqual((await load()).transacoes.map(t=>t.categoria),['Mercado','Compras','Compras']);
 changed.categorias=['Compras'];changed.transacoes[0].categoria='';changed.transacoes=changed.transacoes.slice(0,2);await save(changed,2);const latest=await load();assert.equal(latest.transacoes.length,2);assert.equal(latest.transacoes[0].categoria,'');assert.equal(latest.transacoes[1].valor,33.33);
 await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select public.porquinho_carregar_estado()'));await db.exec('reset role;set role service_role');
 const key='a'.repeat(64);for(let i=1;i<=3;i++)assert.equal((await db.query('select public.porquinho_tentar_requisicao($1,2) as ok',[key])).rows[0].ok,i<=2);
 }finally{await db.close();}
});
