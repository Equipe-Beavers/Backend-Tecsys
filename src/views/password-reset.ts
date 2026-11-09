import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";

/** Standalone recovery page: the email must work without a running Flutter web server. */
export function registerPasswordResetPage(app: FastifyInstance): void {
  app.get("/redefinir-senha", async (_request, reply) => {
    const nonce = randomBytes(18).toString("base64");
    return reply
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`)
      .type("text/html; charset=utf-8")
      .send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Redefinir senha — Geomash</title>
<style nonce="${nonce}">
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#10231f;color:#edf5f2}
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px}
main{width:100%;max-width:440px}header{color:#c5f42d;letter-spacing:3px;font-weight:700;margin-bottom:40px}
h1{font-size:26px}p{color:#a4bcb5;line-height:1.6}label{display:block;margin-top:24px;font-size:12px;letter-spacing:1px}
input{display:block;width:100%;margin-top:10px;padding:16px;background:#193a33;color:inherit;border:1px solid #34554b;border-radius:11px;font-size:16px}
input:focus-visible,button:focus-visible{outline:2px solid #c5f42d;outline-offset:3px}
button{width:100%;min-height:50px;padding:14px;margin-top:24px;border:0;border-radius:11px;background:#c5f42d;color:#10231f;font-size:15px;font-weight:600;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}.toggle{margin-top:10px;background:transparent;color:#a4bcb5;border:1px solid #34554b;min-height:40px}
#notice{border-radius:10px;padding:14px;background:#4b302d;color:#ffb4ab;line-height:1.5}#notice.success{background:#193a33;color:#53d9c8}
[hidden]{display:none!important}
</style></head><body><main><header>GEOMASH</header><h1>Redefinir senha</h1>
<p id="intro">Escolha uma nova senha com 8 a 128 caracteres.</p>
<p id="notice" role="status" aria-live="polite" hidden></p>
<form id="form">
<label for="password">NOVA SENHA</label><input id="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
<label for="confirmation">CONFIRMAR SENHA</label><input id="confirmation" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
<button id="toggle" class="toggle" type="button" aria-pressed="false">Mostrar senhas</button>
<button id="submit" type="submit">Salvar nova senha</button></form>
<p id="instructions" hidden>Volte ao Geomash e entre com sua nova senha.</p>
<noscript><p>Ative o JavaScript no navegador para redefinir sua senha.</p></noscript>
</main><script nonce="${nonce}">
const form=document.getElementById('form'),notice=document.getElementById('notice'),password=document.getElementById('password'),confirmation=document.getElementById('confirmation'),submit=document.getElementById('submit'),toggle=document.getElementById('toggle');
const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
history.replaceState(null,'',location.pathname);
function show(message,success=false){notice.textContent=message;notice.className=success?'success':'';notice.hidden=false;}
if(!/^[a-f0-9]{64}$/.test(token)){form.hidden=true;show('Este link é inválido. Volte ao Geomash e solicite outro em “Esqueci a senha”.');}
confirmation.addEventListener('input',()=>confirmation.setCustomValidity(''));
password.addEventListener('input',()=>confirmation.setCustomValidity(''));
toggle.addEventListener('click',()=>{const visible=password.type==='password';password.type=confirmation.type=visible?'text':'password';toggle.textContent=visible?'Ocultar senhas':'Mostrar senhas';toggle.setAttribute('aria-pressed',String(visible));});
form.addEventListener('submit',async(event)=>{
 event.preventDefault();if(submit.disabled)return;
 if(!password.value.trim()){show('Informe uma senha válida.');return;}
 if(password.value!==confirmation.value){confirmation.setCustomValidity('As senhas não coincidem.');confirmation.reportValidity();return;}
 submit.disabled=true;submit.textContent='Salvando…';notice.hidden=true;
 try{
  const response=await fetch('/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,senha:password.value}),signal:AbortSignal.timeout(30000)});
  if(response.status===204){form.reset();form.hidden=true;document.getElementById('intro').hidden=true;document.getElementById('instructions').hidden=false;show('Senha alterada com sucesso! As sessões anteriores foram encerradas.',true);return;}
  const body=await response.json().catch(()=>({}));
  if(response.status===400&&body.code!=='INVALID_PASSWORD'){form.hidden=true;show('Este link é inválido, expirou ou já foi utilizado. Volte ao Geomash e solicite outro em “Esqueci a senha”.');}
  else show(response.status===429?'Muitas tentativas. Aguarde alguns minutos e tente novamente.':response.status===400?'Use uma senha com 8 a 128 caracteres.':'Não foi possível concluir a operação. Tente novamente mais tarde.');
 }catch{show('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');}
 finally{submit.disabled=false;submit.textContent='Salvar nova senha';}
});
</script></body></html>`);
  });
}
