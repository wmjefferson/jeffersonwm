import json

data = {
    "project": "Everyday Life RPG Systems Dataset",
    "version": "2.0.0",
    "counts": {
        "actions": 0,
        "motives": 50,
        "categories": 11
    },
    "schema_notes": {
        "energy_delta": "Positive replenishes energy, negative spends it.",
        "stress_delta": "Negative reduces stress; positive increases pressure.",
        "money_delta": "Positive gains money; negative spends it.",
        "social_delta": "Positive improves social fulfillment or relationship progress.",
        "health_delta": "Positive supports physical wellbeing.",
        "hygiene_delta": "Positive improves cleanliness and self-care status.",
        "fun_delta": "Positive increases enjoyment or recreation.",
        "discipline_delta": "Positive improves routine, consistency, or self-control progress."
    },
    "categories": [
        {"id": "basic_needs", "label": "Basic Needs"},
        {"id": "food_cooking", "label": "Food Cooking"},
        {"id": "home_care", "label": "Home Care"},
        {"id": "work_study", "label": "Work Study"},
        {"id": "money_admin", "label": "Money Admin"},
        {"id": "health_fitness", "label": "Health Fitness"},
        {"id": "social_relationships", "label": "Social Relationships"},
        {"id": "leisure_growth", "label": "Leisure Growth"},
        {"id": "errands_mobility", "label": "Errands Mobility"},
        {"id": "caregiving_parenting", "label": "Caregiving Parenting"},
        {"id": "maintenance_repair", "label": "Maintenance Repair"}
    ],
    "motives": [
        {"id": "survival", "label": "Survival", "description": "Maintain food, water, sleep, hygiene, and shelter."},
        {"id": "health", "label": "Health", "description": "Improve physical wellness, energy, recovery, and resilience."},
        {"id": "mental_stability", "label": "Mental Stability", "description": "Reduce stress and keep mood, focus, and emotional balance steady."},
        {"id": "comfort", "label": "Comfort", "description": "Make daily life feel safer, cleaner, calmer, and more pleasant."},
        {"id": "routine", "label": "Routine", "description": "Build repeatable habits and a reliable day-to-day structure."},
        {"id": "discipline", "label": "Discipline", "description": "Become more consistent, controlled, and dependable over time."},
        {"id": "productivity", "label": "Productivity", "description": "Get more done with less friction and less wasted time."},
        {"id": "mastery", "label": "Mastery", "description": "Improve skills through repetition, study, and deliberate practice."},
        {"id": "education", "label": "Education", "description": "Learn formally or informally to expand knowledge and options."},
        {"id": "career", "label": "Career", "description": "Advance work status, competence, reputation, and opportunity."},
        {"id": "wealth", "label": "Wealth", "description": "Accumulate money, assets, savings, and financial security."},
        {"id": "stability", "label": "Stability", "description": "Create a dependable life with fewer emergencies and disruptions."},
        {"id": "independence", "label": "Independence", "description": "Rely less on others for money, housing, transport, and decisions."},
        {"id": "belonging", "label": "Belonging", "description": "Feel connected to family, friends, groups, and community."},
        {"id": "love", "label": "Love", "description": "Build affection, trust, intimacy, and lasting partnership."},
        {"id": "friendship", "label": "Friendship", "description": "Create and maintain supportive reciprocal social bonds."},
        {"id": "family", "label": "Family", "description": "Strengthen family relationships, care, and shared responsibility."},
        {"id": "reputation", "label": "Reputation", "description": "Be seen as reliable, kind, skilled, attractive, or respectable."},
        {"id": "service", "label": "Service", "description": "Help others and contribute in practical or emotional ways."},
        {"id": "community", "label": "Community", "description": "Become part of a larger social fabric and shared place."},
        {"id": "meaning", "label": "Meaning", "description": "Feel that life and effort matter beyond short-term tasks."},
        {"id": "identity", "label": "Identity", "description": "Become the kind of person the character wants to be."},
        {"id": "self_expression", "label": "Self Expression", "description": "Communicate personality, taste, feelings, and creativity."},
        {"id": "creativity", "label": "Creativity", "description": "Make original things and develop artistic or imaginative ability."},
        {"id": "fun", "label": "Fun", "description": "Seek enjoyment, amusement, novelty, and playful relief."},
        {"id": "restoration", "label": "Restoration", "description": "Recover from fatigue, burnout, conflict, or illness."},
        {"id": "security", "label": "Security", "description": "Reduce risk, danger, debt, scarcity, and uncertainty."},
        {"id": "order", "label": "Order", "description": "Create cleanliness, structure, predictability, and control."},
        {"id": "control", "label": "Control", "description": "Feel agency over schedule, body, space, and future."},
        {"id": "freedom", "label": "Freedom", "description": "Open more choices in time, place, money, and lifestyle."},
        {"id": "status", "label": "Status", "description": "Gain recognition, influence, prestige, or visible success."},
        {"id": "romance", "label": "Romance", "description": "Pursue attraction, dating, intimacy, and commitment."},
        {"id": "parenting", "label": "Parenting", "description": "Care for children or dependents and shape their wellbeing."},
        {"id": "homebuilding", "label": "Homebuilding", "description": "Create a stable, functional, and welcoming living space."},
        {"id": "mobility", "label": "Mobility", "description": "Improve movement, commuting, travel, and geographic access."},
        {"id": "preparedness", "label": "Preparedness", "description": "Be ready for tomorrow, setbacks, and opportunities."},
        {"id": "healing", "label": "Healing", "description": "Repair damage from grief, trauma, conflict, or failure."},
        {"id": "confidence", "label": "Confidence", "description": "Grow courage, social ease, and trust in one's own ability."},
        {"id": "spirituality", "label": "Spirituality", "description": "Seek peace, faith, reflection, reverence, or inner alignment."},
        {"id": "legacy", "label": "Legacy", "description": "Leave a lasting impact, body of work, or remembered contribution."},
        {"id": "adventure", "label": "Adventure", "description": "Experience exploration, surprise, challenge, and new places."},
        {"id": "pleasure", "label": "Pleasure", "description": "Seek sensory satisfaction, beauty, relaxation, and delight."},
        {"id": "longevity", "label": "Longevity", "description": "Build habits that support a longer, healthier life arc."},
        {"id": "balance", "label": "Balance", "description": "Keep work, health, relationships, and rest in sustainable proportion."},
        {"id": "self_respect", "label": "Self Respect", "description": "Live in a way the character can admire and stand behind."},
        {"id": "resilience", "label": "Resilience", "description": "Bounce back after setbacks and keep functioning under pressure."},
        {"id": "ownership", "label": "Ownership", "description": "Acquire and maintain property, tools, collections, or territory."},
        {"id": "recognition", "label": "Recognition", "description": "Be noticed, appreciated, thanked, or publicly validated."},
        {"id": "transformation", "label": "Transformation", "description": "Make a major life change and become someone different."},
        {"id": "fulfillment", "label": "Fulfillment", "description": "Reach a life that feels complete, worthwhile, and deeply satisfying."}
    ],
    "actions": []
}

def a(id, label, cat, motives, needs, loc, tod, mins, en, st, mo, so, he, hy, fu, di, rep=True, prereqs=None):
    return {
        "id": id, "label": label, "category": cat,
        "related_motives": motives, "needs": needs, "location": loc,
        "time_of_day": tod, "time_minutes": mins,
        "energy_delta": en, "stress_delta": st, "money_delta": mo,
        "social_delta": so, "health_delta": he, "hygiene_delta": hy,
        "fun_delta": fu, "discipline_delta": di,
        "repeatable": rep, "prerequisites": prereqs or []
    }

actions = []

# ============================================================
# BASIC NEEDS (30 actions) - using differentiated deltas from JSON parts
# ============================================================
actions.append(a("wake_up", "Wake Up", "basic_needs",
    ["survival","health","comfort","routine","order"], ["energy","hygiene","sleep"],
    "home", ["morning","evening","any"], 10, 4, -1, 0, 0, 2, 4, 0, 1))

actions.append(a("snooze_alarm", "Snooze Alarm", "basic_needs",
    ["survival","comfort","routine","restoration","control"], ["sleep","energy"],
    "home", ["morning","night"], 5, 1, 0, 0, 0, 0, 0, 0, -1))

actions.append(a("get_out_of_bed", "Get Out Of Bed", "basic_needs",
    ["routine","discipline","control","order","survival"], ["sleep","energy"],
    "home", ["morning","any"], 5, 2, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("make_bed", "Make Bed", "basic_needs",
    ["order","comfort","discipline","homebuilding","self_respect"], ["cleanliness","order","comfort"],
    "home", ["morning","any"], 5, -1, -1, 0, 0, 0, 1, 0, 1))

actions.append(a("open_blinds", "Open Blinds", "basic_needs",
    ["comfort","routine","order","restoration","pleasure"], ["comfort","mood"],
    "home", ["morning","any"], 2, 0, -1, 0, 0, 0, 0, 0, 0))

actions.append(a("open_window", "Open Window", "basic_needs",
    ["comfort","health","homebuilding","order","restoration"], ["comfort","fresh_air"],
    "home", ["morning","any"], 2, 0, -1, 0, 0, 1, 0, 0, 0))

actions.append(a("drink_water", "Drink Water", "basic_needs",
    ["survival","health","discipline","comfort","routine"], ["hunger","thirst","energy"],
    "home", ["any"], 2, 1, 0, 0, 0, 1, 0, 0, 0))

actions.append(a("use_bathroom", "Use Bathroom", "basic_needs",
    ["survival","comfort","routine","health","order"], ["hygiene","comfort"],
    "home", ["any"], 5, 0, -1, 0, 0, 0, 2, 0, 0))

actions.append(a("wash_hands", "Wash Hands", "basic_needs",
    ["health","order","routine","self_respect","comfort"], ["hygiene"],
    "home", ["any"], 2, 0, 0, 0, 0, 1, 3, 0, 0))

actions.append(a("brush_teeth", "Brush Teeth", "basic_needs",
    ["health","routine","self_respect","discipline","reputation"], ["hygiene","self_care"],
    "home", ["morning","evening","any"], 4, 0, 0, 0, 0, 2, 5, 0, 1))

actions.append(a("floss", "Floss", "basic_needs",
    ["health","routine","self_respect","discipline"], ["hygiene"],
    "home", ["evening","any"], 3, 0, 0, 0, 0, 1, 4, 0, 1))

actions.append(a("use_mouthwash", "Use Mouthwash", "basic_needs",
    ["health","self_respect","routine","reputation"], ["hygiene"],
    "home", ["morning","evening","any"], 1, 0, 0, 0, 0, 1, 2, 0, 0))

actions.append(a("take_shower", "Take Shower", "basic_needs",
    ["health","comfort","self_respect","reputation","routine"], ["hygiene","comfort"],
    "home", ["morning","evening","any"], 15, 0, -2, 0, 0, 2, 8, 0, 1))

actions.append(a("bathe", "Bathe", "basic_needs",
    ["health","comfort","self_respect","routine"], ["hygiene","comfort"],
    "home", ["any"], 20, 0, -2, 0, 0, 2, 7, 0, 1))

actions.append(a("wash_hair", "Wash Hair", "basic_needs",
    ["health","self_respect","comfort","routine"], ["hygiene"],
    "home", ["any"], 10, 0, -1, 0, 0, 1, 5, 0, 0))

actions.append(a("dry_off", "Dry Off", "basic_needs",
    ["comfort","routine","health"], ["comfort"],
    "home", ["any"], 3, 0, 0, 0, 0, 0, 1, 0, 0))

actions.append(a("apply_deodorant", "Apply Deodorant", "basic_needs",
    ["health","self_respect","reputation","routine"], ["hygiene"],
    "home", ["morning","any"], 1, 0, 0, 0, 0, 1, 3, 0, 0))

actions.append(a("comb_hair", "Comb Hair", "basic_needs",
    ["self_respect","reputation","routine","comfort"], ["hygiene"],
    "home", ["morning","any"], 2, 0, 0, 0, 0, 0, 2, 0, 0))

actions.append(a("shave", "Shave", "basic_needs",
    ["self_respect","reputation","routine","comfort"], ["hygiene"],
    "home", ["morning","any"], 7, 0, -1, 0, 0, 0, 3, 0, 0))

actions.append(a("do_skincare", "Do Skincare", "basic_needs",
    ["health","self_respect","reputation","routine"], ["hygiene","self_care"],
    "home", ["morning","evening","any"], 8, 0, -1, 0, 0, 1, 4, 0, 1))

actions.append(a("change_clothes", "Change Clothes", "basic_needs",
    ["comfort","routine","self_respect","order"], ["comfort","hygiene"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 1, 0, 0))

actions.append(a("choose_outfit", "Choose Outfit", "basic_needs",
    ["self_expression","reputation","comfort","identity","routine"], ["comfort","self_expression"],
    "home", ["morning","any"], 6, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("put_on_shoes", "Put On Shoes", "basic_needs",
    ["mobility","preparedness","routine","control"], ["mobility"],
    "home", ["any"], 2, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("take_medication", "Take Medication", "basic_needs",
    ["health","discipline","stability","routine","survival"], ["health","routine"],
    "home", ["morning","evening","any"], 2, 0, 0, 0, 0, 4, 0, 0, 2))

actions.append(a("take_vitamins", "Take Vitamins", "basic_needs",
    ["health","routine","discipline","preparedness"], ["health"],
    "home", ["morning","any"], 2, 0, 0, 0, 0, 1, 0, 0, 1))

actions.append(a("stretch_in_morning", "Stretch In Morning", "basic_needs",
    ["health","routine","discipline","restoration"], ["energy","health"],
    "home", ["morning","any"], 5, 1, -1, 0, 0, 2, 0, 0, 1))

actions.append(a("check_weather", "Check Weather", "basic_needs",
    ["preparedness","mobility","control","routine"], ["planning"],
    "home", ["morning","any"], 2, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("pack_bag", "Pack Bag", "basic_needs",
    ["preparedness","routine","control","mobility"], ["planning","mobility"],
    "home", ["morning","any"], 6, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("set_alarm", "Set Alarm", "basic_needs",
    ["routine","preparedness","control","discipline"], ["sleep","planning"],
    "home", ["evening","night","any"], 2, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("go_to_sleep", "Go To Sleep", "basic_needs",
    ["survival","health","restoration","routine","balance"], ["sleep","restoration"],
    "home", ["night"], 420, 10, -3, 0, 0, 3, 0, 0, 0))


# ============================================================
# FOOD COOKING (30 actions) - using differentiated deltas from JSON parts
# ============================================================
actions.append(a("eat_breakfast", "Eat Breakfast", "food_cooking",
    ["survival","health","routine","preparedness","comfort"], ["hunger","energy"],
    "home", ["morning"], 15, 4, -1, -2, 0, 2, 0, 1, 1))

actions.append(a("eat_lunch", "Eat Lunch", "food_cooking",
    ["survival","health","productivity","routine","comfort"], ["hunger","energy"],
    "home_or_outside", ["midday"], 25, 5, -1, -3, 1, 2, 0, 1, 1))

actions.append(a("eat_dinner", "Eat Dinner", "food_cooking",
    ["survival","health","family","comfort","balance"], ["hunger","energy"],
    "home_or_outside", ["evening"], 35, 6, -1, -4, 1, 2, 0, 1, 1))

actions.append(a("eat_snack", "Eat Snack", "food_cooking",
    ["comfort","survival","restoration","balance"], ["hunger"],
    "home_or_outside", ["any"], 5, 2, -1, -1, 0, 0, 0, 1, 0))

actions.append(a("brew_coffee", "Brew Coffee", "food_cooking",
    ["productivity","comfort","routine","pleasure","balance"], ["energy","routine"],
    "home", ["morning","midday"], 5, 2, -1, -2, 0, 0, 0, 1, 0))

actions.append(a("brew_tea", "Brew Tea", "food_cooking",
    ["comfort","routine","restoration","pleasure","balance"], ["comfort","routine"],
    "home", ["morning","evening","any"], 5, 1, -1, -1, 0, 0, 0, 1, 0))

actions.append(a("fill_water_bottle", "Fill Water Bottle", "food_cooking",
    ["survival","health","preparedness","routine"], ["thirst","planning"],
    "home", ["morning","any"], 2, 0, 0, 0, 0, 1, 0, 0, 0))

actions.append(a("plan_meal", "Plan Meal", "food_cooking",
    ["preparedness","health","wealth","homebuilding","routine"], ["planning","budget"],
    "home", ["morning","midday","any"], 10, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("make_grocery_list", "Make Grocery List", "food_cooking",
    ["preparedness","wealth","homebuilding","routine","control"], ["planning","budget"],
    "home", ["any"], 10, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("go_grocery_shopping", "Go Grocery Shopping", "food_cooking",
    ["survival","preparedness","wealth","homebuilding","control"], ["budget","planning","independence"],
    "outside", ["any"], 50, -2, 1, -12, 0, 0, 0, 0, 1, True, ["make_grocery_list"]))

actions.append(a("compare_prices", "Compare Prices", "food_cooking",
    ["wealth","security","control","preparedness"], ["budget","planning"],
    "home_or_outside", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("use_coupon", "Use Coupon", "food_cooking",
    ["wealth","security","preparedness"], ["budget"],
    "outside", ["any"], 2, 0, 0, -1, 0, 0, 0, 0, 0))

actions.append(a("wash_produce", "Wash Produce", "food_cooking",
    ["health","survival","self_respect","routine"], ["hygiene","health"],
    "home", ["any"], 5, 0, 0, 0, 0, 1, 3, 0, 0))

actions.append(a("chop_ingredients", "Chop Ingredients", "food_cooking",
    ["preparedness","mastery","homebuilding","routine"], ["planning","hygiene"],
    "home", ["any"], 10, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("cook_breakfast", "Cook Breakfast", "food_cooking",
    ["survival","health","comfort","preparedness","homebuilding"], ["hunger","planning"],
    "home", ["morning"], 20, 3, -1, -3, 0, 1, 0, 1, 1))

actions.append(a("cook_lunch", "Cook Lunch", "food_cooking",
    ["survival","health","productivity","comfort","routine"], ["hunger","planning"],
    "home", ["midday"], 25, 4, -1, -4, 0, 1, 0, 1, 1))

actions.append(a("cook_dinner", "Cook Dinner", "food_cooking",
    ["survival","health","family","comfort","balance"], ["hunger","planning"],
    "home", ["evening"], 45, 5, -1, -5, 1, 2, 0, 1, 2))

actions.append(a("boil_water", "Boil Water", "food_cooking",
    ["survival","preparedness","routine","comfort"], ["hunger","planning"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("meal_prep", "Meal Prep", "food_cooking",
    ["preparedness","discipline","health","routine","control"], ["planning","time"],
    "home", ["any"], 60, -3, -1, -6, 0, 1, 0, 0, 2))

actions.append(a("pack_lunch", "Pack Lunch", "food_cooking",
    ["preparedness","wealth","routine","discipline","health"], ["planning","budget"],
    "home", ["morning","any"], 10, -1, 0, -1, 0, 0, 0, 0, 1))

actions.append(a("set_table", "Set Table", "food_cooking",
    ["family","homebuilding","routine","comfort"], ["order","family"],
    "home", ["morning","midday","evening"], 5, 0, -1, 0, 1, 0, 0, 0, 0))

actions.append(a("serve_food", "Serve Food", "food_cooking",
    ["family","homebuilding","service","comfort","routine"], ["hunger","family"],
    "home", ["morning","midday","evening"], 5, -1, 0, 0, 1, 0, 0, 0, 0))

actions.append(a("eat_with_household", "Eat With Household", "food_cooking",
    ["family","belonging","comfort","routine","love"], ["hunger","social","family"],
    "home", ["morning","midday","evening"], 30, 4, -2, -3, 3, 1, 0, 2, 1))

actions.append(a("save_leftovers", "Save Leftovers", "food_cooking",
    ["wealth","preparedness","routine","homebuilding"], ["planning","budget"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("store_leftovers", "Store Leftovers", "food_cooking",
    ["order","preparedness","homebuilding","routine"], ["planning","cleanliness"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 1, 0, 0))

actions.append(a("order_takeout", "Order Takeout", "food_cooking",
    ["comfort","fun","restoration","survival"], ["hunger","budget"],
    "home", ["any"], 5, 0, -1, -10, 0, 0, 0, 2, 0))

actions.append(a("pick_up_takeout", "Pick Up Takeout", "food_cooking",
    ["survival","comfort","mobility","independence"], ["hunger","transport"],
    "outside", ["any"], 20, -1, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("go_out_to_eat", "Go Out To Eat", "food_cooking",
    ["fun","family","friendship","romance","comfort"], ["hunger","social","budget"],
    "outside", ["any"], 60, 2, -1, -15, 2, 1, 0, 3, 0))

actions.append(a("bake_snack", "Bake Snack", "food_cooking",
    ["creativity","comfort","fun","homebuilding","mastery"], ["hunger","planning"],
    "home", ["any"], 45, -2, -1, -3, 0, 0, 0, 2, 1))

actions.append(a("wash_pan", "Wash Pan", "food_cooking",
    ["order","homebuilding","discipline","routine"], ["cleanliness","order"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 2, 0, 0))


# ============================================================
# HOME CARE (40 actions) - differentiated
# ============================================================
actions.append(a("lock_door", "Lock Door", "home_care",
    ["security","homebuilding","control","routine","preparedness"], ["safety","order"],
    "home", ["any"], 1, 0, -1, 0, 0, 0, 0, 0, 1))

actions.append(a("unlock_door", "Unlock Door", "home_care",
    ["comfort","homebuilding","control","routine"], ["safety"],
    "home", ["any"], 1, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("check_mailbox", "Check Mailbox", "home_care",
    ["routine","preparedness","control","homebuilding","order"], ["planning","order"],
    "home", ["any"], 3, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("sort_mail", "Sort Mail", "home_care",
    ["order","control","homebuilding","preparedness","routine"], ["planning","order"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("put_groceries_away", "Put Groceries Away", "home_care",
    ["order","homebuilding","preparedness","routine","control"], ["cleanliness","order"],
    "home", ["any"], 10, -1, 0, 0, 0, 0, 1, 0, 1))

actions.append(a("wipe_counter", "Wipe Counter", "home_care",
    ["order","homebuilding","routine","discipline"], ["cleanliness","order"],
    "home", ["any"], 3, -1, -1, 0, 0, 0, 2, 0, 0))

actions.append(a("clean_stove", "Clean Stove", "home_care",
    ["order","homebuilding","discipline","self_respect"], ["cleanliness","order"],
    "home", ["any"], 10, -2, -1, 0, 0, 0, 4, 0, 1))

actions.append(a("wash_dishes", "Wash Dishes", "home_care",
    ["order","homebuilding","discipline","routine","self_respect"], ["cleanliness","order"],
    "home", ["any"], 15, -1, -1, 0, 0, 0, 4, 0, 1))

actions.append(a("load_dishwasher", "Load Dishwasher", "home_care",
    ["order","homebuilding","discipline","routine"], ["cleanliness","order"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 2, 0, 0))

actions.append(a("unload_dishwasher", "Unload Dishwasher", "home_care",
    ["order","homebuilding","routine","discipline"], ["cleanliness","order"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 2, 0, 0))

actions.append(a("sweep_floor", "Sweep Floor", "home_care",
    ["order","homebuilding","discipline","comfort"], ["cleanliness","order"],
    "home", ["any"], 10, -2, -1, 0, 0, 0, 4, 0, 1))

actions.append(a("vacuum_room", "Vacuum Room", "home_care",
    ["order","homebuilding","discipline","comfort"], ["cleanliness","order"],
    "home", ["any"], 15, -3, -1, 0, 0, 0, 5, 0, 1))

actions.append(a("mop_floor", "Mop Floor", "home_care",
    ["order","homebuilding","discipline","self_respect"], ["cleanliness","order"],
    "home", ["any"], 20, -3, -1, 0, 0, 0, 5, 0, 1))

actions.append(a("dust_furniture", "Dust Furniture", "home_care",
    ["order","homebuilding","comfort","discipline"], ["cleanliness","order"],
    "home", ["any"], 15, -2, -1, 0, 0, 0, 3, 0, 1))

actions.append(a("tidy_room", "Tidy Room", "home_care",
    ["order","homebuilding","comfort","discipline"], ["cleanliness","order"],
    "home", ["any"], 10, -1, -1, 0, 0, 0, 2, 0, 1))

actions.append(a("organize_drawer", "Organize Drawer", "home_care",
    ["order","control","homebuilding","discipline"], ["cleanliness","order"],
    "home", ["any"], 15, -1, -1, 0, 0, 0, 2, 0, 1))

actions.append(a("declutter_surface", "Declutter Surface", "home_care",
    ["order","control","homebuilding","discipline"], ["cleanliness","order"],
    "home", ["any"], 10, -1, -1, 0, 0, 0, 2, 0, 1))

actions.append(a("clean_bathroom_sink", "Clean Bathroom Sink", "home_care",
    ["order","homebuilding","discipline","self_respect"], ["cleanliness","order"],
    "home", ["any"], 5, -1, -1, 0, 0, 0, 2, 0, 0))

actions.append(a("clean_mirror", "Clean Mirror", "home_care",
    ["order","homebuilding","self_respect","routine"], ["cleanliness","order"],
    "home", ["any"], 3, 0, 0, 0, 0, 0, 1, 0, 0))

actions.append(a("scrub_toilet", "Scrub Toilet", "home_care",
    ["order","homebuilding","health","discipline"], ["cleanliness","order"],
    "home", ["any"], 10, -2, -1, 0, 0, 0, 4, 0, 1))

actions.append(a("change_towels", "Change Towels", "home_care",
    ["order","homebuilding","hygiene","self_respect"], ["cleanliness","order"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 2, 0, 0))

actions.append(a("take_out_trash", "Take Out Trash", "home_care",
    ["order","homebuilding","discipline","self_respect"], ["cleanliness","order"],
    "home", ["any"], 5, -1, -1, 0, 0, 0, 3, 0, 1))

actions.append(a("take_out_recycling", "Take Out Recycling", "home_care",
    ["order","community","homebuilding","discipline"], ["cleanliness","order"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 2, 0, 0))

actions.append(a("replace_trash_bag", "Replace Trash Bag", "home_care",
    ["order","homebuilding","routine","discipline"], ["cleanliness","order"],
    "home", ["any"], 2, 0, 0, 0, 0, 0, 1, 0, 0))

actions.append(a("water_plants", "Water Plants", "home_care",
    ["homebuilding","comfort","routine","restoration","order"], ["caregiving","comfort"],
    "home", ["morning","any"], 5, 0, -1, 0, 0, 0, 0, 1, 1))

actions.append(a("repot_plant", "Repot Plant", "home_care",
    ["homebuilding","creativity","mastery","comfort"], ["caregiving","order"],
    "home", ["any"], 20, -2, 0, -3, 0, 0, 0, 1, 1))

actions.append(a("start_laundry", "Start Laundry", "home_care",
    ["order","homebuilding","preparedness","discipline"], ["cleanliness","clothing"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 2, 0, 1))

actions.append(a("move_laundry_to_dryer", "Move Laundry To Dryer", "home_care",
    ["order","homebuilding","discipline","preparedness"], ["cleanliness","order"],
    "home", ["any"], 3, -1, 0, 0, 0, 0, 1, 0, 0, True, ["start_laundry"]))

actions.append(a("hang_laundry", "Hang Laundry", "home_care",
    ["order","homebuilding","preparedness","discipline"], ["cleanliness","order"],
    "home", ["any"], 10, -2, 0, 0, 0, 0, 2, 0, 1, True, ["start_laundry"]))

actions.append(a("fold_laundry", "Fold Laundry", "home_care",
    ["order","homebuilding","discipline","preparedness"], ["cleanliness","order"],
    "home", ["any"], 15, -2, -1, 0, 0, 0, 3, 0, 1, True, ["start_laundry"]))

actions.append(a("put_laundry_away", "Put Laundry Away", "home_care",
    ["order","homebuilding","discipline","control"], ["cleanliness","order"],
    "home", ["any"], 10, -1, -1, 0, 0, 0, 2, 0, 1, True, ["fold_laundry"]))

actions.append(a("iron_clothes", "Iron Clothes", "home_care",
    ["self_respect","reputation","order","preparedness"], ["clothing","order"],
    "home", ["any"], 10, -2, 0, 0, 0, 0, 1, 0, 1))

actions.append(a("change_bedsheets", "Change Bedsheets", "home_care",
    ["order","homebuilding","comfort","self_respect","hygiene"], ["cleanliness","comfort"],
    "home", ["any"], 15, -2, -1, 0, 0, 0, 4, 0, 1))

actions.append(a("clean_fridge", "Clean Fridge", "home_care",
    ["order","homebuilding","health","preparedness"], ["cleanliness","order"],
    "home", ["any"], 20, -2, 0, 0, 0, 0, 3, 0, 1))

actions.append(a("stock_supplies", "Stock Supplies", "home_care",
    ["preparedness","homebuilding","routine","control"], ["planning","budget"],
    "home", ["any"], 15, -1, 0, -5, 0, 0, 0, 0, 1))

actions.append(a("clean_workspace", "Clean Workspace", "home_care",
    ["order","productivity","discipline","comfort","homebuilding"], ["cleanliness","order"],
    "home", ["any"], 10, -1, -1, 0, 0, 0, 2, 0, 1))

actions.append(a("organize_desktop", "Organize Desktop", "home_care",
    ["order","productivity","control","discipline"], ["order","planning"],
    "home", ["any"], 10, -1, -1, 0, 0, 0, 0, 0, 1))

actions.append(a("back_up_files", "Back Up Files", "home_care",
    ["security","preparedness","control","order"], ["planning","safety"],
    "home", ["any"], 10, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("archive_documents", "Archive Documents", "home_care",
    ["order","control","preparedness","discipline"], ["planning","order"],
    "home", ["any"], 15, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("rename_files", "Rename Files", "home_care",
    ["order","control","discipline","productivity"], ["order","planning"],
    "home", ["any"], 10, 0, 0, 0, 0, 0, 0, 0, 1))


# ============================================================
# WORK STUDY (40 actions)
# ============================================================
actions.append(a("check_schedule", "Check Schedule", "work_study",
    ["productivity","preparedness","routine","control","discipline"], ["planning"],
    "work_or_school", ["morning","any"], 5, 0, -1, 0, 0, 0, 0, 0, 1))

actions.append(a("write_todo_list", "Write Todo List", "work_study",
    ["productivity","routine","control","discipline","preparedness"], ["planning"],
    "work_or_school", ["morning","any"], 5, 0, -1, 0, 0, 0, 0, 0, 1))

actions.append(a("set_daily_goals", "Set Daily Goals", "work_study",
    ["productivity","discipline","control","routine","preparedness"], ["planning","focus"],
    "work_or_school", ["morning","any"], 5, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("commute_to_work", "Commute To Work", "work_study",
    ["career","productivity","routine","mobility","discipline"], ["transport","time"],
    "outside", ["morning","any"], 30, -2, 1, -2, 0, 0, 0, 0, 1))

actions.append(a("commute_by_bus", "Commute By Bus", "work_study",
    ["career","productivity","routine","mobility","independence"], ["transport","time"],
    "outside", ["morning","any"], 35, -1, 1, -2, 0, 0, 0, 0, 0))

actions.append(a("commute_by_train", "Commute By Train", "work_study",
    ["career","productivity","routine","mobility","independence"], ["transport","time"],
    "outside", ["morning","any"], 40, -1, 0, -3, 0, 0, 0, 0, 0))

actions.append(a("ride_bike_commute", "Ride Bike", "work_study",
    ["health","mobility","independence","discipline","routine"], ["transport","energy"],
    "outside", ["any"], 25, -2, -1, 0, 0, 2, 0, 1, 1))

actions.append(a("clock_in", "Clock In", "work_study",
    ["career","discipline","routine","productivity","wealth"], ["work","planning"],
    "work_or_school", ["morning","any"], 2, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("check_email", "Check Email", "work_study",
    ["productivity","career","control","routine"], ["planning","work"],
    "work_or_school", ["morning","midday","any"], 10, -1, 1, 0, 0, 0, 0, 0, 0))

actions.append(a("reply_to_email", "Reply To Email", "work_study",
    ["productivity","career","reputation","discipline"], ["work","communication"],
    "work_or_school", ["any"], 10, -1, 1, 0, 1, 0, 0, 0, 1))

actions.append(a("attend_meeting", "Attend Meeting", "work_study",
    ["career","productivity","status","belonging"], ["work","communication"],
    "work_or_school", ["any"], 30, -2, 1, 0, 1, 0, 0, 0, 1))

actions.append(a("join_video_call", "Join Video Call", "work_study",
    ["career","productivity","belonging","routine"], ["work","communication"],
    "work_or_school", ["any"], 30, -2, 1, 0, 1, 0, 0, 0, 1))

actions.append(a("start_task", "Start Task", "work_study",
    ["career","productivity","discipline","status"], ["work","planning"],
    "work_or_school", ["any"], 5, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("focus_on_project", "Focus On Project", "work_study",
    ["mastery","career","productivity","discipline","meaning"], ["focus","work"],
    "work_or_school", ["any"], 60, -4, 1, 0, 0, 0, 0, 0, 3))

actions.append(a("switch_tasks", "Switch Tasks", "work_study",
    ["productivity","control","routine","discipline"], ["focus","planning"],
    "work_or_school", ["any"], 5, 0, 1, 0, 0, 0, 0, 0, 0))

actions.append(a("take_notes", "Take Notes", "work_study",
    ["education","productivity","mastery","discipline"], ["learning","focus"],
    "work_or_school", ["any"], 15, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("study_topic", "Study Topic", "work_study",
    ["education","mastery","discipline","meaning","career"], ["focus","learning"],
    "work_or_school", ["any"], 45, -2, 0, 0, 0, 0, 0, 0, 2))

actions.append(a("read_assignment", "Read Assignment", "work_study",
    ["education","discipline","career","mastery"], ["focus","learning"],
    "work_or_school", ["any"], 30, -2, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("do_homework", "Do Homework", "work_study",
    ["education","discipline","mastery","career","routine"], ["focus","learning"],
    "work_or_school", ["any"], 45, -3, 1, 0, 0, 0, 0, 0, 2))

actions.append(a("submit_assignment", "Submit Assignment", "work_study",
    ["education","discipline","career","reputation"], ["work","education"],
    "work_or_school", ["any"], 10, 0, 1, 0, 0, 0, 0, 0, 2, False))

actions.append(a("ask_question", "Ask Question", "work_study",
    ["education","confidence","meaning","belonging"], ["learning","social"],
    "work_or_school", ["any"], 10, 0, 1, 0, 1, 0, 0, 0, 1))

actions.append(a("answer_question", "Answer Question", "work_study",
    ["mastery","confidence","reputation","service"], ["knowledge","social"],
    "work_or_school", ["any"], 10, 0, 0, 0, 1, 0, 0, 0, 1))

actions.append(a("help_coworker", "Help Coworker", "work_study",
    ["service","belonging","friendship","career","reputation"], ["social","work"],
    "work_or_school", ["any"], 15, -1, -1, 0, 2, 0, 0, 1, 1))

actions.append(a("train_skill", "Train Skill", "work_study",
    ["mastery","education","discipline","career","confidence"], ["focus","learning"],
    "work_or_school", ["any"], 30, -2, 0, 0, 0, 0, 0, 0, 2))

actions.append(a("practice_typing", "Practice Typing", "work_study",
    ["mastery","productivity","discipline","career"], ["focus","learning"],
    "work_or_school", ["any"], 15, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("review_documents", "Review Documents", "work_study",
    ["productivity","career","mastery","discipline"], ["focus","work"],
    "work_or_school", ["any"], 20, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("file_paperwork", "File Paperwork", "work_study",
    ["order","discipline","career","control"], ["work","order"],
    "work_or_school", ["any"], 15, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("update_calendar", "Update Calendar", "work_study",
    ["preparedness","productivity","routine","control","discipline"], ["planning"],
    "work_or_school", ["any"], 5, 0, -1, 0, 0, 0, 0, 0, 1))

actions.append(a("set_reminder", "Set Reminder", "work_study",
    ["preparedness","control","routine","discipline"], ["planning"],
    "work_or_school", ["any"], 2, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("solve_problem", "Solve Problem", "work_study",
    ["mastery","career","productivity","confidence","meaning"], ["focus","work"],
    "work_or_school", ["any"], 30, -3, 1, 0, 0, 0, 0, 0, 2))

actions.append(a("research_topic", "Research Topic", "work_study",
    ["education","mastery","career","productivity","meaning"], ["focus","learning"],
    "work_or_school", ["any"], 30, -2, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("debug_issue", "Debug Issue", "work_study",
    ["mastery","career","productivity","resilience","discipline"], ["focus","work"],
    "work_or_school", ["any"], 60, -3, 3, 1, 0, 0, 0, -1, 3))

actions.append(a("finish_shift", "Finish Shift", "work_study",
    ["career","wealth","routine","balance","restoration"], ["work"],
    "work_or_school", ["evening","any"], 5, 2, -2, 4, 0, 0, 0, 1, 1))

actions.append(a("clock_out", "Clock Out", "work_study",
    ["career","wealth","routine","balance","freedom"], ["work"],
    "work_or_school", ["evening","any"], 2, 1, -2, 0, 0, 0, 0, 0, 0))

actions.append(a("review_progress", "Review Progress", "work_study",
    ["productivity","discipline","mastery","control","meaning"], ["focus","planning"],
    "work_or_school", ["evening","any"], 10, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("prepare_for_tomorrow", "Prepare For Tomorrow", "work_study",
    ["preparedness","discipline","routine","control","productivity"], ["planning"],
    "work_or_school", ["evening","any"], 10, 0, -1, 0, 0, 0, 0, 0, 2))

actions.append(a("print_document", "Print Document", "work_study",
    ["productivity","career","order","preparedness"], ["work","planning"],
    "work_or_school", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("scan_document", "Scan Document", "work_study",
    ["productivity","order","preparedness","control"], ["work","planning"],
    "work_or_school", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("apply_for_job", "Apply For Job", "work_study",
    ["career","wealth","independence","confidence","transformation"], ["work","planning"],
    "work_or_school", ["any"], 50, -3, 3, 0, 0, 0, 0, -1, 3))

actions.append(a("update_resume", "Update Resume", "work_study",
    ["career","confidence","identity","preparedness","reputation"], ["work","planning"],
    "work_or_school", ["any"], 40, -2, 2, 0, 0, 0, 0, 0, 2))


# ============================================================
# MONEY ADMIN (30 actions)
# ============================================================
actions.append(a("check_bank_balance", "Check Bank Balance", "money_admin",
    ["wealth","security","stability","preparedness","independence"], ["budget","security","planning"],
    "digital_or_errand", ["any"], 5, -1, 0, 0, 0, 0, 0, -1, 2))

actions.append(a("pay_bill", "Pay Bill", "money_admin",
    ["wealth","security","stability","preparedness","independence"], ["budget","security","planning"],
    "digital_or_errand", ["any"], 10, -1, 2, -8, 0, 0, 0, -1, 2))

actions.append(a("review_subscription", "Review Subscription", "money_admin",
    ["wealth","security","control","preparedness","stability"], ["budget","planning"],
    "digital_or_errand", ["any"], 10, -1, 1, 0, 0, 0, 0, 0, 1))

actions.append(a("set_budget", "Set Budget", "money_admin",
    ["wealth","security","stability","discipline","control"], ["budget","planning"],
    "digital_or_errand", ["any"], 20, -1, 0, 0, 0, 0, 0, 0, 2))

actions.append(a("track_expenses", "Track Expenses", "money_admin",
    ["wealth","security","discipline","control","preparedness"], ["budget","planning"],
    "digital_or_errand", ["any"], 15, -1, 1, 0, 0, 0, 0, 0, 2))

actions.append(a("deposit_money", "Deposit Money", "money_admin",
    ["wealth","security","stability","independence","preparedness"], ["budget","transport"],
    "digital_or_errand", ["any"], 10, 0, -1, 0, 0, 0, 0, 0, 1))

actions.append(a("withdraw_cash", "Withdraw Cash", "money_admin",
    ["wealth","independence","mobility","preparedness"], ["budget","transport"],
    "digital_or_errand", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("use_atm", "Use ATM", "money_admin",
    ["wealth","independence","preparedness","mobility"], ["budget","transport"],
    "outside", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("tip_worker", "Tip Worker", "money_admin",
    ["service","community","reputation","belonging","generosity"], ["budget","social"],
    "outside", ["any"], 1, 0, -1, -2, 1, 0, 0, 0, 0))

actions.append(a("split_bill", "Split Bill", "money_admin",
    ["friendship","wealth","belonging","control"], ["budget","social"],
    "outside", ["any"], 3, 0, 0, 0, 1, 0, 0, 0, 0))

actions.append(a("send_payment", "Send Payment", "money_admin",
    ["wealth","security","discipline","control","independence"], ["budget"],
    "digital_or_errand", ["any"], 5, 0, 0, -5, 0, 0, 0, 0, 1))

actions.append(a("receive_payment", "Receive Payment", "money_admin",
    ["wealth","security","independence","stability"], ["budget"],
    "digital_or_errand", ["any"], 2, 0, -1, 5, 0, 0, 0, 0, 0))

actions.append(a("shop_online", "Shop Online", "money_admin",
    ["comfort","fun","independence","ownership"], ["budget","planning"],
    "home", ["any"], 20, 0, 0, -10, 0, 0, 0, 2, 0))

actions.append(a("return_item", "Return Item", "money_admin",
    ["wealth","control","security","independence"], ["budget","transport"],
    "outside", ["any"], 20, -1, 1, 3, 0, 0, 0, -1, 1))

actions.append(a("book_appointment", "Book Appointment", "money_admin",
    ["preparedness","health","control","routine","discipline"], ["planning"],
    "digital_or_errand", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("renew_membership", "Renew Membership", "money_admin",
    ["belonging","preparedness","routine","stability"], ["budget","planning"],
    "digital_or_errand", ["any"], 5, 0, 0, -5, 0, 0, 0, 0, 1))

actions.append(a("file_receipt", "File Receipt", "money_admin",
    ["order","control","wealth","discipline"], ["planning","order"],
    "home", ["any"], 3, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("compare_insurance", "Compare Insurance", "money_admin",
    ["security","wealth","stability","preparedness","control"], ["budget","planning"],
    "home", ["any"], 30, -1, 1, 0, 0, 0, 0, -1, 2))

actions.append(a("call_customer_service", "Call Customer Service", "money_admin",
    ["control","security","wealth","independence"], ["budget","communication"],
    "home", ["any"], 20, -2, 2, 0, 0, 0, 0, -1, 1))

actions.append(a("update_password", "Update Password", "money_admin",
    ["security","control","preparedness","discipline"], ["safety","planning"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("check_credit_score", "Check Credit Score", "money_admin",
    ["wealth","security","control","stability","preparedness"], ["budget","planning"],
    "home", ["any"], 5, 0, 1, 0, 0, 0, 0, 0, 1))

actions.append(a("move_money_to_savings", "Move Money To Savings", "money_admin",
    ["wealth","security","stability","discipline","preparedness"], ["budget","planning"],
    "digital_or_errand", ["any"], 5, -1, -1, -6, 0, 0, 0, -1, 3))

actions.append(a("set_autopay", "Set Autopay", "money_admin",
    ["discipline","security","control","stability","preparedness"], ["budget","planning"],
    "digital_or_errand", ["any"], 5, 0, -1, 0, 0, 0, 0, 0, 2))

actions.append(a("cancel_service", "Cancel Service", "money_admin",
    ["wealth","control","independence","freedom"], ["budget","communication"],
    "digital_or_errand", ["any"], 10, -1, 1, 3, 0, 0, 0, 0, 1))

actions.append(a("schedule_repair", "Schedule Repair", "money_admin",
    ["homebuilding","preparedness","control","stability"], ["planning","communication"],
    "digital_or_errand", ["any"], 10, 0, 1, 0, 0, 0, 0, 0, 1))

actions.append(a("refill_gas", "Refill Gas", "money_admin",
    ["mobility","preparedness","independence","control"], ["transport","budget"],
    "outside", ["any"], 10, -1, 0, -8, 0, 0, 0, 0, 0))

actions.append(a("charge_vehicle", "Charge Vehicle", "money_admin",
    ["mobility","preparedness","independence","control"], ["transport"],
    "home_or_outside", ["any"], 5, 0, 0, -2, 0, 0, 0, 0, 0))

actions.append(a("check_bus_times", "Check Bus Times", "money_admin",
    ["mobility","preparedness","control","routine"], ["transport","planning"],
    "home_or_outside", ["any"], 3, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("book_travel", "Book Travel", "money_admin",
    ["adventure","freedom","fun","preparedness","mobility"], ["budget","planning"],
    "home", ["any"], 30, -1, 1, -15, 0, 0, 0, 2, 2))

actions.append(a("plan_trip", "Plan Trip", "money_admin",
    ["adventure","freedom","fun","preparedness","creativity"], ["planning","budget"],
    "home", ["any"], 40, -1, 1, 0, 0, 0, 0, 2, 2))


# ============================================================
# HEALTH FITNESS (30 actions)
# ============================================================
actions.append(a("meditate", "Meditate", "health_fitness",
    ["health","mental_stability","spirituality","discipline","restoration"], ["health","stress","focus"],
    "home_or_outside", ["morning","evening","any"], 15, -2, -4, 0, 0, 4, 0, 1, 2))

actions.append(a("pray", "Pray", "health_fitness",
    ["spirituality","meaning","restoration","discipline","healing"], ["health","stress"],
    "home_or_outside", ["morning","evening","any"], 10, 0, -2, 0, 0, 1, 0, 1, 1))

actions.append(a("journal", "Journal", "health_fitness",
    ["mental_stability","self_expression","meaning","discipline","healing"], ["health","stress"],
    "home", ["morning","evening","any"], 15, 0, -2, 0, 0, 1, 0, 1, 2))

actions.append(a("go_for_walk", "Go For Walk", "health_fitness",
    ["health","mental_stability","mobility","restoration","comfort"], ["energy","restoration"],
    "outside", ["any"], 20, -1, -2, 0, 1, 2, 0, 1, 1))

actions.append(a("walk_dog", "Walk Dog", "health_fitness",
    ["health","service","responsibility","routine","mobility"], ["energy","caregiving"],
    "outside", ["morning","evening","any"], 20, -2, -2, 0, 1, 2, 0, 1, 2))

actions.append(a("play_with_pet", "Play With Pet", "health_fitness",
    ["fun","restoration","belonging","comfort"], ["energy","fun"],
    "home_or_outside", ["any"], 15, -1, -2, 0, 1, 1, 0, 3, 0))

actions.append(a("feed_pet", "Feed Pet", "health_fitness",
    ["service","routine","discipline","responsibility","love"], ["caregiving"],
    "home", ["morning","evening"], 5, 0, 0, -1, 1, 0, 0, 0, 1))

actions.append(a("clean_litter_box", "Clean Litter Box", "health_fitness",
    ["order","homebuilding","discipline","responsibility"], ["cleanliness","caregiving"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 2, 0, 1))

actions.append(a("exercise_at_home", "Exercise At Home", "health_fitness",
    ["health","discipline","confidence","restoration","longevity"], ["energy","health"],
    "home", ["any"], 30, -3, -2, 0, 0, 4, 0, 1, 2))

actions.append(a("go_to_gym", "Go To Gym", "health_fitness",
    ["health","discipline","confidence","longevity","identity"], ["energy","health"],
    "outside", ["any"], 60, -4, -1, -5, 1, 5, 0, 1, 2))

actions.append(a("lift_weights", "Lift Weights", "health_fitness",
    ["health","discipline","confidence","mastery","longevity"], ["energy","health"],
    "home_or_outside", ["any"], 30, -3, -1, 0, 0, 4, 0, 0, 2))

actions.append(a("do_yoga", "Do Yoga", "health_fitness",
    ["health","mental_stability","restoration","discipline"], ["energy","restoration"],
    "home_or_outside", ["any"], 30, -1, -3, 0, 0, 3, 0, 1, 2))

actions.append(a("go_for_run", "Go For Run", "health_fitness",
    ["health","discipline","confidence","longevity","restoration"], ["energy","health"],
    "outside", ["any"], 30, -3, -2, 0, 0, 4, 0, 1, 2))

actions.append(a("ride_exercise_bike", "Ride Exercise Bike", "health_fitness",
    ["health","discipline","longevity","restoration"], ["energy","health"],
    "home_or_outside", ["any"], 30, -2, -2, 0, 0, 3, 0, 1, 1))

actions.append(a("play_sport", "Play Sport", "health_fitness",
    ["health","fun","belonging","confidence","mastery"], ["energy","social"],
    "outside", ["any"], 60, -4, -2, 0, 2, 4, 0, 3, 1))

actions.append(a("cool_down", "Cool Down", "health_fitness",
    ["health","restoration","discipline","routine"], ["energy","health"],
    "home_or_outside", ["any"], 10, 1, -1, 0, 0, 1, 0, 0, 1))

actions.append(a("take_post_workout_shower", "Take Post Workout Shower", "health_fitness",
    ["health","comfort","self_respect","routine"], ["hygiene","comfort"],
    "home_or_outside", ["any"], 10, 0, -1, 0, 0, 1, 6, 0, 0))

actions.append(a("track_steps", "Track Steps", "health_fitness",
    ["health","discipline","control","longevity"], ["health","planning"],
    "home_or_outside", ["any"], 2, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("weigh_in", "Weigh In", "health_fitness",
    ["health","discipline","control","longevity"], ["health"],
    "home", ["morning","any"], 2, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("check_blood_pressure", "Check Blood Pressure", "health_fitness",
    ["health","longevity","control","preparedness"], ["health"],
    "home", ["any"], 5, 0, 0, 0, 0, 1, 0, 0, 1))

actions.append(a("go_to_doctor", "Go To Doctor", "health_fitness",
    ["health","longevity","preparedness","stability","healing"], ["health","transport","budget"],
    "outside", ["any"], 60, -2, 2, -20, 0, 3, 0, -1, 2))

actions.append(a("go_to_dentist", "Go To Dentist", "health_fitness",
    ["health","longevity","self_respect","preparedness"], ["health","transport","budget"],
    "outside", ["any"], 60, -2, 2, -15, 0, 3, 0, -1, 2))

actions.append(a("go_to_therapy", "Go To Therapy", "health_fitness",
    ["mental_stability","healing","confidence","restoration","meaning"], ["health","budget"],
    "outside", ["any"], 60, -2, -3, -4, 0, 4, 0, 1, 2))

actions.append(a("pick_up_prescription", "Pick Up Prescription", "health_fitness",
    ["health","stability","preparedness","routine"], ["health","transport","budget"],
    "outside", ["any"], 20, -2, -2, -3, 0, 4, 0, 1, 2))

actions.append(a("practice_breathing", "Practice Breathing", "health_fitness",
    ["mental_stability","restoration","discipline","health"], ["stress","restoration"],
    "home_or_outside", ["any"], 10, 0, -3, 0, 0, 1, 0, 0, 1))

actions.append(a("reduce_screen_time", "Reduce Screen Time", "health_fitness",
    ["health","mental_stability","balance","discipline","restoration"], ["health","restoration"],
    "home", ["evening","any"], 30, 1, -2, 0, 0, 1, 0, 0, 1))

actions.append(a("rest_eyes", "Rest Eyes", "health_fitness",
    ["health","restoration","comfort","balance"], ["health","restoration"],
    "home", ["any"], 5, 1, -1, 0, 0, 1, 0, 0, 0))

actions.append(a("sleep_early", "Sleep Early", "health_fitness",
    ["health","longevity","restoration","discipline","balance"], ["sleep","restoration"],
    "home", ["evening","night"], 30, 3, -2, 0, 0, 3, 0, 0, 2))

actions.append(a("nap", "Nap", "health_fitness",
    ["restoration","health","comfort","balance"], ["sleep","energy"],
    "home", ["midday","any"], 30, 5, -2, 0, 0, 2, 0, 0, 0))

actions.append(a("rest_on_couch", "Rest On Couch", "health_fitness",
    ["restoration","comfort","balance","pleasure"], ["energy","restoration"],
    "home", ["any"], 20, 3, -2, 0, 0, 1, 0, 1, 0))


# ============================================================
# SOCIAL RELATIONSHIPS (31 actions)
# ============================================================
actions.append(a("say_good_morning", "Say Good Morning", "social_relationships",
    ["belonging","friendship","family","love","community"], ["social","belonging"],
    "home_or_outside", ["morning"], 2, 0, -1, 0, 2, 0, 0, 1, 0))

actions.append(a("greet_neighbor", "Greet Neighbor", "social_relationships",
    ["belonging","community","friendship","reputation"], ["social","belonging"],
    "outside", ["any"], 3, 0, -1, 0, 1, 0, 0, 0, 0))

actions.append(a("talk_to_roommate", "Talk To Roommate", "social_relationships",
    ["belonging","friendship","comfort","homebuilding"], ["social","belonging"],
    "home", ["any"], 10, 0, -1, 0, 2, 0, 0, 1, 0))

actions.append(a("text_friend", "Text Friend", "social_relationships",
    ["friendship","belonging","love","community"], ["social","communication"],
    "home_or_outside", ["any"], 8, -1, -1, 0, 3, 0, 0, 2, 0))

actions.append(a("call_family", "Call Family", "social_relationships",
    ["family","belonging","love","friendship","community"], ["social","communication"],
    "home_or_outside", ["any"], 15, -1, -1, 0, 4, 0, 0, 2, 0))

actions.append(a("video_chat_partner", "Video Chat Partner", "social_relationships",
    ["love","romance","belonging","friendship","comfort"], ["social","communication"],
    "home", ["any"], 20, -1, -1, 0, 4, 0, 0, 2, 0))

actions.append(a("make_plans", "Make Plans", "social_relationships",
    ["friendship","belonging","fun","preparedness","control"], ["social","planning"],
    "home_or_outside", ["any"], 10, 0, 0, 0, 2, 0, 0, 1, 0))

actions.append(a("go_on_date", "Go On Date", "social_relationships",
    ["romance","love","fun","confidence","belonging"], ["social","budget","romance"],
    "outside", ["evening"], 120, -1, -1, -6, 5, 0, 0, 3, 0))

actions.append(a("visit_friend", "Visit Friend", "social_relationships",
    ["friendship","belonging","fun","love","community"], ["social","transport"],
    "outside", ["any"], 60, -1, -1, 0, 4, 0, 0, 3, 0))

actions.append(a("host_guest", "Host Guest", "social_relationships",
    ["belonging","friendship","homebuilding","reputation","service"], ["social","planning"],
    "home", ["any"], 60, -2, 0, -5, 4, 0, 0, 2, 0))

actions.append(a("attend_party", "Attend Party", "social_relationships",
    ["fun","belonging","friendship","adventure","confidence"], ["social","transport"],
    "outside", ["evening"], 120, -2, -1, -5, 5, 0, 0, 4, 0))

actions.append(a("attend_family_event", "Attend Family Event", "social_relationships",
    ["family","belonging","love","tradition","community"], ["social","transport"],
    "outside", ["any"], 120, -2, 0, -5, 4, 0, 0, 2, 0))

actions.append(a("chat_with_cashier", "Chat With Cashier", "social_relationships",
    ["belonging","community","confidence","friendship"], ["social"],
    "outside", ["any"], 3, 0, 0, 0, 1, 0, 0, 0, 0))

actions.append(a("meet_new_person", "Meet New Person", "social_relationships",
    ["adventure","confidence","belonging","friendship","community"], ["social"],
    "outside", ["any"], 15, -1, 1, 0, 3, 0, 0, 1, 0))

actions.append(a("network_professionally", "Network Professionally", "social_relationships",
    ["career","reputation","status","belonging","confidence"], ["social","work"],
    "outside", ["any"], 30, -2, 1, 0, 3, 0, 0, 0, 1))

actions.append(a("thank_someone", "Thank Someone", "social_relationships",
    ["belonging","friendship","reputation","self_respect","service"], ["social"],
    "home_or_outside", ["any"], 3, 0, -1, 0, 2, 0, 0, 0, 0))

actions.append(a("apologize", "Apologize", "social_relationships",
    ["healing","family","friendship","self_respect"], ["healing","social"],
    "home_or_outside", ["any"], 8, 0, 0, 0, 2, 0, 0, 0, 1))

actions.append(a("resolve_argument", "Resolve Argument", "social_relationships",
    ["healing","family","friendship","belonging","self_respect"], ["healing","social"],
    "home_or_outside", ["any"], 20, -2, -2, 0, 3, 0, 0, 0, 2))

actions.append(a("check_in_on_friend", "Check In On Friend", "social_relationships",
    ["friendship","service","belonging","love","community"], ["social","communication"],
    "home_or_outside", ["any"], 10, 0, -1, 0, 3, 0, 0, 1, 0))

actions.append(a("give_gift", "Give Gift", "social_relationships",
    ["love","friendship","belonging","service","reputation"], ["social","budget"],
    "home_or_outside", ["any"], 10, 0, -1, -5, 4, 0, 0, 2, 0))

actions.append(a("receive_guest", "Receive Guest", "social_relationships",
    ["belonging","friendship","homebuilding","service","reputation"], ["social","planning"],
    "home", ["any"], 30, -1, 0, -3, 3, 0, 0, 1, 0))

actions.append(a("play_board_game", "Play Board Game", "social_relationships",
    ["fun","belonging","friendship","family","community"], ["social","fun"],
    "home_or_outside", ["any"], 45, 0, -1, 0, 4, 0, 0, 4, 0))

actions.append(a("watch_movie_together", "Watch Movie Together", "social_relationships",
    ["fun","belonging","friendship","family","comfort"], ["social","fun"],
    "home_or_outside", ["evening","any"], 120, 1, -2, 0, 3, 0, 0, 3, 0))

actions.append(a("share_news", "Share News", "social_relationships",
    ["belonging","friendship","family","community"], ["social","communication"],
    "home_or_outside", ["any"], 5, 0, 0, 0, 2, 0, 0, 0, 0))

actions.append(a("listen_to_someone", "Listen To Someone", "social_relationships",
    ["service","friendship","belonging","love","healing"], ["social"],
    "home_or_outside", ["any"], 15, -1, 0, 0, 3, 0, 0, 0, 1))

actions.append(a("give_advice", "Give Advice", "social_relationships",
    ["service","friendship","reputation","confidence","meaning"], ["social","knowledge"],
    "home_or_outside", ["any"], 10, -1, 0, 0, 2, 0, 0, 0, 0))

actions.append(a("ask_for_help", "Ask For Help", "social_relationships",
    ["belonging","friendship","healing","confidence"], ["social","communication"],
    "home_or_outside", ["any"], 10, 0, 1, 0, 2, 0, 0, 0, 1))

actions.append(a("offer_help", "Offer Help", "social_relationships",
    ["service","belonging","friendship","recognition"], ["social"],
    "home_or_outside", ["any"], 15, -1, -1, 0, 3, 0, 0, 1, 1))

actions.append(a("celebrate_event", "Celebrate Event", "social_relationships",
    ["fun","belonging","family","friendship","meaning"], ["social","budget"],
    "home_or_outside", ["any"], 60, -2, -2, -10, 5, 0, 0, 4, 0))

actions.append(a("post_birthday_message", "Post Birthday Message", "social_relationships",
    ["friendship","belonging","love","community","service"], ["social","communication"],
    "home_or_outside", ["any"], 5, 0, 0, 0, 2, 0, 0, 1, 0))


# ============================================================
# LEISURE GROWTH (30 actions)
# ============================================================
actions.append(a("watch_tv", "Watch TV", "leisure_growth",
    ["fun","restoration","comfort","balance"], ["restoration","fun"],
    "home", ["evening","any"], 45, 1, -1, 0, 0, 0, 0, 3, 0))

actions.append(a("watch_stream", "Watch Stream", "leisure_growth",
    ["fun","restoration","comfort","community"], ["restoration","fun"],
    "home", ["any"], 40, 1, -2, 0, 1, 0, 0, 4, -1))

actions.append(a("listen_to_music", "Listen To Music", "leisure_growth",
    ["fun","restoration","self_expression","comfort"], ["restoration","fun"],
    "home_or_outside", ["any"], 20, 0, -1, 0, 0, 0, 0, 2, 0))

actions.append(a("listen_to_podcast", "Listen To Podcast", "leisure_growth",
    ["education","fun","meaning","restoration"], ["restoration","learning"],
    "home_or_outside", ["any"], 30, 0, -1, 0, 0, 0, 0, 2, 1))

actions.append(a("read_book", "Read Book", "leisure_growth",
    ["education","fun","meaning","balance"], ["restoration","learning"],
    "home", ["any"], 30, 1, -2, 0, 0, 0, 0, 3, 1))

actions.append(a("read_news", "Read News", "leisure_growth",
    ["preparedness","education","control","community"], ["learning"],
    "home_or_outside", ["morning","any"], 10, 0, 1, 0, 0, 0, 0, 1, 0))

actions.append(a("browse_internet", "Browse Internet", "leisure_growth",
    ["fun","restoration","curiosity","comfort"], ["restoration","fun"],
    "home", ["any"], 20, 0, 0, 0, 0, 0, 0, 2, -1))

actions.append(a("check_social_media", "Check Social Media", "leisure_growth",
    ["belonging","fun","community","self_expression"], ["social","fun"],
    "home_or_outside", ["any"], 10, 0, 0, 0, 1, 0, 0, 2, -1))

actions.append(a("post_online", "Post Online", "leisure_growth",
    ["self_expression","community","recognition","creativity"], ["social","communication"],
    "home_or_outside", ["any"], 10, 0, 0, 0, 1, 0, 0, 1, 0))

actions.append(a("take_photo", "Take Photo", "leisure_growth",
    ["creativity","self_expression","fun","meaning"], ["fun","creativity"],
    "home_or_outside", ["any"], 5, 0, -1, 0, 0, 0, 0, 2, 0))

actions.append(a("edit_photo", "Edit Photo", "leisure_growth",
    ["creativity","mastery","self_expression","fun"], ["fun","creativity"],
    "home", ["any"], 20, -1, -1, 0, 0, 0, 0, 2, 1))

actions.append(a("draw", "Draw", "leisure_growth",
    ["creativity","self_expression","fun","mastery","meaning"], ["fun","creativity"],
    "home", ["any"], 30, -1, -2, 0, 0, 0, 0, 3, 1))

actions.append(a("paint", "Paint", "leisure_growth",
    ["creativity","self_expression","fun","mastery","meaning"], ["fun","creativity"],
    "home", ["any"], 45, -2, -2, -2, 0, 0, 0, 4, 1))

actions.append(a("craft", "Craft", "leisure_growth",
    ["creativity","mastery","fun","self_expression","homebuilding"], ["fun","creativity"],
    "home", ["any"], 40, -2, -1, -3, 0, 0, 0, 3, 1))

actions.append(a("write_poem", "Write Poem", "leisure_growth",
    ["creativity","self_expression","meaning","healing","fun"], ["fun","creativity"],
    "home", ["any"], 30, 1, -1, 0, 0, 0, 0, 3, 1))

actions.append(a("write_story", "Write Story", "leisure_growth",
    ["creativity","self_expression","meaning","mastery","fun"], ["fun","creativity"],
    "home", ["any"], 45, -1, -1, 0, 0, 0, 0, 3, 2))

actions.append(a("practice_instrument", "Practice Instrument", "leisure_growth",
    ["mastery","creativity","self_expression","fun","discipline"], ["fun","creativity"],
    "home", ["any"], 30, -1, -1, 0, 0, 0, 0, 3, 2))

actions.append(a("sing", "Sing", "leisure_growth",
    ["fun","self_expression","restoration","confidence"], ["fun"],
    "home_or_outside", ["any"], 10, 0, -2, 0, 0, 0, 0, 3, 0))

actions.append(a("play_video_game", "Play Video Game", "leisure_growth",
    ["fun","restoration","belonging","creativity"], ["restoration","fun"],
    "home", ["evening","any"], 60, 1, -2, 0, 1, 0, 0, 5, -1))

actions.append(a("solve_puzzle", "Solve Puzzle", "leisure_growth",
    ["mastery","fun","education","meaning"], ["fun","learning"],
    "home", ["any"], 20, -1, -1, 0, 0, 0, 0, 3, 1))

actions.append(a("study_language", "Study Language", "leisure_growth",
    ["education","mastery","discipline","meaning","adventure"], ["learning","focus"],
    "home", ["any"], 30, -2, 0, 0, 0, 0, 0, 1, 2))

actions.append(a("take_online_course", "Take Online Course", "leisure_growth",
    ["education","mastery","career","discipline","meaning"], ["learning","focus"],
    "home", ["any"], 45, -2, 0, -5, 0, 0, 0, 1, 2))

actions.append(a("practice_hobby", "Practice Hobby", "leisure_growth",
    ["fun","mastery","self_expression","creativity","balance"], ["fun","creativity"],
    "home_or_outside", ["any"], 30, -1, -2, 0, 0, 0, 0, 3, 1))

actions.append(a("garden", "Garden", "leisure_growth",
    ["homebuilding","restoration","creativity","health","meaning"], ["fun","health"],
    "outside", ["any"], 30, -2, -2, -2, 0, 1, 0, 2, 1))

actions.append(a("go_to_park", "Go To Park", "leisure_growth",
    ["fun","restoration","health","freedom","adventure"], ["fun","energy"],
    "outside", ["any"], 30, -1, -2, 0, 1, 1, 0, 3, 0))

actions.append(a("sit_outside", "Sit Outside", "leisure_growth",
    ["restoration","comfort","pleasure","balance","fun"], ["restoration","fun"],
    "outside", ["any"], 15, 1, -2, 0, 0, 0, 0, 2, 0))

actions.append(a("stargaze", "Stargaze", "leisure_growth",
    ["fun","meaning","spirituality","adventure","pleasure"], ["fun","restoration"],
    "outside", ["night"], 20, 0, -2, 0, 0, 0, 0, 3, 0))

actions.append(a("shop_for_fun", "Shop For Fun", "leisure_growth",
    ["fun","self_expression","ownership","comfort","adventure"], ["fun","budget"],
    "outside", ["any"], 45, -1, -1, -10, 0, 0, 0, 3, 0))

actions.append(a("window_shop", "Window Shop", "leisure_growth",
    ["fun","restoration","adventure","comfort"], ["fun"],
    "outside", ["any"], 20, 0, -1, 0, 0, 0, 0, 2, 0))

actions.append(a("reflect_on_day", "Reflect On Day", "leisure_growth",
    ["meaning","self_respect","balance","mental_stability","discipline"], ["restoration","planning"],
    "home", ["evening","night"], 10, 0, -2, 0, 0, 0, 0, 1, 1))


# ============================================================
# ERRANDS MOBILITY (30 actions)
# ============================================================
actions.append(a("leave_home", "Leave Home", "errands_mobility",
    ["mobility","preparedness","independence","control"], ["transport","planning"],
    "outside", ["any"], 3, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("wait_in_line", "Wait In Line", "errands_mobility",
    ["patience","discipline","control","independence"], ["time"],
    "outside", ["any"], 10, -1, 2, 0, 0, 0, 0, -1, 1))

actions.append(a("drive_to_store", "Drive To Store", "errands_mobility",
    ["mobility","preparedness","independence","control"], ["transport","time"],
    "outside", ["any"], 15, -1, 1, -1, 0, 0, 0, 0, 0))

actions.append(a("walk_to_stop", "Walk To Stop", "errands_mobility",
    ["mobility","health","independence","routine"], ["transport","energy"],
    "outside", ["any"], 10, -1, 0, 0, 0, 1, 0, 0, 0))

actions.append(a("pick_up_prescription_local", "Pick Up Prescription Local", "errands_mobility",
    ["health","preparedness","stability","routine"], ["health","transport"],
    "outside", ["any"], 15, -1, 0, -3, 0, 1, 0, 0, 1))

actions.append(a("drop_off_package", "Drop Off Package", "errands_mobility",
    ["order","control","preparedness","independence"], ["transport","time"],
    "outside", ["any"], 15, -1, 0, -1, 0, 0, 0, 0, 1))

actions.append(a("mail_letter", "Mail Letter", "errands_mobility",
    ["order","control","discipline","community"], ["transport","time"],
    "outside", ["any"], 10, 0, 0, -1, 0, 0, 0, 0, 1))

actions.append(a("visit_pharmacy", "Visit Pharmacy", "errands_mobility",
    ["health","preparedness","stability","control"], ["health","transport"],
    "outside", ["any"], 20, -1, 0, -5, 0, 1, 0, 0, 1))

actions.append(a("visit_bank", "Visit Bank", "errands_mobility",
    ["wealth","security","control","independence"], ["budget","transport"],
    "outside", ["any"], 20, -1, 1, 0, 0, 0, 0, -1, 1))

actions.append(a("visit_hardware_store", "Visit Hardware Store", "errands_mobility",
    ["ownership","homebuilding","preparedness","control"], ["budget","transport"],
    "outside", ["any"], 25, -1, 0, -10, 0, 0, 0, 0, 1))

actions.append(a("visit_post_office", "Visit Post Office", "errands_mobility",
    ["order","control","community","preparedness"], ["transport","time"],
    "outside", ["any"], 20, -1, 1, -1, 0, 0, 0, -1, 1))

actions.append(a("visit_library", "Visit Library", "errands_mobility",
    ["education","fun","meaning","freedom","community"], ["transport","time"],
    "outside", ["any"], 30, -1, -1, 0, 0, 0, 0, 2, 1))

actions.append(a("visit_market", "Visit Market", "errands_mobility",
    ["survival","preparedness","community","adventure","fun"], ["transport","budget"],
    "outside", ["any"], 30, -1, 0, -8, 0, 0, 0, 1, 0))

actions.append(a("pick_up_dry_cleaning", "Pick Up Dry Cleaning", "errands_mobility",
    ["order","self_respect","preparedness","reputation"], ["transport","budget"],
    "outside", ["any"], 15, -1, 0, -5, 0, 0, 0, 0, 1))

actions.append(a("fill_air_in_tires", "Fill Air In Tires", "errands_mobility",
    ["mobility","preparedness","security","control"], ["transport"],
    "outside", ["any"], 10, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("wash_car", "Wash Car", "errands_mobility",
    ["ownership","self_respect","order","homebuilding"], ["transport","time"],
    "outside", ["any"], 20, -2, -1, -3, 0, 0, 0, 0, 1))

actions.append(a("clean_car_interior", "Clean Car Interior", "errands_mobility",
    ["order","ownership","self_respect","comfort"], ["transport","time"],
    "outside", ["any"], 20, -2, -1, 0, 0, 0, 2, 0, 1))

actions.append(a("check_traffic", "Check Traffic", "errands_mobility",
    ["mobility","preparedness","control","routine"], ["transport","planning"],
    "home_or_outside", ["any"], 3, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("find_parking", "Find Parking", "errands_mobility",
    ["mobility","control","independence"], ["transport","time"],
    "outside", ["any"], 10, -1, 2, -1, 0, 0, 0, -1, 0))

actions.append(a("carry_bags_home", "Carry Bags Home", "errands_mobility",
    ["mobility","health","independence","preparedness"], ["transport","energy"],
    "outside", ["any"], 10, -2, 0, 0, 0, 1, 0, 0, 0))

actions.append(a("escort_someone", "Escort Someone", "errands_mobility",
    ["service","family","belonging","security"], ["social","transport"],
    "outside", ["any"], 20, -1, 0, 0, 2, 0, 0, 0, 1))

actions.append(a("cross_street_safely", "Cross Street Safely", "errands_mobility",
    ["security","health","mobility","control"], ["safety"],
    "outside", ["any"], 1, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("use_elevator", "Use Elevator", "errands_mobility",
    ["mobility","comfort","independence"], ["transport"],
    "outside", ["any"], 2, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("use_stairs", "Use Stairs", "errands_mobility",
    ["health","mobility","discipline","independence"], ["transport","energy"],
    "outside", ["any"], 3, -1, 0, 0, 0, 1, 0, 0, 0))

actions.append(a("hail_rideshare", "Hail Rideshare", "errands_mobility",
    ["mobility","independence","control","preparedness"], ["transport","budget"],
    "outside", ["any"], 5, 0, 0, -8, 0, 0, 0, 0, 0))

actions.append(a("call_taxi", "Call Taxi", "errands_mobility",
    ["mobility","independence","control","preparedness"], ["transport","budget"],
    "outside", ["any"], 5, 0, 0, -10, 0, 0, 0, 0, 0))

actions.append(a("check_map", "Check Map", "errands_mobility",
    ["mobility","preparedness","control","independence"], ["transport","planning"],
    "outside", ["any"], 2, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("charge_phone_on_the_go", "Charge Phone On The Go", "errands_mobility",
    ["preparedness","control","mobility","independence"], ["planning"],
    "outside", ["any"], 2, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("refill_transit_card", "Refill Transit Card", "errands_mobility",
    ["mobility","preparedness","independence","routine"], ["transport","budget"],
    "outside", ["any"], 5, 0, 0, -5, 0, 0, 0, 0, 1))

actions.append(a("go_home", "Go Home", "errands_mobility",
    ["comfort","restoration","security","homebuilding"], ["transport"],
    "outside", ["any"], 20, -1, -1, 0, 0, 0, 0, 0, 0))


# ============================================================
# CAREGIVING PARENTING (30 actions)
# ============================================================
actions.append(a("wake_child", "Wake Child", "caregiving_parenting",
    ["family","service","love","parenting","meaning"], ["family","duty","care"],
    "home", ["morning"], 5, -1, 0, 0, 2, 0, 0, 0, 1))

actions.append(a("dress_child", "Dress Child", "caregiving_parenting",
    ["family","service","love","parenting","routine"], ["family","duty","care"],
    "home", ["morning"], 10, -1, 0, 0, 2, 0, 1, 0, 1))

actions.append(a("prepare_child_meal", "Prepare Child Meal", "caregiving_parenting",
    ["family","service","love","parenting","health"], ["family","duty","care"],
    "home", ["morning","midday","evening"], 15, -2, 0, -2, 2, 1, 0, 0, 1))

actions.append(a("feed_child", "Feed Child", "caregiving_parenting",
    ["family","service","love","parenting","meaning"], ["family","duty","care"],
    "home", ["morning","midday","evening"], 15, -1, 0, 0, 3, 1, 0, 1, 1))

actions.append(a("pack_school_bag", "Pack School Bag", "caregiving_parenting",
    ["family","preparedness","parenting","discipline","routine"], ["family","planning"],
    "home", ["morning"], 5, 0, 0, 0, 1, 0, 0, 0, 1))

actions.append(a("walk_child_to_school", "Walk Child To School", "caregiving_parenting",
    ["family","service","love","parenting","health"], ["family","transport"],
    "outside", ["morning"], 20, -2, 0, 0, 3, 1, 0, 1, 1))

actions.append(a("pick_up_child", "Pick Up Child", "caregiving_parenting",
    ["family","service","love","parenting","routine"], ["family","transport"],
    "outside", ["any"], 20, -2, 0, 0, 3, 0, 0, 1, 1))

actions.append(a("help_with_homework", "Help With Homework", "caregiving_parenting",
    ["family","education","parenting","meaning","service"], ["family","focus"],
    "home", ["evening"], 30, -2, 1, 0, 3, 0, 0, 0, 2))

actions.append(a("read_to_child", "Read To Child", "caregiving_parenting",
    ["family","love","parenting","education","meaning"], ["family","fun"],
    "home", ["evening","any"], 20, -1, -1, 0, 4, 0, 0, 2, 1))

actions.append(a("bathe_child", "Bathe Child", "caregiving_parenting",
    ["family","service","parenting","health","love"], ["family","hygiene"],
    "home", ["evening"], 15, -2, 0, 0, 2, 1, 2, 0, 1))

actions.append(a("put_child_to_bed", "Put Child To Bed", "caregiving_parenting",
    ["family","love","parenting","routine","comfort"], ["family","sleep"],
    "home", ["evening","night"], 15, -1, -1, 0, 3, 0, 0, 1, 1))

actions.append(a("check_on_elder", "Check On Elder", "caregiving_parenting",
    ["family","service","love","meaning","belonging"], ["family","communication"],
    "home_or_outside", ["any"], 15, -1, 0, 0, 3, 0, 0, 0, 1))

actions.append(a("help_someone_mobility", "Help Someone Mobility", "caregiving_parenting",
    ["service","family","love","belonging","meaning"], ["family","duty"],
    "home_or_outside", ["any"], 15, -2, 0, 0, 3, 0, 0, 0, 1))

actions.append(a("prepare_medicine_for_other", "Prepare Medicine For Other", "caregiving_parenting",
    ["service","family","love","health","parenting"], ["family","health"],
    "home", ["any"], 5, 0, 0, 0, 2, 1, 0, 0, 1))

actions.append(a("drive_someone_to_appointment", "Drive Someone To Appointment", "caregiving_parenting",
    ["service","family","love","mobility","meaning"], ["family","transport"],
    "outside", ["any"], 30, -2, 1, -3, 3, 0, 0, 0, 1))

actions.append(a("comfort_someone", "Comfort Someone", "caregiving_parenting",
    ["love","service","healing","family","belonging"], ["family","social"],
    "home_or_outside", ["any"], 15, -1, -1, 0, 4, 0, 0, 0, 1))

actions.append(a("supervise_play", "Supervise Play", "caregiving_parenting",
    ["parenting","family","security","love","fun"], ["family","safety"],
    "home_or_outside", ["any"], 30, -2, 0, 0, 3, 0, 0, 2, 1))

actions.append(a("attend_school_event", "Attend School Event", "caregiving_parenting",
    ["family","parenting","belonging","community","love"], ["family","transport"],
    "outside", ["any"], 60, -2, 0, 0, 3, 0, 0, 1, 1))

actions.append(a("talk_about_day", "Talk About Day", "caregiving_parenting",
    ["family","love","belonging","parenting","meaning"], ["family","social"],
    "home", ["evening"], 15, 0, -1, 0, 4, 0, 0, 1, 0))

actions.append(a("clean_up_after_child", "Clean Up After Child", "caregiving_parenting",
    ["order","homebuilding","parenting","discipline","service"], ["cleanliness","order"],
    "home", ["any"], 10, -1, 0, 0, 1, 0, 2, 0, 1))

actions.append(a("replace_diaper", "Replace Diaper", "caregiving_parenting",
    ["parenting","service","love","health","routine"], ["family","hygiene"],
    "home_or_outside", ["any"], 5, -1, 0, -1, 1, 0, 2, 0, 1))

actions.append(a("calm_tantrum", "Calm Tantrum", "caregiving_parenting",
    ["parenting","love","healing","resilience","family"], ["family","emotional"],
    "home_or_outside", ["any"], 15, -3, 2, 0, 2, 0, 0, 0, 2))

actions.append(a("prepare_bottle", "Prepare Bottle", "caregiving_parenting",
    ["parenting","service","love","health","routine"], ["family","health"],
    "home", ["any"], 5, 0, 0, -1, 1, 0, 0, 0, 1))

actions.append(a("sterilize_items", "Sterilize Items", "caregiving_parenting",
    ["health","order","parenting","discipline","security"], ["cleanliness","health"],
    "home", ["any"], 10, -1, 0, 0, 0, 1, 2, 0, 1))

actions.append(a("monitor_health", "Monitor Health", "caregiving_parenting",
    ["health","parenting","love","preparedness","security"], ["family","health"],
    "home_or_outside", ["any"], 5, 0, 0, 0, 1, 1, 0, 0, 1))

actions.append(a("arrange_childcare", "Arrange Childcare", "caregiving_parenting",
    ["parenting","preparedness","control","family","independence"], ["family","planning","budget"],
    "home_or_outside", ["any"], 15, -1, 1, -10, 1, 0, 0, 0, 1))

actions.append(a("sign_permission_form", "Sign Permission Form", "caregiving_parenting",
    ["parenting","family","discipline","preparedness"], ["family","planning"],
    "home", ["any"], 3, 0, 0, 0, 1, 0, 0, 0, 1))

actions.append(a("attend_parent_meeting", "Attend Parent Meeting", "caregiving_parenting",
    ["parenting","family","community","belonging","education"], ["family","transport"],
    "outside", ["any"], 45, -2, 1, 0, 2, 0, 0, 0, 1))

actions.append(a("help_relative_with_tasks", "Help Relative With Tasks", "caregiving_parenting",
    ["family","service","love","belonging","meaning"], ["family","duty"],
    "home_or_outside", ["any"], 30, -3, 0, 0, 3, 0, 0, 0, 1))

actions.append(a("keep_dependents_safe", "Keep Dependents Safe", "caregiving_parenting",
    ["parenting","security","love","family","control"], ["family","safety"],
    "home_or_outside", ["any"], 15, -2, 1, 0, 2, 0, 0, 0, 2))


# ============================================================
# MAINTENANCE REPAIR (30 actions)
# ============================================================
actions.append(a("change_lightbulb", "Change Lightbulb", "maintenance_repair",
    ["ownership","security","order","preparedness","control"], ["ownership","safety","order"],
    "home", ["any"], 6, -1, 0, -1, 0, 0, 0, 0, 1))

actions.append(a("replace_battery", "Replace Battery", "maintenance_repair",
    ["ownership","security","preparedness","control"], ["ownership","safety"],
    "home", ["any"], 5, -1, 0, -1, 0, 0, 0, 0, 1))

actions.append(a("tighten_screw", "Tighten Screw", "maintenance_repair",
    ["ownership","order","homebuilding","control"], ["ownership","order"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("assemble_furniture", "Assemble Furniture", "maintenance_repair",
    ["homebuilding","ownership","mastery","control"], ["ownership","order"],
    "home", ["any"], 60, -4, 2, 0, 0, 0, 0, 1, 2))

actions.append(a("hang_picture", "Hang Picture", "maintenance_repair",
    ["homebuilding","self_expression","ownership","comfort"], ["ownership","order"],
    "home", ["any"], 10, -1, 0, 0, 0, 0, 0, 1, 1))

actions.append(a("reset_router", "Reset Router", "maintenance_repair",
    ["control","preparedness","productivity","ownership"], ["ownership","safety"],
    "home", ["any"], 8, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("restart_device", "Restart Device", "maintenance_repair",
    ["control","preparedness","productivity","ownership"], ["ownership"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("update_software", "Update Software", "maintenance_repair",
    ["security","control","preparedness","ownership"], ["ownership","safety"],
    "home", ["any"], 10, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("clean_keyboard", "Clean Keyboard", "maintenance_repair",
    ["order","ownership","discipline","self_respect"], ["cleanliness","ownership"],
    "home", ["any"], 10, -1, 0, 0, 0, 0, 1, 0, 0))

actions.append(a("wipe_screen", "Wipe Screen", "maintenance_repair",
    ["order","ownership","self_respect","comfort"], ["cleanliness","ownership"],
    "home", ["any"], 3, 0, 0, 0, 0, 0, 1, 0, 0))

actions.append(a("unclog_drain", "Unclog Drain", "maintenance_repair",
    ["homebuilding","order","ownership","control"], ["ownership","order"],
    "home", ["any"], 15, -2, 1, 0, 0, 0, 2, 0, 1))

actions.append(a("check_smoke_detector", "Check Smoke Detector", "maintenance_repair",
    ["security","preparedness","ownership","control"], ["safety"],
    "home", ["any"], 3, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("test_alarm", "Test Alarm", "maintenance_repair",
    ["security","preparedness","ownership","control"], ["safety"],
    "home", ["any"], 3, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("patch_small_hole", "Patch Small Hole", "maintenance_repair",
    ["homebuilding","ownership","mastery","control"], ["ownership","order"],
    "home", ["any"], 20, -2, 0, -2, 0, 0, 0, 0, 2))

actions.append(a("sew_button", "Sew Button", "maintenance_repair",
    ["mastery","self_respect","ownership","discipline"], ["ownership","clothing"],
    "home", ["any"], 10, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("mend_clothes", "Mend Clothes", "maintenance_repair",
    ["mastery","self_respect","ownership","discipline","wealth"], ["ownership","clothing"],
    "home", ["any"], 15, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("sharpen_tool", "Sharpen Tool", "maintenance_repair",
    ["ownership","mastery","preparedness","discipline"], ["ownership","order"],
    "home", ["any"], 10, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("organize_toolbox", "Organize Toolbox", "maintenance_repair",
    ["order","ownership","preparedness","discipline"], ["ownership","order"],
    "home", ["any"], 15, -1, -1, 0, 0, 0, 0, 0, 1))

actions.append(a("call_landlord", "Call Landlord", "maintenance_repair",
    ["homebuilding","security","control","preparedness"], ["communication","planning"],
    "home", ["any"], 10, -1, 1, 0, 1, 0, 0, 0, 1))

actions.append(a("report_issue", "Report Issue", "maintenance_repair",
    ["security","control","homebuilding","preparedness"], ["communication","planning"],
    "home", ["any"], 10, -1, 1, 0, 0, 0, 0, 0, 1))

actions.append(a("schedule_maintenance", "Schedule Maintenance", "maintenance_repair",
    ["homebuilding","preparedness","control","discipline"], ["planning","communication"],
    "home", ["any"], 10, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("inspect_appliance", "Inspect Appliance", "maintenance_repair",
    ["security","homebuilding","preparedness","ownership"], ["safety","order"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("refill_cleaning_supplies", "Refill Cleaning Supplies", "maintenance_repair",
    ["homebuilding","preparedness","order","routine"], ["planning","budget"],
    "home_or_outside", ["any"], 10, -1, 0, -5, 0, 0, 0, 0, 1))

actions.append(a("sort_recycling_rules", "Sort Recycling Rules", "maintenance_repair",
    ["order","community","discipline","preparedness"], ["order","planning"],
    "home", ["any"], 5, 0, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("break_down_boxes", "Break Down Boxes", "maintenance_repair",
    ["order","homebuilding","discipline","control"], ["cleanliness","order"],
    "home", ["any"], 5, -1, 0, 0, 0, 0, 1, 0, 0))

actions.append(a("move_furniture", "Move Furniture", "maintenance_repair",
    ["homebuilding","ownership","control","self_expression"], ["energy","order"],
    "home", ["any"], 20, -3, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("fix_loose_handle", "Fix Loose Handle", "maintenance_repair",
    ["homebuilding","ownership","mastery","control"], ["ownership","order"],
    "home", ["any"], 10, -1, 0, 0, 0, 0, 0, 0, 1))

actions.append(a("charge_devices", "Charge Devices", "maintenance_repair",
    ["preparedness","control","routine","ownership"], ["planning"],
    "home", ["evening","night","any"], 3, 0, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("untangle_cables", "Untangle Cables", "maintenance_repair",
    ["order","control","ownership","discipline"], ["order"],
    "home", ["any"], 10, -1, 0, 0, 0, 0, 0, 0, 0))

actions.append(a("label_storage", "Label Storage", "maintenance_repair",
    ["order","control","preparedness","ownership","discipline"], ["order","planning"],
    "home", ["any"], 15, -1, -1, -1, 0, 0, 0, 0, 1))


# ============================================================
# Add seq_in_category to all actions
# ============================================================
cat_counters = {}
for action in actions:
    cat = action["category"]
    cat_counters[cat] = cat_counters.get(cat, 0) + 1
    action["seq_in_category"] = cat_counters[cat]

data["actions"] = actions
data["counts"]["actions"] = len(actions)

# Write file
output_path = r"E:\batallion\other\everyday-life-rpg-systems.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Written {len(actions)} actions, {len(data['motives'])} motives, {len(data['categories'])} categories")
print(f"Category breakdown:")
for cat_id in [c["id"] for c in data["categories"]]:
    count = sum(1 for a in actions if a["category"] == cat_id)
    print(f"  {cat_id}: {count}")
