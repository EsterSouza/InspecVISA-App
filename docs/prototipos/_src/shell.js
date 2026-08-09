/* ==========================================================================
   Comportamento compartilhado pelos três protótipos.
   Sem dependência externa: o artefato publicado bloqueia host de terceiro.
   ========================================================================== */
(function () {
  'use strict';

  /* --- Tema: claro e escuro são um sistema só ----------------------------- */
  var root = document.documentElement;
  var STORE = 'inspecvisa-proto-tema';

  try {
    var saved = localStorage.getItem(STORE);
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) { /* armazenamento indisponível */ }

  function currentTheme() {
    var attr = root.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(STORE, next); } catch (e) { /* ignora */ }
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(next === 'dark'));
      var lbl = btn.querySelector('[data-theme-label]');
      if (lbl) lbl.textContent = next === 'dark' ? 'Escuro' : 'Claro';
    });
    window.dispatchEvent(new CustomEvent('temachange', { detail: { theme: next } }));
  }

  document.addEventListener('click', function (ev) {
    var toggle = ev.target.closest('[data-theme-toggle]');
    if (!toggle) return;
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  /* --- Avisos (toast) ------------------------------------------------------ */
  var toaster = null;
  function getToaster() {
    if (!toaster) {
      toaster = document.querySelector('.toaster');
      if (!toaster) {
        toaster = document.createElement('div');
        toaster.className = 'toaster';
        document.body.appendChild(toaster);
      }
    }
    return toaster;
  }

  var MARKS = { success: '✓', error: '!', info: 'i', attention: '!' };

  window.avisar = function (opts) {
    var kind = opts.kind || 'info';
    var host = getToaster();
    if (host.children.length >= 3) host.removeChild(host.firstElementChild);

    var el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    // erro e atenção usam alert (interrompe); sucesso e info usam status (não interrompe)
    el.setAttribute('role', kind === 'error' || kind === 'attention' ? 'alert' : 'status');

    var mark = document.createElement('span');
    mark.className = 'toast__mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = MARKS[kind] || 'i';

    var text = document.createElement('div');
    text.className = 'toast__text grow';
    var title = document.createElement('p');
    title.className = 'toast__title';
    title.textContent = opts.title || '';
    text.appendChild(title);
    if (opts.body) {
      var body = document.createElement('p');
      body.className = 'muted';
      body.textContent = opts.body;
      text.appendChild(body);
    }

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn--ghost btn--icon btn--sm toast__close';
    close.setAttribute('aria-label', 'Fechar aviso');
    close.textContent = '✕';

    el.appendChild(mark); el.appendChild(text); el.appendChild(close);
    host.appendChild(el);

    var timer = null;
    function dismiss() {
      if (timer) clearTimeout(timer);
      el.setAttribute('data-leaving', 'true');
      setTimeout(function () { el.remove(); }, 180);
    }
    close.addEventListener('click', dismiss);

    // Erro não some sozinho: some antes de a pessoa terminar de ler.
    if (kind !== 'error') {
      var ms = kind === 'attention' ? 6000 : 4000;
      timer = setTimeout(dismiss, ms);
      el.addEventListener('mouseenter', function () { if (timer) clearTimeout(timer); });
      el.addEventListener('mouseleave', function () { timer = setTimeout(dismiss, ms); });
    }
    return dismiss;
  };

  /* --- Modal e gaveta ------------------------------------------------------ */
  /* <dialog> nativo já dá trap de foco, Esc e devolução do foco. Falta fechar
     no backdrop e travar a rolagem de fundo. */
  function wireDialog(dlg) {
    if (dlg.dataset.wired === 'true') return;
    dlg.dataset.wired = 'true';

    dlg.addEventListener('click', function (ev) {
      if (ev.target !== dlg) return;            // clique dentro do conteúdo não fecha
      if (dlg.dataset.guard === 'true') return; // fluxo com alteração pendente
      dlg.close('backdrop');
    });
    dlg.addEventListener('close', function () {
      if (!document.querySelector('dialog[open]')) document.body.style.overflow = '';
    });
  }

  function openDialog(id) {
    var dlg = document.getElementById(id);
    if (!dlg) return;
    wireDialog(dlg);
    document.body.style.overflow = 'hidden';
    dlg.showModal();
    var first = dlg.querySelector('[data-autofocus]');
    if (first) first.focus();
  }
  window.abrirDialogo = openDialog;

  document.addEventListener('click', function (ev) {
    var opener = ev.target.closest('[data-open]');
    if (opener) { ev.preventDefault(); openDialog(opener.getAttribute('data-open')); return; }

    var closer = ev.target.closest('[data-close]');
    if (closer) {
      var dlg = closer.closest('dialog');
      if (dlg) { ev.preventDefault(); dlg.close('botao'); }
    }
  });

  /* --- Abas (WCAG: setas navegam, Home/End vão às pontas) ------------------ */
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));

    function select(tab, moveFocus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (moveFocus) tab.focus();
      if (list.dataset.syncHash === 'true') {
        var key = tab.getAttribute('data-tab');
        if (key) history.replaceState(null, '', '#' + key);
      }
    }

    list.addEventListener('click', function (ev) {
      var tab = ev.target.closest('[role="tab"]');
      if (tab) select(tab, false);
    });

    list.addEventListener('keydown', function (ev) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = null;
      if (ev.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (ev.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (ev.key === 'Home') next = tabs[0];
      else if (ev.key === 'End') next = tabs[tabs.length - 1];
      if (next) { ev.preventDefault(); select(next, true); }
    });

    if (list.dataset.syncHash === 'true') {
      var hash = location.hash.replace('#', '');
      var match = hash && tabs.filter(function (t) { return t.getAttribute('data-tab') === hash; })[0];
      if (match) select(match, false);
    }
  });

  /* --- Ordenação de tabela (demonstra o estado, não reordena de verdade) --- */
  document.addEventListener('click', function (ev) {
    var th = ev.target.closest('.th-sort');
    if (!th) return;
    var table = th.closest('table');
    var current = th.getAttribute('aria-sort');
    table.querySelectorAll('.th-sort').forEach(function (o) { o.setAttribute('aria-sort', 'none'); });
    th.setAttribute('aria-sort', current === 'ascending' ? 'descending' : 'ascending');
  });

  /* --- Contraste medido ao vivo ------------------------------------------- */
  function srgb(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

  function luminance(rgb) {
    return 0.2126 * srgb(rgb[0] / 255) + 0.7152 * srgb(rgb[1] / 255) + 0.0722 * srgb(rgb[2] / 255);
  }

  function parseColor(value) {
    var probe = document.createElement('span');
    probe.style.color = value;
    probe.style.display = 'none';
    document.body.appendChild(probe);
    var resolved = getComputedStyle(probe).color;
    probe.remove();
    var m = resolved.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0];
    return m[1].split(',').slice(0, 3).map(function (n) { return parseFloat(n); });
  }

  window.contraste = function (fgVar, bgVar) {
    var s = getComputedStyle(root);
    var fg = luminance(parseColor(s.getPropertyValue(fgVar).trim()));
    var bg = luminance(parseColor(s.getPropertyValue(bgVar).trim()));
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  };

  window.medirContrastes = function () {
    document.querySelectorAll('[data-fg][data-bg]').forEach(function (el) {
      var min = parseFloat(el.getAttribute('data-min') || '4.5');
      var r = window.contraste(el.getAttribute('data-fg'), el.getAttribute('data-bg'));
      var ok = r + 0.005 >= min;
      var out = el.querySelector('[data-ratio]');
      if (out) out.textContent = r.toFixed(2) + ':1';
      var verdict = el.querySelector('[data-verdict]');
      if (verdict) {
        verdict.textContent = ok ? 'passa AA' : 'REPROVA';
        verdict.className = 'badge ' + (ok ? 'badge--success' : 'badge--danger');
      }
    });
  };

  window.addEventListener('temachange', function () { window.medirContrastes(); });

  /* O artefato publicado também troca o tema por fora, carimbando data-theme na
     raiz. Sem observar isso, os números de contraste ficariam do tema anterior. */
  new MutationObserver(function () {
    var next = currentTheme();
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(next === 'dark'));
      var lbl = btn.querySelector('[data-theme-label]');
      if (lbl) lbl.textContent = next === 'dark' ? 'Escuro' : 'Claro';
    });
    window.medirContrastes();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('DOMContentLoaded', function () {
    setTheme(currentTheme());
    window.medirContrastes();
  });
})();
