(function () {
  'use strict';

  var orders = [];
  var filter = 'all';
  var openId = null;

  function el(id) { return document.getElementById(id); }

  var STATUS_LABEL = {
    new: '🆕 New',
    confirmed: '✅ Confirmed',
    delivered: '📦 Delivered',
    cancelled: '❌ Cancelled'
  };

  function shortId(o) { return '#' + String(o.id || '').slice(-8).toUpperCase(); }

  function itemSummary(o) {
    return (o.items || []).map(function (i) { return i.name + ' ×' + i.qty; }).join(', ');
  }

  function render() {
    var list = orders.filter(function (o) {
      return filter === 'all' || App.orderStatus(o) === filter;
    });
    list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

    el('ordCount').textContent = 'showing ' + list.length + ' of ' + orders.length;
    el('ordSub').textContent = App.connected
      ? 'Live from the website — times in Kuwait'
      : 'Connecting to Firebase…';

    if (!list.length) {
      el('oList').innerHTML = '<div class="empty-box"><div class="big">🧾</div><b>No ' +
        (filter === 'all' ? '' : STATUS_LABEL[filter] || filter + ' ') + 'orders</b>' +
        'New website orders appear here instantly.<div style="margin-top:14px">' +
        '<a class="btn btn-ghost" href="index.html">← Back to dashboard</a></div></div>';
      return;
    }

    el('oList').innerHTML = '<div class="olist">' + list.map(function (o) {
      var st = App.orderStatus(o);
      var cust = o.customer || {};
      return '<div class="ocard" data-id="' + App.esc(o.id) + '">' +
        '<div class="oc-main">' +
          '<div class="oc-l">' +
            '<b>' + shortId(o) + '</b> <span class="badge ' + App.esc(st) + '">' + App.esc(STATUS_LABEL[st] || st) + '</span>' +
            '<div class="oc-cust">' + App.esc(cust.name || 'Customer') + ' · ' + App.esc(cust.phone || '') + '</div>' +
            '<div class="oc-items">' + App.esc(itemSummary(o)) + '</div>' +
            '<div class="oc-meta">' + App.fmtDate(o.createdAt) + ' · ' +
              (o.paymentMethod === 'wamd' ? '📲 WAMD' : '💵 COD') +
              (o.distanceKm != null ? ' · ' + Number(o.distanceKm).toFixed(1) + ' km' : '') +
              (o.whatsappSent ? ' · 🟢 WhatsApp sent' : '') +
            '</div>' +
          '</div>' +
          '<div class="oc-r">' +
            '<div class="oc-total">' + App.fmtKD(o.total) + '</div>' +
            '<button class="btn btn-ghost btn-sm oc-open">View ▸</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';

    $$('.ocard').forEach(function (c) {
      c.addEventListener('click', function () {
        openOrder(c.getAttribute('data-id'));
      });
    });
  }

  function findOrder(id) {
    for (var i = 0; i < orders.length; i++) if (orders[i].id === id) return orders[i];
    return null;
  }

  function openOrder(id) {
    var o = findOrder(id);
    if (!o) return;
    openId = id;
    var cfg = App.state.config || {};
    var cust = o.customer || {};
    var st = App.orderStatus(o);

    el('omTitle').textContent = 'Order ' + shortId(o) + ' — ' + (STATUS_LABEL[st] || st);

    var items = (o.items || []).map(function (it) {
      var thumb = it.image ? App.mediaThumb(it.image, 120) : '';
      return '<tr>' +
        '<td style="width:56px">' + (thumb ? '<img class="mini" src="' + App.esc(thumb) + '" alt="">' : '📦') + '</td>' +
        '<td>' + App.esc(it.name) + '</td>' +
        '<td>×' + Number(it.qty || 1) + '</td>' +
        '<td style="text-align:right"><b>' + App.fmtKD(Number(it.price) * Number(it.qty)) + '</b></td>' +
      '</tr>';
    }).join('');

    var mapUrl = cust.lat != null
      ? 'https://maps.google.com/?q=' + cust.lat + ',' + cust.lng
      : null;

    var shot = (o.paymentScreenshot && o.paymentScreenshot.url)
      ? '<div class="field"><label>Payment screenshot</label>' +
        '<a href="' + App.esc(o.paymentScreenshot.url) + '" target="_blank" rel="noopener">' +
        '<img class="shot" src="' + App.esc(o.paymentScreenshot.url) + '" alt="payment screenshot"></a></div>'
      : '';

    el('omBody').innerHTML =
      '<div class="row2">' +
        '<div class="field"><label>Placed</label><div class="val">' + App.fmtDate(o.createdAt) + '</div></div>' +
        '<div class="field"><label>Payment</label><div class="val">' +
          (o.paymentMethod === 'wamd' ? '📲 WAMD (prepaid)' : '💵 Cash on Delivery') + '</div></div>' +
      '</div>' +
      '<div class="field"><label>Items</label>' +
        '<div class="tbl-wrap"><table class="tbl">' + items + '</table></div></div>' +
      '<div class="row2">' +
        '<div class="field"><label>Subtotal</label><div class="val">' + App.fmtKD(o.subtotal) + '</div></div>' +
        '<div class="field"><label>Delivery' +
          (o.distanceKm != null ? ' (' + Number(o.distanceKm).toFixed(1) + ' km)' : '') + '</label>' +
          '<div class="val">' + App.fmtKD(o.deliveryFee) + '</div></div>' +
      '</div>' +
      '<div class="field"><label>Total</label><div class="val big-v">' + App.fmtKD(o.total) + '</div></div>' +
      '<div class="row2">' +
        '<div class="field"><label>Customer</label><div class="val">' +
          App.esc(cust.name || '—') + '<br>' + App.esc(cust.phone || '') + '</div></div>' +
        '<div class="field"><label>Address</label><div class="val">' + App.esc(cust.address || 'not specified') +
          (mapUrl ? '<br><a href="' + mapUrl + '" target="_blank" rel="noopener">📍 Open in Google Maps</a>' : '') +
        '</div></div>' +
      '</div>' + shot;

    var shopWaText = '';
    try { shopWaText = App.buildWaMessage(o, cfg); } catch (e) {}
    var shopLink = App.waLink(cfg.whatsappNumber || cfg.ownerPhone, shopWaText);
    var custNum = String(cust.phone || '').replace(/[^0-9]/g, '');
    if (custNum && custNum[0] === '0') custNum = '965' + custNum.slice(1);
    var custLink = custNum ? 'https://wa.me/' + custNum : null;

    el('omFoot').innerHTML =
      (st === 'new' ? '<button class="btn btn-ghost" data-act="confirmed">✅ Confirm</button>' : '') +
      (st === 'confirmed' ? '<button class="btn btn-pri" data-act="delivered">📦 Mark Delivered</button>' : '') +
      (st !== 'cancelled' && st !== 'delivered'
        ? '<button class="btn btn-danger" data-act="cancelled">❌ Cancel order</button>' : '') +
      (st === 'cancelled' || st === 'delivered' ? '<button class="btn btn-ghost" data-act="new">↩ Reopen as new</button>' : '') +
      (shopLink ? '<a class="btn btn-ghost" href="' + shopLink + '" target="_blank" rel="noopener">📲 WhatsApp order</a>' : '') +
      (custLink ? '<a class="btn btn-ghost" href="' + custLink + '" target="_blank" rel="noopener">💬 Chat customer</a>' : '') +
      '<button class="btn btn-ghost" data-act="close">Close</button>';

    $$('#omFoot [data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act');
        if (act === 'close') { closeModal(); return; }
        setStatus(openId, act);
      });
    });

    el('mMask').classList.add('on');
    el('oModal').classList.add('on');
  }

  function closeModal() {
    el('mMask').classList.remove('on');
    el('oModal').classList.remove('on');
    openId = null;
  }

  function setStatus(id, st) {
    if (!id) return;
    App.DB.ref('orders/' + id).update({
      status: st,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function () {
      App.toast('Order → ' + (STATUS_LABEL[st] || st) + ' ✓', 'ok');
      closeModal();
    }).catch(function (e) {
      App.toast('Update failed: ' + e.message, 'err');
    });
  }

  function bindStatic() {
    $$('#statusChips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('#statusChips .chip').forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        filter = chip.getAttribute('data-st');
        render();
      });
    });

    el('omClose').addEventListener('click', closeModal);
    el('mMask').addEventListener('click', function () {
      if (el('oModal').classList.contains('on')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el('oModal').classList.contains('on')) closeModal();
    });
  }

  bindStatic();

  App.onAuth(function () {
    var DB = App.DB;
    DB.ref('orders').orderByChild('createdAt').limitToLast(200).on('value', function (s) {
      orders = [];
      s.forEach(function (ch) {
        var v = ch.val() || {};
        v.id = v.id || ch.key;
        orders.push(v);
      });
      render();

      if (!openId) {
        try {
          var want = new URLSearchParams(location.search).get('o');
          if (want) openOrder(want);
        } catch (e) {}
      }
    });
  });
})();
