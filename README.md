# TeleWellness

A beginner-friendly MERN mini project for professional teleconsultations and medicine-free preventive wellness education.

## Run locally

1. Install Node.js 20.19+ and MongoDB Community locally, or create a MongoDB Atlas database.
2. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, a long random `JWT_SECRET`, and unique `ADMIN_EMAIL` / `ADMIN_PASSWORD` values.
3. From the project root, run `npm install` and then `npm run dev`.
4. Open `http://localhost:5173`. The API runs at `http://localhost:5000`; check `http://localhost:5000/api/health` for database status.

Without MongoDB, the site still opens in browser-only demo mode. Login and registration require the configured API; the demo role buttons are for exploring the UI and are not authenticated accounts. Demo appointments and wellness edits remain in local browser storage.

## Included

- React, Tailwind CSS, custom responsive CSS, React Router, and Lucide icons in `client/`.
- Express REST API, MongoDB/Mongoose models, bcrypt password hashing, JWT authentication, role checks, and Socket.IO signaling in `server/`.
- Patient, professional, and admin views; professional directory/profile; appointment requests; wellness guides; admin content management; and a one-to-one WebRTC consultation interface.
- The configured administrator is created only when both admin environment variables are set and MongoDB is connected. Public registration cannot create an admin account.

## API routes

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/professionals`, `GET /api/professionals/:id`
- `POST /api/appointments`, `GET /api/appointments`, `PUT /api/appointments/:id`
- `GET /api/consultations/:id`, `POST /api/consultations/:id/notes`
- `GET /api/wellness`, `GET /api/wellness/:category`
- `GET /api/admin/users`, `PUT /api/admin/users/:id`, `GET /api/admin/appointments`, `POST /api/admin/wellness`, `PUT /api/admin/wellness/:id`, `DELETE /api/admin/wellness/:id`

## Razorpay payment setup

The payment flow uses Razorpay test mode and requires server-side verification before an appointment is marked paid.

1. Create or sign in to a Razorpay account, open **Account & Settings > API Keys**, and generate test keys.
2. Copy `server/.env.example` to `server/.env` if it is not already configured, then set:
   - `RAZORPAY_KEY_ID=rzp_test_...`
   - `RAZORPAY_KEY_SECRET=...`
   - `RAZORPAY_WEBHOOK_SECRET=...`
3. Configure the Razorpay test webhook URL as `https://your-public-api-url/api/payments/webhook` and subscribe to `payment.captured` and `payment.failed`. Use a tunnel such as ngrok for local webhook testing.
4. Install dependencies and start the application:

```powershell
npm install
npm run dev
```

5. Sign in as a patient, open the dashboard, and click **Pay Now** for an appointment.
6. Use Razorpay's test card or a test payment method. A successful test payment remains **Unpaid** until the backend signature and captured-payment checks pass, then changes to **Paid**. Closing the checkout, payment failure, or webhook failure keeps it from showing **Paid**.

Useful test cards are provided by Razorpay's test-mode dashboard. Do not use real card details. Never commit actual `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` values.

## Safety and scope

TeleWellness provides general educational wellness information and facilitates professional conversations. It does not prescribe medicines, sell or order medicines, recommend self-medication, diagnose automatically, provide emergency care, or replace professional medical diagnosis and treatment. Contact local emergency services for urgent symptoms. This college-project starter is not a production-ready healthcare system; secure deployment, privacy review, consent, and regulatory requirements need separate implementation.

The WebRTC prototype uses a public STUN server and server-mediated Socket.IO signaling. Real-world deployment should use a trusted TURN service, stronger privacy/security controls, and explicit clinical consent workflows.