const express = require('express');
const Stripe = require('stripe');
const appointmentService = require('../services/appointmentService');

const router = express.Router();

const doctorsBySpecialty = {
  'General Physician': 'Dr. Sara Ahmed',
  ENT: 'Dr. Omar Khan',
  Dentist: 'Dr. Lina Haddad',
  Cardiologist: 'Dr. Raj Mehta',
};

const timeSlots = Array.from({ length: 25 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

function dubaiToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function bookingData(body = {}, req) {
  return {
    specialty: body.specialty || '',
    doctor: body.doctor || '',
    date: body.date || '',
    time: body.time || '',
    patientName: body.patientName || '',
    phone: body.phone || '',
    email: req?.session?.user?.email || body.email || '',
  };
}

function validateBooking(booking) {
  const errors = [];
  const today = dubaiToday();

  if (!Object.prototype.hasOwnProperty.call(doctorsBySpecialty, booking.specialty)) {
    errors.push('Please choose a valid specialty.');
  }
  if (doctorsBySpecialty[booking.specialty] !== booking.doctor) {
    errors.push('Please choose the doctor assigned to that specialty.');
  }
  if (!validDate(booking.date)) {
    errors.push('Please choose a valid appointment date.');
  } else {
    const date = new Date(`${booking.date}T00:00:00Z`);
    if (booking.date < today) errors.push('Appointment dates cannot be in the past.');
    if (date.getUTCDay() === 0) errors.push('The clinic is closed on Sundays.');
  }
  if (!timeSlots.includes(booking.time)) errors.push('Please choose a valid 30-minute time slot.');
  if (!booking.patientName || booking.patientName.length < 2 || booking.patientName.length > 80) {
    errors.push('Please enter a patient name between 2 and 80 characters.');
  }
  if (!/^\+?[0-9 ()-]{7,20}$/.test(booking.phone)) errors.push('Please enter a valid phone number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) errors.push('Please enter a valid email address.');

  return errors;
}

function renderBooking(res, options = {}) {
  res.render('booking', {
    specialties: Object.keys(doctorsBySpecialty),
    doctorsBySpecialty,
    timeSlots,
    minDate: dubaiToday(),
    booking: options.booking || bookingData({}, res.req),
    errors: options.errors || [],
    confirmed: options.confirmed || false,
  });
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sk_test_')) {
    throw new Error('Stripe test mode is not configured.');
  }
  return new Stripe(secretKey);
}

function getBaseUrl() {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) throw new Error('BASE_URL is not configured.');
  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('BASE_URL must use HTTP or HTTPS.');
  }
  return parsed.origin;
}

router.get('/', (req, res) => renderBooking(res, { booking: bookingData({}, req) }));

router.post('/', async (req, res) => {
  const booking = bookingData(req.body, req);
  const errors = validateBooking(booking);

  if (errors.length) return renderBooking(res, { booking, errors });

  try {
    const savedBooking = appointmentService.createBooking({
      specialty: booking.specialty,
      doctor: booking.doctor,
      appointmentDateTime: `${booking.date}T${booking.time}:00`,
      patientName: booking.patientName,
      patientPhone: booking.phone,
      patientEmail: booking.email,
      status: 'Pending',
    });

    try {
      const stripe = getStripeClient();
      const baseUrl = getBaseUrl();
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: booking.email,
        client_reference_id: String(savedBooking.id),
        metadata: { appointmentId: String(savedBooking.id) },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'aed',
            unit_amount: 10000,
            product_data: {
              name: 'Refundable consultation deposit',
              description: 'AED 100 refundable deposit for your clinic consultation.',
            },
          },
        }],
        success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/booking`,
      });

      appointmentService.setStripeSessionId(savedBooking.id, checkoutSession.id);
      return res.redirect(303, checkoutSession.url);
    } catch (error) {
      console.error('Unable to start Stripe Checkout.');
      return res.status(503).render('booking-success', {
        paid: false,
        booking: savedBooking,
        message: 'Your appointment request was saved as Pending, but checkout could not be started. Please contact the clinic and mention your booking ID before submitting another request.',
      });
    }
  } catch (error) {
    console.error('Unable to save appointment:', error);
    return renderBooking(res, {
      booking,
      errors: ['We could not save your appointment right now. Please try again.'],
    });
  }
});

module.exports = router;
