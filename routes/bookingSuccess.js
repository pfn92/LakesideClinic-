const express = require('express');
const Stripe = require('stripe');
const appointmentService = require('../services/appointmentService');
const emailService = require('../services/emailService');

const router = express.Router();

router.get('/', async (req, res) => {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : '';
  if (!sessionId || sessionId.length > 255) {
    return res.status(400).render('booking-success', {
      paid: false,
      booking: null,
      message: 'Payment was not completed. Return to booking to try again.',
    });
  }

  const booking = appointmentService.getBookingByStripeSessionId(sessionId);
  if (!booking) {
    return res.status(404).render('booking-success', {
      paid: false,
      booking: null,
      message: 'We could not match this checkout to an appointment. Payment has not been confirmed.',
    });
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || !secretKey.startsWith('sk_test_')) {
      throw new Error('Stripe test mode is not configured.');
    }

    const stripe = new Stripe(secretKey);
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = checkoutSession.id === booking.stripeSessionId
      && checkoutSession.payment_status === 'paid';
    const confirmedBooking = isPaid ? appointmentService.markPaid(booking.id) : booking;
    if (isPaid && confirmedBooking.status === 'Booked') {
      await emailService.sendAppointmentConfirmation(confirmedBooking);
    }

    return res.render('booking-success', {
      paid: isPaid && confirmedBooking.status === 'Booked',
      booking: confirmedBooking,
      message: isPaid && confirmedBooking.status === 'Booked'
        ? 'Your deposit is paid and your appointment is confirmed.'
        : 'Payment was not completed. Your appointment remains Pending.',
    });
  } catch (error) {
    console.error('Unable to verify Stripe Checkout payment.');
    return res.status(503).render('booking-success', {
      paid: false,
      booking,
      message: 'We could not verify your payment right now. Your appointment remains Pending; please refresh this page in a moment or contact the clinic.',
    });
  }
});

module.exports = router;
