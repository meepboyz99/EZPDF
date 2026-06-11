/* ============================================================
   tools-view.js — PDF Viewer + PDF to Text
   ============================================================ */

/* ─── 1. PDF VIEWER ─── */
App.registerTool({
  id: 'viewer',
  name: 'PDF Viewer',
  icon: '📄',
  category: 'view',
  description: 'View PDF pages with zoom and navigation controls',

  render() {
    return `
      ${App.createDropzone('viewer-dz', { label: 'Open a PDF to view', sub: 'Supports all PDF files' })}
      <div id="viewer-ui" style="display:none; margin-top:20px;">
        <div class="viewer-controls">
          <button class="btn btn-secondary btn-sm" id="v-prev">◀ Prev</button>
          <input type="number" id="v-page-inp" class="page-input" min="1" value="1">
          <span style="color:var(--text-3); font-size:13px;">/ <span id="v-total">0</span></span>
          <button class="btn btn-secondary btn-sm" id="v-next">Next ▶</button>
          <div style="flex:1"></div>
          <button class="btn btn-secondary btn-sm" id="v-zoom-out">−</button>
          <span class="zoom-label" id="v-zoom-lbl">100%</span>
          <button class="btn btn-secondary btn-sm" id="v-zoom-in">+</button>
          <button class="btn btn-secondary btn-sm" id="v-fit-w">Fit Width</button>
          <button class="btn btn-secondary btn-sm" id="v-all">All Pages</button>
        </div>
        <div id="viewer-pages" class="viewer-pages" style="margin-top:16px;"></div>
      </div>`;
  },

  mount() {
    let pdfDoc = null, scale = 1.5, currentPage = 1, showAll = false;

    App.mountDropzone('viewer-dz', async files => {
      const f = files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF file', 'error');
      try {
        App.showProgress('Loading PDF…');
        pdfDoc = await App.loadPDFJS(f);
        const total = pdfDoc.numPages;
        document.getElementById('v-total').textContent = total;
        document.getElementById('v-page-inp').max = total;
        document.getElementById('viewer-ui').style.display = 'block';
        App.showFileInfo('viewer-dz', f, total);
        App.hideProgress();
        renderPage(1);
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed to load PDF: ' + e.message, 'error');
      }
    });

    async function renderPage(n) {
      if (!pdfDoc) return;
      currentPage = Math.max(1, Math.min(n, pdfDoc.numPages));
      document.getElementById('v-page-inp').value = currentPage;
      const wrap = document.getElementById('viewer-pages');
      wrap.innerHTML = '<div style="color:var(--text-3);text-align:center;padding:24px">Rendering…</div>';

      const pages = showAll
        ? Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1)
        : [currentPage];

      wrap.innerHTML = '';
      for (const p of pages) {
        const canvas = await App.renderPageToCanvas(pdfDoc, p, scale);
        const div = document.createElement('div');
        div.className = 'viewer-page-wrap';
        div.innerHTML = `<div class="viewer-page-num-badge">Page ${p}</div>`;
        div.insertBefore(canvas, div.firstChild);
        wrap.appendChild(div);
        if (showAll && p % 5 === 0) App.updateProgress((p / pdfDoc.numPages) * 100);
      }
      App.updateProgress(100);
    }

    document.getElementById('v-prev').onclick = () => renderPage(currentPage - 1);
    document.getElementById('v-next').onclick = () => renderPage(currentPage + 1);
    document.getElementById('v-page-inp').onchange = e => renderPage(+e.target.value);
    document.getElementById('v-zoom-in').onclick = () => { scale = Math.min(4, scale + 0.25); updateZoomLabel(); renderPage(currentPage); };
    document.getElementById('v-zoom-out').onclick = () => { scale = Math.max(0.25, scale - 0.25); updateZoomLabel(); renderPage(currentPage); };
    document.getElementById('v-fit-w').onclick = () => { scale = 1.5; updateZoomLabel(); renderPage(currentPage); };
    document.getElementById('v-all').onclick = () => {
      showAll = !showAll;
      document.getElementById('v-all').textContent = showAll ? 'Single Page' : 'All Pages';
      App.showProgress('Rendering all pages…');
      renderPage(currentPage).then(() => App.hideProgress());
    };

    function updateZoomLabel() {
      document.getElementById('v-zoom-lbl').textContent = Math.round(scale / 1.5 * 100) + '%';
    }
  }
});

/* ─── 2. PDF TO TEXT ─── */
App.registerTool({
  id: 'extract-text',
  name: 'PDF to Text',
  icon: '📝',
  category: 'view',
  description: 'Extract all text content from any PDF file',

  render() {
    return `
      ${App.createDropzone('txt-dz', { label: 'Drop PDF to extract text', sub: 'Extracts all selectable text' })}
      <div id="txt-ui" style="display:none; margin-top:20px;">
        <div class="action-row">
          <button class="btn btn-secondary btn-sm" id="txt-copy">📋 Copy All</button>
          <button class="btn btn-secondary btn-sm" id="txt-download">⬇ Download .txt</button>
          <span id="txt-stats" style="font-size:12px; color:var(--text-3); margin-left:8px;"></span>
        </div>
        <div class="output-section" style="margin-top:12px;">
          <div class="output-header">
            <span class="output-title">Extracted Text</span>
            <span id="txt-page-count" style="font-size:12px; color:var(--text-3);"></span>
          </div>
          <div class="output-body">
            <div class="output-text" id="txt-output"></div>
          </div>
        </div>
      </div>`;
  },

  mount() {
    let fullText = '';
    App.mountDropzone('txt-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF file', 'error');
      try {
        App.showProgress('Extracting text…');
        const pdfDoc = await App.loadPDFJS(f);
        const total = pdfDoc.numPages;
        fullText = '';
        for (let i = 1; i <= total; i++) {
          App.updateProgress((i / total) * 100, `Page ${i} of ${total}`);
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += `\n--- Page ${i} ---\n${pageText}\n`;
        }
        document.getElementById('txt-output').textContent = fullText.trim();
        document.getElementById('txt-page-count').textContent = `${total} pages`;
        const words = fullText.trim().split(/\s+/).filter(Boolean).length;
        const chars = fullText.trim().length;
        document.getElementById('txt-stats').textContent = `${words.toLocaleString()} words · ${chars.toLocaleString()} chars`;
        document.getElementById('txt-ui').style.display = 'block';
        App.showFileInfo('txt-dz', f, total);
        App.hideProgress();
        App.showToast('Text extracted successfully!');
      } catch(e) {
        App.hideProgress();
        App.showToast('Extraction failed: ' + e.message, 'error');
      }
    });

    document.getElementById('txt-copy').onclick = () => {
      if (!fullText) return;
      navigator.clipboard.writeText(fullText).then(() => App.showToast('Copied to clipboard!'));
    };
    document.getElementById('txt-download').onclick = () => {
      if (!fullText) return;
      App.downloadBytes(new TextEncoder().encode(fullText), 'extracted-text.txt', 'text/plain');
      App.showToast('Downloaded!');
    };
  }
});
