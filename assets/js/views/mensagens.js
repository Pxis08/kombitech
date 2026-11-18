/* ==========================================================================
   KombiTech — View: Mensagens (motorista ↔ responsável)
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, $$, icon, esc } = K;
  let rootEl = null;
  let selected = null;

  function sessionInfo() {
    const s = K.store.session() || {};
    const guardian = s.role === 'guardian' ? K.store.guardian(s.guardianId) : null;
    return { role: s.role === 'guardian' ? 'guardian' : 'driver', guardian };
  }

  function when(at) {
    const d = new Date(at);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return K.fmt.time(at);
    return `${K.fmt.dateShort(at)} · ${K.fmt.time(at)}`;
  }

  function bubble(m, mine, showName) {
    return `
      <div class="chat-bubble ${mine ? 'out' : 'in'}">
        ${showName ? `<div class="chat-author">${esc(m.from === 'driver' ? K.store.driver().name : 'Responsável')}</div>` : ''}
        <div class="chat-text">${esc(m.text)}</div>
        <div class="chat-meta">${esc(when(m.at))}${mine ? ` · ${icon('check')}` : ''}</div>
      </div>`;
  }

  function threadMessages(conv, role) {
    const list = K.store.messages(conv.id);
    if (!list.length) {
      return `<div class="empty" style="padding:32px 16px"><div class="empty-ico">${icon('message')}</div><h4>Comece a conversa</h4><p>Envie uma mensagem segura para alinhar a rotina do transporte.</p></div>`;
    }
    return list.map((m) => bubble(
      m,
      (role === 'guardian' && m.from === 'guardian') || (role === 'driver' && m.from === 'driver'),
      role === 'driver' && m.from === 'guardian'
    )).join('');
  }

  function composer(role) {
    return `
      <form class="chat-composer" data-chat-form>
        <textarea id="chatInput" class="chat-input" rows="1" maxlength="2000" placeholder="${role === 'guardian' ? 'Escreva para o motorista...' : 'Escreva para o responsável...'}" aria-label="Mensagem"></textarea>
        <button class="btn btn-primary btn-icon chat-send" data-send type="submit" aria-label="Enviar mensagem">${icon('arrowRight')}</button>
      </form>`;
  }

  function driverView() {
    const convs = K.store.conversations();
    if (!convs.length) {
      return `<div class="panel"><div class="empty"><div class="empty-ico">${icon('message')}</div><h4>Nenhuma conversa</h4><p>As conversas com os responsáveis aparecerão aqui.</p></div></div>`;
    }
    if (!selected || !convs.some((c) => c.id === selected)) selected = convs[0].id;
    const active = convs.find((c) => c.id === selected) || convs[0];
    const guardian = K.store.guardian(active.guardianId);
    const child = guardian ? K.store.guardianChildren(guardian)[0] : null;
    const unread = convs.reduce((n, c) => n + (c.unreadDriver || 0), 0);
    K.store.markConversationRead(active.id, 'driver');

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">${icon('message')} Comunicação segura</div>
          <h2 class="page-title">Mensagens com responsáveis</h2>
          <p class="page-sub">Alinhe horários, avise imprevistos e confirme a chegada de cada aluno.</p>
        </div>
        <span class="badge ${unread ? 'b-blue' : 'b-green'}">${unread ? unread + ' não lida(s)' : 'Tudo lido'}</span>
      </div>
      <div class="chat-layout">
        <section class="card chat-list-panel" aria-label="Conversas">
          <div class="chat-list-head">
            <div>
              <div class="strong">Conversas</div>
              <div class="tiny muted">${convs.length} responsáveis</div>
            </div>
            <span class="badge b-gray">${K.store.students().length} alunos</span>
          </div>
          <div class="chat-conv-list">
            ${convs.map((c) => {
              const g = K.store.guardian(c.guardianId);
              if (!g) return '';
              const ch = K.store.guardianChildren(g)[0];
              const last = K.store.lastMessage(c.id);
              return `
                <button class="chat-conv ${c.id === active.id ? 'active' : ''}" data-conv="${c.id}">
                  <div class="avatar sm">${esc(K.fmt.initials(g.name))}</div>
                  <div class="chat-conv-body">
                    <div class="chat-conv-top"><b>${esc(g.name)}</b><span>${last ? esc(when(last.at)) : ''}</span></div>
                    <div class="chat-conv-child">${ch ? esc(ch.name) : 'Aluno não vinculado'}</div>
                    <div class="chat-preview">${last ? esc(last.text) : 'Sem mensagens'}</div>
                  </div>
                  ${c.unreadDriver ? `<span class="chat-unread">${c.unreadDriver}</span>` : ''}
                </button>`;
            }).join('')}
          </div>
          <div class="chat-safe-note">${icon('shield')}<span>Na demonstração, as mensagens ficam apenas neste navegador.</span></div>
        </section>

        <section class="card chat-thread-panel" aria-label="Conversa">
          <div class="chat-thread-head">
            <div class="avatar photo">${esc(K.fmt.initials(guardian ? guardian.name : 'R'))}</div>
            <div class="grow" style="min-width:0">
              <div class="strong">${esc(guardian ? guardian.name : 'Responsável')}</div>
              <div class="tiny muted">${child ? `${esc(child.name)} · ${esc(child.school)}` : 'Aluno não vinculado'}</div>
            </div>
            <div class="chat-head-actions">
              <span class="badge b-green">${icon('shield')} Canal seguro</span>
              ${guardian ? `<span class="badge b-gray">${esc(K.fmt.maskPhone(guardian.phone))}</span>` : ''}
            </div>
          </div>
          <div class="chat-thread" id="chatThread">${threadMessages(active, 'driver')}</div>
          ${composer('driver')}
        </section>
      </div>`;
  }

  function guardianView() {
    const { guardian } = sessionInfo();
    if (!guardian) {
      return `<div class="panel"><div class="empty"><div class="empty-ico">${icon('alert')}</div><h4>Conta sem vínculo</h4><p>Fale com a coordenação para vincular seu filho a este acesso.</p></div></div>`;
    }
    const conv = K.store.conversationForGuardian(guardian.id);
    const child = K.store.guardianChildren(guardian)[0];
    const driver = K.store.driver();
    if (!conv) {
      return `<div class="panel"><div class="empty"><div class="empty-ico">${icon('message')}</div><h4>Conversa indisponível</h4><p>O canal com o motorista será aberto quando a rota for vinculada.</p></div></div>`;
    }
    K.store.markConversationRead(conv.id, 'guardian');
    const unread = K.store.unreadMessages('guardian', guardian.id);

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">${icon('message')} Canal direto com o motorista</div>
          <h2 class="page-title">Conversas</h2>
          <p class="page-sub">Tire dúvidas, avise sobre a rotina do seu filho e combine a chegada com segurança.</p>
        </div>
        <span class="badge ${unread ? 'b-blue' : 'b-green'}">${unread ? unread + ' nova(s)' : 'Tudo lido'}</span>
      </div>

      <div class="guardian-chat-wrap">
        <section class="card guardian-chat-card">
          <div class="chat-thread-head">
            <div class="avatar photo">${esc(K.fmt.initials(driver.name))}</div>
            <div class="grow" style="min-width:0">
              <div class="strong">${esc(driver.name)}</div>
              <div class="tiny muted">Motorista · ${esc(driver.van.model)} · ${esc(driver.van.plate)}</div>
            </div>
            <span class="badge b-green">${icon('shield')} Verificado</span>
          </div>
          <div class="guardian-child-strip">
            <div class="stat-ico blue" style="width:34px;height:34px;border-radius:10px">${icon('users')}</div>
            <div class="grow">
              <div class="strong" style="font-size:12.5px">${child ? esc(child.name) : 'Aluno não vinculado'}</div>
              <div class="tiny muted">${child ? `${esc(child.school)} · ${esc(child.address)}, ${esc(child.number)}` : 'Fale com o motorista para alinhar o cadastro'}</div>
            </div>
          </div>
          <div class="notice" style="margin:12px 16px 0">${icon('info')}<div><b>Demonstração.</b> As mensagens ficam salvas apenas neste navegador. Em produção, o canal deve usar servidor autenticado e criptografia.</div></div>
          <div class="chat-thread" id="chatThread" style="min-height:340px">${threadMessages(conv, 'guardian')}</div>
          <div class="chat-quick">
            <button class="chat-chip" data-quick="Estou chegando ao ponto de embarque.">Estou chegando</button>
            <button class="chat-chip" data-quick="Hoje meu filho não vai à escola.">Hoje não vai</button>
            <button class="chat-chip" data-quick="Pode confirmar quando estiver chegando, por favor?">Confirmar chegada</button>
          </div>
          ${composer('guardian')}
        </section>

        <aside class="card guardian-chat-side">
          <div class="strong" style="font-size:13px">Contato do motorista</div>
          <div class="list-row" style="padding:10px 0"><div class="stat-ico">${icon('van')}</div><div class="grow"><div class="list-title">${esc(driver.van.model)}</div><div class="list-sub">Placa ${esc(driver.van.plate)} · ${esc(driver.van.color || '')}</div></div></div>
          <div class="list-row" style="padding:10px 0"><div class="stat-ico">${icon('phone')}</div><div class="grow"><div class="list-title">Telefone</div><div class="list-sub">${esc(K.fmt.maskPhone(driver.phone))}</div></div></div>
          <div class="list-row" style="padding:10px 0"><div class="stat-ico">${icon('clock')}</div><div class="grow"><div class="list-title">Janela de atendimento</div><div class="list-sub">${esc(driver.van.hours || '06h às 18h')}</div></div></div>
          <div class="notice neutral" style="margin-top:12px">${icon('shield')}<div>Nunca compartilhe dados de localização do aluno em grupos públicos. Use apenas este canal.</div></div>
          <button class="btn btn-ghost btn-block" style="margin-top:12px" data-go-notifs>${icon('bell')}Ver notificações</button>
        </aside>
      </div>`;
  }

  function render() {
    if (!rootEl) return;
    const { role } = sessionInfo();
    rootEl.innerHTML = role === 'guardian' ? guardianView() : driverView();
    const thread = $('#chatThread');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function send() {
    if (!rootEl) return;
    const input = $('#chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const { role, guardian } = sessionInfo();
    const conv = role === 'guardian'
      ? K.store.conversationForGuardian(guardian.id)
      : K.store.conversation(selected);
    if (!conv) return;
    K.store.sendMessage(conv.id, role, text);
    input.value = '';
    render();
    const newInput = $('#chatInput');
    if (newInput) newInput.focus();
    K.toast('Mensagem enviada', 'O canal foi atualizado.', 'success');
  }

  function mount(root) {
    rootEl = root;
    selected = null;
    render();

    root.addEventListener('click', (ev) => {
      const conv = ev.target.closest('[data-conv]');
      if (conv) {
        selected = conv.getAttribute('data-conv');
        K.store.markConversationRead(selected, 'driver');
        render();
        return;
      }
      const sendBtn = ev.target.closest('[data-send]');
      if (sendBtn) { ev.preventDefault(); send(); return; }
      const quick = ev.target.closest('[data-quick]');
      if (quick) {
        const input = $('#chatInput');
        if (input) { input.value = quick.getAttribute('data-quick'); input.focus(); }
        return;
      }
      if (ev.target.closest('[data-go-notifs]')) {
        location.hash = '#/notificacoes';
      }
    });

    root.addEventListener('submit', (ev) => {
      if (ev.target.matches('[data-chat-form]')) { ev.preventDefault(); send(); }
    });

    root.addEventListener('keydown', (ev) => {
      if (ev.target.id !== 'chatInput') return;
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    });

    const onStorage = (ev) => {
      if (ev.key === 'kombitech.db.v1' || ev.key === 'kombitech.lastActivity.v1') render();
    };
    window.addEventListener('storage', onStorage);
    root._chatStorage = onStorage;
  }

  K.views = K.views || {};
  K.views.mensagens = {
    mount,
    unmount() {
      if (rootEl && rootEl._chatStorage) window.removeEventListener('storage', rootEl._chatStorage);
      rootEl = null;
      selected = null;
    },
    onRoute() {
      if (rootEl) render();
    }
  };
})(window.KT);
