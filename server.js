const fs = require('node:fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

const express = require('express');
const session = require('express-session');
const bookingRouter = require('./routes/booking');
const bookingSuccessRouter = require('./routes/bookingSuccess');
const receptionRouter = require('./routes/reception');
const authRouter = require('./routes/auth');
const myAppointmentsRouter = require('./routes/myAppointments');
const chatRouter = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;
const clinic = {
  name: 'Lakeside Medical Clinic',
  area: 'JLT, Dubai',
  tagline: 'Expert care, close to home',
  address: 'Cluster X, JLT, Dubai',
  phone: '+971 4 555 0198',
  hours: 'Mon–Sat: 9:00am–9:00pm',
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'local-development-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.locals.clinic = clinic;
  res.locals.user = req.session.user || null;
  next();
});

app.get('/', (req, res) => {
  res.render('index');
});

app.use('/booking', bookingRouter);
app.use('/booking-success', bookingSuccessRouter);
app.use('/reception', receptionRouter);
app.use('/', authRouter);
app.use('/my-appointments', myAppointmentsRouter);
app.use('/api/chat', chatRouter);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Lakeside Medical Clinic is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
