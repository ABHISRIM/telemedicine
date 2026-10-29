const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'pulseline.db'));

db.serialize(() => {
  // Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password TEXT,
      role TEXT CHECK(role IN ('patient', 'doctor', 'admin')) NOT NULL,
      address TEXT DEFAULT '',
      age INTEGER,
      gender TEXT,
      blood_group TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // OTP Table for realtime verification
  db.run(`
    CREATE TABLE IF NOT EXISTS otps (
      phone TEXT PRIMARY KEY,
      otp TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  // Doctor metadata table
  db.run(`
    CREATE TABLE IF NOT EXISTS doctor_profiles (
      id TEXT PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL,
      specialty TEXT NOT NULL,
      sub_specialty TEXT NOT NULL,
      degree TEXT NOT NULL,
      experience INTEGER NOT NULL,
      fee REAL NOT NULL,
      rating REAL DEFAULT 4.8,
      clinic TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      avail TEXT DEFAULT '{"Mon":["AM","PM"],"Tue":["AM"],"Wed":["AM","PM"],"Thu":["PM"],"Fri":["AM","PM"],"Sat":["AM"],"Sun":[]}',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Appointments table
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      doctor_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      patient_email TEXT NOT NULL,
      patient_phone TEXT,
      patient_address TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT CHECK(type IN ('video', 'clinic', 'home')) NOT NULL,
      symptoms TEXT,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('Paid', 'Pending', 'Refunded')) DEFAULT 'Paid',
      status TEXT CHECK(status IN ('upcoming', 'completed', 'cancelled')) DEFAULT 'upcoming',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id),
      FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id)
    )
  `);

  const seed = async () => {
    const adminPass = await bcrypt.hash('admin123', 10);
    const docPass = await bcrypt.hash('doc123', 10);

    db.run(
      `INSERT OR IGNORE INTO users (id, name, email, phone, password, role, address) VALUES 
      (1, 'System Administrator', 'admin@pulseline.com', '1800001100', ?, 'admin', 'PulseLine HQ'),
      (2, 'Dr. Anjali Sharma', 'anjali.sharma@pulseline.com', '9876543210', ?, 'doctor', 'Heartline Clinic, Sector 21'),
      (3, 'Dr. Vikram Rao', 'vikram.rao@pulseline.com', '9876543211', ?, 'doctor', 'Boneline Ortho Center'),
      (4, 'Dr. Meera Iyer', 'meera.iyer@pulseline.com', '9876543212', ?, 'doctor', 'Skinlight Derma Studio'),
      (5, 'Dr. Sameer Khan', 'sameer.khan@pulseline.com', '9876543213', ?, 'doctor', 'Cityline Family Clinic')`,
      [adminPass, docPass, docPass, docPass, docPass],
      function(err) {
        if (err) return;

        const docs = [
          ['DOC-101', 2, 'Cardiologist', 'Interventional Cardiology', 'MD, DM Cardiology', 12, 499, 4.9, 'Heartline Clinic, Sector 21'],
          ['DOC-102', 3, 'Orthopedic', 'Sports Injury & Joint Care', 'MS Ortho', 9, 399, 4.7, 'Boneline Ortho Center'],
          ['DOC-103', 4, 'Dermatologist', 'Cosmetic & Clinical Derma', 'MD Dermatology', 7, 349, 4.8, 'Skinlight Derma Studio'],
          ['DOC-104', 5, 'General Physician', 'Internal Medicine', 'MBBS, MD', 15, 249, 4.6, 'Cityline Family Clinic']
        ];
        docs.forEach(d => {
          db.run(`INSERT OR IGNORE INTO doctor_profiles (id, user_id, specialty, sub_specialty, degree, experience, fee, rating, clinic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, d);
        });
      }
    );
  };
  seed();
});

module.exports = db;