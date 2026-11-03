(async()=>{
 const params=new URLSearchParams(location.hash.slice(1));
 const token=params.get('access_token'),refresh=params.get('refresh_token'),recovery=params.get('type')==='recovery';
 const error=params.get('error_description');
 history.replaceState(null,'','/auth-callback.html');
 try{
  if(error||!token||!refresh)throw new Error('O link é inválido ou expirou. Solicite outro e-mail.');
  const r=await fetch('/api/auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'callback',access_token:token,refresh_token:refresh})});
  const out=await r.json();if(!r.ok)throw new Error(out.erro||'Não foi possível confirmar o acesso.');
  location.replace(recovery?'/?redefinir=1':'/');
 }catch(e){document.getElementById('aviso').textContent=e.message;}
})();
