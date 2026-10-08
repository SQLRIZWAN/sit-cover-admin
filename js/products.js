(function () {
  'use strict';

  var catId = null;
  try {
    catId = new URLSearchParams(location.search).get('cat');
  } catch (e) {}

  var editingId = null;
  var mediaItems = [];
  var mediaLoading = false;
  var MAX_MEDIA = 6;
  var MAX_MEDIA_BYTES = 7000000;

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

  function renderQuickCategories() {
    var box = el('catQuick');
    if (!box) return;
    var html = '<a class="cat-quick-btn' + (!catId ? ' on' : '') + '" href="products.html">All Products</a>';
    cats().forEach(function (c) {
      html += '<a class="cat-quick-btn' + (catId === c.id ? ' on' : '') + '" href="products.html?cat=' + encodeURIComponent(c.id) + '">' +
        App.esc(c.icon || '📦') + ' ' + App.esc(c.name) + '</a>';
    });
    html += '<a class="cat-quick-btn add" href="categories.html">＋ New Category</a>';
    box.innerHTML = html;
  }

  function render() {
    setNav();
    title();
    renderQuickCategories();

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
    var thumb = p.thumb || (m ? App.mediaThumb(m, 500) : '');
    var isVideo = p.videoFirst === true || (m && m.type === 'video');
    var out = p.inStock === false;
    var mediaCount = p.mediaCount != null ? p.mediaCount : ((p.media || []).length);

    return '<div class="pcard" data-id="' + App.esc(p.id) + '">' +
      '<div class="pc-img">' +
        (thumb ? '<img src="' + App.esc(thumb) + '" alt="" loading="lazy">' : '<div class="ph">🛍️</div>') +
        (isVideo ? '<span class="pc-vid">▶ VIDEO</span>' : '') +
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

      card.addEventListener('click', function (e) {
        if (e.target.closest('button, input, label, a')) return;
        openModal(id);
      });

      var ed = card.querySelector('.pc-edit');
      if (ed) ed.addEventListener('click', function () { openModal(id); });

      var dl = card.querySelector('.pc-del');
      if (dl) dl.addEventListener('click', function () {
        var ok = confirm('Delete "' + p.name + '" permanently?\n\nIt will disappear from the website instantly.');
        if (!ok) return;
        var del = {};
        del['products/' + id] = null;
        del['media/' + id] = null;
        App.DB.ref().update(del).then(function () {
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

  function fillCatSelect(keep) {
    var sel = el('pfCat');
    var cur = keep !== undefined ? keep : sel.value;
    var list = cats();
    sel.innerHTML = (list.length ? '' : '<option value="">— create a category below —</option>') +
      list.map(function (c) {
        return '<option value="' + App.esc(c.id) + '">' + App.esc(c.name) +
          (c.active === false ? ' (inactive)' : '') + '</option>';
      }).join('') +
      '<option value="__new">＋ Create new category…</option>';
    if (cur) {
      if (cur === '__new' || list.some(function (c) { return c.id === cur; })) sel.value = cur;
    }
  }

  function openModal(id) {
    editingId = id;

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
    var ncr = el('newCatRow');
    if (ncr) ncr.hidden = el('pfCat').value !== '__new';

    if (App.DB) {
      App.DB.ref('categories').once('value').then(function (snap) {
        App.state.categories = snap.val() || {};
        App.loaded.categories = true;
        var keep = el('pfCat').value;
        fillCatSelect(keep);
        if (p && p.categoryId) el('pfCat').value = p.categoryId;
        else if (!keep && catId) el('pfCat').value = catId;
        if (!cats().length) {
          el('pfCat').value = '__new';
          if (ncr) ncr.hidden = false;
        }
      }).catch(function () {
        App.toast('Could not load categories — check your connection', 'err');
      });
    }

    mediaItems = [];
    mediaLoading = false;
    if (p && p.media && p.media.length) {
      mediaItems = p.media.map(function (m) { return { media: m, uploading: false, pct: 100 }; });
    } else if (id) {
      mediaLoading = true;
      App.DB.ref('media/' + id).once('value').then(function (s) {
        if (editingId !== id) return;
        var v = s.val() || {};
        var arr = [];
        Object.keys(v).sort().forEach(function (k) {
          if (v[k] && v[k].url) arr.push({ media: v[k], uploading: false, pct: 100 });
        });
        mediaItems = arr;
        mediaLoading = false;
        renderMedia();
      }).catch(function () {
        if (editingId !== id) return;
        mediaLoading = false;
        renderMedia();
        App.toast('Could not load product media', 'err');
      });
    }
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
    if (!cat || cat === '__new') { App.toast('Select a category — or finish creating the new one below the list', 'err'); el('pfCat').focus(); return; }
    if (mediaLoading) { App.toast('Product media is still loading — wait a second', 'err'); return; }

    var stillUploading = mediaItems.some(function (it) { return it.uploading; });
    if (stillUploading) { App.toast('Please wait — a file is still uploading', 'err'); return; }

    var items = mediaItems
      .filter(function (it) { return !it.err && it.media && it.media.url; })
      .map(function (it) { return it.media; });

    if (items.length > MAX_MEDIA) {
      App.toast('Maximum ' + MAX_MEDIA + ' photos/videos per product', 'err');
      return;
    }

    var mediaObj = {};
    items.forEach(function (m, i) { mediaObj['m' + i] = m; });

    var first = items[0] || null;
    var videoFirst = !!(first && first.type === 'video');

    var sizeBytes = 0;
    try { sizeBytes = JSON.stringify(mediaObj).length; } catch (e) { sizeBytes = MAX_MEDIA_BYTES + 1; }
    if (sizeBytes > MAX_MEDIA_BYTES) {
      App.toast('Media too big (' + Math.round(sizeBytes / 1000000) + ' MB) — max 7 MB total. Use fewer/smaller files.', 'err');
      return;
    }

    var btn = el('mSave');
    btn.disabled = true;
      btn.textContent = 'Submitting…';

    var thumbP = '';
    var miniP = '';
    if (first) {
      var src = first.type === 'video' ? (first.thumb || '') : first.url;
      thumbP = App.makeVariant(src, 480, 0.72);
      miniP = App.makeVariant(src, 110, 0.6);
    }

    var finishSave = function (thumb, mini) {
      var data = {
        name: name,
        price: Math.round(price * 1000) / 1000,
        categoryId: cat,
        description: el('pfDesc').value.trim(),
        inStock: el('pfStock').checked,
        order: parseInt(el('pfOrder').value, 10) || 0,
        mediaCount: items.length,
        thumb: thumb || '',
        mini: mini || thumb || '',
        videoFirst: videoFirst,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      };

      var key = editingId;
      if (!key) {
        key = App.DB.ref('products').push().key;
        data.createdAt = firebase.database.ServerValue.TIMESTAMP;
      } else {
        data.createdAt = (App.state.products[editingId] || {}).createdAt || firebase.database.ServerValue.TIMESTAMP;
      }

      var upd = {};
      upd['products/' + key] = data;
      upd['media/' + key] = items.length ? mediaObj : null;

      App.DB.ref().update(upd).then(function () {
        btn.disabled = false;
        btn.textContent = '✅ Submit Product';
        closeModal();
        App.toast('Product saved — live on website ✓', 'ok');
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = '✅ Submit Product';
        App.toast('Save failed: ' + (e && e.message ? e.message : ''), 'err');
      });
    };

    if (first && thumbP && thumbP.then) {
      thumbP.then(function (thumb) {
        return miniP.then(function (mini) { finishSave(thumb, mini); });
      }).catch(function () { finishSave('', ''); });
    } else {
      finishSave('', '');
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

    el('pfCat').parentNode.insertAdjacentHTML('beforeend',
      '<div class="newcat" id="newCatRow" hidden>' +
        '<input id="ncName" type="text" maxlength="40" placeholder="Category name (e.g. Drill Machine)">' +
        '<input id="ncIcon" type="text" maxlength="4" placeholder="🛍️" value="🛍️" title="Icon">' +
        '<button type="button" class="btn btn-pri btn-sm" id="ncSave">＋ Add</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="ncCancel">Cancel</button>' +
      '</div>');

    el('pfCat').addEventListener('change', function () {
      var row = el('newCatRow');
      if (el('pfCat').value === '__new') {
        row.hidden = false;
        setTimeout(function () { el('ncName').focus(); }, 60);
      } else {
        row.hidden = true;
      }
    });

    el('ncCancel').addEventListener('click', function () {
      el('newCatRow').hidden = true;
      el('ncName').value = '';
      fillCatSelect();
      if (el('pfCat').value === '__new') el('pfCat').value = '';
    });

    el('ncSave').addEventListener('click', function () {
      var name = el('ncName').value.trim();
      if (!name) { App.toast('Type the category name', 'err'); el('ncName').focus(); return; }
      if (!App.DB) { App.toast('Not connected yet — wait a moment', 'err'); return; }
      var btn = el('ncSave');
      btn.disabled = true;
      var maxOrder = 0;
      App.catList(true).forEach(function (c) {
        if (typeof c.order === 'number' && c.order > maxOrder) maxOrder = c.order;
      });
      var key = App.DB.ref('categories').push().key;
      var data = {
        name: name,
        icon: (el('ncIcon').value || '🛍️').trim(),
        active: true,
        order: maxOrder + 1,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      App.DB.ref('categories/' + key).set(data).then(function () {
        App.state.categories = App.state.categories || {};
      App.state.categories[key] = data;
        App.fire('categories', App.state.categories);
        btn.disabled = false;
        el('newCatRow').hidden = true;
        el('ncName').value = '';
        fillCatSelect(key);
        App.toast('Category "' + name + '" created ✓', 'ok');
      }).catch(function (e) {
        btn.disabled = false;
        App.toast('Could not create: ' + (e && e.message ? e.message : ''), 'err');
      });
    });

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
