const nodemailer = require('nodemailer');
const db = require('../data/db');

const clinicName = 'Lakeside Medical Clinic';
const clinicArea = 'JLT, Dubai';
const clinicAddress = 'Cluster X, JLT, Dubai';
const sendingAppointmentIds = new Set();
let transporter;

function smtpSettings() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromAddress = process.env.SMTP_FROM;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535
    || !user || !pass || !fromAddress) {
    throw new Error('SMTP configuration is incomplete or invalid.');
  }

  return { host, port, user, pass, fromAddress };
}

function getTransporter(settings) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.port === 465,
      auth: {
        user: settings.user,
        pass: settings.pass,
      },
    });
  }
  return transporter;
}

function messageFrom(settings) {
  return settings.fromAddress.includes('<')
    ? settings.fromAddress
    : { name: clinicName, address: settings.fromAddress };
}

function appointmentDateAndTime(booking) {
  const [date = '', rawTime = ''] = String(booking.appointmentDateTime || '').split('T');
  return { date, time: rawTime.slice(0, 5) };
}

async function deliver({ to, subject, text }) {
  const settings = smtpSettings();
  await getTransporter(settings).sendMail({
    from: messageFrom(settings),
    to,
    subject,
    text,
  });
}

async function sendAppointmentConfirmation(booking) {
  const appointmentId = String(booking.id);
  if (sendingAppointmentIds.has(appointmentId)) return false;

  sendingAppointmentIds.add(appointmentId);
  try {
    const existing = db.prepare(`
      SELECT confirmationEmailSentAt
      FROM appointments
      WHERE id = ?
    `).get(booking.id);
    if (!existing || existing.confirmationEmailSentAt) return false;

    const { date, time } = appointmentDateAndTime(booking);
    await deliver({
      to: booking.patientEmail,
      subject: 'Your appointment is confirmed',
      text: [
        `Hello ${booking.patientName},`,
        '',
        'Your consultation deposit is paid and your appointment is confirmed.',
        '',
        `Specialty: ${booking.specialty}`,
        `Doctor: ${booking.doctor}`,
        `Date: ${date}`,
        `Time: ${time}`,
        `Clinic address: ${clinicAddress}`,
        '',
        `${clinicName} · built at Paul`,
      ].join('\n'),
    });

    const sentAt = new Date().toISOString();
    db.prepare(`
      UPDATE appointments
      SET confirmationEmailSentAt = ?
      WHERE id = ? AND confirmationEmailSentAt IS NULL
    `).run(sentAt, booking.id);
    return true;
  } catch (error) {
    console.error('Unable to send appointment confirmation email:', error.message || error);
    return false;
  } finally {
    sendingAppointmentIds.delete(appointmentId);
  }
}

async function sendAppointmentReminder(booking) {
  try {
    const { date, time } = appointmentDateAndTime(booking);
    await deliver({
      to: booking.patientEmail,
      subject: 'Reminder: your appointment',
      text: [
        `Hi ${booking.patientName}, a reminder that your ${booking.specialty} appointment with ${booking.doctor} is on ${date} at ${time} at ${clinicName}, ${clinicArea}. Reply to reschedule.`,
        '',
        'Powered by London International · lisrc.ae · built by Paul',
      ].join('\n'),
    });
    return true;
  } catch (error) {
    console.error('Unable to send appointment reminder email:', error.message || error);
    return false;
  }
}

module.exports = { sendAppointmentConfirmation, sendAppointmentReminder };
