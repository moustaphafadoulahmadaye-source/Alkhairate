const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..', 'frontend');
const pagesJsDir = path.resolve(frontendDir, 'assets', 'js', 'pages');
if (!fs.existsSync(pagesJsDir)) fs.mkdirSync(pagesJsDir, { recursive: true });

const files = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(frontendDir, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // Specific handler cleanups
  if (file === 'lavage.html') {
    html = html.replace('onclick="alert(\'Navigation GPS non disponible pour le moment.\')"', 'id="btnDirections"');
  } else if (file === 'account.html') {
    html = html.replace(/\s*onmouseover="this\.querySelector\('\.premium-avatar-overlay'\)\.style\.opacity='1'"\s*onmouseout="this\.querySelector\('\.premium-avatar-overlay'\)\.style\.opacity='0'"/g, '');
  } else if (file === 'admin.html') {
    html = html.replace('onerror="this.src=\'assets/img/commerce.jpg\'"', '');
    html = html.replace('onclick="if(document.getElementById(\'notifDropdown\')) document.getElementById(\'notifDropdown\').style.display=\'none\'; switchToView(\'view-messages\');"', 'data-view="view-messages"');
    html = html.replace('onclick="if(document.getElementById(\'notifDropdown\')) document.getElementById(\'notifDropdown\').style.display=\'none\'; switchToView(\'view-orders\');"', 'data-view="view-orders"');
    html = html.replace('onclick="switchToView(\'view-orders\')"', 'data-view="view-orders"');
    html = html.replace('onclick="switchToView(\'view-clients\')"', 'data-view="view-clients"');
    html = html.replace('onclick="switchToView(\'view-products\')"', 'data-view="view-products"');
    html = html.replace('onclick="switchToView(\'view-messages\')"', 'data-view="view-messages"');
    html = html.replace('onerror="this.src=\'${item.defaultUrl}\'"', 'data-fallback="${item.defaultUrl}"');
    html = html.replace('onclick="selectImageForEdit(\'${item.key}\')"', 'data-edit-key="${item.key}"');
  }

  // Find inline script
  const scriptRegex = /<script(?![^>]*src=)>([\s\S]*?)<\/script>/i;
  const match = html.match(scriptRegex);
  if (!match) {
    console.log(file, 'no inline script found');
    return;
  }

  const baseName = file.replace('.html', '');
  let scriptContent = match[1].trim();

  // Add specific wiring in extracted script
  if (file === 'lavage.html') {
    scriptContent += '\n\ndocument.getElementById("btnDirections")?.addEventListener("click", (e) => {\n  e.preventDefault();\n  alert("Navigation GPS non disponible pour le moment.");\n});\n';
  } else if (file === 'account.html') {
    scriptContent += '\n\nconst avatarUpload = document.querySelector(".premium-avatar-upload");\nif (avatarUpload) {\n  const overlay = avatarUpload.querySelector(".premium-avatar-overlay");\n  if (overlay) {\n    avatarUpload.addEventListener("mouseenter", () => { overlay.style.opacity = "1"; });\n    avatarUpload.addEventListener("mouseleave", () => { overlay.style.opacity = "0"; });\n  }\n}\n';
  } else if (file === 'admin.html') {
    scriptContent += '\n\n// CSP compliance: delegated handlers and non-inline listeners\n' +
      'document.getElementById("currentImageDisplay")?.addEventListener("error", function() { this.src = "assets/img/commerce.jpg"; });\n' +
      'document.getElementById("notifDropdownList")?.addEventListener("click", (e) => {\n' +
      '  const item = e.target.closest("[data-view]");\n' +
      '  if (item) {\n' +
      '    if (document.getElementById("notifDropdown")) document.getElementById("notifDropdown").style.display = "none";\n' +
      '    switchToView(item.dataset.view);\n' +
      '  }\n' +
      '});\n' +
      'document.getElementById("dashContent")?.addEventListener("click", (e) => {\n' +
      '  const card = e.target.closest(".stat-card[data-view]");\n' +
      '  if (card) {\n' +
      '    switchToView(card.dataset.view);\n' +
      '  }\n' +
      '});\n' +
      'const galleryGrid = document.getElementById("galleryGrid");\n' +
      'if (galleryGrid) {\n' +
      '  galleryGrid.addEventListener("click", (e) => {\n' +
      '    const btn = e.target.closest("[data-edit-key]");\n' +
      '    if (btn) {\n' +
      '      selectImageForEdit(btn.dataset.editKey);\n' +
      '    }\n' +
      '  });\n' +
      '  galleryGrid.addEventListener("error", (e) => {\n' +
      '    if (e.target.tagName === "IMG" && e.target.dataset.fallback) {\n' +
      '      e.target.src = e.target.dataset.fallback;\n' +
      '    }\n' +
      '  }, true);\n' +
      '}\n';
  }

  // Write JS file
  const jsFilePath = path.join(pagesJsDir, `${baseName}.js`);
  fs.writeFileSync(jsFilePath, scriptContent + '\n', 'utf8');

  // Replace script tag in HTML
  const newHtml = html.replace(scriptRegex, `<script src="assets/js/pages/${baseName}.js"></script>`);
  fs.writeFileSync(filePath, newHtml, 'utf8');
  console.log(`Extracted ${file} -> assets/js/pages/${baseName}.js (${scriptContent.split('\n').length} lines)`);
});
