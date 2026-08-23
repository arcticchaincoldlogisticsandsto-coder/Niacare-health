# NiaCare Health

**NiaCare Health** is a mobile-first onboarding, identity, and patient-dashboard interface for a Tanzania-focused digital health platform. It gives both **local residents** (NIDA / NHIF / birth certificate) and **international visitors** (passport / travel insurance) a single hybrid registration flow, then hands them a digital health passport with appointment booking, emergency dispatch, prescriptions, and medical records.

This is currently a **frontend-only, fully-mocked prototype**: there is no backend, database, or real SMS/AI/payment integration. All OTP codes, AI replies, dispatch confirmations, and doctor data are simulated in-memory and reset on page reload.

---

## Key Features

### Onboarding & Identity
- **Hybrid registration**: toggle between *Locals* (NIDA number, NHIF/insurance, or birth certificate) and *Internationals* (passport, nationality, travel insurance).
- **Dual-channel OTP verification**: phone or email, with an in-page "incoming SMS/email" banner that auto-fills the code.
- **Biometric step-up** (simulated): fingerprint / Face ID modal.
- **PDPA (Tanzania Personal Data Protection Act) consent modal**, required before submission.
- On success, a **Digital Health Passport** is generated with a QR check-in code.

### Patient Home Dashboard
- Digital Health Passport card (patient identity, blood type, insurance badge, QR code, PDF export).
- Upcoming appointment card with queue number and room, or a prompt to book one.
- Prescription reminder with 1-tap "mark as taken" and refill requests.
- Quick-action grid: appointments, checkout/billing, prescriptions, medical records, personal file vault, insurance & claims, nearby facilities, and an AI symptom-triage chat (canned responses, not a live model).
- Medical records list with per-record and full-passport **PDF export** (`jspdf`).

### Emergency Dispatch
- 1-tap ambulance dispatch bar with GPS auto-locate, a triage condition picker (trauma, cardiac, respiratory, maternity, unconscious), nearby-hospital ETAs, and a simulated dispatch countdown/confirmation with a mock dispatch ID.

### Appointment Booking
- Browse 8+ seeded Tanzanian doctors across major hospitals (Muhimbili, Aga Khan, KCMC, Bugando, etc.), filterable by specialty, hospital, NHIF acceptance, and telehealth availability.
- Book in-person, telehealth, or home-visit consultations with date/slot selection, visit reason, and insurance vs. mobile-money payment.
- Confirmed booking produces a ticket + queue number + QR pass; telehealth appointments can join a simulated video call room.

### Platform
- Light/dark theme toggle.
- Multi-language UI (English / Swahili / French) via a central translations dictionary.
- Settings modal for language, theme, biometric, and account info.

---

## Tech Stack

- **React 19 + TypeScript**, built with **Vite 6**.
- **Tailwind CSS v4** (via `@tailwindcss/vite`) for styling.
- **lucide-react** for icons, **motion** for animation.
- **jspdf** for client-side PDF generation (medical records & health passport).
- No backend: `express`, `dotenv`, and `@google/genai` are present in `package.json` as leftovers from the AI Studio export template but are currently unused.

---

## Project Structure

```text
src/
├── App.tsx                     # Root state machine: auth flow, theme, language, modals
├── main.tsx                    # React entrypoint
├── types.ts                    # Shared TypeScript types (form data, user category, etc.)
├── index.css                   # Tailwind entry + global styles
├── components/
│   ├── IdentityCard.tsx         # Local/International registration form
│   ├── TwoFactorSecurity.tsx    # 2FA channel selection + OTP trigger
│   ├── HomeOtpVerification.tsx  # In-page OTP entry screen
│   ├── OtpModal.tsx             # Modal variant of OTP entry
│   ├── SmsNotificationBanner.tsx# Simulated incoming SMS/email banner
│   ├── BiometricModal.tsx       # Fingerprint / Face ID simulation
│   ├── PdpaConsentModal.tsx     # Data protection consent
│   ├── RegistrationModal.tsx    # Locals vs Internationals chooser
│   ├── SuccessPassportModal.tsx # Post-auth success screen
│   ├── PatientHomeDashboard.tsx # Main authenticated dashboard
│   ├── AppointmentBookingModal.tsx # Doctor browse + booking wizard + video room
│   ├── CheckoutProcedureModal.tsx  # Billing/checkout procedure
│   ├── MedicalRecordsModal.tsx  # Full medical records browser
│   ├── EmergencyBar.tsx         # 1-tap ambulance dispatch
│   ├── Header.tsx, TrustBar.tsx, SettingsModal.tsx, LanguageSelectorModal.tsx
│   ├── BloodTypeSelector.tsx, DateOfBirthSelector.tsx
├── data/
│   ├── doctors.ts                # Seeded doctors, hospitals, specialties, appointments
│   ├── medicalRecords.ts         # Seeded medical records
│   ├── insurance.ts              # Tanzania insurance providers
│   ├── countries.ts              # Countries, dial codes, nearby hospitals
│   ├── languages.ts              # Supported UI languages
│   └── translations.ts           # EN/SW/FR translation dictionary
└── utils/
    ├── dateUtils.ts               # DOB formatting, ISO date helpers
    └── pdfGenerator.ts            # jsPDF record & passport generation
```

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev       # starts Vite on http://localhost:3000
npm run lint       # TypeScript type-check (tsc --noEmit)
npm run build      # production build
npm run preview    # preview the production build
```

No environment variables are required to run the app locally — `.env.example` documents `GEMINI_API_KEY` and `APP_URL`, which are injected automatically when hosted in Google AI Studio but are not currently consumed by any code.

---

## Known Limitations (prototype state)

- No backend/API — all data (appointments, records, OTP codes) lives in React state and is lost on refresh.
- OTP codes and AI triage replies are hardcoded, not sent/generated for real.
- "Emergency dispatch" and "telehealth video call" are UI simulations only.
- `express`, `dotenv`, and `@google/genai` are unused dependencies.
