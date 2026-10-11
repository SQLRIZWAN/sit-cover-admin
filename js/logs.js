(function () {
  'use strict';

  var entries = [];
  var query = '';
  var attached = false;

  function el(id) { return document.getElementById(id); }
  function esc(v) { return App.esc(v); }

  var ACTION_LABEL = {
    login: '🔐 Login',
    logout: '🚪 Logout',
    'order-status': '🧾 Order status',
    'order-delete': '🗑 Order deleted',
    'order-delivery': '📅 Delivery plan',
    'product-add': '📦 Product added',
    'product-edit': '✏️ Product edited',
    'product-delete': '🗑 Product deleted',
    'category-add': '🗂️ Category added',
    'category-edit': '🗂️ Category edited',
    'category-delete': '🗑 Category deleted',
    'category-reorder': '↕️ Categories reordered',
    'settings-save': '⚙️ Settings saved',
    'brand-upload': '🎨 Branding updated',
    'reset-all': '🔄 Stats reset to 0',
    'kill-zone': '💀 Danger buttons hidden',
    'report-resolve': '📝 Customer report action'
  };

  function matches(e) {
    if (!query) return true;
    var hay = ((e.action || '') + ' ' + (e.actor || '') + ' ' + (e.detail || '')).toLowerCase();
    return hay.indexOf(query) >= 0;
  }

  function render() {
    var limit = Number(el('logLimit') && el('logLimit').value) || 100;
    var list = entries.filter(matches).slice(0, limit);

    var box = el('logList');
    if (!box) return;

    if (!entries.length) {
      box.innerHTML = '<div class="empty-box"><div class="big">📜</div><b>No admin actions yet</b>' +
        'Login, order changes, product edits and settings saves will appear here with date and time.</div>';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="empty-box"><div class="big">🔍</div><b>No matching entries</b>' +
        'Nothing matches “' + esc(query) + '”.</div>';
      return;
    }

    box.innerHTML = '<div class="log-list">' + list.map(function (e) {
      var label = ACTION_LABEL[e.action] || e.action || 'Action';
      return '<div class="log-row">' +
        '<div class="log-when">' + esc(App.fmtDate(e.at)) + '</div>' +
        '<div class="log-who" title="' + esc(e.actor || '') + '">' + esc(e.actor || '—') + '</div>' +
        '<div class="log-what"><b>' + esc(label) + '</b>' +
          (e.detail ? '<span>' + esc(e.detail) + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function snapshotToArray(snap) {
    var arr = [];
    snap.forEach(function (ch) {
      var v = ch.val() || {};
      v.id = ch.key;
      arr.push(v);
    });
    return arr;
  }

  function attach() {
    if (attached || !App.DB || !App.user) return;
    attached = true;
    App.DB.ref('adminLogs').orderByChild('at').limitToLast(500).on('value', function (s) {
      entries = snapshotToArray(s);
      entries.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      render();
    }, function (err) {
      el('logList').innerHTML = '<div class="empty-box"><b>Cannot read the admin log</b>' +
        esc((err && err.message) || 'The database refused this request.') + '</div>';
    });
  }

  function init() {
    var s = el('logSearch');
    if (s) {
      var t = null;
      s.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          query = String(s.value || '').trim().toLowerCase();
          render();
        }, 120);
      });
    }
    var lim = el('logLimit');
    if (lim) lim.addEventListener('change', render);

    App.onAuth(function (user) {
      if (user) attach();
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
