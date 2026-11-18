/* ==========================================================================
   KombiTech — View: Alunos
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, $$, icon, esc } = K;

  let rootEl = null;
  let filters = { q: '', status: 'all', school: 'all' };
  let revealContacts = false;

  function allSchools() {
    const set = new Set(K.store.students().map((s) => s.school).filter(Boolean));
    return Array.from(set);
  }

  function filtered() {
    const q = filters.q.trim().toLowerCase();
    return K.store.students().filter((s) => {
      if (filters.status !== 'all' && s.status !== filters.status) return false;
      if (filters.school !== 'all' && s.school !== filters.school) return false;
      if (!q) return true;
      const hay = `${s.name} ${s.address} ${s.district} ${s.guardian} ${s.school}`.toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function phoneCell(s) {
    const masked = K.store.settings().maskContacts && !revealContacts;
    return `<span class="small ${masked ? 'muted' : ''}">${esc(masked ? K.fmt.maskPhone(s.phone) : s.phone)}</span>`;
  }

  function guardianAuth(s) {
    const g = K.store.guardianForStudent(s.id);
    if (!g) return null;
    return { g, st: K.store.guardianAuthStatus(g.id) };
  }

  function guardianCell(s) {
    const auth = guardianAuth(s);
    if (!auth) {
      return `<div class="small">${phoneCell(s)}</div><div class="tiny muted">${esc(s.guardian)} · sem conta vinculada</div>`;
    }
    return `
      <div class="small">${phoneCell(s)}</div>
      <div class="tiny muted">${esc(auth.g.email || 'sem e-mail')}</div>
      <div class="tiny" style="margin-top:2px">
        <span class="badge ${auth.st && auth.st.active ? 'b-green' : 'b-amber'}">${icon(auth.st && auth.st.active ? 'checkCircle' : 'key')}${auth.st && auth.st.active ? 'Conta ativa' : 'Ativação pendente'}</span>
      </div>`;
  }

  function actionButtons(s) {
    const auth = guardianAuth(s);
    return `
      <button class="icon-btn bordered" data-map="${s.id}" title="Ver no mapa" aria-label="Ver ${esc(s.name)} no mapa">${icon('pin')}</button>
      ${auth && auth.st && !auth.st.active ? `<button class="icon-btn bordered" data-activate="${auth.g.id}" title="Código de ativação" aria-label="Código de ativação de ${esc(auth.g.name)}">${icon('key')}</button>` : ''}
      <button class="icon-btn bordered" data-edit="${s.id}" title="Editar" aria-label="Editar ${esc(s.name)}">${icon('edit')}</button>
      <button class="icon-btn bordered danger" data-del="${s.id}" title="Excluir" aria-label="Excluir ${esc(s.name)}">${icon('trash')}</button>`;
  }

  function tableHtml(list) {
    if (!list.length) {
      return `<div class="empty"><div class="empty-ico">${icon('users')}</div><h4>Nenhum aluno encontrado</h4><p>Ajuste a busca ou cadastre um novo aluno para começar.</p><button class="btn btn-soft btn-sm" data-new>${icon('plus')}Cadastrar aluno</button></div>`;
    }
    return `
      <div class="tbl-wrap table-desktop">
        <table class="tbl">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Endereço</th>
              <th>Escola</th>
              <th>Responsável</th>
              <th>Status</th>
              <th class="td-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((s) => `
              <tr>
                <td>
                  <div class="person">
                    <div class="avatar ${K.avatarTone(s.status)}">${esc(K.fmt.initials(s.name))}</div>
                    <div class="person-main">
                      <div class="person-name">${esc(s.name)}</div>
                      <div class="person-sub">${esc(s.guardian)}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="small strong" style="font-weight:600">${esc(s.address)}, ${esc(s.number)}</div>
                  <div class="tiny muted">${esc(s.district)} · ${esc(s.city)}</div>
                </td>
                <td><span class="small">${esc(s.school)}</span></td>
                <td>
                  ${guardianCell(s)}
                </td>
                <td>${K.statusBadge(s.status)}</td>
                <td class="td-actions">${actionButtons(s)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-mobile" style="display:none">
        ${list.map((s) => `
          <div class="card" style="padding:14px;margin-bottom:10px">
            <div class="row-between" style="align-items:flex-start">
              <div class="person">
                <div class="avatar ${K.avatarTone(s.status)}">${esc(K.fmt.initials(s.name))}</div>
                <div class="person-main">
                  <div class="person-name">${esc(s.name)}</div>
                  <div class="person-sub">${esc(s.guardian)}</div>
                </div>
              </div>
              ${K.statusBadge(s.status)}
            </div>
            <div class="small muted" style="margin-top:10px;line-height:1.5">${esc(s.address)}, ${esc(s.number)}<br>${esc(s.district)} · ${esc(s.city)}</div>
            <div class="row-between" style="margin-top:10px">
              <span class="badge b-gray">${icon('phone')}${esc(K.store.settings().maskContacts && !revealContacts ? K.fmt.maskPhone(s.phone) : s.phone)}</span>
              <div class="row" style="gap:5px">${actionButtons(s)}</div>
            </div>
            <div class="tiny muted" style="margin-top:7px">${guardianAuth(s)
              ? `${esc(guardianAuth(s).g.email || 'sem e-mail')} · ${guardianAuth(s).st && guardianAuth(s).st.active ? 'conta ativa' : 'ativação pendente'}`
              : 'sem conta de responsável vinculada'}</div>
          </div>`).join('')}
      </div>`;
  }

  function chipsHtml() {
    const students = K.store.students();
    const count = (status) => students.filter((s) => s.status === status).length;
    const items = [
      { key: 'all', label: 'Todos', count: students.length },
      { key: 'next', label: 'Próximos', count: count('next') },
      { key: 'picked', label: 'Buscados', count: count('picked') },
      { key: 'waiting', label: 'Aguardando', count: count('waiting') },
      { key: 'issue', label: 'Problemas', count: count('issue') }
    ];
    return items.map((i) => `
      <button class="chip ${filters.status === i.key ? 'active' : ''}" data-status="${i.key}">
        ${i.label}<span class="count">${i.count}</span>
      </button>`).join('');
  }

  function render() {
    if (!rootEl) return;
    const list = filtered();
    const students = K.store.students();
    const picked = students.filter((s) => s.status === 'picked').length;
    const issues = students.filter((s) => s.status === 'issue').length;

    const listEl = $('#studentList');
    if (listEl) listEl.innerHTML = tableHtml(list);
    const chips = $('#statusChips');
    if (chips) chips.innerHTML = chipsHtml();
    const countEl = $('#studentCount');
    if (countEl) countEl.textContent = `${list.length} de ${students.length} alunos`;
    const foot = $('#studentFoot');
    if (foot) {
      foot.innerHTML = `
        <span class="small muted"><b class="strong" style="color:var(--ink)">${students.length}</b> cadastrados · <span class="green strong">${picked}</span> buscados · ${issues ? `<span class="red strong">${issues}</span> com problema` : '<span class="muted">0 problemas</span>'}</span>
        <div class="row" style="gap:8px">
          <button class="btn btn-ghost btn-sm" data-toggle-contacts>${icon('eye')}${K.store.settings().maskContacts && !revealContacts ? 'Mostrar contatos' : 'Ocultar contatos'}</button>
          <button class="btn btn-ghost btn-sm" data-export>${icon('download')}Exportar CSV</button>
        </div>`;
    }
  }

  function mount(container) {
    rootEl = container;
    const schools = allSchools();
    container.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Alunos</h1>
          <p class="page-sub">Cadastre, edite e acompanhe os alunos do transporte escolar. Os endereços alimentam as paradas da rota.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" data-export>${icon('download')}Exportar</button>
          <button class="btn btn-primary" data-new>${icon('plus')}Novo aluno</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head" style="flex-direction:column;align-items:stretch;gap:12px">
          <div class="toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <div class="search">
              ${icon('search')}
              <input id="studentSearch" type="search" placeholder="Pesquisar por nome, endereço ou responsável..." value="${esc(filters.q)}" aria-label="Pesquisar alunos">
            </div>
            <div class="chips" id="statusChips"></div>
            <select class="select" id="schoolFilter" aria-label="Filtrar por escola" style="max-width:230px">
              <option value="all">Todas as escolas</option>
              ${schools.map((s) => `<option value="${esc(s)}" ${filters.school === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="notice neutral" style="font-size:11.5px">
            ${icon('shield')}
            <div><b>Dados de demonstração.</b> Os alunos abaixo são fictícios. Contatos aparecem mascarados por padrão (LGPD). A localização nunca é exibida fora deste painel autenticado.</div>
          </div>
        </div>
        <div class="panel-body">
          <div id="studentList"></div>
        </div>
        <div class="panel-foot" id="studentFoot"></div>
      </div>`;

    render();
    bind();
  }

  function bind() {
    $('#studentSearch').addEventListener('input', K.util.debounce((ev) => {
      filters.q = ev.target.value;
      render();
    }, 160));

    $('#schoolFilter').addEventListener('change', (ev) => {
      filters.school = ev.target.value;
      render();
    });

    rootEl.addEventListener('click', async (ev) => {
      const chip = ev.target.closest('[data-status]');
      if (chip) { filters.status = chip.getAttribute('data-status'); render(); return; }

      if (ev.target.closest('[data-new]')) { openForm(); return; }

      const editBtn = ev.target.closest('[data-edit]');
      if (editBtn) { openForm(K.store.student(editBtn.getAttribute('data-edit'))); return; }

      const delBtn = ev.target.closest('[data-del]');
      if (delBtn) {
        const s = K.store.student(delBtn.getAttribute('data-del'));
        if (!s) return;
        const ok = await K.confirm({
          title: 'Excluir cadastro?',
          message: `${s.name} será removido da base de alunos e das rotas.`,
          detail: 'Esta ação não pode ser desfeita. Em produção, a exclusão deve ser registrada na trilha de auditoria (LGPD).',
          confirmLabel: 'Excluir aluno',
          danger: true,
          icon: 'trash'
        });
        if (ok) {
          K.store.deleteStudent(s.id);
          K.toast('Cadastro excluído', `${s.name} foi removido da base.`, 'success');
          render();
        }
        return;
      }

      const mapBtn = ev.target.closest('[data-map]');
      if (mapBtn) {
        location.hash = '#/mapa?aluno=' + encodeURIComponent(mapBtn.getAttribute('data-map'));
        return;
      }

      const actBtn = ev.target.closest('[data-activate]');
      if (actBtn) { openActivation(actBtn.getAttribute('data-activate')); return; }

      if (ev.target.closest('[data-toggle-contacts]')) {
        revealContacts = !revealContacts;
        render();
        return;
      }

      if (ev.target.closest('[data-export]')) { exportCsv(); }
    });
  }

  function exportCsv() {
    const list = filtered();
    const rows = list.map((s) => [
      s.name, s.address, s.number, s.district, s.city, s.school, s.guardian, s.phone, K.STATUS[s.status] ? K.STATUS[s.status].label : s.status
    ]);
    const csv = K.util.toCSV(rows, ['Nome', 'Endereço', 'Número', 'Bairro', 'Cidade', 'Escola', 'Responsável', 'Telefone', 'Status']);
    K.util.download(`kombitech-alunos-${K.store.isoDay(new Date())}.csv`, csv, 'text/csv;charset=utf-8');
    K.toast('Exportação concluída', `${list.length} alunos exportados em CSV.`, 'success');
  }

  function fieldHtml(id, label, value, opts) {
    const o = opts || {};
    return `
      <div class="field ${o.span ? 'span-2' : ''}">
        <label class="label" for="${id}">${label}${o.required ? ' <span class="req">*</span>' : ''}</label>
        ${o.textarea
          ? `<textarea class="textarea" id="${id}" placeholder="${o.placeholder || ''}">${esc(value || '')}</textarea>`
          : `<input class="input ${o.inputClass || ''}" id="${id}" type="${o.type || 'text'}" value="${esc(value || '')}" placeholder="${o.placeholder || ''}" ${o.inputmode ? `inputmode="${o.inputmode}"` : ''} ${o.readonly ? 'readonly' : ''}>`}
        ${o.hint ? `<span class="hint">${o.hint}</span>` : ''}
      </div>`;
  }

  function openActivation(guardianId) {
    const g = K.store.guardian(guardianId);
    const st = K.store.guardianAuthStatus(guardianId);
    if (!g || !st) return;
    if (st.active) {
      K.toast('Conta ativa', `${g.name} já ativou a conta.`, 'info');
      return;
    }
    const code = st.code || (K.store.regenerateGuardianActivation(guardianId) || {}).code;
    K.modal({
      title: 'Ativação do responsável',
      subtitle: g.name,
      icon: 'key',
      size: 'sm',
      body: `
        <div class="stack" style="gap:12px">
          <div class="notice warn">${icon('alert')}<div><b>Demonstração.</b> Nenhum e-mail é enviado. Entregue o código abaixo ao responsável.</div></div>
          <div class="field">
            <label class="label">E-mail de acesso</label>
            <div class="input-icon">${icon('mail')}<input class="input" value="${esc(g.email || '')}" readonly></div>
          </div>
          <div>
            <div class="tiny strong" style="text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Código individual · uso único</div>
            <div class="code-box"><code id="actCodeBox">${esc(code || '—')}</code></div>
            <div class="tiny muted" id="actCodeExp">${st.expiresAt ? `Válido até ${K.fmt.date(st.expiresAt)}` : 'Sem validade definida'}</div>
          </div>
          <p class="tiny muted" style="line-height:1.6">O responsável usa este e-mail e código em <b>Primeiro acesso? Ative sua conta</b>, na tela de login, para criar a própria senha. Ao gerar um novo código, o anterior deixa de valer.</p>
        </div>`,
      footer: `
        <button class="btn btn-ghost" data-modal-close>Fechar</button>
        <button class="btn btn-soft" id="regenActivation">${icon('refresh')}Gerar novo código</button>`,
      onMount: (el) => {
        el.querySelector('#regenActivation').addEventListener('click', () => {
          const a = K.store.regenerateGuardianActivation(guardianId);
          if (!a) return;
          el.querySelector('#actCodeBox').textContent = a.code;
          el.querySelector('#actCodeExp').textContent = `Válido até ${K.fmt.date(a.expiresAt)}`;
          K.toast('Novo código gerado', 'O código anterior foi invalidado.', 'success');
        });
      }
    });
  }

  function openForm(student) {
    const s = student || {};
    const editing = !!student;
    const school = K.store.get().school;
    const linkedGuardian = editing ? K.store.guardianForStudent(s.id) : null;
    K.modal({
      title: editing ? 'Editar aluno' : 'Novo aluno',
      subtitle: editing ? 'Atualize os dados cadastrais e o endereço de embarque.' : 'Preencha os dados do aluno e do responsável.',
      icon: editing ? 'edit' : 'user',
      size: 'md',
      body: `
        <form id="studentForm" class="form-grid" novalidate>
          <div class="form-section-title">Dados do aluno</div>
          ${fieldHtml('fName', 'Nome completo', s.name, { required: true, span: true, placeholder: 'Ex.: Ana Beatriz Souza' })}
          ${fieldHtml('fSchool', 'Escola de destino', s.school || (school ? school.name : ''), { required: true, placeholder: 'Nome da escola' })}

          <div class="form-section-title">Endereço residencial</div>
          ${fieldHtml('fAddress', 'Endereço', s.address, { required: true, placeholder: 'Rua / Avenida' })}
          ${fieldHtml('fNumber', 'Número', s.number, { required: true, placeholder: '123' })}
          ${fieldHtml('fDistrict', 'Bairro', s.district, { required: true, placeholder: 'Bairro' })}
          ${fieldHtml('fCity', 'Cidade', s.city || 'São Paulo', { required: true, placeholder: 'Cidade' })}

          <div class="span-2">
            <div class="row-between" style="gap:12px;align-items:flex-end;flex-wrap:wrap">
              <div class="grow" style="min-width:180px">
                <div class="field">
                  <label class="label">Coordenadas do endereço</label>
                  <div class="row" style="gap:8px">
                    <input class="input" id="fLat" type="text" value="${s.lat != null ? s.lat : ''}" placeholder="Latitude" readonly>
                    <input class="input" id="fLng" type="text" value="${s.lng != null ? s.lng : ''}" placeholder="Longitude" readonly>
                  </div>
                  <span class="hint" id="geoHint">${s.geoApprox ? 'Posição aproximada — ajuste o endereço e localize novamente.' : 'Use o botão para localizar o endereço no mapa (OpenStreetMap).'}</span>
                </div>
              </div>
              <button type="button" class="btn btn-ghost" id="geocodeBtn">${icon('locate')}Localizar endereço</button>
            </div>
          </div>

          <div class="form-section-title">Responsável</div>
          ${fieldHtml('fGuardian', 'Nome do responsável', s.guardian, { required: true, placeholder: 'Nome completo' })}
          ${fieldHtml('fPhone', 'Telefone de contato', s.phone, { required: true, placeholder: '(11) 90000-0000', inputmode: 'tel' })}
          ${fieldHtml('fGuardianEmail', 'E-mail do responsável (acesso ao app)', linkedGuardian ? linkedGuardian.email : '', { span: true, inputmode: 'email', placeholder: 'responsavel@email.com', hint: 'Usado para ativar a conta e acompanhar o aluno. Se ainda não existir conta, um código individual de ativação será gerado.' })}
          ${fieldHtml('fNote', 'Observações', s.note, { span: true, textarea: true, placeholder: 'Ex.: portão azul, aluno com alergia, rampa de acesso...' })}

          <div class="span-2">
            <label class="check">
              <input type="checkbox" id="fConsent" ${s.consent && s.consent.granted ? 'checked' : 'checked'}>
              <span>O responsável autorizou o uso dos dados para fins exclusivos de transporte escolar, conforme a LGPD.</span>
            </label>
          </div>
          <div class="span-2"><div class="error-msg" id="formError"></div></div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" data-modal-close>Cancelar</button>
        <button class="btn btn-primary" id="saveStudent">${icon('check')}${editing ? 'Salvar alterações' : 'Cadastrar aluno'}</button>`,
      onMount: (el, close) => {
        const phone = el.querySelector('#fPhone');
        phone.addEventListener('input', () => { phone.value = K.fmt.phone(phone.value); });
        const geocodeBtn = el.querySelector('#geocodeBtn');
        const hint = el.querySelector('#geoHint');

        el.querySelector('#geocodeBtn').addEventListener('click', async () => {
          const address = el.querySelector('#fAddress').value.trim();
          const number = el.querySelector('#fNumber').value.trim();
          const district = el.querySelector('#fDistrict').value.trim();
          const city = el.querySelector('#fCity').value.trim();
          if (!address || !city) {
            hint.textContent = 'Informe endereço e cidade antes de localizar.';
            hint.style.color = 'var(--red)';
            return;
          }
          geocodeBtn.disabled = true;
          geocodeBtn.innerHTML = `${icon('refresh')}Localizando...`;
          const query = `${address} ${number}, ${district}, ${city}, Brasil`;
          let point = await K.services.geocode(query);
          if (!point) {
            point = K.services.fallbackPoint(query, school);
            hint.textContent = 'Não foi possível localizar com precisão. Usando posição aproximada — confira no mapa após salvar.';
            hint.style.color = '#A97408';
          } else {
            hint.textContent = `Localizado: ${point.label ? point.label.slice(0, 90) : query}`;
            hint.style.color = 'var(--green)';
          }
          el.querySelector('#fLat').value = point.lat.toFixed(6);
          el.querySelector('#fLng').value = point.lng.toFixed(6);
          el.querySelector('#fLat').dataset.approx = point.approx ? '1' : '0';
          geocodeBtn.disabled = false;
          geocodeBtn.innerHTML = `${icon('refresh')}Localizar novamente`;
        });

        el.querySelector('#saveStudent').addEventListener('click', () => {
          const errorBox = el.querySelector('#formError');
          const showErr = (msg) => {
            errorBox.textContent = msg;
            errorBox.classList.add('show');
            errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
          };
          const name = el.querySelector('#fName').value.trim();
          const address = el.querySelector('#fAddress').value.trim();
          const number = el.querySelector('#fNumber').value.trim();
          const district = el.querySelector('#fDistrict').value.trim();
          const city = el.querySelector('#fCity').value.trim();
          const schoolName = el.querySelector('#fSchool').value.trim();
          const guardian = el.querySelector('#fGuardian').value.trim();
          const phoneValue = el.querySelector('#fPhone').value.trim();
          const guardianEmail = el.querySelector('#fGuardianEmail').value.trim();

          if (!name || name.split(/\s+/).length < 2) return showErr('Informe o nome completo do aluno.');
          if (!address) return showErr('Informe o endereço residencial.');
          if (!number) return showErr('Informe o número da residência.');
          if (!district) return showErr('Informe o bairro.');
          if (!city) return showErr('Informe a cidade.');
          if (!schoolName) return showErr('Informe a escola de destino.');
          if (!guardian) return showErr('Informe o nome do responsável.');
          if (phoneValue.replace(/\D/g, '').length < 10) return showErr('Informe um telefone válido com DDD.');
          if (guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) return showErr('Informe um e-mail válido para o responsável.');

          const latVal = el.querySelector('#fLat').value;
          const lngVal = el.querySelector('#fLng').value;
          let lat = latVal ? Number(latVal) : null;
          let lng = lngVal ? Number(lngVal) : null;
          let geoApprox = el.querySelector('#fLat').dataset.approx === '1';

          if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
            const p = K.services.fallbackPoint(`${address} ${number} ${district}`, school);
            lat = p.lat; lng = p.lng; geoApprox = true;
          }

          const saved = K.store.saveStudent({
            id: editing ? s.id : null,
            name, address, number, district, city, school: schoolName, guardian,
            guardianEmail: guardianEmail || null,
            phone: phoneValue, note: el.querySelector('#fNote').value.trim(),
            lat, lng, geoApprox
          });
          close();
          K.toast(editing ? 'Aluno atualizado' : 'Aluno cadastrado', `${name} está disponível na rota.`, 'success');
          const linked = saved ? K.store.guardianForStudent(saved.id) : null;
          const authSt = linked ? K.store.guardianAuthStatus(linked.id) : null;
          if (authSt && !authSt.active && authSt.code) {
            K.toast(
              'Ativação do responsável',
              `${linked.name} · código ${authSt.code}. Compartilhe com o responsável para o primeiro acesso.`,
              'info',
              { ttl: 10000 }
            );
          }
          render();
        });
      }
    });
  }

  K.views = K.views || {};
  K.views.alunos = {
    mount,
    unmount() { rootEl = null; },
    onRoute() { render(); }
  };
})(window.KT);
