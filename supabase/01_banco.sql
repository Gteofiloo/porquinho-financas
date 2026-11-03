-- PORQUINHO FINANCAS | Configuracao inicial para Supabase
-- Execute o arquivo completo no Editor SQL de um projeto novo.
-- Nao cadastra usuarios, nao altera o HTML e nao apaga lancamentos.
-- Login e recuperacao de senha serao conectados numa etapa seguinte.

begin;

create table if not exists public.porquinho_perfis (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 100),
  tratamento text not null default '' check (tratamento in ('', 'Sr.', 'Sra.')),
  ultimo_mes text check (ultimo_mes ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
  categorias_iniciais_criadas boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.porquinho_categorias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 50),
  emoji text check (char_length(emoji) <= 20),
  criado_em timestamptz not null default now(),
  unique (usuario_id, id),
  check (lower(btrim(nome)) <> 'geral')
);

create unique index if not exists porquinho_categorias_nome_unico
  on public.porquinho_categorias (usuario_id, lower(btrim(nome)));

create table if not exists public.porquinho_lancamentos (
  -- Preserva os IDs numericos usados no aplicativo atual.
  id bigint not null check (id between 1 and 9007199254740991),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 500),
  tipo text not null check (tipo in ('ganho', 'gasto')),
  -- Dinheiro em centavos: R$ 50,90 = 5090. Evita arredondamentos.
  valor_centavos bigint not null check (valor_centavos between 1 and 100000000000),
  mes text not null check (mes ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
  categoria_id uuid,
  metodo text not null default '' check (metodo in ('', 'pix', 'cartao')),
  compra_id text check (char_length(compra_id) between 1 and 100),
  numero_parcela integer,
  total_parcelas integer,
  data_registro timestamptz not null default now(),
  extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras) = 'object'),
  primary key (usuario_id, id),
  -- Impede que um gasto seja associado a categoria de outra pessoa.
  foreign key (usuario_id, categoria_id)
    references public.porquinho_categorias(usuario_id, id)
    on delete set null (categoria_id),
  check (
    (compra_id is null and numero_parcela is null and total_parcelas is null)
    or
    (compra_id is not null and numero_parcela is not null and total_parcelas is not null
     and total_parcelas between 2 and 12
     and numero_parcela between 1 and total_parcelas
     and tipo = 'gasto' and metodo = 'cartao')
  ),
  check (tipo = 'gasto' or categoria_id is null)
);

create index if not exists porquinho_lancamentos_mes
  on public.porquinho_lancamentos(usuario_id, mes);
create index if not exists porquinho_lancamentos_categoria_mes
  on public.porquinho_lancamentos(usuario_id, categoria_id, mes);
create unique index if not exists porquinho_parcela_unica
  on public.porquinho_lancamentos(usuario_id, compra_id, numero_parcela)
  where compra_id is not null;

-- Esta tabela so pode ser usada no SERVIDOR, nunca no HTML/browser.
-- O servidor calculara HMAC-SHA256(CPF normalizado, segredo do servidor).
-- Nao armazene CPF puro nem senhas neste campo. Senhas ficam no Supabase Auth.
create table if not exists public.porquinho_login_cpf (
  cpf_digest text primary key check (cpf_digest ~ '^[0-9a-f]{64}$'),
  usuario_id uuid not null unique references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.porquinho_perfis enable row level security;
alter table public.porquinho_categorias enable row level security;
alter table public.porquinho_lancamentos enable row level security;
alter table public.porquinho_login_cpf enable row level security;

-- Remove permissoes amplas que podem ser criadas por padrao no Supabase.
revoke all on table public.porquinho_perfis,
  public.porquinho_categorias, public.porquinho_lancamentos,
  public.porquinho_login_cpf from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.porquinho_perfis to authenticated;
grant select, insert, update, delete on public.porquinho_categorias,
  public.porquinho_lancamentos to authenticated;
grant select, insert, update, delete on public.porquinho_perfis,
  public.porquinho_categorias, public.porquinho_lancamentos,
  public.porquinho_login_cpf to service_role;

-- Cada usuario autenticado acessa somente as proprias linhas.
-- O bloco permite repetir este mesmo script sem duplicar politicas.
do $$
declare
  tabela text;
  operacao text;
  politica text;
begin
  foreach tabela in array array['porquinho_perfis','porquinho_categorias','porquinho_lancamentos'] loop
    foreach operacao in array array['select','insert','update','delete'] loop
      if tabela = 'porquinho_perfis' and operacao = 'delete' then continue; end if;
      politica := tabela || '_proprio_' || operacao;
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = tabela and policyname = politica
      ) then
        if operacao = 'insert' then
          execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = usuario_id)', politica, tabela);
        elsif operacao = 'update' then
          execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id)', politica, tabela);
        else
          execute format('create policy %I on public.%I for %s to authenticated using ((select auth.uid()) = usuario_id)', politica, tabela, operacao);
        end if;
      end if;
    end loop;
  end loop;
end $$;

-- Nao criar politicas publicas para porquinho_login_cpf.
-- Somente o backend com credencial secreta pode resolver o CPF.

commit;

select 'Banco do Porquinho configurado. Proxima etapa: integrar login e aplicativo.' as resultado;
