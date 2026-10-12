const nodemailer = require('nodemailer');

const configured = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASSWORD &&
  process.env.EMAIL_FROM
);

const transporter = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    })
  : null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.warn('Email notification skipped: SMTP is not configured.');
    return false;
  }
  try {
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    console.warn('Email sending failed (check SMTP credentials in .env):', err.message);
    return false;
  }
}

function detailsFor(order) {
  return [
    `Service / products: ${order.service || '—'}`,
    `Details: ${order.details || '—'}`,
    `Quantity: ${order.quantity || '—'}`,
    `Total: ${order.total == null || order.total === '' ? '—' : `${order.total} ${order.currency || 'XAF'}`}`,
    `Status: ${order.status || 'pending'}`
  ].join('\n');
}

function orderHtml(order, greeting) {
  return `<p>${escapeHtml(greeting)}</p><h2>Order #${escapeHtml(order.id)}</h2>
    <p><strong>Date:</strong> ${escapeHtml(order.created_at)}</p>
    <p><strong>Customer:</strong> ${escapeHtml(order.full_name || '')}</p>
    <p><strong>Service / products:</strong> ${escapeHtml(order.service || '—')}</p>
    <p><strong>Details:</strong> ${escapeHtml(order.details || '—')}</p>
    <p><strong>Quantity:</strong> ${escapeHtml(order.quantity || '—')}</p>
    <p><strong>Total:</strong> ${escapeHtml(order.total == null || order.total === '' ? '—' : `${order.total} ${order.currency || 'XAF'}`)}</p>
    <p><strong>Status:</strong> ${escapeHtml(order.status || 'pending')}</p>`;
}

async function sendWelcome(user) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to EAEPCG',
    text: `Hello ${user.full_name},\n\nWelcome to EAEPCG. Your account has been created.`,
    html: `<p>Hello ${escapeHtml(user.full_name)},</p><p>Welcome to EAEPCG. Your account has been created.</p>`
  });
}

async function sendOrderConfirmation(order) {
  return sendEmail({
    to: order.email,
    subject: `Order confirmation #${order.id}`,
    text: `Hello ${order.full_name},\n\nYour order was received.\n\n${detailsFor(order)}`,
    html: orderHtml(order, `Hello ${order.full_name}, your order was received.`)
  });
}

async function sendOrderStatus(order) {
  return sendEmail({
    to: order.email,
    subject: `Order #${order.id} status: ${order.status}`,
    text: `Hello ${order.full_name},\n\nYour order status changed.\n\n${detailsFor(order)}`,
    html: orderHtml(order, `Hello ${order.full_name}, your order status changed.`)
  });
}

async function sendMessageConfirmation(message) {
  return sendEmail({
    to: message.email,
    subject: 'We received your message',
    text: `Hello ${message.full_name},\n\nWe received your message${message.subject ? `: ${message.subject}` : ''}.`,
    html: `<p>Hello ${escapeHtml(message.full_name)},</p><p>We received your message${message.subject ? `: ${escapeHtml(message.subject)}` : ''}.</p>`
  });
}

async function sendPasswordReset(user, resetUrl) {
  return sendEmail({
    to: user.email,
    subject: 'Reset your EAEPCG password',
    text: `Hello ${user.full_name},\n\nUse this link to create a new password. It expires in one hour and can only be used once:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hello ${escapeHtml(user.full_name)},</p><p>Use this link to create a new password. It expires in one hour and can only be used once:</p><p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p><p>If you did not request this, you can ignore this email.</p>`
  });
}

async function sendAdminNotification(subject, text) {
  if (!process.env.ADMIN_EMAIL) {
    console.warn('Admin email notification skipped: ADMIN_EMAIL is not configured.');
    return false;
  }
  return sendEmail({ to: process.env.ADMIN_EMAIL, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` });
}

function notify(task, description) {
  Promise.resolve()
    .then(task)
    .catch((error) => console.error(`Email notification failed (${description}):`, error.message));
}

module.exports = {
  sendWelcome,
  sendOrderConfirmation,
  sendOrderStatus,
  sendMessageConfirmation,
  sendPasswordReset,
  sendAdminNotification,
  notify
};
