(function () {
  'use strict';

  var box = document.getElementById('reportList');

  function render(list) {
    if (!list.length) {
      box.innerHTML = '<div class="empty-box"><b>No customer reports</b>' +
        'Reports submitted from the website will appear here.</div>';
      return;
    }

    box.innerHTML = '<div class="olist">' + list.map(function (r) {
      var resolved = r.status === 'resolved';
      var shot = r.image
        ? '<button type="button" class="rp-thumb" data-img="' + App.esc(r.image) +
          '" data-alt="' + App.esc(r.name || 'Report') + ' screenshot" title="Open screenshot full size">' +
          '<img src="' + App.esc(r.image) + '" alt="report screenshot" loading="lazy"></button>'
        : '';
      return '<div class="ocard">' +
        '<div class="oc-main">' +
          '<div class="oc-l">' +
            '<b>' + App.esc(r.type || 'Report') + '</b> ' +
            '<span class="badge ' + (resolved ? 'delivered' : 'new') + '">' +
              (resolved ? 'Resolved' : 'New') + '</span>' +
            '<div class="oc-cust">' + App.esc(r.name || 'Anonymous') +
              (r.phone ? ' · ' + App.esc(r.phone) : '') + '</div>' +
            '<div class="oc-items">' + App.esc(r.message || '') + '</div>' +
            '<div class="oc-meta">' + App.fmtDate(r.createdAt) + '</div>' +
            (shot ? '<div class="rp-shots">' + shot + '</div>' : '') +
          '</div>' +
          '<div class="oc-r">' +
            (resolved ? '' :
              '<button class="btn btn-pri btn-sm" data-id="' + App.esc(r.id) + '">Mark resolved</button>') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';

    box.querySelectorAll('[data-id]').forEach(function (b) {
      b.addEventListener('click', function () {
        App.DB.ref('reports/' + b.getAttribute('data-id')).update({ status: 'resolved' });
      });
    });
    // Screenshot opens full size instead of being squeezed into the card.
    box.querySelectorAll('[data-img]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        App.viewImage(b.getAttribute('data-img'), b.getAttribute('data-alt'));
      });
    });
  }

  App.onAuth(function () {
    App.DB.ref('reports').limitToLast(200).on('value', function (s) {
      var list = [];
      s.forEach(function (c) { var r = c.val() || {}; r.id = c.key; list.unshift(r); });
      render(list);
    });
  });
})();
