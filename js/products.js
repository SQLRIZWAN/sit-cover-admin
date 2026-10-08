(function () {
  'use strict';

  var catId = null;
  try {
    catId = new URLSearchParams(location.search).get('cat');
  } catch (e) {}

  var editingId = null;
  var mediaItems = [];
  var MAX_MEDIA = 6;

  function el(id) { return document.getElementById(id); }

  function cats() { return App.catList(true); }

  function catName(id) {
    var c = (App.state.categories || {})[id];
    return c ? c.name : 'Uncategorized';
  }

  function setNav() {
    document.body.setAttribute('data-nav', catId ? 'products-' + catId : 'products-all');
    App.markActive();
  }

  function title() {
    var t = catId ? catName(catId) : 'All Products';
    el('pgTitle').textContent = t;
    App.pageTitle('Products — ' + t);
  }

  function render() {
    setNav();
    title();

    if (!App.loaded.products) {
      el('pgSub').textContent = 'Loading products…';
      return;
    }

    var all = App.prodList();
    var list = catId ? all.filter(function (p) { return p.categoryId === catId; }) : all;

    el('pgSub').textContent = list.length + ' product' + (list.length === 1 ? '' : 's') +
      (catId ? ' in this category' : ' in the shop') + ' • changes go live instantly';

    if (!list.length) {
      el('pList').innerHTML = '<div class="empty-box"><div class="big">📦</div><b>No products here yet</b>' +
        'Tap “Add Product” to list your first item with photos or video.<div style="margin-top:14px">' +
        '<button class="btn btn-pri" id="emptyAdd">＋ Add Product</button></div></div>';
      var ea = el('emptyAdd');
      if (ea) ea.addEventListener('click', function () { openModal(null); });
      return;
    }

    el('pList').innerHTML = '<div class="pgrid">' + list.map(cardHTML).join('') + '</div>';
    bindCards();
  }

  function cardHTML(p) {
    var m = App.firstMedia(p);
    var thumb = m ? App.mediaThumb(m, 500) : '';
    var out = p.inStock === false;
    var mediaCount = (p.media || []).length;

    return '<div class="pcard" data-id="' + App.esc(p.id) + '">' +
      '<div class="pc-img">' +
        (thumb ? '<img src="' + App.esc(thumb) + '" alt="" loading="lazy">' : '<div class="ph">🛍️</div>') +
        (m && m.type === 'video' ? '<span class="pc-vid">▶ VIDEO</span>' : '') +
      '</div>' +
      '<div class="pc-b">' +
        '<div class="pc-n">' + App.esc(p.name) + '</div>' +
        '<div class="pc-p">' + App.fmtKD(p.price) + '</div>' +
        '<div class="pc-meta">' +
          '<span class="badge cat">' + App.esc(catName(p.categoryId)) + '</span>' +
          '<span class="badge ' + (out ? 'out' : 'stock') + '">' + (out ? 'Out of stock' : 'In stock') + '</span>' +
          (mediaCount ? '<span class="badge cat">🖼 ' + mediaCount + '</span>' : '') +
        '</div>' +
        '<div class="pc-meta" style="margin-top:4px">' +
          '<label class="switch"><input type="checkbox" class="pc-stock"' + (out ? '' : ' checked') + '><i></i></label>' +
          '<small style="font-size:11.5px;color:#6b7280">Stock visible on site</small>' +
        '</div>' +
        '<div class="pc-act">' +
          '<button class="btn btn-ghost btn-sm pc-edit">✏️ Edit</button>' +
          '<button class="btn btn-danger btn-sm pc-del">🗑 Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function bindCards() {
    $$('.pcard').forEach(function (card) {
      var id = card.getAttribute('data-id');
      var p = (App.state.products || {})[id];
      if (!p) return;

      var ed = card.querySelector('.pc-edit');
      if (ed) ed.addEventListener('click', function () { openModal(id); });

      var dl = card.querySelector('.pc-del');
      if (dl) dl.addEventListener('click', function () {
        var ok = confirm('Delete "' + p.name + '" permanently?\n\nIt will disappear from the website instantly.');
        if (!ok) return;
        App.DB.ref('products/' + id).remove().then(function () {
          App.toast('Product deleted ✓', 'ok');
        }).catch(function (e) {
          App.toast('Delete failed: ' + e.message, 'err');
        });
      });

      var st = card.querySelector('.pc-stock');
      if (st) st.addEventListener('change', function () {
        var v = st.checked;
        App.DB.ref('products/' + id).update({
          inStock: v,
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(function () {
          App.toast(v ? 'Marked IN stock ✓' : 'Marked OUT of stock (hidden action on site)', 'ok');
        }).catch(function (e) {
          st.checked = !v;
          App.toast('Update failed: ' + e.message, 'err');
        });
      });
    });
  }

  function fillCatSelect() {
    var sel = el('pfCat');
    var list = cats();
    if (!list.length) {
      sel.innerHTML = '<option value="">— create a category first —</option>';
      return;
    }
    sel.innerHTML = list.map(function (c) {
      return '<option value="' + App.esc(c.id) + '">' + App.esc(c.name) +
        (c.active === false ? ' (inactive)' : '') + '</option>';
    }).join('');
  }

  function openModal(id) {
    editingId = id;
    fillCatSelect();

    var p = id ? (App.state.products || {})[id] : null;
    el('mTitle').textContent = p ? 'Edit Product' : 'Add Product';
    el('pfName').value = p ? (p.name || '') : '';
    el('pfPrice').value = p ? (p.price != null ? p.price : '') : '';
    el('pfDesc').value = p ? (p.description || '') : '';
    el('pfOrder').value = p && p.order != null ? p.order : 0;
    el('pfStock').checked = p ? p.inStock !== false : true;
    updateStockTxt();
    fillCatSelect();
    if (p && p.categoryId) el('pfCat').value = p.categoryId;
    else if (catId) el('pfCat').value = catId;

    mediaItems = p && p.media ? p.media.map(function (m) { return { media: m, uploading: false, pct: 100 }; }) : [];
    renderMedia();

    el('mMask').classList.add('on');
    el('pModal').classList.add('on');
    setTimeout(function () { el('pfName').focus(); }, 260);
  }

  function closeModal() {
    el('mMask').classList.remove('on');
    el('pModal').classList.remove('on');
    editingId = null;
    mediaItems = [];
  }

  function updateStockTxt() {
    var on = el('pfStock').checked;
    var t = el('pfStockTxt');
    t.textContent = on ? 'In stock (visible on website)' : 'Out of stock (badge shows on website)';
    t.style.color = on ? '#16a34a' : '#dc2626';
  }

  function renderMedia() {
    var box = el('pfMedia');
    if (!mediaItems.length) { box.innerHTML = ''; return; }
    box.innerHTML = mediaItems.map(function (it, i) {
      if (it.uploading) {
        return '<div class="mitem">' +
          '<div class="mi-thumb">⏳</div>' +
          '<div class="mi-info"><b>Uploading…</b><small>' + (it.file ? App.esc(it.file.name) : '') + '</small>' +
          '<div class="mprog"><i style="width:' + (it.pct || 0) + '%"></i></div></div>' +
          '<button class="icbtn danger" data-i="' + i + '" data-act="cancel">✕</button>' +
        '</div>';
      }
      if (it.err) {
        return '<div class="mitem err">' +
          '<div class="mi-thumb">⚠️</div>' +
          '<div class="mi-info"><b>Upload failed</b><small>' + App.esc(it.err) + '</small></div>' +
          '<button class="icbtn danger" data-i="' + i + '" data-act="remove">✕</button>' +
        '</div>';
      }
      var m = it.media || {};
      var t = App.mediaThumb(m, 200);
      return '<div class="mitem">' +
        '<div class="mi-thumb">' + (t ? '<img src="' + App.esc(t) + '" alt="">' : '🖼️') + '</div>' +
        '<div class="mi-info"><b>' + (m.type === 'video' ? '▶ Video' : 'Photo') +
          (m.bytes ? ' · ' + Math.round(m.bytes / 1024) + ' KB' : '') + '</b>' +
          '<small>' + App.esc((m.publicId || '').slice(-38)) + '</small></div>' +
        (i === 0 ? '<span class="mi-cover">COVER</span>' : '<button class="icbtn" data-i="' + i + '" data-act="cover" title="Make cover">⭐</button>') +
        '<button class="icbtn danger" data-i="' + i + '" data-act="remove">✕</button>' +
      '</div>';
    }).join('');
  }

  function onMediaClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var i = Number(b.getAttribute('data-i'));
    var act = b.getAttribute('data-act');
    if (act === 'remove' || act === 'cancel') {
      var it = mediaItems[i];
      if (it) it.cancelled = true;
      mediaItems.splice(i, 1);
      renderMedia();
    }
    if (act === 'cover' && i > 0) {
      var m = mediaItems.splice(i, 1)[0];
      mediaItems.unshift(m);
      renderMedia();
      App.toast('Cover changed ✓', 'ok');
    }
  }

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    for (var i = 0; i < files.length; i++) {
      if (mediaItems.length >= MAX_MEDIA) {
        App.toast('Maximum ' + MAX_MEDIA + ' photos/videos per product', 'err');
        break;
      }
      var f = files[i];
      if (f.size > 60 * 1024 * 1024) {
        App.toast('"' + f.name + '" is bigger than 60 MB — skip it', 'err');
        continue;
      }
      (function (file) {
        var item = { file: file, uploading: true, pct: 0 };
        mediaItems.push(item);
        renderMedia();

        App.cloudUpload(file, function (p) {
          item.pct = p;
          renderMedia();
        }).then(function (media) {
          if (item.cancelled) return;
          item.uploading = false;
          item.media = media;
          item.pct = 100;
          renderMedia();
        }).catch(function (err) {
          if (item.cancelled) return;
          item.uploading = false;
          item.err = err.message;
          renderMedia();
        });
      })(f);
    }
  }

  function save() {
    var name = el('pfName').value.trim();
    var price = parseFloat(el('pfPrice').value);
    var cat = el('pfCat').value;

    if (!name) { App.toast('Enter the product name', 'err'); el('pfName').focus(); return; }
    if (!isFinite(price) || price < 0) { App.toast('Enter a valid price in KD', 'err'); el('pfPrice').focus(); return; }
    if (!cat) { App.toast('Create a category first (Categories page), then select it', 'err'); return; }

    var stillUploading = mediaItems.some(function (it) { return it.uploading; });
    if (stillUploading) { App.toast('Please wait — a file is still uploading', 'err'); return; }

    var media = mediaItems
      .filter(function (it) { return !it.err && it.media; })
      .map(function (it) { return it.media; });

    var data = {
      name: name,
      price: Math.round(price * 1000) / 1000,
      categoryId: cat,
      description: el('pfDesc').value.trim(),
      media: media,
      inStock: el('pfStock').checked,
      order: parseInt(el('pfOrder').value, 10) || 0,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    var btn = el('mSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    var done = function () {
      btn.disabled = false;
      btn.textContent = '💾 Save Product';
      closeModal();
      App.toast('Product saved — live on website ✓', 'ok');
    };
    var fail = function (e) {
      btn.disabled = false;
      btn.textContent = '💾 Save Product';
      App.toast('Save failed: ' + (e && e.message ? e.message : ''), 'err');
    };

    if (editingId) {
      data.createdAt = (App.state.products[editingId] || {}).createdAt || Date.now();
      App.DB.ref('products/' + editingId).update(data).then(done).catch(fail);
    } else {
      data.createdAt = firebase.database.ServerValue.TIMESTAMP;
      App.DB.ref('products').push(data).then(done).catch(fail);
    }
  }

  function bindStatic() {
    el('btnAdd').addEventListener('click', function () { openModal(null); });
    el('mClose').addEventListener('click', closeModal);
    el('mCancel').addEventListener('click', closeModal);
    el('mMask').addEventListener('click', closeModal);
    el('mSave').addEventListener('click', save);
    el('pfStock').addEventListener('change', updateStockTxt);

    var drop = el('pfDrop');
    var file = el('pfFile');
    drop.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      addFiles(file.files);
      file.value = '';
    });
    drop.addEventListener('dragover', function (e) {
      e.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.classList.remove('over');
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    el('pfMedia').addEventListener('click', onMediaClick);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el('pModal').classList.contains('on')) closeModal();
    });
  }

  bindStatic();

  App.onAuth(function () {
    App.on('categories', render);
    App.on('products', render);
  });
})();
