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

  function el(id) { return document.getElementById(id); }

  function waSubmitTxt() {
    var on = el('sWaSubmit').checked;
    var t = el('sWaSubmitTxt');
    t.textContent = on
      ? 'Shown — customers can send the order to WhatsApp too'
      : 'Hidden — orders go to the panel only';
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
    el('sWamdLink').value = cfg.wamdLink || '';
    el('sWaSubmit').checked = cfg.whatsappSubmitEnabled !== false;
    waSubmitTxt();
    el('sVisitors').checked = cfg.visitorCountingEnabled === true;
    visitorTxt();
    el('sAddr').value = cfg.address || '';
    el('sAddrAr').value = cfg.addressAr || '';
    el('sLat').value = cfg.shopLat != null ? cfg.shopLat : '';
    el('sLng').value = cfg.shopLng != null ? cfg.shopLng : '';

    renderTiers(Array.isArray(cfg.deliveryTiers) && cfg.deliveryTiers.length ? cfg.deliveryTiers : defaultTiers);
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
    data.wamdLink = el('sWamdLink').value.trim();
    data.whatsappSubmitEnabled = el('sWaSubmit').checked;
    data.visitorCountingEnabled = el('sVisitors').checked;
    data.address = el('sAddr').value.trim();
    data.addressAr = el('sAddrAr').value.trim();
    data.shopLat = isFinite(lat) ? lat : 29.2844;
    data.shopLng = isFinite(lng) ? lng : 47.9656;
    data.deliveryTiers = tiers;
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
  el('sWaSubmit').addEventListener('change', waSubmitTxt);
  el('sVisitors').addEventListener('change', visitorTxt);
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
