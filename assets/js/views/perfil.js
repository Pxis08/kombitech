/* ==========================================================================
   KombiTech — View: Perfil do motorista
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, $$, icon, esc } = K;
  let rootEl = null;

  /* ---------- Cálculos ---------- */
  function stats() {
    const hist = K.store.history();
    const sum = K.store.reportSummary();
    const picked = hist.reduce((acc, h) => acc + (Number(h.picked) || 0), 0);
    const km = hist.reduce((acc, h) => acc + (Number(h.distanceKm) || 0), 0);
    return {
      routes: hist.length,
      picked,
      km,
      avg: sum ? sum.avgDuration : 0
    };
  }

  function kpi(label, value, foot, ico, tone) {
    return `
      <div class="kpi">
        <div class="row-between" style="align-items:flex-start">
          <div class="kpi-label">${esc(label)}</div>
          <span class="stat-ico ${tone || ''}" style="width:30px;height:30px;border-radius:9px">${icon(ico)}</span>
        </div>
        <div class="kpi-value">${value}</div>
        <div class="kpi-foot">${foot}</div>
      </div>`;
  }

  function row(label, value, opts) {
    const o = opts || {};
    return `
      <div class="set-row">
        <div class="set-info">
          <b>${esc(label)}</b>
          <span>${o.help || ''}</span>
        </div>
        <div class="set-ctl">${o.control || `<span class="small strong" style="max-width:260px;text-align:right">${value}</span>`}</div>
      </div>`;
  }

  /* ---------- Conteúdo ---------- */
  function render() {
    if (!rootEl) return;
    const driver = K.store.driver();
    const van = driver.van || {};
    const base = driver.base || {};
    const auth = K.store.get().auth;
    const s = K.store.settings();
    const st = stats();
    const body = $('#profileBody');
    if (!body) return;

    body.innerHTML = `
      <section class="profile-hero">
        <div class="avatar xl photo">${esc(K.fmt.initials(driver.name))}</div>
        <div class="grow" style="min-width:220px">
          <div class="row wrap" style="gap:9px">
            <div class="profile-name">${esc(driver.name)}</div>
            <span class="badge" style="background:rgba(91,155,255,.16);color:#9CC4FF">${icon('shield')}Motorista verificado</span>
          </div>
          <div class="profile-role">
            ${icon('van')}${esc(van.model || 'Veículo')} · ${esc(van.plate || '—')}
            <span class="badge">${esc(van.color || '')}${van.color ? ' · ' : ''}${esc(van.year || '')}</span>
          </div>
          <div class="profile-meta">
            <div>${icon('mail')}${esc(driver.email)}</div>
            <div>${icon('phone')}${esc(driver.phone || '—')}</div>
            <div>${icon('key')}CNH ${esc(driver.cnh || '—')}</div>
            <div>${icon('calendar')}Motorista desde ${esc(driver.since || '—')}</div>
          </div>
        </div>
        <div class="profile-hero-actions">
          <button class="btn btn-primary" data-edit>${icon('edit')}Editar perfil</button>
          <button class="btn btn-hero-ghost" data-password>${icon('lock')}Alterar senha</button>
        </div>
      </section>

      <div class="kpi-grid stagger">
        ${kpi('Rotas concluídas', st.routes, `${icon('route')}registradas no histórico`, 'route', '')}
        ${kpi('Alunos transportados', st.picked, `${icon('users')}embarques confirmados`, 'userCheck', 'green')}
        ${kpi('Distância percorrida', `${st.km.toFixed(1).replace('.', ',')}<small>km</small>`, `${icon('mapPin')}somatório dos trajetos`, 'nav', '')}
        ${kpi('Tempo médio por rota', K.fmt.duration(st.avg), `${icon('clock')}baseado nas rotas concluídas`, 'clock', 'gray')}
      </div>

      <div class="profile-grid">
        <div class="stack" style="gap:16px">
          <section class="set-card">
            <div class="set-head">
              <span class="stat-ico">${icon('user')}</span>
              <div><h3>Dados pessoais</h3><p>Informações usadas nos registros de rota e no contato com a escola.</p></div>
            </div>
            <div class="set-body">
              ${row('Nome completo', esc(driver.name))}
              ${row('E-mail de acesso', esc(driver.email), { help: 'O e-mail é usado para entrar na plataforma.' })}
              ${row('Telefone', esc(driver.phone || '—'), { help: 'Canal de contato da coordenação e do suporte.' })}
              ${row('CNH', esc(driver.cnh || '—'), { help: 'Categoria e validade devem ser conferidas fora do app.' })}
              ${row('Perfil de acesso', `<span class="badge b-blue">${icon('shield')}${esc(driver.role || 'Motorista')}</span>`, { help: 'Acesso restrito aos próprios alunos, rotas e relatórios.' })}
            </div>
            <div class="set-foot">
              <button class="btn btn-ghost btn-sm" data-edit>${icon('edit')}Editar dados</button>
            </div>
          </section>

          <section class="set-card">
            <div class="set-head">
              <span class="stat-ico amber">${icon('van')}</span>
              <div><h3>Veículo e garagem</h3><p>Dados da perua escolar utilizada nas rotas deste motorista.</p></div>
            </div>
            <div class="set-body">
              ${row('Modelo', esc(van.model || '—'))}
              ${row('Ano · Cor', `${esc(van.year || '—')} · ${esc(van.color || '—')}`)}
              ${row('Placa', `<span class="badge b-navy">${esc(van.plate || '—')}</span>`)}
              ${row('Capacidade', `${esc(van.capacity || '—')} alunos`, { help: 'Limite máximo de passageiros por trajeto.' })}
              ${row('Garagem / base', esc(base.label || '—'), { help: 'Ponto de partida considerado nas estimativas de rota.' })}
            </div>
            <div class="set-foot">
              <button class="btn btn-ghost btn-sm" data-edit>${icon('edit')}Atualizar veículo</button>
            </div>
          </section>
        </div>

        <div class="stack" style="gap:16px">
          <section class="set-card">
            <div class="set-head">
              <span class="stat-ico navy">${icon('lock')}</span>
              <div><h3>Segurança da conta</h3><p>Proteção do acesso ao painel, que contém dados sensíveis de crianças.</p></div>
            </div>
            <div class="set-body">
              ${row('Senha', `<span class="badge b-green">${icon('check')}Definida</span>`, {
                help: `Última alteração em ${K.fmt.date(auth.updatedAt)}.`
              })}
              ${row('Sessão', `${K.fmt.duration(s.sessionTtlMinutes)}`, { help: 'Tempo máximo antes de exigir novo login.' })}
              ${row('Bloqueio por inatividade', `${s.lockAfterMinutes} minutos`, { help: 'Encerra a sessão quando o painel fica aberto sem uso.' })}
              ${row('Verificação em duas etapas', '<span class="badge b-gray">Não configurada</span>', { help: 'Disponível em produção com autenticação no servidor.' })}
            </div>
            <div class="set-foot" style="gap:8px">
              <button class="btn btn-ghost btn-sm" data-password>${icon('key')}Alterar senha</button>
              <button class="btn btn-outline-danger btn-sm" data-logout>${icon('logout')}Sair</button>
            </div>
          </section>

          <section class="set-card">
            <div class="set-head">
              <span class="stat-ico green">${icon('shield')}</span>
              <div><h3>Permissões e privacidade</h3><p>O que este perfil pode acessar e como os dados são exibidos.</p></div>
            </div>
            <div class="set-body">
              ${row('Localização da perua', s.demoMode
                ? '<span class="badge b-amber">Demonstração</span>'
                : '<span class="badge b-green">GPS real</span>', {
                help: s.demoMode
                  ? 'Posição simulada e sinalizada em todas as telas.'
                  : 'Usa a localização do dispositivo, apenas durante a rota.'
              })}
              ${row('Dados dos alunos', '<span class="badge b-blue">Acesso restrito</span>', { help: 'Visíveis apenas neste painel autenticado. Nunca são públicos.' })}
              ${row('Contatos dos responsáveis', s.maskContacts
                ? '<span class="badge b-green">Mascarados</span>'
                : '<span class="badge b-amber">Visíveis</span>', {
                help: s.maskContacts ? 'Apenas os primeiros e últimos dígitos aparecem.' : 'Exibição completa habilitada nas configurações.'
              })}
              ${row('Compartilhar com a escola', s.privacy && s.privacy.shareWithSchool
                ? '<span class="badge b-blue">Somente chegada</span>'
                : '<span class="badge b-gray">Desativado</span>', {
                help: 'A escola nunca recebe a localização em tempo real, apenas o status dos embarques.'
              })}
              ${row('Consentimento LGPD', s.privacy && s.privacy.consentAt
                ? `<span class="badge b-green">${icon('check')}Registrado</span>`
                : '<span class="badge b-amber">Pendente</span>', {
                help: s.privacy && s.privacy.consentAt
                  ? `Registrado em ${K.fmt.date(s.privacy.consentAt, { long: true })}.`
                  : 'Registre o consentimento do responsável nas configurações.'
              })}
            </div>
            <div class="set-foot" style="gap:8px">
              <button class="btn btn-ghost btn-sm" data-settings>${icon('settings')}Abrir configurações</button>
              <button class="btn btn-ghost btn-sm" data-export>${icon('download')}Exportar dados</button>
            </div>
          </section>

          <div class="notice neutral">
            ${icon('info')}
            <div><b>Ambiente de demonstração.</b> Este perfil e os dados do veículo são fictícios e ficam apenas neste navegador.</div>
          </div>
        </div>
      </div>`;

    bind();
  }

  /* ---------- Modais ---------- */
  function editModal() {
    const driver = K.store.driver();
    const van = driver.van || {};
    const base = driver.base || {};
    K.modal({
      title: 'Editar perfil',
      subtitle: 'Atualize seus dados de contato e as informações do veículo.',
      icon: 'user',
      size: 'md',
      body: `
        <form id="profileForm" class="form-grid" novalidate>
          <div class="form-section-title">Motorista</div>
          <div class="field span-2">
            <label class="label" for="pName">Nome completo</label>
            <input class="input" id="pName" value="${esc(driver.name)}" autocomplete="name">
          </div>
          <div class="field">
            <label class="label" for="pPhone">Telefone</label>
            <input class="input" id="pPhone" value="${esc(driver.phone || '')}" inputmode="tel" autocomplete="tel">
          </div>
          <div class="field">
            <label class="label" for="pCnh">CNH</label>
            <input class="input" id="pCnh" value="${esc(driver.cnh || '')}" inputmode="numeric" placeholder="Número da CNH">
          </div>

          <div class="form-section-title">Veículo</div>
          <div class="field">
            <label class="label" for="pVanModel">Modelo</label>
            <input class="input" id="pVanModel" value="${esc(van.model || '')}">
          </div>
          <div class="field">
            <label class="label" for="pVanPlate">Placa</label>
            <input class="input" id="pVanPlate" value="${esc(van.plate || '')}" spellcheck="false" style="text-transform:uppercase">
          </div>
          <div class="field">
            <label class="label" for="pVanYear">Ano</label>
            <input class="input" id="pVanYear" value="${esc(van.year || '')}" inputmode="numeric">
          </div>
          <div class="field">
            <label class="label" for="pVanColor">Cor</label>
            <input class="input" id="pVanColor" value="${esc(van.color || '')}">
          </div>
          <div class="field">
            <label class="label" for="pVanCapacity">Capacidade</label>
            <input class="input" id="pVanCapacity" value="${esc(van.capacity || '')}" inputmode="numeric">
          </div>
          <div class="field">
            <label class="label" for="pBase">Garagem / base</label>
            <input class="input" id="pBase" value="${esc(base.label || '')}" placeholder="Endereço de partida">
          </div>
          <div class="span-2"><div class="error-msg" id="profileError"></div></div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" data-modal-close>Cancelar</button>
        <button class="btn btn-primary" id="saveProfile">${icon('check')}Salvar alterações</button>`,
      onMount: (el, close) => {
        const phone = el.querySelector('#pPhone');
        phone.addEventListener('input', () => { phone.value = K.fmt.phone(phone.value); });

        el.querySelector('#saveProfile').addEventListener('click', () => {
          const err = el.querySelector('#profileError');
          const fail = (msg) => { err.textContent = msg; err.classList.add('show'); };
          const name = el.querySelector('#pName').value.trim();
          const phoneValue = el.querySelector('#pPhone').value.trim();
          const cnh = el.querySelector('#pCnh').value.trim();
          const vanModel = el.querySelector('#pVanModel').value.trim();
          const plate = el.querySelector('#pVanPlate').value.trim().toUpperCase();
          const year = Number(el.querySelector('#pVanYear').value) || null;
          const color = el.querySelector('#pVanColor').value.trim();
          const capacity = Number(el.querySelector('#pVanCapacity').value) || null;
          const baseLabel = el.querySelector('#pBase').value.trim();

          if (!name || name.split(/\s+/).length < 2) return fail('Informe o nome completo do motorista.');
          if (phoneValue && phoneValue.replace(/\D/g, '').length < 10) return fail('Informe um telefone válido com DDD.');
          if (year && (year < 1980 || year > new Date().getFullYear() + 1)) return fail('Informe um ano de veículo válido.');
          if (capacity && (capacity < 1 || capacity > 60)) return fail('A capacidade deve ficar entre 1 e 60 alunos.');

          const previousVan = K.store.driver().van || {};
          K.store.updateDriver({
            name,
            phone: phoneValue,
            cnh,
            van: { model: vanModel, plate, year, color, capacity },
            base: Object.assign({}, K.store.driver().base, { label: baseLabel })
          });
          const vanChanged = previousVan.plate !== plate || previousVan.model !== vanModel || previousVan.color !== color;
          if (vanChanged) {
            K.store.guardians().forEach((g) => {
              if (g.preferences && g.preferences.notifyVan === false) return;
              K.store.pushNotification({
                audience: 'guardian',
                guardianId: g.id,
                type: 'van',
                title: 'Atualização da van',
                text: `O veículo foi atualizado para ${vanModel || 'van escolar'} · ${plate || 'placa não informada'}${color ? ' · ' + color : ''}.`
              });
            });
          }
          close();
          K.toast('Perfil atualizado', vanChanged
            ? 'Dados salvos. Os responsáveis foram avisados sobre a troca de veículo.'
            : 'Os dados do motorista e do veículo foram salvos.', 'success');
          render();
          document.dispatchEvent(new CustomEvent('kt:chrome'));
        });
      }
    });
  }

  function passwordModal() {
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
          render();
        });
      }
    });
  }

  /* ---------- Eventos ---------- */
  function bind() {
    rootEl.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-edit]')) { editModal(); return; }
      if (ev.target.closest('[data-password]')) { passwordModal(); return; }
      if (ev.target.closest('[data-settings]')) { location.hash = '#/configuracoes'; return; }
      if (ev.target.closest('[data-export]')) {
        K.util.download(`kombitech-dados-${K.store.isoDay(new Date())}.json`, K.store.exportData(), 'application/json');
        K.toast('Dados exportados', 'Backup completo em JSON (LGPD · portabilidade).', 'success');
        return;
      }
      if (ev.target.closest('[data-logout]')) {
        const ok = await K.confirm({
          title: 'Sair da conta?',
          message: 'Você voltará para a tela de login.',
          detail: 'A rota em andamento fica salva e pode ser retomada ao entrar novamente.',
          confirmLabel: 'Sair',
          icon: 'logout'
        });
        if (!ok) return;
        K.store.logout();
        location.replace('index.html?logout=1');
      }
    });
  }

  function mount(container) {
    rootEl = container;
    container.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Perfil do motorista</h1>
          <p class="page-sub">Seus dados, o veículo escolar e as permissões de acesso ao painel.</p>
        </div>
        <div class="page-actions">
          <span class="badge ${K.store.settings().demoMode ? 'b-amber' : 'b-green'}">${K.store.settings().demoMode ? 'Modo demonstração' : 'GPS real'}</span>
        </div>
      </div>
      <div id="profileBody" class="stack" style="gap:16px"></div>`;
    render();
  }

  K.views = K.views || {};
  K.views.perfil = {
    mount,
    unmount() { rootEl = null; }
  };
})(window.KT);
