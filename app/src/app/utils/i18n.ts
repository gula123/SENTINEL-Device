export type Language = "en" | "hu";

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Language
    "language.english": "English",
    "language.hungarian": "Hungarian",
    "language.selectLanguage": "Select Language",

    // Common
    "common.loading": "Loading...",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.error": "Error",
    "common.success": "Success",
    "common.close": "Close",
    "common.signOut": "Sign out",
    "common.notSet": "Not set",
    "common.na": "N/A",
    "common.points": "Points",
    "common.month": "Month",
    "common.year": "Year",
    "common.days": "Days",

    // Navigation
    "nav.home": "Home",
    "nav.logFood": "Log Food",
    "nav.habits": "Habits",
    "nav.progress": "Progress",
    "nav.settings": "Settings",

    // Login
    "login.title": "Health Tracker",
    "login.subtitle": "Your Personal Health Analytics Platform",
    "login.signInPrompt": "Sign in with your Google account to get started",
    "login.signInButton": "Sign in with Google",
    "login.signingIn": "Signing in...",
    "login.failed": "Sign-in failed",
    "login.error": "Google login failed. Please try again.",
    "login.footer": "We use Google OAuth for secure, password-less authentication.\nYour data remains private and secure.",

    // Home / Food Diary
    "home.title": "Daily Food Log",
    "home.today": "Today",
    "home.breakfast": "Breakfast",
    "home.lunch": "Lunch",
    "home.dinner": "Dinner",
    "home.snacks": "Snacks",
    "home.totalDaily": "Total Daily",
    "home.quick": "Quick Fill",
    "home.addFood": "Add Food",
    "home.logVacation": "Log as Vacation",
    "home.unlogVacation": "Remove Vacation",
    "home.vacationDay": "Vacation Day",
    "home.vacationMessage": "Nutrition tracking paused for today",
    "home.noFoodsLogged": "No foods logged yet",
    "home.startLogging": "Start logging food for today",

    // Meals
    "meal.breakfast": "Breakfast",
    "meal.lunch": "Lunch",
    "meal.dinner": "Dinner",
    "meal.snacks": "Snacks",

    // Settings
    "settings.title": "Settings",
    "settings.profile": "Profile",
    "settings.name": "Name",
    "settings.email": "Email",
    "settings.targetWeight": "Target Weight (kg)",
    "settings.perDayLimits": "Per-Day Limits",
    "settings.dailyTotals": "Daily Totals",
    "settings.perMealTargets": "Per-Meal Targets",
    "settings.calories": "Calories",
    "settings.protein": "Protein (g)",
    "settings.carbs": "Carbs (g)",
    "settings.fats": "Fats (g)",
    "settings.save": "Save Settings",
    "settings.saved": "Settings saved successfully",
    "settings.saveFailed": "Failed to save settings",
    "settings.language": "Language",
    "settings.selectDay": "Select a day to edit its limits",
    "settings.set": "Set",
    "settings.hint": "Set nutrition targets for each day of the week. Select a day to edit its limits.",
    "settings.loadingSettings": "Loading settings…",
    "settings.failedToLoadSettings": "Failed to load settings",
    "settings.retry": "Retry",
    "settings.signInAgain": "Sign in again",
    "settings.sessionExpired": "Session expired. Please sign in again.",

    // Habits
    "habits.title": "Habit Tracker",
    "habits.subtitle": "Track your daily habits and reach your goals",
    "habits.newHabit": "New Habit",
    "habits.loading": "Loading habits...",
    "habits.noHabits": "No habits yet",
    "habits.createFirst": "Create your first habit to get started!",
    "habits.create": "Create a Habit",
    "habits.everyDay": "Every day",
    "habits.daysPerWeek": "Days per week",
    "habits.daysPerMonth": "Days per month",
    "habits.complete": "Complete",
    "habits.incomplete": "Incomplete",

    // Habit Form
    "habitForm.createTitle": "Create New Habit",
    "habitForm.editTitle": "Edit Habit",
    "habitForm.name": "Habit Name *",
    "habitForm.namePlaceholder": "e.g., Morning Exercise",
    "habitForm.description": "Description (optional)",
    "habitForm.descriptionPlaceholder": "Add details about your habit...",
    "habitForm.setGoal": "Set a goal for this habit",
    "habitForm.goalType": "Goal Type",
    "habitForm.everyDay": "Every Day",
    "habitForm.daysPerWeek": "Days per week",
    "habitForm.daysPerMonth": "Days per month",
    "habitForm.target": "Target",
    "habitForm.create": "Create",
    "habitForm.update": "Update",
    "habitForm.cancel": "Cancel",
    "habitForm.loading": "Loading...",
    "habitForm.enterName": "Please enter a habit name",

    // Progress
    "progress.title": "Progress",
    "progress.statistics": "Statistics",
    "progress.totalWeightLost": "Total Weight Lost",
    "progress.averageMonthlyLoss": "Average Monthly Loss",
    "progress.targetWeight": "Target Weight",
    "progress.daysToTargetWeight": "Days to target weight",
    "progress.estimatedToReach": "Estimated to reach target",
    "progress.todaysWeight": "Today's Weight",
    "progress.kg": "kg",
    "progress.loading": "Loading monthly data…",
    "progress.loadFailed": "Failed to load progress",
    "progress.sessionExpired": "Session expired. Please sign in again.",
    "progress.signInAgain": "Sign in again",
    "progress.retry": "Retry",
    "progress.green": "Green",
    "progress.yellow": "Yellow",
    "progress.orange": "Orange",
    "progress.red": "Red",

    // Weight Diary
    "weight.title": "Weight Diary",
    "weight.sessionExpired": "Session expired",
    "weight.signInAgain": "Please sign in again.",
    "weight.signInButton": "Sign in again",
    "weight.progressChart": "Weight Progress",
    "weight.noData": "No weight data yet.",
    "weight.chartSubtitle": "Last 12 months (weekly points)",
    "weight.statistics": "Statistics",
    "weight.totalLost": "Total Lost",
    "weight.avgPerMonth": "Avg / Month",
    "weight.target": "Target",
    "weight.eta": "ETA",
    "weight.todaysWeight": "Today's Weight",
    "weight.notSet": "Not set",
    "weight.na": "N/A",
    "weight.kg": "kg",

    // Calendar
    "calendar.streak": "Streak",
    "calendar.green": "Green",
    "calendar.yellow": "Yellow",
    "calendar.red": "Red",
    "calendar.vacation": "Vacation",
    "calendar.streakTooltip": "Streak: consecutive Green days (≤108%)",
    "calendar.greenTooltip": "Green (≤108%)",
    "calendar.yellowTooltip": "Yellow (108–125%)",
    "calendar.redTooltip": "Red (>125%)",
    "calendar.vacationTooltip": "Vacation days (excluded from metrics)",

    // Macros
    "macro.protein": "Protein",
    "macro.carbs": "Carbs",
    "macro.fats": "Fats",
    "macro.calories": "Calories",
  },
  hu: {
    // Nyelv
    "language.english": "Angol",
    "language.hungarian": "Magyar",
    "language.selectLanguage": "Válassza ki a nyelvet",

    // Közös
    "common.loading": "Betöltés...",
    "common.save": "Mentés",
    "common.cancel": "Mégse",
    "common.delete": "Törlés",
    "common.edit": "Szerkesztés",
    "common.error": "Hiba",
    "common.success": "Siker",
    "common.close": "Bezárás",
    "common.signOut": "Kijelentkezés",
    "common.notSet": "Nincs beállítva",
    "common.na": "N/A",
    "common.points": "Pontok",
    "common.month": "Hónap",
    "common.year": "Év",
    "common.days": "Nap",

    // Navigáció
    "nav.home": "Kezdőlap",
    "nav.logFood": "Étel naplózása",
    "nav.habits": "Szokások",
    "nav.progress": "Fejlődés",
    "nav.settings": "Beállítások",

    // Bejelentkezés
    "login.title": "Egészség nyomkövető",
    "login.subtitle": "Az Ön személyes egészségelemzési platformja",
    "login.signInPrompt": "Jelentkezzen be Google-fiókjával az induláshoz",
    "login.signInButton": "Bejelentkezés a Google-lal",
    "login.signingIn": "Bejelentkezés...",
    "login.failed": "A bejelentkezés sikertelen",
    "login.error": "A Google bejelentkezés sikertelen. Kérjük, próbálja újra.",
    "login.footer": "Google OAuth-t használunk a biztonságos, jelszó nélküli hitelesítéshez.\nAdatai magánmarad és biztonságos.",

    // Kezdőlap / Ételnaplóz
    "home.title": "Napi ételnaplózás",
    "home.today": "Ma",
    "home.breakfast": "Reggeli",
    "home.lunch": "Ebéd",
    "home.dinner": "Vacsora",
    "home.snacks": "Nasik",
    "home.totalDaily": "Napi össz.",
    "home.quick": "Gyors kitöltés",
    "home.addFood": "Étel hozzáadása",
    "home.logVacation": "Szabadságként naplózás",
    "home.unlogVacation": "Szabadság eltávolítása",
    "home.vacationDay": "Szabadságnap",
    "home.vacationMessage": "Az étkezési követés szüneteltetettük erre a napra",
    "home.noFoodsLogged": "Még nem naplózott étel",
    "home.startLogging": "Kezdje el az étel naplózását ma",

    // Étkezések
    "meal.breakfast": "Reggeli",
    "meal.lunch": "Ebéd",
    "meal.dinner": "Vacsora",
    "meal.snacks": "Nasik",

    // Beállítások
    "settings.title": "Beállítások",
    "settings.profile": "Profil",
    "settings.name": "Név",
    "settings.email": "E-mail",
    "settings.targetWeight": "Cél súly (kg)",
    "settings.perDayLimits": "Napi korlátok",
    "settings.dailyTotals": "Napi összegek",
    "settings.perMealTargets": "Étkezésenként célok",
    "settings.calories": "Kalóriák",
    "settings.protein": "Fehérje (g)",
    "settings.carbs": "Szénhidrátok (g)",
    "settings.fats": "Zsír (g)",
    "settings.save": "Beállítások mentése",
    "settings.saved": "Beállítások sikeresen mentve",
    "settings.saveFailed": "Nem sikerült menteni a beállításokat",
    "settings.language": "Nyelv",
    "settings.selectDay": "Válasszon egy napot annak korlátainak szerkesztéséhez",
    "settings.set": "Beállítás",
    "settings.hint": "Állítson be táplálkozási célokat a hét minden napjára. Válasszon egy napot annak korlátainak szerkesztéséhez.",
    "settings.loadingSettings": "Beállítások betöltése…",
    "settings.failedToLoadSettings": "Nem sikerült betölteni a beállításokat",
    "settings.retry": "Próbálja újra",
    "settings.signInAgain": "Újra bejelentkezés",
    "settings.sessionExpired": "A munkamenet lejárt. Kérjük, jelentkezzen be újra.",

    // Szokások
    "habits.title": "Szokáskövetés",
    "habits.subtitle": "Kövesse nyomon napi szokásait és érje el céljait",
    "habits.newHabit": "Új szokás",
    "habits.loading": "Szokások betöltése...",
    "habits.noHabits": "Még nincsenek szokások",
    "habits.createFirst": "Hozza létre első szokását az induláshoz!",
    "habits.create": "Szokás létrehozása",
    "habits.everyDay": "Minden nap",
    "habits.daysPerWeek": "Nap/hét",
    "habits.daysPerMonth": "Nap/hónap",
    "habits.complete": "Befejezve",
    "habits.incomplete": "Befejezetlen",

    // Szokásforma
    "habitForm.createTitle": "Új szokás létrehozása",
    "habitForm.editTitle": "Szokás szerkesztése",
    "habitForm.name": "Szokás neve *",
    "habitForm.namePlaceholder": "pl. Reggeli edzés",
    "habitForm.description": "Leírás (nem kötelező)",
    "habitForm.descriptionPlaceholder": "Adjon hozzá részleteket szokásáról...",
    "habitForm.setGoal": "Állítson be célt ehhez a szokáshoz",
    "habitForm.goalType": "Cél típusa",
    "habitForm.everyDay": "Minden nap",
    "habitForm.daysPerWeek": "Nap/hét",
    "habitForm.daysPerMonth": "Nap/hónap",
    "habitForm.target": "Cél",
    "habitForm.create": "Létrehozás",
    "habitForm.update": "Frissítés",
    "habitForm.cancel": "Mégse",
    "habitForm.loading": "Betöltés...",
    "habitForm.enterName": "Kérjük, adjon meg egy szokás nevet",

    // Fejlődés
    "progress.title": "Fejlődés",
    "progress.statistics": "Statisztikák",
    "progress.totalWeightLost": "Teljes súlycsökkenés",
    "progress.averageMonthlyLoss": "Átlagos havi súlycsökkenés",
    "progress.targetWeight": "Cél súly",
    "progress.daysToTargetWeight": "Napok a cél súlyig",
    "progress.estimatedToReach": "Becsült elérési idő",
    "progress.todaysWeight": "Mai súly",
    "progress.kg": "kg",
    "progress.loading": "Havi adatok betöltése…",
    "progress.loadFailed": "Nem sikerült a fejlődés betöltése",
    "progress.sessionExpired": "A munkamenet lejárt. Kérjük, jelentkezzen be újra.",
    "progress.signInAgain": "Bejelentkezés újra",
    "progress.retry": "Újra",
    "progress.green": "Zöld",
    "progress.yellow": "Sárga",
    "progress.orange": "Narancssárga",
    "progress.red": "Piros",

    // Súly napló
    "weight.title": "Súly napló",
    "weight.sessionExpired": "A munkamenet lejárt",
    "weight.signInAgain": "Kérjük, jelentkezzen be újra.",
    "weight.signInButton": "Bejelentkezés újra",
    "weight.progressChart": "Súly fejlődése",
    "weight.noData": "Még nincs súlyadat.",
    "weight.chartSubtitle": "Utolsó 12 hónap (heti pontok)",
    "weight.statistics": "Statisztikák",
    "weight.totalLost": "Teljes vesztesség",
    "weight.avgPerMonth": "Átlag / Hónap",
    "weight.target": "Cél",
    "weight.eta": "ETA",
    "weight.todaysWeight": "Mai súly",
    "weight.notSet": "Nincs beállítva",
    "weight.na": "N/A",
    "weight.kg": "kg",

    // Naptár
    "calendar.streak": "Sorozat",
    "calendar.green": "Zöld",
    "calendar.yellow": "Sárga",
    "calendar.red": "Piros",
    "calendar.vacation": "Szabadság",
    "calendar.streakTooltip": "Sorozat: egymást követő zöld napok (≤108%)",
    "calendar.greenTooltip": "Zöld (≤108%)",
    "calendar.yellowTooltip": "Sárga (108–125%)",
    "calendar.redTooltip": "Piros (>125%)",
    "calendar.vacationTooltip": "Szabadságnap (kizárva a metrikákból)",

    // Makrók
    "macro.protein": "Fehérje",
    "macro.carbs": "Szénhidrátok",
    "macro.fats": "Zsír",
    "macro.calories": "Kalóriák",
  },
};

export const t = (language: Language, key: string): string => {
  return translations[language]?.[key] || translations.en[key] || key;
};

export const getMealLabel = (meal: string, language: Language): string => {
  const mealMap: Record<string, Record<Language, string>> = {
    BREAKFAST: { en: translations.en["home.breakfast"], hu: translations.hu["home.breakfast"] },
    LUNCH: { en: translations.en["home.lunch"], hu: translations.hu["home.lunch"] },
    DINNER: { en: translations.en["home.dinner"], hu: translations.hu["home.dinner"] },
    SNACKS: { en: translations.en["home.snacks"], hu: translations.hu["home.snacks"] },
  };
  return mealMap[meal]?.[language] || meal;
};

export const getDayLabels = (language: Language): string[] => {
  if (language === "hu") {
    return ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
  }
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
};

export const getDayShortLabel = (day: string, language: Language): string => {
  const dayMap: Record<string, Record<Language, string>> = {
    Monday: { en: "Mon", hu: "H" },
    Tuesday: { en: "Tue", hu: "K" },
    Wednesday: { en: "Wed", hu: "Sze" },
    Thursday: { en: "Thu", hu: "Cs" },
    Friday: { en: "Fri", hu: "P" },
    Saturday: { en: "Sat", hu: "Szo" },
    Sunday: { en: "Sun", hu: "V" },
  };
  return dayMap[day]?.[language] || day.substring(0, 3);
};
