import { Language } from '../types';

const RAW_TRANSLATIONS = {
  header: {
    slogan: {
      sw: 'Kubadilisha Sekta ya Afya Kidijitali, Kuokoa Maisha Ndani ya Milisekunde',
      en: 'Digitalizing Healthcare, Saving Lives in Milliseconds',
      fr: 'Digitaliser la santé, sauver des vies en quelques millisecondes',
    },
  },
  emergency: {
    barTitle: {
      sw: 'AMBULANSI YA DHARURA',
      en: 'EMERGENCY AMBULANCE',
      fr: "AMBULANCE D'URGENCE",
    },
    barSubtitle: {
      sw: 'Tuma kwa 1-Tap (Bila Kuingia)',
      en: '1-Tap Dispatch (Bypass Login)',
      fr: 'Envoi en 1 clic (Sans connexion)',
    },
    modalTitle: {
      sw: 'Kituo cha Uokoaji wa Dharura',
      en: 'Rapid Emergency Dispatch Unit',
      fr: "Unité d'intervention d'urgence rapide",
    },
    modalSubtitle: {
      sw: 'Huduma ya Taifa ya Magari ya Wagonjwa (MNH & Red Cross)',
      en: 'National Paramedic Network & Tanzania Red Cross',
      fr: 'Réseau National des Paramédicaux & Croix-Rouge Tanzanienne',
    },
    dispatchedTitle: {
      sw: 'Ambulansi Imetumwa!',
      en: 'Ambulance Unit Dispatched!',
      fr: 'Ambulance Déployée !',
    },
    dispatchedDesc: {
      sw: 'Gari la wagonjwa kutoka Hospitali ya Aga Khan liko njiani (ETA: Dk 4). Dereva na Daktari wamepewa maelekezo ya GPS yako.',
      en: 'Paramedic unit from Aga Khan Hospital is en-route (ETA: 4 mins). Responders have received your GPS coordinates.',
      fr: "L'unité paramédicale de l'hôpital Aga Khan est en route (ETA : 4 min). Les secouristes ont reçu vos coordonnées GPS.",
    },
    paramedicLead: {
      sw: 'Nambari ya Dereva / Paramedic:',
      en: 'Paramedic Lead:',
      fr: 'Responsable Paramédical :',
    },
    targetFacility: {
      sw: 'Hospitali Lengwa:',
      en: 'Target Facility:',
      fr: 'Établissement de Destination :',
    },
    callDirectly: {
      sw: 'Piga Simu kwa Paramedic Moja kwa Moja',
      en: 'Call Paramedic Directly (Toll-Free 112)',
      fr: 'Appeler le paramédical directement (Numéro vert 112)',
    },
    initiatingTitle: {
      sw: 'Inatuma Maombi ya Dharura...',
      en: 'Initiating Emergency Siren Dispatch...',
      fr: "Lancement de l'envoi d'urgence...",
    },
    initiatingDesc: {
      sw: 'Simu itapiga kituo cha uokoaji baada ya sekunde 5. Bonyeza kitufe hapa chini kusitisha ikiwa ni kwa bahati mbaya.',
      en: 'Broadcasting telemetry to nearest trauma center. Click cancel below if this was triggered accidentally.',
      fr: "Transmission de la télémétrie au centre de traumatologie le plus proche. Cliquez ci-dessous pour annuler si c'est accidentel.",
    },
    cancelDispatch: {
      sw: 'Sitisha / Cancel Dispatch',
      en: 'Cancel Dispatch Now',
      fr: "Annuler l'envoi maintenant",
    },
    gpsPinpoint: {
      sw: 'Eneo Lako la GPS (Dar es Salaam)',
      en: 'Your Real-Time GPS Pinpoint',
      fr: 'Votre position GPS en temps réel',
    },
    refresh: {
      sw: 'Sasisha',
      en: 'Refresh',
      fr: 'Actualiser',
    },
    triageTitle: {
      sw: '1. Chagua Hali ya Mgonjwa (Triage)',
      en: '1. Select Victim Status (Triage)',
      fr: "1. Sélectionner l'état de la victime (Triage)",
    },
    nearestHospitalsTitle: {
      sw: '2. Vituo vya Afya vya Karibu',
      en: '2. Nearest Emergency Centers',
      fr: '2. Centres de soins les plus proches',
    },
    ready247: {
      sw: 'Tayari 24/7',
      en: 'Ready 24/7',
      fr: 'Disponible 24/7',
    },
    confirmDispatchBtn: {
      sw: 'Tuma Ambulansi SASA (1-Tap Dispatch)',
      en: 'Confirm & Dispatch Ambulance NOW',
      fr: 'Confirmer & Envoyer Ambulance MAINTENANT',
    },
    directHotlines: {
      sw: 'Namba za Moja kwa Moja:',
      en: 'Direct Hotlines:',
      fr: 'Lignes directes :',
    },
    conditions: {
      trauma: {
        sw: 'Ajali / Jeraha Kali',
        en: 'Accident / Severe Trauma',
        fr: 'Accident / Traumatisme Grave',
      },
      cardiac: {
        sw: 'Mshtuko wa Moyo',
        en: 'Cardiac / Chest Pain',
        fr: 'Crise Cardiaque / Douleur Thoracique',
      },
      respiratory: {
        sw: 'Kushindwa Kupumua',
        en: 'Severe Asthma / Choking',
        fr: 'Asthme Sévère / Étouffement',
      },
      maternity: {
        sw: 'Uchungu wa Uzazi',
        en: 'Maternity / Labour',
        fr: 'Maternité / Travail',
      },
      unconscious: {
        sw: 'Kupoteza Fahamu',
        en: 'Unconscious / Stroke',
        fr: 'Inconscient / AVC',
      },
    },
  },
  identity: {
    welcome: {
      sw: 'Karibu NiaCare',
      en: 'Welcome to NiaCare',
      fr: 'Bienvenue sur NiaCare',
    },
    welcomeSubtitle: {
      sw: 'Tuangalie taarifa zako kuendelea',
      en: "Let's verify your details to continue",
      fr: 'Vérifions vos informations pour continuer',
    },
    demoFill: {
      sw: 'Jaza Mfano',
      en: 'Demo Fill',
      fr: 'Exemple démo',
    },
    tabLocals: {
      sw: 'Locals (Tanzanians)',
      en: 'Locals (Tanzanians)',
      fr: 'Citoyens (Tanzaniens)',
    },
    tabInternationals: {
      sw: 'Internationals',
      en: 'Internationals',
      fr: 'Internationaux',
    },
    infoNotice: {
      sw: 'Tafadhali ingiza taarifa sahihi kama zilivyo kwenye nyaraka zako.',
      en: 'Please enter accurate details as they appear on your official documents.',
      fr: 'Veuillez saisir des informations conformes à vos documents officiels.',
    },
    personalInfoTitle: {
      sw: 'Taarifa Binafsi',
      en: 'Personal Information',
      fr: 'Informations Personnelles',
    },
    fullNamePlaceholder: {
      sw: 'Jina Kamili',
      en: 'Full Name',
      fr: 'Nom Complet',
    },
    dobLabel: {
      sw: 'Tarehe ya Kuzaliwa (Date of Birth)',
      en: 'Date of Birth (DOB)',
      fr: 'Date de Naissance',
    },
    dobDesc: {
      sw: 'Chagua siku, mwezi na mwaka wako wa kuzaliwa',
      en: 'Select your birth day, month, and year',
      fr: 'Sélectionnez votre jour, mois et année de naissance',
    },
    birthDayLabel: {
      sw: 'Siku (Day)',
      en: 'Day',
      fr: 'Jour',
    },
    birthMonthLabel: {
      sw: 'Mwezi (Month)',
      en: 'Month',
      fr: 'Mois',
    },
    birthYearLabel: {
      sw: 'Mwaka (Year)',
      en: 'Year',
      fr: 'Année',
    },
    calculatedAge: {
      sw: 'Umri Uliokokotolewa:',
      en: 'Calculated Age:',
      fr: 'Âge calculé :',
    },
    yearsOld: {
      sw: 'Miaka',
      en: 'Years old',
      fr: 'Ans',
    },
    nidaDobSyncHint: {
      sw: 'NIDA imetambua tarehe ya kuzaliwa:',
      en: 'NIDA detected birth date:',
      fr: 'Date de naissance détectée par NIDA :',
    },
    applyNidaDob: {
      sw: 'Sawazisha Tarehe',
      en: 'Apply to Form',
      fr: 'Appliquer',
    },
    bloodTypeLabel: {
      sw: 'Kundi la Damu (Blood Type)',
      en: 'Blood Type (Group)',
      fr: 'Groupe Sanguin',
    },
    bloodTypePlaceholder: {
      sw: 'Chagua Kundi la Damu',
      en: 'Select Blood Type',
      fr: 'Sélectionnez le groupe sanguin',
    },
    bloodTypeUnknown: {
      sw: 'Sina Uhakika / Sijui',
      en: 'Unknown / Not Sure',
      fr: 'Inconnu / Pas sûr',
    },
    bloodTypeHelp: {
      sw: 'Muhimu kwa huduma ya dharura ya haraka',
      en: 'Critical for emergency response',
      fr: "Crucial pour les soins d'urgence",
    },
    agePlaceholder: {
      sw: 'Umri (Age)',
      en: 'Age',
      fr: 'Âge',
    },
    phonePlaceholder: {
      sw: 'Namba ya Simu',
      en: 'Phone Number',
      fr: 'Numéro de téléphone',
    },
    docSelectorLabel: {
      sw: 'Chagua Njia ya Utambulisho:',
      en: 'Select Credential / Document Type:',
      fr: "Type de document d'identité :",
    },
    docNida: {
      sw: 'NIDA / NIN',
      en: 'NIDA / NIN',
      fr: 'NIDA / NIN',
    },
    docNidaSub: {
      sw: 'Kitambulisho cha Taifa',
      en: 'National ID Card',
      fr: 'Carte Nationale (NIDA)',
    },
    docInsurance: {
      sw: 'Bima ya Afya',
      en: 'Insurance ID',
      fr: 'Assurance Santé',
    },
    docInsuranceSub: {
      sw: 'NHIF / Binafsi',
      en: 'NHIF / Private',
      fr: 'NHIF / Privée',
    },
    docBirthCert: {
      sw: 'Cheti cha Kuzaliwa',
      en: 'Birth Certificate',
      fr: 'Acte de Naissance',
    },
    docBirthCertSub: {
      sw: 'RITA Entry ID',
      en: 'RITA Document ID',
      fr: 'N° Enregistrement RITA',
    },
    insuranceProviderLabel: {
      sw: 'Mtoa Huduma wa Bima (Insurance Scheme):',
      en: 'Select Insurance Scheme / Provider:',
      fr: "Sélectionnez l'assureur :",
    },
    nidaHelp: {
      sw: 'Weka namba 20 za kitambulisho chako cha Taifa cha NIDA.',
      en: 'Enter your 20-digit National Identification Number (NIDA).',
      fr: 'Entrez les 20 chiffres de votre identifiant national NIDA.',
    },
    insuranceHelp: {
      sw: 'Weka nambari iliyopo kwenye kadi yako ya bima ya afya.',
      en: 'Enter the membership number printed on your health insurance card.',
      fr: "Entrez le numéro figurant sur votre carte d'assurance santé.",
    },
    birthCertHelp: {
      sw: 'Inafaa kwa watoto au wagonjwa wenye cheti cha kuzaliwa cha RITA.',
      en: 'Ideal for minors and patients registered under RITA Certificate.',
      fr: "Idéal pour les mineurs ou patients avec acte de naissance RITA.",
    },
    nidaPlaceholder: {
      sw: 'NIDA / NIN (Tarukimu 20)',
      en: 'NIDA / NIN (20 Digits)',
      fr: 'NIDA / NIN (20 chiffres)',
    },
    insuranceIdPlaceholder: {
      sw: 'Namba ya Bima (mf. NHIF-8849201)',
      en: 'Insurance Card No. (e.g. NHIF-8849201)',
      fr: "N° Carte d'Assurance (ex: NHIF-8849201)",
    },
    birthCertPlaceholder: {
      sw: 'Namba ya Cheti cha RITA (mf. RITA-2018-938210)',
      en: 'RITA Cert No. (e.g. RITA-2018-938210)',
      fr: "N° Acte de Naissance (ex: RITA-2018-938210)",
    },
    passportPlaceholder: {
      sw: 'Passport ID / Number',
      en: 'Passport ID / Number',
      fr: 'Numéro de passeport',
    },
    nationalitySelect: {
      sw: 'Utaifa (Nationality)',
      en: 'Nationality',
      fr: 'Nationalité',
    },
    contactLabel: {
      sw: 'Simu / Barua Pepe',
      en: 'Phone / Email',
      fr: 'Téléphone / E-mail',
    },
    phoneTab: {
      sw: 'Simu',
      en: 'Phone',
      fr: 'Téléphone',
    },
    emailTab: {
      sw: 'Barua Pepe',
      en: 'Email',
      fr: 'E-mail',
    },
    emailPlaceholder: {
      sw: 'Barua Pepe (Email Address)',
      en: 'Email Address',
      fr: 'Adresse e-mail',
    },
    demoToast: {
      sw: '✓ Taarifa za mfano zimejazwa kikamilifu!',
      en: '✓ Demo data populated successfully!',
      fr: '✓ Données de démonstration renseignées avec succès !',
    },
    modeRegister: {
      sw: 'Sajili Mara ya Kwanza',
      en: 'First-Time Register',
      fr: 'Première Inscription',
    },
    modeLogin: {
      sw: 'Ingia Haraka (2FA)',
      en: 'Quick Login (2FA)',
      fr: 'Connexion Rapide (2FA)',
    },
    credentialsTitle: {
      sw: 'Weka Taarifa Zako za Usajili',
      en: 'Enter Your Registration Credentials',
      fr: "Entrez vos identifiants d'inscription",
    },
    requiredFields: {
      sw: 'Jaza taarifa zako hapa chini kupokea namba ya OTP kwenye ukurasa wa nyumbani.',
      en: 'Fill your credentials below to receive your OTP code right on the home page.',
      fr: "Remplissez vos coordonnées ci-dessous pour recevoir votre code OTP sur la page d'accueil.",
    },
  },
  homeOtp: {
    title: {
      sw: 'Uthibitisho wa Nambari ya Simu (OTP)',
      en: 'Phone Verification (OTP)',
      fr: 'Vérification du Téléphone (OTP)',
    },
    subtitle: {
      sw: 'Ujumbe wa SMS wenye tarakimu 6 umetumwa kwenye ukurasa wa nyumbani',
      en: '6-digit security code dispatched directly to your home page',
      fr: "Code de sécurité à 6 chiffres envoyé directement sur la page d'accueil",
    },
    sentTo: {
      sw: 'Imetumwa kwa:',
      en: 'Sent to:',
      fr: 'Envoyé à :',
    },
    changeNumber: {
      sw: 'Badili Namba',
      en: 'Change',
      fr: 'Modifier',
    },
    enterCode: {
      sw: 'Ingiza nambari 6 za siri tulizotuma kwa njia ya SMS kukamilisha usajili wako wa NiaCare.',
      en: 'Enter the 6-digit verification code sent via SMS to complete your NiaCare registration.',
      fr: "Entrez le code de vérification à 6 chiffres envoyé par SMS pour finaliser votre inscription NiaCare.",
    },
    resendIn: {
      sw: 'Tuma nambari tena baada ya',
      en: 'Resend code in',
      fr: 'Renvoyer le code dans',
    },
    resendNow: {
      sw: 'Tuma nambari tena',
      en: 'Resend code now',
      fr: 'Renvoyer le code maintenant',
    },
    verifyBtn: {
      sw: 'THIBITISHA NA KAMILISHA USAJILI',
      en: 'VERIFY & COMPLETE REGISTRATION',
      fr: "VÉRIFIER ET FINALISER L'INSCRIPTION",
    },
    autoFillHelper: {
      sw: 'Bandika Kutoka kwa Clipboard',
      en: 'Paste from Clipboard',
      fr: 'Coller depuis le presse-papiers',
    },
    backToEdit: {
      sw: 'Rudi Kurekebisha Taarifa za Usajili',
      en: 'Back to Edit Registration Credentials',
      fr: "Retour pour modifier les informations d'inscription",
    },
    firstTimeBadge: {
      sw: 'Usajili Mpya wa Kwanza',
      en: 'First-Time Registration',
      fr: 'Première Inscription',
    },
    smsNotificationHeader: {
      sw: 'UJUMBE WA SMS • SASA HIVI',
      en: 'MESSAGES • JUST NOW',
      fr: 'MESSAGES • À L’INSTANT',
    },
    smsNotificationBody: {
      sw: 'NiaCare: Nambari yako ya siri ya uthibitisho ni 829140. Itatumika kukamilisha usajili wako.',
      en: 'NiaCare: Your security verification code is 829140. Use this to complete your registration.',
      fr: 'NiaCare : Votre code de vérification de sécurité est 829140. Utilisez-le pour finaliser votre inscription.',
    },
    emailNotificationHeader: {
      sw: 'BARUA PEPE (EMAIL) • SASA HIVI',
      en: 'MAIL • JUST NOW',
      fr: 'EMAIL • À L’INSTANT',
    },
    emailNotificationBody: {
      sw: 'NiaCare Security: Msimbo wako wa siri wa uthibitisho ni 829140. Itatumika kukamilisha usajili wako.',
      en: 'NiaCare Security: Your verification passkey is 829140. Use this to complete authentication.',
      fr: 'NiaCare Sécurité : Votre code de vérification est 829140. Utilisez-le pour finaliser la vérification.',
    },
    sentViaSms: {
      sw: 'Ujumbe wa SMS umetumwa kwa:',
      en: 'Verification SMS sent to:',
      fr: 'SMS de vérification envoyé au :',
    },
    sentViaEmail: {
      sw: 'Barua pepe ya uthibitisho imetumwa kwa:',
      en: 'Verification Email sent to:',
      fr: 'Email de vérification envoyé à :',
    },
    switchChannelBtn: {
      sw: 'Badilisha njia (SMS ⇄ Email)',
      en: 'Switch delivery channel (SMS ⇄ Email)',
      fr: 'Changer de canal (SMS ⇄ Email)',
    },
    tapToAutoFill: {
      sw: 'Gusa hapa kujaza moja kwa moja',
      en: 'Tap banner to auto-fill code',
      fr: 'Appuyez pour remplir automatiquement',
    },
    credentialsSubmitted: {
      sw: '✓ Taarifa za usajili zimepokelewa! OTP imetumwa kwenye ukurasa wa nyumbani.',
      en: '✓ Credentials submitted! OTP dispatched to home page.',
      fr: "✓ Informations reçues ! L'OTP a été envoyé sur la page d'accueil.",
    },
  },
  twoFactor: {
    title: {
      sw: '2FA Security',
      en: '2FA Security',
      fr: 'Sécurité 2FA',
    },
    secureBadge: {
      sw: 'Salama',
      en: 'Secure',
      fr: 'Sécurisé',
    },
    chooseMethod: {
      sw: 'Njia ya Kupokea Msimbo (OTP):',
      en: 'Select OTP Delivery Channel:',
      fr: 'Mode de réception du code (OTP) :',
    },
    channelPhone: {
      sw: 'Namba ya Simu (SMS)',
      en: 'Phone Number (SMS)',
      fr: 'Numéro de Téléphone (SMS)',
    },
    channelEmail: {
      sw: 'Barua Pepe (Email)',
      en: 'Email Address',
      fr: 'Adresse Email',
    },
    dispatchedToPhone: {
      sw: 'Msimbo wa OTP utatumwa kwa SMS:',
      en: 'OTP code will be dispatched via SMS:',
      fr: 'Le code OTP sera envoyé par SMS au :',
    },
    dispatchedToEmail: {
      sw: 'Msimbo wa OTP utatumwa kwa Email:',
      en: 'OTP code will be dispatched via Email:',
      fr: 'Le code OTP sera envoyé par Email à :',
    },
    emailInputPlaceholder: {
      sw: 'Weka anwani ya barua pepe (mf. jina@mfano.com)',
      en: 'Enter email address (e.g. name@example.com)',
      fr: 'Entrez votre adresse email (ex: nom@exemple.com)',
    },
    emailMissingError: {
      sw: 'Tafadhali weka anwani ya barua pepe ili upokee OTP.',
      en: 'Please enter a valid email address to receive the OTP.',
      fr: 'Veuillez saisir une adresse email valide pour recevoir l’OTP.',
    },
    phoneMissingError: {
      sw: 'Tafadhali weka nambari yako ya simu kwenye fomu ili upokee OTP.',
      en: 'Please enter your phone number in the form to receive the OTP.',
      fr: 'Veuillez entrer votre numéro de téléphone pour recevoir l’OTP.',
    },
    phoneLocalPlaceholder: {
      sw: 'Namba ya Simu (7XXXXXXXX)',
      en: 'Phone Number (7XXXXXXXX)',
      fr: 'Numéro de téléphone (7XXXXXXXX)',
    },
    phoneIntlPlaceholder: {
      sw: 'Phone Number',
      en: 'Phone Number',
      fr: 'Numéro de téléphone',
    },
    phoneError: {
      sw: 'Tafadhali ingiza nambari sahihi ya simu',
      en: 'Please enter a valid phone number',
      fr: 'Veuillez entrer un numéro de téléphone valide',
    },
    consentError: {
      sw: 'Tafadhali weka alama ya kukubali sheria ya PDPA kuendelea',
      en: 'Please check the PDPA consent box to continue',
      fr: 'Veuillez cocher la case de consentement PDPA pour continuer',
    },
    sendOtpBtn: {
      sw: 'TUMA OTP',
      en: 'SEND OTP',
      fr: 'ENVOYER OTP',
    },
    sendOtpSubtext: {
      sw: 'Tutakutumia namba ya uthibitisho kwa SMS au Email',
      en: 'We will send a verification code via SMS or Email',
      fr: 'Nous vous enverrons un code de vérification par SMS ou Email',
    },
    orDivider: {
      sw: 'AU',
      en: 'OR',
      fr: 'OU',
    },
    biometricBtn: {
      sw: 'Ingia kwa Fingerprint / Face ID',
      en: 'Login with Fingerprint / Face ID',
      fr: 'Connexion par Empreinte / Face ID',
    },
    biometricSubtext: {
      sw: '1-Second Secure Login',
      en: '1-Second Secure Login',
      fr: 'Connexion sécurisée en 1 seconde',
    },
    pdpaLabel: {
      sw: 'Ninakubali Sheria ya Ulinzi wa Data (PDPA)',
      en: 'I accept Data Protection terms (PDPA)',
      fr: 'J’accepte la loi sur la protection des données (PDPA)',
    },
    pdpaSubtext: {
      sw: 'Taarifa zako zitalindwa kwa mujibu wa sheria ya PDPA.',
      en: 'Your personal data is encrypted and protected by PDPA.',
      fr: 'Vos données sont chiffrées et protégées par la loi PDPA.',
    },
    notRegistered: {
      sw: 'Hujasajiliwa? ',
      en: 'Not registered? ',
      fr: 'Pas encore inscrit ? ',
    },
    registerHere: {
      sw: 'Jisajili Hapa',
      en: 'Register Here',
      fr: 'S’inscrire ici',
    },
    categorySubtext: {
      sw: '(Mwananchi / Mgeni)',
      en: '(Local / International)',
      fr: '(Citoyen / International)',
    },
  },
  trustBar: {
    securityTitle: {
      sw: 'Usalama Kwanza',
      en: 'Security First',
      fr: "La Sécurité d'Abord",
    },
    securityDesc: {
      sw: 'Taarifa zako zinalindwa kwa viwango vya juu zaidi',
      en: 'Your medical data is protected with military-grade encryption',
      fr: 'Vos données médicales sont protégées par un chiffrement de pointe',
    },
    speedTitle: {
      sw: 'Huduma Haraka',
      en: 'Rapid EMS Dispatch',
      fr: "Intervention d'Urgence Rapide",
    },
    speedDesc: {
      sw: 'Ambulance kwa 1-tap tu, muda ni uhai',
      en: '1-tap ambulance dispatch, every millisecond counts',
      fr: 'Envoi d’ambulance en 1 clic, chaque milliseconde compte',
    },
    certifiedTitle: {
      sw: 'Imependekezwa',
      en: 'Health Certified',
      fr: 'Certifié Santé',
    },
    certifiedDesc: {
      sw: 'Inakidhi viwango vya kimataifa vya afya',
      en: 'Compliant with international and national eHealth standards',
      fr: 'Conforme aux normes internationales et nationales de santé numérique',
    },
    privacyTitle: {
      sw: 'Faragha Yako',
      en: 'PDPA Privacy',
      fr: 'Confidentialité PDPA',
    },
    privacyDesc: {
      sw: 'Tunazingatia sheria za PDPA kikamilifu',
      en: 'Fully compliant with Tanzania PDPA 2022 Act',
      fr: 'Entièrement conforme à la loi PDPA 2022 de Tanzanie',
    },
  },
  otpModal: {
    title: {
      sw: 'Uthibitishaji wa 2FA (OTP)',
      en: 'Two-Factor Verification (2FA)',
      fr: 'Vérification à Deux Facteurs (2FA)',
    },
    subtitle: {
      sw: 'Ulinzi wa Taarifa za Afya',
      en: 'Encrypted eHealth Security',
      fr: 'Sécurité Santé Numérique Chiffrée',
    },
    instructions: {
      sw: 'Msimbo wa siri wenye tarukimu 6 umetumwa kupitia SMS. Tafadhali weka msimbo hapa chini:',
      en: 'A 6-digit security passkey was dispatched to your mobile phone. Enter the code below:',
      fr: 'Un code de sécurité à 6 chiffres a été envoyé par SMS à votre téléphone. Saisissez-le ci-dessous :',
    },
    fillDemo: {
      sw: 'Weka Msimbo wa Jaribio (829140)',
      en: 'Autofill Demo Code (829140)',
      fr: 'Remplir code démo (829140)',
    },
    resendIn: {
      sw: 'Tuma tena baada ya:',
      en: 'Resend in:',
      fr: 'Renvoyer dans :',
    },
    resendBtn: {
      sw: 'Tuma Msimbo Upya',
      en: 'Resend Code',
      fr: 'Renvoyer le code',
    },
    codeResent: {
      sw: 'Msimbo mpya wa OTP umetumwa kwa SMS!',
      en: 'A new OTP code has been dispatched via SMS!',
      fr: 'Un nouveau code OTP a été envoyé par SMS !',
    },
    verifyBtn: {
      sw: 'Thibitisha na Uingie',
      en: 'Verify & Complete Authentication',
      fr: 'Vérifier et compléter la connexion',
    },
    errorLength: {
      sw: 'Tafadhali ingiza tarukimu zote 6 za OTP',
      en: 'Please enter all 6 OTP digits',
      fr: 'Veuillez saisir les 6 chiffres du code OTP',
    },
  },
  biometricModal: {
    verifiedIn: {
      sw: 'Imethibitishwa kwa',
      en: 'Verified in',
      fr: 'Vérifié en',
    },
    scanning: {
      sw: 'Inatambua...',
      en: 'Scanning Sensor...',
      fr: 'Analyse du capteur...',
    },
    verifiedTitle: {
      sw: 'Utambulisho Umethibitishwa!',
      en: 'Biometric Verified!',
      fr: 'Biométrie Vérifiée !',
    },
    touchFingerprint: {
      sw: 'Weka Kidole Kwenye Sensor',
      en: 'Touch Fingerprint Sensor',
      fr: "Touchez le capteur d'empreintes",
    },
    lookCamera: {
      sw: 'Tazama Kwenye Kamera (FaceID)',
      en: 'Position Face in Front of Camera',
      fr: 'Placez votre visage devant la caméra',
    },
    subtext: {
      sw: 'Uthibitishaji wa haraka wa sekunde 1 kwa ajili ya kuokoa maisha haraka.',
      en: 'Sub-second zero-knowledge encryption key matched with national eHealth records.',
      fr: 'Clé de chiffrement instantanée vérifiée avec le registre national de santé.',
    },
  },
  pdpaModal: {
    title: {
      sw: 'Sheria ya Ulinzi wa Taarifa Binafsi (PDPA 2022)',
      en: 'Personal Data Protection Act (PDPA 2022)',
      fr: 'Loi sur la Protection des Données Personnelles (PDPA 2022)',
    },
    subtitle: {
      sw: 'Ulinzi wa Hati Miliki na Faragha ya Mgonjwa',
      en: 'Tanzania National Commission for Data Protection',
      fr: 'Commission Nationale de Protection des Données de Tanzanie',
    },
    intro: {
      sw: 'NiaCare inazingatia kikamilifu Sheria ya Ulinzi wa Taarifa Binafsi Namba 11 ya Mwaka 2022 (PDPA) ya Jamhuri ya Muungano wa Tanzania pamoja na miongozo ya Wizara ya Afya (MoH).',
      en: 'NiaCare operates in strict compliance with the Tanzania Personal Data Protection Act No. 11 of 2022 (PDPA) and Ministry of Health (MoH) clinical data security directives.',
      fr: "NiaCare respecte strictement la loi n° 11 de 2022 sur la protection des données personnelles (PDPA) de Tanzanie et les directives du ministère de la Santé.",
    },
    point1Title: {
      sw: '1. Usimbaji wa Taarifa (AES-256 Encryption)',
      en: '1. Military-Grade Encryption',
      fr: '1. Chiffrement de Niveau Militaire (AES-256)',
    },
    point1Desc: {
      sw: 'Taarifa zako zote za NIDA, Bima ya Afya, Pasipoti, na rekodi za matibabu zinasimbwa kwa njia fiche ya daraja la juu (End-to-End Encryption) na hazitauzwa au kupewa wahusika wengine wasio na kibali.',
      en: 'All patient identification numbers (NIDA), health insurance memberships, biometric tokens, and historical medical files are encrypted end-to-end (AES-256 & TLS 1.3).',
      fr: "Tous les identifiants (NIDA), affiliations d'assurance, jetons biométriques et dossiers médicaux sont chiffrés de bout en bout (AES-256 & TLS 1.3).",
    },
    point2Title: {
      sw: '2. Ruhusa ya Uokoaji wa Dharura (Emergency Dispatch Access)',
      en: '2. Emergency Medical Responder Protocol',
      fr: "2. Protocole d'Intervention Médicale d'Urgence",
    },
    point2Desc: {
      sw: 'Unapobofya kitufe cha dharura cha ambulansi, taarifa zako za kimsingi (Kundi la Damu, Mizio/Allergies, na Eneo la GPS) zitasambazwa kwa kituo cha uokoaji ili kuokoa maisha yako ndani ya sekunde chache.',
      en: 'Upon triggering the 1-Tap Emergency Dispatch, your essential vitals (Blood Type, Critical Allergies, and Live GPS coordinates) will be securely streamed to the assigned paramedic vehicle to minimize dispatch delay.',
      fr: "Lors de l'activation de l'envoi d'urgence, vos constantes vitales essentielles (groupe sanguin, allergies et GPS en direct) sont transmises en toute sécurité au véhicule paramédical.",
    },
    point3Title: {
      sw: '3. Haki ya Mtumiaji ya Kudhibiti Data',
      en: '3. Patient Sovereignty & Consent',
      fr: '3. Souveraineté et Consentement du Patient',
    },
    point3Desc: {
      sw: 'Una haki kamili ya kubadilisha, kufuta, au kuomba nakala ya taarifa zako zote wakati wowote kwa mujibu wa Kifungu cha 33 cha Sheria ya PDPA 2022.',
      en: 'You retain continuous rights to modify, export, or permanently delete your health credential tokens under Section 33 of PDPA 2022.',
      fr: 'Vous conservez le droit permanent de modifier, exporter ou supprimer définitivement vos données de santé conformément à l’article 33 du PDPA 2022.',
    },
    closeBtn: {
      sw: 'Funga',
      en: 'Close',
      fr: 'Fermer',
    },
    acceptBtn: {
      sw: 'Ninakubali Masharti',
      en: 'I Agree & Accept Terms',
      fr: "J'Accepte les Conditions",
    },
  },
  registrationModal: {
    title: {
      sw: 'Usajili Mpya wa NiaCare',
      en: 'New NiaCare Registration',
      fr: 'Nouvelle Inscription NiaCare',
    },
    subtitle: {
      sw: 'Chagua kategoria yako kuendelea',
      en: 'Select your category to start onboarding',
      fr: 'Sélectionnez votre catégorie pour commencer',
    },
    intro: {
      sw: 'Karibu kwenye lango kuu la afya ya kidijitali Tanzania. Usajili unachukua chini ya dakika 1 tu.',
      en: 'Welcome to Tanzania’s unified digital health registry. Account onboarding takes less than 1 minute.',
      fr: 'Bienvenue sur le portail unifié de santé numérique de Tanzanie. L’inscription prend moins d’une minute.',
    },
    localTitle: {
      sw: 'Mwananchi (Locals - Tanzania)',
      en: 'Tanzanian Citizen (Locals)',
      fr: 'Citoyen Tanzanien (Locaux)',
    },
    localDesc: {
      sw: 'NIDA, Bima ya NHIF/Binafsi, Cheti cha RITA',
      en: 'NIDA, NHIF/Private Health Insurance, RITA ID',
      fr: 'NIDA, Assurance NHIF/Privée, Acte RITA',
    },
    intlTitle: {
      sw: 'Wageni (Internationals / Tourists)',
      en: 'International (Visitor / Expat)',
      fr: 'International (Visiteur / Expatrié)',
    },
    intlDesc: {
      sw: 'Pasipoti, Utaifa, Bima ya Kimataifa ya Usafiri',
      en: 'Passport, Nationality, Travel Health Cover',
      fr: 'Passeport, Nationalité, Assurance voyage',
    },
    guarantee: {
      sw: 'Ulinzi wa Data wa PDPA 2022 Umehakikishwa',
      en: 'PDPA 2022 Data Protection Guaranteed',
      fr: 'Protection des Données PDPA 2022 Garantie',
    },
  },
  successModal: {
    authenticatedBadge: {
      sw: 'Usajili na 2FA Imekamilika',
      en: 'Authenticated & Verified',
      fr: 'Authentifié & Vérifié',
    },
    cardReadyTitle: {
      sw: 'Kitambulisho cha NiaCare Kiko Tayari',
      en: 'NiaCare Digital Health Card Active',
      fr: 'Carte de Santé Numérique NiaCare Active',
    },
    cardReadyDesc: {
      sw: 'Imeunganishwa na mfumo wa dharura wa sekunde za uokoaji.',
      en: 'Synchronized with real-time 1-tap EMS triage networks.',
      fr: "Synchronisée avec le réseau de triage d'urgence en temps réel.",
    },
    patientLegalName: {
      sw: 'Jina la Mgonjwa',
      en: 'Patient Legal Name',
      fr: 'Nom Légal du Patient',
    },
    coverLabel: {
      sw: 'Bima',
      en: 'Cover',
      fr: 'Assurance',
    },
    universalIdLabel: {
      sw: 'Nambari ya Usajili',
      en: 'Universal Patient ID',
      fr: 'Identifiant Universel Patient',
    },
    oneTapScan: {
      sw: '1-Tap Scan',
      en: '1-Tap Scan',
      fr: 'Scan 1 Clic',
    },
    bloodGroup: {
      sw: 'Damu: O+ (Chanya)',
      en: 'Blood: O+ (Positive)',
      fr: 'Sang : O+ (Positif)',
    },
    biometricKey: {
      sw: 'Ufunguo wa Kibayometriki: Imethibitishwa',
      en: 'Biometric Key: Verified',
      fr: 'Clé Biométrique : Vérifiée',
    },
    addToWallet: {
      sw: 'Hifadhi Kadi (Wallet)',
      en: 'Add to Wallet',
      fr: 'Ajouter au portefeuille',
    },
    shareQr: {
      sw: 'Shiriki / Share',
      en: 'Share QR',
      fr: 'Partager QR',
    },
    registerAnother: {
      sw: 'Anza Usajili Mpya / Mtumiaji Mwingine',
      en: 'Register Another User / Reset',
      fr: 'Inscrire un autre utilisateur / Réinitialiser',
    },
    walletAlert: {
      sw: 'Kadi ya NiaCare imehifadhiwa kwenye simu yako!',
      en: 'NiaCare Card saved to Apple Wallet / Google Wallet!',
      fr: 'Carte NiaCare enregistrée dans Apple Wallet / Google Wallet !',
    },
    shareAlert: {
      sw: 'Kiungo cha dharura kimeshirikiwa na mtu wa karibu!',
      en: 'Emergency medical pass link generated!',
      fr: "Lien d'urgence médicale généré avec succès !",
    },
  },
  settings: {
    title: {
      sw: 'Mipangilio & Usalama',
      en: 'Settings & Security',
      fr: 'Paramètres & Sécurité',
    },
    subtitle: {
      sw: 'Ulinzi wa Bayometriki, Lugha, Mandhari na Akaunti ya NiaCare',
      en: 'Biometric Security, Language, Theme & Account Settings',
      fr: 'Sécurité Biométrique, Langue, Thème & Paramètres du Compte',
    },
    appearanceSection: {
      sw: 'Mandhari ya Mfumo (Appearance / Theme)',
      en: 'System Appearance & Theme',
      fr: 'Apparence du Système & Thème',
    },
    appearanceDesc: {
      sw: 'Chagua muundo wa mwanga au giza unaofaa macho yako.',
      en: 'Choose light or dark mode tailored to your visual preference.',
      fr: 'Choisissez le mode clair ou sombre selon votre préférence.',
    },
    lightMode: {
      sw: 'Mwanga (Light Mode)',
      en: 'Light Mode',
      fr: 'Mode Clair',
    },
    darkMode: {
      sw: 'Giza (Dark Mode)',
      en: 'Dark Mode',
      fr: 'Mode Sombre',
    },
    languageSection: {
      sw: 'Lugha ya Mfumo (Language)',
      en: 'System Language',
      fr: 'Langue du Système',
    },
    languageDesc: {
      sw: 'Chagua lugha kuu ya kutumia katika NiaCare.',
      en: 'Select your preferred language for the NiaCare interface.',
      fr: 'Sélectionnez votre langue préférée pour NiaCare.',
    },
    browseAllLanguages: {
      sw: 'Tazama Lugha Zote 70+ za Dunia',
      en: 'Browse All 70+ World Languages',
      fr: 'Parcourir toutes les 70+ langues',
    },
    biometricSection: {
      sw: 'Uthibitisho wa Bayometriki (Biometrics)',
      en: 'Biometric Authentication',
      fr: 'Authentification Biométrique',
    },
    biometricDesc: {
      sw: 'Washa kuingia kwa kutumia alama ya kidole au utambuzi wa sura kwa usalama wa hali ya juu.',
      en: 'Enable fingerprint or facial recognition for fast, ultra-secure authentication.',
      fr: 'Activez la reconnaissance par empreinte ou faciale pour un accès rapide et sécurisé.',
    },
    testBiometricBtn: {
      sw: 'Ingia kwa Fingerprint / Face ID',
      en: 'Login with Fingerprint / Face ID',
      fr: 'Connexion par Empreinte / Face ID',
    },
    testBiometricSubtext: {
      sw: 'Jaribu au ingia mara moja kwa sekunde 1',
      en: 'Authenticate or test biometric sign-in instantly',
      fr: 'Authentifiez-vous ou testez la connexion biométrique en 1 seconde',
    },
    fingerprintToggle: {
      sw: 'Tumia Fingerprint / Touch ID',
      en: 'Use Fingerprint / Touch ID',
      fr: 'Utiliser Empreinte / Touch ID',
    },
    faceIdToggle: {
      sw: 'Tumia Face ID (Utambuzi wa Sura)',
      en: 'Use Face ID (Facial Recognition)',
      fr: 'Utiliser Face ID (Reconnaissance Faciale)',
    },
    deviceStatus: {
      sw: 'Hali ya Kifaa: Bayometriki Ipo Tayari (WebAuthn Active)',
      en: 'Device Status: Biometric Sensors Ready (WebAuthn Active)',
      fr: 'État de l’appareil : Capteurs biométriques prêts',
    },
    twoFactorSection: {
      sw: 'Njia ya 2FA (Uthibitisho wa Hatua Mbili)',
      en: 'Two-Factor Authentication (2FA)',
      fr: 'Authentification à Deux Facteurs (2FA)',
    },
    smsOtpMethod: {
      sw: 'Ujumbe wa SMS (SMS OTP)',
      en: 'SMS OTP (Direct Home Page Delivery)',
      fr: 'SMS OTP (Direct sur la page d’accueil)',
    },
    directOtpDispatch: {
      sw: 'Tuma OTP moja kwa moja baada ya kujaza taarifa',
      en: 'Direct OTP dispatch after entering credentials',
      fr: 'Envoi direct de l’OTP après saisie des identifiants',
    },
    dataPrivacySection: {
      sw: 'Faragha na PDPA',
      en: 'Data Privacy & PDPA Compliance',
      fr: 'Confidentialité et Loi PDPA',
    },
    dataPrivacyDesc: {
      sw: 'Taarifa zako zote za afya zimehifadhiwa kwa ulinzi mkali wa AES-256.',
      en: 'All medical records and credentials are end-to-end encrypted with AES-256.',
      fr: 'Toutes les données de santé sont chiffrées de bout en bout avec AES-256.',
    },
    viewPdpaBtn: {
      sw: 'Tazama Masharti ya PDPA',
      en: 'View PDPA Privacy Policy',
      fr: 'Voir la politique de confidentialité PDPA',
    },
    saveChanges: {
      sw: 'Funga & Hifadhi Mipangilio',
      en: 'Close & Save Settings',
      fr: 'Fermer et Enregistrer',
    },
  },
  dashboard: {
    greetingMorning: {
      sw: 'Habari za Asubuhi',
      en: 'Good Morning',
      fr: 'Bonjour',
    },
    greetingAfternoon: {
      sw: 'Habari za Mchana',
      en: 'Good Afternoon',
      fr: 'Bon après-midi',
    },
    greetingEvening: {
      sw: 'Habari za Jioni',
      en: 'Good Evening',
      fr: 'Bonsoir',
    },
    verifiedCitizenBadge: {
      sw: 'Mwananchi Aliyethibitishwa',
      en: 'Verified Citizen ID',
      fr: 'Citoyen Vérifié',
    },
    verifiedTouristBadge: {
      sw: 'Mgeni / Mtalii Aliyethibitishwa',
      en: 'Verified International Tourist',
      fr: 'Visiteur International Vérifié',
    },
    passportTitle: {
      sw: 'Pasipoti ya Afya ya Kidijitali',
      en: 'Digital Health Passport',
      fr: 'Passeport Santé Numérique',
    },
    viewQr: {
      sw: 'Onyesha QR Code',
      en: 'Show QR Code',
      fr: 'Afficher le QR Code',
    },
    tapNfc: {
      sw: 'Gusa Kuingia (NFC Check-in)',
      en: 'Tap NFC Check-in',
      fr: 'NFC Scan Entrée',
    },
    vitalsTitle: {
      sw: 'Vipimo vya Afya (Live Vitals)',
      en: 'Live Health Vitals',
      fr: 'Signes Vitaux en Direct',
    },
    bloodPressure: {
      sw: 'Shinikizo la Damu',
      en: 'Blood Pressure',
      fr: 'Tension Artérielle',
    },
    bloodSugar: {
      sw: 'Kiwango cha Sukari',
      en: 'Blood Sugar',
      fr: 'Glycémie',
    },
    heartRate: {
      sw: 'Mapigo ya Moyo',
      en: 'Heart Rate',
      fr: 'Rythme Cardiaque',
    },
    weight: {
      sw: 'Uzito na BMI',
      en: 'Weight & BMI',
      fr: 'Poids & IMC',
    },
    normalStatus: {
      sw: 'Kawaida (Normal)',
      en: 'Normal',
      fr: 'Normal',
    },
    optimalStatus: {
      sw: 'Bora (Optimal)',
      en: 'Optimal',
      fr: 'Optimal',
    },
    quickActions: {
      sw: 'Huduma za Haraka',
      en: 'Quick Health Actions',
      fr: 'Actions Rapides',
    },
    bookAppointment: {
      sw: 'Weka Miadi',
      en: 'Book Appointment',
      fr: 'Prendre RDV',
    },
    bookAppointmentSub: {
      sw: 'Madaktari Bingwa',
      en: 'Specialist Doctors',
      fr: 'Médecins Spécialistes',
    },
    prescriptions: {
      sw: 'Dawa Zangu',
      en: 'My Prescriptions',
      fr: 'Mes Ordonnances',
    },
    prescriptionsSub: {
      sw: 'Kumbusho la Dawa',
      en: 'Refill & Reminders',
      fr: 'Rappels & Traitement',
    },
    personalFiles: {
      sw: 'Faili Zangu Binafsi',
      en: 'Personal Files Vault',
      fr: 'Dossiers Personnels',
    },
    personalFilesSub: {
      sw: 'Hifadhi ya PDF & Nyaraka',
      en: 'Stored PDFs & Scans',
      fr: 'Coffre-fort PDF & Scans',
    },
    labResults: {
      sw: 'Ripoti & Vipimo',
      en: 'Lab & Medical Records',
      fr: 'Analyses & Dossiers',
    },
    labResultsSub: {
      sw: 'Majibu ya Maabara',
      en: 'Verified Lab Reports',
      fr: 'Résultats Validés',
    },
    insuranceCoverage: {
      sw: 'Bima ya Afya',
      en: 'Insurance Status',
      fr: 'Assurance Maladie',
    },
    insuranceCoverageSub: {
      sw: 'Uthibitisho wa Bima',
      en: 'Coverage & Claims',
      fr: 'Couverture & Droits',
    },
    findFacility: {
      sw: 'Hospitali za Karibu',
      en: 'Nearby Clinics',
      fr: 'Cliniques Proches',
    },
    findFacilitySub: {
      sw: 'GPS & Saa 24/7',
      en: 'GPS Locator & 24/7',
      fr: 'GPS & Urgences 24/7',
    },
    aiConsult: {
      sw: 'Ushauri wa NiaAI',
      en: 'NiaAI Health Triage',
      fr: 'Triage Médical IA',
    },
    aiConsultSub: {
      sw: 'Uchambuzi wa Dalili',
      en: 'Instant Symptom Check',
      fr: 'Analyse des Symptômes',
    },
    checkoutBilling: {
      sw: 'Malipo & Checkout',
      en: 'Billing & Checkout',
      fr: 'Facturation & Sortie',
    },
    checkoutBillingSub: {
      sw: 'Bima au Pesa Taslimu',
      en: 'Insurance or Cash Pay',
      fr: 'Assurance ou Espèces',
    },
    upcomingTitle: {
      sw: 'Miadi Ijayo Hospitalini',
      en: 'Upcoming Hospital Visit',
      fr: 'Prochain Rendez-vous',
    },
    recentHistory: {
      sw: 'Historia ya Matibabu ya Hivi Karibuni',
      en: 'Recent Medical Encounters',
      fr: 'Historique Médical Récent',
    },
    activePrescriptionBanner: {
      sw: 'Kumbusho la Dawa: Amoxicillin 500mg (Kidonge 1 baada ya chakula)',
      en: 'Medication Reminder: Amoxicillin 500mg (1 capsule after meal)',
      fr: 'Rappel Médicament : Amoxicilline 500mg (1 gélule après repas)',
    },
    takePillNow: {
      sw: 'Nimetumia Sasa',
      en: 'Mark as Taken',
      fr: 'Pris à l’instant',
    },
    logoutBtn: {
      sw: 'Toka (Logout)',
      en: 'Sign Out',
      fr: 'Déconnexion',
    },
    switchProfile: {
      sw: 'Badili Taarifa / Rudi',
      en: 'Edit Info / Return',
      fr: 'Modifier / Retour',
    },
    downloadPdf: {
      sw: 'Pakua PDF',
      en: 'Download PDF',
      fr: 'Télécharger PDF',
    },
    activeInsuranceBadge: {
      sw: 'Bima Inafanya Kazi (Active)',
      en: 'Coverage Active',
      fr: 'Couverture Active',
    },
  },
} as const;

function wrapWithFallbackProxy<T extends Record<string, any>>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj;
  if ('en' in obj || 'sw' in obj) {
    return new Proxy(obj, {
      get(target, prop) {
        if (typeof prop === 'string') {
          if (prop in target && (target as any)[prop] !== undefined) {
            return (target as any)[prop];
          }
          return (target as any).en || (target as any).sw || Object.values(target)[0] || '';
        }
        return (target as any)[prop];
      },
    }) as T;
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[key] = wrapWithFallbackProxy((obj as any)[key]);
  }
  return result;
}

export const TRANSLATIONS = wrapWithFallbackProxy(RAW_TRANSLATIONS);

export function getTranslation<T = string>(
  lang: Language,
  obj: Record<string, T>
): T {
  return obj[lang] || obj.en || obj.sw || (Object.values(obj)[0] as T);
}

/**
 * Typed path-based translation helper. Falls back to English, then to the first
 * available language, then returns the path itself so missing keys are visible
 * in development but never crash production.
 */
export function t(path: string, lang: Language = 'en'): string {
  const parts = path.split('.');
  let current: any = RAW_TRANSLATIONS;
  for (const part of parts) {
    if (current == null || typeof current !== 'object' || !(part in current)) {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing translation path: ${path}`);
      }
      return path;
    }
    current = current[part];
  }
  if (current == null || typeof current !== 'object') {
    return String(current ?? path);
  }
  return getTranslation(lang, current);
}

const LANGUAGE_STORAGE_KEY = 'niacare-language';

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'en' || stored === 'sw' || stored === 'fr') return stored;
  return 'en';
}

export function storeLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export const SUPPORTED_LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'sw', label: 'Kiswahili', flag: '🇹🇿' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];
