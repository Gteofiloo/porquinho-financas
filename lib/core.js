import { createHmac } from 'node:crypto';
export function validarCPF(value) {
 const cpf=String(value||'').replace(/\D/g,'');
 if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
 for(let n=9;n<=10;n++){let soma=0;for(let i=0;i<n;i++)soma+=Number(cpf[i])*(n+1-i);let digito=(soma*10)%11;if(digito===10)digito=0;if(digito!==Number(cpf[n]))return false;}return true;
}
export function digest(value,secret) { if(!secret||secret.length<32)throw new Error('CONFIGURACAO');return createHmac('sha256',secret).update(value).digest('hex'); }
export function validarEstado(e){
 if(!e||!e.perfil||typeof e.perfil.nome!=='string'||!e.perfil.nome.trim()||e.perfil.nome.length>100||!['','Sr.','Sra.'].includes(e.perfil.tratamento)||!Array.isArray(e.categorias)||e.categorias.length>500||!Array.isArray(e.transacoes)||e.transacoes.length>20000)return false;
 const cats=new Set(),ids=new Set(),parcelas=new Set();
 for(const c of e.categorias){if(typeof c!=='string'||!c.trim()||c.length>50||c.trim().toLowerCase()==='geral'||cats.has(c.toLowerCase()))return false;cats.add(c.toLowerCase());}
 if(typeof e.ultimoMes!=='string'||(e.ultimoMes!==''&&!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(e.ultimoMes)))return false;
 for(const t of e.transacoes){
  if(!t||!Number.isSafeInteger(t.id)||t.id<=0||ids.has(t.id)||typeof t.descricao!=='string'||!t.descricao.trim()||t.descricao.length>500||!['gasto','ganho'].includes(t.tipo)||!Number.isFinite(t.valor)||t.valor<=0||t.valor>1e9||!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(t.mesTarget)||!Number.isFinite(Date.parse(t.data))||!['','pix','cartao',undefined].includes(t.metodo))return false;
  if(t.categoria&&(t.tipo!=='gasto'||!e.categorias.includes(t.categoria)))return false;
  if(t.compraId){if(typeof t.compraId!=='string'||t.compraId.length>100||!Number.isInteger(t.numeroParcela)||!Number.isInteger(t.totalParcelas)||t.totalParcelas<2||t.totalParcelas>12||t.numeroParcela<1||t.numeroParcela>t.totalParcelas||t.tipo!=='gasto'||t.metodo!=='cartao')return false;const k=t.compraId+':'+t.numeroParcela;if(parcelas.has(k))return false;parcelas.add(k);}else if(t.numeroParcela!=null||t.totalParcelas!=null)return false;
  ids.add(t.id);
 }return true;
}
