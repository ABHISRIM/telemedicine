const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = 'pulseline_master_secret_jwt_2026';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Session expired' });
    req.user = user;
    next();
  });
};

// --- REALTIME PHONE + OTP AUTHENTICATION ---

// Step 1: Send OTP to Phone
app.post('/api/auth/otp/send', (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
  }

  // Generate 6-digit OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins validity

  db.run(
    `INSERT OR REPLACE INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)`,
    [phone, generatedOtp, expiresAt],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to generate OTP' });
      
      // In real production, connect SMS gateways like Twilio/Fast2SMS here.
      console.log(`\n================================`);
      console.log(`📲 REALTIME OTP FOR ${phone}: [ ${generatedOtp} ]`);
      console.log(`================================\n`);

      res.json({ 
        message: 'OTP sent successfully', 
        debugOtp: generatedOtp // Provided for direct UI testing/auto-fill
      });
    }
  );
});

// Step 2: Verify OTP
app.post('/api/auth/otp/verify', (req, res) => {
  const { phone, otp } = req.body;
  
  db.get(`SELECT * FROM otps WHERE phone = ?`, [phone], (err, record) => {
    if (err || !record) return res.status(400).json({ error: 'No OTP requested for this number' });
    if (Date.now() > record.expires_at) return res.status(400).json({ error: 'OTP has expired. Please request a new one' });
    if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP entered' });

    // Remove consumed OTP
    db.run(`DELETE FROM otps WHERE phone = ?`, [phone]);

    // Check if user already exists
    db.get(`SELECT * FROM users WHERE phone = ?`, [phone], (err2, user) => {
      if (err2) return res.status(500).json({ error: 'Database lookup error' });

      if (user) {
        const token = jwt.sign(
          { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        return res.json({ isNewUser: false, token, user });
      } else {
        // Flag user as needing details completion
        return res.json({ isNewUser: true, phone });
      }
    });
  });
});

// Step 3: Complete Registration for New Phone Users
app.post('/api/auth/patient/onboard', (req, res) => {
  const { phone, name, email, address, age, gender, blood_group } = req.body;
  if (!phone || !name || !email) {
    return res.status(400).json({ error: 'Name, Phone and Email are mandatory' });
  }

  db.run(
    `INSERT INTO users (name, email, phone, role, address, age, gender, blood_group) VALUES (?, ?, ?, 'patient', ?, ?, ?, ?)`,
    [name, email.toLowerCase(), phone, address || '', age || null, gender || '', blood_group || ''],
    function (err) {
      if (err) return res.status(400).json({ error: 'Email or phone already registered' });
      
      const user = { 
        id: this.lastID, 
        name, 
        email: email.toLowerCase(), 
        phone, 
        role: 'patient', 
        address, 
        age, 
        gender, 
        blood_group 
      };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      
      io.emit('data_updated');
      res.json({ token, user });
    }
  );
});

// --- DOCTOR & ADMIN PASSWORD LOGIN ---
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  
  let query = `SELECT u.*, dp.id as doc_table_id FROM users u LEFT JOIN doctor_profiles dp ON u.id = dp.user_id WHERE u.email = ?`;
  db.get(query, [email.toLowerCase()], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
    if (user.role !== role) return res.status(403).json({ error: `Not authorized as a ${role}` });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: 'Invalid credentials' });

    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      doctorId: user.doc_table_id || null,
      phone: user.phone,
      address: user.address
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: tokenPayload });
  });
});

// --- DOCTOR & APPOINTMENTS DATA ---
app.get('/api/doctors', (req, res) => {
  db.all(
    `SELECT dp.*, u.name, u.email, u.phone 
     FROM doctor_profiles dp 
     JOIN users u ON dp.user_id = u.id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const formatted = rows.map(r => ({ ...r, avail: JSON.parse(r.avail) }));
      res.json(formatted);
    }
  );
});

app.get('/api/appointments', authenticateToken, (req, res) => {
  let query = `
    SELECT a.*, dp.specialty, u.name as doctorName
    FROM appointments a
    JOIN doctor_profiles dp ON a.doctor_id = dp.id
    JOIN users u ON dp.user_id = u.id
  `;
  const params = [];

  if (req.user.role === 'patient') {
    query += ` WHERE a.patient_id = ? ORDER BY a.created_at DESC`;
    params.push(req.user.id);
  } else if (req.user.role === 'doctor') {
    query += ` WHERE a.doctor_id = ? ORDER BY a.created_at DESC`;
    params.push(req.user.doctorId);
  } else {
    query += ` ORDER BY a.created_at DESC`;
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/appointments', authenticateToken, (req, res) => {
  const { doctor_id, date, time, type, symptoms, amount, payment_method, patient_phone, patient_address } = req.body;
  const apptId = 'APT-' + Math.floor(1000 + Math.random() * 9000);
  const payment_status = payment_method === 'Pay at clinic' ? 'Pending' : 'Paid';

  db.run(
    `INSERT INTO appointments (id, patient_id, doctor_id, patient_name, patient_email, patient_phone, patient_address, date, time, type, symptoms, amount, payment_method, payment_status, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?)`,
    [apptId, req.user.id, doctor_id, req.user.name, req.user.email, patient_phone || req.user.phone, patient_address || req.user.address, date, time, type, symptoms, amount, payment_method, payment_status, Date.now()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('data_updated');
      res.json({ appointmentId: apptId });
    }
  );
});

app.patch('/api/appointments/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const payment_status = status === 'cancelled' ? 'Refunded' : undefined;

  let query = `UPDATE appointments SET status = ?` + (payment_status ? `, payment_status = ?` : ``) + ` WHERE id = ?`;
  const params = payment_status ? [status, payment_status, req.params.id] : [status, req.params.id];

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('data_updated');
    res.json({ message: 'Status updated' });
  });
});

// Profile Management
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get(`SELECT * FROM users WHERE id = ?`, [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

app.put('/api/profile', authenticateToken, (req, res) => {
  const { name, phone, address, age, gender, blood_group } = req.body;
  db.run(
    `UPDATE users SET name = ?, phone = ?, address = ?, age = ?, gender = ?, blood_group = ? WHERE id = ?`,
    [name, phone, address, age, gender, blood_group, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('data_updated');
      res.json({ message: 'Profile updated' });
    }
  );
});

// Admin Metrics
app.get('/api/admin/metrics', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const metrics = {};
  db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'patient'`, (err, r1) => {
    metrics.patients = r1.count;
    db.get(`SELECT COUNT(*) as count FROM doctor_profiles WHERE active = 1`, (err, r2) => {
      metrics.doctors = r2.count;
      db.get(`SELECT COUNT(*) as total, SUM(amount) as revenue FROM appointments WHERE payment_status = 'Paid'`, (err, r3) => {
        metrics.total_appointments = r3.total || 0;
        metrics.revenue = r3.revenue || 0;
        res.json(metrics);
      });
    });
  });
});

io.on('connection', () => {});

server.listen(PORT, () => {
  console.log(`PulseLine backend running at http://localhost:${PORT}`);
});