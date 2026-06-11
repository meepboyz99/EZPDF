/* ============================================================
   tools-optimize.js — Compress PDF, Convert to Grayscale
   ============================================================ */

/* ─── 15. COMPRESS PDF ─── */
App.registerTool({
  id: 'compress',
  name: 'Compress PDF',
  icon: '🗜️',
  category: 'optimize',
  description: 'Reduce PDF file size by resampling pages as compressed images',

  render() {
    return `
      ${App.createDropzone('comp-dz', { label: 'Drop PDF to compress' })}
      <div class="info-box warn" style="margin-top:12px;">
        <span>⚠</span>
        <span>Compression works by rasterizing pages. Text quality may be reduced. Best for image-heavy PDFs.</span>
      </div>
      <div id="comp-ui" style="display:none; margin-top:16px;">
        <div class="options-panel">
          <div class="option-row">
            <span class="option-label">Compression preset</span>
            <div class="option-group">
              <button class="chip" id="comp-q-screen" onclick="CompTool.setPreset('screen')">Screen (72 DPI)</button>
              <button class="chip active" id="comp-q-ebook" onclick="CompTool.setPreset('ebook')">eBook (96 DPI)</button>
              <button class="chip" id="comp-q-print" onclick="CompTool.setPreset('print')">Print (150 DPI)</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">JPEG quality</span>
            <div class="range-row" style="flex:1; max-width:300px;">
              <input type="range" id="comp-quality" min="10" max="95" value="65">
              <span class="range-value" id="comp-quality-val">65%</span>
            </div>
          </div>
        </div>
        <div id="comp-size-info" style="margin-top:12px; display:none;">
          <div class="info-box success">
            <span>✓</span>
            <div>
              <strong id="comp-result-text"></strong>
              <div style="font-size:11px; margin-top:3px; opacity:0.8;" id="comp-result-sub"></div>
            </div>
          </div>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="comp-btn">🗜️ Compress & Download</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, scale = 4/3, quality = 0.65; // scale: 96/72 = 4/3

    const presets = {
      screen: { scale: 1.0, quality: 0.45 },
      ebook:  { scale: 4/3, quality: 0.65 },
      print:  { scale: 2.0, quality: 0.82 },
    };

    App.mountDropzone('comp-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        const pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('comp-ui').style.display = 'block';
        App.showFileInfo('comp-dz', f, pdfJsDoc.numPages);
      } catch(e) { App.showToast('Failed: ' + e.message, 'error'); }
    });

    document.getElementById('comp-quality').oninput = e => {
      quality = e.target.value / 100;
      document.getElementById('comp-quality-val').textContent = e.target.value + '%';
    };

    window.CompTool = {
      setPreset(p) {
        const pr = presets[p];
        scale = pr.scale; quality = pr.quality;
        document.getElementById('comp-quality').value = Math.round(pr.quality * 100);
        document.getElementById('comp-quality-val').textContent = Math.round(pr.quality * 100) + '%';
        ['screen','ebook','print'].forEach(v => document.getElementById(`comp-q-${v}`).classList.toggle('active', v === p));
      }
    };

    document.getElementById('comp-btn').onclick = async () => {
      if (!pdfFile) return;
      try {
        App.showProgress('Compressing PDF…', 'Rasterizing pages…');
        const pdfJsDoc = await App.loadPDFJS(pdfFile);
        const total = pdfJsDoc.numPages;
        const newDoc = await PDFLib.PDFDocument.create();

        for (let i = 1; i <= total; i++) {
          App.updateProgress(((i-1)/total)*90, `Compressing page ${i} of ${total}…`);
          const page = await pdfJsDoc.getPage(i);
          const vp = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(vp.width);
          canvas.height = Math.round(vp.height);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
          const jpegBytes = App.dataUrlToBytes(jpegDataUrl);
          const jpegImg = await newDoc.embedJpg(jpegBytes);
          const pg = newDoc.addPage([vp.width, vp.height]);
          pg.drawImage(jpegImg, { x: 0, y: 0, width: vp.width, height: vp.height });
        }

        App.updateProgress(95, 'Saving…');
        const outBytes = await newDoc.save();
        const origSize = pdfFile.size;
        const newSize = outBytes.byteLength;
        const reduction = ((1 - newSize / origSize) * 100).toFixed(1);

        // Show size comparison
        const infoEl = document.getElementById('comp-size-info');
        infoEl.style.display = 'block';
        if (newSize < origSize) {
          document.getElementById('comp-result-text').textContent = `Reduced by ${reduction}%`;
          document.getElementById('comp-result-sub').textContent = `${App.formatBytes(origSize)} → ${App.formatBytes(newSize)}`;
          infoEl.querySelector('.info-box').className = 'info-box success';
        } else {
          document.getElementById('comp-result-text').textContent = `File is already optimized`;
          document.getElementById('comp-result-sub').textContent = `Original: ${App.formatBytes(origSize)} | Result: ${App.formatBytes(newSize)} — try a lower quality setting`;
          infoEl.querySelector('.info-box').className = 'info-box warn';
        }

        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-compressed.pdf`);
        App.showToast(newSize < origSize ? `Compressed by ${reduction}%!` : 'PDF processed (no reduction possible)');
      } catch(e) {
        App.hideProgress();
        App.showToast('Compression failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 16. GRAYSCALE PDF ─── */
App.registerTool({
  id: 'grayscale',
  name: 'Grayscale PDF',
  icon: '🎨',
  category: 'optimize',
  description: 'Convert a color PDF to grayscale for printing or size reduction',

  render() {
    return `
      ${App.createDropzone('gray-dz', { label: 'Drop PDF to convert to grayscale' })}
      <div class="info-box info" style="margin-top:12px;">
        <span>ℹ</span>
        <span>Pages are rendered and converted to grayscale. Text and vector content will be rasterized.</span>
      </div>
      <div id="gray-ui" style="display:none; margin-top:16px;">
        <div class="options-panel">
          <div class="option-row">
            <span class="option-label">Output quality</span>
            <div class="option-group">
              <button class="chip" id="gray-q-lo" onclick="GrayTool.setScale(1.0)">Draft</button>
              <button class="chip active" id="gray-q-med" onclick="GrayTool.setScale(1.5)">Standard</button>
              <button class="chip" id="gray-q-hi" onclick="GrayTool.setScale(2.5)">High</button>
            </div>
          </div>
          <div class="option-row">
            <span class="option-label">Contrast boost</span>
            <div class="range-row" style="flex:1; max-width:300px;">
              <input type="range" id="gray-contrast" min="-50" max="50" value="0">
              <span class="range-value" id="gray-contrast-val">0</span>
            </div>
          </div>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="gray-btn">🎨 Convert to Grayscale</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, grayScale = 1.5;

    App.mountDropzone('gray-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        const pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('gray-ui').style.display = 'block';
        App.showFileInfo('gray-dz', f, pdfJsDoc.numPages);
      } catch(e) { App.showToast('Failed: ' + e.message, 'error'); }
    });

    document.getElementById('gray-contrast').oninput = e => {
      document.getElementById('gray-contrast-val').textContent = e.target.value;
    };

    window.GrayTool = {
      setScale(s) {
        grayScale = s;
        [['lo',1.0],['med',1.5],['hi',2.5]].forEach(([k,v]) =>
          document.getElementById(`gray-q-${k}`).classList.toggle('active', v === s)
        );
      }
    };

    document.getElementById('gray-btn').onclick = async () => {
      if (!pdfFile) return;
      try {
        App.showProgress('Converting to grayscale…');
        const pdfJsDoc = await App.loadPDFJS(pdfFile);
        const total = pdfJsDoc.numPages;
        const newDoc = await PDFLib.PDFDocument.create();
        const contrast = parseInt(document.getElementById('gray-contrast').value);

        for (let i = 1; i <= total; i++) {
          App.updateProgress(((i-1)/total)*90, `Processing page ${i} of ${total}…`);
          const page = await pdfJsDoc.getPage(i);
          const vp = page.getViewport({ scale: grayScale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(vp.width);
          canvas.height = Math.round(vp.height);
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: vp }).promise;

          // Apply grayscale
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let j = 0; j < data.length; j += 4) {
            let gray = 0.299 * data[j] + 0.587 * data[j+1] + 0.114 * data[j+2];
            // Apply contrast
            if (contrast !== 0) {
              const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
              gray = factor * (gray - 128) + 128;
              gray = Math.max(0, Math.min(255, gray));
            }
            data[j] = data[j+1] = data[j+2] = gray;
          }
          ctx.putImageData(imgData, 0, 0);

          const jpegBytes = App.dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.85));
          const jpegImg = await newDoc.embedJpg(jpegBytes);
          const pg = newDoc.addPage([vp.width, vp.height]);
          pg.drawImage(jpegImg, { x: 0, y: 0, width: vp.width, height: vp.height });
        }

        App.updateProgress(98, 'Saving…');
        const outBytes = await newDoc.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-grayscale.pdf`);
        App.showToast('Converted to grayscale!');
      } catch(e) {
        App.hideProgress();
        App.showToast('Conversion failed: ' + e.message, 'error');
      }
    };
  }
});
