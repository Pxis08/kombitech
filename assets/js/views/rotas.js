/* ==========================================================================
   KombiTech — View: Rotas
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, icon, esc } = K;
  let rootEl = null;

  function estMinutes(route) {
    const km = K.store.estimateDistance(route);
    return Math.max(4, Math.round((km / 26) * 60));
  }

  function afternoonBadge(status) {
    if (status === 'picked') return `<span class="badge b-green">${icon('van')}Embarcado</span>`;
    if (status === 'delivered') return `<span class="badge b-green">${icon('checkCircle')}Entregue</span>`;
    if (status === 'no_delivery') return `<span class="badge b-red">${icon('alert')}Não entregue</span>`;
    if (status === 'issue') return `<span class="badge b-red">${icon('alert')}Não embarcou</span>`;
    return `<span class="badge b-gray">${icon('clock')}Aguardando embarque</span>`;
  }

  function routeCard(route) {
    const active = route.id === K.store.activeRoute().id;
    const stats = K.store.routeStats(route);
    const students = K.store.routeStudents(route);
    const running = K.engine.getState().active && active;
    return `
      <button class="card route-card ${active ? 'active' : ''}" data-route="${route.id}">
        <div class="row-between" style="align-items:flex-start">
          <div class="row" style="gap:11px;min-width:0">
            <span class="stat-ico ${route.shift === 'morning' ? '' : 'amber'}" style="width:38px;height:38px;border-radius:11px">
              ${icon(route.shift === 'morning' ? 'route' : 'van')}
            </span>
            <div style="min-width:0">
              <div class="strong" style="font-size:13.5px">${esc(route.name)}</div>
              <div class="tiny muted">Saída ${esc(route.time)} · ${students.length} alunos</div>
            </div>
          </div>
          ${active
            ? `<span class="badge ${running ? 'b-blue' : 'b-green'}">${running ? 'Em uso' : 'Ativa'}</span>`
            : '<span class="badge b-gray">Selecionar</span>'}
        </div>
        <div class="progress progress-sm" style="margin-top:12px"><div class="progress-fill ${stats.progress >= 100 ? 'green' : ''}" style="width:${stats.progress}%"></div></div>
        <div class="row-between tiny muted" style="margin-top:6px">
          <span>${route.shift === 'afternoon' ? `${stats.delivered} de ${stats.total} entregues` : `${stats.done} de ${stats.total} confirmados`}</span>
          <span>${K.fmt.km(K.store.estimateDistance(route), 1)}</span>
        </div>
      </button>`;
  }

  function stopsEditor(route) {
    const st = K.engine.getState();
    const running = st.active && st.route && st.route.id === route.id;
    const list = K.store.routeStudents(route);
    const afternoon = route.shift === 'afternoon';
    if (!list.length) {
      return `<div class="empty"><div class="empty-ico">${icon('users')}</div><h4>Nenhum aluno nesta rota</h4><p>Adicione alunos pela lista ao lado para montar a sequência de paradas.</p></div>`;
    }
    return list.map((s, i) => {
      const done = afternoon
        ? (s.status === 'delivered' || s.status === 'no_delivery' || s.status === 'issue')
        : s.status === 'picked';
      const cls = done ? 'done' : s.status === 'next' ? 'active' : s.status === 'issue' ? 'issue' : '';
      return `
      <div class="stop ${cls}" data-stop="${s.id}">
        <div class="stop-idx">${done ? icon('check') : i + 1}</div>
        <div class="stop-main">
          <div class="stop-name">${esc(s.name)}</div>
          <div class="stop-addr">${esc(s.address)}, ${esc(s.number)} · ${esc(s.district)}</div>
        </div>
        <div class="stop-side">
          ${afternoon ? afternoonBadge(s.status) : K.statusBadge(s.status)}
          ${running ? '' : `
            <div class="row" style="gap:2px;margin-top:2px">
              <button class="icon-btn" style="width:26px;height:26px" data-up="${s.id}" aria-label="Subir ${esc(s.name)}" ${i === 0 ? 'disabled' : ''}>${icon('arrowUp')}</button>
              <button class="icon-btn" style="width:26px;height:26px" data-down="${s.id}" aria-label="Descer ${esc(s.name)}" ${i === list.length - 1 ? 'disabled' : ''}>${icon('arrowDown')}</button>
              <button class="icon-btn danger" style="width:26px;height:26px" data-remove="${s.id}" aria-label="Remover ${esc(s.name)}">${icon('x')}</button>
            </div>`}
        </div>
      </div>`;
    }).join('');
  }

  function availableStudents(route) {
    return K.store.students().filter((s) => !route.studentIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function trafficPanel(route) {
    const incidents = K.store.trafficIncidents();
    const base = K.store.driver().base;
    const school = K.store.get().school;
    const list = K.store.routeStudents(route);
    const optimized = K.services.optimizeOrder(base, list);
    const optimizedKm = K.geo.pathDistance([base].concat(optimized).concat([school])) / 1000;
    const currentKm = K.store.estimateDistance(route);
    const saving = Math.max(0, currentKm - optimizedKm);
    const running = K.engine.isActive();
    const severity = {
      high: { label: 'Alto', cls: 'b-red', icon: 'alert' },
      medium: { label: 'Médio', cls: 'b-amber', icon: 'alert' },
      low: { label: 'Baixo', cls: 'b-gray', icon: 'info' }
    };
    return `
      <div class="traffic-head">
        <div class="row" style="gap:10px;min-width:0">
          <span class="stat-ico amber" style="width:36px;height:36px;border-radius:10px">${icon('alert')}</span>
          <div>
            <div class="strong">Trânsito e rotas mais rápidas</div>
            <div class="tiny muted">Desvios, obras e condições da via monitorados para hoje</div>
          </div>
        </div>
        <span class="badge ${incidents.length ? 'b-amber' : 'b-green'}">${incidents.length ? incidents.length + ' imprevisto(s)' : 'Vias livres'}</span>
      </div>
      <div class="traffic-grid">
        <div class="traffic-fastest">
          <div class="row-between">
            <div>
              <div class="tiny muted">Rota mais rápida estimada</div>
              <div class="traffic-fastest-km">${K.fmt.km(optimizedKm, 1)} <span>· ${K.fmt.duration(Math.max(4, Math.round((optimizedKm / 26) * 60)))}</span></div>
            </div>
            <span class="badge ${saving > 0.2 ? 'b-green' : 'b-gray'}">${saving > 0.2 ? 'Economia de ' + K.fmt.km(saving, 1) : 'Ordem atual'}</span>
          </div>
          <div class="tiny muted" style="margin-top:8px">${running ? 'A rota está em andamento. O desvio será considerado nas próximas paradas.' : 'Aplicar a ordem otimizada antes de sair para reduzir tempo e distância.'}</div>
          <button class="btn btn-soft btn-sm" style="margin-top:10px" data-fastest ${running ? 'disabled' : ''}>${icon('bolt')}Aplicar rota mais rápida</button>
        </div>
        <div class="traffic-list">
          ${incidents.length ? incidents.map((t) => {
            const sev = severity[t.severity] || severity.medium;
            return `
              <div class="traffic-item">
                <span class="traffic-dot ${t.severity || 'medium'}"></span>
                <div class="grow" style="min-width:0">
                  <div class="row-between" style="align-items:flex-start"><div class="strong" style="font-size:12.5px">${esc(t.title)}</div><span class="badge ${sev.cls}">${sev.label}</span></div>
                  <div class="tiny muted">${esc(t.area)} · +${t.delayMin} min · ${esc(t.description)}</div>
                </div>
                <div class="traffic-actions">
                  ${running
                    ? `<button class="btn btn-ghost btn-xs" data-alert-traffic="${t.id}">${icon('bell')}Avisar</button>`
                    : `<button class="btn btn-soft btn-xs" data-avoid="${t.id}">${icon('route')}Desviar</button>`}
                </div>
              </div>`;
          }).join('') : `<div class="traffic-empty">${icon('checkCircle')}<span>Nenhum imprevisto ativo. A rota segue pelas vias planejadas.</span></div>`}
        </div>
      </div>`;
  }

  /* Avisa somente as famílias dos alunos da rota ativa (minimização de dados). */
  function guardiansForRoute(route) {
    if (!route) return [];
    const studentIds = new Set(K.store.routeStudents(route).map((s) => s.id));
    return K.store.guardians().filter((g) => (g.studentIds || []).some((id) => studentIds.has(id)));
  }

  function applyOptimization(route, notify) {
    if (K.engine.isActive()) { K.toast('Rota em andamento', 'Não é possível reordenar durante a rota.', 'warn'); return false; }
    const list = K.store.routeStudents(route);
    if (list.length < 2) { K.toast('Poucas paradas', 'Adicione ao menos dois alunos para otimizar.', 'info'); return false; }
    const base = K.store.driver().base;
    const ordered = K.services.optimizeOrder(base, list);
    K.store.setRouteOrder(route.id, ordered.map((s) => s.id));
    K.store.activateRoute(route.id);
    if (notify) {
      guardiansForRoute(route).forEach((g) => {
        if (g.preferences && g.preferences.notifyRoute === false) return;
        K.store.pushNotification({
          audience: 'guardian',
          guardianId: g.id,
          type: 'route',
          title: 'Rota otimizada',
          text: 'A ordem das paradas foi ajustada para o trajeto mais rápido. Os horários podem variar alguns minutos.'
        });
      });
    }
    K.toast('Ordem otimizada', 'Paradas reordenadas pelo trajeto mais curto a partir da garagem.', 'success');
    render();
    document.dispatchEvent(new CustomEvent('kt:chrome'));
    return true;
  }

  function notifyTraffic(t) {
    const route = K.store.activeRoute();
    guardiansForRoute(route).forEach((g) => {
      if (g.preferences && g.preferences.notifyHazard === false) return;
      K.store.pushNotification({
        audience: 'guardian',
        guardianId: g.id,
        type: 'hazard',
        title: 'Atenção na rota',
        text: `O motorista está lidando com ${t.title} em ${t.area}. Pode haver atraso de até ${t.delayMin} minutos.`
      });
    });
    K.toast('Responsáveis avisados', 'O aviso de trânsito foi enviado pelo canal seguro.', 'success');
    document.dispatchEvent(new CustomEvent('kt:chrome'));
  }

  function render() {
    if (!rootEl) return;
    const st = K.engine.getState();
    const active = K.store.activeRoute();
    if (!active) return;
    const students = K.store.routeStudents(active);
    const stats = K.store.routeStats(active);
    const km = K.store.estimateDistance(active);
    const available = availableStudents(active);
    const running = st.active;

    const cardsEl = $('#routeCards');
    if (cardsEl) cardsEl.innerHTML = K.store.routes().map(routeCard).join('');

    const trafficEl = $('#trafficPanel');
    if (trafficEl) trafficEl.innerHTML = trafficPanel(active);

    const editorEl = $('#routeEditor');
    if (editorEl) editorEl.innerHTML = stopsEditor(active);

    const metaEl = $('#routeMeta');
    if (metaEl) {
      metaEl.innerHTML = `
        <div class="row-between" style="margin-bottom:4px">
          <div>
            <div class="strong" style="font-size:14px">${esc(active.name)}</div>
            <div class="tiny muted">${students.length} paradas · saída ${esc(active.time)}</div>
          </div>
          <span class="badge ${running ? (st.paused ? 'b-amber' : 'b-blue') : 'b-gray'}">${running ? (st.paused ? 'Pausada' : 'Em andamento') : active.status === 'done' ? 'Concluída' : 'Não iniciada'}</span>
        </div>
        <div class="progress progress-lg" style="margin:12px 0 6px"><div class="progress-fill ${stats.progress >= 100 ? 'green' : ''}" style="width:${stats.progress}%"></div></div>
        <div class="row-between tiny muted"><span>${active.shift === 'afternoon' ? `${stats.delivered}/${stats.total} entregues` : `${stats.done}/${stats.total} confirmados`}</span><span>${stats.progress}%</span></div>

        <div class="route-summary-grid">
          <div class="route-summary-item">
            <span class="tiny muted">Distância estimada</span>
            <b>${K.fmt.km(km, 1)}</b>
          </div>
          <div class="route-summary-item">
            <span class="tiny muted">Tempo estimado</span>
            <b>${K.fmt.duration(estMinutes(active))}</b>
          </div>
          <div class="route-summary-item">
            <span class="tiny muted">${active.shift === 'afternoon' ? 'Confirmação' : 'Raio de confirmação'}</span>
            <b>${active.shift === 'afternoon' ? 'Manual' : K.store.settings().proximity + ' m'}</b>
          </div>
          <div class="route-summary-item">
            <span class="tiny muted">${active.shift === 'afternoon' ? 'Origem' : 'Escola destino'}</span>
            <b style="font-size:12px">${esc(K.store.get().school.name)}</b>
          </div>
        </div>

        <div class="notice ${K.store.settings().demoMode ? 'warn' : ''}" style="margin-top:14px;font-size:11.5px">
          ${icon(K.store.settings().demoMode ? 'bolt' : 'locate')}
          <div>${active.shift === 'afternoon'
            ? `<b>${K.store.settings().demoMode ? 'Modo demonstração ativo.' : 'GPS real ativo.'}</b> O trajeto começa na escola. Cada embarque e cada entrega são confirmados manualmente pelo motorista; a localização da van apenas sugere a chegada.`
            : K.store.settings().demoMode
              ? '<b>Modo demonstração ativo.</b> Ao iniciar, a perua percorre o trajeto simulado e os embarques são confirmados por proximidade.'
              : '<b>GPS real ativo.</b> A localização do dispositivo será usada para confirmar embarques por proximidade.'}</div>
        </div>

        <div class="stack" style="gap:8px;margin-top:14px">
          ${running
            ? `${st.paused
                ? `<button class="btn btn-primary btn-block" data-resume>${icon('play')}Retomar rota</button>`
                : `<button class="btn btn-ghost btn-block" data-pause>${icon('pause')}Pausar rota</button>`}
               ${active.shift === 'afternoon'
                 ? (st.next && st.next.status === 'picked'
                   ? `<button class="btn btn-success btn-block" data-dropoff="${st.next.id}">${icon('check')}Confirmar entrega</button>
                      <button class="btn btn-ghost btn-block" data-nodelivery="${st.next.id}">${icon('alert')}Entrega não realizada</button>`
                   : `<button class="btn btn-success btn-block" data-confirm>${icon('userCheck')}Confirmar embarque</button>
                      <button class="btn btn-ghost btn-block" data-next>${icon('skip')}Não embarcou</button>`)
                 : `<button class="btn btn-success btn-block" data-confirm>${icon('check')}Confirmar embarque</button>`}
               <button class="btn btn-outline-danger btn-block" data-finish>${icon('stop')}Finalizar rota</button>`
            : `<button class="btn btn-primary btn-block" data-start>${icon('play')}Iniciar rota</button>
               <button class="btn btn-ghost btn-block" data-open-map>${icon('map')}Abrir mapa ao vivo</button>`}
        </div>`;
    }

    const addEl = $('#routeAdd');
    if (addEl) {
      addEl.innerHTML = available.length
        ? `<select class="select" id="addStudentSelect" aria-label="Aluno para adicionar">
             <option value="">Adicionar aluno à rota...</option>
             ${available.map((s) => `<option value="${s.id}">${esc(s.name)} · ${esc(s.district)}</option>`).join('')}
           </select>
           <button class="btn btn-soft" data-add-student>${icon('plus')}</button>`
        : `<div class="hint" style="padding:6px 2px">Todos os alunos cadastrados já estão nesta rota.</div>`;
    }
  }

  function mount(container) {
    rootEl = container;
    const active = K.store.activeRoute();
    container.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Rotas</h1>
          <p class="page-sub">Defina a ordem das paradas, otimize o trajeto e inicie a rota. A ordem pode ser ajustada manualmente a qualquer momento antes da saída.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" data-optimize>${icon('bolt')}Otimizar ordem</button>
          <button class="btn btn-primary" data-open-map>${icon('map')}Mapa ao vivo</button>
        </div>
      </div>

      <div class="route-cards" id="routeCards"></div>

      <section class="card traffic-panel" id="trafficPanel"></section>

      <div class="dash-grid" style="grid-template-columns:minmax(0,1.5fr) minmax(300px,.85fr);align-items:start">
        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">${icon('route')}Sequência de paradas</div>
              <div class="panel-sub">Arraste pelos botões para reordenar · ${active ? esc(active.name) : ''}</div>
            </div>
            <span class="badge b-gray">${active ? K.store.routeStudents(active).length : 0} paradas</span>
          </div>
          <div class="panel-body">
            <div id="routeEditor" class="stack" style="gap:4px"></div>
            <hr class="divider">
            <div class="field">
              <label class="label">Adicionar aluno</label>
              <div class="row" id="routeAdd" style="gap:8px"></div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">${icon('nav')}Resumo da rota</div>
              <div class="panel-sub">Estimativas antes de sair</div>
            </div>
          </div>
          <div class="panel-body" id="routeMeta"></div>
        </section>
      </div>`;

    render();
    bind();
  }

  function bind() {
    rootEl.addEventListener('click', async (ev) => {
      const routeBtn = ev.target.closest('[data-route]');
      if (routeBtn) {
        const id = routeBtn.getAttribute('data-route');
        if (id === K.store.activeRoute().id) return;
        if (K.engine.isActive()) {
          K.toast('Rota em andamento', 'Finalize ou pause a rota atual antes de trocar de rota.', 'warn');
          return;
        }
        K.store.activateRoute(id);
        const r = K.store.route(id);
        K.toast('Rota ativada', `${r.name} · ${K.store.routeStudents(r).length} alunos.`, 'success');
        render();
        return;
      }

      if (ev.target.closest('[data-optimize]')) {
        applyOptimization(K.store.activeRoute(), true);
        return;
      }

      if (ev.target.closest('[data-fastest]')) {
        applyOptimization(K.store.activeRoute(), true);
        return;
      }

      const avoid = ev.target.closest('[data-avoid]');
      if (avoid) {
        const t = K.store.trafficIncidents().find((x) => x.id === avoid.getAttribute('data-avoid'));
        if (!t) return;
        const ok = await K.confirm({
          title: 'Desviar deste ponto?',
          message: `${t.title} em ${t.area}.`,
          detail: 'A ordem das paradas será recalculada pelo trajeto mais rápido e os responsáveis serão avisados.',
          confirmLabel: 'Aplicar desvio',
          icon: 'route'
        });
        if (!ok) return;
        const route = K.store.activeRoute();
        K.store.resolveTrafficIncident(t.id, guardiansForRoute(route).map((g) => g.id));
        applyOptimization(route, false);
        return;
      }

      const alertTraffic = ev.target.closest('[data-alert-traffic]');
      if (alertTraffic) {
        const t = K.store.trafficIncidents().find((x) => x.id === alertTraffic.getAttribute('data-alert-traffic'));
        if (t) notifyTraffic(t);
        return;
      }

      const up = ev.target.closest('[data-up]');
      const down = ev.target.closest('[data-down]');
      if (up || down) {
        const route = K.store.activeRoute();
        const ids = route.studentIds.slice();
        const id = (up || down).getAttribute(up ? 'data-up' : 'data-down');
        const index = ids.indexOf(id);
        const target = up ? index - 1 : index + 1;
        if (index < 0 || target < 0 || target >= ids.length) return;
        ids.splice(index, 1);
        ids.splice(target, 0, id);
        K.store.setRouteOrder(route.id, ids);
        render();
        return;
      }

      const remove = ev.target.closest('[data-remove]');
      if (remove) {
        if (K.engine.isActive()) { K.toast('Rota em andamento', 'Não é possível remover alunos durante a rota.', 'warn'); return; }
        const id = remove.getAttribute('data-remove');
        const s = K.store.student(id);
        const ok = await K.confirm({
          title: 'Remover da rota?',
          message: `${s.name} continuará cadastrado, mas não fará parte desta rota.`,
          confirmLabel: 'Remover',
          icon: 'x',
          danger: true
        });
        if (ok) {
          K.store.removeStudentFromRoute(K.store.activeRoute().id, id);
          render();
        }
        return;
      }

      if (ev.target.closest('[data-add-student]')) {
        const select = $('#addStudentSelect');
        if (!select || !select.value) { K.toast('Selecione um aluno', 'Escolha o aluno que deseja adicionar à rota.', 'info'); return; }
        const id = select.value;
        const route = K.store.activeRoute();
        K.store.addStudentToRoute(route.id, id);
        K.store.activateRoute(route.id);
        K.toast('Aluno adicionado', `${K.store.student(id).name} entrou na rota.`, 'success');
        render();
        return;
      }

      if (ev.target.closest('[data-start]')) { await K.actions.start(); render(); return; }
      if (ev.target.closest('[data-pause]')) { K.actions.pause(); render(); return; }
      if (ev.target.closest('[data-resume]')) { K.actions.resume(); render(); return; }
      if (ev.target.closest('[data-finish]')) { await K.actions.finish(); render(); return; }
      if (ev.target.closest('[data-confirm]')) { K.actions.confirmPick(); render(); return; }
      const drop = ev.target.closest('[data-dropoff]');
      if (drop) { K.actions.confirmDropOff(drop.getAttribute('data-dropoff')); render(); return; }
      const noDelivery = ev.target.closest('[data-nodelivery]');
      if (noDelivery) { await K.actions.failDelivery(noDelivery.getAttribute('data-nodelivery')); render(); return; }
      if (ev.target.closest('[data-next]')) { await K.actions.skip(); render(); return; }
      if (ev.target.closest('[data-open-map]')) { location.hash = '#/mapa'; }
    });
  }

  K.views = K.views || {};
  K.views.rotas = {
    mount,
    unmount() { rootEl = null; },
    onRoute(type) { if (type !== 'move') render(); }
  };
})(window.KT);
