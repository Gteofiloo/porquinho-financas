# Publicar a versão completa — 06/11/2026

Inclui Perfil, Sair da conta, temas Azul Original e Rosa Delicado salvos por usuário, confirmação de senha, olhos e reenvio contextual de verificação. Preserva categorias, parcelas, históricos e demais funcionalidades.

## 1. Supabase primeiro
Com os lançamentos salvos, feche as abas abertas do aplicativo.
Abra supabase/05_temas.sql em um editor de texto, copie TODO o conteúdo para Supabase → SQL Editor → New query e execute Run.
Desative a tradução automática do navegador ao copiar/executar SQL.
Confira a mensagem final: Temas Azul Original e Rosa Delicado configurados.
No projeto existente, não execute novamente os arquivos 01, 02, 03 ou 04.
A migração foi testada localmente com preservação dos dados e isolamento entre usuários.

## 2. GitHub
Abra a pasta extraída porquinho_online e envie seu CONTEÚDO na raiz do repositório existente usando Add file → Upload files.
Não envie a pasta externa porquinho_online. Na raiz devem ficar api, lib, public, scripts, supabase, tests, package.json, package-lock.json e vercel.json.
Envie as pastas completas; não apague outros arquivos do repositório.
Título sugerido: Une perfil, temas e correções de acesso.
Confirme Commit changes em main. Não altere as variáveis existentes na Vercel nem o SMTP.

## 3. Vercel e teste
Aguarde o novo deploy Ready/Production. Abra a URL normal e pressione Ctrl+F5.
Entre, abra Perfil: Personalizar aparência deve começar fechado.
Abra e escolha Rosa Delicado; aguarde Salvo na sua conta e recarregue para conferir persistência.
Teste Azul Original, nome do perfil, gastos, categorias, histórico, parcelas e Sair da conta.
Teste o cadastro, confirmação de senha, olhos e aviso para confirmar e-mail.
Com uma conta ainda não verificada e senha correta, teste o aviso e reenvio contextual, confirmando depois o link mais recente recebido.
Não compartilhe senhas, códigos ou links de verificação.

## Validação da entrega
16 testes locais passaram e npm run build validou HTML/scripts.
Testes de autenticação usam serviço simulado; entrega real dos e-mails e funcionamento na infraestrutura publicada precisam do teste acima.
Este ZIP não publica automaticamente nem altera seu Supabase.
