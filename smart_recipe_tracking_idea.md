# Smart Recipe Tracking by Final Cooked Weight

## Problem
Most calorie tracking apps make recipe logging unnecessarily complicated because users must think in:
- portions,
- raw vs cooked conversions,
- fractional servings,
- evaporation,
- water absorption.

This creates mental friction and makes meal tracking feel like accounting instead of a quick daily habit.

People naturally think:
- “I ate 320g from the meal”
not:
- “I ate 0.23 portions.”

---

# Core Idea

The system should calculate nutrition values based on:

1. Raw ingredient nutrition values
2. Final cooked meal weight

Then users can simply log:
- how many grams they ate from the finished meal.

---

# Workflow

## 1. Add Raw Ingredients
User adds ingredients with raw weights.

Example:
- 500g chicken breast
- 200g uncooked rice
- 20g olive oil

The app calculates:
- total calories
- protein
- carbs
- fat

Example total:
- 1800 kcal

---

## 2. Add Final Cooked Meal Weight
After cooking, user weighs the entire finished meal.

Example:
- final cooked weight = 1350g

This automatically accounts for:
- water evaporation,
- absorbed water,
- sauce reduction,
- cooking changes.

No manual conversion needed.

---

# Calculation Logic

## Calories Per Gram

\[
\text{kcal per gram} = \frac{\text{total recipe kcal}}{\text{final cooked weight}}
\]

Example:

\[
\frac{1800}{1350} = 1.33 \text{ kcal/g}
\]

---

## Calories Per 100g

\[
\text{kcal per 100g} =
\frac{\text{total recipe kcal}}{\text{final cooked weight}} \times 100
\]

Example:

\[
\frac{1800}{1350} \times 100 = 133 \text{ kcal/100g}
\]

---

# Logging a Meal

User simply enters:
- “I ate 340g”

Calculation:

\[
340 \times 1.33 = 452 \text{ kcal}
\]

Result:
- 452 kcal logged automatically.

The same calculation applies for:
- protein,
- carbs,
- fat,
- fiber,
- other nutrients.

---

# UX Advantages

## Natural Mental Model
Users think in:
- grams on a plate,
not:
- fractional portions.

---

## Less Cognitive Load
No need for:
- serving calculations,
- raw/cooked conversions,
- estimating portions.

---

## More Accurate Than Portion Systems
Using final cooked weight automatically handles:
- evaporation,
- water absorption,
- cooking losses/gains.

---

## Better for Batch Cooking
Perfect for:
- meal prep,
- soups,
- stews,
- pasta,
- rice dishes,
- casseroles.

---

# Optional Features

## Portion Shortcuts
Users can still create convenience portions:
- 1 bowl = 350g
- 1 slice = 120g

But internally everything remains gram-based.

---

## Auto-generated Nutrition Label
The app can automatically show:
- kcal per 100g
- macros per 100g

similar to commercial food packaging.

---

# Main UX Philosophy

The goal is not laboratory-perfect tracking.

The goal is:
- fast,
- intuitive,
- sustainable calorie tracking with minimal mental effort.
