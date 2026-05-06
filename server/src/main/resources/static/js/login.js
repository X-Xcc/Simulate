/* ===== 监狱行为分析系统 — 登录逻辑 ===== */
(function () {
    'use strict';

    const DOM = {
        form: document.getElementById('loginForm'),
        username: document.getElementById('username'),
        password: document.getElementById('password'),
        loginBtn: document.getElementById('loginBtn'),
        errorBar: document.getElementById('errorBar'),
        errorMsg: document.getElementById('errorMsg'),
        attempts: document.getElementById('attempts'),
        togglePwd: document.getElementById('togglePwd'),
        rememberMe: document.getElementById('rememberMe'),
        card: document.getElementById('loginCard'),
    };

    const API_BASE = '/yolov8-security/api';
    let failCount = 0;

    /* ------- 已登录则跳转（先验证 token 有效性）------- */
    (async function checkExistingToken() {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch('/yolov8-security/api/stats/summary', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                redirectToDash();
            } else {
                sessionStorage.removeItem('auth_token');
                localStorage.removeItem('auth_token');
            }
        } catch (e) {
            // Network error — clear token to be safe
            sessionStorage.removeItem('auth_token');
            localStorage.removeItem('auth_token');
        }
    })();

    /* ------- 记住我 ------- */
    const saved = localStorage.getItem('remembered_user');
    if (saved) { DOM.username.value = saved; DOM.rememberMe.checked = true; }
    if (localStorage.getItem('remember_pwd') === 'true') {
        DOM.password.value = localStorage.getItem('remembered_pwd') || '';
    }

    /* ------- 显示密码 ------- */
    DOM.togglePwd.addEventListener('click', function () {
        const inp = DOM.password;
        const type = inp.type === 'password' ? 'text' : 'password';
        inp.type = type;
        this.querySelector('.eye-icon').style.opacity = type === 'text' ? '0.5' : '1';
    });

    /* ------- 提交 ------- */
    DOM.form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const user = DOM.username.value.trim();
        const pass = DOM.password.value;
        if (!user || !pass) { showError('请输入用户名和密码'); return; }

        setLoading(true);
        hideError();

        try {
            const res = await fetch(API_BASE + '/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass }),
            });

            if (res.ok) {
                const data = await res.json();
                saveToken(data.token, data.expiresIn);
                if (DOM.rememberMe.checked) {
                    localStorage.setItem('remembered_user', user);
                    if (DOM.rememberMe.checked) {
                        localStorage.setItem('remember_pwd', 'true');
                        localStorage.setItem('remembered_pwd', pass);
                    }
                } else {
                    localStorage.removeItem('remembered_user');
                    localStorage.removeItem('remember_pwd');
                    localStorage.removeItem('remembered_pwd');
                }
                failCount = 0;
                redirectToDash();
            } else {
                const data = await res.json();
                failCount++;
                const remain = Math.max(0, 5 - failCount);
                DOM.attempts.textContent = '剩余尝试: ' + remain + '/5';
                showError(data.error || '用户名或密码错误');
                shakeCard();
                if (remain <= 0) {
                    DOM.loginBtn.disabled = true;
                    setTimeout(() => { DOM.loginBtn.disabled = false; failCount = 0; DOM.attempts.textContent = ''; }, 15 * 60 * 1000);
                }
            }
        } catch (err) {
            showError('网络错误，请检查连接');
        } finally {
            setLoading(false);
        }
    });

    /* ------- 辅助函数 ------- */
    function showError(msg) {
        DOM.errorMsg.textContent = msg;
        DOM.errorBar.classList.add('show');
    }
    function hideError() {
        DOM.errorBar.classList.remove('show');
    }
    function shakeCard() {
        DOM.card.classList.remove('shake');
        void DOM.card.offsetWidth; /* reflow */
        DOM.card.classList.add('shake');
    }
    function setLoading(v) {
        DOM.loginBtn.classList.toggle('loading', v);
        DOM.loginBtn.disabled = v;
    }

    function getToken() { return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token'); }
    function saveToken(token, expiresIn) {
        if (DOM.rememberMe.checked) {
            localStorage.setItem('auth_token', token);
        } else {
            sessionStorage.setItem('auth_token', token);
        }
    }
    function redirectToDash() {
        DOM.card.style.transition = 'opacity 0.3s, transform 0.3s';
        DOM.card.style.opacity = '0';
        DOM.card.style.transform = 'scale(0.95)';
        setTimeout(() => { window.location.href = '/yolov8-security/'; }, 350);
    }

})();