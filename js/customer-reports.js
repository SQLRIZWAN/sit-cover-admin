(function () {
  'use strict';
  var box = document.getElementById('reportList');
  function render(list) {
    if (!list.length) { box.innerHTML = '<div class="empty-box"><b>No customer reports</b>Reports submitted from the website will appear here.</div>'; return; }
    box.innerHTML = '<div class="olist">' + list.map(function (r) {
      return '<div class="ocard"><div class="oc-main"><div class="oc-l"><b>' + App.esc(r.type || 'Report') + '</b> <span class="badge ' + (r.status === 'resolved' ? 'delivered' : 'new') + '">' + (r.status === 'resolved' ? 'Resolved' : 'New') + '</span><div class="oc-cust">' + App.esc(r.name || 'Anonymous') + (r.phone ? ' · ' + App.esc(r.phone) : '') + '</div><div class="oc-items">' + App.esc(r.message || '') + '</div><div class="oc-meta">' + App.fmtDate(r.createdAt) + '</div></div><div class="oc-r">' + (r.status === 'resolved' ? '' : '<button class="btn btn-pri btn-sm" data-id="' + App.esc(r.id) + '">Mark resolved</button>') + '</div></div></div>';
    }).join('') + '</div>';
    box.querySelectorAll('[data-id]').forEach(function (b) { b.addEventListener('click', function () { App.DB.ref('reports/' + b.getAttribute('data-id')).update({ status: 'resolved' }); }); });
  }
  App.onAuth(function () { App.DB.ref('reports').limitToLast(200).on('value', function (s) { var list = []; s.forEach(function (c) { var r = c.val() || {}; r.id = c.key; list.unshift(r); }); render(list); }); });
})();
