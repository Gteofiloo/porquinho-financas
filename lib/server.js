import {createClient} from '@supabase/supabase-js';
import {digest} from './core.js';
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export function config(){
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SECRET_KEY:secret,CPF_HMAC_SECRET:hmac,APP_URL:app}=process.env;
 if(!url||!key||!secret||!hmac||hmac.length<32||!app)throw new HttpError(503,'Configuração pendente na Vercel. Consulte o arquivo LEIA-ME.');
 const origin=new URL(app).origin;
 if(!origin.startsWith('https://')&&!origin.startsWith('http://localhost:'))throw new HttpError(503,'APP_URL precisa usar HTTPS.');
 return {url,key,secret,hmac,origin};
}
export function client(token){const c=config();return createClient(c.url,c.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},...(token?{global:{headers:{Authorization:`Bearer ${token}`}}}:{})});}
export function admin(){const c=config();return createClient(c.url,c.secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
export function json(res,status,body){res.setHeader('Cache-Control','no-store');res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
export function failure(res,error){json(res,error.status||503,{erro:error.status?error.message:'Não foi possível conectar agora. Tente novamente.'});}
export function mutation(req){if(req.headers.origin!==config().origin)throw new HttpError(403,'Origem não autorizada.');if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HttpError(415,'Use JSON.');}
export async function body(req){
 if(Number(req.headers['content-length']||0)>2500000)throw new HttpError(413,'Dados acima do limite.');
 let b=req.body;
 if(b===undefined){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2500000)throw new HttpError(413,'Dados acima do limite.');}b=text;}
 try {if(typeof b==='string'||Buffer.isBuffer(b))b=JSON.parse(b.toString());if(!b||Array.isArray(b)||typeof b!=='object')throw 0;if(Buffer.byteLength(JSON.stringify(b))>2500000)throw 0;return b;}catch{throw new HttpError(400,'Dados inválidos.');}
}
function cookieOptions(){return `; Path=/; HttpOnly; SameSite=Lax${config().origin.startsWith('https:')?'; Secure':''}`;}
export function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>{const i=x.indexOf('=');return i>0?[x.slice(0,i).trim(),x.slice(i+1)]:['',''];}));}
export function sessionCookies(res,session){const opts=cookieOptions();res.setHeader('Set-Cookie',[
 `pf_access=${session.access_token}; Max-Age=${Math.min(session.expires_in||3600,3600)}${opts}`,
 `pf_refresh=${session.refresh_token}; Max-Age=2592000${opts}`]);}
export function clearCookies(res){const opts=cookieOptions();res.setHeader('Set-Cookie',[`pf_access=; Max-Age=0${opts}`,`pf_refresh=; Max-Age=0${opts}`]);}
export async function session(req,res){
 const cs=cookies(req);let token=cs.pf_access,refreshToken=cs.pf_refresh;let user;
 if(token){const out=await client().auth.getUser(token);user=out.data?.user;if(out.error&&(!out.error.status||out.error.status>=500))throw new HttpError(503,'Não foi possível validar sua sessão agora.');}
 if(!user&&cs.pf_refresh){const out=await client().auth.refreshSession({refresh_token:cs.pf_refresh});if(out.error&&(!out.error.status||out.error.status>=500))throw new HttpError(503,'Não foi possível renovar sua sessão agora.');if(out.data?.session){token=out.data.session.access_token;refreshToken=out.data.session.refresh_token;user=out.data.user;sessionCookies(res,out.data.session);}}
 if(!user){clearCookies(res);throw new HttpError(401,'Entre na sua conta para continuar.');}
 return {user,db:client(token),token,refreshToken};
}
export async function limit(req,action,identity=''){
 const c=config(),ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const checks=[[`ip:${action}:${ip}`,action==='login'?30:10]];if(identity)checks.push([`identity:${action}:${identity}`,action==='login'?10:5]);
 for(const [value,n] of checks){const {data,error}=await admin().rpc('porquinho_tentar_requisicao',{p_chave:digest(value,c.hmac),p_limite:n});if(error)throw new HttpError(503,'Configuração do banco pendente. Execute o SQL 02.');if(!data)throw new HttpError(429,'Muitas tentativas. Aguarde 15 minutos e tente novamente.');}
}
export const normalizeCPF=value=>String(value||'').replace(/\D/g,'');
export function emailValue(value){if(typeof value!=='string'||value.length>254||!/^\S+@\S+\.\S+$/.test(value.trim()))throw new HttpError(400,'Informe um e-mail válido.');return value.trim().toLowerCase();}
export function passwordValue(value){if(typeof value!=='string'||value.length<8||value.length>128)throw new HttpError(400,'Use uma senha com 8 a 128 caracteres.');return value;}
