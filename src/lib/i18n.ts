// i18n (§14): English default; Marathi and Hindi cover navigation, common
// actions, statuses and the parent screens first. Missing keys fall back to
// English. Translations need review by a native speaker before release.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';
import { PREF, secureStore } from './storage';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
] as const;
export type Language = (typeof LANGUAGES)[number]['code'];

const en = {
  tabs: {
    today: 'Today',
    timetable: 'Timetable',
    classes: 'Classes',
    inbox: 'Inbox',
    more: 'More',
    home: 'Home',
    attendance: 'Attendance',
    leave: 'Leave',
    schedule: 'Schedule',
    notices: 'Notices',
  },
  common: {
    retry: 'Try again',
    cancel: 'Cancel',
    save: 'Save',
    submit: 'Submit',
    close: 'Close',
    signOut: 'Sign out',
    offline: "You're offline. Showing saved data.",
    lastUpdated: 'Last updated {{time}}',
    loading: 'Loading…',
    nothingHere: 'Nothing here yet',
    notifications: 'Notifications',
    language: 'Language',
    settings: 'Settings',
    profile: 'Profile',
    calendar: 'Academic calendar',
    exams: 'Exams',
    today: 'Today',
    overall: 'Overall',
    theory: 'Theory',
    practical: 'Practical',
    held: 'Held',
    attended: 'Attended',
    absent: 'Absent',
    excused: 'Excused',
    send: 'Send',
  },
  status: {
    P: 'Present',
    A: 'Absent',
    L: 'On leave',
    OD: 'On duty',
    ML: 'Medical leave',
    EX: 'Excused',
    pending: 'Not marked yet',
  },
  standing: {
    safe: 'On track',
    warning: 'Close to the limit',
    shortage: 'Below {{min}}%',
    recover: 'Attend the next {{n}} lectures to reach {{min}}%',
    cannotRecover: 'Cannot reach {{min}}% this term',
  },
  parent: {
    switchChild: 'Switch child',
    todaySoFar: 'Today so far',
    presentOf: 'Present in {{present}} of {{marked}} marked lectures',
    absentIn: 'Absent in {{subject}} at {{time}}',
    noLecturesYet: 'No lectures marked yet today',
    alerts: 'Alerts',
    absences: 'Absences',
    approvedLeave: 'Approved leave',
    askAboutThis: 'Ask about this',
    askTitle: 'Ask the class teacher',
    askPlaceholder: 'What would you like to know?',
    askSent: 'Your question was sent to the class teacher.',
    preferences: 'Notification preferences',
    absenceInstant: 'Absence alerts as they happen',
    absenceDigest: 'One daily summary at 6:30 PM',
    shortageAlerts: 'Shortage and weekly summary alerts',
    noChildren: 'No verified student is linked to this account. Contact the college office.',
    contactUpdate: 'To change your phone number, contact the college office. It is verified again before use.',
  },
};

type Dict = { [k: string]: string | Dict };

const mr: Dict = {
  tabs: { today: 'आज', timetable: 'वेळापत्रक', classes: 'वर्ग', inbox: 'इनबॉक्स', more: 'अधिक', home: 'मुख्यपृष्ठ', attendance: 'उपस्थिती', leave: 'रजा', schedule: 'वेळापत्रक', notices: 'सूचना' },
  common: {
    retry: 'पुन्हा प्रयत्न करा', cancel: 'रद्द करा', save: 'जतन करा', submit: 'सबमिट करा', close: 'बंद करा', signOut: 'साइन आउट',
    offline: 'तुम्ही ऑफलाइन आहात. जतन केलेली माहिती दाखवत आहोत.', lastUpdated: 'शेवटचे अद्यतन {{time}}', loading: 'लोड होत आहे…',
    nothingHere: 'अजून काहीही नाही', notifications: 'सूचना', language: 'भाषा', settings: 'सेटिंग्ज', profile: 'प्रोफाइल',
    calendar: 'शैक्षणिक दिनदर्शिका', exams: 'परीक्षा', today: 'आज', overall: 'एकूण', theory: 'थिअरी', practical: 'प्रॅक्टिकल',
    held: 'झालेली', attended: 'उपस्थित', absent: 'अनुपस्थित', excused: 'सूट', send: 'पाठवा',
  },
  status: { P: 'उपस्थित', A: 'अनुपस्थित', L: 'रजेवर', OD: 'ऑन ड्युटी', ML: 'वैद्यकीय रजा', EX: 'सूट', pending: 'अजून नोंद नाही' },
  standing: {
    safe: 'योग्य मार्गावर', warning: 'मर्यादेच्या जवळ', shortage: '{{min}}% पेक्षा कमी',
    recover: '{{min}}% गाठण्यासाठी पुढील {{n}} लेक्चर्सना हजर राहा', cannotRecover: 'या सत्रात {{min}}% गाठणे शक्य नाही',
  },
  parent: {
    switchChild: 'पाल्य बदला', todaySoFar: 'आजपर्यंत', presentOf: '{{marked}} पैकी {{present}} लेक्चर्सना उपस्थित',
    absentIn: '{{time}} वाजता {{subject}} मध्ये अनुपस्थित', noLecturesYet: 'आज अजून कोणतेही लेक्चर नोंदवले नाही', alerts: 'सूचना',
    absences: 'अनुपस्थिती', approvedLeave: 'मंजूर रजा', askAboutThis: 'याबद्दल विचारा', askTitle: 'वर्गशिक्षकांना विचारा',
    askPlaceholder: 'तुम्हाला काय जाणून घ्यायचे आहे?', askSent: 'तुमचा प्रश्न वर्गशिक्षकांना पाठवला आहे.', preferences: 'सूचना प्राधान्ये',
    absenceInstant: 'अनुपस्थितीची सूचना लगेच', absenceDigest: 'रोज संध्याकाळी 6:30 वाजता एक सारांश', shortageAlerts: 'कमतरता आणि साप्ताहिक सारांश',
    noChildren: 'या खात्याशी कोणताही पडताळलेला विद्यार्थी जोडलेला नाही. महाविद्यालय कार्यालयाशी संपर्क साधा.',
    contactUpdate: 'फोन नंबर बदलण्यासाठी महाविद्यालय कार्यालयाशी संपर्क साधा. वापरण्यापूर्वी तो पुन्हा पडताळला जातो.',
  },
};

const hi: Dict = {
  tabs: { today: 'आज', timetable: 'समय सारणी', classes: 'कक्षाएँ', inbox: 'इनबॉक्स', more: 'और', home: 'होम', attendance: 'उपस्थिति', leave: 'छुट्टी', schedule: 'समय सारणी', notices: 'सूचनाएँ' },
  common: {
    retry: 'फिर से कोशिश करें', cancel: 'रद्द करें', save: 'सेव करें', submit: 'जमा करें', close: 'बंद करें', signOut: 'साइन आउट',
    offline: 'आप ऑफ़लाइन हैं। सेव किया गया डेटा दिखा रहे हैं।', lastUpdated: 'अंतिम अपडेट {{time}}', loading: 'लोड हो रहा है…',
    nothingHere: 'अभी कुछ नहीं है', notifications: 'सूचनाएँ', language: 'भाषा', settings: 'सेटिंग्स', profile: 'प्रोफ़ाइल',
    calendar: 'शैक्षणिक कैलेंडर', exams: 'परीक्षाएँ', today: 'आज', overall: 'कुल', theory: 'थ्योरी', practical: 'प्रैक्टिकल',
    held: 'हुए', attended: 'उपस्थित', absent: 'अनुपस्थित', excused: 'छूट', send: 'भेजें',
  },
  status: { P: 'उपस्थित', A: 'अनुपस्थित', L: 'छुट्टी पर', OD: 'ऑन ड्यूटी', ML: 'चिकित्सा अवकाश', EX: 'छूट', pending: 'अभी दर्ज नहीं' },
  standing: {
    safe: 'सही दिशा में', warning: 'सीमा के करीब', shortage: '{{min}}% से कम',
    recover: '{{min}}% तक पहुँचने के लिए अगले {{n}} लेक्चर में उपस्थित रहें', cannotRecover: 'इस सत्र में {{min}}% तक पहुँचना संभव नहीं',
  },
  parent: {
    switchChild: 'बच्चा बदलें', todaySoFar: 'आज अब तक', presentOf: '{{marked}} में से {{present}} लेक्चर में उपस्थित',
    absentIn: '{{time}} बजे {{subject}} में अनुपस्थित', noLecturesYet: 'आज अभी कोई लेक्चर दर्ज नहीं', alerts: 'सूचनाएँ',
    absences: 'अनुपस्थिति', approvedLeave: 'स्वीकृत छुट्टी', askAboutThis: 'इसके बारे में पूछें', askTitle: 'कक्षा शिक्षक से पूछें',
    askPlaceholder: 'आप क्या जानना चाहते हैं?', askSent: 'आपका प्रश्न कक्षा शिक्षक को भेज दिया गया है।', preferences: 'सूचना प्राथमिकताएँ',
    absenceInstant: 'अनुपस्थिति की सूचना तुरंत', absenceDigest: 'रोज़ शाम 6:30 बजे एक सारांश', shortageAlerts: 'कमी और साप्ताहिक सारांश',
    noChildren: 'इस खाते से कोई सत्यापित छात्र जुड़ा नहीं है। कॉलेज कार्यालय से संपर्क करें।',
    contactUpdate: 'फ़ोन नंबर बदलने के लिए कॉलेज कार्यालय से संपर्क करें। उपयोग से पहले इसे फिर से सत्यापित किया जाता है।',
  },
};

function initialLanguage(): Language {
  try {
    const saved = secureStore().getString(PREF.language) as Language | undefined;
    if (saved && LANGUAGES.some(l => l.code === saved)) {
      return saved;
    }
  } catch {
    // storage not ready: fall through to the device language
  }
  const device = getLocales()[0]?.languageCode;
  return device === 'mr' || device === 'hi' ? device : 'en';
}

export function initI18n() {
  if (i18n.isInitialized) {
    return i18n;
  }
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, mr: { translation: mr }, hi: { translation: hi } },
    lng: initialLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18n;
}

export function setLanguage(code: Language) {
  secureStore().set(PREF.language, code);
  i18n.changeLanguage(code);
}

export default i18n;
