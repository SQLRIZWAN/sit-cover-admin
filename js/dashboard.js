(function () {
  'use strict';

  var visitorSnap = {};

  function num(v) { return Number(v) || 0; }

  function orderRow(o, showStatus) {
    var items = (o.items || []).map(function (i) { return i.name + ' ×' + i.qty; }).join(', ');
    var st = App.orderStatus(o);
    return '<tr>' +
      '<td><b>#' + String(o.id || '').slice(-8).toUpperCase() + '</b></td>' +
      '<td>' + App.fmtDate(o.createdAt) + '</td>' +
      '<td>' + App.esc((o.customer && o.customer.name) || '—') + '<br><small style="color:#6b7280">' + App.esc((o.customer && o.customer.phone) || '') + '</small></td>' +
      '<td style="max-width:230px">' + App.esc(items) + '</td>' +
      '<td><b>' + App.fmtKD(o.total) + '</b></td>' +
      '<td>' + (o.paymentMethod === 'wamd' ? '📲 WAMD' : '💵 COD') + '</td>' +
      (showStatus ? '<td><span class="badge ' + App.esc(st) + '">' + App.esc(st) + '</span></td>' : '') +
      '<td style="text-align:right"><a class="btn btn-ghost btn-sm" href="orders.html?o=' + encodeURIComponent(o.id || '') + '">Open</a></td>' +
    '</tr>';
  }

  function tableHTML(rows) {
    if (!rows) return '';
    return '<div class="tbl-wrap"><table class="tbl">' +
      '<tr><th>Order</th><th>When</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr>' +
      rows + '</table></div>';
  }

  function emptyBox(big, title, sub) {
    return '<div class="empty-box"><div class="big">' + big + '</div><b>' + title + '</b>' + (sub || '') + '</div>';
  }

  function snapshotToArray(snap) {
    var arr = [];
    snap.forEach(function (ch) {
      var v = ch.val() || {};
      v.id = v.id || ch.key;
      arr.push(v);
    });
    return arr;
  }

  function updateActive() {
    var now = Date.now();
    var active = 0;
    for (var k in visitorSnap) {
      var v = visitorSnap[k];
      if (v && v.lastSeen && now - v.lastSeen < 5 * 60 * 1000) active++;
    }
    var el = document.getElementById('stActive');
    if (el) el.textContent = active;
  }

  App.onAuth(function (user) {
    var DB = App.DB;

    try {
      document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kuwait', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
      });
    } catch (e) {}

    DB.ref('stats/allTime').on('value', function (s) {
      var v = s.val() || {};
      document.getElementById('stSales').textContent = num(v.orders);
      document.getElementById('stRevenue').textContent = App.fmtKD(v.revenue);
    });

    DB.ref('stats/daily/' + App.todayKey()).on('value', function (s) {
      var v = s.val() || {};
      document.getElementById('stToday').textContent = num(v.orders);
      document.getElementById('stTodayRev').textContent = App.fmtKD(v.revenue) + ' revenue today';
    });

    DB.ref('stats/customers').on('value', function (s) {
      document.getElementById('stUsers').textContent = s.numChildren();
    });

    DB.ref('stats/visitors').on('value', function (s) {
      visitorSnap = {};
      s.forEach(function (ch) { visitorSnap[ch.key] = ch.val(); });
      document.getElementById('stVisitors').textContent = s.numChildren();
      updateActive();
    });
    setInterval(updateActive, 20000);

    DB.ref('orders').orderByChild('status').equalTo('new').on('value', function (s) {
      document.getElementById('stNew').textContent = s.numChildren();
      var box = document.getElementById('newOrders');
      var arr = snapshotToArray(s);
      arr.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!arr.length) {
        box.innerHTML = emptyBox('✨', 'No new orders right now', 'New orders appear here instantly.');
        return;
      }
      box.innerHTML = tableHTML(arr.map(function (o) { return orderRow(o, false); }).join(''));
    });

    DB.ref('orders').orderByChild('createdAt').limitToLast(15).on('value', function (s) {
      var box = document.getElementById('recentOrders');
      var arr = snapshotToArray(s);
      arr.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!arr.length) {
        box.innerHTML = emptyBox('🧾', 'No orders yet', 'Orders from the website will show up here live.');
        return;
      }
      box.innerHTML = tableHTML(arr.map(function (o) { return orderRow(o, true); }).join(''));
    });
  });
})();
