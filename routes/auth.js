const express = require('express');
const bcrypt = require('bcryptjs');
const appointmentService = require('../services/appointmentService');

const router = express.Router();

function formData(body = {}) {
  return {
    patientName: (body.patientName || '').trim(),
    email: (body.email || '').trim().toLowerCase(),
  };
}

function emailIsValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function renderRegister(res, form = {}, errors = []) {
  res.render('register', { form, errors });
}

function renderLogin(res, form = {}, errors = []) {
  res.render('login', { form, errors });
}

router.get('/register', (req, res) => renderRegister(res));

router.post('/register', async (req, res) => {
  const form = formData(req.body);
  const errors = [];
  const password = req.body.password || '';
  const passwordConfirmation = req.body.passwordConfirmation || '';

  if (form.patientName.length < 2 || form.patientName.length > 80) errors.push('Please enter your name between 2 and 80 characters.');
  if (!emailIsValid(form.email)) errors.push('Please enter a valid email address.');
  if (password.length < 8) errors.push('Password must be at least 8 characters.');
  if (password !== passwordConfirmation) errors.push('Passwords do not match.');
  if (appointmentService.getUserByEmail(form.email)) errors.push('An account with that email already exists.');

  if (errors.length) return renderRegister(res, form, errors);

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = appointmentService.createUser({ ...form, passwordHash });
    req.session.user = { id: user.id, patientName: user.patientName, email: user.email, role: user.role };
    return res.redirect('/my-appointments');
  } catch (error) {
    console.error('Unable to register patient:', error);
    return renderRegister(res, form, ['We could not create your account right now. Please try again.']);
  }
});

router.get('/login', (req, res) => renderLogin(res));

router.post('/login', async (req, res) => {
  const form = formData(req.body);
  const user = appointmentService.getUserByEmail(form.email);
  const passwordMatches = user && await bcrypt.compare(req.body.password || '', user.passwordHash);

  if (!passwordMatches) return renderLogin(res, form, ['Email or password is incorrect.']);

  req.session.user = { id: user.id, patientName: user.patientName, email: user.email, role: user.role };
  return res.redirect('/my-appointments');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
