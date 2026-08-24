# NiaCare Health

**NiaCare Health** is a mobile-first onboarding, identity, and patient-dashboard app for a Tanzania-focused digital health platform. It gives both **local residents** (NIDA / NHIF / birth certificate) and **international visitors** (passport / travel insurance) a single hybrid registration flow, then hands them a digital health passport with real appointment booking, billing, medical records, prescriptions, and an AI symptom-triage assistant.

Live at **https://niacare-health.vercel.app**.

This is a real full-stack app: **Supabase** (Postgres + Auth) for persistence and authentication, and a **Groq**-powered LLM behind a Vercel Serverless Function for AI triage. There is no in-memory mock data — every patient's registration, appointments, bills, medical records, prescriptions, and personal files are real rows scoped to their account via Postgres Row Level Security.

---

## Key Features

### Onboarding & Identity
- **Hybrid registration**: toggle between *Locals* (NIDA number, NHIF/insurance, or birth certificate) and *Internationals* (passport, nationality, travel insurance).
- **Real Supabase Auth**: phone or email OTP, backed by an actual SMS/email provider. Sessions persist across reloads.
- **Biometric step-up** (UI simulation): fingerprint / Face ID modal, available from Settings.
- **PDPA (Tanzania Personal Data Protection Act) consent modal**, required before submission.
- On success, a **Digital Health Passport** is generated with a QR check-in code, and a real `profiles` row is created/updated in Supabase.

### Patient Home Dashboard
- Digital Health Passport card (real patient identity, blood type, insurance, QR code, PDF export).
- Upcoming appointment card, sourced from the patient's real `appointments`.
- Prescription reminder with 1-tap "mark as taken" and refill requests — persisted, empty state for new patients with no prescriptions yet.
- Quick-action grid: appointments, checkout/billing, prescriptions, medical records, personal file vault, insurance & claims, nearby facilities, and **NiaAI**, a real Groq LLM-backed symptom-triage chat.
- Medical records list with per-record and full-passport **PDF export** (`jspdf`), sourced from real `medical_records`.

### Emergency Dispatch
- 1-tap ambulance dispatch bar with live GPS capture and a triage condition picker (trauma, cardiac, respiratory, maternity, unconscious). Deliberately works **without login** (an emergency shouldn't be gated behind auth) and creates a real, auditable `emergency_dispatches` row with the captured location/condition/timestamp. The dispatch countdown, hospital ETA numbers, and ambulance routing itself remain UI simulation — there's no real dispatch network to route to.

### Appointment Booking
- Browse 8+ seeded Tanzanian doctors across major hospitals (Muhimbili, Aga Khan, KCMC, Bugando, etc.), filterable by specialty, hospital, NHIF acceptance, and telehealth availability.
- Book in-person, telehealth, or home-visit consultations with date/slot selection, visit reason, and insurance vs. mobile-money payment.
- Confirmed booking creates a real `appointments` row **and** a real `bills` invoice for the visit. Telehealth video call is still a UI simulation (no WebRTC infrastructure).

### Checkout & Billing
- Settle a real pending invoice via insurance claim or cash/mobile money.
- Settlement updates the `bills` row to `settled` and generates a real `medical_records` entry for the completed visit — Insurance and Medical Records pages both reflect the same real transaction.

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
- **Supabase** (`@supabase/supabase-js`) — Postgres database + Auth (phone/email OTP), Row Level Security on every table.
- **Groq** (`openai/gpt-oss-120b`) — real LLM triage chat, called from a Vercel Serverless Function (`api/triage.ts`) so the API key never reaches the browser.
- **Vercel** — hosting + auto-deploy on push to `main`, plus the one serverless API route.

---

## Project Structure

```text
api/
└── triage.ts                    # Vercel Serverless Function: proxies chat to Groq, holds GROQ_API_KEY server-side
src/
├── App.tsx                      # Root state machine: auth flow (real Supabase), theme, language, modals
├── main.tsx                     # React entrypoint
├── types.ts                     # Shared TypeScript types (form data, user category, etc.)
├── index.css                    # Tailwind entry + global styles
├── lib/                         # Supabase-backed data access layer
│   ├── supabaseClient.ts         # Supabase client (anon key only, client-safe)
│   ├── auth.ts                   # OTP send/verify, profile upsert/fetch/map
│   ├── appointments.ts           # Appointment CRUD
│   ├── bills.ts                  # Bill CRUD, settlement
│   ├── records.ts                # Medical records + personal files CRUD
│   ├── prescriptions.ts          # Prescription CRUD
│   └── emergency.ts              # Emergency dispatch creation (works unauthenticated)
├── components/
│   ├── IdentityCard.tsx          # Local/International registration form
│   ├── TwoFactorSecurity.tsx     # 2FA channel selection + real OTP trigger
│   ├── HomeOtpVerification.tsx   # In-page OTP entry + verification screen
│   ├── OtpModal.tsx              # Modal variant of OTP entry (legacy, unused in main flow)
│   ├── BiometricModal.tsx        # Fingerprint / Face ID simulation
│   ├── PdpaConsentModal.tsx      # Data protection consent
│   ├── RegistrationModal.tsx     # Locals vs Internationals chooser
│   ├── SuccessPassportModal.tsx  # Post-auth success screen
│   ├── PatientHomeDashboard.tsx  # Main authenticated dashboard
│   ├── AppointmentBookingModal.tsx # Doctor browse + booking wizard + video room
│   ├── CheckoutProcedureModal.tsx  # Real billing/checkout, settles bills, generates records
│   ├── MedicalRecordsModal.tsx   # Real medical records + personal files vault
│   ├── PrescriptionsModal.tsx    # Real prescriptions list
│   ├── InsuranceModal.tsx        # Real settled-claims history
│   ├── FacilitiesModal.tsx       # Hospital directory (real catalog, static content)
│   ├── AiTriageModal.tsx         # NiaAI chat — calls /api/triage
│   ├── QrPassportModal.tsx       # QR check-in code
│   ├── EmergencyBar.tsx          # 1-tap ambulance dispatch (real dispatch record)
│   ├── Header.tsx, TrustBar.tsx, SettingsModal.tsx, LanguageSelectorModal.tsx
│   └── BloodTypeSelector.tsx, DateOfBirthSelector.tsx
├── data/
│   ├── doctors.ts                # Seeded doctors, hospitals, specialties (app content)
│   ├── medicalRecords.ts         # Type defs + sample seed data (unused at runtime now)
│   ├── insurance.ts              # Tanzania insurance providers
│   ├── countries.ts              # Countries, dial codes, nearby hospitals
│   ├── languages.ts              # Supported UI languages
│   └── translations.ts           # EN/SW/FR translation dictionary
└── utils/
    ├── dateUtils.ts               # DOB formatting, ISO date helpers
    └── pdfGenerator.ts            # jsPDF record & passport generation

supabase/
└── schema.sql                    # Full Postgres schema + RLS policies (run in Supabase SQL Editor)
```

---

## Getting Started

**Prerequisites:** Node.js 18+, a Supabase project, a Groq API key (for AI triage).

```bash
npm install
```

1. Run [supabase/schema.sql](supabase/schema.sql) in your Supabase project's SQL Editor (safe to re-run).
2. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — from Supabase → Settings → API. **Required** — the app throws on startup without them.
   - `GROQ_API_KEY` — server-only, used by `api/triage.ts`. Not needed for `npm run dev` (plain Vite doesn't serve `/api` routes locally — use `vercel dev` to test AI triage locally, or test on a deployed preview).

```bash
npm run dev       # starts Vite on http://localhost:3000
npm run lint       # TypeScript type-check (tsc --noEmit)
npm run build      # production build
npm run preview    # preview the production build
```

### Deployment

Hosted on Vercel, connected to this repo's `main` branch. Required Vercel environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Production + Development), and `GROQ_API_KEY` (Production + Development, server-only — do **not** prefix with `VITE_`).

---

## Known Limitations

- **Telehealth video call** is a UI simulation — no real WebRTC/video infrastructure.
- **Emergency dispatch** creates a real database record (location, condition, timestamp) but the countdown, hospital ETA/distance numbers, and ambulance routing are illustrative — there's no real dispatch network or hospital coordinate data behind them.
- **Doctor/hospital directory** (`data/doctors.ts`) is static seed content representing NiaCare's affiliated network, not live data from real hospitals.
- **Personal file uploads** save metadata (title, category, notes) to Supabase but don't store the actual file bytes — no Supabase Storage integration yet.
