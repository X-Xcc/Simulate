/* ============================================================
   annotate.js - Data Annotation Workbench
   Fabric.js canvas with BBox + 17 COCO keypoints
   ============================================================ */
(function() {
    'use strict';

    var API = Common.API_BASE + '/api/annotations';
    var DETECTION_API = Common.API_BASE + '/api';

    var BEHAVIOR_LABELS = ['fall', 'fight', 'fatigue', 'eye_fatigue', 'absent', 'crowd'];
    var LABEL_NAMES = { fall: '跌倒', fight: '打架', fatigue: '疲劳', eye_fatigue: '眼疲劳', absent: '离岗', crowd: '聚集' };
    var COCO_KP_NAMES = [
        'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
        'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ];
    var COCO_SKELETON = [
        [0,1],[0,2],[1,3],[2,4],[5,7],[7,9],[6,8],[8,10],
        [5,6],[5,11],[6,12],[11,12],[11,13],[12,14],[13,15],[14,16]
    ];

    // State
    var images = [];
    var currentImage = null;
    var annotationData = null;
    var currentTool = 'select';
    var canvas, ctx;
    var bboxes = []; // {id, fabricRect, labels, source, confidence}
    var keypointGroups = []; // {id, personId, fabricCircles, fabricLines, points}
    var undoStack = [];
    var isDirty = false;
    var drawingState = null; // for bbox drawing
    var kpDrawState = null; // for keypoint drawing

    // DOM
    var dom = {
        imageList: document.getElementById('imageList'),
        imageCount: document.getElementById('imageCount'),
        currentFilename: document.getElementById('currentFilename'),
        annotProgress: document.getElementById('annotProgress'),
        canvasWrap: document.getElementById('canvasWrap'),
        fabricCanvas: document.getElementById('fabricCanvas'),
        canvasEmpty: document.getElementById('canvasEmpty'),
        labelPopup: document.getElementById('labelPopup'),
        labelGrid: document.getElementById('labelGrid'),
        propEmpty: document.getElementById('propEmpty'),
        propBbox: document.getElementById('propBbox'),
        propType: document.getElementById('propType'),
        propSource: document.getElementById('propSource'),
        propX: document.getElementById('propX'),
        propY: document.getElementById('propY'),
        propW: document.getElementById('propW'),
        propH: document.getElementById('propH'),
        propBehaviorTags: document.getElementById('propBehaviorTags'),
        statusSize: document.getElementById('statusSize'),
        statusZoom: document.getElementById('statusZoom'),
        statusAnnotations: document.getElementById('statusAnnotations'),
        helpDialog: document.getElementById('helpDialog'),
        fileInput: document.getElementById('fileInput')
    };

    // ============================================================
    // INIT
    // ============================================================
    function init() {
        initCanvas();
        bindEvents();
        loadImageList();
    }

    function initCanvas() {
        var wrap = dom.canvasWrap;
        canvas = new fabric.Canvas('fabricCanvas', {
            width: wrap.clientWidth - 2,
            height: wrap.clientHeight - 2,
            backgroundColor: '#070b12',
            selection: true,
            preserveObjectStacking: true
        });

        canvas.on('selection:created', onSelectionCreated);
        canvas.on('selection:updated', onSelectionCreated);
        canvas.on('selection:cleared', onSelectionCleared);
        canvas.on('object:modified', onObjectModified);

        // Resize handler
        window.addEventListener('resize', debounce(function() {
            canvas.setWidth(wrap.clientWidth - 2);
            canvas.setHeight(wrap.clientHeight - 2);
            canvas.renderAll();
        }, 200));
    }

    // ============================================================
    // EVENTS
    // ============================================================
    function bindEvents() {
        // Tool buttons
        document.querySelectorAll('[data-tool]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                setTool(this.dataset.tool);
            });
        });

        // Action buttons
        document.getElementById('btnSave').addEventListener('click', saveAnnotation);
        document.getElementById('btnExport').addEventListener('click', showExportDialog);
        document.getElementById('btnUndo').addEventListener('click', undo);
        document.getElementById('btnDeleteSelected').addEventListener('click', deleteSelected);
        document.getElementById('btnZoomIn').addEventListener('click', function() { zoom(1.2); });
        document.getElementById('btnZoomOut').addEventListener('click', function() { zoom(0.8); });
        document.getElementById('btnFitCanvas').addEventListener('click', fitCanvas);
        document.getElementById('btnHelp').addEventListener('click', function() { dom.helpDialog.classList.add('show'); });
        document.getElementById('closeHelp').addEventListener('click', function() { dom.helpDialog.classList.remove('show'); });
        document.getElementById('btnDeleteBbox').addEventListener('click', deleteSelected);

        // Upload
        document.getElementById('uploadBtn').addEventListener('click', function() { dom.fileInput.click(); });
        dom.fileInput.addEventListener('change', handleFileUpload);

        // Drag and drop upload
        var uploadArea = document.querySelector('.upload-area');
        uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); this.querySelector('.upload-btn').classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', function(e) { this.querySelector('.upload-btn').classList.remove('drag-over'); });
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            this.querySelector('.upload-btn').classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
        });

        // Label popup
        dom.labelGrid.addEventListener('click', function(e) {
            var chip = e.target.closest('.label-chip');
            if (!chip) return;
            chip.classList.toggle('selected');
        });

        // Behavior tags in properties
        dom.propBehaviorTags.addEventListener('click', function(e) {
            var tag = e.target.closest('.behavior-tag');
            if (!tag) return;
            tag.classList.toggle('active');
            updateSelectedBboxLabels();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'v' || e.key === 'V') { setTool('select'); e.preventDefault(); }
            else if (e.key === 'b' || e.key === 'B') { setTool('bbox'); e.preventDefault(); }
            else if (e.key === 'k' || e.key === 'K') { setTool('keypoint'); e.preventDefault(); }
            else if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); e.preventDefault(); }
            else if (e.key === '?' || (e.key === '/' && e.shiftKey)) { dom.helpDialog.classList.toggle('show'); e.preventDefault(); }
            else if (e.key === 'f' || e.key === 'F') { fitCanvas(); e.preventDefault(); }
            else if (e.key === '+' || e.key === '=') { zoom(1.2); e.preventDefault(); }
            else if (e.key === '-') { zoom(0.8); e.preventDefault(); }
            else if (e.key === 's' && (e.ctrlKey || e.metaKey)) { saveAnnotation(); e.preventDefault(); }
            else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); }
        });

        // Canvas mouse events for drawing
        canvas.on('mouse:down', onCanvasMouseDown);
        canvas.on('mouse:move', onCanvasMouseMove);
        canvas.on('mouse:up', onCanvasMouseUp);
    }

    // ============================================================
    // IMAGE LIST
    // ============================================================
    function loadImageList() {
        Common.authFetch(API + '/images').then(function(data) {
            images = data.data || [];
            renderImageList();
        }).catch(function() {
            images = [];
            renderImageList();
        });
    }

    function renderImageList() {
        dom.imageCount.textContent = images.length;
        if (images.length === 0) {
            dom.imageList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px">暂无图片，请上传</div>';
            return;
        }

        dom.imageList.innerHTML = images.map(function(img) {
            return '<div class="image-item" data-filename="' + Common.escAttr(img.filename) + '">' +
                '<div class="image-thumb"><img src="' + Common.escAttr(img.path) + '" loading="lazy"></div>' +
                '<div class="image-info">' +
                '<div class="image-name">' + Common.escHtml(img.filename) + '</div>' +
                '<div class="image-status unlabeled"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> 未标注</div>' +
                '</div></div>';
        }).join('');

        // Update annotation status for each image
        images.forEach(function(img) {
            Common.authFetch(API + '/' + encodeURIComponent(img.filename)).then(function(data) {
                var ann = data.data;
                if (ann) {
                    var item = dom.imageList.querySelector('[data-filename="' + CSS.escape(img.filename) + '"]');
                    if (item) {
                        var statusEl = item.querySelector('.image-status');
                        statusEl.className = 'image-status ' + ann.status;
                        var statusText = ann.status === 'reviewed' ? '已标注' : ann.status === 'ai_pending' ? 'AI待审' : '未标注';
                        statusEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            (ann.status === 'reviewed' ? '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>' :
                            ann.status === 'ai_pending' ? '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' :
                            '<circle cx="12" cy="12" r="10"/>') + '</svg> ' + statusText;
                    }
                }
            }).catch(function() {});
        });

        // Click handlers
        dom.imageList.querySelectorAll('.image-item').forEach(function(item) {
            item.addEventListener('click', function() {
                selectImage(this.dataset.filename);
            });
        });
    }

    function selectImage(filename) {
        if (isDirty && currentImage) {
            if (!confirm('当前标注未保存，是否放弃更改？')) return;
        }

        currentImage = filename;
        dom.currentFilename.textContent = filename;

        // Update active state
        dom.imageList.querySelectorAll('.image-item').forEach(function(item) {
            item.classList.toggle('active', item.dataset.filename === filename);
        });

        // Load image
        var img = images.find(function(i) { return i.filename === filename; });
        if (!img) return;

        fabric.Image.fromURL(img.path, function(fImg) {
            canvas.clear();
            bboxes = [];
            keypointGroups = [];
            undoStack = [];
            isDirty = false;

            var wrapW = dom.canvasWrap.clientWidth - 2;
            var wrapH = dom.canvasWrap.clientHeight - 2;
            var scale = Math.min(wrapW / fImg.width, wrapH / fImg.height, 1);

            canvas.setWidth(wrapW);
            canvas.setHeight(wrapH);
            fImg.scale(scale);
            fImg.set({ selectable: false, evented: false });
            canvas.setBackgroundImage(fImg, canvas.renderAll.bind(canvas));

            dom.canvasEmpty.style.display = 'none';
            dom.statusSize.textContent = fImg.width + 'x' + fImg.height;

            // Load annotation
            loadAnnotation(filename);
        }, { crossOrigin: 'anonymous' });
    }

    // ============================================================
    // ANNOTATION LOAD/SAVE
    // ============================================================
    function loadAnnotation(filename) {
        Common.authFetch(API + '/' + encodeURIComponent(filename)).then(function(data) {
            annotationData = data.data;
            renderAnnotationData();
        }).catch(function() {
            annotationData = { imageFilename: filename, imageWidth: 0, imageHeight: 0, status: 'unlabeled', bboxes: [], keypoints: [] };
            renderAnnotationData();
        });
    }

    function renderAnnotationData() {
        canvas.getObjects().slice().forEach(function(obj) {
            if (obj !== canvas.backgroundImage) canvas.remove(obj);
        });
        bboxes = [];
        keypointGroups = [];

        if (!annotationData) return;

        var bgImg = canvas.backgroundImage;
        if (!bgImg) return;

        var imgW = bgImg.width * bgImg.scaleX;
        var imgH = bgImg.height * bgImg.scaleY;

        // Update image dimensions in annotation data
        if (annotationData.imageWidth === 0) {
            annotationData.imageWidth = bgImg.width;
            annotationData.imageHeight = bgImg.height;
        }

        // Render bboxes
        if (annotationData.bboxes) {
            annotationData.bboxes.forEach(function(bbox) {
                addBboxToCanvas(bbox);
            });
        }

        // Render keypoints
        if (annotationData.keypoints) {
            annotationData.keypoints.forEach(function(kpGroup) {
                addKeypointGroupToCanvas(kpGroup);
            });
        }

        updateAnnotationCount();
        canvas.renderAll();
    }

    function addBboxToCanvas(bbox) {
        var bgImg = canvas.backgroundImage;
        if (!bgImg) return;

        var imgW = bgImg.width * bgImg.scaleX;
        var imgH = bgImg.height * bgImg.scaleY;

        var left = bbox.x * imgW;
        var top = bbox.y * imgH;
        var width = bbox.width * imgW;
        var height = bbox.height * imgH;

        var isAi = bbox.source === 'ai';
        var color = isAi ? '#a855f7' : '#3b82f6';

        var rect = new fabric.Rect({
            left: left,
            top: top,
            width: width,
            height: height,
            fill: 'transparent',
            stroke: color,
            strokeWidth: isAi ? 1 : 2,
            strokeDashArray: isAi ? [5, 5] : null,
            selectable: true,
            evented: true,
            cornerSize: 8,
            cornerColor: color,
            cornerStyle: 'circle',
            transparentCorners: false,
            borderColor: color
        });

        rect.bboxId = bbox.id;
        rect.labels = bbox.labels || [];
        rect.source = bbox.source || 'human';
        rect.confidence = bbox.confidence || 0;

        // Label text
        var labelText = (bbox.labels || []).map(function(l) { return LABEL_NAMES[l] || l; }).join(', ');
        if (isAi) labelText = '[AI] ' + labelText;

        var text = new fabric.Text(labelText, {
            left: left,
            top: top - 16,
            fontSize: 11,
            fontFamily: 'Inter, sans-serif',
            fill: '#fff',
            backgroundColor: color,
            padding: 3,
            selectable: false,
            evented: false
        });

        canvas.add(rect);
        canvas.add(text);
        bboxes.push({ id: bbox.id, fabricRect: rect, fabricText: text, labels: bbox.labels || [], source: bbox.source || 'human', confidence: bbox.confidence || 0 });
    }

    function addKeypointGroupToCanvas(kpGroup) {
        var bgImg = canvas.backgroundImage;
        if (!bgImg) return;

        var imgW = bgImg.width * bgImg.scaleX;
        var imgH = bgImg.height * bgImg.scaleY;

        var circles = [];
        var lines = [];
        var points = kpGroup.points || [];

        // Draw skeleton lines first
        COCO_SKELETON.forEach(function(bone) {
            var p1 = points.find(function(p) { return p.name === COCO_KP_NAMES[bone[0]]; });
            var p2 = points.find(function(p) { return p.name === COCO_KP_NAMES[bone[1]]; });
            if (p1 && p2 && p1.visible > 0 && p2.visible > 0) {
                var line = new fabric.Line([
                    p1.x * imgW, p1.y * imgH,
                    p2.x * imgW, p2.y * imgH
                ], {
                    stroke: '#22c55e',
                    strokeWidth: 1.5,
                    selectable: false,
                    evented: false,
                    opacity: 0.7
                });
                canvas.add(line);
                lines.push(line);
            }
        });

        // Draw keypoint circles
        points.forEach(function(kp) {
            if (kp.visible === 0) return;
            var circle = new fabric.Circle({
                left: kp.x * imgW - 4,
                top: kp.y * imgH - 4,
                radius: 4,
                fill: kp.visible === 2 ? '#22c55e' : '#eab308',
                stroke: '#fff',
                strokeWidth: 1,
                selectable: true,
                evented: true,
                cornerSize: 6
            });
            circle.kpName = kp.name;
            circle.kpGroupId = kpGroup.id;
            circle.visible = kp.visible;
            canvas.add(circle);
            circles.push(circle);
        });

        keypointGroups.push({ id: kpGroup.id, personId: kpGroup.personId, fabricCircles: circles, fabricLines: lines, points: points });
    }

    function saveAnnotation() {
        if (!currentImage) { Common.toast('请先选择图片', 'warning'); return; }

        var bgImg = canvas.backgroundImage;
        if (!bgImg) return;

        var imgW = bgImg.width;
        var imgH = bgImg.height;
        var scaleX = bgImg.scaleX;
        var scaleY = bgImg.scaleY;

        // Collect bboxes from canvas
        var bboxData = [];
        bboxes.forEach(function(b) {
            var rect = b.fabricRect;
            bboxData.push({
                id: b.id,
                x: rect.left / (imgW * scaleX),
                y: rect.top / (imgH * scaleY),
                width: rect.width * rect.scaleX / (imgW * scaleX),
                height: rect.height * rect.scaleY / (imgH * scaleY),
                labels: b.labels,
                confidence: b.confidence,
                source: b.source
            });
        });

        // Collect keypoints from canvas
        var kpData = [];
        keypointGroups.forEach(function(kg) {
            var points = [];
            kg.fabricCircles.forEach(function(c) {
                points.push({
                    name: c.kpName,
                    x: (c.left + c.radius) / (imgW * scaleX),
                    y: (c.top + c.radius) / (imgH * scaleY),
                    visible: c.visible
                });
            });
            kpData.push({ id: kg.id, personId: kg.personId, points: points });
        });

        var data = {
            imageFilename: currentImage,
            imageWidth: imgW,
            imageHeight: imgH,
            annotator: 'user',
            status: bboxData.length > 0 ? 'reviewed' : 'unlabeled',
            bboxes: bboxData,
            keypoints: kpData
        };

        Common.authFetch(API + '/' + encodeURIComponent(currentImage), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(function() {
            Common.toast('标注已保存', 'success');
            isDirty = false;
            loadImageList(); // refresh status
        }).catch(function() {});
    }

    // ============================================================
    // TOOLS
    // ============================================================
    function setTool(tool) {
        currentTool = tool;
        document.querySelectorAll('[data-tool]').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        canvas.selection = (tool === 'select');
        canvas.forEachObject(function(obj) {
            if (obj === canvas.backgroundImage) return;
            obj.selectable = (tool === 'select');
            obj.evented = (tool === 'select');
        });

        if (tool === 'bbox' || tool === 'keypoint') {
            canvas.defaultCursor = 'crosshair';
            canvas.hoverCursor = 'crosshair';
        } else {
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'move';
        }

        hideLabelPopup();
        canvas.renderAll();
    }

    // ============================================================
    // CANVAS MOUSE EVENTS
    // ============================================================
    function onCanvasMouseDown(opt) {
        if (!currentImage || !canvas.backgroundImage) return;
        var pointer = canvas.getPointer(opt.e);

        if (currentTool === 'bbox') {
            drawingState = { startX: pointer.x, startY: pointer.y, rect: null };
            var rect = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(59,130,246,0.1)',
                stroke: '#3b82f6',
                strokeWidth: 2,
                selectable: false,
                evented: false
            });
            canvas.add(rect);
            drawingState.rect = rect;
        } else if (currentTool === 'keypoint') {
            // Start or continue keypoint group
            if (!kpDrawState) {
                kpDrawState = { points: [], circles: [], lines: [], currentIndex: 0 };
            }
            addKeypointAtPosition(pointer.x, pointer.y);
        }
    }

    function onCanvasMouseMove(opt) {
        if (!drawingState) return;
        var pointer = canvas.getPointer(opt.e);
        var rect = drawingState.rect;
        if (!rect) return;

        var left = Math.min(drawingState.startX, pointer.x);
        var top = Math.min(drawingState.startY, pointer.y);
        var width = Math.abs(pointer.x - drawingState.startX);
        var height = Math.abs(pointer.y - drawingState.startY);

        rect.set({ left: left, top: top, width: width, height: height });
        canvas.renderAll();
    }

    function onCanvasMouseUp(opt) {
        if (!drawingState) return;
        var rect = drawingState.rect;
        drawingState = null;

        if (!rect || rect.width < 5 || rect.height < 5) {
            if (rect) canvas.remove(rect);
            return;
        }

        // Show label popup
        showLabelPopup(rect);
    }

    function addKeypointAtPosition(x, y) {
        if (kpDrawState.currentIndex >= COCO_KP_NAMES.length) return;

        var kpName = COCO_KP_NAMES[kpDrawState.currentIndex];
        var circle = new fabric.Circle({
            left: x - 4,
            top: y - 4,
            radius: 4,
            fill: '#22c55e',
            stroke: '#fff',
            strokeWidth: 1,
            selectable: true,
            evented: true
        });
        circle.kpName = kpName;
        circle.visible = 2;

        // Draw line to previous point
        if (kpDrawState.circles.length > 0) {
            var prev = kpDrawState.circles[kpDrawState.circles.length - 1];
            var line = new fabric.Line([prev.left + prev.radius, prev.top + prev.radius, x, y], {
                stroke: '#22c55e',
                strokeWidth: 1.5,
                selectable: false,
                evented: false,
                opacity: 0.7
            });
            canvas.add(line);
            kpDrawState.lines.push(line);
        }

        canvas.add(circle);
        kpDrawState.circles.push(circle);
        kpDrawState.points.push({ name: kpName, x: x, y: y, visible: 2 });
        kpDrawState.currentIndex++;

        // Check if done
        if (kpDrawState.currentIndex >= COCO_KP_NAMES.length) {
            finishKeypointGroup();
        }

        canvas.renderAll();
    }

    function finishKeypointGroup() {
        if (!kpDrawState) return;

        var groupId = 'kp_' + Date.now();
        var personId = null;

        // If we have bboxes, link to the last one
        if (bboxes.length > 0) {
            personId = bboxes[bboxes.length - 1].id;
        }

        kpDrawState.circles.forEach(function(c) {
            c.kpGroupId = groupId;
        });

        keypointGroups.push({
            id: groupId,
            personId: personId,
            fabricCircles: kpDrawState.circles,
            fabricLines: kpDrawState.lines,
            points: kpDrawState.points
        });

        kpDrawState = null;
        isDirty = true;
        updateAnnotationCount();
        Common.toast('关键点组已添加', 'success');
    }

    // ============================================================
    // LABEL POPUP
    // ============================================================
    function showLabelPopup(rect) {
        dom.labelPopup.style.display = 'block';
        dom.labelPopup.querySelectorAll('.label-chip').forEach(function(c) { c.classList.remove('selected'); });

        // Temporarily store rect
        dom.labelPopup._pendingRect = rect;

        // Handle selection
        var onConfirm = function() {
            var selected = [];
            dom.labelPopup.querySelectorAll('.label-chip.selected').forEach(function(c) {
                selected.push(c.dataset.label);
            });
            if (selected.length === 0) {
                Common.toast('请选择至少一个标签', 'warning');
                return;
            }

            hideLabelPopup();
            finalizeBbox(rect, selected);
        };

        // Remove old listeners
        var confirmBtn = dom.labelPopup.querySelector('.label-confirm');
        if (confirmBtn) confirmBtn.remove();

        confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn primary label-confirm';
        confirmBtn.textContent = '确认';
        confirmBtn.style.cssText = 'width:100%;margin-top:8px';
        confirmBtn.addEventListener('click', onConfirm);
        dom.labelPopup.appendChild(confirmBtn);
    }

    function hideLabelPopup() {
        dom.labelPopup.style.display = 'none';
        dom.labelPopup._pendingRect = null;
        var confirmBtn = dom.labelPopup.querySelector('.label-confirm');
        if (confirmBtn) confirmBtn.remove();
    }

    function finalizeBbox(rect, labels) {
        var id = 'bbox_' + Date.now();
        rect.bboxId = id;
        rect.labels = labels;
        rect.source = 'human';
        rect.confidence = 1.0;
        rect.set({ selectable: true, evented: true, cornerSize: 8, cornerColor: '#3b82f6', cornerStyle: 'circle', transparentCorners: false, borderColor: '#3b82f6' });

        // Add label text
        var labelText = labels.map(function(l) { return LABEL_NAMES[l] || l; }).join(', ');
        var text = new fabric.Text(labelText, {
            left: rect.left,
            top: rect.top - 16,
            fontSize: 11,
            fontFamily: 'Inter, sans-serif',
            fill: '#fff',
            backgroundColor: '#3b82f6',
            padding: 3,
            selectable: false,
            evented: false
        });

        canvas.add(text);
        bboxes.push({ id: id, fabricRect: rect, fabricText: text, labels: labels, source: 'human', confidence: 1.0 });

        isDirty = true;
        updateAnnotationCount();
        saveUndoState();
    }

    // ============================================================
    // SELECTION
    // ============================================================
    function onSelectionCreated() {
        var active = canvas.getActiveObject();
        if (!active) return;

        // Find bbox
        var bbox = bboxes.find(function(b) { return b.fabricRect === active; });
        if (bbox) {
            showBboxProperties(bbox);
            return;
        }

        // Find keypoint
        var kpCircle = keypointGroups.reduce(function(found, kg) {
            return found || kg.fabricCircles.find(function(c) { return c === active; });
        }, null);
        if (kpCircle) {
            showKeypointProperties(kpCircle);
            return;
        }

        hideProperties();
    }

    function onSelectionCleared() {
        hideProperties();
    }

    function onObjectModified(opt) {
        var obj = opt.target;
        if (!obj) return;

        // Update text position for bboxes
        var bbox = bboxes.find(function(b) { return b.fabricRect === obj; });
        if (bbox && bbox.fabricText) {
            bbox.fabricText.set({ left: obj.left, top: obj.top - 16 });
        }

        isDirty = true;
        saveUndoState();
    }

    // ============================================================
    // PROPERTIES PANEL
    // ============================================================
    function showBboxProperties(bbox) {
        dom.propEmpty.style.display = 'none';
        dom.propBbox.style.display = 'block';

        dom.propType.textContent = 'BBox';
        dom.propSource.innerHTML = bbox.source === 'ai' ?
            '<span class="source-badge ai">AI</span>' :
            '<span class="source-badge human">人工</span>';

        var rect = bbox.fabricRect;
        var bgImg = canvas.backgroundImage;
        if (bgImg) {
            var imgW = bgImg.width * bgImg.scaleX;
            var imgH = bgImg.height * bgImg.scaleY;
            dom.propX.value = (rect.left / imgW).toFixed(4);
            dom.propY.value = (rect.top / imgH).toFixed(4);
            dom.propW.value = (rect.width * rect.scaleX / imgW).toFixed(4);
            dom.propH.value = (rect.height * rect.scaleY / imgH).toFixed(4);
        }

        // Update behavior tags
        dom.propBehaviorTags.querySelectorAll('.behavior-tag').forEach(function(tag) {
            tag.classList.toggle('active', bbox.labels.includes(tag.dataset.label));
        });
    }

    function showKeypointProperties(circle) {
        dom.propEmpty.style.display = 'none';
        dom.propBbox.style.display = 'block';
        dom.propType.textContent = '关键点 (' + (LABEL_NAMES[circle.kpName] || circle.kpName) + ')';
        dom.propSource.innerHTML = '<span class="source-badge human">人工</span>';
        dom.propX.value = '';
        dom.propY.value = '';
        dom.propW.value = '';
        dom.propH.value = '';
    }

    function hideProperties() {
        dom.propEmpty.style.display = 'block';
        dom.propBbox.style.display = 'none';
    }

    function updateSelectedBboxLabels() {
        var active = canvas.getActiveObject();
        if (!active) return;
        var bbox = bboxes.find(function(b) { return b.fabricRect === active; });
        if (!bbox) return;

        var labels = [];
        dom.propBehaviorTags.querySelectorAll('.behavior-tag.active').forEach(function(tag) {
            labels.push(tag.dataset.label);
        });
        bbox.labels = labels;

        // Update text
        if (bbox.fabricText) {
            var labelText = labels.map(function(l) { return LABEL_NAMES[l] || l; }).join(', ');
            if (bbox.source === 'ai') labelText = '[AI] ' + labelText;
            bbox.fabricText.set({ text: labelText });
            canvas.renderAll();
        }

        isDirty = true;
    }

    // ============================================================
    // DELETE / UNDO
    // ============================================================
    function deleteSelected() {
        var active = canvas.getActiveObject();
        if (!active) return;

        // Remove bbox
        var bboxIdx = bboxes.findIndex(function(b) { return b.fabricRect === active; });
        if (bboxIdx >= 0) {
            var bbox = bboxes[bboxIdx];
            canvas.remove(bbox.fabricRect);
            if (bbox.fabricText) canvas.remove(bbox.fabricText);
            bboxes.splice(bboxIdx, 1);
            isDirty = true;
            updateAnnotationCount();
            saveUndoState();
            hideProperties();
            return;
        }

        // Remove keypoint
        for (var i = 0; i < keypointGroups.length; i++) {
            var kg = keypointGroups[i];
            var kpIdx = kg.fabricCircles.indexOf(active);
            if (kpIdx >= 0) {
                canvas.remove(kg.fabricCircles[kpIdx]);
                kg.fabricCircles.splice(kpIdx, 1);
                kg.points.splice(kpIdx, 1);
                // Remove connected lines
                kg.fabricLines.forEach(function(line) { canvas.remove(line); });
                kg.fabricLines = [];
                // Redraw lines between remaining points
                for (var j = 1; j < kg.fabricCircles.length; j++) {
                    var prev = kg.fabricCircles[j - 1];
                    var curr = kg.fabricCircles[j];
                    var line = new fabric.Line([prev.left + prev.radius, prev.top + prev.radius, curr.left + curr.radius, curr.top + curr.radius], {
                        stroke: '#22c55e', strokeWidth: 1.5, selectable: false, evented: false, opacity: 0.7
                    });
                    canvas.add(line);
                    kg.fabricLines.push(line);
                }
                if (kg.fabricCircles.length === 0) {
                    keypointGroups.splice(i, 1);
                }
                isDirty = true;
                updateAnnotationCount();
                saveUndoState();
                hideProperties();
                return;
            }
        }

        // Delete any other selected object
        canvas.remove(active);
        isDirty = true;
        saveUndoState();
    }

    function saveUndoState() {
        undoStack.push(canvas.toJSON(['bboxId', 'labels', 'source', 'confidence', 'kpName', 'kpGroupId', 'visible']));
        if (undoStack.length > 50) undoStack.shift();
    }

    function undo() {
        if (undoStack.length === 0) { Common.toast('没有可撤销的操作', 'info'); return; }
        var state = undoStack.pop();
        canvas.loadFromJSON(state, function() {
            canvas.renderAll();
            // Rebuild bboxes and keypointGroups from canvas objects
            rebuildState();
        });
    }

    function rebuildState() {
        bboxes = [];
        keypointGroups = [];
        canvas.forEachObject(function(obj) {
            if (obj === canvas.backgroundImage) return;
            if (obj.bboxId) {
                var text = canvas.getObjects().find(function(o) {
                    return o.type === 'text' && o.left === obj.left && o.top === obj.top - 16;
                });
                bboxes.push({ id: obj.bboxId, fabricRect: obj, fabricText: text, labels: obj.labels || [], source: obj.source || 'human', confidence: obj.confidence || 0 });
            } else if (obj.kpGroupId) {
                var kg = keypointGroups.find(function(k) { return k.id === obj.kpGroupId; });
                if (!kg) {
                    kg = { id: obj.kpGroupId, personId: null, fabricCircles: [], fabricLines: [], points: [] };
                    keypointGroups.push(kg);
                }
                kg.fabricCircles.push(obj);
                kg.points.push({ name: obj.kpName, x: obj.left + obj.radius, y: obj.top + obj.radius, visible: obj.visible });
            }
        });
        updateAnnotationCount();
    }

    // ============================================================
    // ZOOM / FIT
    // ============================================================
    function zoom(factor) {
        var center = { x: canvas.width / 2, y: canvas.height / 2 };
        canvas.zoomToPoint(center, canvas.getZoom() * factor);
        dom.statusZoom.textContent = Math.round(canvas.getZoom() * 100) + '%';
    }

    function fitCanvas() {
        canvas.setZoom(1);
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        dom.statusZoom.textContent = '100%';
    }

    // ============================================================
    // UPLOAD
    // ============================================================
    function handleFileUpload(e) {
        if (e.target.files.length > 0) uploadFiles(e.target.files);
    }

    function uploadFiles(files) {
        Array.from(files).forEach(function(file) {
            var formData = new FormData();
            formData.append('file', file);

            Common.authFetch(API + '/upload', {
                method: 'POST',
                body: formData,
                headers: {} // Let browser set Content-Type with boundary
            }).then(function(data) {
                Common.toast('上传成功: ' + data.data.filename, 'success');
                loadImageList();
            }).catch(function() {});
        });
    }

    // ============================================================
    // EXPORT
    // ============================================================
    function showExportDialog() {
        var overlay = document.createElement('div');
        overlay.className = 'dialog-overlay show';
        overlay.innerHTML = '<div class="dialog">' +
            '<div class="dialog-title">导出标注数据</div>' +
            '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button class="btn" style="flex:1" id="exportYolo">YOLO 格式 (.zip)</button>' +
            '<button class="btn" style="flex:1" id="exportCoco">COCO 格式 (.json)</button>' +
            '</div>' +
            '<button class="btn" style="width:100%;margin-top:8px" id="exportCancel">取消</button>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.querySelector('#exportYolo').addEventListener('click', function() {
            downloadExport('yolo');
            overlay.remove();
        });
        overlay.querySelector('#exportCoco').addEventListener('click', function() {
            downloadExport('coco');
            overlay.remove();
        });
        overlay.querySelector('#exportCancel').addEventListener('click', function() {
            overlay.remove();
        });
    }

    function downloadExport(format) {
        var token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        var url = API + '/export?format=' + format;
        if (token) url += '&token=' + token;

        var a = document.createElement('a');
        a.href = url;
        a.download = 'annotations_' + format + (format === 'coco' ? '.json' : '.zip');
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // ============================================================
    // HELPERS
    // ============================================================
    function updateAnnotationCount() {
        dom.statusAnnotations.textContent = bboxes.length + ' BBox, ' + keypointGroups.length + ' 关键点组';
    }

    function debounce(fn, ms) {
        var timer;
        return function() {
            clearTimeout(timer);
            timer = setTimeout(fn, ms);
        };
    }

    // ============================================================
    // START
    // ============================================================
    init();
})();
