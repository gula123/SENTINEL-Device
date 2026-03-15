import dayjs from "dayjs";
import { authenticatedFetch } from "../api/client";

export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export interface MacroLimits {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface RawDayLimits {
  overall?: Partial<MacroLimits>;
  meals?: {
    breakfast?: Partial<MacroLimits>;
    lunch?: Partial<MacroLimits>;
    dinner?: Partial<MacroLimits>;
    snacks?: Partial<MacroLimits>;
  };
}

export interface UserSettingsDto {
  name?: string;
  email?: string;
  targetWeight?: number | null;
  dailyCalorieLimit?: number;
  dailyProteinLimit?: number;
  dailyCarbsLimit?: number;
  dailyFatsLimit?: number;
  perDayCalorieLimits?: string | Record<string, RawDayLimits>;
}

export interface PerDayLimitsResolved {
  [key: string]: {
    overall: MacroLimits;
    meals: {
      breakfast: MacroLimits;
      lunch: MacroLimits;
      dinner: MacroLimits;
      snacks: MacroLimits;
    };
  };
}

export interface DayResolvedLimits {
  overall: MacroLimits;
  mealCalories: {
    BREAKFAST: number;
    LUNCH: number;
    DINNER: number;
    SNACKS: number;
  };
  mealMacros: {
    BREAKFAST: { protein: number; carbs: number; fats: number };
    LUNCH: { protein: number; carbs: number; fats: number };
    DINNER: { protein: number; carbs: number; fats: number };
    SNACKS: { protein: number; carbs: number; fats: number };
  };
}

const defaultOverall = (settings: UserSettingsDto): MacroLimits => ({
  calories: settings.dailyCalorieLimit ?? 2000,
  protein: settings.dailyProteinLimit ?? 150,
  carbs: settings.dailyCarbsLimit ?? 250,
  fats: settings.dailyFatsLimit ?? 65,
});

export const parsePerDay = (value: UserSettingsDto["perDayCalorieLimits"]): Record<string, RawDayLimits> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, RawDayLimits>;
    } catch {
      return null;
    }
  }

  return value;
};

const defaultMealLimits = (overall: MacroLimits) => ({
  breakfast: { calories: Math.round(overall.calories * 0.30), protein: 30, carbs: 75, fats: 15 },
  lunch: { calories: Math.round(overall.calories * 0.35), protein: 40, carbs: 85, fats: 20 },
  dinner: { calories: Math.round(overall.calories * 0.30), protein: 35, carbs: 75, fats: 18 },
  snacks: { calories: Math.max(0, Math.round(overall.calories * 0.05)), protein: 5, carbs: 15, fats: 3 },
});

export const resolvePerDayLimitsForEdit = (settings: UserSettingsDto | undefined): PerDayLimitsResolved => {
  const safeSettings = settings || {};
  const overall = defaultOverall(safeSettings);
  const raw = parsePerDay(safeSettings.perDayCalorieLimits);

  const result: PerDayLimitsResolved = {};
  DAYS_OF_WEEK.forEach((day) => {
    const dayRaw = raw?.[day];
    const dayOverall: MacroLimits = {
      calories: dayRaw?.overall?.calories ?? overall.calories,
      protein: dayRaw?.overall?.protein ?? overall.protein,
      carbs: dayRaw?.overall?.carbs ?? overall.carbs,
      fats: dayRaw?.overall?.fats ?? overall.fats,
    };

    const defaults = defaultMealLimits(dayOverall);

    result[day] = {
      overall: dayOverall,
      meals: {
        breakfast: {
          calories: dayRaw?.meals?.breakfast?.calories ?? defaults.breakfast.calories,
          protein: dayRaw?.meals?.breakfast?.protein ?? defaults.breakfast.protein,
          carbs: dayRaw?.meals?.breakfast?.carbs ?? defaults.breakfast.carbs,
          fats: dayRaw?.meals?.breakfast?.fats ?? defaults.breakfast.fats,
        },
        lunch: {
          calories: dayRaw?.meals?.lunch?.calories ?? defaults.lunch.calories,
          protein: dayRaw?.meals?.lunch?.protein ?? defaults.lunch.protein,
          carbs: dayRaw?.meals?.lunch?.carbs ?? defaults.lunch.carbs,
          fats: dayRaw?.meals?.lunch?.fats ?? defaults.lunch.fats,
        },
        dinner: {
          calories: dayRaw?.meals?.dinner?.calories ?? defaults.dinner.calories,
          protein: dayRaw?.meals?.dinner?.protein ?? defaults.dinner.protein,
          carbs: dayRaw?.meals?.dinner?.carbs ?? defaults.dinner.carbs,
          fats: dayRaw?.meals?.dinner?.fats ?? defaults.dinner.fats,
        },
        snacks: {
          calories: dayRaw?.meals?.snacks?.calories ?? defaults.snacks.calories,
          protein: dayRaw?.meals?.snacks?.protein ?? defaults.snacks.protein,
          carbs: dayRaw?.meals?.snacks?.carbs ?? defaults.snacks.carbs,
          fats: dayRaw?.meals?.snacks?.fats ?? defaults.snacks.fats,
        },
      },
    };
  });

  return result;
};

export const fetchUserSettings = async (token: string): Promise<UserSettingsDto> => {
  const response = await authenticatedFetch("/user-settings", token, { method: "GET" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch user settings (${response.status})`);
  }
  return response.json();
};

export const saveUserSettings = async (
  token: string,
  payload: {
    name?: string;
    email?: string;
    targetWeight?: number | null;
    dailyCalorieLimit: number;
    dailyProteinLimit: number;
    dailyCarbsLimit: number;
    dailyFatsLimit: number;
    perDayCalorieLimits: PerDayLimitsResolved;
  }
): Promise<UserSettingsDto> => {
  const response = await authenticatedFetch("/user-settings", token, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      perDayCalorieLimits: JSON.stringify(payload.perDayCalorieLimits),
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to save settings (${response.status})`);
  }

  return response.json();
};

export const resolveDayLimits = (settings: UserSettingsDto | undefined, date: string): DayResolvedLimits => {
  const safeSettings = settings || {};
  const overallBase = defaultOverall(safeSettings);

  const perDay = parsePerDay(safeSettings.perDayCalorieLimits);
  const dayKey = dayjs(date).format("dddd");
  const dayConfig = perDay?.[dayKey];

  const overall: MacroLimits = dayConfig?.overall
    ? {
        calories: dayConfig.overall.calories ?? overallBase.calories,
        protein: dayConfig.overall.protein ?? overallBase.protein,
        carbs: dayConfig.overall.carbs ?? overallBase.carbs,
        fats: dayConfig.overall.fats ?? overallBase.fats,
      }
    : overallBase;

  const fallback = {
    BREAKFAST: Math.round(overall.calories * 0.30),
    LUNCH: Math.round(overall.calories * 0.35),
    DINNER: Math.round(overall.calories * 0.30),
    SNACKS: Math.max(0, Math.round(overall.calories * 0.05)),
  };

  return {
    overall,
    mealCalories: {
      BREAKFAST: dayConfig?.meals?.breakfast?.calories != null ? Math.round(dayConfig.meals.breakfast.calories) : fallback.BREAKFAST,
      LUNCH: dayConfig?.meals?.lunch?.calories != null ? Math.round(dayConfig.meals.lunch.calories) : fallback.LUNCH,
      DINNER: dayConfig?.meals?.dinner?.calories != null ? Math.round(dayConfig.meals.dinner.calories) : fallback.DINNER,
      SNACKS: dayConfig?.meals?.snacks?.calories != null ? Math.round(dayConfig.meals.snacks.calories) : fallback.SNACKS,
    },
    mealMacros: {
      BREAKFAST: {
        protein: dayConfig?.meals?.breakfast?.protein != null ? Math.round(dayConfig.meals.breakfast.protein) : 30,
        carbs: dayConfig?.meals?.breakfast?.carbs != null ? Math.round(dayConfig.meals.breakfast.carbs) : 75,
        fats: dayConfig?.meals?.breakfast?.fats != null ? Math.round(dayConfig.meals.breakfast.fats) : 15,
      },
      LUNCH: {
        protein: dayConfig?.meals?.lunch?.protein != null ? Math.round(dayConfig.meals.lunch.protein) : 40,
        carbs: dayConfig?.meals?.lunch?.carbs != null ? Math.round(dayConfig.meals.lunch.carbs) : 85,
        fats: dayConfig?.meals?.lunch?.fats != null ? Math.round(dayConfig.meals.lunch.fats) : 20,
      },
      DINNER: {
        protein: dayConfig?.meals?.dinner?.protein != null ? Math.round(dayConfig.meals.dinner.protein) : 35,
        carbs: dayConfig?.meals?.dinner?.carbs != null ? Math.round(dayConfig.meals.dinner.carbs) : 75,
        fats: dayConfig?.meals?.dinner?.fats != null ? Math.round(dayConfig.meals.dinner.fats) : 18,
      },
      SNACKS: {
        protein: dayConfig?.meals?.snacks?.protein != null ? Math.round(dayConfig.meals.snacks.protein) : 5,
        carbs: dayConfig?.meals?.snacks?.carbs != null ? Math.round(dayConfig.meals.snacks.carbs) : 15,
        fats: dayConfig?.meals?.snacks?.fats != null ? Math.round(dayConfig.meals.snacks.fats) : 3,
      },
    },
  };
};
