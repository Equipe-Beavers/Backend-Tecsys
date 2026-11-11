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
#loading{position:fixed;inset:0;z-index:10;background:#081c18;display:flex;align-items:center;justify-content:center;padding:32px 24px;overflow:hidden}
#loading .contours{position:absolute;inset:0;width:100%;height:100%;opacity:.15;pointer-events:none}
#loading .brand{position:relative;text-align:center}#loading .wordmark{display:flex;align-items:center;justify-content:center;gap:16px;font-size:32px;font-weight:700;letter-spacing:5px;color:#edf5f2}
#loading .mark{width:42px;height:42px;color:#c8f135}#loading .tagline{font-size:13px;color:#7e9a94;margin-top:18px}
#loading .progress{position:absolute;bottom:max(40px,env(safe-area-inset-bottom));width:264px;max-width:calc(100% - 48px);text-align:center}
#loading .track{height:3px;border-radius:8px;overflow:hidden;background:#1d473e}#loading .track span{display:block;width:45%;height:100%;background:#c8f135;animation:loading 1.3s ease-in-out infinite}
#loading .status{color:#7e9a94;font-size:12px;margin-top:14px}
@keyframes loading{from{transform:translateX(-120%)}to{transform:translateX(340%)}}
@media(max-width:899px){#loading .wordmark{flex-direction:column;font-size:36px;letter-spacing:3px;gap:24px}#loading .mark{width:104px;height:104px}#loading .tagline{display:none}#loading .progress{width:180px}}
@media(max-height:360px){#loading .wordmark{flex-direction:row;font-size:24px}#loading .mark{width:48px;height:48px}#loading .progress{bottom:16px}#loading .tagline{display:none}}
@media(prefers-reduced-motion:reduce){#loading .track span{animation:none;transform:translateX(50%)}}
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
</main><div id="loading" hidden role="status" aria-live="polite" aria-label="Salvando sua nova senha">
<svg class="contours" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="terrain" width="400" height="400" patternUnits="userSpaceOnUse"><g fill="none" stroke="#c8f135" stroke-width="1.5"><path d="M-30 50C80-20 210 140 300 60S400 0 440 80M-30 100C100 0 160 180 310 100S420 20 440 120M-30 160C70 70 180 240 320 150S410 80 440 180M-30 220C80 100 190 300 330 210S400 140 440 240M-30 280C110 170 210 350 340 270S410 200 440 300M-30 340C90 210 240 410 350 330S400 280 440 360M-30 400C100 300 220 440 360 390S410 330 440 420"/></g></pattern></defs><rect width="1200" height="800" fill="url(#terrain)"/></svg>
<div class="brand"><div class="wordmark"><svg class="mark" viewBox="0 0 100 110" fill="none" stroke="currentColor" stroke-width="6" aria-hidden="true"><path d="M52 8A49 49 0 0 1 98 55M52 24A33 33 0 0 1 82 55M52 40A17 17 0 0 1 66 55M51 57C20 49 5 77 23 94L42 110L62 87C72 71 65 60 51 57Z"/><circle cx="42" cy="77" r="7" fill="currentColor" stroke="none"/></svg><span>GEOMASH</span></div><p class="tagline">Planejamento e otimização de cobertura de RF para redes de distribuição.</p></div>
<div class="progress"><div class="track" aria-hidden="true"><span></span></div><p class="status">Salvando sua nova senha…</p></div></div><script nonce="${nonce}">
const form=document.getElementById('form'),notice=document.getElementById('notice'),password=document.getElementById('password'),confirmation=document.getElementById('confirmation'),submit=document.getElementById('submit'),toggle=document.getElementById('toggle'),loading=document.getElementById('loading'),main=document.querySelector('main');
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
 submit.disabled=true;submit.textContent='Salvando…';notice.hidden=true;main.hidden=true;loading.hidden=false;
 try{
  const response=await fetch('/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,senha:password.value}),signal:AbortSignal.timeout(30000)});
  if(response.status===204){form.reset();form.hidden=true;document.getElementById('intro').hidden=true;document.getElementById('instructions').hidden=false;show('Senha alterada com sucesso! As sessões anteriores foram encerradas.',true);return;}
  const body=await response.json().catch(()=>({}));
  if(response.status===400&&body.code!=='INVALID_PASSWORD'){form.hidden=true;show('Este link é inválido, expirou ou já foi utilizado. Volte ao Geomash e solicite outro em “Esqueci a senha”.');}
  else show(response.status===429?'Muitas tentativas. Aguarde alguns minutos e tente novamente.':response.status===400?'Use uma senha com 8 a 128 caracteres.':'Não foi possível concluir a operação. Tente novamente mais tarde.');
 }catch{show('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');}
 finally{loading.hidden=true;main.hidden=false;submit.disabled=false;submit.textContent='Salvar nova senha';}
});
</script></body></html>`);
  });
}
