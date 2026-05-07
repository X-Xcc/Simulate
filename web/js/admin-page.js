/* ============================================================
   后台管理页面脚本 — 使用 common.js 提供的 Common.* 工具方法
   通过 IIFE 封装避免全局命名空间污染，仅暴露必要的回调函数
   ============================================================ */
(function() {
    'use strict';

    var Common = window.Common;
    var API_BASE = Common.API_BASE;

    /* ==================== 主题初始化 ==================== */
    Common.initTheme();
    document.getElementById('themeToggle').addEventListener('click', function() {
        Common.themeToggle();
        initCharts();
    });

    /* ==================== 时钟启动 ==================== */
    Common.startClock('clock');

    /* ==================== 标签页导航 ==================== */
    /* 标签页名称映射，用于更新面包屑导航文字 */
    var TAB_NAMES = {dashboard:'仪表盘',settings:'系统设置',users:'用户管理',data:'数据管理',devices:'设备管理'};

    /**
     * 切换标签页
     * @param {HTMLElement} el - 被点击的侧边栏项
     * @param {string} tab - 标签页标识符
     */
    function switchTab(el, tab) {
        /* 移除所有侧边栏项的 active 状态 */
        document.querySelectorAll('.sidebar-item').forEach(function(i) { i.classList.remove('active'); });
        if (el) el.classList.add('active');
        /* 隐藏所有页面，仅显示目标页面 */
        document.querySelectorAll('.page').forEach(function(p) { p.style.display = 'none'; });
        var target = document.getElementById('tab-' + tab);
        if (target) target.style.display = 'block';
        /* 更新面包屑导航文字 */
        Common.setTxt('breadcrumbCurrent', TAB_NAMES[tab] || tab);
        /* 切换到特定标签页时加载对应数据 */
        if (tab === 'dashboard') loadDashboardData();
        if (tab === 'data') loadDataStats();
        if (tab === 'users') renderUsers();
        if (tab === 'devices') loadDevices();
    }
    /* 暴露给 HTML 中的 onclick 属性使用 */
    window.switchTab = switchTab;

    /* ============================================================
       仪表盘模块 — Chart.js 图表 + 实时数据加载
       ============================================================ */
    var trendChart = null, doughnutChart = null;

    /**
     * 初始化仪表盘图表（趋势折线图 + 行为类型环形图）
     * 主题切换时需重新初始化以适配暗色/亮色配色
     */
    function initCharts() {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
        var tickColor = isDark ? '#64748b' : '#9ca3af';
        var accentColor = isDark ? '#3b82f6' : '#2563eb';

        var trendCtx = document.getElementById('trendChart');
        if (!trendCtx) return;
        if (trendChart) trendChart.destroy();

        /* 创建渐变填充色 */
        var gradient = trendCtx.getContext('2d').createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, isDark ? 'rgba(59,130,246,.2)' : 'rgba(37,99,235,.15)');
        gradient.addColorStop(1, 'transparent');

        /* 趋势折线图 — 按小时显示检测量分布 */
        trendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: ['00','02','04','06','08','10','12','14','16','18','20','22'],
                datasets: [{
                    label: '检测量',
                    data: [12, 8, 5, 15, 45, 78, 95, 110, 88, 72, 55, 30],
                    borderColor: accentColor,
                    backgroundColor: gradient,
                    fill: true, tension: 0.4, borderWidth: 2,
                    pointRadius: 0, pointHoverRadius: 5,
                    pointHoverBackgroundColor: accentColor,
                    pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
                    y: { grid: { color: gridColor }, ticks: { font: { size: 10 }, color: tickColor } }
                },
                interaction: { intersect: false, mode: 'index' },
            }
        });

        /* 行为类型环形图 — 显示各类型检测占比 */
        var doughnutCtx = document.getElementById('doughnutChart');
        if (doughnutChart) doughnutChart.destroy();

        doughnutChart = new Chart(doughnutCtx, {
            type: 'doughnut',
            data: {
                labels: ['跌倒', '打架', '疲劳', '离岗', '聚集'],
                datasets: [{
                    data: [23, 8, 12, 15, 5],
                    backgroundColor: [
                        isDark ? '#ef4444' : '#dc2626',
                        isDark ? '#f59e0b' : '#ea580c',
                        isDark ? '#a78bfa' : '#7c3aed',
                        isDark ? '#3b82f6' : '#2563eb',
                        isDark ? '#64748b' : '#9ca3af'
                    ],
                    borderWidth: 0, spacing: 2,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10, usePointStyle: true, pointStyleWidth: 8,
                            font: { size: 11 },
                            color: isDark ? '#94a3b8' : '#6b7280'
                        }
                    }
                }
            }
        });
    }

    /**
     * 切换趋势图时间范围
     * @param {string} range - 'day'|'week'|'month'
     * @param {HTMLElement} btn - 被点击的按钮
     */
    function setTrendRange(range, btn) {
        var parent = btn.parentElement;
        parent.querySelectorAll('.btn').forEach(function(b) { b.classList.remove('btn-primary'); });
        btn.classList.add('btn-primary');
        loadTrendData(range);
    }
    window.setTrendRange = setTrendRange;

    async function loadTrendData(range) {
        try {
            var resp = await Common.authFetch(API_BASE + '/api/stats/trend?range=' + (range || 'day'));
            if (resp && resp.data && trendChart) {
                trendChart.data.labels = resp.labels;
                trendChart.data.datasets[0].data = resp.data;
                trendChart.update();
            }
        } catch (e) { console.warn('加载趋势数据失败:', e); }
    }

    /**
     * 加载仪表盘数据 — 并行请求统计数据、摄像头列表、模型信息、AI 状态
     */
    async function loadDashboardData() {
        try {
            var results = await Promise.allSettled([
                Common.authFetch(API_BASE + '/api/stats'),
                Common.authFetch(API_BASE + '/api/cameras'),
                Common.authFetch(API_BASE + '/api/model_info'),
                Common.authFetch(API_BASE + '/api/ai/status')
            ]);

            var statsRes = results[0], camerasRes = results[1], modelRes = results[2], aiRes = results[3];

            /* 更新统计数据卡片 */
            if (statsRes.status === 'fulfilled') {
                var data = statsRes.value;
                var total = data.totalDetections || 0;
                var images = data.totalImages || 0;
                Common.setTxt('sTotal', total.toLocaleString());
                Common.setTxt('sTotalSub', '共 ' + images + ' 张截图');

                var bc = data.behaviorCounts || {};
                var alertCount = (bc.fall||0) + (bc.fight||0) + (bc.absent||0);
                Common.setTxt('sAlerts', alertCount);
                Common.setTxt('sAlertsSub', '跌倒 '+(bc.fall||0)+' / 打架 '+(bc.fight||0)+' / 离岗 '+(bc.absent||0));

                /* 更新环形图数据 */
                if (doughnutChart) {
                    doughnutChart.data.datasets[0].data = [bc.fall||0, bc.fight||0, bc.fatigue||0, bc.absent||0, bc.gather||0];
                    doughnutChart.update();
                }

                /* 渲染最近检测记录表格 */
                var recent = (data.recentDetections || []).slice(0, 6);
                var tbody = document.getElementById('dashTableBody');
                if (recent.length > 0) {
                    var behaviorMap = {fall:'跌倒',fight:'打架',fatigue:'疲劳',absent:'离岗',gather:'聚集',eye_fatigue:'眼疲劳'};
                    var badgeMap = {fall:'badge-orange',fight:'badge-red',fatigue:'badge-purple',absent:'badge-blue',gather:'badge-gray',eye_fatigue:'badge-orange'};
                    tbody.innerHTML = recent.map(function(d) {
                        var bt = d.behaviorType || d.type || 'unknown';
                        var label = behaviorMap[bt] || bt;
                        var badge = badgeMap[bt] || 'badge-gray';
                        var conf = d.confidence ? (d.confidence * 100).toFixed(1) + '%' : '--';
                        var time = d.timestamp ? new Date(d.timestamp).toLocaleTimeString('zh-CN',{hour12:false}) : '--';
                        return '<tr><td style="font-family:var(--font-mono);font-size:11px">'+Common.escHtml(time)+'</td><td><span class="badge '+badge+'">'+Common.escHtml(label)+'</span></td><td style="font-family:var(--font-mono)">'+Common.escHtml(conf)+'</td><td><span class="badge badge-gray">已记录</span></td></tr>';
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">暂无检测记录</td></tr>';
                }

                /* 渲染活动流 */
                var activityList = document.getElementById('activityList');
                if (recent.length > 0) {
                    var dotMap = {fall:'alert',fight:'alert',fatigue:'warning',absent:'alert',gather:'info',eye_fatigue:'warning'};
                    activityList.innerHTML = recent.slice(0, 5).map(function(d) {
                        var bMap = {fall:'跌倒检测',fight:'打架检测',fatigue:'疲劳检测',absent:'离岗检测',gather:'人员聚集',eye_fatigue:'眼疲劳'};
                        var bKey = d.behaviorType || d.type || d.behavior || 'unknown';
                        var label = bMap[bKey] || bKey || '未知';
                        var dot = dotMap[bKey] || 'info';
                        var conf = d.confidence ? '置信度 ' + (d.confidence*100).toFixed(1) + '%' : '';
                        var time = d.timestamp ? new Date(d.timestamp).toLocaleTimeString('zh-CN',{hour12:false}) : '--';
                        var desc = d.camera ? d.camera + ' 检测到' + label : '检测到' + label;
                        return '<div class="activity-item"><div class="activity-dot '+dot+'"></div><div class="activity-content"><div class="activity-title">'+Common.escHtml(label)+'告警</div><div class="activity-desc">'+Common.escHtml(desc)+'</div><div class="activity-time">'+Common.escHtml(time)+(conf?' \u00B7 '+Common.escHtml(conf):'')+'</div></div></div>';
                    }).join('');
                }
            }

            /* 更新摄像头设备卡片 */
            if (camerasRes.status === 'fulfilled') {
                var camerasRaw = camerasRes.value;
                var camList = Array.isArray(camerasRaw) ? camerasRaw : (camerasRaw && camerasRaw.cameras ? (Array.isArray(camerasRaw.cameras) ? camerasRaw.cameras : Array.from(camerasRaw.cameras)) : []);
                var grid = document.getElementById('deviceGrid');
                if (camList.length > 0) {
                    Common.setTxt('sDevices', camList.length + '/' + camList.length);
                    Common.setTxt('sOnlineRate', '100%');
                    grid.innerHTML = camList.map(function(cam) {
                        var name = cam.name || cam.id || 'Camera';
                        var type = cam.type || 'USB';
                        var addr = cam.source !== undefined ? cam.source : '';
                        return '<div class="device-card"><div class="device-card-top"><span class="device-card-name">'+Common.escHtml(name)+'</span><span class="device-card-status"></span></div><div class="device-card-meta">'+Common.escHtml(type)+' \u00B7 '+Common.escHtml(addr)+'</div></div>';
                    }).join('');
                } else {
                    grid.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:12px">暂无设备配置</div>';
                    Common.setTxt('sDevices', '0/0');
                    Common.setTxt('sOnlineRate', '--');
                }
            }

            /* 更新模型信息 */
            if (modelRes.status === 'fulfilled') {
                var m = modelRes.value;
                Common.setTxt('sModel', m.model || 'yolov8n-pose');
                Common.setTxt('sModelDevice', m.device || 'N/A');
                Common.setTxt('sModelSub', m.precision || 'FP32');
            }

            /* 更新 AI 服务状态 */
            if (aiRes.status === 'fulfilled') {
                var a = aiRes.value;
                var status = a.status === 'online' ? 'Qwen VL 在线' : 'Qwen VL 离线';
                var sub = document.getElementById('sModelSub');
                if (sub) sub.textContent += ' / ' + status;
            }

        } catch(e) {
            console.error('Dashboard load error:', e);
        }
    }
    window.loadDashboardData = loadDashboardData;

    /* ============================================================
       系统设置模块 — 检测参数配置（本地存储）
       ============================================================ */

    /** 保存检测参数到 localStorage */
    function saveSettings() {
        var settings = {
            confidence: document.getElementById('setConfidence').value,
            iou: document.getElementById('setIou').value,
            interval: document.getElementById('setInterval').value,
            maxPeople: document.getElementById('setMaxPeople').value,
            fallSensitivity: document.getElementById('setFallSensitivity').value,
            fightSensitivity: document.getElementById('setFightSensitivity').value,
            alertCooldown: document.getElementById('setAlertCooldown').value,
            fatigueThreshold: document.getElementById('setFatigueThreshold').value
        };
        localStorage.setItem('detection_settings', JSON.stringify(settings));
        Common.toast('设置已保存', 'success');
    }
    window.saveSettings = saveSettings;

    /** 从 localStorage 加载检测参数 */
    function loadSettings() {
        var saved = localStorage.getItem('detection_settings');
        if (saved) {
            try {
                var s = JSON.parse(saved);
                if (s.confidence) document.getElementById('setConfidence').value = s.confidence;
                if (s.iou) document.getElementById('setIou').value = s.iou;
                if (s.interval) document.getElementById('setInterval').value = s.interval;
                if (s.maxPeople) document.getElementById('setMaxPeople').value = s.maxPeople;
                if (s.fallSensitivity) document.getElementById('setFallSensitivity').value = s.fallSensitivity;
                if (s.fightSensitivity) document.getElementById('setFightSensitivity').value = s.fightSensitivity;
                if (s.alertCooldown) document.getElementById('setAlertCooldown').value = s.alertCooldown;
                if (s.fatigueThreshold) document.getElementById('setFatigueThreshold').value = s.fatigueThreshold;
            } catch(e) {}
        }
    }

    /* ============================================================
       用户管理模块 — CRUD 操作（本地存储）
       ============================================================ */

    /* 默认用户列表 */
    var DEFAULT_USERS = [
        { username:'xx', name:'陈明', role:'超级管理员', status:'在线', lastLogin:'2026-05-04 10:30:00' },
        { username:'operator1', name:'张伟', role:'操作员', status:'离线', lastLogin:'2026-05-03 18:00:00' },
        { username:'guard1', name:'李强', role:'值班员', status:'离线', lastLogin:'2026-05-03 08:00:00' }
    ];

    /** 获取用户列表（优先从 localStorage 读取） */
    function getUsers() {
        var saved = localStorage.getItem('system_users');
        if (saved) { try { return JSON.parse(saved); } catch(e) {} }
        return DEFAULT_USERS;
    }

    /** 保存用户列表到 localStorage */
    function saveUsers(users) {
        localStorage.setItem('system_users', JSON.stringify(users));
    }

    /** 渲染用户表格 */
    function renderUsers() {
        var users = getUsers();
        var tbody = document.getElementById('userTableBody');
        if (!tbody) return;
        Common.setTxt('userCount', users.length + ' 个用户');
        tbody.innerHTML = '';
        users.forEach(function(u, i) {
            var tr = document.createElement('tr');

            var tdUser = document.createElement('td');
            tdUser.style.fontWeight = '600';
            tdUser.textContent = u.username;
            tr.appendChild(tdUser);

            var tdName = document.createElement('td');
            tdName.textContent = u.name;
            tr.appendChild(tdName);

            var tdRole = document.createElement('td');
            var roleBadge = document.createElement('span');
            roleBadge.className = 'badge ' + (u.role==='超级管理员'?'badge-blue':'badge-green');
            roleBadge.textContent = u.role;
            tdRole.appendChild(roleBadge);
            tr.appendChild(tdRole);

            var tdStatus = document.createElement('td');
            var statusBadge = document.createElement('span');
            statusBadge.className = 'badge ' + (u.status==='在线'?'badge-green':'badge-gray') + ' badge-dot';
            statusBadge.textContent = u.status;
            tdStatus.appendChild(statusBadge);
            tr.appendChild(tdStatus);

            var tdLogin = document.createElement('td');
            tdLogin.style.cssText = 'font-size:10px;font-family:monospace';
            tdLogin.textContent = u.lastLogin;
            tr.appendChild(tdLogin);

            var tdOps = document.createElement('td');
            var editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm';
            editBtn.textContent = '编辑';
            editBtn.addEventListener('click', function() { editUser(i); });
            tdOps.appendChild(editBtn);
            if (u.username !== 'xx') {
                var delBtn = document.createElement('button');
                delBtn.className = 'btn btn-sm btn-danger';
                delBtn.textContent = '删除';
                delBtn.addEventListener('click', function() { deleteUser(i); });
                tdOps.appendChild(delBtn);
            }
            tr.appendChild(tdOps);

            tbody.appendChild(tr);
        });
    }

    /** 显示添加用户弹窗 */
    function showAddUserModal() {
        var body = document.createElement('div');
        body.innerHTML = '<div class="form-group"><label class="form-label">用户名</label><input type="text" class="form-input" id="newUsername" placeholder="登录用户名"></div>' +
            '<div class="form-group"><label class="form-label">姓名</label><input type="text" class="form-input" id="newName" placeholder="真实姓名"></div>' +
            '<div class="form-group"><label class="form-label">密码</label><input type="password" class="form-input" id="newPassword" placeholder="登录密码"></div>' +
            '<div class="form-group"><label class="form-label">角色</label><select class="form-select" id="newRole"><option value="操作员">操作员</option><option value="值班员">值班员</option><option value="管理员">管理员</option></select></div>';
        var footer = document.createElement('div');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', Common.closeModal);
        var addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary';
        addBtn.textContent = '添加';
        addBtn.addEventListener('click', addUser);
        footer.appendChild(cancelBtn);
        footer.appendChild(addBtn);
        Common.openModal('添加用户', body, footer);
    }
    window.showAddUserModal = showAddUserModal;

    /** 添加用户 */
    function addUser() {
        var username = document.getElementById('newUsername').value.trim();
        var name = document.getElementById('newName').value.trim();
        var password = document.getElementById('newPassword').value;
        var role = document.getElementById('newRole').value;
        if (!username || !name) { Common.toast('请填写用户名和姓名', 'error'); return; }
        var users = getUsers();
        if (users.find(function(u) { return u.username === username; })) { Common.toast('用户名已存在', 'error'); return; }
        users.push({ username:username, name:name, role:role, status:'离线', lastLogin:'--', password:password });
        saveUsers(users);
        renderUsers();
        Common.closeModal();
        Common.toast('用户 ' + name + ' 已添加', 'success');
    }
    window.addUser = addUser;

    /** 编辑用户 */
    function editUser(index) {
        var users = getUsers();
        var u = users[index];
        var body = document.createElement('div');
        body.innerHTML = '<div class="form-group"><label class="form-label">用户名</label><input type="text" class="form-input" value="'+Common.escAttr(u.username)+'" disabled style="opacity:.6"></div>' +
            '<div class="form-group"><label class="form-label">姓名</label><input type="text" class="form-input" id="editName" value="'+Common.escAttr(u.name)+'"></div>' +
            '<div class="form-group"><label class="form-label">角色</label><select class="form-select" id="editRole">' +
                '<option value="超级管理员" '+(u.role==='超级管理员'?'selected':'')+'>超级管理员</option>' +
                '<option value="管理员" '+(u.role==='管理员'?'selected':'')+'>管理员</option>' +
                '<option value="操作员" '+(u.role==='操作员'?'selected':'')+'>操作员</option>' +
                '<option value="值班员" '+(u.role==='值班员'?'selected':'')+'>值班员</option>' +
            '</select></div>' +
            '<div class="form-group"><label class="form-label">新密码 (留空不修改)</label><input type="password" class="form-input" id="editPassword" placeholder="留空则不修改"></div>';
        var footer = document.createElement('div');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', Common.closeModal);
        var saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = '保存';
        saveBtn.addEventListener('click', function() { saveUser(index); });
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        Common.openModal('编辑用户', body, footer);
    }
    window.editUser = editUser;

    /** 保存用户编辑 */
    function saveUser(index) {
        var users = getUsers();
        users[index].name = document.getElementById('editName').value.trim();
        users[index].role = document.getElementById('editRole').value;
        var pw = document.getElementById('editPassword').value;
        if (pw) users[index].password = pw;
        saveUsers(users);
        renderUsers();
        Common.closeModal();
        Common.toast('用户信息已更新', 'success');
    }
    window.saveUser = saveUser;

    /** 删除用户（确认弹窗） */
    function deleteUser(index) {
        var users = getUsers();
        var u = users[index];
        var body = document.createElement('div');
        body.innerHTML = '<div style="text-align:center;padding:8px 0"><div style="font-size:28px;margin-bottom:8px">\u26A0</div><div style="font-size:13px;font-weight:600">确定删除用户 "'+Common.escHtml(u.name)+'" 吗？</div></div>';
        var footer = document.createElement('div');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', Common.closeModal);
        var delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger';
        delBtn.textContent = '确认删除';
        delBtn.addEventListener('click', function() { confirmDeleteUser(index); });
        footer.appendChild(cancelBtn);
        footer.appendChild(delBtn);
        Common.openModal('确认删除', body, footer);
    }
    window.deleteUser = deleteUser;

    /** 确认删除用户 */
    function confirmDeleteUser(index) {
        var users = getUsers();
        users.splice(index, 1);
        saveUsers(users);
        renderUsers();
        Common.closeModal();
        Common.toast('用户已删除', 'success');
    }
    window.confirmDeleteUser = confirmDeleteUser;

    /* ============================================================
       数据管理模块 — 统计、导出、清空
       ============================================================ */

    /** 加载数据统计信息 */
    async function loadDataStats() {
        try {
            var data = await Common.authFetch(API_BASE + '/api/stats');
            Common.setTxt('dataTotalDetections', (data.totalDetections || 0) + ' 条');
            Common.setTxt('dataTotalImages', (data.totalImages || 0) + ' 张');
        } catch(e) {}
        try {
            var s = await Common.authFetch(API_BASE + '/api/system_info');
            if (s.status === 'success') Common.setTxt('dataStorageSize', s.dataDirSizeMb + ' MB');
        } catch(e) {}
    }

    /** 导出全部数据 — 支持 JSON/CSV 格式选择 */
    function exportAllData() {
        var body = document.createElement('div');
        body.innerHTML = '<p style="margin-bottom:12px">选择导出格式：</p>';
        var footer = document.createElement('div');
        var jsonBtn = document.createElement('button');
        jsonBtn.className = 'btn btn-primary';
        jsonBtn.textContent = 'JSON';
        jsonBtn.addEventListener('click', function() { Common.closeModal(); doExportJson(); });
        var csvBtn = document.createElement('button');
        csvBtn.className = 'btn';
        csvBtn.textContent = 'CSV';
        csvBtn.addEventListener('click', function() { Common.closeModal(); doExportCsv(); });
        footer.appendChild(jsonBtn);
        footer.appendChild(csvBtn);
        Common.openModal('导出数据', body, footer);
    }
    function doExportJson() {
        Common.toast('正在导出 JSON...', 'info');
        Common.authFetch(API_BASE + '/api/stats').then(function(data) {
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'detections_export_' + new Date().toISOString().slice(0,10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            Common.toast('导出完成', 'success');
        }).catch(function() { Common.toast('导出失败', 'error'); });
    }
    function doExportCsv() {
        Common.toast('正在导出 CSV...', 'info');
        var token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        var url = API_BASE + '/api/export/csv';
        if (token) url += '?token=' + encodeURIComponent(token);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'detections_export_' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
        setTimeout(function() { Common.toast('导出完成', 'success'); }, 1000);
    }
    window.exportAllData = exportAllData;

    /** 打开数据目录 */
    function openDataFolder() {
        Common.authFetch(API_BASE + '/api/open_folder', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({folder: 'data'})
        }).then(function() {
            Common.toast('已打开数据目录', 'success');
        }).catch(function() {
            Common.toast('打开失败（可能在服务器环境）', 'error');
        });
    }
    window.openDataFolder = openDataFolder;

    /** 清空数据确认弹窗 */
    function confirmClearData() {
        var body = document.createElement('div');
        body.innerHTML = '<div style="text-align:center;padding:8px 0"><div style="font-size:28px;margin-bottom:8px">\u26A0</div><div style="font-size:13px;font-weight:600;margin-bottom:6px">确定要清空所有检测数据吗？</div><div style="font-size:11px;color:var(--text-muted)">此操作不可恢复</div></div>';
        var footer = document.createElement('div');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', Common.closeModal);
        var clearBtn = document.createElement('button');
        clearBtn.className = 'btn btn-danger';
        clearBtn.textContent = '确认清空';
        clearBtn.addEventListener('click', clearAllData);
        footer.appendChild(cancelBtn);
        footer.appendChild(clearBtn);
        Common.openModal('确认清空', body, footer);
    }
    window.confirmClearData = confirmClearData;

    /** 执行清空所有检测数据 */
    async function clearAllData() {
        try {
            await Common.authFetch(API_BASE + '/api/delete_all_images', {method:'DELETE'});
            Common.toast('数据已清空', 'success');
            Common.closeModal();
            loadDataStats();
        } catch(e) {
            Common.toast('清空失败', 'error');
        }
    }
    window.clearAllData = clearAllData;

    /* ============================================================
       设备管理模块 — 摄像头设备 CRUD
       ============================================================ */

    /** 加载设备列表 */
    async function loadDevices() {
        try {
            var cameras = await Common.authFetch(API_BASE + '/api/devices');
            var tbody = document.getElementById('deviceTableBody');
            if (Array.isArray(cameras) && cameras.length > 0) {
                tbody.innerHTML = '';
                cameras.forEach(function(cam, i) {
                    var name = cam.name || cam.id || 'Camera';
                    var type = cam.type || 'USB';
                    var addr = cam.source !== undefined ? cam.source : '';
                    var area = cam.area || '--';

                    var tr = document.createElement('tr');

                    var tdId = document.createElement('td');
                    tdId.textContent = 'CAM-' + String(i+1).padStart(3,'0');
                    tr.appendChild(tdId);

                    var tdName = document.createElement('td');
                    tdName.textContent = name;
                    tr.appendChild(tdName);

                    var tdType = document.createElement('td');
                    tdType.textContent = type;
                    tr.appendChild(tdType);

                    var tdAddr = document.createElement('td');
                    tdAddr.style.cssText = 'font-family:var(--font-mono);font-size:11px';
                    tdAddr.textContent = addr;
                    tr.appendChild(tdAddr);

                    var tdArea = document.createElement('td');
                    tdArea.textContent = area;
                    tr.appendChild(tdArea);

                    var tdStatus = document.createElement('td');
                    var badge = document.createElement('span');
                    badge.className = 'badge badge-green badge-dot';
                    badge.textContent = '在线';
                    tdStatus.appendChild(badge);
                    tr.appendChild(tdStatus);

                    var tdOps = document.createElement('td');
                    var editBtn = document.createElement('button');
                    editBtn.className = 'btn btn-sm';
                    editBtn.textContent = '编辑';
                    editBtn.addEventListener('click', function() { editDevice(i); });
                    tdOps.appendChild(editBtn);
                    tr.appendChild(tdOps);

                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">暂无设备配置</td></tr>';
            }
        } catch(e) {
            document.getElementById('deviceTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">暂无设备配置</td></tr>';
        }
    }

    /** 显示添加设备弹窗 */
    function showAddDeviceModal() {
        var body = document.createElement('div');
        body.innerHTML = '<div class="form-group"><label class="form-label">设备名称</label><input type="text" class="form-input" id="devName" placeholder="如: 走廊摄像头"></div>' +
            '<div class="form-group"><label class="form-label">设备类型</label><select class="form-select" id="devType"><option value="USB">USB摄像头</option><option value="RTSP">RTSP网络摄像头</option><option value="FILE">视频文件</option></select></div>' +
            '<div class="form-group"><label class="form-label">设备地址</label><input type="text" class="form-input" id="devAddress" placeholder="设备索引(0) 或 RTSP地址"></div>' +
            '<div class="form-group"><label class="form-label">监控区域</label><input type="text" class="form-input" id="devArea" placeholder="如: A区走廊"></div>';
        var footer = document.createElement('div');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', Common.closeModal);
        var addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary';
        addBtn.textContent = '添加';
        addBtn.addEventListener('click', function() {
            var devName = document.getElementById('devName').value.trim();
            var devType = document.getElementById('devType').value;
            var devAddress = document.getElementById('devAddress').value.trim();
            var devArea = document.getElementById('devArea').value.trim();
            if (!devName) { Common.toast('请填写设备名称', 'error'); return; }
            Common.authFetch(API_BASE + '/api/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: devName, type: devType, address: devAddress, area: devArea })
            }).then(function() {
                Common.toast('设备已添加', 'success');
                Common.closeModal();
                loadDevices();
            }).catch(function() { Common.toast('添加失败', 'error'); });
        });
        footer.appendChild(cancelBtn);
        footer.appendChild(addBtn);
        Common.openModal('添加设备', body, footer);
    }
    window.showAddDeviceModal = showAddDeviceModal;

    /** 编辑设备（占位） */
    function editDevice(index) {
        Common.toast('设备编辑功能 - 修改后需重启Python服务', 'info');
    }
    window.editDevice = editDevice;

    /* ============================================================
       模型状态查询（设置标签页）
       ============================================================ */

    /** 获取模型和 AI 服务状态 */
    async function fetchModelStatus() {
        try {
            var m = await Common.authFetch(API_BASE + '/api/model_info');
            Common.setTxt('modelDeviceSetting', m.device || 'N/A');
            Common.setTxt('modelPrecisionSetting', m.precision || 'N/A');
        } catch(e) {}
        try {
            var a = await Common.authFetch(API_BASE + '/api/ai/status');
            Common.setTxt('qwenStatus', a.status === 'online' ? '已连接' : '未启动');
        } catch(e) {}
    }

    /* ============================================================
       事件绑定 — 替代 HTML 中的 onclick 属性（CSP 合规）
       ============================================================ */

    /* 侧边栏标签页切换（事件委托） */
    document.querySelectorAll('.sidebar-item[data-tab]').forEach(function(item) {
        item.addEventListener('click', function() { switchTab(this, this.dataset.tab); });
    });

    /* 侧边栏标注页面跳转 */
    document.querySelectorAll('.sidebar-item[data-action="annotate"]').forEach(function(item) {
        item.addEventListener('click', function() { location.href = '/yolov8-security/annotate'; });
    });

    /* 顶部搜索栏 */
    var topbarSearch = document.getElementById('topbarSearch');
    if (topbarSearch) topbarSearch.addEventListener('click', function() { Common.toast('搜索功能开发中', 'info'); });

    /* 顶部监控大屏按钮 */
    var topbarMonitor = document.getElementById('topbarMonitor');
    if (topbarMonitor) topbarMonitor.addEventListener('click', function() { location.href = '/yolov8-security/'; });

    /* 趋势图时间范围按钮 */
    document.querySelectorAll('[data-range]').forEach(function(btn) {
        btn.addEventListener('click', function() { setTrendRange(this.dataset.range, this); });
    });

    /* 仪表盘刷新按钮 */
    document.querySelectorAll('[data-action="refreshDashboard"]').forEach(function(btn) {
        btn.addEventListener('click', loadDashboardData);
    });

    /* 查看全部按钮 */
    document.querySelectorAll('[data-action="viewAll"]').forEach(function(btn) {
        btn.addEventListener('click', function() { location.href = '/yolov8-security/'; });
    });

    /* 管理设备按钮 */
    document.querySelectorAll('[data-action="manageDevices"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var devicesItem = document.querySelector('.sidebar-item[data-tab="devices"]');
            switchTab(devicesItem, 'devices');
        });
    });

    /* 保存设置按钮 */
    var saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);

    /* 添加用户按钮 */
    var addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) addUserBtn.addEventListener('click', showAddUserModal);

    /* 数据管理按钮 */
    document.querySelectorAll('[data-action="exportAll"]').forEach(function(btn) {
        btn.addEventListener('click', exportAllData);
    });
    document.querySelectorAll('[data-action="openFolder"]').forEach(function(btn) {
        btn.addEventListener('click', openDataFolder);
    });
    document.querySelectorAll('[data-action="clearData"]').forEach(function(btn) {
        btn.addEventListener('click', confirmClearData);
    });

    /* 添加设备按钮 */
    var addDeviceBtn = document.getElementById('addDeviceBtn');
    if (addDeviceBtn) addDeviceBtn.addEventListener('click', showAddDeviceModal);

    /* 弹窗关闭按钮 */
    var modalCloseBtn = document.querySelector('.modal-close');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', Common.closeModal);

    /* 退出登录按钮 */
    document.querySelectorAll('[data-action="logout"]').forEach(function(item) {
        item.addEventListener('click', function() {
            sessionStorage.removeItem('auth_token');
            localStorage.removeItem('auth_token');
            window.location.href = API_BASE + '/login';
        });
    });

    /* ============================================================
       页面初始化 — 加载所有模块数据
       ============================================================ */
    initCharts();
    loadSettings();
    renderUsers();
    loadDataStats();
    fetchModelStatus();
    loadDashboardData();

    /* 全局快捷键：ESC 关闭弹窗 */
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') Common.closeModal(); });
    /* 点击弹窗遮罩关闭弹窗 */
    document.getElementById('modalOverlay').addEventListener('click', function(e) { if (e.target === document.getElementById('modalOverlay')) Common.closeModal(); });
})();
