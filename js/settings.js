(function () {
  'use strict';

  var filled = false;
  var defaultTiers = [
    { maxKm: 5, fee: 1 },
    { maxKm: 10, fee: 1.5 },
    { maxKm: 20, fee: 2 },
    { maxKm: 30, fee: 3 },
    { maxKm: null, fee: 5 }
  ];
  var DEFAULT_SEO_DESC = 'Fix and Fit store in Jleeb Al-Shuyoukh, Kuwait (near Makhfar). Car seat covers, Android screen fitting, reverse camera, CCTV installation, drill machines, steering covers, speaker repair, routers & more. Cash on delivery, 24-hour delivery, order online.';
  var DEFAULT_SEO_KEYS = 'Fix and Fit store Kuwait, car seat cover Kuwait, seat cover Jleeb Al-Shuyoukh, car Android screen installation, reverse camera car Kuwait, CCTV camera installation Kuwait, drill machine Kuwait, car steering cover, car speaker repair, HDMI cable Kuwait, Bluetooth adapter, Wi-Fi router setup Kuwait, TV remote control Kuwait, sit cover, car accessories Jleeb Al-Shuyoukh, makhfar car accessories, electronics repair Kuwait, home delivery Kuwait';

  function el(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------ *
   * Branding: logo / banner / loading / favicon live under config.branding
   * (the `config` node is already world-readable, so no rules change).
   * ------------------------------------------------------------------ */
  var SLOTS = {
    logo:    { max: 160,  q: 0.82, def: 'assets/shop-logo.webp',   label: 'logo' },
    banner:  { max: 1400, q: 0.6,  def: 'assets/shop-banner.webp', label: 'banner' },
    loading: { max: 160,  q: 0.82, def: 'assets/shop-logo.webp',   label: 'loading screen' },
    favicon: { max: 64,   q: 0.85, def: 'assets/shop-logo.webp',   label: 'browser icon' }
  };
  var brand = { logo: '', banner: '', loading: '', favicon: '' };
  var pendingSlot = null;

  function paintBrand(k) {
    var slot = document.querySelector('.brand-slot[data-slot="' + k + '"]');
    if (!slot) return;
    var img = slot.querySelector('[data-prev="' + k + '"]');
    var st = slot.querySelector('[data-state="' + k + '"]');
    var rst = slot.querySelector('[data-reset="' + k + '"]');
    if (img) img.src = brand[k] || SLOTS[k].def;
    if (st) {
      st.textContent = brand[k] ? 'Custom ✓' : 'Default';
      st.classList.toggle('on', !!brand[k]);
    }
    if (rst) rst.hidden = !brand[k];
  }

  function paintBrandAll() { Object.keys(SLOTS).forEach(paintBrand); }

  function readBrand() {
    var c = App.state.config || {};
    var b = c.branding || {};
    Object.keys(SLOTS).forEach(function (k) {
      brand[k] = typeof b[k] === 'string' ? b[k] : '';
    });
    paintBrandAll();
  }

  function pickBrand(slot, file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) { App.toast('Choose an image file (JPG, PNG or WEBP)', 'err'); return; }
    var hint = el('brandHint');
    if (hint) hint.textContent = 'Processing the ' + SLOTS[slot].label + '…';
    App.cloudUpload(file).then(function (media) {
      if (!media || !media.url) throw new Error('Could not read the image');
      return App.makeVariant(media.url, SLOTS[slot].max, SLOTS[slot].q);
    }).then(function (dataUrl) {
      if (!dataUrl) throw new Error('Could not compress the image');
      brand[slot] = dataUrl;
      paintBrand(slot);
      if (hint) hint.textContent = '✓ ' + SLOTS[slot].label + ' ready — press “Save All Settings” to publish it.';
      App.toast(SLOTS[slot].label + ' updated — remember to save', 'ok');
    }).catch(function (e) {
      if (hint) hint.textContent = 'Could not process that image: ' + (e.message || 'try another file');
      App.toast('Image failed: ' + (e.message || ''), 'err');
    });
  }

  function activateTab(tab) {
    $$('#settingsTabs [data-tab]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tab);
    });
    $$('.card[data-setting-tab]').forEach(function (card) {
      card.hidden = card.getAttribute('data-setting-tab') !== tab;
    });
  }

  function waAutoTxt() {
    var on = el('sWaAuto').checked;
    var t = el('sWaAutoTxt');
    t.textContent = on
      ? 'On — WhatsApp opens by itself with photo, screenshot and full details'
      : 'Off — orders stay in this panel only';
    t.style.color = on ? '#16a34a' : '#dc2626';
  }

  function visitorTxt() {
    var on = el('sVisitors').checked;
    var t = el('sVisitorsTxt');
    t.textContent = on ? 'On — anonymous visitor count is enabled' : 'Off — visitor count is disabled';
    t.style.color = on ? '#16a34a' : '#dc2626';
  }

  function tierRowHTML(t) {
    return '<tr class="tier">' +
      '<td><input class="t-max" type="number" min="1" step="any" inputmode="decimal" value="' +
        (t && t.maxKm != null ? t.maxKm : '') + '" placeholder="any distance"></td>' +
      '<td><input class="t-fee" type="number" min="0" step="any" inputmode="decimal" value="' +
        (t && t.fee != null ? t.fee : '') + '" required></td>' +
      '<td><button class="icbtn danger" data-act="del">🗑</button></td>' +
    '</tr>';
  }

  function renderTiers(tiers) {
    var tbl = el('tierTbl');
    tbl.innerHTML = '<tr><th>Up to (km)</th><th>Fee (KD)</th><th></th></tr>' +
      tiers.map(tierRowHTML).join('');
    bindTierDel();
  }

  function bindTierDel() {
    $$('#tierTbl [data-act="del"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var rows = $$('#tierTbl tr.tier');
        if (rows.length <= 1) { App.toast('Keep at least one delivery row', 'err'); return; }
        b.closest('tr').remove();
      });
    });
  }

  function readTiers() {
    var tiers = [];
    var bad = false;
    $$('#tierTbl tr.tier').forEach(function (tr) {
      var maxRaw = tr.querySelector('.t-max').value.trim();
      var feeRaw = tr.querySelector('.t-fee').value.trim();
      if (feeRaw === '') { bad = true; return; }
      var fee = parseFloat(feeRaw);
      if (!isFinite(fee) || fee < 0) { bad = true; return; }
      var maxKm = maxRaw === '' ? null : parseFloat(maxRaw);
      if (maxKm != null && (!isFinite(maxKm) || maxKm <= 0)) { bad = true; return; }
      tiers.push({ maxKm: maxKm, fee: Math.round(fee * 1000) / 1000 });
    });
    if (bad || !tiers.length) return null;
    return tiers;
  }

  function fill(cfg) {
    if (filled || !cfg) return;
    filled = true;

    el('sShop').value = cfg.shopName || '';
    el('sShopAr').value = cfg.shopNameAr || '';
    el('sEmail').value = cfg.email || '';
    el('sIg').value = cfg.instagram || '';
    el('sPhone').value = cfg.phone || '';
    el('sOwner').value = cfg.ownerPhone || '';
    el('sWa').value = cfg.whatsappNumber || '';
    el('sWamd').value = cfg.wamdNumber || '';
    el('sWamdName').value = cfg.wamdName || '';
    el('sWamdLink').value = cfg.wamdLink || '';
    el('sWaAuto').checked = cfg.whatsappAuto === true;
    waAutoTxt();
    el('sVisitors').checked = cfg.visitorCountingEnabled === true;
    visitorTxt();
    el('sAddr').value = cfg.address || '';
    el('sAddrAr').value = cfg.addressAr || '';
    el('sLat').value = cfg.shopLat != null ? cfg.shopLat : '';
    el('sLng').value = cfg.shopLng != null ? cfg.shopLng : '';

    var seo = cfg.seo || {};
    el('sSeoBase').value = seo.baseUrl || 'https://fixandfit.store';
    el('sSeoSuffix').value = seo.titleSuffix || '';
    el('sSeoDesc').value = seo.description || DEFAULT_SEO_DESC;
    el('sSeoKeys').value = seo.keywords || DEFAULT_SEO_KEYS;
    el('sSeoImg').value = seo.ogImage || '';

    renderTiers(Array.isArray(cfg.deliveryTiers) && cfg.deliveryTiers.length ? cfg.deliveryTiers : defaultTiers);

    readBrand();
  }

  function save() {
    var shop = el('sShop').value.trim();
    if (!shop) { App.toast('Shop name is required', 'err'); el('sShop').focus(); return; }

    var tiers = readTiers();
    if (!tiers) { App.toast('Each delivery row needs a valid distance and fee', 'err'); return; }

    var lat = parseFloat(el('sLat').value);
    var lng = parseFloat(el('sLng').value);

    var data = Object.assign({}, App.state.config || {});
    data.shopName = shop;
    data.shopNameAr = el('sShopAr').value.trim();
    data.email = el('sEmail').value.trim();
    data.instagram = el('sIg').value.trim();
    data.phone = el('sPhone').value.trim();
    data.ownerPhone = el('sOwner').value.trim();
    data.whatsappNumber = el('sWa').value.trim();
    data.wamdNumber = el('sWamd').value.trim();
    data.wamdName = el('sWamdName').value.trim();
    data.wamdLink = el('sWamdLink').value.trim();
    data.whatsappAuto = el('sWaAuto').checked;
    data.visitorCountingEnabled = el('sVisitors').checked;
    data.address = el('sAddr').value.trim();
    data.addressAr = el('sAddrAr').value.trim();
    data.shopLat = isFinite(lat) ? lat : 29.2844;
    data.shopLng = isFinite(lng) ? lng : 47.9656;
    data.deliveryTiers = tiers;
    data.branding = {
      logo: brand.logo || '',
      banner: brand.banner || '',
      loading: brand.loading || '',
      favicon: brand.favicon || ''
    };
    var base = el('sSeoBase').value.trim().replace(/\/+$/, '');
    if (base && !/^https?:\/\//i.test(base)) base = 'https://' + base;
    data.seo = {
      baseUrl: base || 'https://fixandfit.store',
      titleSuffix: el('sSeoSuffix').value.trim(),
      description: el('sSeoDesc').value.trim(),
      keywords: el('sSeoKeys').value.trim(),
      ogImage: el('sSeoImg').value.trim()
    };
    data.updatedAt = firebase.database.ServerValue.TIMESTAMP;

    var btns = [el('btnSave'), el('btnSave2')];
    btns.forEach(function (b) { b.disabled = true; b.textContent = 'Saving…'; });

    App.DB.ref('config').update(data).then(function () {
      btns.forEach(function (b) { b.disabled = false; b.textContent = '💾 Save All Settings'; });
      App.toast('Settings saved — website updated live ✓', 'ok');
    }).catch(function (e) {
      btns.forEach(function (b) { b.disabled = false; b.textContent = '💾 Save All Settings'; });
      App.toast('Save failed: ' + (e && e.message ? e.message : ''), 'err');
    });
  }

  el('btnSave').addEventListener('click', save);
  el('btnSave2').addEventListener('click', save);
  el('sWaAuto').addEventListener('change', waAutoTxt);
  el('sVisitors').addEventListener('change', visitorTxt);
  $$('#settingsTabs [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { activateTab(b.getAttribute('data-tab')); });
  });

  $$('.brand-slot [data-pick]').forEach(function (b) {
    b.addEventListener('click', function () {
      pendingSlot = b.getAttribute('data-pick');
      var f = el('brandFile');
      f.value = '';
      f.click();
    });
  });
  $$('.brand-slot [data-reset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-reset');
      brand[k] = '';
      paintBrand(k);
      App.toast('Reverted to the default ' + SLOTS[k].label + ' — remember to save', 'ok');
    });
  });
  el('brandFile').addEventListener('change', function () {
    if (!pendingSlot) return;
    pickBrand(pendingSlot, this.files && this.files[0]);
    pendingSlot = null;
    this.value = '';
  });

  activateTab('shop');
  el('tierAdd').addEventListener('click', function () {
    var tr = document.createElement('tbody');
    tr.innerHTML = tierRowHTML({ maxKm: null, fee: 1 });
    el('tierTbl').appendChild(tr.firstChild);
    bindTierDel();
  });

  App.onAuth(function () {
    App.on('config', fill);
    App.on('categories', function () {});
    App.on('products', function () {});
  });
})();
