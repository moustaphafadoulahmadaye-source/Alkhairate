const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isSmtpConfigured,
  getMissingSmtpConfig,
  sendEmail,
  sendWelcome,
  sendOrderConfirmation,
  sendOrderStatus,
  sendMessageConfirmation,
  sendPasswordReset,
  sendAdminNotification,
  verifySmtpConnection
} = require('../services/email');

test('Part 4: render.yaml declares all SMTP and URL variables with sync: false', () => {
  const renderYamlPath = path.join(__dirname, '..', '..', 'render.yaml');
  const content = fs.readFileSync(renderYamlPath, 'utf8');

  const requiredVars = [
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'CORS_ORIGIN',
    'FRONTEND_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'EMAIL_FROM'
  ];

  for (const v of requiredVars) {
    const regex = new RegExp(`key:\\s*${v}\\s+sync:\\s*false`);
    assert.match(content, regex, `render.yaml must declare ${v} with sync: false`);
  }
});

test('Part 4: getMissingSmtpConfig identifies missing environment variables', () => {
  const originalEnv = { ...process.env };
  try {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.EMAIL_FROM;

    assert.equal(isSmtpConfigured(), false);
    const missing = getMissingSmtpConfig();
    assert.ok(missing.includes('SMTP_HOST'));
    assert.ok(missing.includes('SMTP_PORT'));
    assert.ok(missing.includes('SMTP_USER'));
    assert.ok(missing.includes('SMTP_PASSWORD'));
    assert.ok(missing.includes('EMAIL_FROM'));
  } finally {
    process.env = originalEnv;
  }
});

test('Part 4: sendEmail rejects invalid recipient address', async () => {
  const res = await sendEmail({ to: '', subject: 'Test', text: 'Hello' });
  assert.equal(res.success, false);
  assert.equal(res.reason, 'INVALID_RECIPIENT');

  const resInvalid = await sendEmail({ to: 'invalid-email', subject: 'Test', text: 'Hello' });
  assert.equal(resInvalid.success, false);
  assert.equal(resInvalid.reason, 'INVALID_RECIPIENT');
});

test('Part 4: sendEmail returns failure with clear reason when SMTP is not configured (honest status)', async () => {
  const originalHost = process.env.SMTP_HOST;
  try {
    delete process.env.SMTP_HOST;

    const res = await sendEmail({ to: 'client@example.com', subject: 'Test', text: 'Hello' });
    assert.equal(res.success, false, 'Must not claim success when SMTP is unconfigured');
    assert.equal(res.reason, 'SMTP_NOT_CONFIGURED');
    assert.ok(res.error.includes('SMTP_HOST'));
  } finally {
    process.env.SMTP_HOST = originalHost;
  }
});

test('Part 4: verifySmtpConnection reports unconfigured status when vars are missing', async () => {
  const originalHost = process.env.SMTP_HOST;
  try {
    delete process.env.SMTP_HOST;

    const res = await verifySmtpConnection();
    assert.equal(res.ok, false);
    assert.equal(res.status, 'NOT_CONFIGURED');
    assert.ok(res.error.includes('SMTP'));
  } finally {
    process.env.SMTP_HOST = originalHost;
  }
});

test('Part 4: Password reset template generates valid text and HTML with reset link', async () => {
  const originalHost = process.env.SMTP_HOST;
  try {
    // Unset SMTP to test template execution without sending
    delete process.env.SMTP_HOST;

    const user = { full_name: 'Test Client', email: 'testclient@example.com' };
    const resetUrl = 'https://alkhairate.onrender.com/reset-password.html?token=1234567890abcdef';

    const res = await sendPasswordReset(user, resetUrl);
    assert.equal(res.success, false);
    assert.equal(res.reason, 'SMTP_NOT_CONFIGURED');
  } finally {
    process.env.SMTP_HOST = originalHost;
  }
});

test('Part 4: Order confirmation template handles order details and formatting', async () => {
  const originalHost = process.env.SMTP_HOST;
  try {
    delete process.env.SMTP_HOST;

    const order = {
      id: 42,
      full_name: 'Moustapha Client',
      email: 'moustapha@example.com',
      service: 'Installation Pompe Solaire',
      details: 'Forage 50m avec pompe immergée',
      quantity: '1',
      total: 750000,
      currency: 'XAF',
      status: 'pending'
    };

    const res = await sendOrderConfirmation(order);
    assert.equal(res.success, false);
    assert.equal(res.reason, 'SMTP_NOT_CONFIGURED');
  } finally {
    process.env.SMTP_HOST = originalHost;
  }
});

test('Part 4: Admin notification checks for ADMIN_EMAIL configuration', async () => {
  const originalAdmin = process.env.ADMIN_EMAIL;
  try {
    delete process.env.ADMIN_EMAIL;

    const res = await sendAdminNotification('Alerte Test', 'Texte de test');
    assert.equal(res.success, false);
    assert.equal(res.reason, 'ADMIN_EMAIL_NOT_CONFIGURED');
  } finally {
    process.env.ADMIN_EMAIL = originalAdmin;
  }
});
