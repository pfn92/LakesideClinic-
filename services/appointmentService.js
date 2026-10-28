const db = require('../data/db');

const insertUser = db.prepare(`
  INSERT INTO users (patientName, email, passwordHash)
  VALUES (?, ?, ?)
`);

const selectUserByEmail = db.prepare(`
  SELECT id, patientName, email, passwordHash, role, createdAt
  FROM users
  WHERE email = ?
`);

const insertBooking = db.prepare(`
  INSERT INTO appointments (
    specialty,
    doctor,
    appointmentDateTime,
    patientName,
    patientPhone,
    patientEmail,
    status
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const selectBookingById = db.prepare(`
  SELECT id, specialty, doctor, appointmentDateTime, patientName,
         patientPhone, patientEmail, status, stripeSessionId, confirmationEmailSentAt, createdAt
  FROM appointments
  WHERE id = ?
`);

const selectBookingsByEmail = db.prepare(`
  SELECT id, specialty, doctor, appointmentDateTime, patientName,
         patientPhone, patientEmail, status, stripeSessionId, confirmationEmailSentAt, createdAt
  FROM appointments
  WHERE patientEmail = ?
  ORDER BY createdAt DESC, id DESC
`);

const selectBookingsByDate = db.prepare(`
  SELECT id, specialty, doctor, appointmentDateTime, patientName,
         patientPhone, patientEmail, status, stripeSessionId, confirmationEmailSentAt, createdAt
  FROM appointments
  WHERE appointmentDateTime LIKE ?
  ORDER BY appointmentDateTime ASC
`);

const selectAppointmentById = db.prepare(`
  SELECT id, specialty, doctor, appointmentDateTime, patientName,
         patientPhone, patientEmail, status, stripeSessionId, confirmationEmailSentAt, createdAt
  FROM appointments
  WHERE id = ?
`);

const updateAppointmentStatus = db.prepare(`
  UPDATE appointments
  SET status = ?
  WHERE id = ?
`);

const selectBookedAppointments = db.prepare(`
  SELECT id, patientName, appointmentDateTime, specialty, doctor, patientEmail
  FROM appointments
  WHERE status = 'Booked'
  ORDER BY appointmentDateTime ASC, id ASC
`);

const selectBookedAppointmentById = db.prepare(`
  SELECT id, patientName, appointmentDateTime, specialty, doctor, patientEmail
  FROM appointments
  WHERE id = ? AND status = 'Booked'
`);

const updateBookingStatus = db.prepare(`
  UPDATE appointments
  SET status = ?
  WHERE id = ? AND patientEmail = ?
`);

const updateStripeSessionId = db.prepare(`
  UPDATE appointments
  SET stripeSessionId = ?
  WHERE id = ?
`);

const selectBookingByStripeSessionId = db.prepare(`
  SELECT id, specialty, doctor, appointmentDateTime, patientName,
         patientPhone, patientEmail, status, stripeSessionId, confirmationEmailSentAt, createdAt
  FROM appointments
  WHERE stripeSessionId = ?
`);

const markBookingPaid = db.prepare(`
  UPDATE appointments
  SET status = 'Booked'
  WHERE id = ?
`);

function createUser({ patientName, email, passwordHash }) {
  const result = insertUser.run(patientName, email, passwordHash);
  return db.prepare(`
    SELECT id, patientName, email, role, createdAt
    FROM users
    WHERE id = ?
  `).get(result.lastInsertRowid);
}

function getUserByEmail(email) {
  return selectUserByEmail.get(email);
}

function createBooking({ specialty, doctor, appointmentDateTime, patientName, patientPhone, patientEmail, status = 'Booked' }) {
  const result = insertBooking.run(
    specialty,
    doctor,
    appointmentDateTime,
    patientName,
    patientPhone,
    patientEmail,
    status,
  );

  return selectBookingById.get(result.lastInsertRowid);
}

function getBookingsByEmail(email) {
  return selectBookingsByEmail.all(email);
}

function getBookingsByDate(date) {
  return selectBookingsByDate.all(`${date}%`);
}

function getAppointmentById(id) {
  return selectAppointmentById.get(id);
}

function updateAppointmentStatusById(id, status) {
  const result = updateAppointmentStatus.run(status, id);
  return {
    changes: result.changes,
    appointment: result.changes ? selectAppointmentById.get(id) : undefined,
  };
}

function getBookedAppointments() {
  return selectBookedAppointments.all();
}

function getBookedAppointmentById(id) {
  return selectBookedAppointmentById.get(id);
}

function updateStatus(id, status, patientEmail) {
  const result = updateBookingStatus.run(status, id, patientEmail);
  return {
    changes: result.changes,
    booking: result.changes ? selectBookingById.get(id) : undefined,
  };
}

function setStripeSessionId(id, sessionId) {
  updateStripeSessionId.run(sessionId, id);
  return selectBookingById.get(id);
}

function getBookingByStripeSessionId(sessionId) {
  return selectBookingByStripeSessionId.get(sessionId);
}

function markPaid(id) {
  markBookingPaid.run(id);
  return selectBookingById.get(id);
}

module.exports = {
  createUser,
  getUserByEmail,
  createBooking,
  getBookingsByEmail,
  getBookingsByDate,
  getAppointmentById,
  updateAppointmentStatusById,
  getBookedAppointments,
  getBookedAppointmentById,
  updateStatus,
  setStripeSessionId,
  getBookingByStripeSessionId,
  markPaid,
};
