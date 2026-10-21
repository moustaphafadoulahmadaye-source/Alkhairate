const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// Set temporary storage paths before requiring backend modules
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alkheyrat-test-'));
process.env.DATA_DIR = tempDir;
process.env.DB_PATH = path.join(tempDir, 'test.db');
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long!';

const { JSDOM, VirtualConsole } = require('jsdom');
const { app } = require('../backend/server');
const db = require('../backend/db');
const seedAdmin = require('../backend/seedAdmin');
const { signToken } = require('../backend/middleware/auth');

// Ensure admin and default data exist in temp DB
seedAdmin();

// Retrieve seeded admin user for authenticated tests
const adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
const adminToken = adminUser ? signToken(adminUser) : null;

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Backend de test lancé sur ${baseUrl} avec base temporaire : ${process.env.DB_PATH}`);

  const frontendDir = path.join(__dirname, '..', 'frontend');
  const files = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));

  console.log(`\nPages trouvées dans frontend/ (${files.length} pages) :`);
  files.forEach(f => console.log(` - ${f}`));
  console.log('\n--- DÉBUT DE LA VÉRIFICATION DES PAGES ---');

  const results = [];
  let totalErrors = 0;

  // Pages to test with variations
  const testVariations = [
    ...files.map(f => ({
      file: f,
      url: `${baseUrl}/${f}`,
      isAdmin: f === 'admin.html'
    })),
    // Specific variations with query/hash parameters
    { file: 'product.html (avec slug valide)', url: `${baseUrl}/product.html?slug=cables-electriques`, isAdmin: false },
    { file: 'products.html (avec hash)', url: `${baseUrl}/products.html#materiels-electriques`, isAdmin: false },
    { file: 'order.html (avec service)', url: `${baseUrl}/order.html?service=pompe-forage`, isAdmin: false }
  ];

  for (const item of testVariations) {
    const pageErrors = [];
    const pageWarnings = [];
    const virtualConsole = new VirtualConsole();

    virtualConsole.on('error', (err) => {
      const msg = String(err);
      if (!msg.includes('Not implemented: navigation')) {
        pageErrors.push(msg);
      }
    });
    virtualConsole.on('warn', (msg) => {
      pageWarnings.push(String(msg));
    });
    virtualConsole.on('jsdomError', (err) => {
      if (!err.message.includes('Not implemented: navigation')) {
        pageErrors.push(`JSDOM: ${err.message}`);
      }
    });

    let dom;
    try {
      dom = await JSDOM.fromURL(item.url, {
        resources: 'usable',
        runScripts: 'dangerously',
        virtualConsole,
        pretendToBeVisual: true,
        beforeParse(window) {
          // Polyfill fetch for relative URLs in JSDOM
          window.fetch = (input, init) => {
            let fullUrl = input;
            if (typeof input === 'string') {
              if (input.startsWith('/')) {
                fullUrl = `${baseUrl}${input}`;
              } else if (!/^https?:\/\//i.test(input)) {
                fullUrl = `${baseUrl}/${input}`;
              }
            }
            return global.fetch(fullUrl, init);
          };

          // Mock dialogs
          window.alert = () => {};
          window.confirm = () => true;
          window.prompt = () => '1';

          // Inject admin credentials if testing admin page
          if (item.isAdmin && adminToken && adminUser) {
            window.localStorage.setItem('eaepcg_token', adminToken);
            window.localStorage.setItem('eaepcg_user', JSON.stringify({
              id: adminUser.id,
              full_name: adminUser.full_name,
              email: adminUser.email,
              role: 'admin'
            }));
          }
        }
      });

      // Provide animation polyfills
      const window = dom.window;
      if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
      }
      if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = (id) => clearTimeout(id);
      }
      if (!window.matchMedia) {
        window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      }

      // Allow async fetches and renders to complete
      await new Promise(resolve => setTimeout(resolve, 800));

      const document = dom.window.document;

      // Check if page has any element remaining stuck on "Chargement…"
      const allElements = document.querySelectorAll('*');
      const stuckElements = [];

      for (const el of allElements) {
        // Only inspect leaf or small container elements
        if (el.children.length === 0 || (el.children.length <= 3 && ['H1','H2','H3','P','SPAN','DIV'].includes(el.tagName))) {
          const text = (el.textContent || '').trim();
          if (text === 'Chargement…' || text === 'Loading…' || text === 'جاري التحميل…') {
            stuckElements.push(`<${el.tagName.toLowerCase()} id="${el.id}" class="${el.className}">: "${text}"`);
          }
        }
      }

      const isSuccess = pageErrors.length === 0 && stuckElements.length === 0;
      if (!isSuccess) totalErrors++;

      results.push({
        name: item.file,
        url: item.url,
        success: isSuccess,
        errors: pageErrors,
        warnings: pageWarnings,
        stuckLoading: stuckElements
      });

      const statusIcon = isSuccess ? '✅ PASS' : '❌ FAIL';
      console.log(`\n${statusIcon} : ${item.file}`);
      if (stuckElements.length > 0) {
        console.log(`   ⚠️ Éléments bloqués sur « Chargement… » :`);
        stuckElements.forEach(s => console.log(`     - ${s}`));
      }
      if (pageErrors.length > 0) {
        console.log(`   ⚠️ Erreurs JS (${pageErrors.length}) :`);
        pageErrors.forEach(e => console.log(`     - ${e}`));
      }
    } catch (e) {
      totalErrors++;
      console.log(`\n❌ CRASH : ${item.file} -> ${e.message}`);
      results.push({
        name: item.file,
        url: item.url,
        success: false,
        errors: [e.message],
        stuckLoading: []
      });
    } finally {
      if (dom && dom.window) {
        dom.window.close();
      }
    }
  }

  server.close();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n========================================');
  console.log(`BILAN : ${results.length} tests exécutés, ${totalErrors} échec(s).`);
  console.log('========================================\n');

  if (totalErrors > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Erreur critique :', err);
  process.exit(1);
});
