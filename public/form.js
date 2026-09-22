let lang=new URLSearchParams(location.search).get('lang')==='en'?'en':'es';
const form=document.querySelector('#report'),fields=document.querySelector('#fields'),result=document.querySelector('#result'),notice=document.querySelector('#notice'),button=document.querySelector('#send');
let token='',widget=null,requestId=crypto.randomUUID(),frozen=null,receipt=null;
const words=(es,en)=>lang==='es'?es:en;
function language(){document.documentElement.lang=lang;document.querySelectorAll('[data-es]').forEach(el=>el.textContent=el.dataset[lang]);document.querySelector('#language').textContent=lang==='es'?'English':'Español';}
document.querySelector('#language').onclick=()=>{lang=lang==='es'?'en':'es';language();};language();
const version=new URLSearchParams(location.search).get('version');if(version)form.elements.version.value=version.slice(0,80);
function say(text){result.textContent=text;result.focus();}
function show(data){
  if(data.status==='confirmed'){
    say(words('Recibido. Guarda este enlace para seguir el reporte.','Received. Save this link to follow your report.'));
    const a=document.createElement('a');a.href=data.issueUrl;a.textContent=`GitHub #${data.number} ↗`;a.rel='noopener';result.append(a);fields.disabled=true;
  }else if(data.status==='failed'){
    say(words('No se pudo confirmar el envío. Conserva tu referencia y consulta GitHub antes de volver a enviarlo.','Could not confirm submission. Keep your reference and check GitHub before resubmitting.'));
  }else{
    say(words('Envío pendiente de confirmación. Guarda este enlace; no crees otro reporte.','Awaiting confirmation. Save this link; do not create another report.'));
    const a=document.createElement('a');a.href=`${location.origin}/?receipt=${encodeURIComponent(data.receipt)}`;a.textContent=words('Consultar mi envío','Check my submission');result.append(a);
  }
}
async function poll(id){try{const r=await fetch(`/api/receipts/${encodeURIComponent(id)}`);const data=await r.json();if(!r.ok)throw Error();show(data);}catch{say(words('No podemos consultar el envío ahora. Conserva este enlace y vuelve a abrirlo más tarde.','Cannot check this submission now. Keep this link and open it later.'));}}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(!token){say(words('Completa la verificación.','Complete the verification.'));return;}
  if(!frozen){const d=new FormData(form);frozen={requestId,kind:d.get('kind'),title:d.get('title'),description:d.get('description'),version:d.get('version'),area:d.get('area'),links:String(d.get('links')).split('\n').map(x=>x.trim()).filter(Boolean),consentPublic:d.get('consentPublic')==='on'};}
  button.disabled=true;
  try{
    const response=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...frozen,turnstileToken:token})});
    const data=await response.json();
    if(!response.ok){if([400,413,415].includes(response.status))frozen=null;throw Error(data.error||'Submission unavailable');}
    receipt=data.receipt;show(data);fields.disabled=true;
    history.replaceState(null,'',`?receipt=${encodeURIComponent(receipt)}`);
    if(data.status==='pending')setTimeout(()=>poll(receipt),16000);
  }catch(error){say(`${words('No se confirmó el envío:','Submission not confirmed:')} ${error.message}. ${words('Reintentar conserva la misma referencia.','Retry keeps the same reference.')}`);}
  finally{button.disabled=false;token='';if(widget!==null)window.turnstile.reset(widget);}
});
async function boot(){
  const existing=new URLSearchParams(location.search).get('receipt');
  if(existing){form.hidden=true;await poll(existing);return;}
  try{
    const r=await fetch('/api/config');if(!r.ok)throw Error();const config=await r.json();
    if(!config.enabled){notice.textContent=words('El formulario se está preparando. Ya puedes reportar desde GitHub.','The form is being prepared. You can already report through GitHub.');const a=document.createElement('a');a.href='https://github.com/kobossuib/ko36-community/issues/new/choose';a.textContent=' GitHub ↗';notice.append(a);return;}
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=()=>{widget=window.turnstile.render('#challenge',{sitekey:config.siteKey,action:'report',language:lang,callback:value=>{token=value;},'expired-callback':()=>{token='';}});fields.disabled=false;};script.onerror=()=>{notice.textContent=words('No se cargó la verificación. Recarga o usa GitHub.','Verification did not load. Reload or use GitHub.');};document.head.append(script);
  }catch{notice.textContent=words('No se pudo conectar. Recarga o usa el enlace a GitHub.','Could not connect. Reload or use the GitHub link.');}
}
void boot();
