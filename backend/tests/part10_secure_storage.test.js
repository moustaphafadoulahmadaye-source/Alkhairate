const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const apiJsPath = path.join(__dirname, '..', '..', 'frontend', 'assets', 'js', 'api.js');
const apiJsCode = fs.readFileSync(apiJsPath, 'utf8');

function createMockContext({ isNative = false }) {
  const localStorageStore = {};
  const secureStorageStore = {};
  const preferencesStore = {};

  const context = {
    console: {
      warn: () => {},
      error: () => {},
      log: () => {}
    },
    localStorage: {
      getItem: (k) => (k in localStorageStore ? localStorageStore[k] : null),
      setItem: (k, v) => { localStorageStore[k] = String(v); },
      removeItem: (k) => { delete localStorageStore[k]; },
      clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
    },
    location: {
      protocol: 'http:',
      href: 'http://localhost/'
    },
    fetch: async () => ({ ok: true, json: async () => ({}) })
  };

  context.window = context;

  if (isNative) {
    context.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SecureStoragePlugin: {
          get: async ({ key }) => ({ value: secureStorageStore[key] || null }),
          set: async ({ key, value }) => { secureStorageStore[key] = String(value); return { value: true }; },
          remove: async ({ key }) => { delete secureStorageStore[key]; return { value: true }; },
          clear: async () => { Object.keys(secureStorageStore).forEach(k => delete secureStorageStore[k]); return { value: true }; }
        },
        Preferences: {
          get: async ({ key }) => ({ value: preferencesStore[key] || null }),
          set: async ({ key, value }) => { preferencesStore[key] = String(value); return { value: true }; },
          remove: async ({ key }) => { delete preferencesStore[key]; return { value: true }; }
        }
      }
    };
  } else {
    context.Capacitor = undefined;
  }

  vm.createContext(context);
  vm.runInContext(apiJsCode, context);

  return {
    context,
    localStorageStore,
    secureStorageStore,
    preferencesStore
  };
}

test('Part 10 (Secure Storage): Web mode writes token to localStorage', () => {
  const { context, localStorageStore, secureStorageStore } = createMockContext({ isNative: false });
  const Auth = context.Auth;

  const testUser = { id: 42, email: 'web@example.com', role: 'customer' };
  const testToken = 'web-jwt-token-12345';

  Auth.setSession(testToken, testUser);

  assert.equal(localStorageStore['eaepcg_token'], testToken, 'Web mode must store token in localStorage');
  assert.equal(Auth.getToken(), testToken);
  assert.deepEqual(Auth.getUser(), testUser);
  assert.equal(Object.keys(secureStorageStore).length, 0, 'SecureStorage must not be touched in web mode');

  Auth.clear();
  assert.equal(localStorageStore['eaepcg_token'], undefined, 'localStorage must be cleared on Auth.clear()');
  assert.equal(Auth.getToken(), null);
});

test('Part 10 (Secure Storage): Native mobile mode stores token ONLY in SecureStoragePlugin (Keychain/Keystore)', async () => {
  const { context, localStorageStore, secureStorageStore, preferencesStore } = createMockContext({ isNative: true });
  const Auth = context.Auth;

  const testUser = { id: 99, email: 'native@example.com', role: 'customer' };
  const testToken = 'super-secret-native-jwt-token-keychain';

  Auth.setSession(testToken, testUser);

  // CRITICAL REQUIREMENT: Native mode must NOT write token to localStorage
  assert.equal(
    localStorageStore['eaepcg_token'],
    undefined,
    'SECURITY REQUIREMENT: In native mode, token MUST NOT be written to localStorage'
  );

  // CRITICAL REQUIREMENT: Native mode must NOT write token to Preferences
  assert.equal(
    preferencesStore['eaepcg_token'],
    undefined,
    'SECURITY REQUIREMENT: In native mode, token MUST NOT be written to @capacitor/preferences'
  );

  // Token must be stored securely in SecureStoragePlugin
  assert.equal(
    secureStorageStore['eaepcg_token'],
    testToken,
    'Native mode must store token securely in SecureStoragePlugin (Keychain/Keystore)'
  );

  // Fast memory cache provides token synchronously
  assert.equal(Auth.getToken(), testToken);
  assert.deepEqual(Auth.getUser(), testUser);

  // Test clearing session
  Auth.clear();
  assert.equal(secureStorageStore['eaepcg_token'], undefined, 'Token must be removed from SecureStoragePlugin on logout');
  assert.equal(Auth.getToken(), null);
});

test('Part 10 (Secure Storage): Native mode initializes credentials from SecureStorage on launch', async () => {
  const { context, secureStorageStore } = createMockContext({ isNative: true });
  const Auth = context.Auth;

  // Pre-seed Keychain / Keystore data
  secureStorageStore['eaepcg_token'] = 'persisted-keychain-token-abc';
  secureStorageStore['eaepcg_user'] = JSON.stringify({ id: 10, email: 'persisted@test.com', role: 'customer' });

  await Auth.init();

  assert.equal(Auth.getToken(), 'persisted-keychain-token-abc');
  assert.equal(Auth.getUser()?.email, 'persisted@test.com');
  assert.equal(Auth.isLoggedIn(), true);
});
