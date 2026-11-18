/* ==========================================================================
   KombiTech — View: Mapa ao vivo
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, $$, icon, esc } = K;
  let rootEl = null;
  let mapView = null;
  let selectedId = null;
  let lastFitKey = '';

  function afternoonBadge(status) {
    if (status === 'picked') return `<span class="badge b-green">${icon('van')}Embarcado</span>`;
    if (status === 'delivered') return `<span class="badge b-green">${icon('checkCircle')}Entregue</span>`;
    if (status === 'no_delivery') return `<span class="badge b-red">${icon('alert')}Não entregue</span>`;
    if (status === 'issue') return `<span class="badge b-red">${icon('alert')}Não embarcou</span>`;
    return `<span class="badge b-gray">${icon('clock')}Aguardando embarque</span>`;
  }

  function sideHtml(st) {
    const route = st.route || K.store.activeRoute();
    const list = route ? K.store.routeStudents(route) : [];
    const selected = selectedId ? K.store.student(selectedId) : null;
    const stats = st.active ? st.stats : K.store.routeStats(route);
    const afternoon = !!(route && route.shift === 'afternoon');
    const next = st.next;

    let nextBlock = '';
    if (st.active && st.allFinal) {
      nextBlock = `
        <div class="map-next-name">${icon('checkCircle')}Rota concluída</div>
        <div class="map-next-addr">${stats.delivered} entregue(s) · ${stats.noDelivery + stats.issues} ocorrência(s)</div>`;
    } else if (st.active && afternoon && next) {
      nextBlock = next.status === 'picked'
        ? `<div class="map-next-name">${icon('home')}${esc(next.name)} · entrega</div>
           <div class="map-next-addr">${esc(next.address)}, ${esc(next.number)} — ${esc(next.district)}, ${esc(next.city)}</div>`
        : `<div class="map-next-name">${icon('school')}${esc(next.name)} · embarque</div>
           <div class="map-next-addr">${esc(st.school ? st.school.name + ' — ' + st.school.district : 'Escola')}</div>`;
    } else if (st.active && st.allPicked) {
      nextBlock = `
        <div class="map-next-name">${icon('school')}${esc(st.school ? st.school.name : 'Escola')}</div>
        <div class="map-next-addr">${esc(st.school ? st.school.address + ' — ' + st.school.district : 'Destino final')}</div>`;
    } else if (next) {
      nextBlock = `
        <div class="map-next-name">${icon('pin')}${esc(next.name)}</div>
        <div class="map-next-addr">${esc(next.address)}, ${esc(next.number)} — ${esc(next.district)}, ${esc(next.city)}</div>`;
    } else {
      nextBlock = `
        <div class="map-next-name">${icon('route')}${st.active ? 'Calculando destino…' : 'Rota não iniciada'}</div>
        <div class="map-next-addr">${st.active ? 'Aguardando posição' : 'Inicie a rota para acompanhar'}</div>`;
    }

    return `
      <div class="map-side-head">
        <div>
          <div class="panel-title">${icon('nav')}${afternoon ? 'Embarque e entrega' : 'Próxima parada'}</div>
          <div class="panel-sub">${esc(route ? route.name : 'Rota')} · ${esc(route ? route.time : '--:--')}</div>
        </div>
        <span class="badge ${st.active ? (st.paused ? 'b-amber' : 'b-blue') : 'b-gray'}">${st.active ? (st.paused ? 'Pausada' : 'Ao vivo') : 'Aguardando'}</span>
      </div>

      <div class="map-side-next">
        ${nextBlock}
        <div class="row" style="gap:14px;margin-top:10px;flex-wrap:wrap">
          <span class="tiny strong" style="display:flex;gap:5px;align-items:center">${icon('mapPin')}${st.van && next ? K.fmt.distance(K.geo.haversine(st.van, next)) : '—'}</span>
          <span class="tiny strong" style="display:flex;gap:5px;align-items:center">${icon('clock')}${st.etaMin != null ? Math.ceil(st.etaMin) + ' min' : '—'}</span>
          <span class="tiny strong" style="display:flex;gap:5px;align-items:center">${icon('users')}${afternoon ? `${stats.picked} a bordo · ${stats.delivered} entregues` : `${stats.picked}/${stats.total} a bordo`}</span>
        </div>
      </div>

      <div class="map-side-progress">
        <div class="row-between tiny" style="margin-bottom:6px">
          <span class="muted">Progresso</span>
          <b data-live="progressText">${st.active ? Math.round(st.progress) : stats.progress}%</b>
        </div>
        <div class="progress"><div class="progress-fill" id="mapProgress" style="width:${st.active ? st.progress : stats.progress}%"></div></div>
      </div>

      ${selected ? selectedCard(selected, st) : ''}

      <div class="map-side-list-head">
        <span class="tiny strong" style="text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">Paradas (${list.length})</span>
        <button class="btn btn-ghost btn-xs" data-fit>${icon('crosshair')}Enquadrar</button>
      </div>
      <div class="map-side-list" id="mapStopList">
        ${list.map((s, i) => {
          const done = afternoon
            ? (s.status === 'delivered' || s.status === 'no_delivery' || s.status === 'issue')
            : s.status === 'picked';
          return `
          <div class="stop ${s.status === 'next' ? 'active' : done ? 'done' : s.status === 'issue' ? 'issue' : ''} ${selectedId === s.id ? 'selected' : ''}" data-student="${s.id}">
            <div class="stop-idx">${done ? icon('check') : i + 1}</div>
            <div class="stop-main">
              <div class="stop-name">${esc(s.name)}</div>
              <div class="stop-addr">${esc(s.address)}, ${esc(s.number)}</div>
            </div>
            <div class="stop-side">${afternoon ? afternoonBadge(s.status) : K.statusBadge(s.status)}</div>
          </div>`;
        }).join('')}
      </div>

      <div class="map-side-actions">
        ${st.active
          ? `${st.paused
              ? `<button class="btn btn-primary btn-block" data-act="resume">${icon('play')}Retomar rota</button>`
              : `<button class="btn btn-ghost btn-block" data-act="pause">${icon('pause')}Pausar rota</button>`}
             ${afternoon
               ? (st.allFinal
                 ? `<button class="btn btn-success btn-block" data-act="finish">${icon('check')}Finalizar rota</button>`
                 : st.next && st.next.status === 'picked'
                   ? `<div class="row" style="gap:8px">
                        <button class="btn btn-success grow" data-act="dropoff">${icon('check')}Confirmar entrega</button>
                        <button class="btn btn-outline-danger" data-act="nodelivery">${icon('alert')}</button>
                      </div>`
                   : `<div class="row" style="gap:8px">
                        <button class="btn btn-success grow" data-act="confirm">${icon('userCheck')}Confirmar embarque</button>
                        <button class="btn btn-outline-danger" data-act="finish">${icon('stop')}</button>
                      </div>`)
               : `<div class="row" style="gap:8px">
                    <button class="btn btn-success grow" data-act="confirm">${icon('check')}Confirmar embarque</button>
                    <button class="btn btn-outline-danger" data-act="finish">${icon('stop')}</button>
                  </div>`}`
          : `<button class="btn btn-primary btn-block" data-act="start">${icon('play')}Iniciar rota</button>`}
      </div>`;
  }

  function selectedCard(s, st) {
    const afternoon = st.shift === 'afternoon';
    let action = '';
    if (st.active) {
      if (afternoon && (s.status === 'waiting' || s.status === 'next')) {
        action = `<button class="btn btn-success btn-sm grow" data-act="board" data-id="${s.id}">${icon('userCheck')}Confirmar embarque</button>`;
      } else if (afternoon && s.status === 'picked') {
        action = `<button class="btn btn-success btn-sm grow" data-act="dropoff" data-id="${s.id}">${icon('check')}Confirmar entrega</button>
          <button class="btn btn-ghost btn-sm" data-act="nodelivery" data-id="${s.id}">${icon('alert')}Não entregue</button>`;
      } else if (!afternoon && (s.status === 'next' || s.status === 'waiting')) {
        action = `<button class="btn btn-success btn-sm grow" data-act="confirm">${icon('check')}Confirmar embarque</button>`;
      }
    }
    return `
      <div class="selected-card">
        <div class="row-between" style="align-items:flex-start">
          <div class="person">
            <div class="avatar ${K.avatarTone(s.status)}">${esc(K.fmt.initials(s.name))}</div>
            <div class="person-main">
              <div class="person-name">${esc(s.name)}</div>
              <div class="person-sub">${esc(s.guardian)}</div>
            </div>
          </div>
          <button class="icon-btn" data-close-selected aria-label="Fechar detalhes">${icon('x')}</button>
        </div>
        <div class="selected-addr">${icon('pin')}<span>${esc(s.address)}, ${esc(s.number)}<br>${esc(s.district)} · ${esc(s.city)}</span></div>
        <div class="row wrap" style="gap:6px;margin-top:8px">
          ${afternoon ? afternoonBadge(s.status) : K.statusBadge(s.status)}
          <span class="badge b-gray">${icon('phone')}${esc(K.fmt.maskPhone(s.phone))}</span>
          <span class="badge b-gray">${icon('school')}${esc(s.school)}</span>
        </div>
        ${s.note ? `<div class="notice neutral" style="margin-top:9px;padding:9px 10px;font-size:11px">${icon('info')}<div>${esc(s.note)}</div></div>` : ''}
        <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">
          ${action}
          <button class="btn btn-ghost btn-sm" data-edit-student="${s.id}">${icon('edit')}Editar</button>
        </div>
      </div>`;
  }

  function controlsHtml(st) {
    const afternoon = st.shift === 'afternoon';
    return `
      <div class="map-controls">
        ${!st.active
          ? `<button class="btn btn-primary" data-act="start">${icon('play')}Iniciar rota</button>`
          : afternoon
            ? `${st.allFinal
                ? `<button class="btn btn-success" data-act="finish">${icon('check')}Finalizar rota</button>`
                : st.next && st.next.status === 'picked'
                  ? `<button class="btn btn-success" data-act="dropoff">${icon('check')}Confirmar entrega</button>
                     <button class="btn btn-ghost" data-act="nodelivery">${icon('alert')}Não entregue</button>`
                  : `<button class="btn btn-success" data-act="confirm">${icon('userCheck')}Confirmar embarque</button>
                     <button class="btn btn-ghost" data-act="skip">${icon('skip')}Não embarcou</button>`}
               ${st.paused
                 ? `<button class="btn btn-primary" data-act="resume">${icon('play')}Retomar</button>`
                 : `<button class="btn btn-ghost" data-act="pause">${icon('pause')}Pausar</button>`}
               <button class="btn btn-outline-danger" data-act="finish">${icon('stop')}Finalizar</button>`
            : `${st.allPicked
                ? `<button class="btn btn-success" data-act="finish">${icon('check')}Finalizar na escola</button>`
                : `<button class="btn btn-success" data-act="confirm">${icon('check')}Confirmar embarque</button>
                   <button class="btn btn-ghost" data-act="skip">${icon('skip')}Pular</button>`}
               ${st.paused
                 ? `<button class="btn btn-primary" data-act="resume">${icon('play')}Retomar</button>`
                 : `<button class="btn btn-ghost" data-act="pause">${icon('pause')}Pausar</button>`}
               <button class="btn btn-outline-danger" data-act="finish">${icon('stop')}Finalizar</button>`}
      </div>`;
  }

  function render(st) {
    if (!rootEl) return;
    const side = $('#mapSide');
    if (side) side.innerHTML = sideHtml(st);
    const controls = $('#mapControls');
    if (controls) controls.innerHTML = controlsHtml(st);
    const chip = $('#mapModeChip');
    if (chip) {
      const demo = K.store.settings().demoMode;
      chip.className = 'map-chip ' + (demo ? 'demo' : 'live');
      chip.innerHTML = demo ? `${icon('bolt')}Demonstração · GPS simulado` : `${icon('locate')}GPS real`;
    }
    const stats = st.active ? st.stats : K.store.routeStats(st.route);
    const badge = $('#mapLiveBadge');
    if (badge) {
      badge.className = 'badge ' + (st.active && !st.paused ? 'b-blue' : st.active ? 'b-amber' : 'b-gray');
      badge.innerHTML = st.active && !st.paused ? '<span class="live-dot"></span>Ao vivo' : st.active ? 'Pausada' : 'Aguardando';
    }
    const countEl = $('#mapCount');
    if (countEl) {
      const afternoon = !!(st.route && st.route.shift === 'afternoon');
      countEl.textContent = `${afternoon ? stats.delivered : stats.done}/${stats.total}`;
    }
  }

  function mapData(st) {
    const data = K.engine.mapData();
    if (!st.active) {
      const route = st.route || K.store.activeRoute();
      const afternoon = !!(route && route.shift === 'afternoon');
      const base = afternoon && st.school ? st.school : K.store.driver().base;
      const list = route ? K.store.routeStudents(route) : [];
      data.route = [base].concat(list.map((s) => ({ lat: s.lat, lng: s.lng })));
      if (!afternoon && st.school) data.route.push({ lat: st.school.lat, lng: st.school.lng });
      data.routeApprox = true;
      data.van = null;
    }
    return data;
  }

  function syncMap(st, forceFit) {
    if (!mapView) return;
    const data = mapData(st);
    const key = `${st.routeId}:${st.active}:${st.stats.total}`;
    const fit = forceFit || key !== lastFitKey;
    lastFitKey = key;
    mapView.setData(Object.assign({}, data, { fit }));
  }

  function updateLive(st) {
    const bar = $('#mapProgress');
    if (bar) bar.style.width = (st.active ? st.progress : 0) + '%';
    const txt = $('[data-live="progressText"]');
    if (txt) txt.textContent = Math.round(st.active ? st.progress : 0) + '%';
    if (st.active && mapView) {
      mapView.setVan(st.van);
      mapView.setTraveled(st.traveled);
    }
  }

  function selectStudent(id) {
    selectedId = id;
    render(K.engine.getState());
    if (mapView) mapView.openStudent(id);
  }

  function mount(container, params) {
    rootEl = container;
    selectedId = params && params.get('aluno') ? params.get('aluno') : null;
    lastFitKey = '';
    const st = K.engine.getState();
    const route = st.route || K.store.activeRoute();

    container.innerHTML = `
      <div class="map-page">
        <section class="panel map-card">
          <div class="map-head">
            <div class="map-head-left">
              <span class="stat-ico" style="width:36px;height:36px;border-radius:10px">${icon('map')}</span>
              <div>
                <div class="map-head-title">Mapa da rota <span class="badge b-blue" id="mapLiveBadge">Ao vivo</span></div>
                <div class="map-head-sub">${esc(route ? route.name : 'Rota')} · ${esc(route ? route.time : '--:--')} · <span id="mapCount">0/0</span> ${route && route.shift === 'afternoon' ? 'entregues' : 'confirmados'}</div>
              </div>
            </div>
            <div class="row" style="gap:7px">
              <button class="btn btn-ghost btn-sm" data-locate>${icon('crosshair')}Minha localização</button>
              <button class="btn btn-ghost btn-sm" data-fit>${icon('external')}Enquadrar</button>
            </div>
          </div>
          <div class="map-shell map-page-shell">
            <div class="map-box" id="liveMap"></div>
            <div class="map-overlay tl">
              <span class="map-chip" id="mapModeChip"></span>
            </div>
            <div class="map-overlay bl">
              <div class="map-legend">
                <span class="legend-item"><span class="legend-dot" style="background:#1265E8"></span>Próximo</span>
                <span class="legend-item"><span class="legend-dot" style="background:#159B5B"></span>Pego</span>
                <span class="legend-item"><span class="legend-dot" style="background:#93A0B3"></span>Aguardando</span>
                <span class="legend-item"><span class="legend-dot" style="background:#E5484D"></span>Problema</span>
                <span class="legend-item"><span class="legend-line" style="background:#1265E8"></span>Rota planejada</span>
                <span class="legend-item"><span class="legend-line" style="background:#159B5B"></span>Percorrido</span>
              </div>
            </div>
            <div class="map-overlay bc" id="mapControls"></div>
          </div>
        </section>

        <aside class="panel map-side" id="mapSide"></aside>
      </div>`;

    const el = $('#liveMap');
    mapView = new K.MapView(el, {
      onStudentClick: (id) => selectStudent(id)
    });
    syncMap(st, true);
    render(st);

    if (selectedId) {
      setTimeout(() => { if (mapView) mapView.openStudent(selectedId); }, 700);
    }

    rootEl.addEventListener('click', async (ev) => {
      const act = ev.target.closest('[data-act]');
      if (act) {
        const a = act.getAttribute('data-act');
        const id = act.getAttribute('data-id');
        if (a === 'start') await K.actions.start();
        else if (a === 'pause') K.actions.pause();
        else if (a === 'resume') K.actions.resume();
        else if (a === 'finish') await K.actions.finish();
        else if (a === 'confirm') K.actions.confirmPick();
        else if (a === 'board' && id) K.actions.board(id);
        else if (a === 'dropoff') {
          const stt = K.engine.getState();
          const target = id || (stt.next ? stt.next.id : null);
          if (target) K.actions.confirmDropOff(target);
        } else if (a === 'nodelivery') {
          const stt = K.engine.getState();
          const target = id || (stt.next ? stt.next.id : null);
          if (target) await K.actions.failDelivery(target);
        } else if (a === 'skip') K.actions.skip();
        render(K.engine.getState());
        return;
      }
      if (ev.target.closest('[data-fit]')) { if (mapView) mapView.fitNow(); return; }
      if (ev.target.closest('[data-locate]')) {
        const stt = K.engine.getState();
        if (!stt.active) {
          K.toast('Rota não iniciada', 'Inicie a rota para rastrear a perua.', 'info');
          return;
        }
        K.toast(
          K.store.settings().demoMode ? 'Posição simulada' : 'Localizando...',
          K.store.settings().demoMode ? 'No modo demonstração a posição é gerada pela simulação.' : 'Obtendo a posição do dispositivo.',
          'info'
        );
        if (mapView && stt.van) mapView.setVan(stt.van);
        return;
      }
      const edit = ev.target.closest('[data-edit-student]');
      if (edit) {
        location.hash = '#/alunos';
        K.toast('Editar aluno', 'Use o ícone de edição na lista de alunos.', 'info');
        return;
      }
      if (ev.target.closest('[data-close-selected]')) {
        selectedId = null;
        render(K.engine.getState());
        return;
      }
      const stop = ev.target.closest('[data-student]');
      if (stop) {
        const id = stop.getAttribute('data-student');
        if (selectedId === id) {
          selectedId = null;
          render(K.engine.getState());
        } else {
          selectStudent(id);
        }
      }
    });
  }

  K.views = K.views || {};
  K.views.mapa = {
    mount,
    unmount() {
      if (mapView) { mapView.destroy(); mapView = null; }
      rootEl = null;
      selectedId = null;
    },
    onResize() { if (mapView) mapView.invalidate(); },
    onRoute(type, st) {
      if (type === 'move') {
        updateLive(st);
      } else {
        syncMap(st, false);
        render(st);
      }
    }
  };
})(window.KT);
