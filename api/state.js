import {validarEstado} from '../lib/core.js';
import {HttpError,json,failure,mutation,body,session} from '../lib/server.js';
export default async function handler(req,res){try{
 if(!['GET','PUT'].includes(req.method))throw new HttpError(405,'Método não permitido.');
 if(req.method==='PUT')mutation(req);
 const {db}=await session(req,res);
 if(req.method==='GET'){
  const {data,error}=await db.rpc('porquinho_carregar_estado');if(error)throw new HttpError(503,'Não foi possível carregar os dados. Confira se o SQL 02 foi executado.');
  return json(res,200,data);
 }
 const b=await body(req);
 if(!Number.isSafeInteger(b.revisao)||b.revisao<0||!validarEstado(b.estado))throw new HttpError(400,'Dados inválidos. Revise os valores e nomes informados.');
 const {data,error}=await db.rpc('porquinho_salvar_estado',{p_estado:b.estado,p_revisao:b.revisao});
 if(error){if(error.message.includes('REVISAO_DIVERGENTE'))throw new HttpError(409,'Sua conta foi alterada em outro aparelho ou aba. Recarregue para ver os dados mais recentes.');throw new HttpError(503,'Não foi possível salvar. Tente novamente; se persistir, confira o banco.');}
 return json(res,200,data);
 }catch(error){failure(res,error);}}
