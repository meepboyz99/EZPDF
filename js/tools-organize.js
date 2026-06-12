/* ============================================================
   tools-organize.js — Merge, Split, Extract, Remove, Reorder
   ============================================================ */

/* ─── 3. MERGE PDFs ─── */
App.registerTool({
  id: 'merge',
  name: 'Merge PDFs',
  icon: '🔗',
  category: 'organize',
  description: 'Combine multiple PDFs into one — drag to reorder',

  render() {
    return `
      ${App.createDropzone('merge-dz', {
        multiple: true,
        label: 'Drop multiple PDFs here',
        sub: 'Click or drag — you can add more after',
        icon: '📑'
      })}
      <div id="merge-list-wrap" style="margin-top:16px;"></div>
      <div id="merge-actions" style="display:none; margin-top:16px;">
        <div class="options-panel" style="margin-bottom:12px;">
          <div class="option-row">
            <span class="option-label">Output filename</span>
            <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:400px;">
              <input type="text" id="merge-filename" placeholder="merged" style="flex:1;">
              <span style="color:var(--text-3); font-size:13px; white-space:nowrap;">.pdf</span>
            </div>
          </div>
        </div>
        <div class="action-row">
          <button class="btn btn-primary btn-lg" id="merge-btn">🔗 Merge & Download</button>
          <button class="btn btn-secondary" id="merge-clear">Clear All</button>
          <span id="merge-summary" style="font-size:12px; color:var(--text-3);"></span>
        </div>
      </div>`;
  },

  mount() {
    let files = [];

    App.mountDropzone('merge-dz', newFiles => {
      const pdfs = newFiles.filter(f => f.name.endsWith('.pdf'));
      files = [...files, ...pdfs];
      renderList();
    });

    function renderList() {
      const wrap = document.getElementById('merge-list-wrap');
      const acts = document.getElementById('merge-actions');
      if (!files.length) { wrap.innerHTML = ''; acts.style.display = 'none'; return; }

      acts.style.display = 'block';

      // Auto-suggest filename from first file
      const filenameInput = document.getElementById('merge-filename');
      if (!filenameInput.value) {
        filenameInput.value = App.stem(files[0].name) + '-merged';
      }

      document.getElementById('merge-summary').textContent =
        `${files.length} file${files.length > 1 ? 's' : ''} · ${App.formatBytes(files.reduce((a,f) => a+f.size, 0))}`;

      wrap.innerHTML = `<p class="section-title" style="margin-bottom:8px;">Files (drag to reorder)</p>
        <div class="file-list" id="merge-file-list">
          ${files.map((f, i) => `
            <div class="file-list-item" data-idx="${i}">
              <span class="file-item-drag">⠿</span>
              <span class="file-item-icon">📄</span>
              <div class="file-item-info">
                <div class="file-item-name">${f.name}</div>
                <div class="file-item-meta">${App.formatBytes(f.size)}</div>
              </div>
              <button class="file-item-remove" onclick="MergeTool.remove(${i})">✕</button>
            </div>`).join('')}
        </div>`;

      if (window._mergeSortable) window._mergeSortable.destroy();
      window._mergeSortable = new Sortable(document.getElementById('merge-file-list'), {
        handle: '.file-item-drag',
        animation: 150,
        forceFallback: true,
        fallbackTolerance: 5,
        onEnd: evt => {
          const moved = files.splice(evt.oldIndex, 1)[0];
          files.splice(evt.newIndex, 0, moved);
        }
      });
    }

    window.MergeTool = {
      remove(i) { files.splice(i, 1); renderList(); }
    };

    document.getElementById('merge-btn').onclick = async () => {
      if (files.length < 2) return App.showToast('Add at least 2 PDFs', 'error');
      try {
        App.showProgress('Merging PDFs…');
        const merged = await PDFLib.PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          App.updateProgress((i / files.length) * 90, `Processing ${files[i].name}…`);
          const bytes = await App.readFile(files[i]);
          const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        }
        App.updateProgress(95, 'Saving…');
        const out = await merged.save();
        App.hideProgress();
        const rawName = document.getElementById('merge-filename').value.trim() || 'merged';
        const filename = rawName.endsWith('.pdf') ? rawName : rawName + '.pdf';
        App.downloadBytes(out, filename);
        App.showToast(`Merged ${files.length} PDFs → ${filename}`);
      } catch(e) {
        App.hideProgress();
        App.showToast('Merge failed: ' + e.message, 'error');
      }
    };

    document.getElementById('merge-clear').onclick = () => {
      files = [];
      renderList();
      document.getElementById('merge-dz').classList.remove('has-file');
      document.getElementById('merge-dz').querySelector('.file-info-pill')?.remove();
    };
  }
});

/* ─── 4. SPLIT PDF ─── */
App.registerTool({
  id: 'split',
  name: 'Split PDF',
  icon: '✂️',
  category: 'organize',
  description: 'Split a PDF into individual pages or custom ranges',

  render() {
    return `
      ${App.createDropzone('split-dz', { label: 'Drop PDF to split', sub: 'Supports any PDF file' })}
      <div id="split-ui" style="display:none; margin-top:20px;">
        <div class="options-panel">
          <div class="option-row">
            <span class="option-label">Split mode</span>
            <div class="option-group">
              <button class="chip active" id="split-mode-all" onclick="SplitTool.setMode('all')">Every Page</button>
              <button class="chip" id="split-mode-range" onclick="SplitTool.setMode('range')">Custom Ranges</button>
              <button class="chip" id="split-mode-every" onclick="SplitTool.setMode('every')">Every N Pages</button>
            </div>
          </div>
          <div id="split-range-ui" style="display:none;">
            <div class="option-row">
              <span class="option-label">Page ranges</span>
              <div style="flex:1">
                <div style="display:flex; gap:8px; align-items:center;">
                  <input type="text" id="split-range-input" placeholder="e.g. 1-3, 5, 7-10" style="flex:1">
                  <button class="btn btn-secondary btn-sm" onclick="SplitTool.addRange()">Add</button>
                </div>
                <div class="range-display" id="split-ranges" style="margin-top:8px;"></div>
                <div class="input-hint">Each range will become a separate PDF</div>
              </div>
            </div>
          </div>
          <div id="split-every-ui" style="display:none;">
            <div class="option-row">
              <span class="option-label">Pages per chunk</span>
              <input type="number" id="split-n" value="1" min="1" class="input-sm">
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Output filename</span>
            <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:400px;">
              <input type="text" id="split-filename" placeholder="e.g. my-document" style="flex:1;">
              <span style="color:var(--text-3); font-size:13px; white-space:nowrap;">-split.zip</span>
            </div>
          </div>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="split-btn">✂️ Split & Download ZIP</button>
          <span id="split-info" style="font-size:12px; color:var(--text-3);"></span>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, pdfDoc = null, mode = 'all', ranges = [];

    App.mountDropzone('split-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      try {
        App.showProgress('Loading PDF…');
        pdfDoc = await App.loadPDFJS(f);
        pdfFile = f;
        document.getElementById('split-ui').style.display = 'block';
        document.getElementById('split-n').max = pdfDoc.numPages;
        document.getElementById('split-info').textContent = `${pdfDoc.numPages} pages`;
        document.getElementById('split-filename').value = App.stem(f.name);
        App.showFileInfo('split-dz', f, pdfDoc.numPages);
        App.hideProgress();
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed to load: ' + e.message, 'error');
      }
    });

    window.SplitTool = {
      setMode(m) {
        mode = m;
        ['all', 'range', 'every'].forEach(k => {
          document.getElementById(`split-mode-${k}`).classList.toggle('active', k === m);
        });
        document.getElementById('split-range-ui').style.display = m === 'range' ? 'block' : 'none';
        document.getElementById('split-every-ui').style.display = m === 'every' ? 'block' : 'none';
      },
      addRange() {
        const v = document.getElementById('split-range-input').value.trim();
        if (!v) return;
        ranges.push(v);
        document.getElementById('split-range-input').value = '';
        renderRanges();
      },
      removeRange(i) { ranges.splice(i, 1); renderRanges(); }
    };

    function renderRanges() {
      document.getElementById('split-ranges').innerHTML = ranges.map((r, i) =>
        `<span class="range-tag">${r}<span class="range-tag-remove" onclick="SplitTool.removeRange(${i})">✕</span></span>`
      ).join('');
    }

    document.getElementById('split-btn').onclick = async () => {
      if (!pdfFile) return;
      const rawName = document.getElementById('split-filename').value.trim() || App.stem(pdfFile.name);
      try {
        App.showProgress('Splitting PDF…');
        const bytes = await App.readFile(pdfFile);
        const total = pdfDoc.numPages;
        const zipFiles = [];

        if (mode === 'all') {
          for (let i = 0; i < total; i++) {
            App.updateProgress((i / total) * 100, `Page ${i+1}…`);
            const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
            const out = await PDFLib.PDFDocument.create();
            const [page] = await out.copyPages(src, [i]);
            out.addPage(page);
            const outBytes = await out.save();
            zipFiles.push({ name: `${rawName}-page-${String(i+1).padStart(3,'0')}.pdf`, data: outBytes });
          }
        } else if (mode === 'range') {
          for (let ri = 0; ri < ranges.length; ri++) {
            const pageNums = App.parsePageRanges(ranges[ri], total);
            App.updateProgress((ri / ranges.length) * 100);
            const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
            const out = await PDFLib.PDFDocument.create();
            for (const n of pageNums) {
              const [pg] = await out.copyPages(src, [n - 1]);
              out.addPage(pg);
            }
            const outBytes = await out.save();
            zipFiles.push({ name: `${rawName}-part${ri+1}-[${ranges[ri].replace(/\s/g,'')}].pdf`, data: outBytes });
          }
        } else {
          const n = parseInt(document.getElementById('split-n').value) || 1;
          let chunk = 0;
          for (let i = 0; i < total; i += n) {
            chunk++;
            App.updateProgress((i / total) * 100, `Chunk ${chunk}…`);
            const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
            const out = await PDFLib.PDFDocument.create();
            for (let j = i; j < Math.min(i + n, total); j++) {
              const [pg] = await out.copyPages(src, [j]);
              out.addPage(pg);
            }
            const outBytes = await out.save();
            zipFiles.push({ name: `${rawName}-part${chunk}-p${i+1}-${Math.min(i+n,total)}.pdf`, data: outBytes });
          }
        }

        await App.downloadZip(zipFiles, `${rawName}-split.zip`);
        App.hideProgress();
        App.showToast(`Split into ${zipFiles.length} files!`);
      } catch(e) {
        App.hideProgress();
        App.showToast('Split failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 5. EXTRACT PAGES ─── */
App.registerTool({
  id: 'extract',
  name: 'Extract Pages',
  icon: '📤',
  category: 'organize',
  description: 'Pick specific pages and save them as a new PDF',

  render() {
    return `
      ${App.createDropzone('extract-dz', { label: 'Drop PDF to extract pages from' })}
      <div id="extract-ui" style="display:none; margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <p class="section-title">Click pages to select · <span id="extract-sel-count" style="color:var(--accent-l);">0 selected</span></p>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" id="extract-select-all">Select All</button>
            <button class="btn btn-secondary btn-sm" id="extract-clear-sel">Clear</button>
          </div>
        </div>
        <div id="extract-thumbs" class="thumb-grid"></div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="extract-btn">📤 Extract Selected Pages</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, pdfJsDoc = null, selected = new Set();

    App.mountDropzone('extract-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        App.showProgress('Loading thumbnails…');
        pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('extract-ui').style.display = 'block';
        App.showFileInfo('extract-dz', f, pdfJsDoc.numPages);
        await renderThumbs();
        App.hideProgress();
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed to load: ' + e.message, 'error');
      }
    });

    async function renderThumbs() {
      const grid = document.getElementById('extract-thumbs');
      grid.innerHTML = '';
      for (let i = 1; i <= pdfJsDoc.numPages; i++) {
        App.updateProgress((i / pdfJsDoc.numPages) * 100);
        const canvas = await App.renderPageToCanvas(pdfJsDoc, i, 0.25);
        const card = document.createElement('div');
        card.className = 'thumb-card';
        card.dataset.page = i;
        card.innerHTML = `<div class="thumb-canvas-wrap"></div>
          <div class="thumb-footer"><span class="thumb-page-num">Page ${i}</span></div>
          <span class="thumb-check">✓</span>`;
        card.querySelector('.thumb-canvas-wrap').appendChild(canvas);
        card.onclick = () => togglePage(i, card);
        grid.appendChild(card);
      }
    }

    function togglePage(n, card) {
      if (selected.has(n)) { selected.delete(n); card.classList.remove('selected'); }
      else { selected.add(n); card.classList.add('selected'); }
      document.getElementById('extract-sel-count').textContent = `${selected.size} selected`;
    }

    document.getElementById('extract-select-all').onclick = () => {
      for (let i = 1; i <= pdfJsDoc.numPages; i++) selected.add(i);
      document.querySelectorAll('#extract-thumbs .thumb-card').forEach(c => c.classList.add('selected'));
      document.getElementById('extract-sel-count').textContent = `${selected.size} selected`;
    };
    document.getElementById('extract-clear-sel').onclick = () => {
      selected.clear();
      document.querySelectorAll('#extract-thumbs .thumb-card').forEach(c => c.classList.remove('selected'));
      document.getElementById('extract-sel-count').textContent = '0 selected';
    };

    document.getElementById('extract-btn').onclick = async () => {
      if (!selected.size) return App.showToast('Select at least one page', 'error');
      try {
        App.showProgress('Extracting pages…');
        const bytes = await App.readFile(pdfFile);
        const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const out = await PDFLib.PDFDocument.create();
        const sorted = Array.from(selected).sort((a, b) => a - b);
        const pages = await out.copyPages(src, sorted.map(n => n - 1));
        pages.forEach(p => out.addPage(p));
        const outBytes = await out.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-extracted.pdf`);
        App.showToast(`Extracted ${sorted.length} pages!`);
      } catch(e) {
        App.hideProgress();
        App.showToast('Extract failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 6. REMOVE PAGES ─── */
App.registerTool({
  id: 'remove',
  name: 'Remove Pages',
  icon: '🗑️',
  category: 'organize',
  description: 'Delete specific pages from a PDF',

  render() {
    return `
      ${App.createDropzone('remove-dz', { label: 'Drop PDF to remove pages from' })}
      <div id="remove-ui" style="display:none; margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <p class="section-title">Click pages to mark for removal · <span id="remove-sel-count" style="color:var(--error);">0 marked</span></p>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" id="remove-clear-sel">Clear Marks</button>
          </div>
        </div>
        <div class="info-box info" style="margin-bottom:12px;">
          <span>ℹ</span><span>Red-highlighted pages will be removed. All others will be kept.</span>
        </div>
        <div id="remove-thumbs" class="thumb-grid"></div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-danger btn-lg" id="remove-btn">🗑️ Remove Marked Pages</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, pdfJsDoc = null, marked = new Set();

    App.mountDropzone('remove-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        App.showProgress('Loading thumbnails…');
        pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('remove-ui').style.display = 'block';
        App.showFileInfo('remove-dz', f, pdfJsDoc.numPages);
        await renderThumbs();
        App.hideProgress();
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed to load: ' + e.message, 'error');
      }
    });

    async function renderThumbs() {
      const grid = document.getElementById('remove-thumbs');
      grid.innerHTML = '';
      for (let i = 1; i <= pdfJsDoc.numPages; i++) {
        App.updateProgress((i / pdfJsDoc.numPages) * 100);
        const canvas = await App.renderPageToCanvas(pdfJsDoc, i, 0.25);
        const card = document.createElement('div');
        card.className = 'thumb-card';
        card.dataset.page = i;
        card.innerHTML = `<div class="thumb-canvas-wrap"></div>
          <div class="thumb-footer"><span class="thumb-page-num">Page ${i}</span></div>
          <div class="thumb-overlay">🗑️</div>`;
        card.querySelector('.thumb-canvas-wrap').appendChild(canvas);
        card.onclick = () => toggleMark(i, card);
        grid.appendChild(card);
      }
    }

    function toggleMark(n, card) {
      if (marked.has(n)) { marked.delete(n); card.classList.remove('marked-remove'); }
      else { marked.add(n); card.classList.add('marked-remove'); }
      document.getElementById('remove-sel-count').textContent = `${marked.size} marked`;
    }

    document.getElementById('remove-clear-sel').onclick = () => {
      marked.clear();
      document.querySelectorAll('#remove-thumbs .thumb-card').forEach(c => c.classList.remove('marked-remove'));
      document.getElementById('remove-sel-count').textContent = '0 marked';
    };

    document.getElementById('remove-btn').onclick = async () => {
      if (!marked.size) return App.showToast('Mark at least one page to remove', 'error');
      if (marked.size >= pdfJsDoc.numPages) return App.showToast('Cannot remove all pages', 'error');
      try {
        App.showProgress('Removing pages…');
        const bytes = await App.readFile(pdfFile);
        const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const keep = [];
        for (let i = 1; i <= pdfJsDoc.numPages; i++) {
          if (!marked.has(i)) keep.push(i - 1);
        }
        const out = await PDFLib.PDFDocument.create();
        const pages = await out.copyPages(src, keep);
        pages.forEach(p => out.addPage(p));
        const outBytes = await out.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-removed.pdf`);
        App.showToast(`Removed ${marked.size} page${marked.size > 1 ? 's' : ''}!`);
      } catch(e) {
        App.hideProgress();
        App.showToast('Remove failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 7. REORDER PAGES ─── */
App.registerTool({
  id: 'reorder',
  name: 'Reorder Pages',
  icon: '📐',
  category: 'organize',
  description: 'Drag and drop page thumbnails to change their order',

  render() {
    return `
      ${App.createDropzone('reorder-dz', { label: 'Drop PDF to reorder pages' })}
      <div id="reorder-ui" style="display:none; margin-top:20px;">
        <div class="info-box info" style="margin-bottom:12px;">
          <span>↕</span>
          <span>
            <strong>Drag thumbnails</strong> to rearrange — works on both desktop and mobile.<br>
            <span style="font-size:11px; opacity:0.8;">On mobile: press & hold a page for a moment, then drag.</span>
          </span>
        </div>
        <div id="reorder-thumbs" class="thumb-grid" style="touch-action:none;"></div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="reorder-btn">💾 Save Reordered PDF</button>
          <button class="btn btn-secondary" id="reorder-reset">↺ Reset Order</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, pdfJsDoc = null, order = [];
    let sortableInstance = null;

    App.mountDropzone('reorder-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        App.showProgress('Loading thumbnails…');
        pdfJsDoc = await App.loadPDFJS(f);
        order = Array.from({ length: pdfJsDoc.numPages }, (_, i) => i + 1);
        document.getElementById('reorder-ui').style.display = 'block';
        App.showFileInfo('reorder-dz', f, pdfJsDoc.numPages);
        await renderThumbs();
        App.hideProgress();
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed to load: ' + e.message, 'error');
      }
    });

    async function renderThumbs() {
      // Destroy any existing sortable first to avoid event conflicts
      if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }

      const grid = document.getElementById('reorder-thumbs');
      grid.innerHTML = '';

      for (let i = 0; i < order.length; i++) {
        const pageNum = order[i];
        App.updateProgress(((i + 1) / order.length) * 100);
        const canvas = await App.renderPageToCanvas(pdfJsDoc, pageNum, 0.25);

        const card = document.createElement('div');
        card.className = 'thumb-card reorder-card';
        card.dataset.page = pageNum;

        // Drag handle pill at top
        card.innerHTML = `
          <div class="reorder-handle" title="Drag to reorder">
            <span class="reorder-handle-dots">⠿⠿</span>
          </div>
          <div class="thumb-canvas-wrap"></div>
          <div class="thumb-footer">
            <span class="thumb-page-num">Page ${pageNum}</span>
            <span class="reorder-pos-badge">#${i + 1}</span>
          </div>`;

        card.querySelector('.thumb-canvas-wrap').appendChild(canvas);
        grid.appendChild(card);
      }

      // Init Sortable with both mouse + touch support
      sortableInstance = new Sortable(grid, {
        animation: 180,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        handle: '.reorder-handle',   // dedicated handle — avoids click conflicts
        delay: 0,                    // no delay needed with explicit handle
        delayOnTouchOnly: false,
        forceFallback: true,         // fixes mobile browsers
        fallbackTolerance: 3,
        touchStartThreshold: 3,
        onStart() {
          document.body.style.userSelect = 'none';
        },
        onEnd(evt) {
          document.body.style.userSelect = '';
          // Update order array from DOM
          order = Array.from(grid.querySelectorAll('.reorder-card')).map(c => +c.dataset.page);
          // Update position badges
          grid.querySelectorAll('.reorder-pos-badge').forEach((b, idx) => {
            b.textContent = `#${idx + 1}`;
          });
        }
      });
    }

    document.getElementById('reorder-reset').onclick = async () => {
      order = Array.from({ length: pdfJsDoc.numPages }, (_, i) => i + 1);
      App.showProgress('Resetting…');
      await renderThumbs();
      App.hideProgress();
      App.showToast('Page order reset');
    };

    document.getElementById('reorder-btn').onclick = async () => {
      if (!pdfFile) return;
      try {
        App.showProgress('Saving reordered PDF…');
        const bytes = await App.readFile(pdfFile);
        const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const out = await PDFLib.PDFDocument.create();
        const pages = await out.copyPages(src, order.map(n => n - 1));
        pages.forEach(p => out.addPage(p));
        const outBytes = await out.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-reordered.pdf`);
        App.showToast('Reordered PDF saved!');
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed: ' + e.message, 'error');
      }
    };
  }
});
