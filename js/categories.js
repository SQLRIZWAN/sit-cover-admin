(function () {
  'use strict';

  var editingId = null;

  function el(id) { return document.getElementById(id); }

  function strip(o) {
    var out = {};
    for (var k in o) if (o.hasOwnProperty(k) && k !== 'id') out[k] = o[k];
    return out;
  }

  function countProducts(catId) {
    var n = 0;
    var ps = App.state.products || {};
    for (var id in ps) if (ps[id] && ps[id].categoryId === catId) n++;
    return n;
  }

  function render() {
    var list = App.catList(true);

    if (!App.loaded.categories) {
      el('catList').innerHTML = '<div class="empty-box"><div class="big">🗂️</div><b>Loading categories…</b></div>';
      return;
    }

    if (!list.length) {
      el('catList').innerHTML = '<div class="empty-box"><div class="big">🗂️</div><b>No categories yet</b>' +
        'Add your first category — it becomes a tab on the website instantly.<div style="margin-top:14px">' +
        '<button class="btn btn-pri" id="emptyAdd">＋ Add Category</button></div></div>';
      var ea = el('emptyAdd');
      if (ea) ea.addEventListener('click', function () { openModal(null); });
      return;
    }

    var rows = list.map(function (c, i) {
      var pc = countProducts(c.id);
      return '<tr data-id="' + App.esc(c.id) + '">' +
        '<td style="width:44px"><b>' + (i + 1) + '</b></td>' +
        '<td style="width:46px">' + (c.icon ? App.iconHTML(c.icon) : '<span style="font-size:20px">📁</span>') + '</td>' +
        '<td><b>' + App.esc(c.name) + '</b>' +
          (c.nameAr ? '<br><small style="color:#6b7280" dir="rtl">' + App.esc(c.nameAr) + '</small>' : '') + '</td>' +
        '<td><span class="badge cat">' + pc + ' product' + (pc === 1 ? '' : 's') + '</span></td>' +
        '<td>' +
          '<label class="switch"><input type="checkbox" class="c-active"' + (c.active === false ? '' : ' checked') + '><i></i></label>' +
        '</td>' +
        '<td><div class="t-actions">' +
          '<button class="icbtn" data-act="up" title="Move up"' + (i === 0 ? ' disabled style="opacity:.35"' : '') + '>↑</button>' +
          '<button class="icbtn" data-act="down" title="Move down"' + (i === list.length - 1 ? ' disabled style="opacity:.35"' : '') + '>↓</button>' +
          '<button class="icbtn" data-act="edit" title="Edit">✏️</button>' +
          '<button class="icbtn danger" data-act="del" title="Delete">🗑</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    el('catList').innerHTML = '<div class="tbl-wrap"><table class="tbl">' +
      '<tr><th>#</th><th></th><th>Category</th><th>Products</th><th>Active</th><th></th></tr>' +
      rows + '</table></div>';

    bind();
  }

  function bind() {
    var list = App.catList(true);

    $$('#catList tr[data-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      var idx = -1;
      list.forEach(function (c, i) { if (c.id === id) idx = i; });
      if (idx < 0) return;

      tr.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        var sw = e.target.closest('.c-active');
        if (sw) {
          var on = sw.checked;
          App.DB.ref('categories/' + id).update({
            active: on,
            name: list[idx].name,
            nameAr: list[idx].nameAr || '',
            icon: list[idx].icon || '',
            order: typeof list[idx].order === 'number' ? list[idx].order : idx
          }).then(function () {
            App.toast(on ? 'Category is LIVE on website ✓' : 'Category hidden from website', 'ok');
          }).catch(function (err) {
            sw.checked = !on;
            App.toast('Failed: ' + err.message, 'err');
          });
          return;
        }
        if (!b) return;
        var act = b.getAttribute('data-act');

        if (act === 'edit') openModal(id);

        if (act === 'del') {
          var pc = countProducts(id);
          var msg = 'Delete category "' + list[idx].name + '"?';
          if (pc) msg += '\n\n' + pc + ' product(s) use it — they will stay in the shop and show on the Home tab (uncategorized).';
          if (!confirm(msg)) return;
          App.DB.ref('categories/' + id).remove().then(function () {
            App.toast('Category deleted ✓', 'ok');
          }).catch(function (err) {
            App.toast('Delete failed: ' + err.message, 'err');
          });
        }

        if (act === 'up' || act === 'down') {
          var j = act === 'up' ? idx - 1 : idx + 1;
          if (j < 0 || j >= list.length) return;
          var payload = {};
          var sorted = list.slice();
          var tmp = sorted[idx];
          sorted[idx] = sorted[j];
          sorted[j] = tmp;
          sorted.forEach(function (c, i) {
            var o = strip(c);
            o.order = i;
            o.active = o.active !== false;
            if (typeof o.icon !== 'string') o.icon = '';
            if (typeof o.nameAr !== 'string') o.nameAr = '';
            payload[c.id] = o;
          });
          App.DB.ref('categories').update(payload).catch(function (err) {
            App.toast('Reorder failed: ' + err.message, 'err');
          });
        }
      });
    });
  }

  function openModal(id) {
    editingId = id;
    var c = id ? (App.state.categories || {})[id] : null;
    el('mTitle').textContent = c ? 'Edit Category' : 'Add Category';
    el('cfName').value = c ? (c.name || '') : '';
    el('cfNameAr').value = c ? (c.nameAr || '') : '';
    el('cfIcon').value = c ? (c.icon || '') : '';
    el('cfActive').checked = c ? c.active !== false : true;
    activeTxt();
    paintIconPreview();

    el('mMask').classList.add('on');
    el('cModal').classList.add('on');
    setTimeout(function () { el('cfName').focus(); }, 260);
  }

  function closeModal() {
    el('mMask').classList.remove('on');
    el('cModal').classList.remove('on');
    editingId = null;
  }

  function activeTxt() {
    var on = el('cfActive').checked;
    var t = el('cfActiveTxt');
    t.textContent = on ? 'Active — shown on website' : 'Hidden — not shown on website';
    t.style.color = on ? '#16a34a' : '#dc2626';
  }

  /* ------------------------------------------------------------------ *
   * Icon picker — emoji, Iconify code, or an uploaded image.
   * ------------------------------------------------------------------ */
  var EMOJIS = ['📺', '🚗', '🛋️', '🪑', '🛏️', '🛁', '🧼', '🧴', '🧹', '🧽',
    '🗑️', '🔧', '🪛', '🔩', '🛠️', '🧰', '🪣', '🔌', '💡', '🔋',
    '📦', '🛍️', '🎁', '🏷️', '🛒', '🔑', '🧵', '🧶', '📱', '⌚',
    '🎧', '💻', '📷', '☂️', '🐾', '🍼'];

  var ICONIFY = ['lucide:tv', 'lucide:car-front', 'lucide:armchair', 'lucide:wrench',
    'lucide:hammer', 'lucide:bolt', 'lucide:plug', 'lucide:lightbulb',
    'lucide:package', 'lucide:shopping-bag', 'lucide:gift', 'lucide:trash-2',
    'lucide:sparkles', 'lucide:star', 'lucide:heart', 'lucide:shield-check',
    'lucide:shirt', 'lucide:bed-double', 'lucide:bath', 'lucide:settings',
    'lucide:circle-dot', 'lucide:washing-machine', 'lucide:refrigerator', 'lucide:lamp-desk'];

  function paintIconPreview() {
    var box = el('ipPrev');
    if (!box) return;
    var v = el('cfIcon').value.trim();
    box.innerHTML = v ? App.iconHTML(v) : '';
    box.classList.toggle('empty', !v);
    if (!v) box.textContent = '—';
    $$('#ipEmoji .ip-b').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === v);
    });
    $$('#ipIconify .ip-b').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === v);
    });
  }

  function buildIconPicker() {
    var e = el('ipEmoji');
    if (e) {
      e.innerHTML = EMOJIS.map(function (x) {
        return '<button type="button" class="ip-b" data-v="' + App.esc(x) + '" title="' + App.esc(x) + '">' + App.esc(x) + '</button>';
      }).join('');
      e.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-v]');
        if (!b) return;
        el('cfIcon').value = b.getAttribute('data-v');
        paintIconPreview();
      });
    }

    var i = el('ipIconify');
    if (i) {
      i.innerHTML = ICONIFY.map(function (x) {
        return '<button type="button" class="ip-b ip-ico" data-v="' + App.esc(x) + '" title="' + App.esc(x) + '">' +
          App.iconHTML(x) + '</button>';
      }).join('');
      i.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-v]');
        if (!b) return;
        el('cfIcon').value = b.getAttribute('data-v');
        paintIconPreview();
      });
    }

    var up = el('cfUpload');
    if (up) up.addEventListener('click', function () {
      var f = el('cfIconFile');
      f.value = '';
      f.click();
    });

    var clr = el('cfClear');
    if (clr) clr.addEventListener('click', function () {
      el('cfIcon').value = '';
      paintIconPreview();
    });

    var file = el('cfIconFile');
    if (file) file.addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type || '')) { App.toast('Choose an image file', 'err'); return; }
      App.cloudUpload(f).then(function (m) {
        if (!m || !m.url) throw new Error('Could not read the image');
        return App.makeVariant(m.url, 96, 0.85);
      }).then(function (dataUrl) {
        if (!dataUrl) throw new Error('Could not compress the image');
        el('cfIcon').value = dataUrl;
        paintIconPreview();
        App.toast('Custom icon ready — press Save', 'ok');
      }).catch(function (err) {
        App.toast('Icon failed: ' + (err.message || ''), 'err');
      });
    });
  }

  function save() {
    var name = el('cfName').value.trim();
    if (!name) { App.toast('Enter the category name', 'err'); el('cfName').focus(); return; }

    var data = {
      name: name,
      nameAr: el('cfNameAr').value.trim(),
      icon: el('cfIcon').value.trim(),
      active: el('cfActive').checked
    };

    var btn = el('mSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    var ok = function () {
      btn.disabled = false;
      btn.textContent = '💾 Save Category';
      closeModal();
      App.toast('Category saved — website tab updated ✓', 'ok');
    };
    var bad = function (e) {
      btn.disabled = false;
      btn.textContent = '💾 Save Category';
      App.toast('Save failed: ' + (e && e.message ? e.message : ''), 'err');
    };

    if (editingId) {
      var old = App.state.categories[editingId] || {};
      data.order = typeof old.order === 'number' ? old.order : App.catList(true).length;
      App.DB.ref('categories/' + editingId).update(data).then(ok).catch(bad);
    } else {
      data.order = App.catList(true).length;
      App.DB.ref('categories').push(data).then(ok).catch(bad);
    }
  }

  el('btnAdd').addEventListener('click', function () { openModal(null); });
  el('mClose').addEventListener('click', closeModal);
  el('mCancel').addEventListener('click', closeModal);
  el('mMask').addEventListener('click', closeModal);
  el('mSave').addEventListener('click', save);
  el('cfActive').addEventListener('change', activeTxt);
  el('cfIcon').addEventListener('input', paintIconPreview);
  buildIconPicker();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && el('cModal').classList.contains('on')) closeModal();
  });

  App.onAuth(function () {
    App.on('categories', render);
    App.on('products', render);
  });
})();
