(function () {
  'use strict';

  var orders = [];
  var filter = 'all';
  var openId = null;

  function el(id) { return document.getElementById(id); }

  var STATUS_LABEL = {
    new: '⏳ Pending',
    confirmed: '✅ Confirmed',
    shipped: '🚚 Out for delivery',
    delivered: '📦 Completed',
    cancelled: '❌ Cancelled'
  };

  // Screenshot data URLs live in their own node — fetch them once so every
  // order card can show a small payment-proof thumbnail.
  var shots = {};
  function shotUrl(o) {
    return (o && o.paymentScreenshot) ? (shots[o.id] || '') : '';
  }

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
      var items = o.items || [];
      var qty = items.reduce(function (s, i) { return s + Number(i.qty || 1); }, 0);
      var shot = shotUrl(o);
      return '<div class="ocard" data-id="' + App.esc(o.id) + '">' +
        '<div class="oc-main">' +
          '<div class="oc-l">' +
            '<div class="oc-top">' +
              '<b>' + shortId(o) + '</b> ' +
              '<span class="badge ' + App.esc(st) + '">' + App.esc(STATUS_LABEL[st] || st) + '</span>' +
              (o.whatsappSent ? '<span class="badge wa">💬 WhatsApp</span>' : '') +
            '</div>' +
            '<div class="oc-cust">' + App.esc(cust.name || 'Customer') + ' · ' + App.esc(cust.phone || '—') + '</div>' +
            (cust.address ? '<div class="oc-addr">📍 ' + App.esc(cust.address) + '</div>' : '') +
            '<div class="oc-items">' + App.esc(itemSummary(o)) + '</div>' +
            '<div class="oc-meta">' + App.fmtDate(o.createdAt) + ' · ' + items.length +
              (items.length === 1 ? ' item' : ' items') + ' · ' + qty + ' pc' +
              ' · ' + (o.paymentMethod === 'wamd' ? '📲 WAMD' : '💵 COD') +
              (o.distanceKm != null ? ' · ' + Number(o.distanceKm).toFixed(1) + ' km' : '') +
            '</div>' +
          '</div>' +
          '<div class="oc-r">' +
            '<div class="oc-total">' + App.fmtKD(o.total) + '</div>' +
            (o.paymentScreenshot
              ? '<div class="oc-shot" data-shot="' + App.esc(o.id) + '" title="Payment screenshot">' +
                  (shot ? '<img src="' + App.esc(shot) + '" alt="payment screenshot">' : '<span>📸</span>') +
                '</div>'
              : '') +
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

    var shot = o.paymentScreenshot
      ? '<div class="field"><label>Payment screenshot</label><div id="shotBox"><div class="empty-box" style="padding:14px"><b>Loading screenshot…</b></div></div></div>'
      : '<div class="field"><label>Payment screenshot</label><div class="val muted-v">Not uploaded — ' +
        (o.paymentMethod === 'wamd' ? 'WAMD payment without proof' : 'Cash on Delivery') + '</div></div>';

    var acct = (o.uid || o.email || o.uname)
      ? '<div class="ord-acct">👤 <b>' + App.esc(o.uname || o.email || 'Signed-in customer') + '</b>' +
        (o.email && o.uname ? '<span>' + App.esc(o.email) + '</span>' : '') +
        (o.uid ? '<span class="badge google">Google account</span>' : '') +
        '</div>'
      : '<div class="ord-acct">👤 <span class="dl-empty">Placed without an account — order taken before Google sign-in became required.</span></div>';

    var plan =
      '<div class="dl-plan">' +
        '<div class="dl-title">🚚 Delivery plan (shown to the customer)</div>' +
        '<div class="row2">' +
          '<div class="field"><label for="dlDate">Delivery date</label>' +
            '<input id="dlDate" type="date" value="' + App.esc(o.deliveryDate || '') + '"></div>' +
          '<div class="field"><label for="dlTime">Delivery time</label>' +
            '<input id="dlTime" type="time" value="' + App.esc(o.deliveryTime || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label for="dlNote">Message for the customer</label>' +
          '<input id="dlNote" type="text" maxlength="140" placeholder="e.g. Rider will call before arriving" value="' + App.esc(o.deliveryNote || '') + '"></div>' +
        '<div class="dl-hint">' + (o.deliveryDate
          ? 'The customer sees this date, time and message with a live countdown.'
          : 'Leave the date empty to keep the default promise: delivery within 24 hours.') + '</div>' +
        '<div class="dl-actions">' +
          '<button class="btn btn-pri btn-sm" id="dlSave" type="button">💾 Save delivery plan</button>' +
          ((o.deliveryDate || o.deliveryTime || o.deliveryNote)
            ? '<button class="btn btn-ghost btn-sm" id="dlClear" type="button">Clear</button>' : '') +
        '</div>' +
        '<div class="dl-saved" id="dlSaved" hidden>Saved — the customer sees it right away ✓</div>' +
      '</div>';

    el('omBody').innerHTML = acct +
      '<div class="row2">' +
        '<div class="field"><label>Placed</label><div class="val">' + App.fmtDate(o.createdAt) + '</div></div>' +
        '<div class="field"><label>Payment</label><div class="val">' +
          (o.paymentMethod === 'wamd' ? '📲 WAMD (prepaid)' : '💵 Cash on Delivery') + '</div></div>' +
      '</div>' +
      '<div class="field"><label>Items (' + (o.items || []).length + ' product' +
        ((o.items || []).length === 1 ? '' : 's') + ')</label>' +
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
          App.esc(cust.name || '—') + '<br>' + App.esc(cust.phone || '—') + '</div></div>' +
        '<div class="field"><label>Address</label><div class="val">' + App.esc(cust.address || 'not specified') +
          (mapUrl ? '<br><a href="' + mapUrl + '" target="_blank" rel="noopener">📍 Open in Google Maps</a>' : '') +
        '</div></div>' +
      '</div>' +
      '<div class="row2">' +
        '<div class="field"><label>Status</label><div class="val">' +
          '<span class="badge ' + App.esc(st) + '">' + App.esc(STATUS_LABEL[st] || st) + '</span></div></div>' +
        '<div class="field"><label>WhatsApp hand-off</label><div class="val">' +
          (o.whatsappSent ? '🟢 Sent to shop chat' : '⚪ Not sent yet') + '</div></div>' +
      '</div>' + plan + shot;

    var dlSave = el('dlSave');
    if (dlSave) dlSave.addEventListener('click', function () { savePlan(false); });
    var dlClear = el('dlClear');
    if (dlClear) dlClear.addEventListener('click', function () { savePlan(true); });

    var shopWaText = '';
    try { shopWaText = App.buildWaMessage(o, cfg); } catch (e) {}
    var shopLink = App.waLink(cfg.whatsappNumber || cfg.ownerPhone, shopWaText);
    var custNum = String(cust.phone || '').replace(/[^0-9]/g, '');
    if (custNum && custNum[0] === '0') custNum = '965' + custNum.slice(1);
    var custLink = custNum ? 'https://wa.me/' + custNum : null;

    el('omFoot').innerHTML =
      (st === 'new' ? '<button class="btn btn-ghost" data-act="confirmed">✅ Confirm</button>' : '') +
      (st === 'confirmed' ? '<button class="btn btn-ghost" data-act="shipped">🚚 Out for delivery</button>' : '') +
      (st === 'shipped' || st === 'confirmed' ? '<button class="btn btn-pri" data-act="delivered">📦 Mark Delivered</button>' : '') +
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

    if (o.paymentScreenshot) {
      var box = document.getElementById('shotBox');
      if (box) {
        var cached = shots[o.id];
        if (cached) {
          box.innerHTML = '<a href="' + App.esc(cached) + '" target="_blank" rel="noopener">' +
            '<img class="shot" src="' + App.esc(cached) + '" alt="payment screenshot"></a>';
        } else {
        App.DB.ref('order_shots/' + o.id).once('value').then(function (s) {
          var d = s.val();
          if (d && typeof d === 'string') {
            box.innerHTML = '<a href="' + App.esc(d) + '" target="_blank" rel="noopener">' +
              '<img class="shot" src="' + App.esc(d) + '" alt="payment screenshot"></a>';
          } else {
            box.innerHTML = '<div class="empty-box" style="padding:14px"><b>Screenshot not found</b>It may have been removed.</div>';
          }
        }).catch(function () {
          box.innerHTML = '<div class="empty-box" style="padding:14px"><b>Could not load screenshot</b></div>';
        });
        }
      }
    }
  }

  function closeModal() {
    el('mMask').classList.remove('on');
    el('oModal').classList.remove('on');
    openId = null;
  }

  function savePlan(clear) {
    if (!openId) return;
    var d = '', t = '', n = '';
    if (!clear) {
      d = el('dlDate') ? el('dlDate').value : '';
      t = el('dlTime') ? el('dlTime').value : '';
      n = el('dlNote') ? (el('dlNote').value || '').trim() : '';
    }
    var patch = {
      deliveryDate: d || null,
      deliveryTime: t || null,
      deliveryNote: n || null,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    if (clear && el('dlDate')) el('dlDate').value = '';
    if (clear && el('dlTime')) el('dlTime').value = '';
    if (clear && el('dlNote')) el('dlNote').value = '';

    App.DB.ref('orders/' + openId).update(patch).then(function () {
      var saved = el('dlSaved');
      if (saved) saved.hidden = false;
      App.toast(clear ? 'Delivery plan cleared ✓' : 'Delivery plan saved ✓', 'ok');
    }).catch(function (e) {
      App.toast('Could not save: ' + (e.message || 'try again'), 'err');
    });
  }

  function setStatus(id, st) {
    if (!id) return;
    var patch = {
      status: st,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    if (st === 'confirmed') patch.confirmedAt = firebase.database.ServerValue.TIMESTAMP;
    if (st === 'shipped') patch.shippedAt = firebase.database.ServerValue.TIMESTAMP;
    if (st === 'delivered') patch.deliveredAt = firebase.database.ServerValue.TIMESTAMP;
    if (st === 'new') {
      patch.confirmedAt = null;
      patch.shippedAt = null;
      patch.deliveredAt = null;
    }
    App.DB.ref('orders/' + id).update(patch).then(function () {
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
    DB.ref('order_shots').limitToLast(60).on('value', function (s) {
      shots = s.val() || {};
      render();
    });
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
