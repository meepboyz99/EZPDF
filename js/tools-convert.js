/* ============================================================
   tools-convert.js — Images to PDF, PDF to Images
   ============================================================ */

/* ─── 13. IMAGES TO PDF ─── */
App.registerTool({
  id: 'images-to-pdf',
  name: 'Images to PDF',
  icon: '🖼️',
  category: 'convert',
  description: 'Convert JPG, PNG, or WebP images into a PDF document',

  render() {
    return `
      ${App.createDropzone('img2pdf-dz', {
        multiple: true,
        accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
        label: 'Drop images here',
        sub: 'JPG, PNG, WebP — drag to reorder',
        icon: '🖼️'
      })}
      <div id="img2pdf-ui" style="display:none; margin-top:20px;">
        <div class="options-panel" style="margin-bottom:16px;">
          <div class="option-row">
            <span class="option-label">Page size</span>
            <div class="option-group">
              <button class="chip active" id="img2pdf-size-fit" onclick="Img2PdfTool.setSize('fit')">Fit Image</button>
              <button class="chip" id="img2pdf-size-a4" onclick="Img2PdfTool.setSize('A4')">A4</button>
              <button class="chip" id="img2pdf-size-letter" onclick="Img2PdfTool.setSize('Letter')">Letter</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Orientation</span>
            <div class="option-group">
              <button class="chip active" id="img2pdf-ori-auto" onclick="Img2PdfTool.setOri('auto')">Auto</button>
              <button class="chip" id="img2pdf-ori-port" onclick="Img2PdfTool.setOri('portrait')">Portrait</button>
              <button class="chip" id="img2pdf-ori-land" onclick="Img2PdfTool.setOri('landscape')">Landscape</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Margin</span>
            <div class="option-group">
              <button class="chip active" id="img2pdf-mg-none" onclick="Img2PdfTool.setMargin(0)">None</button>
              <button class="chip" id="img2pdf-mg-sm" onclick="Img2PdfTool.setMargin(20)">Small</button>
              <button class="chip" id="img2pdf-mg-md" onclick="Img2PdfTool.setMargin(40)">Medium</button>
            </div>
          </div>
        </div>
        <p class="section-title" style="margin-bottom:10px;">Images (drag to reorder)</p>
        <div id="img2pdf-preview" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; margin-bottom:16px;"></div>
        <div class="action-row">
          <button class="btn btn-primary btn-lg" id="img2pdf-btn">🖼️ Convert to PDF</button>
          <button class="btn btn-secondary btn-sm" id="img2pdf-clear">Clear All</button>
          <span id="img2pdf-count" style="font-size:12px; color:var(--text-3);"></span>
        </div>
      </div>`;
  },

  mount() {
    let images = [], pageSize = 'fit', orientation = 'auto', margin = 0;

    App.mountDropzone('img2pdf-dz', files => {
      const imgs = files.filter(f => f.type.startsWith('image/'));
      if (!imgs.length) return App.showToast('Please select image files', 'error');
      images = [...images, ...imgs];
      renderPreviews();
      document.getElementById('img2pdf-ui').style.display = 'block';
    });

    function renderPreviews() {
      const grid = document.getElementById('img2pdf-preview');
      grid.innerHTML = '';
      images.forEach((img, i) => {
        const url = URL.createObjectURL(img);
        const card = document.createElement('div');
        card.className = 'thumb-card';
        card.dataset.idx = i;
        card.innerHTML = `
          <div class="thumb-canvas-wrap" style="height:100px; overflow:hidden; background:#f0f0f0;">
            <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div class="thumb-footer" style="justify-content:space-between;">
            <span class="thumb-page-num" style="max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${img.name}">${img.name.split('.')[0]}</span>
            <button class="thumb-rotate-btn" style="color:var(--error); font-size:13px;" onclick="Img2PdfTool.remove(${i})">✕</button>
          </div>`;
        grid.appendChild(card);
      });

      if (window._imgSortable) window._imgSortable.destroy();
      window._imgSortable = new Sortable(grid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: evt => {
          const moved = images.splice(evt.oldIndex, 1)[0];
          images.splice(evt.newIndex, 0, moved);
        }
      });
      document.getElementById('img2pdf-count').textContent = `${images.length} image${images.length !== 1 ? 's' : ''}`;
    }

    window.Img2PdfTool = {
      remove(i) { images.splice(i, 1); renderPreviews(); },
      setSize(s) {
        pageSize = s;
        ['fit','A4','Letter'].forEach(v => document.getElementById(`img2pdf-size-${v.toLowerCase()}`).classList.toggle('active', v === s));
      },
      setOri(o) {
        orientation = o;
        ['auto','portrait','landscape'].forEach(v => {
          const id = `img2pdf-ori-${v === 'portrait' ? 'port' : v === 'landscape' ? 'land' : v}`;
          document.getElementById(id).classList.toggle('active', v === o);
        });
      },
      setMargin(m) {
        margin = m;
        [[0,'none'],[20,'sm'],[40,'md']].forEach(([v,k]) => document.getElementById(`img2pdf-mg-${k}`).classList.toggle('active', v === m));
      }
    };

    document.getElementById('img2pdf-clear').onclick = () => {
      images = [];
      document.getElementById('img2pdf-preview').innerHTML = '';
      document.getElementById('img2pdf-ui').style.display = 'none';
      document.getElementById('img2pdf-count').textContent = '';
    };

    document.getElementById('img2pdf-btn').onclick = async () => {
      if (!images.length) return App.showToast('Add at least one image', 'error');
      try {
        App.showProgress('Creating PDF…');
        const doc = await PDFLib.PDFDocument.create();
        const PAGE_SIZES = {
          'A4':     [595.28, 841.89],
          'Letter': [612, 792],
        };

        for (let i = 0; i < images.length; i++) {
          App.updateProgress((i / images.length) * 100, `Processing image ${i+1}…`);
          const file = images[i];
          const bytes = await App.readFile(file);

          const isJpeg = file.type === 'image/jpeg';
          let imgEmbed, imgW, imgH;

          if (isJpeg) {
            imgEmbed = await doc.embedJpg(bytes);
          } else {
            // Convert to PNG via canvas if needed
            const blob = new Blob([bytes], { type: file.type });
            const url = URL.createObjectURL(blob);
            const img = await new Promise((res, rej) => {
              const el = new Image();
              el.onload = () => res(el);
              el.onerror = rej;
              el.src = url;
            });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            const pngData = App.dataUrlToBytes(canvas.toDataURL('image/png'));
            imgEmbed = await doc.embedPng(pngData);
            URL.revokeObjectURL(url);
          }

          const { width: iW, height: iH } = imgEmbed.scale(1);
          imgW = iW; imgH = iH;

          let pgW, pgH;
          if (pageSize === 'fit') {
            pgW = imgW + margin * 2;
            pgH = imgH + margin * 2;
          } else {
            [pgW, pgH] = PAGE_SIZES[pageSize];
          }

          // Orientation
          let finalW = pgW, finalH = pgH;
          if (orientation === 'landscape' || (orientation === 'auto' && imgW > imgH)) {
            [finalW, finalH] = [Math.max(pgW, pgH), Math.min(pgW, pgH)];
          } else if (orientation === 'portrait' || orientation === 'auto') {
            [finalW, finalH] = [Math.min(pgW, pgH), Math.max(pgW, pgH)];
          }

          const page = doc.addPage([finalW, finalH]);
          const avW = finalW - margin * 2;
          const avH = finalH - margin * 2;
          const scale = Math.min(avW / imgW, avH / imgH);
          const dW = imgW * scale, dH = imgH * scale;
          const x = margin + (avW - dW) / 2;
          const y = margin + (avH - dH) / 2;

          page.drawImage(imgEmbed, { x, y, width: dW, height: dH });
        }

        const outBytes = await doc.save();
        App.hideProgress();
        App.downloadBytes(outBytes, 'images-converted.pdf');
        App.showToast(`Converted ${images.length} image${images.length !== 1 ? 's' : ''} to PDF!`);
      } catch(e) {
        App.hideProgress();
        App.showToast('Conversion failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 14. PDF TO IMAGES ─── */
App.registerTool({
  id: 'pdf-to-images',
  name: 'PDF to Images',
  icon: '📸',
  category: 'convert',
  description: 'Export each PDF page as a PNG or JPEG image',

  render() {
    return `
      ${App.createDropzone('pdf2img-dz', { label: 'Drop PDF to export as images' })}
      <div id="pdf2img-ui" style="display:none; margin-top:20px;">
        <div class="options-panel" style="margin-bottom:16px;">
          <div class="option-row">
            <span class="option-label">Format</span>
            <div class="option-group">
              <button class="chip active" id="pdf2img-fmt-png" onclick="Pdf2ImgTool.setFmt('png')">PNG</button>
              <button class="chip" id="pdf2img-fmt-jpg" onclick="Pdf2ImgTool.setFmt('jpeg')">JPEG</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Quality / Scale</span>
            <div class="option-group">
              <button class="chip" id="pdf2img-q-low" onclick="Pdf2ImgTool.setScale(1.0)">72 DPI</button>
              <button class="chip active" id="pdf2img-q-med" onclick="Pdf2ImgTool.setScale(2.0)">150 DPI</button>
              <button class="chip" id="pdf2img-q-hi" onclick="Pdf2ImgTool.setScale(3.0)">300 DPI</button>
            </div>
          </div>
          <div id="pdf2img-pages-opt" class="option-row">
            <span class="option-label">Pages</span>
            <div class="option-group">
              <button class="chip active" id="pdf2img-pg-all" onclick="Pdf2ImgTool.setPages('all')">All Pages</button>
              <button class="chip" id="pdf2img-pg-range" onclick="Pdf2ImgTool.setPages('range')">Custom Range</button>
            </div>
          </div>
          <div id="pdf2img-range-row" class="option-row" style="display:none;">
            <span class="option-label">Page range</span>
            <input type="text" id="pdf2img-range" placeholder="e.g. 1-5, 8, 10" style="max-width:220px;">
          </div>
        </div>
        <div id="pdf2img-preview-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:10px; margin-bottom:16px; max-height:400px; overflow-y:auto;"></div>
        <div class="action-row">
          <button class="btn btn-primary btn-lg" id="pdf2img-btn">📸 Export & Download ZIP</button>
          <span id="pdf2img-info" style="font-size:12px; color:var(--text-3);"></span>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, pdfJsDoc = null, format = 'png', scale = 2.0, pagesMode = 'all';

    App.mountDropzone('pdf2img-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        App.showProgress('Loading PDF…');
        pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('pdf2img-ui').style.display = 'block';
        document.getElementById('pdf2img-info').textContent = `${pdfJsDoc.numPages} pages`;
        App.showFileInfo('pdf2img-dz', f, pdfJsDoc.numPages);
        await renderPreviews();
        App.hideProgress();
      } catch(e) {
        App.hideProgress();
        App.showToast('Failed: ' + e.message, 'error');
      }
    });

    async function renderPreviews() {
      const grid = document.getElementById('pdf2img-preview-grid');
      grid.innerHTML = '';
      const total = pdfJsDoc.numPages;
      for (let i = 1; i <= Math.min(total, 12); i++) {
        App.updateProgress((i / Math.min(total, 12)) * 100);
        const canvas = await App.renderPageToCanvas(pdfJsDoc, i, 0.3);
        const wrap = document.createElement('div');
        wrap.className = 'thumb-card';
        wrap.innerHTML = `<div class="thumb-canvas-wrap"></div>
          <div class="thumb-footer"><span class="thumb-page-num">Page ${i}</span></div>`;
        wrap.querySelector('.thumb-canvas-wrap').appendChild(canvas);
        grid.appendChild(wrap);
      }
      if (total > 12) {
        const more = document.createElement('div');
        more.style.cssText = 'display:flex;align-items:center;justify-content:center;background:var(--surface-3);border-radius:var(--radius);border:1px solid var(--border);font-size:13px;color:var(--text-3);padding:20px;';
        more.textContent = `+${total - 12} more pages`;
        grid.appendChild(more);
      }
    }

    window.Pdf2ImgTool = {
      setFmt(f) {
        format = f;
        ['png','jpeg'].forEach(v => document.getElementById(`pdf2img-fmt-${v === 'jpeg' ? 'jpg' : v}`).classList.toggle('active', v === f));
      },
      setScale(s) {
        scale = s;
        [[1.0,'low'],[2.0,'med'],[3.0,'hi']].forEach(([v,k]) => document.getElementById(`pdf2img-q-${k}`).classList.toggle('active', v === s));
      },
      setPages(m) {
        pagesMode = m;
        ['all','range'].forEach(v => document.getElementById(`pdf2img-pg-${v}`).classList.toggle('active', v === m));
        document.getElementById('pdf2img-range-row').style.display = m === 'range' ? 'flex' : 'none';
      }
    };

    document.getElementById('pdf2img-btn').onclick = async () => {
      if (!pdfFile) return;
      try {
        const total = pdfJsDoc.numPages;
        const pageNums = pagesMode === 'range'
          ? App.parsePageRanges(document.getElementById('pdf2img-range').value, total)
          : Array.from({ length: total }, (_, i) => i + 1);

        if (!pageNums.length) return App.showToast('No valid pages selected', 'error');

        App.showProgress('Exporting images…');
        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const ext = format === 'png' ? 'png' : 'jpg';
        const zipFiles = [];

        for (let i = 0; i < pageNums.length; i++) {
          const n = pageNums[i];
          App.updateProgress((i / pageNums.length) * 100, `Rendering page ${n}…`);
          const canvas = await App.renderPageToCanvas(pdfJsDoc, n, scale);
          const dataUrl = canvas.toDataURL(mime, 0.92);
          zipFiles.push({
            name: `page-${String(n).padStart(3,'0')}.${ext}`,
            data: App.dataUrlToBytes(dataUrl)
          });
        }

        await App.downloadZip(zipFiles, `${App.stem(pdfFile.name)}-images.zip`);
        App.hideProgress();
        App.showToast(`Exported ${zipFiles.length} image${zipFiles.length !== 1 ? 's' : ''}!`);
      } catch(e) {
        App.hideProgress();
        App.showToast('Export failed: ' + e.message, 'error');
      }
    };
  }
});
