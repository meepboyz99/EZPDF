/* ============================================================
   EZPDF — app.js
   Core framework: tool registry, routing, shared utilities
   ============================================================ */

const App = {
  tools: [],
  toolsMap: {},
  currentTool: null,

  categories: [
    { id: 'view',     name: '👁  View & Read'  },
    { id: 'organize', name: '📋  Organize'      },
    { id: 'edit',     name: '✏️  Edit'          },
    { id: 'convert',  name: '🔄  Convert'       },
    { id: 'optimize', name: '⚡  Optimize'       },
    { id: 'security', name: '🔐  Security'       },
  ],

  /* ─── Tool Registration ─── */
  registerTool(tool) {
    this.tools.push(tool);
    this.toolsMap[tool.id] = tool;
  },

  /* ─── Navigation ─── */
  navigateTo(toolId) {
    const tool = this.toolsMap[toolId];
    if (!tool) return;
    this.currentTool = tool;

    // Sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.querySelector(`.nav-item[data-tool="${toolId}"]`);
    if (navEl) { navEl.classList.add('active'); navEl.scrollIntoView({ block: 'nearest' }); }

    // Header
    document.getElementById('header-icon').textContent = tool.icon;
    document.getElementById('header-title').textContent = tool.name;
    document.getElementById('header-desc').textContent = tool.description;

    // Panel
    const panel = document.getElementById('tool-panel');
    panel.innerHTML = `<div class="tool-content fade-in">${tool.render()}</div>`;
    if (tool.mount) {
      try { tool.mount(); } catch(e) { console.error('mount error', e); }
    }

    window.location.hash = toolId;
  },

  /* ─── Sidebar Rendering ─── */
  renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    let html = '';
    for (const cat of this.categories) {
      const catTools = this.tools.filter(t => t.category === cat.id);
      if (!catTools.length) continue;
      html += `<div class="nav-category">
        <span class="nav-category-label">${cat.name}</span>
        <div class="nav-items">`;
      for (const t of catTools) {
        html += `<button class="nav-item" data-tool="${t.id}" onclick="App.navigateTo('${t.id}')">
          <span class="nav-item-icon">${t.icon}</span>
          <span class="nav-item-name">${t.name}</span>
        </button>`;
      }
      html += `</div></div>`;
    }
    nav.innerHTML = html;
  },

  /* ─── Welcome Screen ─── */
  renderWelcome() {
    document.getElementById('header-icon').textContent = '⚡';
    document.getElementById('header-title').textContent = 'EZPDF Toolkit';
    document.getElementById('header-desc').textContent = '18 powerful PDF tools — 100% in your browser, 100% private';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const panel = document.getElementById('tool-panel');
    let html = `<div class="welcome-grid fade-in">
      <div class="welcome-hero">
        <div class="welcome-hero-title">Everything you need for PDFs</div>
        <div class="welcome-hero-sub">Free, private, and blazing fast — no uploads, no accounts, no limits</div>
        <div class="welcome-stats">
          <div class="welcome-stat"><span class="welcome-stat-num">18</span><span class="welcome-stat-label">Tools</span></div>
          <div class="welcome-stat"><span class="welcome-stat-num">0</span><span class="welcome-stat-label">Uploads</span></div>
          <div class="welcome-stat"><span class="welcome-stat-num">∞</span><span class="welcome-stat-label">Free</span></div>
        </div>
      </div>`;

    for (const cat of this.categories) {
      const catTools = this.tools.filter(t => t.category === cat.id);
      if (!catTools.length) continue;
      html += `<div class="welcome-category">
        <div class="welcome-cat-title">${cat.name}</div>
        <div class="welcome-tools-grid">`;
      for (const t of catTools) {
        html += `<button class="welcome-tool-card" onclick="App.navigateTo('${t.id}')">
          <span class="welcome-tool-icon">${t.icon}</span>
          <span class="welcome-tool-name">${t.name}</span>
          <span class="welcome-tool-desc">${t.description}</span>
        </button>`;
      }
      html += `</div></div>`;
    }
    html += `</div>`;
    panel.innerHTML = html;
  },

  /* ─── Dropzone ─── */
  createDropzone(id, opts = {}) {
    const { accept = '.pdf', multiple = false,
      label = 'Drop PDF here', sub = 'or click to browse', icon = '📄' } = opts;
    return `<div class="dropzone" id="${id}">
      <input class="dropzone-input" type="file" accept="${accept}" ${multiple ? 'multiple' : ''}>
      <span class="dropzone-icon">${icon}</span>
      <p class="dropzone-label">${label}</p>
      <p class="dropzone-sublabel">${sub}</p>
    </div>`;
  },

  mountDropzone(id, onFiles) {
    const el = document.getElementById(id);
    if (!el) return;
    const inp = el.querySelector('.dropzone-input');
    el.addEventListener('click', e => { if (e.target !== inp) inp.click(); });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drag-over');
      onFiles(Array.from(e.dataTransfer.files));
    });
    inp.addEventListener('change', () => { onFiles(Array.from(inp.files)); inp.value = ''; });
  },

  showFileInfo(dzId, file, pages) {
    const dz = document.getElementById(dzId);
    if (!dz) return;
    const existing = dz.querySelector('.file-info-pill');
    if (existing) existing.remove();
    const pill = document.createElement('div');
    pill.className = 'file-info-pill';
    pill.innerHTML = `<span class="file-info-icon">📄</span>
      <span class="file-info-name">${file.name}</span>
      <span class="file-info-size">${this.formatBytes(file.size)}</span>
      ${pages ? `<span class="file-info-pages">${pages} pages</span>` : ''}`;
    dz.appendChild(pill);
    dz.classList.add('has-file');
  },

  /* ─── PDF Utilities ─── */
  readFile(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsArrayBuffer(file);
    });
  },

  async loadPDFLib(file, password) {
    const bytes = await this.readFile(file);
    const opts = { ignoreEncryption: false };
    if (password) opts.password = password;
    return PDFLib.PDFDocument.load(bytes, opts);
  },

  async loadPDFJS(file, password) {
    const bytes = await this.readFile(file);
    const params = { data: bytes };
    if (password) params.password = password;
    return pdfjsLib.getDocument(params).promise;
  },

  async renderPageToCanvas(pdfJsDoc, pageNum, scale = 1.5) {
    const page = await pdfJsDoc.getPage(pageNum);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    return canvas;
  },

  canvasToJpeg(canvas, quality = 0.85) {
    return canvas.toDataURL('image/jpeg', quality);
  },

  dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  },

  /* ─── Download ─── */
  downloadBytes(bytes, filename, mime = 'application/pdf') {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
  },

  async downloadZip(files, zipName) {
    const zip = new JSZip();
    for (const f of files) zip.file(f.name, f.data);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: zipName });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
  },

  /* ─── Toast ─── */
  showToast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const t = Object.assign(document.createElement('div'), { className: `toast toast-${type}` });
    t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3500);
  },

  /* ─── Progress ─── */
  showProgress(title = 'Processing…', sub = 'Please wait') {
    document.getElementById('progress-title').textContent = title;
    document.getElementById('progress-sub').textContent = sub;
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-pct').textContent = '0%';
    document.getElementById('progress-overlay').classList.add('show');
  },
  hideProgress() {
    document.getElementById('progress-overlay').classList.remove('show');
  },
  updateProgress(pct, sub) {
    const p = Math.round(pct);
    document.getElementById('progress-fill').style.width = p + '%';
    document.getElementById('progress-pct').textContent = p + '%';
    if (sub) document.getElementById('progress-sub').textContent = sub;
  },

  /* ─── Utilities ─── */
  formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  },

  stem(filename) {
    return filename.replace(/\.[^.]+$/, '');
  },

  parsePageRanges(str, total) {
    const pages = new Set();
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (p.includes('-')) {
        const [a, b] = p.split('-').map(Number);
        for (let i = Math.max(1, a); i <= Math.min(total, b); i++) pages.add(i);
      } else {
        const n = Number(p);
        if (n >= 1 && n <= total) pages.add(n);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  },

  /* ─── Init ─── */
  init() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    this.renderSidebar();

    // Tool search
    document.getElementById('tool-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('hidden', !el.textContent.toLowerCase().includes(q));
      });
    });

    // Hash routing
    const hash = window.location.hash.slice(1);
    if (hash && this.toolsMap[hash]) {
      this.navigateTo(hash);
    } else {
      this.renderWelcome();
    }

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.slice(1);
      if (h && this.toolsMap[h]) this.navigateTo(h);
    });
  }
};
