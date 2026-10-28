const express = require('express');
const appointmentService = require('../services/appointmentService');
const emailService = require('../services/emailService');

const router = express.Router();

function requireReceptionAccess(req, res, next) {
  if (!req.session.user) return res.redirect('/login');

  if (req.session.user.role !== 'reception') {
    return res.status(403).send('Reception access is restricted to reception staff.');
  }

  return next();
}

router.use(requireReceptionAccess);

router.get('/', (req, res) => {
  const reminderState = req.query.reminder;
  const today = getDubaiToday();
  const appointments = appointmentService.getBookingsByDate(today);
  const appointmentsByDoctor = appointments.reduce((groups, appointment) => {
    if (!groups[appointment.doctor]) groups[appointment.doctor] = [];
    groups[appointment.doctor].push(appointment);
    return groups;
  }, {});

  res.render('reception', {
    appointmentsByDoctor,
    appointmentCount: appointments.length,
    today,
    notice: reminderState === 'sent'
      ? 'Reminder email sent.'
      : reminderState === 'failed'
        ? 'Reminder email could not be sent. Check the SMTP configuration and server log.'
        : null,
    noticeType: reminderState === 'sent' ? 'success' : 'warning',
  });
});

router.post('/:id/status', (req, res) => {
  const appointmentId = Number.parseInt(req.params.id, 10);
  const allowedStatuses = new Set(['Arrived', 'Done', 'No-show']);
  const status = String(req.body.status || '');
  if (!Number.isSafeInteger(appointmentId) || appointmentId < 1 || !allowedStatuses.has(status)) {
    return res.status(400).send('Invalid appointment status update.');
  }

  const result = appointmentService.updateAppointmentStatusById(appointmentId, status);
  if (!result.changes) return res.status(404).send('Appointment not found.');
  return res.redirect(303, '/reception');
});

router.post('/:id/reminder', async (req, res) => {
  const appointmentId = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) {
    return res.status(400).send('Invalid appointment ID.');
  }

  const booking = appointmentService.getAppointmentById(appointmentId);
  if (!booking) return res.status(404).send('Appointment not found.');

  const sent = await emailService.sendAppointmentReminder(booking);
  return res.redirect(303, `/reception?reminder=${sent ? 'sent' : 'failed'}`);
});

module.exports = router;

function getDubaiToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
