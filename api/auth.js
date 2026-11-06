import {validarCPF,digest} from '../lib/core.js';
import {config,client,admin,HttpError,json,failure,mutation,body,session,sessionCookies,clearCookies,limit,normalizeCPF,emailValue,passwordValue} from '../lib/server.js';
export default async function handler(req,res){try{
 if(req.method!=='POST')throw new HttpError(405,'Método não permitido.');
 mutation(req);const b=await body(req),c=config();
 if(b.acao==='login'){
  await limit(req,'login',normalizeCPF(b.cpf));
  if(!validarCPF(b.cpf)||typeof b.senha!=='string'||b.senha.length>128)throw new HttpError(400,'CPF ou senha inválidos.');
  const a=admin();const lookup=await a.from('porquinho_login_cpf').select('usuario_id').eq('cpf_digest',digest(normalizeCPF(b.cpf),c.hmac)).maybeSingle();
  if(lookup.error)throw new HttpError(503,'Não foi possível consultar sua conta agora.');
  let email='nao-existe-porquinho@example.invalid';
  if(lookup.data){const u=await a.auth.admin.getUserById(lookup.data.usuario_id);if(u.error)throw new HttpError(503,'Não foi possível consultar sua conta agora.');email=u.data.user.email;}
  const out=await client().auth.signInWithPassword({email,password:b.senha});
  if(out.error?.code==='email_not_confirmed')return json(res,403,{codigo:'email_nao_verificado',erro:'Você precisa verificar seu e-mail para entrar. Abra o link que enviamos ou solicite um novo abaixo.'});
  if(out.error?.status===429)throw new HttpError(429,'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
  if(out.error&&(!out.error.status||out.error.status>=500))throw new HttpError(503,'O serviço de acesso está indisponível agora. Tente novamente em instantes.');
  if(out.error||!lookup.data||!out.data.session)throw new HttpError(400,'CPF ou senha inválidos. Confira os dados e use o olho para visualizar a senha.');
  sessionCookies(res,out.data.session);return json(res,200,{ok:true});
 }
 if(b.acao==='cadastro'){
  await limit(req,'cadastro',normalizeCPF(b.cpf));
  if(!validarCPF(b.cpf))throw new HttpError(400,'Confira o CPF informado.');
  const email=emailValue(b.email),password=passwordValue(b.senha),nome=String(b.nome||'').trim();
  if(!nome||nome.length>100)throw new HttpError(400,'Informe seu nome (até 100 caracteres).');
  if(password!==b.confirmacaoSenha)throw new HttpError(400,'As senhas não coincidem. Digite a mesma senha nos dois campos.');
  const a=admin(),cpf_digest=digest(normalizeCPF(b.cpf),c.hmac);
  const lookup=await a.from('porquinho_login_cpf').select('usuario_id').eq('cpf_digest',cpf_digest).maybeSingle();
  if(lookup.error)throw new HttpError(503,'Não foi possível consultar o cadastro agora.');
  if(lookup.data)throw new HttpError(400,'Não foi possível cadastrar. Se já tem conta, entre ou recupere sua senha.');
  const out=await a.auth.admin.createUser({email,password,email_confirm:false,user_metadata:{nome}});
  if(out.error||!out.data.user)throw new HttpError(400,'Não foi possível cadastrar. Confira seus dados e o envio de e-mails do projeto. Se já tem conta, recupere sua senha.');
  const uid=out.data.user.id;
  const mapping=await a.from('porquinho_login_cpf').insert({cpf_digest,usuario_id:uid});
  if(mapping.error){await a.auth.admin.deleteUser(uid);throw new HttpError(400,'Não foi possível concluir o cadastro. Tente novamente.');}
  const profile=await a.from('porquinho_perfis').insert({usuario_id:uid,nome,tratamento:''});
  if(profile.error){await a.auth.admin.deleteUser(uid);throw new HttpError(503,'Não foi possível preparar seu perfil. Tente novamente.');}
  const confirmation=await client().auth.resend({type:'signup',email,options:{emailRedirectTo:c.origin+'/auth-callback.html'}});
  if(confirmation.error){await a.auth.admin.deleteUser(uid);throw new HttpError(503,'Não foi possível enviar a confirmação. Confira o SMTP e tente cadastrar novamente.');}
  return json(res,200,{ok:true,confirmarEmail:true,mensagem:'Confirme o cadastro no link enviado ao seu e-mail. Depois, entre com CPF e senha.'});
 }
 if(b.acao==='reenviar'){
  const email=emailValue(b.email);await limit(req,'reenviar',email);
  const out=await client().auth.resend({type:'signup',email,options:{emailRedirectTo:c.origin+'/auth-callback.html'}});
  if(out.error)throw new HttpError(503,'Não foi possível reenviar agora. Aguarde um minuto e tente novamente.');
  return json(res,200,{ok:true,confirmarEmail:true,mensagem:'Se houver um cadastro pendente nesse e-mail, você receberá um novo link de confirmação.'});
 }
 if(b.acao==='recuperar'){
  const email=emailValue(b.email);await limit(req,'recuperar',email);
  const out=await client().auth.resetPasswordForEmail(email,{redirectTo:c.origin+'/auth-callback.html'});
  if(out.error)throw new HttpError(503,'Não foi possível solicitar o e-mail agora. Tente novamente mais tarde.');
  return json(res,200,{ok:true,mensagem:'Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.'});
 }
 if(b.acao==='callback'){
  await limit(req,'callback');
  if(typeof b.access_token!=='string'||b.access_token.length>10000||typeof b.refresh_token!=='string'||b.refresh_token.length>2000)throw new HttpError(400,'Link inválido.');
  const auth=client();const out=await auth.auth.setSession({access_token:b.access_token,refresh_token:b.refresh_token});
  if(out.error||!out.data.session)throw new HttpError(400,'Link inválido ou expirado. Solicite outro e-mail.');
  const verified=await auth.auth.getUser();if(verified.error||!verified.data.user)throw new HttpError(401,'Link inválido.');
  sessionCookies(res,out.data.session);return json(res,200,{ok:true});
 }
 if(b.acao==='senha'){
  const s=await session(req,res);await limit(req,'senha',s.user.id);
  const password=passwordValue(b.senha);
  if(password!==b.confirmacaoSenha)throw new HttpError(400,'As senhas não coincidem. Digite a mesma senha nos dois campos.');
  // A instancia precisa conhecer a sessao para atualizar a senha.
  const auth=client();const cs=(await import('../lib/server.js')).cookies(req);
  const set=await auth.auth.setSession({access_token:s.token,refresh_token:s.refreshToken});
  if(set.error)throw new HttpError(401,'Sua sessão expirou. Solicite outro link.');
  const out=await auth.auth.updateUser({password});
  if(out.error)throw new HttpError(400,'Não foi possível alterar a senha. Use uma senha diferente com pelo menos 8 caracteres.');
  const current=await auth.auth.getSession();if(current.data.session)sessionCookies(res,current.data.session);
  return json(res,200,{ok:true});
 }
 if(b.acao==='sair'){
  const cs=(await import('../lib/server.js')).cookies(req);
  if(cs.pf_access)await admin().auth.admin.signOut(cs.pf_access,'local');
  clearCookies(res);return json(res,200,{ok:true});
 }
 throw new HttpError(400,'Ação inválida.');
 }catch(error){failure(res,error);}}
