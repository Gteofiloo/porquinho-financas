-- Execute APOS 01_banco.sql. Nao apaga dados existentes.
begin;
alter table public.porquinho_perfis add column if not exists revisao bigint not null default 0;

-- Leitura consistente de todas as tabelas do usuario em uma unica consulta.
create or replace function public.porquinho_carregar_estado()
returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
  'revisao',coalesce(p.revisao,0),
  'perfil',jsonb_build_object('nome',coalesce(p.nome,''),'tratamento',coalesce(p.tratamento,'')),
  'ultimoMes',coalesce(p.ultimo_mes,''),
  'padraoCriado',coalesce(p.categorias_iniciais_criadas,false),
  'categorias',coalesce((select jsonb_agg(c.nome order by c.nome) from public.porquinho_categorias c where c.usuario_id=(select auth.uid())),'[]'::jsonb),
  'transacoes',coalesce((select jsonb_agg(
    l.extras || jsonb_strip_nulls(jsonb_build_object('id',l.id,'descricao',l.descricao,'tipo',l.tipo,
    'valor',l.valor_centavos::numeric/100,'mesTarget',l.mes,'categoria',coalesce(c.nome,''),
    'metodo',l.metodo,'compraId',l.compra_id,'numeroParcela',l.numero_parcela,'totalParcelas',l.total_parcelas,
    'data',l.data_registro)) order by l.id)
    from public.porquinho_lancamentos l left join public.porquinho_categorias c on c.id=l.categoria_id and c.usuario_id=l.usuario_id
    where l.usuario_id=(select auth.uid())),'[]'::jsonb)
 ) from (select 1) base left join public.porquinho_perfis p on p.usuario_id=(select auth.uid())
 where (select auth.uid()) is not null;
$$;
revoke all on function public.porquinho_carregar_estado() from public,anon;
grant execute on function public.porquinho_carregar_estado() to authenticated;

-- Uma operacao completa: categorias, parcelas e exclusoes sao gravadas juntas.
-- A revisao impede um aparelho de sobrescrever alteracoes feitas em outro.
create or replace function public.porquinho_salvar_estado(p_estado jsonb,p_revisao bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_uid uuid := (select auth.uid()); v_atual bigint; v_cat text; v_cid uuid; v_item jsonb;
 v_categorias text[] := array[]::text[];
begin
 if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
 if jsonb_typeof(p_estado->'transacoes') is distinct from 'array' or jsonb_typeof(p_estado->'categorias') is distinct from 'array'
 or jsonb_array_length(p_estado->'transacoes')>20000 or jsonb_array_length(p_estado->'categorias')>500 then raise exception 'ESTADO_INVALIDO'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
 select revisao into v_atual from public.porquinho_perfis where usuario_id=v_uid for update;
 if coalesce(v_atual,0) is distinct from p_revisao then raise exception 'REVISAO_DIVERGENTE'; end if;
 insert into public.porquinho_perfis(usuario_id,nome,tratamento,ultimo_mes,categorias_iniciais_criadas,revisao)
 values(v_uid,p_estado->'perfil'->>'nome',coalesce(p_estado->'perfil'->>'tratamento',''),nullif(p_estado->>'ultimoMes',''),coalesce((p_estado->>'padraoCriado')::boolean,false),1)
 on conflict(usuario_id) do update set nome=excluded.nome,tratamento=excluded.tratamento,ultimo_mes=excluded.ultimo_mes,
 categorias_iniciais_criadas=excluded.categorias_iniciais_criadas,revisao=public.porquinho_perfis.revisao+1;
 for v_cat in select jsonb_array_elements_text(p_estado->'categorias') loop
  if v_cat is null or char_length(btrim(v_cat)) not between 1 and 50 then raise exception 'CATEGORIA_INVALIDA'; end if;
  v_categorias := array_append(v_categorias,v_cat);
  if not exists(select 1 from public.porquinho_categorias where usuario_id=v_uid and nome=v_cat) then
    insert into public.porquinho_categorias(usuario_id,nome) values(v_uid,v_cat);
  end if;
 end loop;
 delete from public.porquinho_lancamentos where usuario_id=v_uid;
 delete from public.porquinho_categorias where usuario_id=v_uid and not(nome=any(v_categorias));
 for v_item in select jsonb_array_elements(p_estado->'transacoes') loop
  v_cid := null;
  if v_item->>'tipo'='gasto' and coalesce(v_item->>'categoria','')<>'' then
    select id into v_cid from public.porquinho_categorias where usuario_id=v_uid and nome=v_item->>'categoria';
    if v_cid is null then raise exception 'CATEGORIA_AUSENTE'; end if;
  end if;
  insert into public.porquinho_lancamentos(id,usuario_id,descricao,tipo,valor_centavos,mes,categoria_id,metodo,compra_id,numero_parcela,total_parcelas,data_registro,extras)
  values((v_item->>'id')::bigint,v_uid,v_item->>'descricao',v_item->>'tipo',round((v_item->>'valor')::numeric*100)::bigint,
   v_item->>'mesTarget',v_cid,coalesce(v_item->>'metodo',''),nullif(v_item->>'compraId',''),
   (v_item->>'numeroParcela')::integer,(v_item->>'totalParcelas')::integer,(v_item->>'data')::timestamptz,
   v_item - array['id','descricao','tipo','valor','mesTarget','categoria','metodo','compraId','numeroParcela','totalParcelas','data']);
 end loop;
 select revisao into v_atual from public.porquinho_perfis where usuario_id=v_uid;
 return jsonb_build_object('revisao',v_atual);
end;
$$;
revoke all on function public.porquinho_salvar_estado(jsonb,bigint) from public,anon;
grant execute on function public.porquinho_salvar_estado(jsonb,bigint) to authenticated;

-- Limite persistente para login/cadastro/recuperacao: sem CPF ou IP puros.
create table if not exists public.porquinho_limites (
 chave text primary key check(chave ~ '^[0-9a-f]{64}$'),
 janela timestamptz not null default now(),tentativas integer not null default 0
);
alter table public.porquinho_limites enable row level security;
revoke all on public.porquinho_limites from public,anon,authenticated;
grant select,insert,update,delete on public.porquinho_limites to service_role;
create or replace function public.porquinho_tentar_requisicao(p_chave text,p_limite integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_n integer;
begin
 if p_limite not between 1 and 100 then raise exception 'LIMITE_INVALIDO';end if;
 insert into public.porquinho_limites(chave,janela,tentativas) values(p_chave,now(),1)
 on conflict(chave) do update set
 tentativas=case when public.porquinho_limites.janela<now()-interval '15 minutes' then 1 else public.porquinho_limites.tentativas+1 end,
 janela=case when public.porquinho_limites.janela<now()-interval '15 minutes' then now() else public.porquinho_limites.janela end
 returning tentativas into v_n;
 return v_n<=p_limite;
end;
$$;
revoke all on function public.porquinho_tentar_requisicao(text,integer) from public,anon,authenticated;
grant execute on function public.porquinho_tentar_requisicao(text,integer) to service_role;
commit;
select 'Sincronizacao e protecoes de login configuradas.' as resultado;
