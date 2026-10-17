// A made-up, emirate-wide month (all 22 screening centres) as it might look after rollout (month 31
// onwards in the pilot timeline), sized from the programme's published numbers so the view can be read
// at its real scale. Describes nobody; always labelled synthetic and illustrative.
// Sizing (BUSINESS.md): 11,748 couples tested 2022 to July 2026, ~800 of them in the 2022–24 pilot,
// so about 6,000 couples a year since the October 2024 mandate, or ~500 a month; 4.8% of couples at
// increased chance gives ~24 a month. Everything below that line is an assumption to test.
// Values are exact. A real weekly release adds discrete Laplace noise (ε = 1/7 per count, a standard
// deviation of about 10), so counts this small are best read over a quarter.

export const SYNTHETIC_MONTH = {
  month: { en: 'an illustrative month after rollout (month 31 onwards)', ar: 'شهر توضيحي بعد التعميم (من الشهر 31 فصاعداً)' },
  couplesWithResults: 500,
  couplesAtIncreasedChance: 24, // reported by the lab; the lab computes the match and keeps the named genes for one day
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
    // Notes aren't linked to couples, so the app can't count couples who sent one. This is the pilot's
    // own study measure (asked at follow-up), shown as an illustration, not a live count.
    couplesSendingANoteStudyMeasure: 14, // of the 24 couples at increased chance
    notesSent: 64,
    relativesSaidBooked: 9,
  },
  // An illustrative pilot readout. In both arms each enrolled couple gets a family study code to pass on;
  // a relative tested under that code is counted at the lab, consenting when tested. Couples give the number
  // of married relatives of reproductive age they have (a count, never names). 18 of 24 couples enrol (75%).
  cascade: {
    cohort: { en: 'Illustrative pilot readout', ar: 'قراءة توضيحية لنتائج التجربة' },
    couplesAtIncreasedChance: 24,
    couplesEnrolled: 18,
    marriedRelativesCounted: 108,
    relativesTestedWithin6Months: 25,
  },
  understanding: {
    ar: { people: 252, allThreeRight: 192 },
    en: { people: 128, allThreeRight: 104 },
    simple: { people: 96, allThreeRight: 70 },
    standard: { people: 214, allThreeRight: 171 },
    detailed: { people: 70, allThreeRight: 55 },
  },
} as const;
