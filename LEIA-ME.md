# Porquinho Finanças — cópia online para Vercel

Esta é a versão completa unificada de 06/11/2026: perfil, temas Azul Original/Rosa Delicado e correções de cadastro, senha e verificação de e-mail. Para atualizar o projeto já publicado, siga PUBLICAR_ATUALIZACAO.md. As instruções de instalação abaixo são para um ambiente novo.

Esta pasta é uma cópia independente. O HTML offline aprovado e o PROJETO ORIGINAL 2.0 não foram alterados. A cópia online começa com contas vazias: os lançamentos antigos do HTML não são importados automaticamente.

O visual, os valores em reais, as categorias, os históricos e as regras de exclusão de parcelas foram preservados. Foram acrescentados cadastro, entrada com CPF e senha, confirmação e recuperação por e-mail e salvamento por usuário no Supabase.

## 1. Complete o banco no Supabase

Em uma instalação nova, execute 01_banco.sql, depois 02_sincronizacao.sql e por último 05_temas.sql. Em seu projeto existente, execute apenas 05_temas.sql. Desative a tradução automática do navegador ao trabalhar com código SQL.

O arquivo 02 acrescenta as funções de leitura/salvamento, o controle de conflitos entre aparelhos e os limites de tentativas de acesso. Não apaga os registros existentes. `01_banco.sql` está incluído como referência e para instalação em um projeto novo; não precisa executá-lo novamente no seu caso.

Os SQLs 03 e 04 são versões históricas e não precisam ser executados. Nunca execute 02, 03 ou 04 depois do 05.

## 2. Coloque esta pasta no GitHub

Extraia o ZIP. Crie um repositório e envie o conteúdo da pasta `porquinho_online` para a raiz dele. Na raiz devem aparecer `package.json`, `vercel.json`, `api`, `lib` e `public`.

Envie também `package-lock.json`, `supabase`, `scripts` e `tests`. Não envie `node_modules`, arquivos `.env` preenchidos ou credenciais privadas. O arquivo `.env.example` contém apenas valores públicos e instruções.

## 3. Importe na Vercel

Crie um projeto na Vercel e importe esse repositório. Escolha Framework Preset: **Other**. O `vercel.json` já define:

- Build Command: `npm run build`.
- Output Directory: `public`.
- Install Command: deixe o padrão (`npm install`).
- Node.js: 22.x ou superior compatível com as dependências.

As pastas `api` e `lib` executam no servidor; a pasta `public` contém o aplicativo exibido no navegador. Esta versão não funciona abrindo o `index.html` por duplo clique, porque depende das rotas de servidor.

## 4. Configure as variáveis privadas

Em Settings → Environment Variables do projeto na Vercel, adicione as cinco variáveis abaixo. Use Production; se habilitar Preview, ele deve usar um banco separado ou ser tratado como acesso ao mesmo banco real.

| Nome | Valor |
| --- | --- |
| `SUPABASE_URL` | `https://aehpwpbymtbvrhycbxsr.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | A Publishable key que você já copiou; o valor está no `.env.example`. |
| `SUPABASE_SECRET_KEY` | A **Secret key** do seu projeto Supabase, obtida em Settings → API Keys. Se a interface mostrar apenas chaves legadas, use `service_role`. |
| `CPF_HMAC_SECRET` | Uma chave aleatória privada de pelo menos 32 caracteres. Veja como gerar abaixo. |
| `APP_URL` | O endereço definitivo do aplicativo na Vercel, por exemplo `https://porquinho-financas.vercel.app`, sem barra final. |

A Publishable key é a chave pública atual do Supabase e pode substituir a chave `anon` no cliente. A Secret key tem outra função: é usada somente no servidor para cadastro e associação privada entre CPF e usuário. Não coloque Secret key nem CPF_HMAC_SECRET no HTML, no GitHub ou no chat; não acrescente prefixos como `NEXT_PUBLIC_` a elas.

Para gerar CPF_HMAC_SECRET em um computador com Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para a variável na Vercel e guarde uma cópia segura. **Não troque essa chave depois de cadastrar pessoas:** ela é necessária para localizar os CPFs já cadastrados. O sistema guarda uma assinatura HMAC do CPF, não o CPF em texto, e a tabela de associação não permite consulta pelo navegador.

Se ainda não souber o domínio, faça o primeiro deploy para obter o endereço, configure `APP_URL` e faça **Redeploy**. Alterar variáveis não atualiza um deploy que já está rodando. `APP_URL` precisa corresponder exatamente à origem usada pelo usuário, inclusive o domínio: endereços alternativos/preview não são aceitos automaticamente.

## 5. Configure os e-mails no Supabase

Em Authentication:

1. Ative o provedor Email e mantenha a confirmação de e-mail habilitada.
2. Em URL Configuration, use o mesmo domínio de `APP_URL` como Site URL.
3. Em Redirect URLs, acrescente `https://SEU-DOMINIO/auth-callback.html`.
4. Mantenha os links padrão dos modelos de confirmação e recuperação (`{{ .ConfirmationURL }}`). O callback deste projeto recebe o link padrão com a sessão no fragmento da URL, remove esse fragmento e estabelece a sessão no servidor.
5. Configure um provedor de envio em **SMTP Settings** antes de abrir cadastros para outras pessoas. O serviço de e-mail padrão do Supabase restringe destinatários a membros da equipe e tem limites baixos; não serve para disponibilizar o aplicativo à comunidade.

Documentação oficial:

- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/api/api-keys

O cadastro exige CPF válido, nome, e-mail e senha de 8 a 128 caracteres. O e-mail precisa ser confirmado antes do primeiro acesso. Depois, basta CPF e senha. A recuperação usa o e-mail, com mensagem genérica para não revelar se existe uma conta com aquele endereço.

## 6. Confira antes de compartilhar

No endereço publicado:

1. Crie sua conta e confirme o e-mail. Teste primeiro com seu próprio endereço.
2. Entre com CPF e senha; registre uma entrada e um gasto de R$ 50,90.
3. Recarregue e confira se os valores continuam lá e o aviso indica que foram salvos.
4. Registre uma compra parcelada e confira os próximos meses, as categorias e a exclusão.
5. Saia e entre novamente; depois entre em outro navegador/aparelho. Os registros devem ser os mesmos.
6. Em uma segunda conta, confirme que os dados da primeira não aparecem.
7. Teste “Esqueci minha senha” e o e-mail de recuperação.

**Estado da entrega:** foram executados testes locais de SQL PostgreSQL, isolamento entre usuários, centavos, parcelas, exclusão de categorias, reversão de falha, conflito de revisão, formulários e rotas com o serviço Supabase simulado. O cadastro, a entrega dos e-mails e a persistência no seu Supabase real só podem ser confirmados após configurar as credenciais privadas, o SMTP e a hospedagem. O projeto ainda não foi publicado por esta entrega.

## Perfil, temas e acesso

Perfil reúne Sair da conta e Personalizar aparência, inicialmente fechado. Escolher Azul Original ou Rosa Delicado aplica e salva o tema por usuário. Novas contas usam Azul Original; preferências manuais antigas voltam ao padrão na migração. Verde/vermelho financeiros e mensagens são preservados.

Cadastro e redefinição possuem confirmação de senha e botões para visualizar. Um login com e-mail não confirmado recebe aviso específico e botão contextual para reenviar a verificação; esse botão não aparece nas opções fixas. Após clicar, informe o e-mail cadastrado.

## Como o salvamento funciona

Cada alteração é enviada automaticamente ao servidor. O aviso superior mostra quando terminou. Se a internet cair, as mudanças ficam na memória daquela aba, com um botão “Tentar salvar”. Mantenha a aba aberta até aparecer “Salvo na sua conta”: fechar/recarregar com mudanças pendentes pode perdê-las. Não há botão de backup na tela.

O aplicativo não armazena os registros financeiros em localStorage. A sessão é mantida em cookies HttpOnly, Secure no endereço HTTPS, e SameSite=Lax. Em computador compartilhado, use “Sair” ao terminar.

Uma alteração em outra aba/aparelho impede que a cópia antiga sobrescreva os dados. É necessário recarregar, descartando alterações pendentes daquela aba; o aplicativo pede confirmação. As atualizações não aparecem em tempo real: recarregue para buscar mudanças feitas em outro aparelho.

O salvamento usa uma transação para gravar o conjunto de dados da conta. É uma implementação voltada ao porte deste projeto de extensão, com limite de até 20 mil lançamentos e até 2,5 MB por envio; quando o histórico crescer, convém migrar para atualizações individuais e paginação. Manter o conjunto completo permite que as regras existentes de parcelas e categorias sejam preservadas nesta primeira integração.

## Para desenvolver e testar

Com Node.js e npm instalados, na raiz desta pasta:

```bash
npm ci
npm test
npm run build
```

Para executar o aplicativo com as rotas locais, use `vercel dev`, com as cinco variáveis configuradas localmente em `.env` (fora do Git). Para teste local use `APP_URL=http://localhost:3000` e cadastre `http://localhost:3000/auth-callback.html` nas Redirect URLs. Use um projeto Supabase de teste.
