/* ============================================================
   tools-security.js — Encrypt PDF, Unlock PDF
   ============================================================ */

/* ─── 17. ENCRYPT PDF ─── */
App.registerTool({
  id: 'encrypt',
  name: 'Encrypt PDF',
  icon: '🔒',
  category: 'security',
  description: 'Password-protect a PDF to restrict unauthorized access',

  render() {
    return `
      ${App.createDropzone('enc-dz', { label: 'Drop PDF to encrypt' })}
      <div id="enc-ui" style="display:none; margin-top:20px;">
        <div class="options-panel">
          <div class="option-row" style="flex-direction:column; align-items:stretch; gap:8px;">
            <span class="option-label">User password (required to open)</span>
            <div class="password-wrap">
              <input type="password" id="enc-user-pw" placeholder="Enter password…" autocomplete="new-password">
              <button class="password-toggle" onclick="EncTool.togglePw('enc-user-pw','enc-eye1')" id="enc-eye1">👁</button>
            </div>
          </div>
          <div class="option-row" style="flex-direction:column; align-items:stretch; gap:8px;">
            <span class="option-label">Confirm password</span>
            <div class="password-wrap">
              <input type="password" id="enc-user-pw2" placeholder="Confirm password…" autocomplete="new-password">
              <button class="password-toggle" onclick="EncTool.togglePw('enc-user-pw2','enc-eye2')" id="enc-eye2">👁</button>
            </div>
          </div>
          <div class="divider"></div>
          <div class="option-row" style="flex-direction:column; align-items:stretch; gap:8px;">
            <span class="option-label">Owner password (optional — controls permissions)</span>
            <div class="password-wrap">
              <input type="password" id="enc-owner-pw" placeholder="Leave blank to use user password…" autocomplete="new-password">
              <button class="password-toggle" onclick="EncTool.togglePw('enc-owner-pw','enc-eye3')" id="enc-eye3">👁</button>
            </div>
          </div>
          <div class="divider"></div>
          <div class="option-row" style="align-items:flex-start; flex-direction:column; gap:8px;">
            <span class="option-label">Permissions (when opened with user password)</span>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%;">
              ${[
                ['enc-perm-print','Allow printing','true'],
                ['enc-perm-copy','Allow copying text','false'],
                ['enc-perm-modify','Allow modifying','false'],
                ['enc-perm-annot','Allow annotations','true'],
              ].map(([id,label,def]) => `
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:var(--text-2);">
                  <input type="checkbox" id="${id}" ${def==='true' ? 'checked' : ''}
                    style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;">
                  ${label}
                </label>`).join('')}
            </div>
          </div>
        </div>
        <div id="enc-strength" style="margin-top:10px; display:none;">
          <div style="display:flex; align-items:center; gap:10px; font-size:12px; color:var(--text-3);">
            <span>Password strength:</span>
            <div style="flex:1; height:4px; background:var(--surface-3); border-radius:2px; max-width:200px;">
              <div id="enc-strength-bar" style="height:100%; border-radius:2px; transition:all 0.3s; width:0%;"></div>
            </div>
            <span id="enc-strength-label"></span>
          </div>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="enc-btn">🔒 Encrypt PDF</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null;

    App.mountDropzone('enc-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;
      try {
        const pdfJsDoc = await App.loadPDFJS(f);
        document.getElementById('enc-ui').style.display = 'block';
        App.showFileInfo('enc-dz', f, pdfJsDoc.numPages);
      } catch(e) { App.showToast('Failed to load: ' + e.message, 'error'); }
    });

    // Password strength indicator
    document.getElementById('enc-user-pw').addEventListener('input', function() {
      const pw = this.value;
      const strengthEl = document.getElementById('enc-strength');
      const bar = document.getElementById('enc-strength-bar');
      const label = document.getElementById('enc-strength-label');
      if (!pw) { strengthEl.style.display = 'none'; return; }
      strengthEl.style.display = 'block';
      let score = 0;
      if (pw.length >= 8) score++;
      if (pw.length >= 12) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      const levels = [
        { pct: 20, color: '#ef4444', text: 'Very Weak' },
        { pct: 40, color: '#f59e0b', text: 'Weak' },
        { pct: 60, color: '#eab308', text: 'Fair' },
        { pct: 80, color: '#22c55e', text: 'Strong' },
        { pct: 100, color: '#6c63ff', text: 'Very Strong' },
      ];
      const lvl = levels[Math.min(score, 4)];
      bar.style.width = lvl.pct + '%';
      bar.style.background = lvl.color;
      label.textContent = lvl.text;
      label.style.color = lvl.color;
    });

    window.EncTool = {
      togglePw(inputId, btnId) {
        const inp = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? '👁' : '🙈';
      }
    };

    document.getElementById('enc-btn').onclick = async () => {
      if (!pdfFile) return;
      const pw1 = document.getElementById('enc-user-pw').value;
      const pw2 = document.getElementById('enc-user-pw2').value;
      if (!pw1) return App.showToast('Please enter a password', 'error');
      if (pw1 !== pw2) return App.showToast('Passwords do not match', 'error');
      const ownerPw = document.getElementById('enc-owner-pw').value || pw1 + '-owner';

      try {
        App.showProgress('Encrypting PDF…');
        const bytes = await App.readFile(pdfFile);
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });

        const printAllowed = document.getElementById('enc-perm-print').checked;
        const copyAllowed  = document.getElementById('enc-perm-copy').checked;
        const modifyAllowed = document.getElementById('enc-perm-modify').checked;
        const annotAllowed = document.getElementById('enc-perm-annot').checked;

        const outBytes = await doc.save({
          userPassword: pw1,
          ownerPassword: ownerPw,
          permissions: {
            printing: printAllowed ? 'highResolution' : 'none',
            modifying: modifyAllowed,
            copying: copyAllowed,
            annotating: annotAllowed,
            fillingForms: true,
            contentAccessibility: true,
            documentAssembly: false,
          }
        });

        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-encrypted.pdf`);
        App.showToast('PDF encrypted successfully!');
      } catch(e) {
        App.hideProgress();
        App.showToast('Encryption failed: ' + e.message, 'error');
      }
    };
  }
});

/* ─── 18. UNLOCK PDF ─── */
App.registerTool({
  id: 'unlock',
  name: 'Unlock PDF',
  icon: '🔓',
  category: 'security',
  description: 'Remove password protection from an encrypted PDF',

  render() {
    return `
      ${App.createDropzone('unlock-dz', { label: 'Drop encrypted PDF to unlock' })}
      <div id="unlock-ui" style="display:none; margin-top:20px;">
        <div class="options-panel">
          <div class="option-row" style="flex-direction:column; align-items:stretch; gap:8px;">
            <span class="option-label">PDF password</span>
            <div class="password-wrap">
              <input type="password" id="unlock-pw" placeholder="Enter the PDF password…" autocomplete="current-password">
              <button class="password-toggle" onclick="UnlockTool.togglePw()" id="unlock-eye">👁</button>
            </div>
          </div>
        </div>
        <div class="info-box info" style="margin-top:12px;">
          <span>ℹ</span>
          <span>The PDF will be re-saved without any password restrictions. Your original file is untouched.</span>
        </div>
        <div class="action-row" style="margin-top:16px;">
          <button class="btn btn-primary btn-lg" id="unlock-btn">🔓 Unlock & Download</button>
        </div>
      </div>
      <div id="unlock-nopass-ui" style="display:none; margin-top:20px;">
        <div class="info-box warn">
          <span>⚠</span>
          <span>This PDF does not appear to be password-protected. It will be re-saved as-is.</span>
        </div>
        <div class="action-row" style="margin-top:12px;">
          <button class="btn btn-primary" id="unlock-force-btn">Download Anyway</button>
        </div>
      </div>`;
  },

  mount() {
    let pdfFile = null, isEncrypted = false;

    App.mountDropzone('unlock-dz', async files => {
      const f = files.find(f => f.name.endsWith('.pdf'));
      if (!f) return App.showToast('Please select a PDF', 'error');
      pdfFile = f;

      // Test if encrypted
      try {
        const bytes = await App.readFile(f);
        // Try loading without password
        try {
          await PDFLib.PDFDocument.load(bytes);
          // Loaded fine — might not be encrypted or ignoreEncryption skips it
          isEncrypted = false;
          document.getElementById('unlock-ui').style.display = 'block';
          App.showFileInfo('unlock-dz', f);
        } catch(e) {
          isEncrypted = true;
          document.getElementById('unlock-ui').style.display = 'block';
          App.showFileInfo('unlock-dz', f);
        }
      } catch(e) { App.showToast('Failed to read file: ' + e.message, 'error'); }
    });

    window.UnlockTool = {
      togglePw() {
        const inp = document.getElementById('unlock-pw');
        const btn = document.getElementById('unlock-eye');
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? '👁' : '🙈';
      }
    };

    async function unlockAndSave(password) {
      App.showProgress('Unlocking PDF…');
      try {
        // Strategy 1: Try pdf-lib with password
        let doc;
        try {
          const bytes = await App.readFile(pdfFile);
          doc = await PDFLib.PDFDocument.load(bytes, {
            password: password || undefined,
            ignoreEncryption: !password
          });
        } catch(e) {
          if (!password) throw new Error('PDF is encrypted — please provide the password');
          throw new Error('Incorrect password or unable to unlock this PDF');
        }

        // Save without password
        const outBytes = await doc.save();
        App.hideProgress();
        App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-unlocked.pdf`);
        App.showToast('PDF unlocked successfully!');
      } catch(e) {
        // Fallback: use PDF.js to render and recreate
        try {
          App.updateProgress(10, 'Trying alternative method…');
          const pdfJsDoc = await App.loadPDFJS(pdfFile, password);
          const total = pdfJsDoc.numPages;
          const newDoc = await PDFLib.PDFDocument.create();

          for (let i = 1; i <= total; i++) {
            App.updateProgress((i / total) * 85, `Re-creating page ${i}…`);
            const canvas = await App.renderPageToCanvas(pdfJsDoc, i, 2.0);
            const jpegBytes = App.dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.90));
            const jpegImg = await newDoc.embedJpg(jpegBytes);
            const vp = (await pdfJsDoc.getPage(i)).getViewport({ scale: 2.0 });
            const pg = newDoc.addPage([vp.width, vp.height]);
            pg.drawImage(jpegImg, { x: 0, y: 0, width: vp.width, height: vp.height });
          }

          App.updateProgress(95, 'Saving…');
          const outBytes = await newDoc.save();
          App.hideProgress();
          App.downloadBytes(outBytes, `${App.stem(pdfFile.name)}-unlocked.pdf`);
          App.showToast('PDF unlocked (re-rendered as images)!', 'info');
        } catch(e2) {
          App.hideProgress();
          App.showToast('Could not unlock: ' + (e2.message || e.message), 'error');
        }
      }
    }

    document.getElementById('unlock-btn').onclick = async () => {
      if (!pdfFile) return;
      const pw = document.getElementById('unlock-pw').value;
      await unlockAndSave(pw);
    };

    document.getElementById('unlock-force-btn').onclick = async () => {
      if (!pdfFile) return;
      await unlockAndSave('');
    };
  }
});
