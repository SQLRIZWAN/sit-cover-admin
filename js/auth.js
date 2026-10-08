(function () {
  'use strict';

  function init() {
    var form = document.getElementById('loginForm');
    if (!form) return;
    var email = document.getElementById('lgEmail');
    var pass = document.getElementById('lgPass');
    var errBox = document.getElementById('lgErr');
    var btn = document.getElementById('lgBtn');
    var eye = document.getElementById('lgEye');

    function showErr(msg) {
      errBox.textContent = msg;
      errBox.classList.add('on');
    }

    function friendly(e) {
      var c = e && e.code ? e.code : '';
      if (c === 'auth/invalid-email') return 'Please enter a valid email address.';
      if (c === 'auth/user-not-found' || c === 'auth/wrong-password' || c === 'auth/invalid-credential') return 'Wrong email or password. Try again.';
      if (c === 'auth/too-many-requests') return 'Too many attempts — please wait a few minutes.';
      if (c === 'auth/network-request-failed') return 'Network problem — check your internet.';
      if (c === 'auth/configuration-not-found') return 'Email login is not enabled yet. In Firebase console open Authentication → Sign-in method → enable Email/Password.';
      return e && e.message ? e.message : 'Login failed. Please try again.';
    }

    if (eye) eye.addEventListener('click', function () {
      pass.type = pass.type === 'password' ? 'text' : 'password';
      eye.textContent = pass.type === 'password' ? 'SHOW' : 'HIDE';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.classList.remove('on');
      var em = email.value.trim();
      var pw = pass.value;
      if (!em || !pw) { showErr('Enter email and password.'); return; }
      if (!App.AUTH) { showErr('Still connecting to Firebase — wait a second and try again.'); return; }
      btn.disabled = true;
      btn.textContent = 'Signing in…';

      App.AUTH.signInWithEmailAndPassword(em, pw).then(function () {
        btn.textContent = 'Welcome ✓';
        location.replace('index.html');
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Log in';
        showErr(friendly(err));
      });
    });

    var forgot = document.getElementById('lgForgot');
    if (forgot) forgot.addEventListener('click', function () {
      var em = email.value.trim();
      if (!em) { showErr('Enter your email first, then tap Forgot password.'); email.focus(); return; }
      if (!App.AUTH) { showErr('Still connecting to Firebase — wait a second.'); return; }
      forgot.disabled = true;
      App.AUTH.sendPasswordResetEmail(em).then(function () {
        App.toast('Reset link sent to your email ✓', 'ok');
        forgot.disabled = false;
      }).catch(function (err) {
        forgot.disabled = false;
        showErr(friendly(err));
      });
    });

    App.onAuth(function (user) {
      if (user) location.replace('index.html');
    });

    var t0 = Date.now();
    function hidePre() {
      var wait = Math.max(0, 550 - (Date.now() - t0));
      setTimeout(function () {
        var p = document.getElementById('preloader');
        if (p) p.classList.add('off');
      }, wait);
    }
    if (document.readyState === 'complete') hidePre();
    else window.addEventListener('load', hidePre);
    setTimeout(function () {
      var p = document.getElementById('preloader');
      if (p) p.classList.add('off');
    }, 2400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
