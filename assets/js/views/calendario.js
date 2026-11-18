/* ==========================================================================
   KombiTech — View: Calendário escolar e operacional
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, icon, esc } = K;
  const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  let rootEl = null;
  let viewDate = new Date();
  let selectedDate = isoDate(new Date());

  function isoDate(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }

  function parseISO(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function typeMeta(type) {
    if (type === 'holiday') return { label: 'Feriado', cls: 'b-red', icon: 'calendar' };
    if (type === 'school') return { label: 'Escola', cls: 'b-blue', icon: 'school' };
    return { label: 'Evento', cls: 'b-green', icon: 'users' };
  }

  function monthLabel(d) {
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function longDate(d) {
    const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function eventsFor(dateISO) {
    return K.store.calendarEvents().filter((e) => e.date === dateISO);
  }

  function monthStats(events) {
    const prefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const inMonth = events.filter((e) => String(e.date).startsWith(prefix));
    return {
      holidays: inMonth.filter((e) => e.type === 'holiday').length,
      school: inMonth.filter((e) => e.type === 'school').length,
      events: inMonth.filter((e) => e.type === 'event').length,
      total: inMonth.length
    };
  }

  function eventRow(e, compact) {
    const m = typeMeta(e.type);
    return `
      <div class="cal-event ${compact ? 'compact' : ''}">
        <span class="cal-event-ico ${e.type}">${icon(m.icon)}</span>
        <div class="grow" style="min-width:0">
          <div class="cal-event-title">${esc(e.title)}</div>
          <div class="tiny muted">${e.time ? esc(e.time) + ' · ' : ''}${m.label}${e.description && !compact ? ' · ' + esc(e.description) : ''}</div>
        </div>
        ${compact ? '' : `<button class="icon-btn" data-del="${e.id}" aria-label="Remover evento">${icon('trash')}</button>`}
      </div>`;
  }

  function calendarGrid(events) {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const todayISO = isoDate(new Date());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = isoDate(d);
      const evs = events.filter((e) => e.date === iso);
      const out = d.getMonth() !== m;
      cells.push(`
        <button class="cal-day ${out ? 'out' : ''} ${iso === todayISO ? 'today' : ''} ${iso === selectedDate ? 'selected' : ''}" data-day="${iso}">
          <span class="cal-day-num">${d.getDate()}</span>
          <span class="cal-dots">${evs.slice(0, 3).map((e) => `<i class="cal-dot ${e.type}"></i>`).join('')}</span>
          ${evs.length ? `<span class="cal-day-label">${esc(evs[0].title)}</span>` : ''}
        </button>`);
    }
    return `
      <div class="cal-weekdays">${WEEK.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>`;
  }

  function addEventModal() {
    const date = selectedDate;
    K.modal({
      title: 'Novo evento no calendário',
      subtitle: 'Feriado, evento escolar ou compromisso da rota',
      icon: 'calendar',
      size: 'sm',
      body: `
        <div class="stack" style="gap:12px">
          <div class="field">
            <label class="label" for="calTitle">Título</label>
            <input class="input" id="calTitle" placeholder="Ex.: Reunião de pais" maxlength="80">
          </div>
          <div class="grid-2">
            <div class="field">
              <label class="label" for="calDate">Data</label>
              <input class="input" id="calDate" type="date" value="${date}">
            </div>
            <div class="field">
              <label class="label" for="calTime">Horário</label>
              <input class="input" id="calTime" type="time">
            </div>
          </div>
          <div class="field">
            <label class="label" for="calType">Tipo</label>
            <select class="input" id="calType">
              <option value="event">Evento escolar</option>
              <option value="school">Compromisso da escola</option>
              <option value="holiday">Feriado / sem aula</option>
            </select>
          </div>
          <div class="field">
            <label class="label" for="calDesc">Observação</label>
            <textarea class="input" id="calDesc" rows="3" maxlength="240" placeholder="Informações para os responsáveis e para a rota"></textarea>
          </div>
          <div class="notice neutral">${icon('info')}<div>O evento ficará visível no calendário do motorista. Em produção, eventos marcados como "todos" também podem aparecer para os responsáveis.</div></div>
        </div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="saveCalEvent">${icon('plus')}Adicionar</button>`,
      onMount: (el, close) => {
        el.querySelector('#saveCalEvent').addEventListener('click', () => {
          const title = el.querySelector('#calTitle').value.trim();
          const dateVal = el.querySelector('#calDate').value;
          if (!title) { K.toast('Informe um título', 'O evento precisa de um nome.', 'warn'); return; }
          if (!dateVal) { K.toast('Informe uma data', 'Escolha o dia do evento.', 'warn'); return; }
          K.store.addCalendarEvent({
            title,
            date: dateVal,
            time: el.querySelector('#calTime').value,
            type: el.querySelector('#calType').value,
            description: el.querySelector('#calDesc').value
          });
          selectedDate = dateVal;
          viewDate = parseISO(dateVal);
          close();
          render();
          K.toast('Evento adicionado', 'O calendário foi atualizado.', 'success');
        });
      }
    });
  }

  function render() {
    if (!rootEl) return;
    const events = K.store.calendarEvents();
    const stats = monthStats(events);
    const dayEvents = eventsFor(selectedDate);
    const upcoming = events.filter((e) => e.date >= isoDate(new Date())).slice(0, 5);
    const selected = parseISO(selectedDate);

    rootEl.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">${icon('calendar')} Planejamento da operação</div>
          <h2 class="page-title">Calendário</h2>
          <p class="page-sub">Feriados, eventos escolares e compromissos que afetam a rotina da van.</p>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn-ghost" data-today>${icon('locate')}Hoje</button>
          <button class="btn btn-primary" data-add>${icon('plus')}Novo evento</button>
        </div>
      </div>

      <div class="cal-stats">
        <div class="cal-stat"><span class="stat-ico blue">${icon('calendar')}</span><div><b>${stats.total}</b><span>no mês</span></div></div>
        <div class="cal-stat"><span class="stat-ico amber">${icon('alert')}</span><div><b>${stats.holidays}</b><span>feriados</span></div></div>
        <div class="cal-stat"><span class="stat-ico green">${icon('school')}</span><div><b>${stats.school}</b><span>compromissos</span></div></div>
        <div class="cal-stat"><span class="stat-ico">${icon('users')}</span><div><b>${stats.events}</b><span>eventos</span></div></div>
      </div>

      <div class="cal-layout">
        <section class="card cal-card">
          <div class="cal-head">
            <button class="icon-btn bordered" data-prev aria-label="Mês anterior">${icon('chevronLeft')}</button>
            <div class="cal-month">${esc(monthLabel(viewDate))}</div>
            <button class="icon-btn bordered" data-next aria-label="Próximo mês">${icon('chevronRight')}</button>
          </div>
          ${calendarGrid(events)}
          <div class="cal-legend">
            <span><i class="cal-dot holiday"></i>Feriado</span>
            <span><i class="cal-dot school"></i>Escola</span>
            <span><i class="cal-dot event"></i>Evento</span>
          </div>
        </section>

        <aside class="stack" style="gap:14px">
          <section class="card cal-side">
            <div class="row-between" style="align-items:flex-start">
              <div>
                <div class="strong">${esc(longDate(selected))}</div>
                <div class="tiny muted">${dayEvents.length} compromisso(s)</div>
              </div>
              <button class="icon-btn bordered" data-add aria-label="Adicionar evento">${icon('plus')}</button>
            </div>
            <div class="stack" style="gap:10px;margin-top:14px">
              ${dayEvents.length
                ? dayEvents.map((e) => eventRow(e)).join('')
                : `<div class="empty" style="padding:24px 8px"><div class="empty-ico">${icon('calendar')}</div><h4>Dia livre</h4><p>Nenhum evento para esta data.</p></div>`}
            </div>
          </section>

          <section class="card cal-side">
            <div class="row-between"><div class="strong">Próximos eventos</div><span class="badge b-gray">${upcoming.length}</span></div>
            <div class="stack" style="gap:10px;margin-top:12px">
              ${upcoming.length ? upcoming.map((e) => eventRow(e, true)).join('') : `<div class="tiny muted">Nenhum evento futuro cadastrado.</div>`}
            </div>
          </section>
        </aside>
      </div>`;
  }

  function mount(root) {
    rootEl = root;
    viewDate = new Date();
    selectedDate = isoDate(new Date());
    render();

    root.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-prev]')) {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        render();
        return;
      }
      if (ev.target.closest('[data-next]')) {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        render();
        return;
      }
      if (ev.target.closest('[data-today]')) {
        viewDate = new Date();
        selectedDate = isoDate(new Date());
        render();
        return;
      }
      if (ev.target.closest('[data-add]')) { addEventModal(); return; }
      const day = ev.target.closest('[data-day]');
      if (day) {
        selectedDate = day.getAttribute('data-day');
        const d = parseISO(selectedDate);
        if (d.getMonth() !== viewDate.getMonth()) viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
        render();
        return;
      }
      const del = ev.target.closest('[data-del]');
      if (del) {
        K.confirm({
          title: 'Remover evento?',
          message: 'O evento será retirado do calendário.',
          confirmLabel: 'Remover',
          danger: true,
          icon: 'trash'
        }).then((ok) => {
          if (!ok) return;
          K.store.removeCalendarEvent(del.getAttribute('data-del'));
          render();
          K.toast('Evento removido', 'O calendário foi atualizado.', 'info');
        });
      }
    });
  }

  K.views = K.views || {};
  K.views.calendario = {
    mount,
    unmount() { rootEl = null; },
    onRoute() {}
  };
})(window.KT);
