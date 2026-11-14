// Rodapé com o acesso do administrador. O público só visualiza; só o admin faz login e vê a aba Administração.
(() => {
  const conta = window.claude && window.claude.conta;
  const raiz = document.querySelector('.idt');
  const pe = document.createElement('footer');
  pe.className = 'idt-rodape';
  raiz.append(pe);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    kids.flat().forEach((k) => k != null && e.append(k));
    return e;
  };

  const dlg = el('dialog', { class: 'idt-ajuda idt-login', 'aria-labelledby': 'idt-login-tit' });
  raiz.append(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  function formulario(modo) {
    // modo: 'entrar' | 'esqueci' | 'nova'
    const msg = el('p', { class: 'idt-login-msg', role: 'alert', hidden: '' });
    const aviso = (t, ok) => { msg.textContent = t; msg.hidden = false; msg.className = 'idt-login-msg' + (ok ? ' ok' : ''); };
    const email = el('input', { class: 'idt-input', type: 'email', id: 'idt-login-email', autocomplete: 'username', required: '' });
    const senha = el('input', { class: 'idt-input', type: 'password', id: 'idt-login-senha', autocomplete: modo === 'nova' ? 'new-password' : 'current-password', required: '', minlength: modo === 'nova' ? '8' : null });
    const btn = el('button', { class: 'idt-btn primary', type: 'submit' }, modo === 'entrar' ? 'Entrar' : modo === 'esqueci' ? 'Enviar link' : 'Salvar senha');
    const form = el('form', { class: 'idt-login-form' },
      modo !== 'nova' ? el('div', { class: 'idt-field' }, el('label', { for: 'idt-login-email' }, 'E-mail'), email) : null,
      modo !== 'esqueci' ? el('div', { class: 'idt-field' }, el('label', { for: 'idt-login-senha' }, modo === 'nova' ? 'Nova senha (mínimo 8 caracteres)' : 'Senha'), senha) : null,
      msg, btn,
      modo === 'entrar' ? el('button', { class: 'idt-btn ghost sm', type: 'button', onclick: () => abrir('esqueci') }, 'Esqueci a senha') : null,
      modo === 'esqueci' ? el('button', { class: 'idt-btn ghost sm', type: 'button', onclick: () => abrir('entrar') }, 'Voltar') : null);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true; msg.hidden = true;
      try {
        if (modo === 'entrar') {
          const r = await conta.entrar(email.value.trim(), senha.value);
          if (r.ok) { location.hash = 'admin'; location.reload(); return; }
          aviso(r.motivo);
        } else if (modo === 'esqueci') {
          const r = await conta.esqueci(email.value.trim());
          aviso(r.ok ? 'Se este e-mail for de um administrador, chega um link para criar uma senha nova.' : r.motivo, r.ok);
        } else {
          const r = await conta.novaSenha(senha.value);
          if (r.ok) { aviso('Senha salva. Recarregando…', true); setTimeout(() => { location.hash = 'admin'; location.reload(); }, 800); return; }
          aviso(r.motivo);
        }
      } catch (err) { aviso('Não foi possível agora. Confira a conexão e tente de novo.'); }
      btn.disabled = false;
    });
    return form;
  }
  function abrir(modo) {
    const titulo = modo === 'entrar' ? 'Entrar como administrador' : modo === 'esqueci' ? 'Esqueci a senha' : 'Criar senha nova';
    dlg.replaceChildren(
      el('div', { class: 'idt-ajuda-head' }, el('h2', { id: 'idt-login-tit' }, titulo), el('button', { type: 'button', class: 'idt-btn ghost idt-ajuda-x', 'aria-label': 'Fechar', onclick: () => dlg.close() }, '×')),
      el('p', { class: 'idt-note' }, modo === 'entrar' ? 'Só para quem lança as provas. Para ver o painel não precisa entrar.' : modo === 'esqueci' ? 'Digite o e-mail do administrador.' : 'Escolha a senha nova do administrador.'),
      formulario(modo));
    if (!dlg.open) dlg.showModal();
    const f = dlg.querySelector('input'); if (f) f.focus();
  }

  async function desenhar() {
    pe.replaceChildren();
    const marca = el('span', {}, 'Inimigos do Traçado · temporada de kart');
    if (!conta) { pe.append(marca, el('span', { class: 'idt-note' }, 'Modo local')); return; }
    const email = await conta.email();
    if (email && window.IDT && IDT.canEdit) {
      pe.append(marca, el('span', { class: 'idt-rodape-conta' }, 'Administrador: ' + email + ' · ',
        el('button', { type: 'button', class: 'idt-rodape-link', onclick: async () => { await conta.sair(); location.hash = ''; location.reload(); } }, 'Sair')));
    } else {
      pe.append(marca, el('button', { type: 'button', class: 'idt-rodape-link', onclick: () => abrir('entrar') }, 'Área do administrador'));
    }
  }
  window.addEventListener('idt-nova-senha', () => abrir('nova'));
  if (window.IDT) IDT.aoMudar(() => { if (!desenhar.feito && IDT.carregado.provas) { desenhar.feito = true; desenhar(); } });
  desenhar();
})();
