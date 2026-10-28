const express = require('express');
const appointmentService = require('../services/appointmentService');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  return next();
}

router.use(requireLogin);

router.get('/', (req, res) => {
  const appointments = appointmentService.getBookingsByEmail(req.session.user.email);
  res.render('my-appointments', { appointments });
});

router.post('/:id/cancel', (req, res) => {
  const appointmentId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(appointmentId)) return res.redirect('/my-appointments');

  // The email predicate in updateStatus is the authorization boundary.
  appointmentService.updateStatus(appointmentId, 'Cancelled', req.session.user.email);
  return res.redirect('/my-appointments');
});

module.exports = router;
