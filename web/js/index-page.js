/**
 * index-page.js — 监控总览页面主脚本
 *
 * 职责：
 * 1. 页面初始化（主题、时钟、摄像头切换）
 * 2. 数据获取与展示（统计数据、图表、检测记录）
 * 3. 摄像头配置管理（增删改查）
 * 4. 用户信息展示
 * 5. 事件绑定（替代 HTML 中的 onclick 属性，确保 CSP 合规）
 *
 * 依赖模块：
 * - common.js    — 通用工具函数（authFetch、toast、modal 等）
 * - chart-module.js — Chart.js 图表封装
 * - detection-module.js — 检测记录表格管理
 * - alert-module.js — 告警事件管理
 */
(function() {
    'use strict';

    /* 获取全局模块引用 */
    var Common = window.Common;
    var ChartModule = window.ChartModule;
    var DetectionModule = window.DetectionModule;
    var AlertModule = window.AlertModule;
    var API_BASE = Common.API_BASE;

    /* ===== 全局状态 ===== */
    var CAM_DEFAULT_NAMES = { '0': 'A区-主监控', '1': 'B区-走廊', '2': 'C区-操场' };
    /** 统计数据缓存 — 存储各类检测行为的计数 */
    var S = { total: 0, images: 0, fall: 0, fight: 0, fatigue: 0, leave: 0, gather: 0 };
    /** 当前选中的摄像头 ID */
    var currentCam = '0';
    /** 上一次检测总数 — 用于判断是否有新增告警 */
    var previousDetectionCount = 0;
    /** 上一次已知的总检测数 — 用于判断是否需要刷新数据 */
    var lastKnownTotal = -1;

    /* ===== 主题切换（委托给 Common 模块） ===== */

    /**
     * 初始化主题 — 从 localStorage 读取用户上次选择的主题
     * 默认使用亮色主题（light）
     */
    function initTheme() {
        var saved = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon(saved);
    }

    /**
     * 切换主题 — 在亮色/暗色之间切换
     * 同时更新 localStorage 持久化和图表主题
     */
    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme') || 'light';
        var next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
        /* 同步更新 Chart.js 图表的配色方案 */
        ChartModule.updateChartTheme();
    }

    /**
     * 更新主题切换按钮的图标
     * @param {string} theme - 当前主题名称（'light' 或 'dark'）
     */
    function updateThemeIcon(theme) {
        var btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = theme === 'dark' ? '\u2600' : '\uD83C\uDF19';
    }

    /* 页面加载时立即初始化主题 */
    initTheme();

    /* ===== 时钟与运行时间 ===== */

    /** 页面加载时间戳 — 用于计算系统运行时长 */
    var _startTime = Date.now();

    /**
     * 时钟更新函数 — 每秒执行一次
     * 功能：
     * 1. 更新顶部栏的当前时间显示（格式：YYYY-MM-DD HH:MM:SS）
     * 2. 更新系统运行时长（格式：Xh Xm Xs）
     */
    function tick() {
        var n = new Date();
        var p = function(v) { return String(v).padStart(2, '0'); };
        /* 更新顶部栏时间显示 */
        var el = document.getElementById('topbarTime');
        if (el) el.textContent = n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate()) + ' ' + p(n.getHours()) + ':' + p(n.getMinutes()) + ':' + p(n.getSeconds());
        /* 计算并更新系统运行时长 */
        var elapsed = Math.floor((Date.now() - _startTime) / 1000);
        var h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
        Common.setTxt('sUptime', (h > 0 ? h + 'h ' : '') + m + 'm ' + s + 's');
    }

    /* 立即执行一次，然后每秒更新 */
    tick();
    setInterval(tick, 1000);

    /* ===== 摄像头切换 ===== */

    /**
     * 摄像头名称映射表 — 用于将摄像头 ID 显示为友好名称
     * 可通过后端 API 动态更新
     */
    var camNameMap = {};
    Object.keys(CAM_DEFAULT_NAMES).forEach(function(k) { camNameMap[k] = CAM_DEFAULT_NAMES[k]; });

    /**
     * 切换摄像头 — 更新视频流源地址和标签
     * @param {HTMLElement} tab - 被点击的摄像头标签元素
     */
    function switchCam(tab) {
        /* 移除所有标签的 active 状态 */
        document.querySelectorAll('.cam-tab').forEach(function(t) { t.classList.remove('active'); });
        /* 激活当前标签 */
        tab.classList.add('active');
        currentCam = tab.dataset.cam;
        /* 更新视频流地址 — 后端根据 cam 参数返回对应摄像头的 MJPEG 流 */
        document.getElementById('videoFeed').src = API_BASE + '/video_feed?cam=' + currentCam;
        /* 更新摄像头名称标签 */
        document.getElementById('camLabel').textContent = camNameMap[currentCam] || '摄像头 ' + currentCam;
    }
    /* 暴露给全局作用域（HTML 中可能仍有引用） */
    window.switchCam = switchCam;

    /**
     * 动态构建摄像头标签栏
     * 从后端获取活跃摄像头列表后，生成对应的标签页
     * @param {Array} camIds - 活跃摄像头 ID 数组（如 ['cam0', 'cam1']）
     */
    function buildCamTabs(camIds) {
        var container = document.getElementById('camTabs');
        if (!container || !camIds || camIds.length === 0) return;
        /* 规范化摄像头 ID（去除 'cam' 前缀） */
        var normalizedIds = camIds.map(function(id) { return String(id).replace('cam', ''); });
        container.innerHTML = '';
        normalizedIds.forEach(function(id, i) {
            var name = camNameMap[id] || '摄像头 ' + (i + 1);
            var div = document.createElement('div');
            div.className = 'cam-tab' + (i === 0 ? ' active' : '');
            div.dataset.cam = id;
            /* 摄像头状态指示点 */
            var dot = document.createElement('span');
            dot.className = 'cam-dot';
            div.appendChild(dot);
            div.appendChild(document.createTextNode(name));
            /* 绑定点击事件 — CSP 合规，不使用 onclick 属性 */
            div.addEventListener('click', function() { switchCam(div); });
            container.appendChild(div);
        });
        /* 默认选中第一个摄像头 */
        if (normalizedIds.length > 0) {
            currentCam = normalizedIds[0];
            document.getElementById('videoFeed').src = API_BASE + '/video_feed?cam=' + currentCam;
            document.getElementById('camLabel').textContent = camNameMap[currentCam] || '摄像头 1';
        }
    }

    /* ===== 模态框关闭监听 ===== */

    /**
     * 点击模态框遮罩层关闭模态框
     * 仅当点击目标是遮罩层本身时才关闭（避免误关子元素）
     */
    document.getElementById('modalOverlay').addEventListener('click', function(e) {
        if (e.target === document.getElementById('modalOverlay')) Common.closeModal();
    });

    /* ===== 用户信息展示 ===== */

    /**
     * 显示当前用户信息弹窗
     * 包含：头像、姓名、工号、岗位、在线状态、最后登录时间、登录 IP
     * 以及关闭和退出登录按钮
     */
    function showUserInfo() {
        var now = new Date();
        var p = function(v) { return String(v).padStart(2, '0'); };
        var timeStr = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()) + ':' + p(now.getSeconds());

        /* 构建用户信息卡片内容 — 使用 DOM API + innerHTML（纯展示内容，无事件绑定） */
        var body = document.createElement('div');
        body.innerHTML =
            '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
                '<div style="width:44px;height:44px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff">\u9648</div>' +
                '<div><div style="font-size:14px;font-weight:700">\u9648\u660E</div><div style="font-size:11px;color:var(--text-muted)">\u5DE5\u53F7 J-005 \u00B7 \u8D85\u7EA7\u7BA1\u7406\u5458</div></div>' +
            '</div>' +
            '<div style="border-top:1px solid var(--border);padding-top:10px">' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
                    '<div style="padding:8px;background:var(--bg);border-radius:5px"><div style="font-size:9px;color:var(--text-muted);font-weight:600">\u5C97\u4F4D</div><div style="font-size:12px;font-weight:600;margin-top:2px">\u76D1\u533A\u957F</div></div>' +
                    '<div style="padding:8px;background:var(--bg);border-radius:5px"><div style="font-size:9px;color:var(--text-muted);font-weight:600">\u72B6\u6001</div><div style="font-size:12px;font-weight:600;color:var(--green);margin-top:2px">\u25CF \u5728\u7EBF</div></div>' +
                    '<div style="padding:8px;background:var(--bg);border-radius:5px"><div style="font-size:9px;color:var(--text-muted);font-weight:600">\u6700\u540E\u767B\u5F55</div><div style="font-size:12px;font-weight:600;margin-top:2px">' + Common.escHtml(timeStr) + '</div></div>' +
                    '<div style="padding:8px;background:var(--bg);border-radius:5px"><div style="font-size:9px;color:var(--text-muted);font-weight:600">\u767B\u5F55IP</div><div style="font-size:12px;font-weight:600;margin-top:2px">192.168.1.14</div></div>' +
                '</div>' +
            '</div>';

        /* 构建模态框底部按钮 — 使用 DOM API + addEventListener（CSP 合规） */
        var footer = document.createElement('div');

        /* 关闭按钮 */
        var closeBtn = document.createElement('button');
        closeBtn.className = 'btn';
        closeBtn.textContent = '\u5173\u95ED';
        closeBtn.addEventListener('click', Common.closeModal);
        footer.appendChild(closeBtn);

        /* 退出登录按钮 — 清除 token 并跳转到登录页 */
        var logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn btn-danger';
        logoutBtn.textContent = '\u9000\u51FA\u767B\u5F55';
        logoutBtn.addEventListener('click', function() {
            sessionStorage.removeItem('auth_token');
            localStorage.removeItem('auth_token');
            window.location.href = API_BASE + '/login';
        });
        footer.appendChild(logoutBtn);

        Common.openModal('\u5F53\u524D\u7528\u6237', body, footer);
    }
    /* 暴露给全局作用域（侧边栏用户头像点击触发） */
    window.showUserInfo = showUserInfo;

    /* ===== 视频控制 ===== */

    /**
     * 全屏切换 — 将视频区域切换到全屏模式
     * 兼容不同浏览器的 Fullscreen API 前缀
     */
    function fullscreen() {
        var el = document.getElementById('videoWrap');
        if (!el) return;
        (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen).call(el);
    }
    window.fullscreen = fullscreen;

    /**
     * 截图功能 — 将当前视频帧保存为 JPEG 图片
     * 实现原理：
     * 1. 创建 Canvas 元素
     * 2. 将视频当前帧绘制到 Canvas
     * 3. 将 Canvas 转换为 Blob（JPEG 格式，质量 0.9）
     * 4. 创建临时下载链接并触发下载
     */
    function captureScreenshot() {
        var video = document.getElementById('videoFeed');
        if (!video) return;
        try {
            var canvas = document.createElement('canvas');
            canvas.width = video.naturalWidth || video.width;
            canvas.height = video.naturalHeight || video.height;
            canvas.getContext('2d').drawImage(video, 0, 0);
            canvas.toBlob(function(blob) {
                if (!blob) { Common.toast('\u622A\u56FE\u5931\u8D25\uFF1A\u89C6\u9891\u6D41\u4E0D\u652F\u6301\u622A\u56FE', 'error'); return; }
                /* 创建临时下载链接 */
                var link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = '\u622A\u56FE_' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg';
                link.click();
                /* 释放临时 URL 占用的内存 */
                URL.revokeObjectURL(link.href);
                Common.toast('\u622A\u56FE\u5DF2\u4FDD\u5B58', 'success');
            }, 'image/jpeg', 0.9);
        } catch (e) {
            Common.toast('\u622A\u56FE\u5931\u8D25\uFF1A\u6D4F\u89C8\u5668\u5B89\u5168\u9650\u5236', 'error');
        }
    }
    window.captureScreenshot = captureScreenshot;

    /* ===== 模型与服务状态信息 ===== */

    /**
     * 获取 AI 模型和服务状态信息
     * 并行请求三个 API：
     * 1. /api/model_info — YOLOv8 模型信息（精度、设备、GPU）
     * 2. /api/ai/status — Qwen2.5-VL 大模型服务状态
     * 3. /api/system_info — 系统信息（数据目录大小等）
     *
     * 使用 Promise.allSettled 确保即使某个请求失败也不影响其他
     */
    async function fetchModelInfo() {
        try {
            var results = await Promise.allSettled([
                Common.authFetch(API_BASE + '/api/model_info'),
                Common.authFetch(API_BASE + '/api/ai/status'),
                Common.authFetch(API_BASE + '/api/system_info')
            ]);
            var modelRes = results[0], aiRes = results[1], sysRes = results[2];

            /* 更新 YOLOv8 模型信息 */
            if (modelRes.status === 'fulfilled') {
                var m = modelRes.value;
                Common.setTxt('modelPrecision', m.precision || 'N/A');
                Common.setTxt('modelDevice', m.device || 'N/A');
                Common.setTxt('modelGpu', m.gpu_available ? '\u53EF\u7528' : '\u4E0D\u53EF\u7528');
                /* 更新 YOLO 服务元数据（设备 + 精度） */
                var yoloMeta = document.getElementById('yoloServiceMeta');
                if (yoloMeta) yoloMeta.textContent = 'Python \u00B7 ' + (m.device || 'CPU') + ' \u00B7 ' + (m.precision || 'FP32');
                /* 更新 YOLO 服务状态标签（在线/离线） */
                var yoloStatus = document.getElementById('yoloServiceStatus');
                if (yoloStatus) {
                    var online = m.status === 'online';
                    yoloStatus.textContent = online ? '\u8FD0\u884C\u4E2D' : '\u7EBB\u7EBF';
                    yoloStatus.className = 'badge ' + (online ? 'badge-green' : 'badge-red') + ' badge-dot';
                }
            }

            /* 更新 Qwen2.5-VL 大模型服务状态 */
            if (aiRes.status === 'fulfilled') {
                var a = aiRes.value;
                var qwenMeta = document.getElementById('qwenServiceMeta');
                var qwenStatus = document.getElementById('qwenServiceStatus');
                var aOnline = a.status === 'online';
                if (qwenMeta) qwenMeta.textContent = aOnline ? '\u5DF2\u52A0\u8F7D \u00B7 \u53EF\u7528' : '\u672A\u542F\u52A8';
                if (qwenStatus) {
                    qwenStatus.textContent = aOnline ? '\u5728\u7EBF' : '\u7EBB\u7EBF';
                    qwenStatus.className = 'badge ' + (aOnline ? 'badge-green' : 'badge-gray') + ' badge-dot';
                }
            }

            /* 更新系统信息（存储占用） */
            if (sysRes.status === 'fulfilled') {
                var s = sysRes.value;
                if (s.status === 'success') Common.setTxt('logStorage', s.dataDirSizeMb + ' MB');
            }
        } catch (e) { console.warn('fetchModelInfo error:', e); }
    }

    /* ===== 轮询摘要接口 ===== */

    /**
     * 轮询统计摘要接口 — 每 2 秒执行一次
     * 用途：检测是否有新数据，避免频繁请求完整统计接口
     * 仅当检测总数变化时才触发完整数据刷新
     */
    async function fetchSummary() {
        try {
            var data = await Common.authFetch(API_BASE + '/api/stats/summary');
            var total = data.totalDetections || 0;
            if (total !== lastKnownTotal) {
                lastKnownTotal = total;
                /* 检测到新数据，触发完整数据刷新 */
                fetchData();
            }
        } catch (e) { /* 静默失败 — 轮询接口不需要错误提示 */ }
    }

    /* ===== 完整数据获取与更新 ===== */

    /**
     * 获取完整统计数据并更新页面所有组件
     * 更新内容包括：
     * 1. 统计卡片（跌倒、打架、疲劳、离岗、聚集）
     * 2. 饼图（行为类型分布）
     * 3. 折线图（检测趋势）
     * 4. 检测记录表格
     * 5. 告警事件表格
     * 6. 推理速度显示
     *
     * 同时处理新增告警的音效和视觉提醒
     */
    async function fetchData() {
        try {
            /* 请求后端统计接口 */
            var data = await Common.authFetch(API_BASE + '/api/stats');
            var bc = data.behaviorCounts || {};

            /* 更新本地状态缓存 */
            S.total = data.totalDetections || 0;
            S.images = data.totalImages || 0;
            S.fall = bc['\u8DCC\u5012'] || 0;
            S.fight = bc['\u6253\u67B6'] || 0;
            S.fatigue = bc['\u7592\u52B3'] || 0;
            S.leave = bc['\u79BB\u5C97'] || 0;
            S.gather = bc['\u4EBA\u5458\u805A\u96C6'] || 0;

            /* 检测新增告警 — 比较当前总数与上次记录的总数 */
            var newTotal = S.fall + S.fight + S.fatigue + S.leave + S.gather;
            if (previousDetectionCount > 0 && newTotal > previousDetectionCount) {
                var diff = newTotal - previousDetectionCount;
                if (diff > 0) {
                    AlertModule.playAlertSound();
                    if (S.fall > 0) AlertModule.flashStatCard('cardFall');
                    if (S.fight > 0) AlertModule.flashStatCard('cardFight');
                    if (S.fatigue > 0) AlertModule.flashStatCard('cardFatigue');
                    if (S.leave > 0) AlertModule.flashStatCard('cardLeave');
                    if (S.gather > 0) AlertModule.flashStatCard('cardGather');
                    var ad = data.allDetections || [];
                    var recent = ad.slice(0, diff);
                    var dangerous = recent.find(function(d) { return d.actions && (d.actions[0] === '\u8DCC\u5012' || d.actions[0] === '\u6253\u67B6'); });
                    if (dangerous) {
                        AlertModule.showTickerAlert('\u68C0\u6D4B\u5230\u5371\u9669\u884C\u4E3A\uFF1A' + dangerous.actions[0] + '\uFF01');
                    }
                }
            }
            previousDetectionCount = newTotal;

            /* ===== 更新统计卡片 ===== */

            /**
             * 更新单个统计卡片的数值和进度条
             * @param {string} id - 数值元素 ID
             * @param {number} val - 显示的数值
             * @param {string} barId - 进度条元素 ID
             * @param {number} pct - 进度百分比（0-100）
             */
            var setEl = function(id, val, barId, pct) {
                var el = document.getElementById(id);
                if (el) {
                    el.classList.remove('loading');
                    var old = el.textContent;
                    el.textContent = val;
                    if (old !== String(val) && val !== 0) {
                        el.classList.add('updated');
                        setTimeout(function() { el.classList.remove('updated'); }, 600);
                    }
                }
                var bar = document.getElementById(barId);
                if (bar) bar.style.width = Math.min(pct, 100) + '%';
                var pctEl = document.getElementById(barId.replace('Bar', 'Pct'));
                if (pctEl) pctEl.textContent = Math.round(pct) + '%';
            };
            var totalEl = document.getElementById('sTotal');
            if (totalEl) {
                totalEl.classList.remove('loading');
                var oldT = totalEl.textContent;
                var v = S.total.toLocaleString();
                totalEl.textContent = v;
                if (oldT !== v && S.total !== 0) {
                    totalEl.classList.add('updated');
                    setTimeout(function() { totalEl.classList.remove('updated'); }, 600);
                }
            }
            var totalBehaviors = S.fall + S.fight + S.fatigue + S.leave + S.gather;
            var totalBar = document.getElementById('sTotalBar');
            if (totalBar) totalBar.style.width = S.total > 0 ? Math.min(totalBehaviors / S.total * 100, 100) + '%' : '0%';
            var totalPctEl = document.getElementById('sTotalPct');
            if (totalPctEl) totalPctEl.textContent = S.total > 0 ? Math.round(totalBehaviors / S.total * 100) + '%' : '0%';
            var t = S.total || 1;
            setEl('sFall', S.fall, 'sFallBar', S.fall / t * 100);
            setEl('sFight', S.fight, 'sFightBar', S.fight / t * 100);
            setEl('sFatigue', S.fatigue, 'sFatigueBar', S.fatigue / t * 100);
            setEl('sLeave', S.leave, 'sLeaveBar', S.leave / t * 100);
            setEl('sGather', S.gather, 'sGatherBar', S.gather / t * 100);

            /* ===== 更新饼图（行为类型分布） ===== */
            var pieChart = ChartModule.pieChart;
            if (pieChart) {
                var pieData = [], pieLabels = [], pieColors = [];
                [
                    { l: '\u8DCC\u5012', v: S.fall, c: '#bf8700' },
                    { l: '\u6253\u67B6', v: S.fight, c: '#cf222e' },
                    { l: '\u79BB\u5C97', v: S.leave, c: '#0969da' },
                    { l: '\u7592\u52B3', v: S.fatigue, c: '#8250df' },
                    { l: '\u4EBA\u5458\u805A\u96C6', v: S.gather, c: '#1a7f37' }
                ].forEach(function(e) { if (e.v > 0) { pieLabels.push(e.l); pieData.push(e.v); pieColors.push(e.c); } });
                if (pieData.length === 0) { pieLabels.push('\u65E0\u6570\u636E'); pieData.push(1); pieColors.push('#e4e6eb'); }
                pieChart.data.labels = pieLabels;
                pieChart.data.datasets[0].data = pieData;
                pieChart.data.datasets[0].backgroundColor = pieColors;
                pieChart.update('none');
            }

            /* ===== 更新折线图（检测趋势） ===== */

            /**
             * 折线图数据构建逻辑：
             * 1. 根据用户选择的时间范围（分钟/小时/天）确定桶数量和步长
             * 2. 创建时间桶（buckets）并初始化为 0
             * 3. 遍历所有检测记录，按时间戳归入对应桶中
             * 4. 将桶数据填充到 Chart.js 图表
             */
            var allDets = data.allDetections || [];
            var lineChart = ChartModule.lineChart;
            if (lineChart) {
                var now = new Date(), labels = [], values = [];
                /* 获取当前选中的时间范围按钮 */
                var activeBtn = document.querySelector('[id^=chartBtn].active');
                var range = activeBtn && activeBtn.id === 'chartBtnHour' ? 'hour' : (activeBtn && activeBtn.id === 'chartBtnDay' ? 'day' : 'min');
                var count, step, timeKeyFmt;
                /* 根据时间范围配置桶参数 */
                if (range === 'hour') { count = 24; step = 3600000; timeKeyFmt = function(t) { return String(t.getHours()).padStart(2, '0') + ':00'; }; }
                else if (range === 'day') { count = 7; step = 86400000; timeKeyFmt = function(t) { return (t.getMonth() + 1) + '/' + t.getDate(); }; }
                else { count = 20; step = 60000; timeKeyFmt = function(t) { return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); }; }

                /* 初始化时间桶 */
                var buckets = {};
                for (var i = count - 1; i >= 0; i--) { var bt = new Date(now - i * step); var key = timeKeyFmt(bt); labels.push(key); buckets[key] = 0; }

                /* 将检测记录按时间戳归入对应桶中 */
                var rangeMs = count * step;
                allDets.forEach(function(d) {
                    if (!d.timestamp) return;
                    try {
                        var dt = new Date(d.timestamp.replace(/-/g, '/'));
                        if (now - dt >= 0 && now - dt < rangeMs) { var k = timeKeyFmt(dt); if (buckets[k] !== undefined) buckets[k]++; }
                    } catch (e) {}
                });

                /* 填充图表数据 */
                labels.forEach(function(k) { values.push(buckets[k] || 0); });
                lineChart.data.labels = labels;
                lineChart.data.datasets[0].data = values;
                lineChart.update('none');
            }

            /* 更新检测记录表格和告警事件表格 */
            DetectionModule.updateDetTable(data);
            AlertModule.updateAlertTable(data);
            /* 保存最新数据供其他模块使用 */
            window._latestStatsData = data;

            /* ===== 更新推理速度显示 ===== */
            /* 取最近 10 条有效 FPS 数据计算平均值 */
            var fpsVals = allDets.filter(function(d) { return d.fps > 0; }).slice(0, 10).map(function(d) { return d.fps; });
            if (fpsVals.length > 0) {
                var avgFps = fpsVals.reduce(function(a, b) { return a + b; }, 0) / fpsVals.length;
                var infMs = Math.round(1000 / avgFps);
                var infEl = document.getElementById('sInference');
                if (infEl) infEl.innerHTML = infMs + '<span style="font-size:12px;color:var(--text-muted)">ms</span>';
            }
        } catch (e) {
            console.warn('fetchData error:', e);
            DetectionModule.updateDetTable(null);
            Common.throttledErrorToast('\u6570\u636E\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u72B6\u6001');
        }
    }
    /* 暴露给其他模块调用（如告警模块触发数据刷新） */
    window.fetchData = fetchData;

    /* ===== 摄像头状态监控 ===== */

    /** 标记摄像头标签是否已构建（仅构建一次） */
    var camTabsBuilt = false;

    /**
     * 获取摄像头在线状态
     * 功能：
     * 1. 首次调用时动态构建摄像头标签栏
     * 2. 更新每个摄像头标签的在线/离线状态指示点
     * 3. 更新在线摄像头计数
     * 轮询间隔：10 秒
     */
    async function fetchCameraStatus() {
        try {
            var data = await Common.authFetch(API_BASE + '/api/cameras');
            var activeCams = Array.from(data.cameras || []);
            /* 首次获取到摄像头列表时，动态构建标签栏 */
            if (!camTabsBuilt && activeCams.length > 0) {
                buildCamTabs(activeCams);
                camTabsBuilt = true;
            }
            /* 更新每个摄像头标签的状态指示点 */
            document.querySelectorAll('.cam-tab').forEach(function(tab) {
                var camId = tab.dataset.cam;
                var dot = tab.querySelector('.cam-dot');
                if (dot) dot.classList.toggle('offline', activeCams.indexOf(camId) === -1);
            });
            /* 更新在线摄像头数量显示 */
            Common.setTxt('camOnlineCount', activeCams.length);
        } catch (e) {}
    }

    /* ===== 摄像头配置管理 ===== */

    /** 摄像头配置数据缓存 — 用于编辑时查找原始数据 */
    var _cameraConfigData = [];

    /**
     * 获取摄像头配置列表
     * 从后端 API 读取摄像头配置并渲染表格
     * 轮询间隔：30 秒
     */
    async function fetchCameraConfig() {
        try {
            var data = await Common.authFetch(API_BASE + '/api/camera_config');
            if (data.status === 'success') {
                _cameraConfigData = data.data || [];
                renderCameraTable(_cameraConfigData);
            }
        } catch (e) { console.warn('fetchCameraConfig error:', e); }
    }

    /**
     * 渲染摄像头配置表格
     * 使用 DOM API 构建表格行（CSP 合规，不使用 innerHTML + onclick）
     * 每行包含：ID、类型、地址、名称、操作按钮（编辑/删除）
     *
     * @param {Array} cameras - 摄像头配置数组
     */
    function renderCameraTable(cameras) {
        var tbody = document.getElementById('cameraConfigTableBody');
        /* 无配置时显示空状态提示 */
        if (!cameras.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="data-status">\u6682\u65E0\u6444\u50CF\u5934\u914D\u7F6E</td></tr>';
            return;
        }
        /* 摄像头类型映射 — 显示文本和徽章样式 */
        var typeMap = { usb: ['USB', 'badge-green'], rtsp: ['RTSP', 'badge-blue'], http_snapshot: ['HTTP', 'badge-purple'] };
        tbody.innerHTML = '';
        cameras.forEach(function(c) {
            var tmap = typeMap[c.type] || [c.type, 'badge'];
            var typeLabel = tmap[0], badgeClass = tmap[1];
            var addrStr = String(c.address);
            /* 地址过长时截断显示 */
            var addrDisplay = addrStr.length > 40 ? addrStr.substring(0, 37) + '...' : addrStr;

            var tr = document.createElement('tr');

            /* ID 列 */
            var tdId = document.createElement('td');
            var code = document.createElement('code');
            code.textContent = c.id;
            tdId.appendChild(code);
            tr.appendChild(tdId);

            /* 类型列 — 带颜色徽章 */
            var tdType = document.createElement('td');
            var badge = document.createElement('span');
            badge.className = 'badge ' + badgeClass;
            badge.textContent = typeLabel;
            tdType.appendChild(badge);
            tr.appendChild(tdType);

            /* 地址列 — 超长地址悬停显示完整内容 */
            var tdAddr = document.createElement('td');
            tdAddr.title = addrStr;
            tdAddr.style.cssText = 'max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            tdAddr.textContent = addrDisplay;
            tr.appendChild(tdAddr);

            /* 名称列 */
            var tdName = document.createElement('td');
            tdName.textContent = c.name || '';
            tr.appendChild(tdName);

            /* 操作列 — 编辑和删除按钮（使用 addEventListener，CSP 合规） */
            var tdOps = document.createElement('td');
            var btnGroup = document.createElement('div');
            btnGroup.className = 'btn-group';

            /* 编辑按钮 */
            var editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm';
            editBtn.textContent = '\u7F16\u8F91';
            editBtn.addEventListener('click', function() { showEditCameraModal(c.id); });
            btnGroup.appendChild(editBtn);

            /* 删除按钮 */
            var delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-danger';
            delBtn.textContent = '\u5220\u9664';
            delBtn.addEventListener('click', function() { confirmDeleteCamera(c.id); });
            btnGroup.appendChild(delBtn);

            tdOps.appendChild(btnGroup);
            tr.appendChild(tdOps);

            tbody.appendChild(tr);
        });
    }

    /**
     * 显示添加摄像头弹窗
     * 表单字段：摄像头类型（USB/RTSP/HTTP）、地址、名称
     * HTTP 类型额外显示用户名/密码字段
     */
    function showAddCameraModal() {
        var body = document.createElement('div');
        body.innerHTML =
            '<div class="form-group">' +
                '<label class="form-label">\u6444\u50CF\u5934\u7C7B\u578B</label>' +
                '<select class="form-select" id="camType">' +
                    '<option value="usb">USB \u6444\u50CF\u5934</option>' +
                    '<option value="rtsp">RTSP \u7F51\u7EDC\u6D41</option>' +
                    '<option value="http_snapshot">HTTP \u5FEB\u7167</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">\u5730\u5740</label>' +
                '<input class="form-input" id="camAddress" type="number" placeholder="\u8BBE\u5907\u7F16\u53F7\uFF0C\u5982 0">' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">\u540D\u79F0</label>' +
                '<input class="form-input" id="camName" placeholder="\u5982\uFF1A\u4E3B\u6444\u50CF\u5934">' +
            '</div>' +
            '<div id="camAuthFields" style="display:none">' +
                '<div class="form-row">' +
                    '<div class="form-group"><label class="form-label">\u7528\u6237\u540D</label><input class="form-input" id="camUser" placeholder="admin"></div>' +
                    '<div class="form-group"><label class="form-label">\u5BC6\u7801</label><input class="form-input" id="camPassword" type="password" placeholder="\u53EF\u7559\u7A7A"></div>' +
                '</div>' +
            '</div>';

        var footer = document.createElement('div');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.textContent = '\u53D6\u6D88';
        cancelBtn.addEventListener('click', Common.closeModal);
        footer.appendChild(cancelBtn);
        var addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary';
        addBtn.textContent = '\u6DFB\u52A0';
        addBtn.addEventListener('click', addCamera);
        footer.appendChild(addBtn);

        Common.openModal('\u6DFB\u52A0\u6444\u50CF\u5934', body, footer);

        // Wire up type change after modal is visible
        setTimeout(function() {
            var typeEl = document.getElementById('camType');
            if (typeEl) typeEl.addEventListener('change', onCameraTypeChange);
        }, 60);
    }
    window.showAddCameraModal = showAddCameraModal;

    /**
     * 显示编辑摄像头弹窗
     * 从缓存中读取摄像头数据，预填表单字段
     * @param {string} id - 要编辑的摄像头 ID
     */
    function showEditCameraModal(id) {
        var cam = _cameraConfigData.find(function(c) { return c.id === id; });
        if (!cam) return;
        var isUsb = cam.type === 'usb';
        var isHttp = cam.type === 'http_snapshot';

        var body = document.createElement('div');
        body.innerHTML =
            '<div class="form-group">' +
                '<label class="form-label">\u6444\u50CF\u5934\u7C7B\u578B</label>' +
                '<select class="form-select" id="camType">' +
                    '<option value="usb"' + (isUsb ? ' selected' : '') + '>USB \u6444\u50CF\u5934</option>' +
                    '<option value="rtsp"' + (cam.type === 'rtsp' ? ' selected' : '') + '>RTSP \u7F51\u7EDC\u6D41</option>' +
                    '<option value="http_snapshot"' + (isHttp ? ' selected' : '') + '>HTTP \u5FEB\u7167</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">\u5730\u5740</label>' +
                '<input class="form-input" id="camAddress" type="' + (isUsb ? 'number' : 'text') + '" value="' + Common.escAttr(String(cam.address)) + '" placeholder="' + (isUsb ? '\u8BBE\u5907\u7F16\u53F7' : 'URL\u5730\u5740') + '">' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">\u540D\u79F0</label>' +
                '<input class="form-input" id="camName" value="' + Common.escAttr(cam.name || '') + '">' +
            '</div>' +
            '<div id="camAuthFields" style="display:' + (isHttp ? '' : 'none') + '">' +
                '<div class="form-row">' +
                    '<div class="form-group"><label class="form-label">\u7528\u6237\u540D</label><input class="form-input" id="camUser" value="' + Common.escAttr(cam.user || '') + '" placeholder="admin"></div>' +
                    '<div class="form-group"><label class="form-label">\u5BC6\u7801</label><input class="form-input" id="camPassword" type="password" value="' + Common.escAttr(cam.password || '') + '" placeholder="\u53EF\u7559\u7A7A"></div>' +
                '</div>' +
            '</div>';

        var footer = document.createElement('div');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.textContent = '\u53D6\u6D88';
        cancelBtn.addEventListener('click', Common.closeModal);
        footer.appendChild(cancelBtn);
        var saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = '\u4FDD\u5B58';
        saveBtn.addEventListener('click', function() { saveCameraEdit(id); });
        footer.appendChild(saveBtn);

        Common.openModal('\u7F16\u8F91\u6444\u50CF\u5934', body, footer);

        setTimeout(function() {
            var typeEl = document.getElementById('camType');
            if (typeEl) typeEl.addEventListener('change', onCameraTypeChange);
        }, 60);
    }

    /**
     * 摄像头类型变更回调
     * 根据选择的类型（USB/RTSP/HTTP）动态调整：
     * 1. 地址输入框的类型（number/text）和占位符
     * 2. 认证字段（用户名/密码）的显示/隐藏
     */
    function onCameraTypeChange() {
        var type = document.getElementById('camType').value;
        var addrInput = document.getElementById('camAddress');
        var authFields = document.getElementById('camAuthFields');
        if (type === 'usb') {
            addrInput.placeholder = '\u8BBE\u5907\u7F16\u53F7\uFF0C\u5982 0';
            addrInput.type = 'number';
            authFields.style.display = 'none';
        } else if (type === 'rtsp') {
            addrInput.placeholder = 'rtsp://192.168.1.100:554/stream1';
            addrInput.type = 'text';
            authFields.style.display = 'none';
        } else {
            addrInput.placeholder = 'http://192.168.1.100/snapshot.jpg';
            addrInput.type = 'text';
            authFields.style.display = '';
        }
    }

    /**
     * 添加摄像头 — 提交表单数据到后端
     * 表单验证：地址和名称必填
     * HTTP 类型额外提交用户名和密码
     */
    async function addCamera() {
        var type = document.getElementById('camType').value;
        var addrVal = document.getElementById('camAddress').value;
        var address = type === 'usb' ? parseInt(addrVal) : addrVal;
        var name = document.getElementById('camName').value;
        if (!addrVal || !name) { Common.toast('\u8BF7\u586B\u5199\u5730\u5740\u548C\u540D\u79F0', 'error'); return; }
        var body = { type: type, address: address, name: name };
        if (type === 'http_snapshot') {
            body.user = (document.getElementById('camUser') || {}).value || '';
            body.password = (document.getElementById('camPassword') || {}).value || '';
        }
        try {
            var result = await Common.authFetch(API_BASE + '/api/camera_config', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            Common.toast('\u6444\u50CF\u5934\u5DF2\u6DFB\u52A0', 'success');
            Common.closeModal();
            fetchCameraConfig();
        } catch (e) { Common.toast('\u6DFB\u52A0\u5931\u8D25', 'error'); }
    }

    /**
     * 保存摄像头编辑 — 提交修改后的数据到后端
     * @param {string} id - 要更新的摄像头 ID
     */
    async function saveCameraEdit(id) {
        var type = document.getElementById('camType').value;
        var addrVal = document.getElementById('camAddress').value;
        var address = type === 'usb' ? parseInt(addrVal) : addrVal;
        var name = document.getElementById('camName').value;
        if (!addrVal || !name) { Common.toast('\u8BF7\u586B\u5199\u5730\u5740\u548C\u540D\u79F0', 'error'); return; }
        var body = { type: type, address: address, name: name };
        if (type === 'http_snapshot') {
            body.user = (document.getElementById('camUser') || {}).value || '';
            body.password = (document.getElementById('camPassword') || {}).value || '';
        }
        try {
            await Common.authFetch(API_BASE + '/api/camera_config/' + id, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            Common.toast('\u6444\u50CF\u5934\u5DF2\u66F4\u65B0', 'success');
            Common.closeModal();
            fetchCameraConfig();
        } catch (e) { Common.toast('\u66F4\u65B0\u5931\u8D25', 'error'); }
    }

    /**
     * 显示删除摄像头确认弹窗
     * 使用 DOM API 构建确认对话框（CSP 合规）
     * @param {string} id - 要删除的摄像头 ID
     */
    function confirmDeleteCamera(id) {
        var body = document.createElement('div');
        body.style.cssText = 'text-align:center;padding:8px 0';
        var icon = document.createElement('div');
        icon.style.cssText = 'font-size:32px;margin-bottom:10px';
        icon.textContent = '\u26A0';
        body.appendChild(icon);
        var title = document.createElement('div');
        title.style.cssText = 'font-size:13px;font-weight:600';
        title.textContent = '\u786E\u5B9A\u8981\u5220\u9664\u6B64\u6444\u50CF\u5934\u914D\u7F6E\u5417\uFF1F';
        body.appendChild(title);
        var desc = document.createElement('div');
        desc.style.cssText = 'font-size:11px;color:var(--text-muted)';
        desc.textContent = '\u5220\u9664\u540E\u9700\u91CD\u542FPython\u811A\u672C\u751F\u6548';
        body.appendChild(desc);

        var footer = document.createElement('div');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.textContent = '\u53D6\u6D88';
        cancelBtn.addEventListener('click', Common.closeModal);
        footer.appendChild(cancelBtn);
        var delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger';
        delBtn.textContent = '\u786E\u8BA4\u5220\u9664';
        delBtn.addEventListener('click', function() { deleteCamera(id); });
        footer.appendChild(delBtn);

        Common.openModal('\u786E\u8BA4\u5220\u9664', body, footer);
    }

    /**
     * 执行删除摄像头操作
     * 调用后端 API 删除配置，成功后刷新表格
     * @param {string} id - 要删除的摄像头 ID
     */
    async function deleteCamera(id) {
        try {
            await Common.authFetch(API_BASE + '/api/camera_config/' + id, { method: 'DELETE' });
            Common.toast('\u6444\u50CF\u5934\u5DF2\u5220\u9664', 'success');
            Common.closeModal();
            fetchCameraConfig();
        } catch (e) { Common.toast('\u5220\u9664\u5931\u8D25', 'error'); }
    }

    /* ===== FPS 计数器与视频流状态监控 ===== */

    /**
     * FPS 计算原理：
     * MJPEG 视频流每帧都会触发 img.onload 事件
     * 通过统计 1 秒内的 load 事件次数来计算 FPS
     */
    var videoFeed = document.getElementById('videoFeed');
    var frameCount = 0, lastFpsTime = Date.now(), videoErrorTimeout = null;

    /**
     * 视频帧加载成功回调
     * 1. 隐藏错误提示
     * 2. 累加帧计数器
     * 3. 每秒更新 FPS 显示
     */
    videoFeed.addEventListener('load', function() {
        document.getElementById('videoError').classList.remove('show');
        clearTimeout(videoErrorTimeout);
        frameCount++;
        var now = Date.now();
        if (now - lastFpsTime >= 1000) {
            var el = document.getElementById('fpsDisplay');
            if (el) el.textContent = 'FPS: ' + frameCount;
            frameCount = 0;
            lastFpsTime = now;
        }
    });

    /**
     * 视频流加载失败回调
     * 延迟 3 秒后显示错误提示（避免瞬间断连时闪烁）
     */
    videoFeed.addEventListener('error', function() {
        videoErrorTimeout = setTimeout(function() {
            document.getElementById('videoError').classList.add('show');
        }, 3000);
    });

    /**
     * 重新连接视频流
     * 通过添加时间戳参数强制浏览器重新请求（避免缓存）
     */
    function retryVideoFeed() {
        document.getElementById('videoError').classList.remove('show');
        videoFeed.src = API_BASE + '/video_feed?cam=' + currentCam + '&t=' + Date.now();
    }
    window.retryVideoFeed = retryVideoFeed;

    /* ===== 侧边栏平滑滚动 ===== */

    /**
     * 为侧边栏锚点链接绑定平滑滚动
     * 点击时：
     * 1. 阻止默认跳转行为
     * 2. 平滑滚动到目标区域
     * 3. 更新侧边栏 active 状态
     */
    document.querySelectorAll('.sidebar-item[href^="#"]').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            /* 更新侧边栏选中状态 */
            document.querySelectorAll('.sidebar-item').forEach(function(i) { i.classList.remove('active'); });
            this.classList.add('active');
        });
    });

    /* ===== 图表时间范围切换按钮 ===== */

    /**
     * 绑定折线图时间范围切换按钮（分钟/小时/天）
     * 点击后更新图表数据范围
     */
    document.getElementById('chartBtnMin').addEventListener('click', function() { ChartModule.setChartRange('min', this); });
    document.getElementById('chartBtnHour').addEventListener('click', function() { ChartModule.setChartRange('hour', this); });
    document.getElementById('chartBtnDay').addEventListener('click', function() { ChartModule.setChartRange('day', this); });

    /* ===== 静态 HTML 元素事件绑定 ===== */

    /**
     * 以下事件绑定替代了 HTML 中原有的 onclick 属性
     * 确保 CSP（Content Security Policy）合规
     * 所有事件均使用 addEventListener 方式绑定
     */

    /* 图片查看器 — 点击遮罩层关闭 */
    document.getElementById('imageViewer').addEventListener('click', function(e) {
        if (e.target === document.getElementById('imageViewer') || e.target.id === 'imageViewer') {
            DetectionModule.closeImageViewer();
        }
    });
    /* 图片查看器 — 关闭按钮 */
    document.querySelector('.image-viewer-close').addEventListener('click', DetectionModule.closeImageViewer);

    /* 顶部栏按钮 */
    /* 主题切换按钮 */
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    /* 刷新数据按钮 — 通过 title 属性识别 */
    document.querySelectorAll('.topbar-btn').forEach(function(btn) {
        if (btn.title === '\u5237\u65B0\u6570\u636E') {
            btn.addEventListener('click', function() { fetchData(); Common.toast('\u6570\u636E\u5DF2\u5237\u65B0', 'success'); });
        }
    });

    /* 侧边栏后台管理链接 — 通过 ID 绑定（替代原 onclick 属性） */
    var sidebarAdmin = document.getElementById('sidebarAdmin');
    if (sidebarAdmin) sidebarAdmin.addEventListener('click', function() { location.href = API_BASE + '/admin'; });

    /* 侧边栏用户头像 — 点击显示用户信息弹窗 */
    var sidebarUser = document.getElementById('sidebarUser');
    if (sidebarUser) sidebarUser.addEventListener('click', showUserInfo);

    /* 顶部栏后台管理按钮 */
    var topbarAdmin = document.getElementById('topbarAdmin');
    if (topbarAdmin) topbarAdmin.addEventListener('click', function() { location.href = API_BASE + '/admin'; });

    /**
     * 摄像头标签切换 — 使用事件委托
     * 在容器上监听点击事件，通过 closest 查找 .cam-tab 元素
     * 优势：动态添加的标签也能自动获得点击事件
     */
    var camTabsContainer = document.getElementById('camTabs');
    if (camTabsContainer) {
        camTabsContainer.addEventListener('click', function(e) {
            var tab = e.target.closest('.cam-tab');
            if (tab) switchCam(tab);
        });
    }

    /* 添加摄像头按钮 */
    var addCameraBtn = document.getElementById('addCameraBtn');
    if (addCameraBtn) addCameraBtn.addEventListener('click', showAddCameraModal);

    /* 告警滚动条关闭按钮 */
    document.querySelector('.alert-ticker-close').addEventListener('click', AlertModule.dismissTicker);

    /**
     * 检测记录操作按钮 — 通过按钮文本识别功能
     * 筛选、导出、清空三个按钮
     */
    document.querySelectorAll('#records .btn-group .btn').forEach(function(btn) {
        if (btn.textContent.indexOf('\u7B5B\u9009') !== -1) btn.addEventListener('click', DetectionModule.showFilterModal);
        if (btn.textContent.indexOf('\u5BFC\u51FA') !== -1) btn.addEventListener('click', DetectionModule.exportDetections);
        if (btn.textContent.indexOf('\u6E05\u7A7A') !== -1) btn.addEventListener('click', DetectionModule.showClearConfirm);
    });

    /**
     * 视频操作按钮 — 通过按钮文本识别功能
     * 截图、全屏、测试告警、告警声音开关
     */
    document.querySelectorAll('.video-actions .v-btn').forEach(function(btn) {
        if (btn.textContent.indexOf('\u622A\u56FE') !== -1) btn.addEventListener('click', captureScreenshot);
        if (btn.textContent.indexOf('\u5168\u5C4F') !== -1) btn.addEventListener('click', fullscreen);
        if (btn.textContent.indexOf('\u6D4B\u8BD5\u544A\u8B66') !== -1) btn.addEventListener('click', AlertModule.testAlert);
        if (btn.id === 'soundBtn') btn.addEventListener('click', AlertModule.toggleAlertSound);
    });

    /* 视频流重试按钮 */
    document.querySelector('.video-error .v-btn').addEventListener('click', retryVideoFeed);

    /* 模态框关闭按钮 */
    document.querySelector('.modal-close').addEventListener('click', Common.closeModal);

    /**
     * Escape 键快捷键
     * 按下 Escape 时关闭模态框和图片查看器
     */
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            Common.closeModal();
            DetectionModule.closeImageViewer();
        }
    });

    /* ===== 页面初始化 ===== */

    /**
     * 初始化流程：
     * 1. 显示表格加载状态
     * 2. 初始化告警声音按钮
     * 3. 首次获取各项数据
     * 4. 启动定时轮询
     */
    DetectionModule.showTableLoading();
    AlertModule.initSoundButton();

    /* 首次数据加载 */
    fetchData();
    fetchModelInfo();
    fetchCameraStatus();
    fetchCameraConfig();

    /* 定时轮询 — 保持数据实时更新 */
    setInterval(fetchSummary, 2000);        /* 摘要轮询：2 秒（检测新数据触发完整刷新） */
    setInterval(fetchModelInfo, 30000);     /* 模型信息：30 秒 */
    setInterval(fetchCameraStatus, 10000);  /* 摄像头状态：10 秒 */
    setInterval(fetchCameraConfig, 30000);  /* 摄像头配置：30 秒 */
})();
