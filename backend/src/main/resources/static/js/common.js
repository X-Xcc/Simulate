/**
 * Common utilities shared across all dashboard pages.
 * Usage: <script src="/yolov8-security/static/js/common.js"></script>
 */
(function() {
    'use strict';

    var API_BASE = '/yolov8-security';

    function escHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escAttr(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function setTxt(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text == null ? '' : String(text);
    }

    function authFetch(url, opts) {
        opts = opts || {};
        var headers = opts.headers || {};
        var token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        opts.headers = headers;
        return fetch(url, opts).then(function(resp) {
            if (resp.status === 401) {
                window.location.href = API_BASE + '/login';
                return Promise.reject(new Error('Unauthorized'));
            }
            if (!resp.ok) {
                return resp.json().catch(function() { return { message: 'HTTP ' + resp.status }; })
                    .then(function(body) {
                        toast(body.message || 'Request failed (' + resp.status + ')', 'error');
                        return Promise.reject(new Error(body.message || resp.status));
                    });
            }
            return resp.json();
        });
    }

    function toast(msg, type) {
        type = type || 'info';
        var container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        var t = document.createElement('div');
        t.className = 'toast ' + type;
        var icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };
        t.textContent = (icons[type] || '') + ' ' + msg;
        container.appendChild(t);
        setTimeout(function() {
            t.style.opacity = '0';
            t.style.transform = 'translateX(40px)';
            t.style.transition = 'all .3s';
            setTimeout(function() { t.remove(); }, 300);
        }, 3500);
    }

    function openModal(title, bodyEl, footerEl) {
        var overlay = document.getElementById('modalOverlay');
        if (!overlay) return;
        setTxt('modalTitle', title);
        var body = document.getElementById('modalBody');
        if (body) { body.innerHTML = ''; if (bodyEl) body.appendChild(bodyEl); }
        var footer = document.getElementById('modalFooter');
        if (footer) { footer.innerHTML = ''; if (footerEl) footer.appendChild(footerEl); }
        overlay.classList.add('show');
        setTimeout(function() {
            var focusable = overlay.querySelector('input, button, select, textarea, [tabindex]');
            if (focusable) focusable.focus();
        }, 50);
    }

    function closeModal() {
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('show');
    }

    function onEvent(id, event, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    function initTheme() {
        var saved = localStorage.getItem('theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    function themeToggle() {
        var current = document.documentElement.getAttribute('data-theme');
        if (current === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    }

    function startClock(id) {
        var el = document.getElementById(id);
        if (!el) return;
        function update() {
            var now = new Date();
            var h = String(now.getHours()).padStart(2, '0');
            var m = String(now.getMinutes()).padStart(2, '0');
            var s = String(now.getSeconds()).padStart(2, '0');
            el.textContent = h + ':' + m + ':' + s;
        }
        update();
        setInterval(update, 1000);
    }

    // Sidebar toggle for responsive
    function initSidebarToggle() {
        var btn = document.querySelector('.sidebar-toggle');
        var sidebar = document.querySelector('.sidebar');
        if (btn && sidebar) {
            btn.addEventListener('click', function() {
                sidebar.classList.toggle('open');
            });
        }
    }

    // Export to window.Common
    window.Common = {
        API_BASE: API_BASE,
        escHtml: escHtml,
        escAttr: escAttr,
        setTxt: setTxt,
        authFetch: authFetch,
        toast: toast,
        openModal: openModal,
        closeModal: closeModal,
        onEvent: onEvent,
        initTheme: initTheme,
        themeToggle: themeToggle,
        startClock: startClock,
        initSidebarToggle: initSidebarToggle
    };

    // Auto-init theme on load
    initTheme();
})();
