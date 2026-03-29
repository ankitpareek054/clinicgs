const env = require('../../config/env');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function getAppBaseUrl() {
  const explicit =
    process.env.APP_URL ||
    process.env.WEB_APP_URL ||
    (Array.isArray(env.CLIENT_ORIGIN) ? env.CLIENT_ORIGIN[0] : null);

  return (explicit || 'http://localhost:3000').replace(/\/+$/, '');
}

function joinUrl(base, path) {
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    replyTo: process.env.MAIL_REPLY_TO || env.MAIL_FROM,
    verifyOnStartup: parseBoolean(process.env.SMTP_VERIFY, false),
  };
}

let transportPromise = null;

async function getTransport() {
  if (transportPromise) {
    return transportPromise;
  }

  transportPromise = (async () => {
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (error) {
      throw new Error(
        'nodemailer is not installed. Run: npm install nodemailer'
      );
    }

    const smtp = getSmtpConfig();

    if (!smtp.host || !smtp.port || !smtp.user || !smtp.pass) {
      throw new Error(
        'SMTP is not fully configured. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS'
      );
    }

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    if (smtp.verifyOnStartup) {
      await transport.verify();
    }

    return {
      provider: 'smtp',
      transport,
      replyTo: smtp.replyTo,
    };
  })();

  return transportPromise;
}

async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!env.MAIL_ENABLED) {
    return {
      provider: 'email',
      enabled: false,
      status: 'skipped',
      message: 'Email provider is disabled in environment.',
      payload: {
        to,
        subject,
        text,
        html,
      },
    };
  }

  try {
    const { provider, transport, replyTo: defaultReplyTo } = await getTransport();

    const info = await transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      text,
      html,
      replyTo: replyTo || defaultReplyTo,
    });

    return {
      provider,
      enabled: true,
      status: 'sent',
      message: 'Email sent successfully.',
      messageId: info.messageId,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
      response: info.response,
      payload: {
        from: env.MAIL_FROM,
        to,
        subject,
      },
    };
  } catch (error) {
    return {
      provider: 'smtp',
      enabled: true,
      status: 'failed',
      message: error.message || 'Email send failed.',
      payload: {
        from: env.MAIL_FROM,
        to,
        subject,
      },
    };
  }
}

async function sendInviteEmail({
  to,
  clinicName,
  role,
  inviteToken,
  invitedByName,
}) {
  const appBaseUrl = getAppBaseUrl();
  const inviteUrl = `${joinUrl(appBaseUrl, '/accept-invite')}?token=${encodeURIComponent(inviteToken)}`;

  const safeClinicName = escapeHtml(clinicName || 'Clinic');
  const safeRole = escapeHtml(role || 'staff');
  const safeInvitedByName = invitedByName
    ? escapeHtml(invitedByName)
    : 'ClinicGS';

  const subject = `You're invited to join ${clinicName || 'ClinicGS'}`;

  const text = [
    `Hello,`,
    ``,
    `${safeInvitedByName} invited you to join ${clinicName || 'ClinicGS'} as ${role || 'staff'}.`,
    `Use the link below to set your password and activate your account:`,
    inviteUrl,
    ``,
    `This invite link will expire automatically.`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin-bottom: 8px;">You're invited to join ${safeClinicName}</h2>
      <p>${safeInvitedByName} invited you to join <strong>${safeClinicName}</strong> as <strong>${safeRole}</strong>.</p>
      <p>Click the button below to set your password and activate your account.</p>
      <p style="margin: 24px 0;">
        <a
          href="${inviteUrl}"
          style="background: #111; color: #fff; padding: 12px 18px; text-decoration: none; border-radius: 8px; display: inline-block;"
        >
          Accept invite
        </a>
      </p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>This invite link will expire automatically.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
}

async function sendPasswordResetEmail({
  to,
  fullName,
  resetToken,
}) {
  const appBaseUrl = getAppBaseUrl();
  const resetUrl = `${joinUrl(appBaseUrl, '/reset-password')}?token=${encodeURIComponent(resetToken)}`;
  const safeName = escapeHtml(fullName || 'there');

  const subject = 'Reset your ClinicGS password';

  const text = [
    `Hello ${fullName || 'there'},`,
    ``,
    `We received a request to reset your password.`,
    `Use the link below to set a new password:`,
    resetUrl,
    ``,
    `If you did not request this, you can ignore this email.`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin-bottom: 8px;">Reset your password</h2>
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your password.</p>
      <p style="margin: 24px 0;">
        <a
          href="${resetUrl}"
          style="background: #111; color: #fff; padding: 12px 18px; text-decoration: none; border-radius: 8px; display: inline-block;"
        >
          Reset password
        </a>
      </p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  sendEmail,
  sendInviteEmail,
  sendPasswordResetEmail,
};