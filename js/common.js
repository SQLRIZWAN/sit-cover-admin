(function () {
  'use strict';

  var App = window.App = {
    state: { config: null, categories: {}, products: {} },
    hubs: { config: [], categories: [], products: [], auth: [] },
    loaded: { config: false, categories: false, products: false },
    user: null,
    connected: false,
    fbTried: false,
    authFlushed: false
  };

  var $ = App.$ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = App.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  App.esc = function (v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  App.fmtKD = function (n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return v.toFixed(3) + ' KD';
  };

  App.pad = function (n) { return n < 10 ? '0' + n : '' + n; };

  App.todayKey = function () {
    try {
      var d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuwait' }));
      return d.getFullYear() + '-' + App.pad(d.getMonth() + 1) + '-' + App.pad(d.getDate());
    } catch (e) {
      var x = new Date();
      return x.getFullYear() + '-' + App.pad(x.getMonth() + 1) + '-' + App.pad(x.getDate());
    }
  };

  App.fmtDate = function (ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('en-GB', {
        timeZone: 'Asia/Kuwait',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return new Date(ts).toLocaleString(); }
  };

  var toastTimer;
  App.toast = function (msg, kind) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast on' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 3000);
  };

  App.loadScript = function (src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (cb) {
      s.onload = cb;
      s.onerror = function () { cb(new Error('load failed: ' + src)); };
    }
    document.head.appendChild(s);
    return s;
  };

  App.on = function (key, fn) {
    if (!App.hubs[key]) App.hubs[key] = [];
    App.hubs[key].push(fn);
    if (key === 'auth') {
      if (App.user) fn(App.user);
    } else {
      fn(App.state[key]);
    }
  };

  function fire(key, arg) {
    var list = App.hubs[key] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](arg); } catch (e) { console.error(e); }
    }
  }
  App.fire = fire;

  App.onAuth = function (fn) { App.on('auth', fn); };

  App.catList = function (includeInactive) {
    var c = App.state.categories || {};
    var arr = [];
    for (var id in c) {
      var o = c[id] || {};
      o.id = id;
      if (!includeInactive && o.active === false) continue;
      arr.push(o);
    }
    arr.sort(function (a, b) {
      return (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999);
    });
    return arr;
  };

  App.prodList = function () {
    var p = App.state.products || {};
    var arr = [];
    for (var id in p) {
      var o = p[id] || {};
      o.id = id;
      arr.push(o);
    }
    arr.sort(function (a, b) {
      var ao = typeof a.order === 'number' ? a.order : 0;
      var bo = typeof b.order === 'number' ? b.order : 0;
      if (ao !== bo) return ao - bo;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return arr;
  };

  function fitImg(url, w) {
    if (!url || url.indexOf('/upload/') === -1) return url || '';
    return url.replace('/upload/', '/upload/w_' + w + ',q_auto,f_auto/');
  }
  App.fitImg = fitImg;

  App.mediaThumb = function (m, w) {
    if (!m) return '';
    if (m.type === 'video') {
      if (m.thumb) return fitImg(m.thumb, w || 400);
      if (m.url && m.url.indexOf('/upload/') > -1) {
        return m.url.replace('/upload/', '/upload/so_0,f_jpg,q_auto,w_' + (w || 400) + '/');
      }
      return '';
    }
    return fitImg(m.url, w || 400);
  };

  App.firstMedia = function (p) {
    return (p && p.media && p.media.length) ? p.media[0] : null;
  };

  function readDataURL(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || '')); };
      fr.onerror = function () { reject(new Error('Cannot read file')); };
      fr.readAsDataURL(file);
    });
  }

  function compressImage(file, maxEdge, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || 1;
          var h = img.naturalHeight || 1;
          var scale = Math.min(1, maxEdge / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          var t = 'image/jpeg';
          try {
            if (c.toDataURL('image/webp').indexOf('data:image/webp') === 0) t = 'image/webp';
          } catch (e1) {}
          resolve(c.toDataURL(t, quality));
        } catch (e) { reject(new Error('Cannot process image')); }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Cannot read image file'));
      };
      img.src = url;
    });
  }

  function videoPoster(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      var done = false;
      var out = '';
      function finish() {
        if (done) return;
        done = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
        resolve(out);
      }
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.onloadeddata = function () { try { v.currentTime = 0.1; } catch (e) { finish(); } };
      v.onseeked = function () {
        try {
          var w = v.videoWidth || 480;
          var h = v.videoHeight || 480;
          var scale = Math.min(1, 480 / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          out = c.toDataURL('image/webp', 0.72) || '';
        } catch (e) {}
        finish();
      };
      v.onerror = function () { finish(); };
      setTimeout(finish, 7000);
      v.src = url;
    });
  }

  App.makeVariant = function (dataUrl, maxEdge, quality) {
    return new Promise(function (resolve) {
      if (!dataUrl) { resolve(''); return; }
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || 1;
          var h = img.naturalHeight || 1;
          var scale = Math.min(1, maxEdge / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var t = 'image/jpeg';
          try {
            if (c.toDataURL('image/webp').indexOf('data:image/webp') === 0) t = 'image/webp';
          } catch (e1) {}
          resolve(c.toDataURL(t, quality));
        } catch (e) { resolve(''); }
      };
      img.onerror = function () { resolve(''); };
      img.src = dataUrl;
    });
  };

  App.cloudUpload = function (file, onProgress) {
    return new Promise(function (resolve, reject) {
      try {
        if (!file || !file.size) { reject(new Error('No file selected')); return; }
        var isVideo = /^video\//.test(file.type || '');
        if (!isVideo && !/^image\//.test(file.type || '')) {
          reject(new Error('Only images (JPG/PNG/WEBP) and videos (MP4/WEBM) are allowed'));
          return;
        }
        if (onProgress) onProgress(15);
        if (isVideo) {
          if (file.size > 2.5 * 1024 * 1024) {
            reject(new Error('Video too large (max 2.5 MB) — trim it or upload a photo'));
            return;
          }
          videoPoster(file).then(function (poster) {
            if (onProgress) onProgress(60);
            return readDataURL(file).then(function (data) {
              if (onProgress) onProgress(100);
              resolve({
                type: 'video',
                url: data,
                thumb: poster,
                publicId: '',
                cloud: 'inline',
                format: String(file.name || '').split('.').pop() || 'mp4',
                bytes: file.size
              });
            });
          }).catch(function (e) { reject(e); });
        } else {
          compressImage(file, 1400, 0.82).then(function (data) {
            if (onProgress) onProgress(100);
            resolve({
              type: 'image',
              url: data,
              publicId: '',
              cloud: 'inline',
              format: data.indexOf('data:image/webp') === 0 ? 'webp' : 'jpeg',
              bytes: Math.round(data.length * 0.75)
            });
          }).catch(function (e) { reject(e); });
        }
      } catch (e) { reject(e); }
    });
  };

  App.buildWaMessage = function (o, cfg) {
    var lines = [];
    lines.push('*New Order* — ' + cfg.shopName);
    lines.push('Order: #' + String(o.id || '').slice(-8).toUpperCase());
    lines.push('');
    lines.push('*Items:*');
    (o.items || []).forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.name + ' x' + it.qty + ' — ' + App.fmtKD(Number(it.price) * Number(it.qty)));
    });
    lines.push('');
    lines.push('Subtotal: ' + App.fmtKD(o.subtotal));
    lines.push('Delivery (' + (o.distanceKm != null ? Number(o.distanceKm).toFixed(1) + ' km' : 'flat') + '): ' + App.fmtKD(o.deliveryFee));
    lines.push('*Total: ' + App.fmtKD(o.total) + '*');
    lines.push('Payment: ' + (o.paymentMethod === 'wamd' ? 'WAMD (prepaid)' : 'Cash on Delivery'));
    lines.push('');
    lines.push('*Customer:* ' + o.customer.name);
    lines.push('Phone: ' + o.customer.phone);
    lines.push('Location: ' + (o.customer.address || 'not specified'));
    if (o.customer.lat != null) {
      lines.push('Map: https://maps.google.com/?q=' + o.customer.lat + ',' + o.customer.lng);
    }
    if (o.paymentScreenshot) {
      lines.push('Payment screenshot uploaded — open the order in the admin panel.');
    }
    return lines.join('\n');
  };

  App.waLink = function (num, text) {
    var n = String(num || '').replace(/[^0-9]/g, '');
    if (!n) return null;
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text);
  };

  App.orderStatus = function (o) {
    return o && o.status ? o.status : 'new';
  };

  function sideHTML() {
    return '' +
      '<div class="side-head">' +
        '<img src="assets/logo.svg" alt="">' +
        '<div><b id="sdName">Sit Cover</b><small>Admin Panel</small></div>' +
      '</div>' +
      '<nav>' +
        '<a class="nav-i" data-nav="dashboard" href="index.html"><span class="ic">📊</span> Dashboard</a>' +
        '<a class="nav-i" data-nav="orders" href="orders.html"><span class="ic">🧾</span> Orders <span class="pill hide" id="navOrders">0</span></a>' +
        '<a class="nav-i" data-nav="categories" href="categories.html"><span class="ic">🗂️</span> Categories</a>' +
        '<div class="nav-label">Products</div>' +
        '<a class="nav-i" data-nav="products-all" href="products.html"><span class="ic">📦</span> All Products</a>' +
        '<div id="navCats"></div>' +
        '<a class="nav-i" data-nav="settings" href="settings.html"><span class="ic">⚙️</span> Settings</a>' +
        '<button class="logout" id="logoutBtn"><span class="ic">🚪</span> Log out</button>' +
      '</nav>';
  }

  function topHTML() {
    return '' +
      '<button id="mMenu" aria-label="Menu">☰</button>' +
      '<h1 id="topTitle">Dashboard</h1>' +
      '<div class="top-r">' +
        '<span class="live"><i></i> Live</span>' +
        '<span class="adm-email" id="admEmail"></span>' +
      '</div>';
  }

  function pageTitle(t) {
    var t1 = $('#topTitle');
    if (t1) t1.textContent = t;
    document.title = t + ' — Sit Cover Admin';
  }
  App.pageTitle = pageTitle;

  function markActive() {
    var nav = document.body.getAttribute('data-nav') || '';
    $$('.nav-i').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('data-nav') === nav);
    });
  }
  App.markActive = markActive;

  function renderNavCats() {
    var box = $('#navCats');
    if (!box) return;
    var cats = App.catList(true);
    box.innerHTML = cats.map(function (c) {
      return '<a class="nav-i nav-sub" data-nav="products-' + App.esc(c.id) + '" href="products.html?cat=' + encodeURIComponent(c.id) + '">' +
        '<span class="ic">' + App.esc(c.icon || '📁') + '</span> ' + App.esc(c.name) + '</a>';
    }).join('');
    markActive();
  }

  function initShell() {
    var side = $('#adminSide');
    if (side) side.innerHTML = sideHTML();
    var top = $('#adminTop');
    if (top) top.innerHTML = topHTML();

    markActive();

    var mm = $('#mMenu');
    if (mm) mm.addEventListener('click', function () {
      $('#adminSide').classList.add('on');
      var sc = $('#scrim');
      if (sc) sc.classList.add('on');
    });
    var sc = $('#scrim');
    if (sc) sc.addEventListener('click', function () {
      $('#adminSide').classList.remove('on');
      sc.classList.remove('on');
    });

    var lo = $('#logoutBtn');
    if (lo) lo.addEventListener('click', function () {
      firebase.auth().signOut().then(function () {
        location.href = 'login.html';
      });
    });

    var t0 = Date.now();
    function hidePre() {
      var wait = Math.max(0, 550 - (Date.now() - t0));
      setTimeout(function () {
        var p = $('#preloader');
        if (p) p.classList.add('off');
      }, wait);
    }
    if (document.readyState === 'complete') hidePre();
    else window.addEventListener('load', hidePre);
    setTimeout(function () {
      var p = $('#preloader');
      if (p) p.classList.add('off');
    }, 2400);
  }

  function onLogin() {
    return /login\.html$/.test(location.pathname);
  }

  function connectDB() {
    var DB = firebase.database();
    App.DB = DB;
    App.AUTH = firebase.auth();

    DB.ref('.info/connected').on('value', function (s) {
      App.connected = s.val() === true;
    });

    App.AUTH.onAuthStateChanged(function (user) {
      if (user) {
        App.user = user;
        var em = $('#admEmail');
        if (em) em.textContent = user.email || '';
        if (!App.authFlushed) {
          App.authFlushed = true;
          attachData();
        }
        fire('auth', user);
        if (onLogin()) location.replace('index.html');
      } else {
        App.user = null;
        if (!onLogin()) location.replace('login.html');
      }
    });

    if (onLogin()) {
      DB.ref('config').on('value', function (s) {
        App.state.config = s.val() || null;
        App.loaded.config = true;
        fire('config', App.state.config);
      });
    }
  }

  function attachData() {
    var DB = App.DB;

    DB.ref('config').on('value', function (s) {
      App.state.config = s.val() || null;
      App.loaded.config = true;
      var sd = $('#sdName');
      if (sd && App.state.config && App.state.config.shopName) sd.textContent = App.state.config.shopName;
      fire('config', App.state.config);
    });

    DB.ref('categories').on('value', function (s) {
      App.state.categories = s.val() || {};
      App.loaded.categories = true;
      renderNavCats();
      fire('categories', App.state.categories);
    });

    DB.ref('products').on('value', function (s) {
      App.state.products = s.val() || {};
      App.loaded.products = true;
      fire('products', App.state.products);
    });

    DB.ref('orders').orderByChild('status').equalTo('new').on('value', function (s) {
      var n = s.numChildren();
      var p = $('#navOrders');
      if (p) {
        p.textContent = n;
        p.classList.toggle('hide', n === 0);
      }
    });
  }

  function loadFirebase() {
    if (App.fbTried) return;
    App.fbTried = true;

    var cfg = (window.APP_CONFIG && APP_CONFIG.firebase) || {};
    if (!cfg.apiKey || !cfg.databaseURL) {
      var b = $('#bootErr');
      if (b) {
        b.style.display = 'block';
        b.textContent = 'Configuration missing — js/config.js was not filled. Rebuild with secrets.';
      }
      return;
    }

    App.loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js', function (e1) {
      if (e1) { showBootErr('Cannot reach Firebase (network or ad-blocker).'); return; }
      App.loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js', function (e2) {
        if (e2) { showBootErr('Cannot reach Firebase database.'); return; }
        App.loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js', function (e3) {
          if (e3) { showBootErr('Cannot reach Firebase auth.'); return; }
          try {
            firebase.initializeApp(cfg);
            connectDB();
          } catch (err) {
            showBootErr('Firebase init error: ' + err.message);
          }
        });
      });
    });
  }

  function showBootErr(msg) {
    var b = $('#bootErr');
    if (b) {
      b.style.display = 'block';
      b.textContent = msg;
    }
    var p = $('#preloader');
    if (p) p.classList.add('off');
  }

  App.boot = function () {
    initShell();
    loadFirebase();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.boot);
  } else {
    App.boot();
  }
})();
