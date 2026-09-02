# NiaCare — Figma Design Prompt

## Overview and design intent

Design a complete, professional, trustworthy digital health platform called **NiaCare**, built for patients, doctors, hospital/clinic staff, and platform administrators in Tanzania. The bar to hit is Stripe, Linear, or a modern banking app: calm, confident, information-dense-but-legible, and unmistakably built for a serious domain — healthcare and money both live in this product (medical records, prescriptions, insurance claims, hospital billing, ambulance dispatch). Nothing about the interface should read as a toy, a hackathon demo, or a consumer lifestyle app chasing engagement. It should read as software a hospital administrator, a working doctor, or a government insurance auditor would trust on sight.

The current version of this app has drifted into "childish" territory in specific, fixable ways: raw emoji standing in for icons in several places, a patient dashboard where every action tile is a different candy color for the sake of variety rather than meaning, bouncing and pulsing animation applied to serious content like an emergency dispatch confirmation, near-maximum font weight on almost every piece of text so nothing is actually emphasized, and a jarring mismatch between a narrow phone-width login flow and a wide desktop dashboard that makes the product feel inconsistently built. This redesign should fix all of that at the root — a genuinely restrained, considered design system applied consistently everywhere, not just a new coat of paint on top of the same structural problems.

Every decision below should be read as a constraint, not a suggestion: fewer colors used more deliberately, fewer font weights used more deliberately, motion earned rather than decorative, and one unified layout language instead of two different apps stitched together.

## Product context and users

NiaCare is a multi-role healthcare platform. There are four distinct user experiences, and each needs its own screens designed to a professional standard, though they should clearly belong to the same product family:

1. **Patient** — a mobile-first, app-like experience. Patients register with a national ID (NIDA), passport, or insurance card, verify their identity, and get a digital health passport that acts as their universal medical ID. From there they book doctor appointments (in-person or telehealth), view their medical records and lab results, manage active prescriptions, trigger a one-tap emergency ambulance dispatch, and handle billing and insurance claims. This is the highest-traffic, highest-visibility part of the product and deserves the most design attention.

2. **Doctor** — a desktop-oriented clinical console. Doctors manage their schedule and availability, see their patient list, open a patient's history during a consultation, record vitals and diagnoses, write prescriptions, and order lab tests. This needs to feel like real clinical software: dense, scannable, fast to use mid-consultation, not decorative.

3. **Facility / provider staff** — a desktop console for hospital and clinic front-desk and operations staff: managing a task list, tracking inventory, checking patients in, and messaging within the facility.

4. **Admin** — a desktop console for platform operators: managing users, providers, and facilities across the whole system, monitoring platform-wide billing, watching live emergency dispatches, and reviewing an audit log for compliance. This is the most "enterprise SaaS" surface in the product and should look like a mature admin console — data tables, filters, status badges, drill-downs.

The primary market is Tanzania, and the product supports English, Swahili, and French — design copy and UI text with that in mind (short, clear labels that translate cleanly), but do not lean on Tanzanian flags, maps, or stock photography of smiling families as decorative set dressing. Where local context matters — NIDA national ID as an identity document, NHIF as a national insurance provider, M-Pesa/Airtel Money/Tigo Pesa/HaloPesa as real payment methods patients will actually select — represent it accurately and functionally, not as flavor.

## Voice and tone

Copy should be calm, direct, and competent — the tone of a hospital's own patient portal, not a startup's marketing site. Avoid exclamation points, avoid "fun" copy, avoid words like "awesome" or "amazing." Status and confirmation messages should be factual: "Appointment confirmed for Tuesday, 10:15 AM" rather than "Yay! You're all set!" Error messages should be specific and actionable, never cute. This tone should show up in every screen's microcopy, not just the marketing landing page.

## Design system

### Color

Use one restrained system, applied with intent rather than decoration. This is the single most important constraint in this brief — the current design's biggest problem is too many bright colors doing the job that hierarchy, spacing, and typography should be doing instead.

- **Primary — deep clinical blue.** Base `#0057B8`, dark variant `#003E83`, light variant `#1675D1`. This is the color for every primary action button, every link, every active nav/tab state, and every focus ring. If in doubt about what color something should be, it's primary blue or it's neutral.
- **Accent — teal.** Base `#12B8A6`, light variant `#65DCCF`. This is the only secondary decorative color allowed in the entire system, and it should be used sparingly — reserved for a single featured element per screen (for example, highlighting the AI health-triage feature, or a "smart" recommendation), never applied as one-color-per-card just to create visual variety across a grid of otherwise-equal items.
- **Semantic colors — status only, never decoration.** Success green `#10B981` (with a light subtle tint `#D1FAE5` for badge backgrounds), warning amber `#F59E0B` (subtle `#FEF3C7`), danger red `#EF4444` (subtle `#FEE2E2`), info blue-gray `#3B82F6` (subtle `#DBEAFE`). These four colors exist to communicate state — a confirmed appointment, a pending lab result, a failed payment, an informational note — and should never be chosen just because a card needs "some color." A status badge, an inline validation message, or an alert banner may use them; a decorative icon tile should not.
- **Neutrals.** A single gray/slate ramp drives every card background, border, divider, and muted text color across the whole product. Light mode: page background `#F7FAFE`, card surface `#FFFFFF`, elevated surface `#FBFDFF`, borders `#E4EBF4`/`#D5E0ED`, text `#10233E` (primary) down through `#52647B` (secondary) to `#7A8AA0` (muted). Dark mode: page background `#080E17`, card surface `#0B1522`, elevated surface `#101F31`, borders in translucent slate, text from near-white down through muted slate-gray. Every screen must be designed in both light and dark mode using this exact pairing, not an ad hoc dark palette per screen.
- **Explicitly banned as decorative fills:** purple, cyan, rose/pink, indigo, sky-blue, amber-as-decoration. If an existing pattern uses a different bright color per tile or icon "so it doesn't look boring," the fix is a neutral card with a single primary-blue (or, rarely, teal) icon tint — differentiation should come from the icon and label, not from six different background hues sitting next to each other.
- **Avatars** (patient/doctor/staff initials when no photo exists) should use a small closed set of 3–4 muted colors drawn from this same palette, not six saturated hues assigned by a name hash.

### Typography

Two typefaces: **Plus Jakarta Sans** for all UI text (headings, body, labels, buttons), and **JetBrains Mono** reserved specifically for numeric and identifier content — patient ID numbers, ticket/queue numbers, NIDA numbers, currency amounts in tables — so that numbers that matter are visually distinct and easy to scan without needing decoration.

Establish and hold to a real type scale, not "big and bold" everywhere: Caption 12px, Body-small 13px, Body 15px (the base size — not 14px, and not the 11–12px micro-text the current design leans on for most of its content), Body-large 16px, Heading-small 18px, Heading 22px, Heading-large 28px, Display 32px (landing page hero only). Pair this with a narrow weight vocabulary: regular (400) for body copy, medium (500) for emphasis and active states, semibold (600) for headings and button labels. Bold (700) is reserved for numerals, prices, and genuinely critical alerts only — it should never be the default weight for every heading and badge in the interface. This is a direct fix to the current design's "shouty but cramped" voice, where near-maximum font weight combined with a very small base size makes everything compete for attention at once.

### Shape, elevation, and spacing

Use a consistent small-to-medium corner radius across cards, buttons, inputs, and modals — roughly 8–12px. This should read as considered and modern without tipping into the oversized 24px+ "bubbly" rounding of a consumer social app, and without going so flat (sub-4px) that it reads like a raw data table with no warmth at all. Keep radius values consistent across every component type rather than having each screen invent its own.

Shadows should be minimal: soft, low-opacity, short-blur elevation used only to lift a card slightly off the page or to separate a modal from its backdrop — never a large, colorful, glowing drop-shadow. A card should look like a calm clinical surface sitting on a page, not a glossy floating tile.

Establish a consistent spacing scale (e.g. 4/8/12/16/24/32px steps) and use it uniformly for padding and gaps — the current design has visibly inconsistent padding between similar components, which reads as unpolished even before color and type are considered.

### Iconography

Use a single, consistent outline icon set throughout the entire product (Lucide-style line icons — consistent stroke width, consistent corner treatment). This is a hard rule: **no emoji anywhere as functional UI.** Not for emergency-triage condition selection, not for medical-record category tabs, not for symptom-picker chips in the AI triage flow, not for the language selector, not anywhere else. Every place currently using an emoji as a stand-in icon should get a real icon from the same family instead, sized and colored consistently with every other icon in the product.

### Motion

Motion should be minimal and purposeful, not decorative. Remove: bouncing icons or checkmarks on success states, permanently-pulsing "live" indicator dots used just to draw the eye, and hover states that scale icons or cards up. The only animated affordance permitted anywhere in the system is a single restrained pulse or glow, reserved exclusively for the emergency-ambulance-dispatch button, and only while a dispatch is genuinely active — nowhere else in the product should anything pulse, bounce, or scale on its own. Standard interactive transitions everywhere else should be simple: a 150–200ms fade or color/border shift on hover and focus, nothing more elaborate.

### Accessibility

Maintain WCAG AA contrast ratios for all text against its background in both light and dark mode — this matters more than usual here because several current screens use light text on light-tinted backgrounds. Every interactive element needs a visible focus state (a primary-blue focus ring, not just a color change). Status should never be communicated by color alone — pair every colored status badge with a label or icon, since color-blind users and the elderly patient population this product serves need that redundancy.

## Screens to design

Design the following as a connected, consistent system — not fifteen unrelated mockups.

**Pre-auth and onboarding** — a centered card layout, phone-width (around 480px), sitting on a subtly branded backdrop (a very light radial tint of primary blue behind the card, not a blank white page and not a busy full-bleed marketing background):

1. **Landing screen** — a confident, minimal value proposition, a clear "Get Started" and "Sign In," and a small trust strip (data protection compliance, NHIF partnership, number of facilities/doctors on the platform) — no stock photography of smiling families, no decorative gradient overlays.
2. **Sign in** (phone or email, leading to OTP) and **Register** (choosing an identity document — NIDA, passport, or insurance card — plus date of birth and blood type entry).
3. **OTP verification** — 6-digit code entry with individual digit boxes, a resend countdown timer, and a "paste from clipboard" affordance.
4. **Registration success / digital health passport reveal** — this is the emotional high point of onboarding and should be treated like unveiling a premium bank card or membership card: the patient's new digital health passport, their universal patient ID, blood type, insurance coverage, and a QR code for check-in, presented with real weight and craft.

**Patient app** — mobile-first, with a persistent bottom tab bar (Home / Appointments / Records / Prescriptions / Profile):

5. **Home dashboard** — a greeting header, the upcoming-appointment card, a compact always-visible version of the digital health passport, an active-prescription reminder if one exists, and a quick-actions grid (Book Appointment, Checkout & Billing, Prescriptions, Lab Results, Personal Files, Insurance, Find Facility, AI Health Triage). Design this grid with one consistent tile treatment — neutral card background, single primary-blue icon — rather than a different saturated color per tile.
6. **Emergency / ambulance dispatch** — serious and calm rather than playful, even though it uses red as its accent: a condition picker using real icons instead of emoji, a clear dispatch-confirmation state, and a live ETA/tracking view once a dispatch is in progress (this is the one screen allowed the single permitted pulse animation, and only in this active state).
7. **Appointment booking flow** — searching by doctor or specialty, choosing a hospital, picking an in-person or telehealth slot, and a confirmation screen.
8. **Medical records** — a category-filtered list (Lab, Radiology, Clinical Notes, Vaccinations) using real icons per category instead of emoji tab labels, a record detail view, and PDF download/share actions.
9. **Prescriptions** — an active medication list with a "mark as taken" interaction and a refill-request action.
10. **Checkout / billing** — a bill summary, a choice between insurance and cash/mobile-money payment, and a confirmation-and-receipt screen. This is a money screen and should look unambiguously trustworthy — clear line items, clear totals, clear payment-method selection — without needing to imply a specific live payment gateway is connected behind it.
11. **Insurance and claims overview.**
12. **Settings** — theme (light/dark), language (English, Swahili, French — exactly these three, not a long list implying broader support than exists), a biometric-login toggle, and profile details.

**Staff consoles** — desktop-oriented, sidebar or top-tab navigation, comfortable with dense data tables:

13. **Doctor dashboard** — today's schedule, a patient list, an encounter/consultation view for recording vitals, diagnosis, and prescriptions, and lab-order creation.
14. **Admin dashboard** — a platform-wide stats overview, user/provider/facility management tables, billing oversight, a live emergency-dispatch monitor, and an audit log. This should be the most mature-feeling "enterprise SaaS" screen in the whole set.
15. **Provider/facility staff dashboard** — a task list, inventory management, and a patient check-in queue.

## Explicitly avoid (known current problems to fix)

- Emoji used as functional icons anywhere — currently present in the emergency triage picker, medical-record category tabs, AI-triage symptom chips, and the language selector.
- A different saturated color assigned to each tile in the patient quick-actions grid purely for visual variety.
- Bounce or pulse animation applied to non-critical elements — currently present on a registration/dispatch success checkmark and on a decorative "live" status dot that isn't actually live.
- A jarring layout-width mismatch between a narrow, phone-width pre-auth flow and a much wider desktop dashboard, which currently makes the product feel like two different apps rather than one considered system.
- A language picker that implies support for dozens of languages when only three actually work.
- Payment and checkout screens that either look untrustworthy or that overclaim live payment-gateway integration that doesn't exist yet.

## Deliverable

Produce both light and dark mode for, at minimum: Landing, Sign in/OTP, the passport success-reveal screen, the patient home dashboard, emergency dispatch, medical records, checkout/billing, and the admin dashboard overview. Build these as a genuine, reusable component library — buttons (primary, secondary, ghost, destructive), cards, form inputs, status badges, modals, the bottom navigation bar, and data tables — with clearly named, documented variants, so this can be handed directly to engineering as a real design system to implement against, not just a set of static one-off mockup images.
