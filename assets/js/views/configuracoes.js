/* ==========================================================================
   KombiTech — View: Configurações
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, $$, icon, esc } = K;
  let rootEl = null;

  function render() {
    if (!rootEl) return;
    const s = K.store.settings();
    const cfg = K.config;
    const driver = K.store.driver();
    const consentAt = s.privacy && s.privacy.consentAt;
    const el = $('#settingsBody');
    if (!el) return;

    el.innerHTML = `
      <div class="settings-grid stagger">
        <section class="set-card">
          <div class="set-head">
            <span class="stat-ico">${icon('route')}</span>
            <div><h3>Rota e confirmação de embarque</h3><p>Defina como o sistema identifica a chegada da perua e confirma os alunos.</p></div>
          </div>
          <div class="set-body">
            <div class="set-row">
              <div class="set-info">
                <b>Modo de localização</b>
                <span>${s.demoMode
                  ? 'Demonstração: a perua percorre um trajeto simulado. A interface sinaliza o modo em todas as telas.'
                  : 'GPS real: usa a geolocalização do dispositivo. Requer permissão do navegador e conexão segura (HTTPS).'}</span>
              </div>
              <div class="set-ctl">
                <span class="badge ${s.demoMode ? 'b-amber' : 'b-green'}">${s.demoMode ? 'Demonstração' : 'GPS real'}</span>
                <label class="switch"><input type="checkbox" id="demoMode" ${s.demoMode ? 'checked' : ''} aria-label="Modo demonstração"><span class="track"></span></label>
              </div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Raio de proximidade</b>
                <span>Distância mínima entre a perua e o endereço para confirmar o embarque automaticamente.</span>
              </div>
              <div class="set-ctl" style="flex-direction:column;align-items:flex-end;gap:2px">
                <div class="row" style="width:210px"><input type="range" class="range" id="proximity" min="40" max="400" step="10" value="${s.proximity}"><span class="set-val" id="proximityVal">${s.proximity} m</span></div>
              </div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Avançar automaticamente</b>
                <span>Após confirmar um aluno, destaca o próximo da sequência sem intervenção.</span>
              </div>
              <div class="set-ctl"><label class="switch"><input type="checkbox" id="autoAdvance" ${s.autoAdvance ? 'checked' : ''}><span class="track"></span></label></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Finalizar ao chegar na escola</b>
                <span>Encerra a rota automaticamente quando a perua chega ao destino final.</span>
              </div>
              <div class="set-ctl"><label class="switch"><input type="checkbox" id="autoFinish" ${s.autoFinish ? 'checked' : ''}><span class="track"></span></label></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Rota ativa</b>
                <span>Alterne entre a rota da manhã e da tarde. A troca é bloqueada durante uma rota em andamento.</span>
              </div>
              <div class="set-ctl">
                <select class="select" id="activeRoute">
                  ${K.store.routes().map((r) => `<option value="${r.id}" ${r.id === K.store.activeRoute().id ? 'selected' : ''}>${esc(r.name)} · ${esc(r.time)}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section class="set-card">
          <div class="set-head">
            <span class="stat-ico">${icon('map')}</span>
            <div><h3>Mapas e integrações</h3><p>Google Maps é o provedor ativo. OpenStreetMap permanece disponível como alternativa, mas os servidores voluntários podem bloquear o uso em produção.</p></div>
          </div>
          <div class="set-body">
            <div class="set-row">
              <div class="set-info">
                <b>Provedor de mapas</b>
                <span>Atualmente: <b>Google Maps JavaScript API</b>. Para trocar, edite <code class="tiny">assets/js/config.js</code>.</span>
              </div>
              <div class="set-ctl">
                <select class="select" id="mapProvider" disabled>
                  <option value="google" selected>Google Maps (chave configurada)</option>
                  <option value="openstreetmap">OpenStreetMap + Leaflet</option>
                </select>
              </div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Servidor de rotas (OSRM)</b>
                <span>Usado para calcular o trajeto pelas ruas. O servidor público é limitado; em produção use instância própria.</span>
              </div>
              <div class="set-ctl"><input class="input" id="osrmUrl" value="${esc(s.integrations.osrmUrl || cfg.maps.routing.osrmBaseUrl)}" spellcheck="false"></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Chave do Google Maps</b>
                <span>Armazenada apenas neste dispositivo. Nunca exponha chaves secretas no front-end em produção.</span>
              </div>
              <div class="set-ctl"><input class="input" id="googleKey" type="password" value="${esc(s.integrations.googleKey || cfg.maps.google.apiKey || '')}" placeholder="Cole a chave de API" autocomplete="off"></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Geocodificação de endereços</b>
                <span>Nominatim (OpenStreetMap) para localizar novos endereços. Respeite o limite de 1 requisição por segundo.</span>
              </div>
              <div class="set-ctl"><span class="badge b-green">${icon('check')}Ativa</span></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Chaves e variáveis de ambiente</b>
                <span>Em produção, configure no backend: <code class="tiny">MAPS_PROVIDER</code>, <code class="tiny">GOOGLE_MAPS_API_KEY</code>, <code class="tiny">OSRM_BASE_URL</code>, <code class="tiny">DATABASE_URL</code>, <code class="tiny">JWT_SECRET</code>.</span>
              </div>
            </div>
          </div>
          <div class="set-foot"><button class="btn btn-primary btn-sm" id="saveIntegrations">${icon('check')}Salvar integrações</button></div>
        </section>

        <section class="set-card">
          <div class="set-head">
            <span class="stat-ico green">${icon('shield')}</span>
            <div><h3>Privacidade e LGPD</h3><p>Controle a exposição de dados pessoais de crianças e responsáveis.</p></div>
          </div>
          <div class="set-body">
            <div class="set-row">
              <div class="set-info">
                <b>Mascarar telefones na interface</b>
                <span>Exibe apenas os primeiros e últimos dígitos. Recomendado ao usar o painel em locais públicos.</span>
              </div>
              <div class="set-ctl"><label class="switch"><input type="checkbox" id="maskContacts" ${s.maskContacts ? 'checked' : ''}><span class="track"></span></label></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Ocultar endereços completos</b>
                <span>Mostra apenas o bairro nas listas. O endereço completo continua disponível na parada do aluno.</span>
              </div>
              <div class="set-ctl"><label class="switch"><input type="checkbox" id="hideAddresses" ${s.privacy.hideAddresses ? 'checked' : ''}><span class="track"></span></label></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Compartilhar status com a escola</b>
                <span>Permite que a coordenação acompanhe somente a chegada dos alunos — nunca a localização em tempo real.</span>
              </div>
              <div class="set-ctl"><label class="switch"><input type="checkbox" id="shareSchool" ${s.privacy.shareWithSchool ? 'checked' : ''}><span class="track"></span></label></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Retenção de dados</b>
                <span>Após este período, trajetos antigos devem ser anonimizados ou excluídos.</span>
              </div>
              <div class="set-ctl">
                <select class="select" id="retention">
                  ${[90, 180, 365, 730].map((d) => `<option value="${d}" ${Number(s.retentionDays) === d ? 'selected' : ''}>${d} dias</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Consentimento do responsável</b>
                <span>${consentAt ? 'Registrado em ' + K.fmt.date(consentAt, { long: true }) + ' às ' + K.fmt.time(consentAt) + '.' : 'Nenhum consentimento registrado nesta demonstração.'}</span>
              </div>
              <div class="set-ctl">
                <button class="btn btn-ghost btn-sm" id="registerConsent">${icon('check')}${consentAt ? 'Atualizar' : 'Registrar'}</button>
              </div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Direitos do titular</b>
                <span>Exporte ou exclua os dados armazenados neste navegador a qualquer momento.</span>
              </div>
              <div class="set-ctl">
                <button class="btn btn-ghost btn-sm" id="exportData">${icon('download')}Exportar</button>
                <button class="btn btn-outline-danger btn-sm" id="wipeStudents">${icon('trash')}Excluir alunos</button>
              </div>
            </div>
          </div>
        </section>

        <section class="set-card">
          <div class="set-head">
            <span class="stat-ico navy">${icon('lock')}</span>
            <div><h3>Segurança e sessão</h3><p>Proteja o acesso ao painel, que contém dados sensíveis de crianças.</p></div>
          </div>
          <div class="set-body">
            <div class="set-row">
              <div class="set-info">
                <b>Duração da sessão</b>
                <span>Tempo máximo antes de exigir novo login.</span>
              </div>
              <div class="set-ctl">
                <select class="select" id="sessionTtl">
                  ${[120, 240, 480, 720].map((m) => `<option value="${m}" ${Number(s.sessionTtlMinutes) === m ? 'selected' : ''}>${K.fmt.duration(m)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Bloqueio por inatividade</b>
                <span>Se o painel ficar aberto sem interação, a sessão é encerrada por segurança.</span>
              </div>
              <div class="set-ctl">
                <select class="select" id="lockAfter">
                  ${[10, 15, 30, 60].map((m) => `<option value="${m}" ${Number(s.lockAfterMinutes) === m ? 'selected' : ''}>${m} minutos</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Senha da conta</b>
                <span>Última alteração em ${K.fmt.date(K.store.get().auth.updatedAt)}. Use ao menos 8 caracteres com letras e números.</span>
              </div>
              <div class="set-ctl"><button class="btn btn-ghost btn-sm" id="changePass">${icon('key')}Alterar senha</button></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Controle de permissões</b>
                <span>Perfil atual: <b>${esc(driver.role)}</b>. Acesso total aos próprios alunos e rotas. Nenhum dado é exposto publicamente.</span>
              </div>
              <div class="set-ctl"><span class="badge b-blue">${icon('shield')}Acesso restrito</span></div>
            </div>
          </div>
        </section>

        <section class="set-card">
          <div class="set-head">
            <span class="stat-ico gray">${icon('database')}</span>
            <div><h3>Sistema e dados</h3><p>Versão, armazenamento local e opções de manutenção.</p></div>
          </div>
          <div class="set-body">
            <div class="set-row">
              <div class="set-info">
                <b>Versão do KombiTech</b>
                <span>${esc(cfg.app.version)} · arquitetura preparada para app mobile (API REST + PWA).</span>
              </div>
              <div class="set-ctl"><span class="badge b-navy">${esc(cfg.app.version)}</span></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Armazenamento</b>
                <span>${K.store.students().length} alunos · ${K.store.history().length} trajetos · ${K.store.routes().length} rotas · dados no navegador (localStorage).</span>
              </div>
              <div class="set-ctl"><button class="btn btn-ghost btn-sm" id="clearHistory">${icon('trash')}Limpar histórico</button></div>
            </div>
            <div class="set-row">
              <div class="set-info">
                <b>Restaurar demonstração</b>
                <span>Recria alunos, rotas e histórico fictícios. Encerra a sessão atual.</span>
              </div>
              <div class="set-ctl"><button class="btn btn-outline-danger btn-sm" id="resetDemo">${icon('refresh')}Restaurar</button></div>
            </div>
          </div>
        </section>

        <div class="notice warn">
          ${icon('alert')}
          <div><b>Ambiente de demonstração.</b> ${esc(cfg.security.note)}</div>
        </div>
      </div>`;

    bind();
  }

  function changePasswordModal() {
    K.modal({
      title: 'Alterar senha',
      subtitle: 'A nova senha será usada no próximo acesso.',
      icon: 'key',
      size: 'sm',
      body: `
        <form class="stack" style="gap:14px" id="passForm">
          <div class="field"><label class="label">Senha atual</label><input class="input" type="password" id="curPass" autocomplete="current-password"></div>
          <div class="field"><label class="label">Nova senha</label><input class="input" type="password" id="newPass" autocomplete="new-password"><span class="hint">Mínimo de 8 caracteres.</span></div>
          <div class="field"><label class="label">Confirmar nova senha</label><input class="input" type="password" id="confPass" autocomplete="new-password"></div>
          <div class="error-msg" id="passError"></div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" data-modal-close>Cancelar</button>
        <button class="btn btn-primary" id="savePass">${icon('check')}Salvar senha</button>`,
      onMount: (el, close) => {
        el.querySelector('#savePass').addEventListener('click', async () => {
          const cur = el.querySelector('#curPass').value;
          const next = el.querySelector('#newPass').value;
          const conf = el.querySelector('#confPass').value;
          const err = el.querySelector('#passError');
          const fail = (m) => { err.textContent = m; err.classList.add('show'); };
          if (!cur) return fail('Informe a senha atual.');
          if (!next || next.length < 8) return fail('A nova senha deve ter ao menos 8 caracteres.');
          if (next !== conf) return fail('A confirmação não confere com a nova senha.');
          const res = await K.store.changePassword(cur, next);
          if (!res.ok) return fail(res.error);
          close();
          K.toast('Senha alterada', 'Use a nova senha no próximo acesso.', 'success');
        });
      }
    });
  }

  function bind() {
    const demo = $('#demoMode');
    if (demo) demo.addEventListener('change', () => {
      if (K.engine.isActive()) {
        demo.checked = !demo.checked;
        K.toast('Rota em andamento', 'Finalize a rota para alternar entre GPS real e demonstração.', 'warn');
        return;
      }
      K.store.updateSettings({ demoMode: demo.checked });
      K.toast(demo.checked ? 'Modo demonstração ativado' : 'GPS real ativado',
        demo.checked ? 'A localização será simulada e sinalizada na interface.' : 'Permita o acesso à localização ao iniciar a rota.',
        demo.checked ? 'warn' : 'success');
      render();
      document.dispatchEvent(new CustomEvent('kt:chrome'));
    });

    const prox = $('#proximity');
    if (prox) {
      prox.addEventListener('input', () => { $('#proximityVal').textContent = prox.value + ' m'; });
      prox.addEventListener('change', () => {
        K.store.updateSettings({ proximity: Number(prox.value) });
        K.toast('Raio atualizado', `Confirmação automática em ${prox.value} metros.`, 'success');
      });
    }

    const bindSwitch = (id, key, message) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('change', () => {
        const patch = {};
        patch[key] = el.checked;
        K.store.updateSettings(patch);
        K.toast('Configuração salva', message, 'success');
      });
    };
    bindSwitch('#autoAdvance', 'autoAdvance', 'Avanço automático de paradas atualizado.');
    bindSwitch('#autoFinish', 'autoFinish', 'Finalização automática na escola atualizada.');
    bindSwitch('#maskContacts', 'maskContacts', 'Exibição de contatos atualizada.');
    bindSwitch('#hideAddresses', 'hideAddresses', 'Exibição de endereços atualizada.');

    const share = $('#shareSchool');
    if (share) share.addEventListener('change', () => {
      K.store.updateSettings({ privacy: { shareWithSchool: share.checked } });
      K.toast('Privacidade atualizada', share.checked ? 'Escola autorizada a ver apenas a chegada dos alunos.' : 'Compartilhamento com a escola desativado.', 'success');
    });

    const retention = $('#retention');
    if (retention) retention.addEventListener('change', () => {
      K.store.updateSettings({ retentionDays: Number(retention.value) });
      K.toast('Retenção atualizada', `Dados mantidos por ${retention.value} dias.`, 'success');
    });

    const sessionTtl = $('#sessionTtl');
    if (sessionTtl) sessionTtl.addEventListener('change', () => {
      K.store.updateSettings({ sessionTtlMinutes: Number(sessionTtl.value) });
      K.toast('Sessão atualizada', 'O novo prazo vale a partir do próximo login.', 'success');
    });

    const lock = $('#lockAfter');
    if (lock) lock.addEventListener('change', () => {
      K.store.updateSettings({ lockAfterMinutes: Number(lock.value) });
      K.toast('Bloqueio atualizado', `Sessão encerrada após ${lock.value} min de inatividade.`, 'success');
    });

    const activeRoute = $('#activeRoute');
    if (activeRoute) activeRoute.addEventListener('change', () => {
      if (K.engine.isActive()) { K.toast('Rota em andamento', 'Finalize a rota atual antes de trocar.', 'warn'); render(); return; }
      K.store.activateRoute(activeRoute.value);
      K.toast('Rota ativa alterada', K.store.route(activeRoute.value).name, 'success');
      render();
    });

    const saveInt = $('#saveIntegrations');
    if (saveInt) saveInt.addEventListener('click', () => {
      K.store.updateSettings({
        integrations: {
          googleKey: $('#googleKey').value.trim(),
          osrmUrl: $('#osrmUrl').value.trim() || K.config.maps.routing.osrmBaseUrl,
          tileUrl: K.store.settings().integrations.tileUrl
        }
      });
      K.toast('Integrações salvas', 'Recarregue a página para aplicar a nova chave ou servidor de rotas.', 'success');
    });

    const consent = $('#registerConsent');
    if (consent) consent.addEventListener('click', () => {
      K.store.updateSettings({ privacy: { consentAt: new Date().toISOString() } });
      K.toast('Consentimento registrado', 'Data e hora gravadas no painel de privacidade.', 'success');
      render();
    });

    const exportBtn = $('#exportData');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      K.util.download(`kombitech-dados-${K.store.isoDay(new Date())}.json`, K.store.exportData(), 'application/json');
      K.toast('Dados exportados', 'Backup completo em JSON.', 'success');
    });

    const wipe = $('#wipeStudents');
    if (wipe) wipe.addEventListener('click', async () => {
      const ok = await K.confirm({
        title: 'Excluir todos os alunos?',
        message: 'Alunos e vínculos com rotas serão removidos permanentemente.',
        detail: 'Recomendado apenas para testes. Em produção, a exclusão deve ser auditada e o titular notificado.',
        confirmLabel: 'Excluir tudo',
        danger: true,
        icon: 'trash'
      });
      if (!ok) return;
      if (K.engine.isActive()) K.engine.reset();
      K.store.wipeStudents();
      K.toast('Alunos excluídos', 'A base local foi limpa.', 'success');
      render();
    });

    const clearHist = $('#clearHistory');
    if (clearHist) clearHist.addEventListener('click', async () => {
      const ok = await K.confirm({
        title: 'Limpar histórico?',
        message: 'Todos os trajetos concluídos serão removidos.',
        confirmLabel: 'Limpar',
        danger: true,
        icon: 'trash'
      });
      if (!ok) return;
      K.store.clearHistory();
      K.toast('Histórico limpo', 'Os relatórios começarão do zero.', 'success');
      render();
    });

    const reset = $('#resetDemo');
    if (reset) reset.addEventListener('click', async () => {
      const ok = await K.confirm({
        title: 'Restaurar demonstração?',
        message: 'Todos os dados atuais serão substituídos pelos dados fictícios originais.',
        detail: 'Você será desconectado e voltará à tela de login.',
        confirmLabel: 'Restaurar',
        danger: true,
        icon: 'refresh'
      });
      if (!ok) return;
      await K.store.resetDemo();
      location.replace('index.html?logout=1');
    });

    const pass = $('#changePass');
    if (pass) pass.addEventListener('click', changePasswordModal);
  }

  function mount(container) {
    rootEl = container;
    container.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Configurações</h1>
          <p class="page-sub">Ajuste a confirmação de embarques, integrações de mapa, privacidade e segurança da conta.</p>
        </div>
        <div class="page-actions">
          <span class="badge ${K.store.settings().demoMode ? 'b-amber' : 'b-green'}">${K.store.settings().demoMode ? 'Modo demonstração' : 'GPS real'}</span>
        </div>
      </div>
      <div id="settingsBody"></div>`;
    render();
  }

  K.views = K.views || {};
  K.views.configuracoes = {
    mount,
    unmount() { rootEl = null; }
  };
})(window.KT);
