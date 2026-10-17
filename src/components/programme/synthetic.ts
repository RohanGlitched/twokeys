// A made-up, emirate-wide month (all 22 screening centres), sized from the programme's published
// numbers so the view can be read at its real scale. Describes nobody; always labelled synthetic.
// Sizing (BUSINESS.md): 11,748 couples tested 2022 to July 2026, ~800 of them in the 2022–24 pilot,
// so about 6,000 couples a year since the October 2024 mandate, or ~500 a month; 4.8% of couples at
// increased chance gives ~24 a month. Everything below that line is an assumption to test.
// Values are exact. A real weekly release adds discrete Laplace noise (ε = 1/7 per count, a standard
// deviation of about 10), so counts this small are best read over a quarter.

export const SYNTHETIC_MONTH = {
  month: { en: 'September 2026', ar: 'سبتمبر 2026' },
  couplesWithResults: 500,
  couplesAtIncreasedChance: 24, // reported by the lab; Two Keys never learns which couples
  counselling: {
    booked: 31, // 21 of the 24 couples at increased chance, plus 10 people asking about their own results
    bookedByCouplesAtIncreasedChance: 21,
    reached: 29,
    reachedWithinTarget: 27,
    reachedLate: 2,
    notYetReachedPastTarget: 1, // at month end
    withdrawn: 1,
    referred: 12,
    medianHoursToFirstContact: 6,
    bookedInArabic: 21,
  },
  family: {
    couplesSendingANote: 14, // of the 24 couples at increased chance
    notesSent: 64,
    relativesSaidBooked: 9,
  },
  // The pilot's primary outcome, read six months after enrolment from lab records (a read-only
  // Malaffi extract), not from the app. Shown for the couples enrolled in March 2026.
  cascade: {
    cohort: { en: 'March 2026 cohort', ar: 'دفعة مارس 2026' },
    couplesEnrolled: 23,
    marriedRelativesListed: 131,
    relativesTestedWithin6Months: 29,
  },
  understanding: {
    ar: { people: 252, allThreeRight: 192 },
    en: { people: 128, allThreeRight: 104 },
    simple: { people: 96, allThreeRight: 70 },
    standard: { people: 214, allThreeRight: 171 },
    detailed: { people: 70, allThreeRight: 55 },
  },
} as const;
