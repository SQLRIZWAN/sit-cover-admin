(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  var users = [];
  var query = '';
  var attached = false;
  var loadError = '';

  function esc(v) { return App.esc(v); }

  function initial(u) {
    var s = (u.name || u.email || '?').trim();
    return (s.charAt(0) || '?').toUpperCase();
  }

  function avatarHTML(u) {
    if (u.photo) {
      return '<img src="' + esc(u.photo) + '" alt="" data-fb="' + esc(initial(u)) + '">';
    }
    return '<span class="uc-ph">' + esc(initial(u)) + '</span>';
  }

  function matches(u) {
    if (!query) return true;
    var hay = ((u.name || '') + ' ' + (u.email || '') + ' ' + (u.phone || '') + ' ' + (u.info || '')).toLowerCase();
    return hay.indexOf(query) >= 0;
  }

  // Kuwait local numbers become wa.me/965…, matching the order card.
  function waFor(phone) {
    var n = String(phone || '').replace(/[^0-9]/g, '');
    if (!n) return null;
    if (n[0] === '0') n = '965' + n.slice(1);
    return 'https://wa.me/' + n;
  }

  function card(u) {
    var joined = u.createdAt ? App.fmtDate(u.createdAt) : '—';
    var last = u.lastLoginAt ? App.fmtDate(u.lastLoginAt) : '—';
    var bits = [];
    if (u.phone) bits.push('📞 ' + esc(u.phone));
    bits.push('🗓️ joined ' + esc(joined));
    bits.push('🔄 last sign-in ' + esc(last));
    var wa = waFor(u.phone);

    return '<div class="ucard">' +
      '<div class="uc-av">' +
        (u.photo
          ? '<button type="button" class="uc-dp" data-dp="' + esc(u.photo) +
            '" data-dpname="' + esc(u.name || u.email || 'User') + '" title="View full photo">' +
            avatarHTML(u) + '</button>'
          : avatarHTML(u)) +
      '</div>' +
      '<div class="uc-main">' +
        '<div class="uc-top">' +
          '<b>' + esc(u.name || 'Unnamed user') + '</b>' +
          '<span class="badge google">Google</span>' +
        '</div>' +
        '<div class="uc-mail"><a href="mailto:' + esc(u.email) + '">' + esc(u.email || 'no email') + '</a></div>' +
        '<div class="uc-meta">' + bits.join('<span class="dot">•</span>') + '</div>' +
        (u.info ? '<div class="uc-info">' + esc(u.info) + '</div>' : '') +
      '</div>' +
      '<div class="uc-r">' +
        (u.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(u.email) + '">Email</a>' : '') +
        (u.phone ? '<a class="btn btn-ghost btn-sm" href="tel:' + esc(String(u.phone).replace(/[^\d+]/g, '')) + '">Call</a>' : '') +
        (wa ? '<a class="btn btn-ghost btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener">💬 WhatsApp</a>' : '') +
        (u.photo ? '<button type="button" class="btn btn-ghost btn-sm" data-dp="' + esc(u.photo) +
          '" data-dpname="' + esc(u.name || u.email || 'User') + '">View DP</button>' : '') +
      '</div>' +
    '</div>';
  }

  function render() {
    var total = users.length;
    var withPhoto = users.filter(function (u) { return !!u.photo; }).length;
    var withPhone = users.filter(function (u) { return !!u.phone; }).length;
    var week = Date.now() - 7 * 864e5;
    var new7 = users.filter(function (u) { return (u.lastLoginAt || 0) >= week; }).length;

    if (el('uTotal')) el('uTotal').textContent = total;
    if (el('uWithPhoto')) el('uWithPhoto').textContent = withPhoto;
    if (el('uWithPhone')) el('uWithPhone').textContent = withPhone;
    if (el('uNew7')) el('uNew7').textContent = new7;

    var list = users.filter(matches).sort(function (a, b) {
      return (b.lastLoginAt || 0) - (a.lastLoginAt || 0);
    });

    if (el('uCount')) {
      el('uCount').textContent = total
        ? total + ' registered user' + (total === 1 ? '' : 's')
        : 'no users yet';
    }
    if (el('uShown')) {
      el('uShown').textContent = query ? (list.length + ' of ' + total + ' match') : '';
    }

    var box = el('uList');
    if (!box) return;

    if (loadError) {
      box.innerHTML = '<div class="empty-box"><div class="big">🔒</div><b>Cannot read users</b>' +
        esc(loadError) +
        '<div style="margin-top:14px"><button class="btn btn-ghost" type="button" id="uRetry">Retry</button></div></div>';
      var rb = el('uRetry');
      if (rb) rb.addEventListener('click', function () { loadError = ''; attached = false; render(); attach(); });
      return;
    }

    if (!total) {
      box.innerHTML = '<div class="empty-box"><div class="big">👥</div><b>No users yet</b>' +
        'Nobody has signed in with Google on the website so far. ' +
        'Sign-ins appear here instantly.</div>';
      return;
    }

    if (!list.length) {
      box.innerHTML = '<div class="empty-box"><div class="big">🔍</div><b>No matching users</b>' +
        'Nothing matches “' + esc(query) + '”.</div>';
      return;
    }

    box.innerHTML = '<div class="ulist">' + list.map(card).join('') + '</div>';

    // Full-size profile photo — tap the avatar or the "View DP" button.
    $$('.ucard').forEach(function (c) {
      $$('[data-dp]', c).forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          App.viewImage(b.getAttribute('data-dp'), b.getAttribute('data-dpname'));
        });
      });
    });
  }

  function snapshotToArray(snap) {
    var arr = [];
    snap.forEach(function (ch) {
      var v = ch.val() || {};
      v.uid = v.uid || ch.key;
      arr.push(v);
    });
    return arr;
  }

  function attach() {
    if (attached || !App.DB) return;
    if (!App.user) return;
    attached = true;
    App.DB.ref('stats/users').on('value', function (s) {
      loadError = '';
      users = snapshotToArray(s);
      render();
      // Opened = seen: the Users badge clears and only counts sign-ins that
      // happen after this page is closed again.
      if (App.markUsersSeen) App.markUsersSeen();
    }, function (err) {
      loadError = (err && err.message) || 'The database refused this request.';
      render();
    });
  }

  function init() {
    var s = el('uSearch');
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

    App.onAuth(function (user) {
      if (user) attach();
    });

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
