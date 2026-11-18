/* ==========================================================================
   KombiTech — Shell, navegação e orquestração da aplicação
   Perfis: motorista e responsável (rotas, permissões e navegação próprias)
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, $$, icon, esc } = K;
  let currentName = 'inicio';
  let currentParams = new URLSearchParams();
  let mounted = null;
  let routeUnsub = null;
  let activityTimer = 0;
  let session = null;
  let isGuardian = false;
  let guardian = null;

  const DRIVER_META = {
    inicio: { title: 'Início', sub: 'Visão geral da rota de hoje', icon: 'home' },
    alunos: { title: 'Alunos', sub: 'Cadastro e gestão dos passageiros', icon: 'users' },
    rotas: { title: 'Rotas', sub: 'Sequência de paradas, trânsito e otimização', icon: 'route' },
    mapa: { title: 'Mapa ao vivo', sub: 'Acompanhamento em tempo real', icon: 'map' },
    mensagens: { title: 'Mensagens', sub: 'Conversas com os responsáveis', icon: 'message' },
    calendario: { title: 'Calendário', sub: 'Feriados, eventos e compromissos escolares', icon: 'calendar' },
    relatorios: { title: 'Relatórios', sub: 'Indicadores, histórico e desempenho', icon: 'chart' },
    configuracoes: { title: 'Configurações', sub: 'Rota, privacidade e integrações', icon: 'settings' },
    perfil: { title: 'Perfil do motorista', sub: 'Seus dados e segurança da conta', icon: 'user' }
  };

  const GUARDIAN_META = {
    inicio: { title: 'Início', sub: 'Acompanhe seu filho em tempo real', icon: 'home' },
    mapa: { title: 'Acompanhar rota', sub: 'Localização da van e próximo destino', icon: 'map' },
    mensagens: { title: 'Conversas', sub: 'Fale diretamente com o motorista', icon: 'message' },
    notificacoes: { title: 'Notificações', sub: 'Chegadas, rota, segurança e van', icon: 'bell' },
    perfil: { title: 'Perfil do responsável', sub: 'Seus dados, filho e preferências', icon: 'user' }
  };

  const DRIVER_NAV = [
    { group: 'Principal', items: ['inicio', 'alunos', 'rotas', 'mapa'] },
    { group: 'Comunicação', items: ['mensagens', 'calendario'] },
    { group: 'Análise', items: ['relatorios'] },
    { group: 'Conta', items: ['configuracoes', 'perfil'] }
  ];

  const GUARDIAN_NAV = [
    { group: 'Acompanhar', items: ['inicio', 'mapa', 'mensagens', 'notificacoes'] },
    { group: 'Conta', items: ['perfil'] }
  ];

  const DRIVER_MOBILE = ['inicio', 'alunos', 'mapa', 'rotas'];
  const GUARDIAN_MOBILE = ['inicio', 'mapa', 'mensagens', 'notificacoes', 'perfil'];

  function metaFor(name) {
    return (isGuardian ? GUARDIAN_META : DRIVER_META)[name]
      || (isGuardian ? GUARDIAN_META.inicio : DRIVER_META.inicio);
  }

  function viewSet() {
    return isGuardian ? (K.guardianViews || {}) : K.views;
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
  }

  function routeSnapshot() {
    const route = K.store.activeRoute();
    const db = K.store.get() || {};
    const live = db.live || null;
    const stats = route
      ? K.store.routeStats(route)
      : { total: 0, picked: 0, issues: 0, waiting: 0, next: null, progress: 0 };
    return {
      route,
      live,
      stats,
      running: !!(route && route.status === 'running'),
      paused: !!(route && route.status === 'paused'),
      active: !!(route && (route.status === 'running' || route.status === 'paused'))
    };
  }

  function guardianChild() {
    const list = K.store.guardianChildren(guardian);
    return list.length ? list[0] : null;
  }

  function navBadge(name) {
    if (name === 'alunos') return `<span class="nav-badge" data-nav-badge="alunos">${K.store.students().length}</span>`;
    if (isGuardian && name === 'mensagens') {
      const n = K.store.unreadMessages('guardian', guardian.id);
      return n ? `<span class="nav-badge" data-nav-badge="mensagens">${n}</span>` : '<span class="nav-badge" data-nav-badge="mensagens" hidden>0</span>';
    }
    if (isGuardian && name === 'notificacoes') {
      const n = K.store.notificationsFor('guardian', guardian.id).filter((x) => !x.read).length;
      return n ? `<span class="nav-badge" data-nav-badge="notificacoes">${n}</span>` : '<span class="nav-badge" data-nav-badge="notificacoes" hidden>0</span>';
    }
    return '';
  }

  function notifMeta(n) {
    const type = n.type || 'info';
    if (type === 'school') return { icon: 'school', tone: 'green' };
    if (type === 'home') return { icon: 'home', tone: 'green' };
    if (type === 'route') return { icon: 'route', tone: 'blue' };
    if (type === 'hazard') return { icon: 'alert', tone: 'amber' };
    if (type === 'van') return { icon: 'van', tone: 'blue' };
    if (type === 'boarding') return { icon: 'users', tone: 'blue' };
    if (type === 'issue') return { icon: 'alert', tone: 'amber' };
    if (type === 'message') return { icon: 'message', tone: 'blue' };
    if (type === 'success') return { icon: 'checkCircle', tone: 'green' };
    if (type === 'warn') return { icon: 'alert', tone: 'amber' };
    return { icon: 'info', tone: '' };
  }

  function notificationRows(list) {
    return list.map((n) => {
      const m = notifMeta(n);
      return `
        <div class="list-row" style="align-items:flex-start">
          <div class="stat-ico ${m.tone}" style="width:34px;height:34px;border-radius:10px">${icon(m.icon)}</div>
          <div class="grow">
            <div class="list-title">${esc(n.title)}</div>
            <div class="list-sub" style="white-space:normal">${esc(n.text)}</div>
            <div class="tiny muted" style="margin-top:4px">${K.fmt.date(n.at)} · ${K.fmt.time(n.at)}</div>
          </div>
          ${n.read ? '' : '<span class="live-dot blue"></span>'}
        </div>`;
    }).join('');
  }

  function accountItems() {
    if (isGuardian) {
      return [
        { name: 'mensagens', label: 'Conversas', icon: 'message' },
        { name: 'notificacoes', label: 'Notificações', icon: 'bell' },
        { name: 'perfil', label: 'Perfil do responsável', icon: 'user' }
      ];
    }
    return [
      { name: 'mensagens', label: 'Mensagens', icon: 'message' },
      { name: 'calendario', label: 'Calendário', icon: 'calendar' },
      { name: 'relatorios', label: 'Relatórios', icon: 'chart' },
      { name: 'configuracoes', label: 'Configurações', icon: 'settings' },
      { name: 'perfil', label: 'Perfil do motorista', icon: 'user' }
    ];
  }

  /* ---------- Ações compartilhadas ---------- */
  K.actions = {
    async start() {
      await K.engine.start();
      refreshChrome();
    },
    pause() { K.engine.pause(); refreshChrome(); },
    resume() { K.engine.resume(); refreshChrome(); },
    async finish() {
      const st = K.engine.getState();
      if (!st.active) { K.toast('Nenhuma rota em andamento', 'Inicie a rota para poder finalizá-la.', 'info'); return; }
      const ok = await K.confirm({
        title: 'Finalizar a rota agora?',
        message: 'O trajeto será encerrado e gravado no histórico.',
        detail: st.shift === 'afternoon'
          ? `${st.stats.delivered} entrega(s) confirmada(s) · ${st.stats.noDelivery + st.stats.issues} ocorrência(s).`
          : `${st.stats.picked} de ${st.stats.total} alunos confirmados · ${st.stats.issues} ocorrência(s).`,
        confirmLabel: 'Finalizar rota',
        icon: 'stop'
      });
      if (ok) { K.engine.finish('manual'); refreshChrome(); }
    },
    confirmPick() {
      const ok = K.engine.confirmPick();
      if (ok) refreshChrome();
    },
    board(studentId) {
      const ok = K.engine.boardStudent(studentId);
      if (ok) refreshChrome();
    },
    confirmDropOff(studentId) {
      const ok = K.engine.confirmDropOff(studentId);
      if (ok) refreshChrome();
    },
    async failDelivery(studentId) {
      const s = K.store.student(studentId);
      if (!s) return;
      const ok = await K.confirm({
        title: 'Registrar entrega não realizada?',
        message: `${s.name} será marcado como "entrega não realizada".`,
        detail: 'Use quando não for possível entregar o aluno na residência. O responsável será avisado pelo aplicativo.',
        confirmLabel: 'Registrar ocorrência',
        danger: true,
        icon: 'alert'
      });
      if (ok) { K.engine.failDelivery(studentId); refreshChrome(); }
    },
    async skip() {
      const st = K.engine.getState();
      if (!st.next) return;
      const ok = await K.confirm({
        title: 'Pular este aluno?',
        message: `${st.next.name} será marcado com problema na coleta.`,
        detail: 'Use esta opção quando o aluno não estiver no local combinado. O responsável será avisado pelo aplicativo.',
        confirmLabel: 'Pular aluno',
        danger: true,
        icon: 'alert'
      });
      if (ok) { K.engine.skipCurrent(); refreshChrome(); }
    },
    async reset() {
      const ok = await K.confirm({
        title: 'Reiniciar a rota de hoje?',
        message: 'Os status dos alunos voltarão para "Aguardando".',
        detail: 'O histórico de rotas concluídas não será apagado.',
        confirmLabel: 'Reiniciar',
        icon: 'refresh'
      });
      if (ok) { K.engine.reset(); K.toast('Rota reiniciada', 'Status dos alunos redefinidos.', 'info'); refreshChrome(); }
    },
    openNotifications() {
      const role = isGuardian ? 'guardian' : 'driver';
      const id = isGuardian ? guardian.id : null;
      const list = K.store.notificationsFor(role, id);
      const body = list.length
        ? `<div class="stack">${notificationRows(list)}</div>`
        : `<div class="empty"><div class="empty-ico">${icon('bell')}</div><h4>Tudo em dia</h4><p>Você não tem novas notificações.</p></div>`;
      K.modal({
        title: 'Notificações',
        subtitle: isGuardian ? 'Chegadas, rota e segurança do seu filho' : 'Avisos da operação e da conta',
        icon: 'bell',
        body,
        size: 'sm',
        footer: `<button class="btn btn-ghost" data-modal-close>Fechar</button>`,
        onMount: () => {
          setTimeout(() => {
            K.store.markNotificationsRead(role, id);
            refreshChrome();
          }, 900);
        }
      });
    },
    openAccount() {
      const person = isGuardian ? guardian : K.store.driver();
      const child = isGuardian ? guardianChild() : null;
      const subtitle = isGuardian ? 'Conta da família' : 'Conta do motorista';
      const detail = isGuardian
        ? (child ? `Responsável por ${esc(child.name)}` : 'Nenhum aluno vinculado')
        : `${esc(K.store.driver().van.model)} · ${esc(K.store.driver().van.plate)}`;
      K.modal({
        title: subtitle,
        subtitle: 'Acesso rápido',
        icon: 'user',
        size: 'sm',
        body: `
          <div class="row" style="gap:12px;margin-bottom:16px">
            <div class="avatar lg photo">${esc(K.fmt.initials(person.name))}</div>
            <div class="grow">
              <div class="strong">${esc(person.name)}</div>
              <div class="small muted">${esc(person.email)}</div>
              <div class="tiny muted">${detail}</div>
            </div>
          </div>
          <div class="stack" style="gap:8px">
            <button class="btn btn-ghost btn-block" data-go="perfil">${icon('user')}Ver perfil</button>
            ${isGuardian
              ? `<button class="btn btn-ghost btn-block" data-go="mensagens">${icon('message')}Conversar com o motorista</button>
                 <button class="btn btn-ghost btn-block" data-go="notificacoes">${icon('bell')}Notificações</button>`
              : `<button class="btn btn-ghost btn-block" data-go="mensagens">${icon('message')}Mensagens</button>
                 <button class="btn btn-ghost btn-block" data-go="configuracoes">${icon('settings')}Configurações</button>`}
            <button class="btn btn-outline-danger btn-block" data-logout>${icon('logout')}Sair da conta</button>
          </div>`,
        onMount: (el, close) => {
          $$('[data-go]', el).forEach((b) => b.addEventListener('click', () => {
            close(); location.hash = '#/' + b.getAttribute('data-go');
          }));
          el.querySelector('[data-logout]').addEventListener('click', () => { close(); doLogout(); });
        }
      });
    },
    openMore() {
      const items = accountItems();
      K.modal({
        title: 'Mais opções',
        subtitle: isGuardian ? 'Acompanhamento e conta' : 'Navegação e conta',
        size: 'sm',
        body: `<div class="stack" style="gap:8px">
          ${items.map((i) => `<button class="btn btn-ghost btn-block" style="justify-content:flex-start" data-go="${i.name}">${icon(i.icon)}${i.label}</button>`).join('')}
          <hr class="divider" style="margin:8px 0">
          <button class="btn btn-outline-danger btn-block" data-logout>${icon('logout')}Sair da conta</button>
        </div>`,
        onMount: (el, close) => {
          $$('[data-go]', el).forEach((b) => b.addEventListener('click', () => {
            close(); location.hash = '#/' + b.getAttribute('data-go');
          }));
          el.querySelector('[data-logout]').addEventListener('click', () => { close(); doLogout(); });
        }
      });
    }
  };

  /* ---------- Shell ---------- */
  function buildShell() {
    session = K.store.session();
    isGuardian = !!(session && session.role === 'guardian');
    guardian = isGuardian ? K.store.guardian(session.guardianId) : null;
    const person = isGuardian ? guardian : K.store.driver();
    const nav = isGuardian ? GUARDIAN_NAV : DRIVER_NAV;
    const mobile = isGuardian ? GUARDIAN_MOBILE : DRIVER_MOBILE;
    const child = isGuardian ? guardianChild() : null;
    const personRole = isGuardian
      ? `Responsável${child ? ' · ' + child.name : ''}`
      : `${K.store.driver().van.model} · ${K.store.driver().van.plate}`;

    const app = document.getElementById('app');
    app.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="brand" role="button" tabindex="0" data-nav="inicio">
          <div class="brand-mark">${K.logoSvg()}</div>
          <div class="brand-text">
            <div class="brand-name">Kombi<span>Tech</span></div>
            <div class="brand-tag">Transporte escolar</div>
          </div>
        </div>
        ${nav.map((group) => `
          <div class="nav-label">${group.group}</div>
          <nav class="nav">
            ${group.items.map((name) => {
              const meta = metaFor(name);
              return `<a class="nav-item" data-nav="${name}" href="#/${name}">${icon(meta.icon)}<span>${meta.title}</span>${navBadge(name)}</a>`;
            }).join('')}
          </nav>
        `).join('')}
        <div class="sidebar-spacer"></div>
        <div class="side-mini" id="sideMini"></div>
        <div class="driver-card" id="driverCard" data-go-account>
          <div class="avatar">${esc(K.fmt.initials(person.name))}</div>
          <div class="grow" style="min-width:0">
            <div class="driver-name">${esc(person.name)}</div>
            <div class="driver-role">${esc(personRole)}</div>
          </div>
          <button class="icon-btn on-dark" data-logout aria-label="Sair">${icon('logout')}</button>
        </div>
      </aside>
      <div class="drawer-overlay" id="drawerOverlay"></div>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn mobile-only" id="menuBtn" aria-label="Abrir menu">${icon('menu')}</button>
          <div class="grow" style="min-width:0">
            <div class="topbar-title" id="topbarTitle">Início</div>
            <div class="topbar-sub" id="topbarSub">${isGuardian ? GUARDIAN_META.inicio.sub : DRIVER_META.inicio.sub}</div>
          </div>
          <div class="topbar-right">
            <button class="pill" id="modeChip" data-go-settings></button>
            <button class="pill" id="routePill" data-go-map></button>
            <button class="icon-btn bordered" id="notifBtn" aria-label="Notificações">${icon('bell')}<span class="dot-badge" id="notifDot"></span></button>
            <button class="avatar avatar-btn" id="avatarBtn" aria-label="Conta">${esc(K.fmt.initials(person.name))}</button>
          </div>
        </header>
        <main class="content"><div id="view" class="view"></div></main>
      </div>
      <nav class="mobile-nav" aria-label="Navegação principal">
        <div class="mobile-nav-inner">
          ${mobile.map((name) => `
            <button class="mnav-item" data-nav="${name}">${icon(metaFor(name).icon)}<span>${name === 'inicio' ? 'Início' : metaFor(name).title}</span></button>
          `).join('')}
          ${isGuardian ? '' : `<button class="mnav-item" data-more>${icon('more')}<span>Mais</span></button>`}
        </div>
      </nav>
      <div class="mobile-routebar" id="mobileRoute"></div>`;

    wireShell();
    refreshChrome();
  }

  function wireShell() {
    document.addEventListener('click', (ev) => {
      const nav = ev.target.closest('[data-nav]');
      if (nav) {
        ev.preventDefault();
        location.hash = '#/' + nav.getAttribute('data-nav');
        document.body.classList.remove('drawer-open');
        return;
      }
      if (ev.target.closest('[data-more]')) { K.actions.openMore(); return; }
      if (ev.target.closest('[data-logout]')) { ev.preventDefault(); doLogout(); return; }
      if (ev.target.closest('[data-go-account]')) { K.actions.openAccount(); return; }
      if (ev.target.closest('[data-go-settings]')) { location.hash = isGuardian ? '#/perfil' : '#/configuracoes'; return; }
      if (ev.target.closest('[data-go-map]')) { location.hash = '#/mapa'; return; }
    });

    $('#menuBtn').addEventListener('click', () => document.body.classList.add('drawer-open'));
    $('#drawerOverlay').addEventListener('click', () => document.body.classList.remove('drawer-open'));
    $('#notifBtn').addEventListener('click', K.actions.openNotifications);
    $('#avatarBtn').addEventListener('click', K.actions.openAccount);

    const mobileRoute = $('#mobileRoute');
    mobileRoute.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'start') await K.actions.start();
      else if (act === 'pause') K.actions.pause();
      else if (act === 'resume') K.actions.resume();
      else if (act === 'finish') await K.actions.finish();
      else if (act === 'confirm') K.actions.confirmPick();
      else if (act === 'open') location.hash = '#/mapa';
      refreshChrome();
    });
  }

  function doLogout() {
    K.store.logout();
    location.replace('index.html?logout=1');
  }

  /* ---------- Chrome dinâmico ---------- */
  function refreshChrome() {
    if (!K.store.get()) return;
    session = K.store.session();
    isGuardian = !!(session && session.role === 'guardian');
    guardian = isGuardian ? K.store.guardian(session.guardianId) : null;
    const settings = K.store.settings();

    /* Topbar */
    const meta = metaFor(currentName);
    const titleEl = $('#topbarTitle');
    const subEl = $('#topbarSub');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.sub;

    const modeChip = $('#modeChip');
    if (modeChip) {
      if (isGuardian) {
        modeChip.className = 'pill ' + (settings.demoMode ? 'demo-chip' : 'gps-chip');
        modeChip.innerHTML = settings.demoMode
          ? `${icon('bolt')}<span>Demonstração</span>`
          : `${icon('locate')}<span>Acompanhamento</span>`;
        modeChip.title = settings.demoMode
          ? 'Posição simulada para demonstração — não é GPS real'
          : 'Acompanhamento em tempo real';
      } else {
        modeChip.className = 'pill ' + (settings.demoMode ? 'demo-chip' : 'gps-chip');
        modeChip.innerHTML = settings.demoMode
          ? `${icon('bolt')}<span>Demonstração</span>`
          : `${icon('locate')}<span>GPS real</span>`;
        modeChip.title = settings.demoMode ? 'Localização simulada — clique para alterar' : 'Usando localização real do dispositivo';
      }
    }

    const routePill = $('#routePill');
    if (routePill) {
      const rs = routeSnapshot();
      if (isGuardian) {
        if (rs.running) routePill.innerHTML = `<span class="live-dot"></span><span>Em rota</span>`;
        else if (rs.paused) routePill.innerHTML = `<span class="live-dot amber"></span><span>Pausada</span>`;
        else routePill.innerHTML = `<span class="live-dot gray"></span><span>Rota não iniciada</span>`;
        routePill.className = 'pill ' + (rs.running ? 'pill-live' : rs.paused ? 'pill-paused' : 'pill-idle');
      } else {
        const st = K.engine.getState();
        if (st.active && !st.paused) routePill.innerHTML = `<span class="live-dot"></span><span>Em rota</span>`;
        else if (st.active && st.paused) routePill.innerHTML = `<span class="live-dot amber"></span><span>Pausada</span>`;
        else routePill.innerHTML = `<span class="live-dot gray"></span><span>Rota não iniciada</span>`;
        routePill.className = 'pill ' + (st.active && !st.paused ? 'pill-live' : st.active ? 'pill-paused' : 'pill-idle');
      }
      routePill.title = 'Abrir mapa ao vivo';
    }

    const notifDot = $('#notifDot');
    if (notifDot) {
      const unread = isGuardian
        ? K.store.notificationsFor('guardian', guardian.id).filter((n) => !n.read).length
        : K.store.notificationsFor('driver').filter((n) => !n.read).length;
      notifDot.style.display = unread ? 'block' : 'none';
    }

    /* Contadores da navegação */
    $$('[data-nav-badge]').forEach((el) => {
      const name = el.getAttribute('data-nav-badge');
      let n = 0;
      if (name === 'alunos') n = K.store.students().length;
      else if (isGuardian && name === 'mensagens') n = K.store.unreadMessages('guardian', guardian.id);
      else if (isGuardian && name === 'notificacoes') n = K.store.notificationsFor('guardian', guardian.id).filter((x) => !x.read).length;
      el.textContent = n;
      el.hidden = !n;
    });

    /* Navegação ativa */
    $$('[data-nav]').forEach((el) => {
      const name = el.getAttribute('data-nav');
      el.classList.toggle('active', name === currentName);
    });
    $$('.mnav-item').forEach((el) => {
      const name = el.getAttribute('data-nav');
      el.classList.toggle('active', name === currentName);
    });

    /* Mini card lateral */
    const mini = $('#sideMini');
    if (mini) {
      if (isGuardian) {
        const rs = routeSnapshot();
        const child = guardianChild();
        const next = rs.route ? K.store.routeStudents(rs.route).find((s) => s.status === 'next') : null;
        const progress = rs.route ? K.store.routeStats(rs.route).progress : 0;
        const targetName = child ? child.name : 'Nenhum aluno vinculado';
        const targetAddr = !child
          ? 'Fale com o motorista para vincular'
          : child.status === 'picked'
            ? (rs.route && rs.route.shift === 'afternoon' ? 'A bordo · indo para casa' : 'A bordo · indo para a escola')
            : rs.running && next && next.id === child.id
              ? 'Sua parada é a próxima'
              : rs.running
                ? 'Aguardando a chegada da van'
                : rs.route
                  ? `Saída prevista às ${rs.route.time}`
                  : 'Sem rota programada';
        mini.innerHTML = `
          <div class="side-mini-top">
            <span class="side-mini-label">${rs.active ? (rs.paused ? 'Acompanhamento pausado' : 'Acompanhamento ao vivo') : 'Próxima rota'}</span>
            ${rs.active ? `<span class="live-dot ${rs.paused ? 'amber' : ''}"></span>` : `<span class="badge b-navy" style="background:rgba(255,255,255,.08);color:#9CC4FF">${rs.route ? esc(rs.route.time) : '--:--'}</span>`}
          </div>
          <div class="side-mini-name">${esc(targetName)}</div>
          <div class="side-mini-addr">${esc(targetAddr)}</div>
          <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="side-mini-foot">
            <span>${progress}% concluído</span>
            <span>${rs.stats.picked}/${rs.stats.total || 0} alunos</span>
          </div>`;
      } else {
        const st = K.engine.getState();
        const route = st.route;
        const next = st.next || (route ? K.store.routeStudents(route).find((s) => s.status === 'next') : null);
        const school = st.school;
        const progress = st.active ? st.stats.progress : (route ? K.store.routeStats(route).progress : 0);
        const targetName = next ? next.name : (st.allPicked && st.active ? (school ? school.name : 'Escola') : 'Nenhum aluno pendente');
        const targetAddr = next
          ? `${next.address}, ${next.number}`
          : (st.active ? 'Destino final da rota' : 'Inicie a rota para acompanhar');
        mini.innerHTML = `
          <div class="side-mini-top">
            <span class="side-mini-label">${st.active ? (st.paused ? 'Rota pausada' : 'Próxima parada') : 'Rota de hoje'}</span>
            ${st.active ? `<span class="live-dot ${st.paused ? 'amber' : ''}"></span>` : `<span class="badge b-navy" style="background:rgba(255,255,255,.08);color:#9CC4FF">${route ? esc(route.time) : '--:--'}</span>`}
          </div>
          <div class="side-mini-name">${esc(targetName)}</div>
          <div class="side-mini-addr">${esc(targetAddr)}</div>
          <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="side-mini-foot">
            <span>${progress}% concluído</span>
            <span>${st.stats.picked}/${st.stats.total || K.store.students().length} alunos</span>
          </div>`;
      }
    }

    /* Cartão de conta */
    const dc = $('#driverCard');
    if (dc) {
      const person = isGuardian ? guardian : K.store.driver();
      const child = isGuardian ? guardianChild() : null;
      const nameEl = dc.querySelector('.driver-name');
      const roleEl = dc.querySelector('.driver-role');
      if (nameEl) nameEl.textContent = person.name;
      if (roleEl) {
        roleEl.textContent = isGuardian
          ? `Responsável${child ? ' · ' + child.name : ''}`
          : `${K.store.driver().van.model} · ${K.store.driver().van.plate}`;
      }
    }

    renderMobileRoute();
  }

  function renderMobileRoute() {
    const el = $('#mobileRoute');
    if (!el) return;
    const show = currentName === 'inicio' || currentName === 'mapa';
    if (!show) {
      el.innerHTML = '';
      document.body.classList.remove('has-routebar');
      return;
    }
    document.body.classList.add('has-routebar');

    if (isGuardian) {
      const rs = routeSnapshot();
      const child = guardianChild();
      if (rs.active) {
        el.innerHTML = `
          <div class="mrb-main">
            <div class="mrb-label">${icon('locate')} ${rs.paused ? 'Acompanhamento pausado' : 'Acompanhamento ao vivo'}</div>
            <div class="mrb-name">${esc(child ? child.name : 'Rota em andamento')}</div>
            <div class="mrb-sub">${child && child.status === 'picked' ? 'A bordo · indo para o destino' : 'A van está a caminho do próximo ponto'}</div>
          </div>
          <div class="mrb-actions"><button class="btn btn-primary" data-act="open">${icon('map')}Ver mapa</button></div>`;
      } else {
        const route = rs.route;
        const students = route ? K.store.routeStudents(route).length : 0;
        el.innerHTML = `
          <div class="mrb-main">
            <div class="mrb-label">${icon('route')} Próxima rota</div>
            <div class="mrb-name">${esc(route ? route.name : 'Nenhuma rota')} · ${esc(route ? route.time : '--:--')}</div>
            <div class="mrb-sub">${students} alunos · ${route ? K.fmt.km(K.store.estimateDistance(route), 1) : '0 km'} estimados</div>
          </div>
          <div class="mrb-actions"><button class="btn btn-primary" data-act="open">${icon('map')}Acompanhar</button></div>`;
      }
      return;
    }

    const st = K.engine.getState();
    if (!st.active) {
      const route = st.route || K.store.activeRoute();
      const students = route ? K.store.routeStudents(route).length : 0;
      el.innerHTML = `
        <div class="mrb-main">
          <div class="mrb-label">${icon('route')} Rota de hoje</div>
          <div class="mrb-name">${esc(route ? route.name : 'Nenhuma rota')} · ${esc(route ? route.time : '--:--')}</div>
          <div class="mrb-sub">${students} alunos · ${K.fmt.km(K.store.estimateDistance(route), 1)} estimados</div>
        </div>
        <div class="mrb-actions"><button class="btn btn-primary" data-act="start">${icon('play')}Iniciar</button></div>`;
      return;
    }

    if (st.allPicked) {
      el.innerHTML = `
        <div class="mrb-main">
          <div class="mrb-label">${icon('school')} Todos a bordo</div>
          <div class="mrb-name">Indo para ${esc(st.school ? st.school.name : 'a escola')}</div>
          <div class="mrb-sub">${st.stats.picked} alunos confirmados</div>
        </div>
        <div class="mrb-actions">
          ${st.paused
            ? `<button class="btn btn-primary" data-act="resume">${icon('play')}Retomar</button>`
            : `<button class="btn btn-ghost btn-icon" data-act="pause" aria-label="Pausar">${icon('pause')}</button>`}
          <button class="btn btn-success" data-act="finish">${icon('check')}Finalizar</button>
        </div>`;
      return;
    }

    const next = st.next;
    const distance = next && st.van ? K.geo.haversine(st.van, next) : null;
    el.innerHTML = `
      <div class="mrb-main">
        <div class="mrb-label">${icon('nav')} ${st.paused ? 'Rota pausada' : 'Próximo destino'}</div>
        <div class="mrb-name">${esc(next ? next.name : '—')}</div>
        <div class="mrb-sub">${esc(next ? `${next.address}, ${next.number}` : '')}${distance ? ' · ' + K.fmt.distance(distance) : ''}</div>
      </div>
      <div class="mrb-actions">
        ${st.paused
          ? `<button class="btn btn-primary" data-act="resume">${icon('play')}Retomar</button>`
          : `<button class="btn btn-ghost btn-icon" data-act="pause" aria-label="Pausar">${icon('pause')}</button>
             <button class="btn btn-primary" data-act="confirm">${icon('check')}Confirmar</button>`}
      </div>`;
  }

  /* ---------- Roteamento ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [name, qs] = raw.split('?');
    return { name: name || 'inicio', params: new URLSearchParams(qs || '') };
  }

  function renderRoute() {
    const { name, params } = parseHash();
    const views = viewSet();
    const view = views[name] || views.inicio;
    if (!view) return;

    if (mounted && typeof mounted.unmount === 'function') {
      try { mounted.unmount(); } catch (e) { console.warn(e); }
    }
    if (routeUnsub) { routeUnsub(); routeUnsub = null; }

    currentName = views[name] ? name : 'inicio';
    currentParams = params;
    // Substitui o nó da view a cada navegação: listeners presos ao container
    // antigo são descartados junto com ele (evita handlers duplicados).
    const oldRoot = document.getElementById('view');
    const root = document.createElement('div');
    root.id = 'view';
    root.className = 'view view-enter';
    if (oldRoot) oldRoot.replaceWith(root);
    else document.querySelector('.content').appendChild(root);
    mounted = view;

    document.title = `${metaFor(currentName).title} · KombiTech`;
    refreshChrome();
    window.scrollTo(0, 0);

    try {
      view.mount(root, params);
    } catch (err) {
      console.error('[KombiTech] erro ao montar view', err);
      root.innerHTML = `<div class="panel"><div class="empty"><div class="empty-ico">${icon('alert')}</div><h4>Não foi possível abrir esta tela</h4><p>${esc(err.message || 'Erro inesperado')}</p></div></div>`;
    }
    refreshChrome();

    routeUnsub = K.engine.subscribe((type) => {
      if (typeof view.onRoute === 'function') {
        try { view.onRoute(type, K.engine.getState()); } catch (e) { console.warn(e); }
      }
    });
  }

  /* ---------- Segurança / sessão ---------- */
  function startSessionWatch() {
    document.addEventListener('pointerdown', markActivity, { passive: true });
    document.addEventListener('keydown', markActivity);
    document.addEventListener('wheel', markActivity, { passive: true });

    setInterval(() => {
      if (!K.store.session()) { location.replace('index.html?expired=1'); return; }
      if (K.store.isLocked()) {
        K.store.logout();
        location.replace('index.html?locked=1');
      }
    }, 30000);
  }

  function markActivity() {
    const now = Date.now();
    if (now - activityTimer > 8000) {
      activityTimer = now;
      K.store.touch();
    }
  }

  /* ---------- Boot ---------- */
  async function boot() {
    await K.store.ready();
    session = K.store.session();
    if (!session) { location.replace('index.html'); return; }
    isGuardian = session.role === 'guardian';
    if (K.store.isLocked()) {
      K.store.logout();
      location.replace('index.html?locked=1');
      return;
    }
    // O motorista restaura o motor de rota. O responsável apenas observa o
    // estado persistido, sem assumir o controle da rota.
    if (!isGuardian) await K.engine.restore();
    buildShell();
    startSessionWatch();

    if (!location.hash) {
      history.replaceState(null, '', '#/inicio');
    }
    window.addEventListener('hashchange', renderRoute);
    renderRoute();

    K.engine.subscribe(() => {
      refreshChrome();
    });
    document.addEventListener('kt:chrome', refreshChrome);
    setInterval(refreshChrome, 60000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshChrome();
    });
  }

  window.addEventListener('resize', K.util.debounce(() => {
    if (mounted && typeof mounted.onResize === 'function') mounted.onResize();
  }, 220));

  document.addEventListener('DOMContentLoaded', boot);
})(window.KT);
