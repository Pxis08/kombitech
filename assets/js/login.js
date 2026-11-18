/* ==========================================================================
   KombiTech — Tela de login
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, icon, esc } = K;
  let role = 'driver';

  function demoFor(r) {
    return r === 'guardian'
      ? K.config.security.guardianDemoCredentials
      : K.config.security.demoCredentials;
  }

  function setRole(next, opts) {
    role = next === 'guardian' ? 'guardian' : 'driver';
    const isGuardian = role === 'guardian';
    K.$$('.auth-role').forEach((btn) => {
      const on = btn.dataset.role === role;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('#authTitle').textContent = isGuardian ? 'Área da família' : 'Bem-vindo de volta';
    $('#authSub').textContent = isGuardian
      ? 'Acompanhe a rota do seu filho, converse com o motorista e receba avisos em tempo real.'
      : 'Entre com sua conta de motorista para acompanhar a rota de hoje.';
    $('#demoBtnLabel').textContent = isGuardian
      ? 'Entrar como responsável (demo)'
      : 'Entrar como motorista (demo)';
    $('#email').placeholder = demoFor(role).email;
    $('#demoDriverRow').classList.toggle('active', !isGuardian);
    $('#demoGuardianRow').classList.toggle('active', isGuardian);
    if (!opts || !opts.keepError) clearError();
  }

  function fillDemo(r) {
    const creds = demoFor(r);
    setRole(r);
    $('#email').value = creds.email;
    $('#password').value = creds.password;
    $('#consent').checked = true;
    clearError();
    $('#submitBtn').focus();
  }

  function showError(message) {
    const box = $('#loginError');
    const text = $('#loginErrorText');
    text.textContent = message;
    box.classList.add('show');
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = '';
  }

  function clearError() {
    $('#loginError').classList.remove('show');
  }

  function setLoading(loading) {
    const btn = $('#submitBtn');
    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<span class="row" style="gap:8px"><span class="spinner"></span>Entrando...</span>`
      : `<span>Entrar</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>`;
  }

  function privacyModal() {
    K.modal({
      title: 'Privacidade e proteção de dados',
      subtitle: 'Resumo da política de tratamento — LGPD',
      icon: 'shield',
      size: 'md',
      body: `
        <div class="stack" style="gap:14px;font-size:12.5px;line-height:1.6;color:var(--ink-soft)">
          <div class="notice">${icon('info')}<div><b>Ambiente de demonstração.</b> Os dados exibidos são fictícios e ficam armazenados apenas neste navegador. Nada é enviado para servidores.</div></div>
          <div>
            <div class="strong" style="margin-bottom:4px">Quais dados tratamos</div>
            Nome do aluno, endereço residencial, escola de destino e telefone do responsável. Esses dados são necessários para executar o transporte escolar contratado.
          </div>
          <div>
            <div class="strong" style="margin-bottom:4px">Finalidade e base legal</div>
            Execução de contrato e legítimo interesse do responsável (art. 7º, V e IX, da LGPD). Não utilizamos os dados para publicidade.
          </div>
          <div>
            <div class="strong" style="margin-bottom:4px">Quem acessa</div>
            Apenas o motorista autenticado e, quando autorizado, a coordenação da escola. A localização da perua e dos alunos nunca é exposta publicamente.
          </div>
          <div>
            <div class="strong" style="margin-bottom:4px">Segurança</div>
            Sessão com expiração automática, bloqueio por inatividade, mascaramento de contatos e princípio da minimização. Em produção, os dados devem ser criptografados em repouso e em trânsito (HTTPS).
          </div>
          <div>
            <div class="strong" style="margin-bottom:4px">Direitos do titular</div>
            O responsável pode solicitar acesso, correção, portabilidade ou exclusão dos dados a qualquer momento pelo canal de atendimento.
          </div>
        </div>`,
      footer: `<button class="btn btn-primary" data-modal-close>Entendi</button>`
    });
  }

  function passwordField(id, label, placeholder) {
    return `
      <div class="field">
        <label class="label" for="${id}">${label}</label>
        <div class="input-icon">
          ${icon('lock')}
          <input class="input" id="${id}" type="password" autocomplete="new-password" placeholder="${placeholder}">
          <button type="button" class="icon-btn trail" data-toggle-pass="${id}" aria-label="Mostrar senha">${icon('eye')}</button>
        </div>
      </div>`;
  }

  function bindPasswordToggles(el) {
    el.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = el.querySelector('#' + btn.getAttribute('data-toggle-pass'));
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
        btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      });
    });
  }

  function firstAccessModal() {
    const pending = K.store.guardians()
      .map((g) => ({ g, st: K.store.guardianAuthStatus(g.id) }))
      .filter((x) => x.st && !x.st.active && x.st.code);
    const demoHint = pending.length
      ? `<div class="auth-demo" style="margin:0">
           <b>Simulação de envio de código</b>
           <div class="tiny" style="margin-top:4px">Nenhum e-mail é enviado nesta demonstração. Código individual de <b>${esc(pending[0].st.name)}</b>:</div>
           <div class="code-box"><code>${esc(pending[0].st.code)}</code></div>
           <div class="tiny muted">${esc(pending[0].st.email)}</div>
         </div>`
      : '';

    K.modal({
      title: 'Ative sua conta',
      subtitle: 'Primeiro acesso do responsável',
      icon: 'key',
      size: 'sm',
      body: `
        <div class="stack" style="gap:12px">
          <div class="notice warn">${icon('alert')}<div><b>Demonstração.</b> A validação do código é local. Nenhum e-mail é realmente enviado.</div></div>
          <div class="field">
            <label class="label" for="actEmail">E-mail do responsável</label>
            <div class="input-icon">${icon('mail')}<input class="input" id="actEmail" type="email" autocomplete="email" placeholder="responsavel@email.com"></div>
          </div>
          <div class="field">
            <label class="label" for="actCode">Código de ativação</label>
            <div class="input-icon">${icon('key')}<input class="input" id="actCode" type="text" autocomplete="one-time-code" placeholder="KT-XXXX-XXXX" spellcheck="false"></div>
          </div>
          <div id="actStep2" class="stack" style="gap:12px;display:none">
            ${passwordField('actPass', 'Crie sua senha', 'Mínimo de 8 caracteres')}
            ${passwordField('actPass2', 'Repita a senha', 'Confirme a senha')}
          </div>
          <div class="auth-error" id="actError" role="alert" style="margin:0"><span></span></div>
          ${demoHint}
          <p class="tiny muted" style="line-height:1.6">O código é individual, de uso único e expira em 7 dias. Se você não recebeu o código, peça ao motorista para gerar um novo.</p>
        </div>`,
      footer: `
        <button class="btn btn-ghost" data-modal-close>Cancelar</button>
        <button class="btn btn-primary" id="actSubmit">${icon('check')}Continuar</button>`,
      onMount: (el, close) => {
        bindPasswordToggles(el);
        const err = el.querySelector('#actError');
        const showErr = (msg) => { err.querySelector('span').textContent = msg; err.classList.add('show'); };
        const clearErr = () => err.classList.remove('show');
        el.querySelector('#actSubmit').addEventListener('click', async () => {
          clearErr();
          const email = el.querySelector('#actEmail').value.trim();
          const code = el.querySelector('#actCode').value.trim();
          const step2 = el.querySelector('#actStep2');
          const pass = el.querySelector('#actPass');
          const pass2 = el.querySelector('#actPass2');
          const btn = el.querySelector('#actSubmit');
          if (!email) { showErr('Informe o e-mail cadastrado.'); return; }
          if (!code) { showErr('Informe o código de ativação.'); return; }
          if (step2.style.display === 'none') {
            btn.disabled = true;
            const check = await K.store.validateGuardianActivation(email, code);
            btn.disabled = false;
            if (!check.ok) { showErr(check.error); return; }
            step2.style.display = 'grid';
            el.querySelector('#actEmail').readOnly = true;
            el.querySelector('#actCode').readOnly = true;
            btn.innerHTML = `${icon('check')}Ativar conta`;
            pass.focus();
            return;
          }
          if (!pass.value || pass.value.length < 8) { showErr('A senha deve ter ao menos 8 caracteres.'); pass.focus(); return; }
          if (pass.value !== pass2.value) { showErr('As senhas não conferem.'); pass2.focus(); return; }
          btn.disabled = true;
          const res = await K.store.activateGuardian(email, code, pass.value);
          btn.disabled = false;
          if (!res.ok) { showErr(res.error); return; }
          close();
          setRole('guardian');
          $('#email').value = email;
          $('#password').value = '';
          $('#consent').checked = true;
          K.toast('Conta ativada', `Senha criada para ${res.name}. Entre com seu e-mail e a nova senha.`, 'success', { ttl: 7000 });
          $('#password').focus();
        });
      }
    });
  }

  function forgotModal() {
    K.modal({
      title: 'Recuperar senha',
      subtitle: 'Área da família',
      icon: 'key',
      size: 'sm',
      body: `
        <div class="stack" style="gap:12px">
          <div class="notice warn">${icon('alert')}<div><b>Demonstração.</b> O código temporário é exibido nesta tela; nenhum e-mail é realmente enviado.</div></div>
          <div class="field">
            <label class="label" for="recEmail">E-mail do responsável</label>
            <div class="input-icon">${icon('mail')}<input class="input" id="recEmail" type="email" autocomplete="email" placeholder="responsavel@email.com"></div>
          </div>
          <div id="recStep2" class="stack" style="gap:12px;display:none">
            <div class="field">
              <label class="label" for="recCode">Código temporário</label>
              <div class="input-icon">${icon('key')}<input class="input" id="recCode" type="text" autocomplete="one-time-code" placeholder="KT-R-000000" spellcheck="false"></div>
            </div>
            ${passwordField('recPass', 'Nova senha', 'Mínimo de 8 caracteres')}
            ${passwordField('recPass2', 'Repita a nova senha', 'Confirme a senha')}
          </div>
          <div class="auth-error" id="recError" role="alert" style="margin:0"><span></span></div>
          <div id="recDemo"></div>
          <p class="tiny muted" style="line-height:1.6">Por segurança, não informamos se um e-mail está cadastrado. O código é de uso único, expira em 30 minutos e invalida a senha anterior assim que a nova é definida.</p>
          <div class="notice neutral">${icon('info')}<div>Contas de motorista são recuperadas pelo suporte. Nesta demonstração, use os acessos de demonstração da tela inicial.</div></div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" data-modal-close>Cancelar</button>
        <button class="btn btn-primary" id="recSubmit">${icon('key')}Solicitar código</button>`,
      onMount: (el, close) => {
        bindPasswordToggles(el);
        const err = el.querySelector('#recError');
        const showErr = (msg) => { err.querySelector('span').textContent = msg; err.classList.add('show'); };
        const clearErr = () => err.classList.remove('show');
        el.querySelector('#recSubmit').addEventListener('click', async () => {
          clearErr();
          const email = el.querySelector('#recEmail').value.trim();
          const step2 = el.querySelector('#recStep2');
          const btn = el.querySelector('#recSubmit');
          if (!email) { showErr('Informe seu e-mail.'); return; }
          if (step2.style.display === 'none') {
            btn.disabled = true;
            const res = await K.store.requestGuardianRecovery(email);
            btn.disabled = false;
            if (!res.ok) { showErr('Não foi possível solicitar o código. Tente novamente.'); return; }
            el.querySelector('#recEmail').readOnly = true;
            step2.style.display = 'grid';
            btn.innerHTML = `${icon('key')}Redefinir senha`;
            const demo = el.querySelector('#recDemo');
            demo.innerHTML = res.demoCode
              ? `<div class="auth-demo" style="margin:0">
                   <b>Simulação de envio</b>
                   <div class="tiny" style="margin-top:4px">Em produção este código chegaria por e-mail. Nesta demonstração, use:</div>
                   <div class="code-box"><code>${esc(res.demoCode)}</code></div>
                   <div class="tiny muted">Válido por 30 minutos · uso único</div>
                 </div>`
              : `<div class="notice neutral">${icon('info')}<div>Se o e-mail estiver cadastrado, um código temporário será enviado. Nesta demonstração, nenhuma conta corresponde a este e-mail.</div></div>`;
            el.querySelector('#recCode').focus();
            return;
          }
          const code = el.querySelector('#recCode').value.trim();
          const pass = el.querySelector('#recPass');
          const pass2 = el.querySelector('#recPass2');
          if (!code) { showErr('Informe o código recebido.'); return; }
          if (!pass.value || pass.value.length < 8) { showErr('A nova senha deve ter ao menos 8 caracteres.'); pass.focus(); return; }
          if (pass.value !== pass2.value) { showErr('As senhas não conferem.'); pass2.focus(); return; }
          btn.disabled = true;
          const res = await K.store.resetGuardianPassword(email, code, pass.value);
          btn.disabled = false;
          if (!res.ok) { showErr(res.error); return; }
          close();
          setRole('guardian');
          $('#email').value = email;
          $('#password').value = '';
          $('#consent').checked = true;
          K.toast('Senha redefinida', 'O código foi invalidado. Entre com sua nova senha.', 'success', { ttl: 7000 });
          $('#password').focus();
        });
      }
    });
  }

  function helpModal() {
    K.modal({
      title: 'Central de ajuda',
      subtitle: 'Suporte ao motorista e à família',
      icon: 'message',
      size: 'sm',
      body: `
        <div class="stack" style="gap:12px">
          <p class="small muted" style="line-height:1.6">Precisa de suporte com a rota, cadastro de alunos, mensagens ou acesso à conta?</p>
          <div class="list-row"><div class="stat-ico">${icon('phone')}</div><div class="grow"><div class="list-title">Telefone</div><div class="list-sub">(11) 4000-1234 · seg a sex, 7h às 19h</div></div></div>
          <div class="list-row"><div class="stat-ico">${icon('mail')}</div><div class="grow"><div class="list-title">E-mail</div><div class="list-sub">suporte@kombitech.app</div></div></div>
          <div class="list-row"><div class="stat-ico">${icon('shield')}</div><div class="grow"><div class="list-title">Privacidade</div><div class="list-sub">privacidade@kombitech.app</div></div></div>
          <div class="notice neutral">${icon('info')}<div>Em emergências durante a rota, o motorista pode registrar uma ocorrência e avisar os responsáveis pelo chat.</div></div>
        </div>`,
      footer: `<button class="btn btn-primary" data-modal-close>Fechar</button>`
    });
  }

  async function doLogin(email, password, remember) {
    clearError();
    setLoading(true);
    try {
      const result = await K.store.login(email, password, remember, role);
      if (!result.ok) {
        setLoading(false);
        showError(result.error);
        return;
      }
      window.location.replace('app.html');
    } catch (err) {
      setLoading(false);
      showError('Não foi possível concluir o acesso. Tente novamente.');
      console.error(err);
    }
  }

  async function init() {
    $('#brandMark').innerHTML = K.logoSvg();
    $('#brandMarkMobile').innerHTML = K.logoSvg();
    $('#year').textContent = new Date().getFullYear();

    const params = new URLSearchParams(location.search);
    if (params.get('logout')) K.toast('Sessão encerrada', 'Você saiu com segurança.', 'success');
    if (params.get('expired')) K.toast('Sessão expirada', 'Entre novamente para continuar.', 'warn');
    if (params.get('locked')) K.toast('Conta bloqueada por inatividade', 'Por segurança, confirme sua senha novamente.', 'warn', { ttl: 6000 });

    try {
      await K.store.ready();
    } catch (err) {
      showError('Não foi possível inicializar o armazenamento local do navegador.');
      console.error(err);
      return;
    }

    if (K.store.session()) {
      window.location.replace('app.html');
      return;
    }

    const form = $('#loginForm');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const email = $('#email').value.trim();
      const password = $('#password').value;
      if (!email) { showError('Informe seu usuário ou e-mail.'); $('#email').focus(); return; }
      if (!password) { showError('Informe sua senha.'); $('#password').focus(); return; }
      if (!$('#consent').checked) {
        showError('Para continuar, aceite a política de privacidade e o tratamento de dados (LGPD).');
        $('#consent').focus();
        return;
      }
      doLogin(email, password, true);
    });

    K.$$('.auth-role').forEach((btn) => {
      btn.addEventListener('click', () => setRole(btn.dataset.role));
    });

    $('#email').addEventListener('input', clearError);
    $('#password').addEventListener('input', clearError);
    $('#consent').addEventListener('change', clearError);

    $('#togglePass').addEventListener('click', () => {
      const input = $('#password');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      $('#togglePass').innerHTML = isPassword
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19c-6.4 0-10-7-10-7a18.6 18.6 0 0 1 5.1-5.9M9.9 4.2A10.4 10.4 0 0 1 12 4c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2M14.1 14.1a3 3 0 0 1-4.2-4.2M2 2l20 20"/></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`;
      $('#togglePass').setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
    });

    $('#fillDemoDriver').addEventListener('click', () => fillDemo('driver'));
    $('#fillDemoGuardian').addEventListener('click', () => fillDemo('guardian'));

    $('#demoBtn').addEventListener('click', () => {
      const creds = demoFor(role);
      $('#consent').checked = true;
      $('#email').value = creds.email;
      $('#password').value = creds.password;
      doLogin(creds.email, creds.password, true);
    });

    $('#forgotBtn').addEventListener('click', forgotModal);
    $('#activateBtn').addEventListener('click', firstAccessModal);
    $('#privacyLink').addEventListener('click', (ev) => { ev.preventDefault(); privacyModal(); });
    $('#helpLink').addEventListener('click', helpModal);

    setRole('driver', { keepError: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.KT);
