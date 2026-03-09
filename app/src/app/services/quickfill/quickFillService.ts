import { addFoodLog, searchFoods, type MealType } from "../food/foodLogsApi";
import type { DayResolvedLimits } from "../settings/userSettingsApi";

export interface CurrentTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const mealOrder: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"];

const round1 = (value: number) => Math.round(value * 10) / 10;

export const applyQuickFillDay = async (input: {
  token: string;
  date: string;
  multiplier: number;
  totals: CurrentTotals;
  limits: DayResolvedLimits;
}): Promise<{ createdEntries: number; skipped: boolean }> => {
  const { token, date, multiplier, totals, limits } = input;

  const targetCalories = Math.round(limits.overall.calories * multiplier);
  const additionalCalories = Math.max(0, targetCalories - totals.calories);
  if (additionalCalories <= 0) {
    return { createdEntries: 0, skipped: true };
  }

  const macroCalories =
    (limits.overall.protein * 4) +
    (limits.overall.carbs * 4) +
    (limits.overall.fats * 9);

  const proteinShare = macroCalories > 0 ? (limits.overall.protein * 4) / macroCalories : 0;
  const carbsShare = macroCalories > 0 ? (limits.overall.carbs * 4) / macroCalories : 1;
  const fatsShare = macroCalories > 0 ? (limits.overall.fats * 9) / macroCalories : 0;

  const additionalProtein = round1((additionalCalories * proteinShare) / 4);
  const additionalCarbs = round1((additionalCalories * carbsShare) / 4);
  const additionalFats = round1((additionalCalories * fatsShare) / 9);

  const totalMealCalories =
    mealOrder.reduce((sum, meal) => sum + Math.max(0, limits.mealCalories[meal]), 0) || 1;

  const quickFillFoods = await searchFoods(token, "Quick Fill");
  const proteinFood = quickFillFoods.find((food) => food.name.toLowerCase() === "quick fill protein");
  const carbsFood = quickFillFoods.find((food) => food.name.toLowerCase() === "quick fill carbs");
  const fatsFood = quickFillFoods.find((food) => food.name.toLowerCase() === "quick fill fats");

  if (!proteinFood || !carbsFood || !fatsFood) {
    throw new Error("Quick Fill nutrient foods are missing in database");
  }

  let remainingProtein = additionalProtein;
  let remainingCarbs = additionalCarbs;
  let remainingFats = additionalFats;
  let createdEntries = 0;

  for (let index = 0; index < mealOrder.length; index++) {
    const mealType = mealOrder[index];
    const isLast = index === mealOrder.length - 1;
    const ratio = Math.max(0, limits.mealCalories[mealType]) / totalMealCalories;

    const mealProtein = isLast ? Math.max(0, round1(remainingProtein)) : Math.max(0, round1(additionalProtein * ratio));
    const mealCarbs = isLast ? Math.max(0, round1(remainingCarbs)) : Math.max(0, round1(additionalCarbs * ratio));
    const mealFats = isLast ? Math.max(0, round1(remainingFats)) : Math.max(0, round1(additionalFats * ratio));

    remainingProtein = round1(remainingProtein - mealProtein);
    remainingCarbs = round1(remainingCarbs - mealCarbs);
    remainingFats = round1(remainingFats - mealFats);

    const entries = [
      { foodId: proteinFood.id, foodName: proteinFood.name, grams: mealProtein },
      { foodId: carbsFood.id, foodName: carbsFood.name, grams: mealCarbs },
      { foodId: fatsFood.id, foodName: fatsFood.name, grams: mealFats },
    ];

    for (const entry of entries) {
      if (entry.grams <= 0) {
        continue;
      }

      await addFoodLog(token, {
        foodName: entry.foodName,
        foodId: entry.foodId,
        grams: entry.grams,
        mealType,
        logDate: date,
      });
      createdEntries++;
    }
  }

  return { createdEntries, skipped: createdEntries === 0 };
};
