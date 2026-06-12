/* ============================================================
   tools-edit.js — Rotate, Watermark, Page Numbers, Metadata, Sign
   ============================================================ */

/* ─── 8. ROTATE PAGES ─── */
App.registerTool({
  id: 'rotate',
  name: 'Rotate Pages',
  icon: '🔄',
  category: 'edit',
  description: 'Rotate individual or all pages by 90°, 180°, or 270°',

  render() {
    return `
      ${App.createDropzone('rotate-dz', { label: 'Drop PDF to rotate pages' })}
      <div id="rotate-ui" style="display:none; margin-top:20px;">
        <div class="options-panel" style="margin-bottom:16px;">
          <div class="option-row">
            <span class="option-label">Rotation</span>
            <div class="option-group">
              <button class="chip active" id="rot-90"  onclick="RotateTool.setAngle(90)">↻ 90° Right</button>
              <button class="chip" id="rot-180" onclick="RotateTool.setAngle(180)">↻ 180°</button>
              <button class="chip" id="rot-270" onclick="RotateTool.setAngle(270)">↺ 90° Left</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Apply to</span>
            <div class="option-group">
              <button class="chip active" id="rot-all-btn" onclick="RotateTool.setScope('all')">All Pages</button>
              <button class="chip" id="rot-pick-btn" onclick="RotateTool.setScope('pick')">Pick Pages</button>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <p class="section-title" id="rotate-thumb-label">Preview — all pages will rotate</p>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" id="rotate-select-all" style="display:none;">Select All</button>
            <button class="btn btn-secondary btn-sm" id="rotate-clear-sel" style="display:none;">Clear</button>
          </div>
        </div>

        <div id="rotate-thumbs" class="thumb-grid"></div>

        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="rotate-btn">🔄 Apply Rotation & Download</button>
          <span id="rotate-sel-info" style="font-size:12px; color:var(--text-3);"></span>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, pdfJsDoc = null, angle = 90, scope = 'all', selected = new Set();

    App.mountDropzone('rotate-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        App.showProgress('Loading thumbnails…');
        pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('rotate-ui').style.display = 'block';
        App.showFileInfo('rotate-dz', f, pdfJsDoc.numPages);
        await renderThumbs();
        updateSelInfo();
        App.hideProgress();
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed: ' + e.message, 'error');
      }
    });

    async function renderThumbs() {
      const grid = document.getElementById('rotate-thumbs');
      grid.innerHTML = '';

      for (let i = 1; i <= pdfJsDoc.numPages; i++) {
        App.updateProgress((i / pdfJsDoc.numPages) * 100);
        const canvas = await App.renderPageToCanvas(pdfJsDoc, i, 0.25);

        const card = document.createElement('div');
        card.className = 'thumb-card rotate-preview-card' + (scope === 'pick' && selected.has(i) ? ' selected' : '');
        card.dataset.page = i;

        // Wrap canvas in a rotating container so overflow doesn't break the card
        const rotWrap = document.createElement('div');
        rotWrap.className = 'rotate-canvas-wrap';
        rotWrap.dataset.page = i;
        rotWrap.style.cssText = 'overflow:hidden; display:flex; align-items:center; justify-content:center; background:white; min-height:80px;';
        canvas.style.transition = 'transform 0.3s cubic-bezier(.4,0,.2,1)';
        canvas.style.transformOrigin = 'center';
        // Show angle based on current scope
        const previewAngle = (scope === 'all' || selected.has(i)) ? angle : 0;
        canvas.style.transform = `rotate(${previewAngle}deg)`;
        rotWrap.appendChild(canvas);

        card.innerHTML = `
          <div class="thumb-footer" style="flex-direction:column; align-items:center; gap:3px; padding:6px;">
            <span class="thumb-page-num">Page ${i}</span>
            <span class="rotate-angle-badge" id="rot-badge-${i}"></span>
          </div>
          <span class="thumb-check">✓</span>`;

        card.insertBefore(rotWrap, card.firstChild);
        updateBadge(i, previewAngle);

        if (scope === 'pick') {
          card.onclick = () => {
            if (selected.has(i)) { selected.delete(i); card.classList.remove('selected'); }
            else { selected.add(i); card.classList.add('selected'); }
            updateSelInfo();
            applyPreviewToCard(i);
          };
        }

        grid.appendChild(card);
      }
    }

    function applyPreviewToCard(pageNum) {
      const wrap = document.querySelector(`.rotate-canvas-wrap[data-page="${pageNum}"]`);
      if (!wrap) return;
      const canvas = wrap.querySelector('canvas');
      const isAffected = scope === 'all' || selected.has(pageNum);
      if (canvas) canvas.style.transform = `rotate(${isAffected ? angle : 0}deg)`;
      updateBadge(pageNum, isAffected ? angle : 0);
    }

    function applyPreviewAll() {
      for (let i = 1; i <= (pdfJsDoc ? pdfJsDoc.numPages : 0); i++) applyPreviewToCard(i);
    }

    function updateBadge(pageNum, deg) {
      const badge = document.getElementById(`rot-badge-${pageNum}`);
      if (!badge) return;
      if (deg === 0) {
        badge.textContent = 'No change';
        badge.style.cssText = 'font-size:10px; color:var(--text-3);';
      } else {
        badge.textContent = `+${deg}°`;
        badge.style.cssText = 'font-size:10px; font-weight:700; color:var(--accent-l); background:var(--accent-subtle); border:1px solid var(--accent-mid); border-radius:20px; padding:1px 7px;';
      }
    }

    function updateSelInfo() {
      const el = document.getElementById('rotate-sel-info');
      if (!el) return;
      if (scope === 'pick') el.textContent = `${selected.size} page${selected.size !== 1 ? 's' : ''} selected`;
      else el.textContent = pdfJsDoc ? `${pdfJsDoc.numPages} pages will rotate` : '';
    }

    window.RotateTool = {
      setAngle(a) {
        angle = a;
        [90, 180, 270].forEach(v =>
          document.getElementById(`rot-${v}`).classList.toggle('active', v === a)
        );
        applyPreviewAll();
      },
      setScope(s) {
        scope = s;
        ['all', 'pick'].forEach(v =>
          document.getElementById(`rot-${v}-btn`).classList.toggle('active', v === s)
        );
        document.getElementById('rotate-select-all').style.display = s === 'pick' ? 'inline-flex' : 'none';
        document.getElementById('rotate-clear-sel').style.display  = s === 'pick' ? 'inline-flex' : 'none';
        document.getElementById('rotate-thumb-label').textContent  =
          s === 'all' ? 'Live preview — all pages will rotate' : 'Click pages to select · preview updates instantly';

        if (pdfJsDoc) {
          App.showProgress('Updating preview…');
          renderThumbs().then(() => { updateSelInfo(); App.hideProgress(); });
        }
      }
    };

    document.getElementById('rotate-select-all').onclick = () => {
      for (let i = 1; i <= pdfJsDoc.numPages; i++) selected.add(i);
      document.querySelectorAll('.rotate-preview-card').forEach(c => c.classList.add('selected'));
      applyPreviewAll(); updateSelInfo();
    };
    document.getElementById('rotate-clear-sel').onclick = () => {
      selected.clear();
      document.querySelectorAll('.rotate-preview-card').forEach(c => c.classList.remove('selected'));
      applyPreviewAll(); updateSelInfo();
    };

    document.getElementById('rotate-btn').onclick = async () => {
      if (!pdfFile) return;
      if (scope === 'pick' && !selected.size) return App.showToast('Select at least one page', 'error');
      try {
        App.showProgress('Rotating pages…');
        const bytes = await App.readFile(pdfFile);
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = doc.getPages();
        const { degrees } = PDFLib;
        pages.forEach((page, i) => {
          const pageNum = i + 1;
          if (scope === 'all' || selected.has(pageNum)) {
            const cur = page.getRotation().angle;
            page.setRotation(degrees((cur + angle) % 360));
          }
        });
        const outBytes = await doc.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-rotated.pdf`);
        const count = scope === 'all' ? pdfJsDoc.numPages : selected.size;
        App.showToast(`Rotated ${count} page${count !== 1 ? 's' : ''} by ${angle}°!`);
      } catch(e) {
        App.hideProgress();
        App.showToast('Rotate failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 9. WATERMARK ─── */
App.registerTool({
  id: 'watermark',
  name: 'Add Watermark',
  icon: '💧',
  category: 'edit',
  description: 'Stamp a text watermark on every page of a PDF',

  render() {
    return `
      ${App.createDropzone('wm-dz', { label: 'Drop PDF to watermark' })}
      <div id="wm-ui" style="display:none; margin-top:20px;">
        <div class="options-panel">
          <div class="option-row">
            <span class="option-label">Watermark text</span>
            <input type="text" id="wm-text" value="CONFIDENTIAL" style="max-width:320px;">
          </div>
          <div class="option-row">
            <span class="option-label">Position</span>
            <div class="option-group">
              <button class="chip active" id="wm-pos-center" onclick="WmTool.setPos('center')">Center</button>
              <button class="chip" id="wm-pos-diagonal" onclick="WmTool.setPos('diagonal')">Diagonal</button>
              <button class="chip" id="wm-pos-top" onclick="WmTool.setPos('top')">Top</button>
              <button class="chip" id="wm-pos-bottom" onclick="WmTool.setPos('bottom')">Bottom</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Font size</span>
            <div class="range-row" style="flex:1; max-width:300px;">
              <input type="range" id="wm-size" min="10" max="120" value="48">
              <span class="range-value" id="wm-size-val">48</span>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Opacity</span>
            <div class="range-row" style="flex:1; max-width:300px;">
              <input type="range" id="wm-opacity" min="5" max="100" value="20">
              <span class="range-value" id="wm-opacity-val">20%</span>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Color</span>
            <div class="option-group">
              ${[['#000000','Black'],['#808080','Gray'],['#ef4444','Red'],['#6c63ff','Violet'],['#2563eb','Blue']].map(([hex,name]) =>
                `<button class="chip" style="background:${hex};color:white;border-color:${hex};" onclick="WmTool.setColor('${hex}')" title="${name}">${name}</button>`
              ).join('')}
            </div>
          </div>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="wm-btn">💧 Apply Watermark</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, pos = 'center', color = '#808080';

    App.mountDropzone('wm-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        const pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('wm-ui').style.display = 'block';
        App.showFileInfo('wm-dz', f, pdfJsDoc.numPages);
      } catch(e) {
        App.showToast('Failed: ' + e.message, 'error');
      }
    });

    document.getElementById('wm-size').oninput = e => document.getElementById('wm-size-val').textContent = e.target.value;
    document.getElementById('wm-opacity').oninput = e => document.getElementById('wm-opacity-val').textContent = e.target.value + '%';

    window.WmTool = {
      setPos(p) {
        pos = p;
        ['center','diagonal','top','bottom'].forEach(v => document.getElementById(`wm-pos-${v}`).classList.toggle('active', v === p));
      },
      setColor(c) { color = c; }
    };

    document.getElementById('wm-btn').onclick = async () => {
      if (!pdfFile) return;
      const text = document.getElementById('wm-text').value.trim();
      if (!text) return App.showToast('Enter watermark text', 'error');
      try {
        App.showProgress('Applying watermark…');
        const bytes = await App.readFile(pdfFile);
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const opacity = parseInt(document.getElementById('wm-opacity').value) / 100;
        const size = parseInt(document.getElementById('wm-size').value);
        const hex = color.replace('#', '');
        const r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
        const col = PDFLib.rgb(r, g, b);
        const pages = doc.getPages();
        const total = pages.length;

        for (let i = 0; i < total; i++) {
          App.updateProgress((i / total) * 100, `Page ${i+1}…`);
          const page = pages[i];
          const { width, height } = page.getSize();
          const tw = font.widthOfTextAtSize(text, size);

          let x, y, rotate = 0;
          if (pos === 'center') {
            x = (width - tw) / 2; y = (height - size) / 2;
          } else if (pos === 'diagonal') {
            x = (width - tw) / 2; y = (height - size) / 2;
            rotate = Math.atan2(height, width) * (180 / Math.PI);
          } else if (pos === 'top') {
            x = (width - tw) / 2; y = height - size - 20;
          } else {
            x = (width - tw) / 2; y = 20;
          }

          page.drawText(text, {
            x, y, size, font, color: col, opacity,
            rotate: PDFLib.degrees(rotate),
          });
        }

        const outBytes = await doc.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-watermarked.pdf`);
        App.showToast('Watermark applied!');
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 10. PAGE NUMBERS ─── */
App.registerTool({
  id: 'page-numbers',
  name: 'Add Page Numbers',
  icon: '🔢',
  category: 'edit',
  description: 'Stamp page numbers on every page of a PDF',

  render() {
    return `
      ${App.createDropzone('pn-dz', { label: 'Drop PDF to add page numbers' })}
      <div id="pn-ui" style="display:none; margin-top:20px;">
        <div class="options-panel">
          <div class="option-row">
            <span class="option-label">Position</span>
            <div class="option-group">
              <button class="chip active" id="pn-pos-bc" onclick="PnTool.setPos('bottom-center')">Bottom Center</button>
              <button class="chip" id="pn-pos-bl" onclick="PnTool.setPos('bottom-left')">Bottom Left</button>
              <button class="chip" id="pn-pos-br" onclick="PnTool.setPos('bottom-right')">Bottom Right</button>
              <button class="chip" id="pn-pos-tc" onclick="PnTool.setPos('top-center')">Top Center</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Format</span>
            <div class="option-group">
              <button class="chip active" id="pn-fmt-n" onclick="PnTool.setFmt('{n}')">1</button>
              <button class="chip" id="pn-fmt-nn" onclick="PnTool.setFmt('{n} / {total}')">1 / 10</button>
              <button class="chip" id="pn-fmt-p" onclick="PnTool.setFmt('Page {n}')">Page 1</button>
              <button class="chip" id="pn-fmt-pn" onclick="PnTool.setFmt('Page {n} of {total}')">Page 1 of 10</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Start number</span>
            <input type="number" id="pn-start" value="1" min="0" class="input-sm">
          </div>
          <div class="option-row">
            <span class="option-label">Skip first N pages</span>
            <input type="number" id="pn-skip" value="0" min="0" class="input-sm">
            <span class="input-hint" style="margin:0 0 0 8px;">Useful for cover pages</span>
          </div>
          <div class="option-row">
            <span class="option-label">Font size</span>
            <div class="range-row" style="flex:1; max-width:260px;">
              <input type="range" id="pn-size" min="7" max="24" value="11">
              <span class="range-value" id="pn-size-val">11</span>
            </div>
          </div>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="pn-btn">🔢 Add Page Numbers</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, pos = 'bottom-center', fmt = '{n}';

    App.mountDropzone('pn-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        const pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('pn-ui').style.display = 'block';
        App.showFileInfo('pn-dz', f, pdfJsDoc.numPages);
      } catch(e) { App.showToast('Failed: ' + e.message, 'error'); }
    });

    document.getElementById('pn-size').oninput = e => document.getElementById('pn-size-val').textContent = e.target.value;

    window.PnTool = {
      setPos(p) {
        pos = p;
        ['bottom-center','bottom-left','bottom-right','top-center'].forEach(v => {
          const key = v.replace('-','').replace('-','');
          const el = document.querySelector(`[id^="pn-pos-"]`);
        });
        document.querySelectorAll('[id^="pn-pos-"]').forEach(el => el.classList.remove('active'));
        const map = {'bottom-center':'bc','bottom-left':'bl','bottom-right':'br','top-center':'tc'};
        document.getElementById(`pn-pos-${map[p]}`)?.classList.add('active');
      },
      setFmt(f) {
        fmt = f;
        document.querySelectorAll('[id^="pn-fmt-"]').forEach(el => el.classList.remove('active'));
        const fmtMap = {'{n}':'n','{n} / {total}':'nn','Page {n}':'p','Page {n} of {total}':'pn'};
        document.getElementById(`pn-fmt-${fmtMap[f]}`)?.classList.add('active');
      }
    };

    document.getElementById('pn-btn').onclick = async () => {
      if (!pdfFile) return;
      try {
        App.showProgress('Adding page numbers…');
        const bytes = await App.readFile(pdfFile);
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
        const fontSize = parseInt(document.getElementById('pn-size').value);
        const startNum = parseInt(document.getElementById('pn-start').value) || 1;
        const skip = parseInt(document.getElementById('pn-skip').value) || 0;
        const pages = doc.getPages();
        const total = pages.length;
        const gray = PDFLib.rgb(0.4, 0.4, 0.4);

        for (let i = 0; i < total; i++) {
          if (i < skip) continue;
          App.updateProgress(((i+1)/total)*100);
          const page = pages[i];
          const { width, height } = page.getSize();
          const num = startNum + i - skip;
          const text = fmt.replace('{n}', num).replace('{total}', total - skip);
          const tw = font.widthOfTextAtSize(text, fontSize);
          const margin = 20;

          let x, y;
          if (pos === 'bottom-center') { x = (width - tw) / 2; y = margin; }
          else if (pos === 'bottom-left') { x = margin; y = margin; }
          else if (pos === 'bottom-right') { x = width - tw - margin; y = margin; }
          else { x = (width - tw) / 2; y = height - margin - fontSize; }

          page.drawText(text, { x, y, size: fontSize, font, color: gray });
        }

        const outBytes = await doc.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-numbered.pdf`);
        App.showToast('Page numbers added!');
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 11. EDIT METADATA ─── */
App.registerTool({
  id: 'metadata',
  name: 'Edit Metadata',
  icon: '📋',
  category: 'edit',
  description: 'View and edit PDF document metadata (title, author, etc.)',

  render() {
    return `
      ${App.createDropzone('meta-dz', { label: 'Drop PDF to edit metadata' })}
      <div id="meta-ui" style="display:none; margin-top:20px;">
        <div class="options-panel">
          <div class="meta-grid">
            ${[['meta-title','Title'],['meta-author','Author'],['meta-subject','Subject'],['meta-keywords','Keywords'],['meta-creator','Creator']].map(([id,label]) => `
              <div class="meta-field">
                <label class="meta-label" for="${id}">${label}</label>
                <input type="text" id="${id}" placeholder="Enter ${label.toLowerCase()}…">
              </div>`).join('')}
          </div>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="meta-save-btn">💾 Save Metadata</button>
          <button class="btn btn-secondary" id="meta-clear-btn">Clear All</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null;
    App.mountDropzone('meta-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        App.showProgress('Reading metadata…');
        const doc = await App.loadPDFLib(f);
        document.getElementById('meta-title').value    = doc.getTitle()    || '';
        document.getElementById('meta-author').value   = doc.getAuthor()   || '';
        document.getElementById('meta-subject').value  = doc.getSubject()  || '';
        document.getElementById('meta-keywords').value = (doc.getKeywords() || []).join(', ');
        document.getElementById('meta-creator').value  = doc.getCreator()  || '';
        document.getElementById('meta-ui').style.display = 'block';
        App.showFileInfo('meta-dz', f);
        App.hideProgress();
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed: ' + e.message, 'error');
      }
    });

    document.getElementById('meta-save-btn').onclick = async () => {
      if (!pdfFile) return;
      try {
        App.showProgress('Saving metadata…');
        const doc = await App.loadPDFLib(pdfFile);
        doc.setTitle(document.getElementById('meta-title').value);
        doc.setAuthor(document.getElementById('meta-author').value);
        doc.setSubject(document.getElementById('meta-subject').value);
        const kw = document.getElementById('meta-keywords').value.split(',').map(s => s.trim()).filter(Boolean);
        doc.setKeywords(kw);
        doc.setCreator(document.getElementById('meta-creator').value);
        doc.setProducer('EZPDF');
        doc.setModificationDate(new Date());
        const outBytes = await doc.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-metadata.pdf`);
        App.showToast('Metadata saved!');
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed: ' + e.message, 'error');
      }
    };
    document.getElementById('meta-clear-btn').onclick = () => {
      ['meta-title','meta-author','meta-subject','meta-keywords','meta-creator'].forEach(id => {
        document.getElementById(id).value = '';
      });
    };
  }
});

/* ─── 12. SIGN PDF ─── */
App.registerTool({
  id: 'sign',
  name: 'Sign PDF',
  icon: '✍️',
  category: 'edit',
  description: 'Draw your signature and embed it on a PDF page',

  render() {
    return `
      ${App.createDropzone('sign-dz', { label: 'Drop PDF to sign' })}
      <div id="sign-ui" style="display:none; margin-top:20px;">
        <div class="options-panel" style="margin-bottom:16px;">
          <div class="option-row">
            <span class="option-label">Sign page</span>
            <input type="number" id="sign-page" value="1" min="1" class="input-sm">
            <span id="sign-page-total" style="font-size:13px; color:var(--text-3); margin-left:8px;"></span>
          </div>
          <div class="option-row">
            <span class="option-label">Position</span>
            <div class="option-group">
              <button class="chip active" id="sign-pos-br" onclick="SignTool.setPos('bottom-right')">Bottom Right</button>
              <button class="chip" id="sign-pos-bl" onclick="SignTool.setPos('bottom-left')">Bottom Left</button>
              <button class="chip" id="sign-pos-tr" onclick="SignTool.setPos('top-right')">Top Right</button>
              <button class="chip" id="sign-pos-c" onclick="SignTool.setPos('center')">Center</button>
            </div>
          </div>
        </div>
        <p class="section-title" style="margin-bottom:8px;">Draw your signature below</p>
        <div class="sign-wrap">
          <canvas id="sign-canvas" class="sign-canvas" width="700" height="200"></canvas>
          <div class="sign-toolbar">
            <span style="font-size:12px; color:var(--text-3); margin-right:8px;">Color:</span>
            ${[['#1a1a2e','Black'],['#1e3a8a','Blue'],['#166534','Green'],['#991b1b','Red']].map(([hex,name]) =>
              `<div class="color-dot" style="background:${hex}" onclick="SignTool.setColor('${hex}')" title="${name}"></div>`
            ).join('')}
            <span style="font-size:12px; color:var(--text-3); margin-left:12px; margin-right:6px;">Size:</span>
            <input type="range" id="sign-brush" min="1" max="10" value="3" style="width:80px">
            <div style="flex:1"></div>
            <button class="btn btn-secondary btn-sm" onclick="SignTool.clear()">Clear</button>
            <button class="btn btn-secondary btn-sm" onclick="SignTool.undo()">Undo</button>
          </div>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="sign-embed-btn">✍️ Embed Signature & Download</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, sigColor = '#1a1a2e', sigPos = 'bottom-right';
    let drawing = false, strokes = [], currentStroke = [];

    App.mountDropzone('sign-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        const pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('sign-page').max = pdfJsDoc.numPages;
        document.getElementById('sign-page-total').textContent = `of ${pdfJsDoc.numPages}`;
        document.getElementById('sign-ui').style.display = 'block';
        App.showFileInfo('sign-dz', f, pdfJsDoc.numPages);
        initCanvas();
      } catch(e) { App.showToast('Failed: ' + e.message, 'error'); }
    });

    function initCanvas() {
      const canvas = document.getElementById('sign-canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
      }

      function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        const { x, y } = getPos(e);
        currentStroke.push({ x, y });
        ctx.lineWidth = parseInt(document.getElementById('sign-brush').value) * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = sigColor;
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      function startDraw(e) {
        drawing = true;
        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        currentStroke = [{ x, y }];
      }

      function endDraw() {
        if (!drawing) return;
        drawing = false;
        strokes.push({ points: [...currentStroke], color: sigColor, width: parseInt(document.getElementById('sign-brush').value) * 2 });
        currentStroke = [];
      }

      canvas.addEventListener('mousedown', startDraw);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', endDraw);
      canvas.addEventListener('mouseleave', endDraw);
      canvas.addEventListener('touchstart', startDraw, { passive: false });
      canvas.addEventListener('touchmove', draw, { passive: false });
      canvas.addEventListener('touchend', endDraw);
    }

    function redrawAll() {
      const canvas = document.getElementById('sign-canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      for (const stroke of strokes) {
        if (!stroke.points.length) continue;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (const pt of stroke.points.slice(1)) ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      }
    }

    window.SignTool = {
      setColor(c) {
        sigColor = c;
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        event.target.classList.add('active');
      },
      setPos(p) {
        sigPos = p;
        document.querySelectorAll('[id^="sign-pos-"]').forEach(el => el.classList.remove('active'));
        const map = {'bottom-right':'br','bottom-left':'bl','top-right':'tr','center':'c'};
        document.getElementById(`sign-pos-${map[p]}`)?.classList.add('active');
      },
      clear() {
        strokes = []; currentStroke = [];
        const canvas = document.getElementById('sign-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      },
      undo() {
        strokes.pop(); redrawAll();
      }
    };

    document.getElementById('sign-embed-btn').onclick = async () => {
      if (!pdfFile) return;
      const canvas = document.getElementById('sign-canvas');
      if (strokes.length === 0) return App.showToast('Please draw your signature first', 'error');
      try {
        App.showProgress('Embedding signature…');
        const sigDataUrl = canvas.toDataURL('image/png');
        const sigBytes = App.dataUrlToBytes(sigDataUrl);
        const doc = await App.loadPDFLib(pdfFile);
        const pages = doc.getPages();
        const pageIdx = Math.max(0, Math.min(pages.length - 1, parseInt(document.getElementById('sign-page').value) - 1));
        const page = pages[pageIdx];
        const { width, height } = page.getSize();
        const sigImg = await doc.embedPng(sigBytes);
        const sigW = Math.min(200, width * 0.3);
        const sigH = sigW * (canvas.height / canvas.width);
        const margin = 20;

        let x, y;
        if (sigPos === 'bottom-right') { x = width - sigW - margin; y = margin; }
        else if (sigPos === 'bottom-left') { x = margin; y = margin; }
        else if (sigPos === 'top-right') { x = width - sigW - margin; y = height - sigH - margin; }
        else { x = (width - sigW) / 2; y = (height - sigH) / 2; }

        page.drawImage(sigImg, { x, y, width: sigW, height: sigH });
        const outBytes = await doc.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-signed.pdf`);
        App.showToast('Signature embedded!');
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed: ' + e.message, 'error');
      }
    };
  }
});
