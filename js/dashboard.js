(function () {
  'use strict';

  var visitorSnap = {};

  function num(v) { return Number(v) || 0; }

  function orderCard(o, showStatus) {
    var items = (o.items || []).map(function (i) { return i.name + ' ×' + i.qty; }).join(', ');
    var st = App.orderStatus(o);
    var name = (o.customer && o.customer.name) || 'Customer';
    var phone = (o.customer && o.customer.phone) || '';
    return '<div class="dorder">' +
      '<b class="dorder-id">#' + String(o.id || '').slice(-8).toUpperCase() + '</b>' +
      '<b class="dorder-tot">' + App.fmtKD(o.total) + '</b>' +
      '<div class="dorder-meta">' +
        '<span>' + App.fmtDate(o.createdAt) + '</span>' +
        '<span class="dsep">·</span>' +
        '<span>' + (o.paymentMethod === 'wamd' ? '📲 WAMD' : '💵 COD') + '</span>' +
        (showStatus ? '<span class="badge ' + App.esc(st) + '">' + App.esc(st) + '</span>' : '') +
      '</div>' +
      '<div class="dorder-cust">' + App.esc(name) + (phone ? ' · ' + App.esc(phone) : '') + '</div>' +
      '<div class="dorder-items">' + App.esc(items || '—') + '</div>' +
      '<a class="btn btn-ghost btn-sm dorder-open" href="orders.html?o=' + encodeURIComponent(o.id || '') + '">Open</a>' +
    '</div>';
  }

  function listHTML(cards) {
    if (!cards) return '';
    return '<div class="dorders">' + cards + '</div>';
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

    DB.ref('stats/users').on('value', function (s) {
      var m = document.getElementById('stMembers');
      if (m) m.textContent = s.numChildren();
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
      box.innerHTML = listHTML(arr.map(function (o) { return orderCard(o, false); }).join(''));
    });

    DB.ref('orders').orderByChild('createdAt').limitToLast(15).on('value', function (s) {
      var box = document.getElementById('recentOrders');
      var arr = snapshotToArray(s);
      arr.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!arr.length) {
        box.innerHTML = emptyBox('🧾', 'No orders yet', 'Orders from the website will show up here live.');
        return;
      }
      box.innerHTML = listHTML(arr.map(function (o) { return orderCard(o, true); }).join(''));
    });

    // Show whether visitor counting is on or off right on the dashboard card,
    // with a shortcut to the Settings → Analytics toggle.
    var paintVisitorFlag = function () {
      var card = document.querySelector('.stat .sv#stVisitors');
      if (!card) return;
      var wrap = card.parentElement;
      var on = !!(App.state.config && App.state.config.visitorCountingEnabled === true);
      var sub = wrap.querySelector('.ss');
      if (sub) {
        sub.textContent = on ? 'unique devices • counting ON' : 'counting OFF — turn on in Settings';
        sub.style.color = on ? '#16a34a' : '#dc2626';
        sub.style.fontWeight = '700';
      }
    };
    paintVisitorFlag();
    App.on('config', paintVisitorFlag);
  });
})();
