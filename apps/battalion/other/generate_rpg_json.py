import json

data = {
    "project": "Everyday Life RPG Systems Dataset",
    "version": "2.0.0",
    "schema_notes": {
        "delta_fields": "energy, stress, money, social, health, hygiene, fun, discipline — each an integer delta per action",
        "time_of_day": "array of valid periods: morning, afternoon, evening, night, any",
        "repeatable": "true if the action can be performed multiple times per day"
    },
    "counts": {"actions": 0, "motives": 50, "categories": 11},
    "categories": [],
    "motives": [],
    "actions": []
}

# ── 11 CATEGORIES ──
cats = [
    ("basic_needs", "Basic Needs", "Essential daily routines for survival and self-care"),
    ("food_cooking", "Food & Cooking", "Meal planning, preparation, eating, and kitchen tasks"),
    ("home_care", "Home Care", "Cleaning, laundry, organization, and household upkeep"),
    ("work_study", "Work & Study", "Career tasks, education, productivity, and professional development"),
    ("money_admin", "Money & Admin", "Financial management, budgeting, and administrative tasks"),
    ("health_fitness", "Health & Fitness", "Exercise, medical care, mental health, and wellness"),
    ("social_relationships", "Social & Relationships", "Interpersonal connections, community, and social activities"),
    ("leisure_growth", "Leisure & Growth", "Hobbies, entertainment, creativity, and personal development"),
    ("errands_mobility", "Errands & Mobility", "Transportation, errands, and out-of-home tasks"),
    ("caregiving_parenting", "Caregiving & Parenting", "Childcare, pet care, and nurturing responsibilities"),
    ("maintenance_repair", "Maintenance & Repair", "Home repair, yard work, vehicle care, and upkeep")
]
data["categories"] = [{"id": c[0], "label": c[1], "description": c[2]} for c in cats]

# ── 50 MOTIVES ──
motives_raw = [
    ("survival", "Survival", "Basic drive to sustain life and meet fundamental needs"),
    ("health", "Health", "Maintaining and improving physical well-being"),
    ("mental_stability", "Mental Stability", "Preserving emotional equilibrium and psychological health"),
    ("comfort", "Comfort", "Seeking physical and environmental ease"),
    ("routine", "Routine", "Maintaining predictable daily patterns"),
    ("discipline", "Discipline", "Building self-control and consistent habits"),
    ("productivity", "Productivity", "Accomplishing tasks and making efficient use of time"),
    ("mastery", "Mastery", "Developing deep competence in skills"),
    ("education", "Education", "Acquiring knowledge and understanding"),
    ("career", "Career", "Advancing professional standing and work life"),
    ("wealth", "Wealth", "Accumulating financial resources"),
    ("stability", "Stability", "Creating a secure and predictable life foundation"),
    ("independence", "Independence", "Achieving self-sufficiency and autonomy"),
    ("belonging", "Belonging", "Feeling accepted and part of a group"),
    ("love", "Love", "Giving and receiving deep emotional connection"),
    ("friendship", "Friendship", "Building and maintaining platonic bonds"),
    ("family", "Family", "Nurturing familial relationships and bonds"),
    ("reputation", "Reputation", "Building social standing and respect from others"),
    ("service", "Service", "Contributing to the well-being of others"),
    ("community", "Community", "Engaging with and strengthening local social networks"),
    ("meaning", "Meaning", "Finding purpose and significance in daily life"),
    ("identity", "Identity", "Defining and expressing who you are"),
    ("self_expression", "Self-Expression", "Communicating inner thoughts and feelings outward"),
    ("creativity", "Creativity", "Generating novel ideas and artistic output"),
    ("fun", "Fun", "Experiencing enjoyment and lighthearted pleasure"),
    ("restoration", "Restoration", "Recovering energy and healing from exertion"),
    ("security", "Security", "Protecting oneself and possessions from threat"),
    ("order", "Order", "Maintaining organization and structure in one's environment"),
    ("control", "Control", "Feeling in command of one's circumstances"),
    ("freedom", "Freedom", "Having autonomy and choice in actions"),
    ("status", "Status", "Achieving recognized social position"),
    ("romance", "Romance", "Pursuing romantic connection and intimacy"),
    ("homebuilding", "Homebuilding", "Creating a comfortable and functional living space"),
    ("self_respect", "Self-Respect", "Maintaining personal dignity and standards"),
    ("preparedness", "Preparedness", "Being ready for future challenges and needs"),
    ("confidence", "Confidence", "Building trust in one's own abilities"),
    ("balance", "Balance", "Achieving equilibrium between life domains"),
    ("healing", "Healing", "Recovering from illness, injury, or emotional pain"),
    ("mobility", "Mobility", "Maintaining ability to move and travel freely"),
    ("pleasure", "Pleasure", "Experiencing sensory and emotional enjoyment"),
    ("connection", "Connection", "Forming meaningful bonds with others"),
    ("support", "Support", "Providing or receiving help in times of need"),
    ("intimacy", "Intimacy", "Sharing deep personal closeness with another"),
    ("longevity", "Longevity", "Extending lifespan through healthy choices"),
    ("strength", "Strength", "Building physical and mental fortitude"),
    ("fitness", "Fitness", "Achieving and maintaining physical capability"),
    ("recognition", "Recognition", "Being acknowledged for one's contributions"),
    ("future", "Future", "Planning and preparing for what lies ahead"),
    ("celebration", "Celebration", "Marking achievements and special moments"),
    ("resilience", "Resilience", "Bouncing back from setbacks and adversity")
]
data["motives"] = [{"id": m[0], "label": m[1], "description": m[2]} for m in motives_raw]

# ── ACTIONS ──
# Format: (id, label, related_motives, needs, location, time_of_day, time_minutes,
#           energy, stress, money, social, health, hygiene, fun, discipline, repeatable, prerequisites)

def A(id, label, cat, motives, needs, loc, tod, mins, en, st, mo, so, he, hy, fu, di, rep=True, prereqs=None):
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

# ═══════════════════════════════════════
# BASIC NEEDS (30)
# ═══════════════════════════════════════
actions += [
    A("wake_up","Wake Up","basic_needs",["survival","routine"],["alarm"],"bedroom",["morning"],1, 5,-2,0,0,0,0,0,3),
    A("snooze_alarm","Snooze Alarm","basic_needs",["comfort","restoration"],["alarm"],"bedroom",["morning"],9, 3,2,0,0,0,0,1,-3),
    A("get_out_of_bed","Get Out of Bed","basic_needs",["discipline","routine"],[],"bedroom",["morning"],1, -2,-1,0,0,0,0,0,4),
    A("make_bed","Make Bed","basic_needs",["order","discipline","homebuilding"],[],"bedroom",["morning"],3, -2,-2,0,0,0,0,0,5),
    A("open_blinds","Open Blinds","basic_needs",["comfort","routine"],[],"bedroom",["morning"],1, 1,-1,0,0,0,0,1,1),
    A("open_window","Open Window","basic_needs",["comfort","health"],[],"bedroom",["morning","afternoon"],1, 0,-1,0,0,1,0,1,1),
    A("drink_water","Drink Water","basic_needs",["survival","health","longevity"],["water"],"kitchen",["any"],1, 2,-1,0,0,3,0,0,2),
    A("use_bathroom","Use Bathroom","basic_needs",["survival","comfort"],[],"bathroom",["any"],5, 0,-1,0,0,0,1,0,1),
    A("wash_hands","Wash Hands","basic_needs",["health","hygiene"],["soap","water"],"bathroom",["any"],1, 0,0,0,0,1,4,0,2),
    A("brush_teeth","Brush Teeth","basic_needs",["health","hygiene","discipline"],["toothbrush","toothpaste"],"bathroom",["morning","evening"],3, -1,0,0,0,2,5,0,4),
    A("floss","Floss","basic_needs",["health","hygiene","discipline"],["floss"],"bathroom",["evening"],2, -1,0,0,0,2,3,0,5),
    A("use_mouthwash","Use Mouthwash","basic_needs",["hygiene","health"],["mouthwash"],"bathroom",["morning","evening"],1, 0,0,0,0,1,4,0,3),
    A("take_shower","Take Shower","basic_needs",["hygiene","comfort","restoration"],["soap","water"],"bathroom",["morning","evening"],10, 3,-5,0,0,1,10,-1,3),
    A("bathe","Bathe","basic_needs",["comfort","restoration","healing"],["soap","water"],"bathroom",["evening"],25, 5,-8,0,0,1,10,3,2),
    A("wash_hair","Wash Hair","basic_needs",["hygiene","self_respect"],["shampoo","water"],"bathroom",["morning","evening"],5, -1,-1,0,0,0,6,0,2),
    A("dry_off","Dry Off","basic_needs",["hygiene","comfort"],["towel"],"bathroom",["any"],2, 0,0,0,0,0,3,0,1),
    A("apply_deodorant","Apply Deodorant","basic_needs",["hygiene","self_respect","confidence"],["deodorant"],"bathroom",["morning"],1, 0,0,0,0,0,4,0,2),
    A("comb_hair","Comb Hair","basic_needs",["identity","self_respect"],["comb"],"bathroom",["morning"],2, 0,0,0,0,0,3,0,2),
    A("shave","Shave","basic_needs",["hygiene","identity","self_respect"],["razor"],"bathroom",["morning"],8, -2,-1,0,0,0,4,-1,3),
    A("do_skincare","Do Skincare","basic_needs",["health","self_respect","longevity"],["skincare_products"],"bathroom",["morning","evening"],5, -1,-2,0,0,2,4,0,4),
    A("change_clothes","Change Clothes","basic_needs",["hygiene","identity","self_respect"],["clean_clothes"],"bedroom",["morning"],3, 0,0,0,0,0,5,0,2),
    A("choose_outfit","Choose Outfit","basic_needs",["identity","self_expression","confidence"],["wardrobe"],"bedroom",["morning"],5, -1,1,0,0,0,3,1,2),
    A("put_on_shoes","Put On Shoes","basic_needs",["routine","preparedness"],["shoes"],"bedroom",["any"],1, 0,0,0,0,0,0,0,1),
    A("take_medication","Take Medication","basic_needs",["health","survival","longevity"],["prescription"],"kitchen",["morning","evening"],2, 0,-1,0,0,5,0,0,5),
    A("take_vitamins","Take Vitamins","basic_needs",["health","longevity"],["vitamins"],"kitchen",["morning"],1, 1,0,0,0,3,0,0,3),
    A("stretch_in_morning","Stretch in Morning","basic_needs",["health","restoration","balance"],[],"bedroom",["morning"],5, 3,-3,0,0,3,0,1,4),
    A("check_weather","Check Weather","basic_needs",["preparedness","control"],["phone"],"bedroom",["morning"],2, 0,0,0,0,0,0,0,2),
    A("pack_bag","Pack Bag","basic_needs",["preparedness","discipline","order"],["bag"],"bedroom",["morning"],5, -2,-1,0,0,0,0,0,4),
    A("set_alarm","Set Alarm","basic_needs",["routine","discipline","preparedness"],["phone"],"bedroom",["night"],1, 0,-1,0,0,0,0,0,4),
    A("go_to_sleep","Go to Sleep","basic_needs",["survival","restoration","health"],["bed"],"bedroom",["night"],1, 10,-5,0,0,5,0,0,3),
]

# ═══════════════════════════════════════
# FOOD & COOKING (32)
# ═══════════════════════════════════════
actions += [
    A("eat_breakfast","Eat Breakfast","food_cooking",["survival","health","routine"],["food"],"kitchen",["morning"],15, 8,-3,0,0,4,0,3,3),
    A("eat_lunch","Eat Lunch","food_cooking",["survival","health"],["food"],"kitchen",["afternoon"],20, 7,-3,0,0,3,0,4,2),
    A("eat_dinner","Eat Dinner","food_cooking",["survival","comfort","family"],["food"],"kitchen",["evening"],30, 6,-4,0,2,3,0,5,2),
    A("eat_snack","Eat Snack","food_cooking",["comfort","pleasure"],["snack"],"kitchen",["any"],5, 2,-1,-1,0,1,0,3,0),
    A("brew_coffee","Brew Coffee","food_cooking",["comfort","routine","restoration"],["coffee","water"],"kitchen",["morning"],5, 4,-2,-2,0,0,0,2,2),
    A("brew_tea","Brew Tea","food_cooking",["comfort","restoration","health"],["tea","water"],"kitchen",["any"],5, 3,-3,-1,0,1,0,2,2),
    A("fill_water_bottle","Fill Water Bottle","food_cooking",["health","preparedness"],["water_bottle"],"kitchen",["any"],1, 0,0,0,0,1,0,0,2),
    A("plan_meal","Plan Meal","food_cooking",["health","order","discipline"],["notepad"],"kitchen",["any"],10, -2,-2,0,0,1,0,0,5),
    A("make_grocery_list","Make Grocery List","food_cooking",["order","preparedness","discipline"],["notepad"],"kitchen",["any"],10, -1,-2,0,0,0,0,0,4),
    A("go_grocery_shopping","Go Grocery Shopping","food_cooking",["survival","preparedness"],["money","bags"],"store",["any"],45, -8,3,-30,1,0,0,-1,3),
    A("compare_prices","Compare Prices","food_cooking",["wealth","control"],["phone"],"store",["any"],5, -1,1,0,0,0,0,0,3),
    A("use_coupon","Use Coupon","food_cooking",["wealth","control"],["coupon"],"store",["any"],1, 0,0,3,0,0,0,1,2),
    A("wash_produce","Wash Produce","food_cooking",["health","discipline"],["water"],"kitchen",["any"],3, -1,0,0,0,2,0,0,3),
    A("chop_ingredients","Chop Ingredients","food_cooking",["mastery","discipline"],["knife","cutting_board"],"kitchen",["any"],10, -3,0,0,0,0,0,0,3),
    A("cook_breakfast","Cook Breakfast","food_cooking",["survival","mastery","independence"],["stove","ingredients"],"kitchen",["morning"],15, -5,-2,-3,0,1,0,2,4),
    A("cook_lunch","Cook Lunch","food_cooking",["survival","mastery"],["stove","ingredients"],"kitchen",["afternoon"],20, -6,-2,-4,0,1,0,2,4),
    A("cook_dinner","Cook Dinner","food_cooking",["survival","mastery","family"],["stove","ingredients"],"kitchen",["evening"],30, -8,-3,-6,2,2,0,3,5),
    A("meal_prep","Meal Prep","food_cooking",["discipline","preparedness","health"],["containers","ingredients"],"kitchen",["any"],60, -12,-4,-10,0,3,0,1,7),
    A("set_table","Set Table","food_cooking",["order","family","homebuilding"],["dishes"],"kitchen",["evening"],3, -1,0,0,1,0,0,0,3),
    A("wash_dishes_by_hand","Wash Dishes by Hand","food_cooking",["order","discipline","homebuilding"],["soap","water"],"kitchen",["any"],15, -4,-1,0,0,0,2,-1,4),
    A("load_dishwasher","Load Dishwasher","food_cooking",["order","discipline"],["dishwasher"],"kitchen",["any"],5, -2,0,0,0,0,1,0,3),
    A("unload_dishwasher","Unload Dishwasher","food_cooking",["order","discipline"],["dishwasher"],"kitchen",["any"],5, -2,-1,0,0,0,1,0,3),
    A("store_leftovers","Store Leftovers","food_cooking",["order","discipline","preparedness"],["containers"],"kitchen",["any"],5, -1,0,0,0,1,0,0,3),
    A("reheat_meal","Reheat Meal","food_cooking",["comfort","survival"],["microwave"],"kitchen",["any"],5, 3,-1,0,0,1,0,1,1),
    A("order_takeout","Order Takeout","food_cooking",["comfort","pleasure","fun"],["phone","money"],"home",["any"],5, 0,-3,-15,0,-1,0,4,0),
    A("pick_up_takeout","Pick Up Takeout","food_cooking",["survival"],["car"],"restaurant",["any"],15, -3,1,0,0,0,0,1,1),
    A("pack_lunch","Pack Lunch","food_cooking",["discipline","preparedness","health"],["food","container"],"kitchen",["morning"],10, -3,-1,-2,0,2,0,0,5),
    A("bake_something","Bake Something","food_cooking",["creativity","mastery","fun"],["oven","ingredients"],"kitchen",["any"],60, -7,-5,-5,0,0,0,6,4),
    A("grill_food","Grill Food","food_cooking",["mastery","fun","pleasure"],["grill","ingredients"],"yard",["afternoon","evening"],30, -5,-3,-8,2,1,0,5,3),
    A("wash_pan","Wash Pan","food_cooking",["order","discipline"],["soap","water"],"kitchen",["any"],5, -2,0,0,0,0,2,-1,3),
    A("wipe_kitchen_counter","Wipe Kitchen Counter","food_cooking",["order","hygiene","homebuilding"],["cloth"],"kitchen",["any"],3, -1,0,0,0,0,2,0,2),
    A("clean_stove_top","Clean Stove Top","food_cooking",["order","discipline","homebuilding"],["cleaner"],"kitchen",["any"],10, -3,-1,0,0,0,2,-1,3),
]

# ═══════════════════════════════════════
# HOME CARE (38)
# ═══════════════════════════════════════
actions += [
    A("lock_door","Lock Door","home_care",["security","routine"],["keys"],"home",["any"],1, 0,-1,0,0,0,0,0,2),
    A("unlock_door","Unlock Door","home_care",["security","routine"],["keys"],"home",["any"],1, 0,0,0,0,0,0,0,1),
    A("turn_on_lights","Turn On Lights","home_care",["comfort","routine"],[],"home",["evening","night"],1, 0,-1,0,0,0,0,0,1),
    A("turn_off_lights","Turn Off Lights","home_care",["discipline","routine"],[],"home",["night"],1, 0,0,0,0,0,0,0,2),
    A("adjust_thermostat","Adjust Thermostat","home_care",["comfort","control"],["thermostat"],"home",["any"],1, 1,-2,0,0,0,0,1,1),
    A("open_window_for_air","Open Window for Air","home_care",["comfort","health"],[],"home",["morning","afternoon"],1, 1,-1,0,0,1,0,1,1),
    A("close_window","Close Window","home_care",["security","comfort"],[],"home",["evening","night"],1, 0,0,0,0,0,0,0,1),
    A("start_laundry","Start Laundry","home_care",["order","discipline","hygiene"],["detergent","washer"],"home",["any"],10, -3,-1,0,0,0,2,0,4),
    A("move_laundry_to_dryer","Move Laundry to Dryer","home_care",["order","discipline"],["dryer"],"home",["any"],5, -2,0,0,0,0,1,0,3),
    A("hang_clothes_to_dry","Hang Clothes to Dry","home_care",["order","discipline"],["drying_rack"],"home",["any"],10, -3,0,0,0,0,1,0,3),
    A("fold_laundry","Fold Laundry","home_care",["order","discipline"],[],"home",["any"],15, -4,-1,0,0,0,1,0,4),
    A("put_clothes_away","Put Clothes Away","home_care",["order","discipline","homebuilding"],[],"bedroom",["any"],5, -2,-1,0,0,0,1,0,3),
    A("iron_clothes","Iron Clothes","home_care",["self_respect","discipline","order"],["iron"],"home",["any"],15, -4,-1,0,0,0,2,-1,4),
    A("sweep_floor","Sweep Floor","home_care",["order","homebuilding","discipline"],["broom"],"home",["any"],10, -3,-1,0,0,0,1,-1,4),
    A("vacuum_floor","Vacuum Floor","home_care",["order","homebuilding"],["vacuum"],"home",["any"],15, -5,-2,0,0,0,1,-1,4),
    A("mop_floor","Mop Floor","home_care",["order","homebuilding","hygiene"],["mop","bucket"],"home",["any"],15, -5,-2,0,0,0,2,-1,4),
    A("dust_surfaces","Dust Surfaces","home_care",["order","homebuilding","health"],["duster"],"home",["any"],10, -3,-1,0,0,1,1,0,3),
    A("clean_sink","Clean Sink","home_care",["hygiene","order"],["cleaner"],"bathroom",["any"],5, -2,-1,0,0,0,3,0,3),
    A("clean_bathroom","Clean Bathroom","home_care",["hygiene","order","homebuilding"],["cleaner","gloves"],"bathroom",["any"],20, -6,-2,0,0,0,3,-2,5),
    A("clean_toilet","Clean Toilet","home_care",["hygiene","discipline"],["cleaner","brush"],"bathroom",["any"],5, -3,-1,0,0,0,3,-2,4),
    A("scrub_tub","Scrub Tub","home_care",["hygiene","order"],["cleaner","brush"],"bathroom",["any"],15, -5,-2,0,0,0,3,-2,4),
    A("wipe_counter_home","Wipe Counter","home_care",["order","hygiene"],["cloth"],"kitchen",["any"],3, -1,0,0,0,0,2,0,2),
    A("clean_stove_home","Clean Stove","home_care",["order","discipline"],["cleaner"],"kitchen",["any"],10, -3,-1,0,0,0,2,-1,3),
    A("clean_oven","Clean Oven","home_care",["order","discipline","homebuilding"],["oven_cleaner"],"kitchen",["any"],30, -7,-3,0,0,0,2,-2,5),
    A("take_out_trash","Take Out Trash","home_care",["order","discipline","hygiene"],["trash_bag"],"home",["any"],5, -2,-1,0,0,0,2,-1,3),
    A("replace_trash_bag","Replace Trash Bag","home_care",["order","discipline"],["trash_bags"],"home",["any"],1, -1,0,0,0,0,1,0,2),
    A("take_out_recycling","Take Out Recycling","home_care",["order","discipline","service"],["recycling_bin"],"home",["any"],5, -2,-1,0,0,0,1,0,3),
    A("tidy_living_room","Tidy Living Room","home_care",["order","homebuilding","comfort"],[],"home",["any"],10, -3,-2,0,0,0,1,0,4),
    A("pick_up_clutter","Pick Up Clutter","home_care",["order","control"],[],"home",["any"],5, -2,-1,0,0,0,1,0,3),
    A("organize_closet","Organize Closet","home_care",["order","control","identity"],[],"bedroom",["any"],30, -6,-3,0,0,0,1,0,5),
    A("declutter_drawer","Declutter Drawer","home_care",["order","control"],[],"home",["any"],15, -3,-2,0,0,0,0,0,4),
    A("organize_pantry","Organize Pantry","home_care",["order","preparedness"],[],"kitchen",["any"],20, -4,-2,0,0,0,0,0,4),
    A("change_sheets","Change Sheets","home_care",["hygiene","comfort","homebuilding"],["clean_sheets"],"bedroom",["any"],10, -4,-1,0,0,0,4,0,4,False),
    A("wipe_mirror","Wipe Mirror","home_care",["order","hygiene"],["cloth"],"bathroom",["any"],3, -1,0,0,0,0,2,0,2),
    A("disinfect_surfaces","Disinfect Surfaces","home_care",["health","hygiene","security"],["disinfectant"],"home",["any"],10, -3,-1,0,0,2,3,0,4),
    A("water_plants","Water Plants","home_care",["homebuilding","restoration","meaning"],["water"],"home",["morning"],5, -1,-3,0,0,0,0,2,3),
    A("clean_window_home","Clean Window","home_care",["order","homebuilding"],["glass_cleaner"],"home",["any"],15, -4,-2,0,0,0,1,0,3),
    A("stock_supplies","Stock Supplies","home_care",["preparedness","order","security"],["money"],"home",["any"],20, -4,-2,-15,0,0,0,0,4),
]

# ═══════════════════════════════════════
# WORK & STUDY (41)
# ═══════════════════════════════════════
actions += [
    A("update_calendar","Update Calendar","work_study",["order","discipline","control"],["phone"],"office",["morning"],5, -1,-2,0,0,0,0,0,4),
    A("make_todo_list","Make Todo List","work_study",["productivity","order","control"],["notepad"],"office",["morning"],5, -1,-3,0,0,0,0,0,5),
    A("check_email","Check Email","work_study",["routine","career","productivity"],["computer"],"office",["morning","afternoon"],5, -1,2,0,0,0,0,0,2),
    A("reply_to_messages","Reply to Messages","work_study",["career","connection","productivity"],["computer"],"office",["any"],10, -2,1,0,2,0,0,0,3),
    A("attend_meeting","Attend Meeting","work_study",["career","belonging","reputation"],[],"office",["any"],30, -5,3,0,3,0,0,-1,3),
    A("greet_coworkers","Greet Coworkers","work_study",["belonging","friendship","reputation"],[],"office",["morning"],2, 0,-1,0,3,0,0,1,1),
    A("start_work_task","Start Work Task","work_study",["productivity","career","discipline"],["computer"],"office",["any"],30, -6,-1,0,0,0,0,0,5),
    A("focus_project","Focus on Project","work_study",["mastery","productivity","career"],["computer"],"office",["any"],60, -10,2,0,0,0,0,-1,7),
    A("study_read","Study / Read","work_study",["education","mastery","self_expression"],["book"],"home",["any"],30, -4,-2,0,0,0,0,1,5),
    A("take_notes","Take Notes","work_study",["education","discipline","mastery"],["notepad"],"office",["any"],10, -2,-1,0,0,0,0,0,4),
    A("submit_assignment","Submit Assignment","work_study",["education","discipline","career"],["computer"],"office",["any"],5, -1,-4,0,0,0,0,1,5),
    A("ask_questions","Ask Questions","work_study",["education","confidence","belonging"],[],"office",["any"],5, -1,2,0,2,0,0,0,3),
    A("type_report","Type Report","work_study",["productivity","career","discipline"],["computer"],"office",["any"],30, -6,2,0,0,0,0,-1,5),
    A("fill_out_form","Fill Out Form","work_study",["discipline","career","order"],["pen","form"],"office",["any"],10, -2,2,0,0,0,0,-1,3),
    A("research_topic","Research Topic","work_study",["education","mastery","creativity"],["computer"],"office",["any"],30, -5,0,0,0,0,0,1,4),
    A("practice_skill","Practice Skill","work_study",["mastery","discipline","confidence"],[],"home",["any"],30, -5,-2,0,0,0,0,2,6),
    A("read_work_email","Read Work Email","work_study",["career","routine"],["computer"],"office",["morning"],5, -1,2,0,0,0,0,0,2),
    A("send_invoice","Send Invoice","work_study",["career","wealth","productivity"],["computer"],"office",["any"],5, -1,-1,0,0,0,0,0,4),
    A("follow_up_with_client","Follow Up with Client","work_study",["career","reputation","connection"],["phone"],"office",["any"],10, -2,2,0,2,0,0,0,4),
    A("file_documents","File Documents","work_study",["order","discipline"],["filing_cabinet"],"office",["any"],10, -2,-1,0,0,0,0,-1,3),
    A("organize_desk","Organize Desk","work_study",["order","control","discipline"],[],"office",["any"],10, -3,-3,0,0,0,0,0,4),
    A("clean_workspace","Clean Workspace","work_study",["order","homebuilding","discipline"],["cloth"],"office",["any"],10, -3,-2,0,0,0,1,0,3),
    A("update_resume","Update Resume","work_study",["career","identity","confidence"],["computer"],"home",["any"],30, -4,2,0,0,0,0,0,5,False),
    A("apply_for_job","Apply for Job","work_study",["career","wealth","independence"],["computer"],"home",["any"],30, -5,5,0,0,0,0,0,5,False),
    A("attend_interview","Attend Interview","work_study",["career","confidence","reputation"],["resume"],"office",["any"],60, -8,8,0,2,0,0,0,6,False,["update_resume"]),
    A("complete_training","Complete Training","work_study",["education","career","mastery"],["computer"],"office",["any"],60, -8,-1,0,0,0,0,1,6),
    A("give_presentation","Give Presentation","work_study",["career","confidence","reputation"],["slides"],"office",["any"],30, -6,5,0,3,0,0,0,6),
    A("lead_meeting","Lead Meeting","work_study",["career","reputation","control"],[],"office",["any"],30, -6,4,0,3,0,0,0,5),
    A("review_budget","Review Budget","work_study",["wealth","control","discipline"],["spreadsheet"],"office",["any"],20, -3,2,0,0,0,0,0,4),
    A("write_proposal","Write Proposal","work_study",["career","creativity","productivity"],["computer"],"office",["any"],45, -8,3,0,0,0,0,0,6),
    A("plan_event","Plan Event","work_study",["community","creativity","order"],["notepad"],"office",["any"],30, -5,2,0,2,0,0,1,4),
    A("review_feedback","Review Feedback","work_study",["mastery","career","self_respect"],["computer"],"office",["any"],10, -2,3,0,0,0,0,0,4),
    A("set_weekly_goals","Set Weekly Goals","work_study",["discipline","control","productivity"],["notepad"],"home",["morning"],10, -2,-3,0,0,0,0,0,6),
    A("track_progress","Track Progress","work_study",["discipline","control","mastery"],["computer"],"office",["any"],5, -1,-1,0,0,0,0,1,4),
    A("clock_in","Clock In","work_study",["routine","discipline","career"],[],"office",["morning"],1, 0,1,0,0,0,0,0,3),
    A("clock_out","Clock Out","work_study",["routine","freedom"],[],"office",["afternoon","evening"],1, 1,-2,0,0,0,0,1,2),
    A("take_break","Take Break","work_study",["restoration","balance","comfort"],[],"office",["any"],15, 5,-4,0,1,0,0,3,0),
    A("eat_at_desk","Eat at Desk","work_study",["survival","productivity"],["food"],"office",["afternoon"],15, 4,1,0,-1,1,0,1,-1),
    A("scan_document","Scan Document","work_study",["order","discipline"],["scanner"],"office",["any"],5, -1,0,0,0,0,0,0,2),
    A("help_someone_work","Help Someone at Work","work_study",["service","belonging","reputation"],[],"office",["any"],15, -3,0,0,4,0,0,1,3),
    A("apologize_work","Apologize","work_study",["self_respect","connection","healing"],[],"office",["any"],5, -1,3,0,3,0,0,0,4),
]

# ═══════════════════════════════════════
# MONEY & ADMIN (30)
# ═══════════════════════════════════════
actions += [
    A("pay_bills","Pay Bills","money_admin",["stability","discipline","security"],["computer","money"],"home",["any"],10, -2,3,-50,0,0,0,-1,5),
    A("check_bank_balance","Check Bank Balance","money_admin",["control","security","wealth"],["phone"],"home",["any"],3, 0,2,0,0,0,0,0,3),
    A("budget_weekly","Budget Weekly","money_admin",["discipline","control","wealth"],["spreadsheet"],"home",["any"],20, -3,-1,0,0,0,0,0,6),
    A("transfer_money","Transfer Money","money_admin",["control","stability"],["phone"],"home",["any"],3, 0,1,0,0,0,0,0,2),
    A("save_deposit","Save Deposit","money_admin",["wealth","security","future"],["bank_account"],"home",["any"],5, 0,-2,-20,0,0,0,1,5),
    A("withdraw_cash","Withdraw Cash","money_admin",["freedom","control"],["bank_card"],"bank",["any"],10, -2,1,0,0,0,0,0,1),
    A("review_subscriptions","Review Subscriptions","money_admin",["control","wealth","discipline"],["computer"],"home",["any"],10, -1,1,0,0,0,0,0,4),
    A("cancel_subscription","Cancel Subscription","money_admin",["wealth","control","independence"],["computer"],"home",["any"],5, 0,-1,5,0,0,0,0,3),
    A("file_tax","File Tax","money_admin",["discipline","stability","wealth"],["computer","documents"],"home",["any"],120, -15,8,0,0,0,0,-3,8,False),
    A("pay_rent","Pay Rent","money_admin",["stability","security","homebuilding"],["money"],"home",["any"],5, 0,2,-500,0,0,0,-1,4,False),
    A("calculate_expenses","Calculate Expenses","money_admin",["control","discipline","wealth"],["calculator"],"home",["any"],15, -2,2,0,0,0,0,0,4),
    A("check_credit_score","Check Credit Score","money_admin",["control","security","future"],["computer"],"home",["any"],5, 0,3,0,0,0,0,0,3,False),
    A("set_savings_goal","Set Savings Goal","money_admin",["wealth","discipline","future"],["notepad"],"home",["any"],10, -1,-1,0,0,0,0,0,5,False),
    A("auto_pay_setup","Auto-Pay Setup","money_admin",["discipline","order","stability"],["computer"],"home",["any"],10, -1,-3,0,0,0,0,0,5,False),
    A("track_receipts","Track Receipts","money_admin",["order","discipline","control"],["receipts"],"home",["any"],10, -2,1,0,0,0,0,-1,4),
    A("return_item","Return Item","money_admin",["wealth","control"],["receipt","item"],"store",["any"],20, -4,3,10,1,0,0,0,3,False),
    A("dispute_charge","Dispute Charge","money_admin",["control","security","wealth"],["phone"],"home",["any"],15, -3,5,0,0,0,0,-1,4,False),
    A("compare_insurance","Compare Insurance","money_admin",["security","wealth","stability"],["computer"],"home",["any"],30, -4,3,0,0,0,0,-1,5,False),
    A("update_address","Update Address","money_admin",["order","stability"],["computer"],"home",["any"],15, -2,2,0,0,0,0,-1,3,False),
    A("renew_license","Renew License","money_admin",["stability","discipline","independence"],["documents"],"government_office",["any"],30, -4,4,-25,0,0,0,-2,4,False),
    A("renew_registration","Renew Registration","money_admin",["stability","discipline","mobility"],["documents"],"government_office",["any"],30, -4,4,-40,0,0,0,-2,4,False),
    A("schedule_payment","Schedule Payment","money_admin",["discipline","order","stability"],["computer"],"home",["any"],5, -1,-1,0,0,0,0,0,3),
    A("invest_savings","Invest Savings","money_admin",["wealth","future","independence"],["computer"],"home",["any"],15, -2,3,-50,0,0,0,0,5,False),
    A("review_portfolio","Review Portfolio","money_admin",["wealth","control","future"],["computer"],"home",["any"],15, -2,2,0,0,0,0,0,3),
    A("sell_unused_item","Sell Unused Item","money_admin",["wealth","order","independence"],["phone"],"home",["any"],15, -3,1,15,0,0,0,0,3,False),
    A("open_savings_account","Open Savings Account","money_admin",["wealth","security","future"],["documents"],"bank",["any"],30, -4,3,0,0,0,0,-1,5,False),
    A("donate_to_charity","Donate to Charity","money_admin",["service","meaning","community"],["money"],"home",["any"],5, 0,-3,-20,0,0,0,2,3),
    A("check_benefits","Check Benefits","money_admin",["security","stability","control"],["computer"],"home",["any"],10, -1,1,0,0,0,0,0,3),
    A("file_reimbursement","File Reimbursement","money_admin",["wealth","discipline"],["receipts","computer"],"office",["any"],10, -2,2,0,0,0,0,-1,4),
    A("apply_for_loan","Apply for Loan","money_admin",["wealth","stability","future"],["documents","computer"],"home",["any"],45, -5,6,0,0,0,0,-2,5,False),
]

# ═══════════════════════════════════════
# HEALTH & FITNESS (32)
# ═══════════════════════════════════════
actions += [
    A("go_for_walk","Go for Walk","health_fitness",["health","restoration","balance"],["shoes"],"outdoors",["any"],30, -4,-6,0,1,5,0,3,3),
    A("go_to_gym","Go to Gym","health_fitness",["fitness","strength","discipline"],["gym_bag"],"gym",["any"],60, -12,-5,-2,1,6,0,2,6),
    A("lift_weights","Lift Weights","health_fitness",["strength","fitness","confidence"],["weights"],"gym",["any"],45, -15,-4,0,0,7,-1,1,6),
    A("do_yoga","Do Yoga","health_fitness",["balance","restoration","mental_stability"],["mat"],"home",["morning","evening"],30, -3,-7,0,0,5,0,3,5),
    A("do_pushups","Do Pushups","health_fitness",["strength","fitness","discipline"],[],"home",["any"],5, -5,-2,0,0,3,-1,0,4),
    A("do_situps","Do Situps","health_fitness",["strength","fitness","discipline"],[],"home",["any"],5, -5,-2,0,0,3,-1,0,4),
    A("run_outdoors","Run Outdoors","health_fitness",["fitness","health","freedom"],["shoes"],"outdoors",["morning","afternoon"],30, -15,-6,0,0,7,-2,2,6),
    A("swim_laps","Swim Laps","health_fitness",["fitness","health","restoration"],["swimsuit"],"pool",["any"],45, -12,-6,-3,0,7,2,3,5),
    A("ride_bike","Ride Bike","health_fitness",["fitness","freedom","mobility"],["bike","helmet"],"outdoors",["any"],30, -10,-5,0,0,6,0,4,4),
    A("follow_workout_video","Follow Workout Video","health_fitness",["fitness","discipline","mastery"],["phone"],"home",["any"],30, -10,-4,0,0,5,-1,2,5),
    A("stretch_after_workout","Stretch After Workout","health_fitness",["health","restoration","balance"],[],"gym",["any"],10, 2,-3,0,0,3,0,1,3),
    A("cool_down","Cool Down","health_fitness",["restoration","health"],[],"gym",["any"],10, 3,-3,0,0,2,0,1,2),
    A("drink_protein_shake","Drink Protein Shake","health_fitness",["fitness","health","strength"],["protein_powder"],"home",["any"],3, 3,-1,-2,0,3,0,0,3),
    A("track_calories","Track Calories","health_fitness",["health","discipline","control"],["phone"],"home",["any"],5, -1,1,0,0,1,0,0,4),
    A("weigh_self","Weigh Self","health_fitness",["health","control","discipline"],["scale"],"bathroom",["morning"],2, 0,2,0,0,0,0,0,3,False),
    A("log_workout","Log Workout","health_fitness",["discipline","mastery","control"],["phone"],"gym",["any"],3, -1,0,0,0,0,0,0,4),
    A("schedule_doctor","Schedule Doctor","health_fitness",["health","preparedness","security"],["phone"],"home",["any"],5, -1,2,0,0,0,0,0,3,False),
    A("see_doctor","See Doctor","health_fitness",["health","security","longevity"],[],"clinic",["any"],60, -5,4,-30,0,5,0,-2,4,False),
    A("pick_up_prescription","Pick Up Prescription","health_fitness",["health","survival"],["money"],"pharmacy",["any"],15, -3,1,-10,0,3,0,0,3),
    A("take_supplements","Take Supplements","health_fitness",["health","longevity"],["supplements"],"home",["morning"],1, 1,0,-1,0,2,0,0,3),
    A("rest_day","Rest Day","health_fitness",["restoration","balance","healing"],[],"home",["any"],60, 8,-5,0,0,3,0,4,1,False),
    A("foam_roll","Foam Roll","health_fitness",["health","restoration","healing"],["foam_roller"],"home",["any"],10, 2,-3,0,0,3,0,0,3),
    A("ice_injury","Ice Injury","health_fitness",["healing","health"],["ice_pack"],"home",["any"],15, 1,-2,0,0,3,0,-1,2),
    A("apply_sunscreen","Apply Sunscreen","health_fitness",["health","longevity","self_respect"],["sunscreen"],"home",["morning"],2, 0,0,0,0,2,1,0,2),
    A("meditate","Meditate","health_fitness",["mental_stability","balance","restoration"],[],"home",["morning","evening"],15, 3,-8,0,0,2,0,2,5),
    A("journal","Journal","health_fitness",["mental_stability","self_expression","meaning"],["journal","pen"],"home",["morning","evening"],15, -2,-5,0,0,1,0,2,5),
    A("deep_breathing","Deep Breathing","health_fitness",["mental_stability","restoration","healing"],[],"home",["any"],5, 2,-4,0,0,1,0,1,3),
    A("cold_shower","Cold Shower","health_fitness",["discipline","resilience","health"],["water"],"bathroom",["morning"],5, 4,2,0,0,3,6,-1,7),
    A("track_sleep","Track Sleep","health_fitness",["health","discipline","control"],["phone"],"bedroom",["morning"],2, 0,0,0,0,0,0,0,3),
    A("check_blood_pressure","Check Blood Pressure","health_fitness",["health","control","longevity"],["bp_monitor"],"home",["morning"],3, 0,1,0,0,1,0,0,3),
    A("therapy_session","Therapy Session","health_fitness",["mental_stability","healing","self_respect"],[],"clinic",["any"],60, -3,-8,-40,1,4,0,0,5,False),
    A("take_mental_health_day","Take Mental Health Day","health_fitness",["mental_stability","restoration","balance"],[],"home",["any"],480, 10,-10,0,0,5,0,6,0,False),
]

# ═══════════════════════════════════════
# SOCIAL & RELATIONSHIPS (31)
# ═══════════════════════════════════════
actions += [
    A("call_friend","Call Friend","social_relationships",["friendship","connection","belonging"],["phone"],"home",["any"],20, -2,-4,0,6,0,0,4,1),
    A("text_family","Text Family","social_relationships",["family","connection","love"],["phone"],"home",["any"],5, 0,-1,0,4,0,0,1,1),
    A("reply_personal_messages","Reply to Personal Messages","social_relationships",["connection","friendship"],["phone"],"home",["any"],10, -1,0,0,3,0,0,1,2),
    A("go_out_to_dinner","Go Out to Dinner","social_relationships",["friendship","pleasure","belonging"],["money"],"restaurant",["evening"],90, -3,-5,-25,7,1,0,6,1),
    A("date_night","Date Night","social_relationships",["romance","love","intimacy"],["money"],"restaurant",["evening"],120, -5,-7,-40,8,0,0,8,2),
    A("go_on_walk_with_partner","Go on Walk with Partner","social_relationships",["romance","connection","health"],[],"outdoors",["any"],30, -3,-5,0,6,3,0,4,2),
    A("play_games_with_friend","Play Games with Friend","social_relationships",["friendship","fun","belonging"],["game"],"home",["evening"],60, -3,-4,0,7,0,0,8,1),
    A("host_gathering","Host Gathering","social_relationships",["community","belonging","friendship"],["food","drinks"],"home",["evening"],120, -8,-2,-30,10,0,-1,7,3),
    A("attend_party","Attend Party","social_relationships",["fun","belonging","friendship"],[],"other_home",["evening"],120, -6,-4,0,8,0,0,8,0),
    A("visit_family","Visit Family","social_relationships",["family","love","belonging"],[],"family_home",["any"],120, -5,-4,0,8,0,0,5,2),
    A("babysit","Babysit","social_relationships",["service","family","support"],[],"home",["any"],120, -10,4,0,4,0,0,2,4),
    A("help_friend_move","Help Friend Move","social_relationships",["friendship","service","support"],[],"other_home",["any"],240, -20,3,0,8,-1,0,1,5),
    A("write_thank_you_note","Write Thank You Note","social_relationships",["connection","self_respect","reputation"],["paper","pen"],"home",["any"],10, -1,-2,0,3,0,0,1,4),
    A("send_birthday_card","Send Birthday Card","social_relationships",["friendship","connection","celebration"],["card"],"home",["any"],5, -1,-1,-3,4,0,0,2,3),
    A("buy_gift","Buy Gift","social_relationships",["love","friendship","connection"],["money"],"store",["any"],30, -4,2,-25,4,0,0,2,2),
    A("bring_food_to_neighbor","Bring Food to Neighbor","social_relationships",["service","community","connection"],["food"],"neighborhood",["any"],10, -2,-2,-5,5,0,0,2,3),
    A("catch_up_with_old_friend","Catch Up with Old Friend","social_relationships",["friendship","connection","belonging"],["phone"],"home",["any"],30, -2,-4,0,7,0,0,5,1),
    A("meet_new_person","Meet New Person","social_relationships",["belonging","confidence","connection"],[],"public",["any"],15, -2,3,0,4,0,0,2,2),
    A("join_club","Join Club","social_relationships",["belonging","community","identity"],[],"community_center",["any"],60, -4,-2,-10,6,0,0,4,3,False),
    A("volunteer","Volunteer","social_relationships",["service","meaning","community"],[],"community_center",["any"],120, -8,-4,0,7,1,0,4,5),
    A("attend_community_event","Attend Community Event","social_relationships",["community","belonging","fun"],[],"public",["any"],90, -5,-3,0,6,0,0,5,2),
    A("plan_group_outing","Plan Group Outing","social_relationships",["friendship","community","fun"],["phone"],"home",["any"],15, -2,1,0,3,0,0,2,3),
    A("have_deep_conversation","Have Deep Conversation","social_relationships",["connection","intimacy","meaning"],[],"home",["evening"],45, -3,-5,0,8,0,0,3,2),
    A("express_gratitude","Express Gratitude","social_relationships",["connection","self_respect","meaning"],[],"home",["any"],2, 0,-3,0,4,0,0,2,2),
    A("compliment_someone","Compliment Someone","social_relationships",["connection","friendship","belonging"],[],"any_location",["any"],1, 0,-1,0,3,0,0,2,1),
    A("check_in_on_friend","Check In on Friend","social_relationships",["friendship","support","connection"],["phone"],"home",["any"],10, -1,-2,0,5,0,0,1,2),
    A("set_boundaries","Set Boundaries","social_relationships",["self_respect","control","independence"],[],"home",["any"],10, -2,4,0,-1,0,0,0,6),
    A("reconcile_conflict","Reconcile Conflict","social_relationships",["healing","connection","self_respect"],[],"home",["any"],30, -4,5,0,5,0,0,0,5),
    A("share_meal_with_someone","Share Meal with Someone","social_relationships",["connection","belonging","pleasure"],["food"],"home",["any"],45, -2,-3,-5,6,1,0,4,1),
    A("introduce_two_friends","Introduce Two Friends","social_relationships",["friendship","community","connection"],[],"public",["any"],5, -1,1,0,5,0,0,2,1),
    A("attend_wedding","Attend Wedding","social_relationships",["celebration","love","community"],["formal_attire"],"venue",["any"],300, -10,-2,-50,8,0,0,7,3,False),
]

# ═══════════════════════════════════════
# LEISURE & GROWTH (30)
# ═══════════════════════════════════════
actions += [
    A("play_video_games","Play Video Games","leisure_growth",["fun","restoration","pleasure"],["console"],"home",["any"],60, -2,-5,0,0,0,0,9,-1),
    A("read_book","Read Book","leisure_growth",["education","restoration","meaning"],["book"],"home",["any"],30, -2,-4,0,0,0,0,5,3),
    A("watch_tv","Watch TV","leisure_growth",["fun","restoration","comfort"],["tv"],"home",["evening"],60, 2,-3,0,0,0,0,6,-1),
    A("listen_to_music","Listen to Music","leisure_growth",["pleasure","restoration","self_expression"],["speakers"],"home",["any"],20, 2,-4,0,0,0,0,5,0),
    A("listen_to_podcast","Listen to Podcast","leisure_growth",["education","fun","meaning"],["phone"],"home",["any"],30, 1,-3,0,0,0,0,4,2),
    A("draw_or_sketch","Draw or Sketch","leisure_growth",["creativity","self_expression","identity"],["sketchbook","pencils"],"home",["any"],30, -3,-4,0,0,0,0,5,4),
    A("paint","Paint","leisure_growth",["creativity","self_expression","meaning"],["canvas","paints"],"home",["any"],60, -5,-5,-5,0,0,0,7,4),
    A("write_creatively","Write Creatively","leisure_growth",["creativity","self_expression","meaning"],["computer"],"home",["any"],45, -4,-4,0,0,0,0,6,5),
    A("play_instrument","Play Instrument","leisure_growth",["mastery","creativity","self_expression"],["instrument"],"home",["any"],30, -3,-5,0,0,0,0,7,5),
    A("sing","Sing","leisure_growth",["self_expression","fun","pleasure"],[],"home",["any"],15, -1,-4,0,0,0,0,6,1),
    A("dance","Dance","leisure_growth",["fun","fitness","self_expression"],[],"home",["any"],20, -5,-5,0,1,2,0,8,2),
    A("take_photos","Take Photos","leisure_growth",["creativity","identity","meaning"],["camera"],"outdoors",["any"],30, -2,-3,0,0,0,0,5,2),
    A("garden","Garden","leisure_growth",["homebuilding","restoration","meaning"],["tools"],"yard",["morning","afternoon"],45, -7,-6,0,0,3,0,5,4),
    A("do_puzzle","Do Puzzle","leisure_growth",["fun","mastery","restoration"],["puzzle"],"home",["any"],30, -2,-3,0,0,0,0,5,3),
    A("play_board_game","Play Board Game","leisure_growth",["fun","friendship","belonging"],["board_game"],"home",["evening"],45, -2,-3,0,5,0,0,7,1),
    A("cook_new_recipe","Cook New Recipe","leisure_growth",["creativity","mastery","fun"],["ingredients"],"kitchen",["any"],45, -6,-3,-8,0,1,0,6,4),
    A("learn_language","Learn Language","leisure_growth",["education","mastery","identity"],["app"],"home",["any"],30, -4,-2,0,0,0,0,3,6),
    A("take_online_course","Take Online Course","leisure_growth",["education","mastery","career"],["computer"],"home",["any"],60, -6,-1,0,0,0,0,2,6),
    A("watch_documentary","Watch Documentary","leisure_growth",["education","meaning","fun"],["tv"],"home",["evening"],90, 1,-3,0,0,0,0,5,2),
    A("visit_museum","Visit Museum","leisure_growth",["education","creativity","meaning"],["money"],"museum",["any"],120, -5,-4,-15,2,0,0,6,3,False),
    A("browse_bookstore","Browse Bookstore","leisure_growth",["education","pleasure","restoration"],["money"],"store",["any"],30, -2,-4,-10,0,0,0,5,1),
    A("write_in_journal","Write in Journal","leisure_growth",["self_expression","meaning","mental_stability"],["journal"],"home",["evening"],15, -2,-5,0,0,0,0,3,4),
    A("practice_calligraphy","Practice Calligraphy","leisure_growth",["mastery","creativity","discipline"],["pen","ink"],"home",["any"],20, -2,-4,0,0,0,0,4,5),
    A("knit_or_crochet","Knit or Crochet","leisure_growth",["creativity","restoration","mastery"],["yarn","needles"],"home",["any"],45, -2,-4,0,0,0,0,5,4),
    A("build_model","Build Model","leisure_growth",["mastery","creativity","fun"],["model_kit"],"home",["any"],60, -4,-4,-10,0,0,0,6,5),
    A("do_crossword","Do Crossword","leisure_growth",["mastery","fun","restoration"],["newspaper"],"home",["any"],20, -1,-3,0,0,0,0,5,3),
    A("star_gaze","Star Gaze","leisure_growth",["meaning","restoration","pleasure"],[],"outdoors",["night"],30, 1,-5,0,0,0,0,6,1),
    A("bird_watch","Bird Watch","leisure_growth",["restoration","meaning","fun"],["binoculars"],"outdoors",["morning"],45, -2,-5,0,0,1,0,5,2),
    A("go_fishing","Go Fishing","leisure_growth",["restoration","fun","pleasure"],["fishing_rod"],"outdoors",["morning","afternoon"],120, -4,-6,0,1,1,0,7,2),
    A("try_new_hobby","Try New Hobby","leisure_growth",["creativity","confidence","fun"],[],"home",["any"],60, -5,-3,-10,0,0,0,6,4,False),
]

# ═══════════════════════════════════════
# ERRANDS & MOBILITY (30)
# ═══════════════════════════════════════
actions += [
    A("drive_to_work","Drive to Work","errands_mobility",["career","routine","mobility"],["car","keys"],"car",["morning"],25, -3,3,0,0,0,0,-1,3),
    A("take_bus","Take Bus","errands_mobility",["mobility","routine"],["bus_pass"],"bus",["morning","afternoon"],35, -2,2,-2,1,0,0,0,2),
    A("walk_to_store","Walk to Store","errands_mobility",["mobility","health"],["bag"],"outdoors",["any"],15, -3,-2,0,0,2,0,1,2),
    A("ride_bike_to_errand","Ride Bike to Errand","errands_mobility",["mobility","fitness","freedom"],["bike"],"outdoors",["any"],20, -6,-3,0,0,3,0,2,3),
    A("call_taxi","Call Taxi","errands_mobility",["mobility","comfort"],["phone"],"home",["any"],5, 0,1,-15,0,0,0,0,1),
    A("drop_off_package","Drop Off Package","errands_mobility",["order","discipline"],["package"],"post_office",["any"],15, -3,1,-5,0,0,0,0,3),
    A("pick_up_package","Pick Up Package","errands_mobility",["order","pleasure"],[],"post_office",["any"],15, -3,0,0,0,0,0,1,2),
    A("go_to_post_office","Go to Post Office","errands_mobility",["order","discipline"],["mail"],"post_office",["any"],20, -4,2,0,0,0,0,-1,3),
    A("go_to_bank","Go to Bank","errands_mobility",["wealth","stability"],["documents"],"bank",["any"],20, -4,2,0,1,0,0,-1,3),
    A("go_to_pharmacy","Go to Pharmacy","errands_mobility",["health","survival"],["prescription"],"pharmacy",["any"],15, -3,1,-10,0,1,0,0,2),
    A("go_to_hardware_store","Go to Hardware Store","errands_mobility",["homebuilding","preparedness"],["money"],"store",["any"],30, -5,1,-20,0,0,0,1,2),
    A("go_to_dry_cleaners","Go to Dry Cleaners","errands_mobility",["self_respect","order"],["clothes","money"],"dry_cleaners",["any"],10, -2,1,-15,0,0,2,0,2),
    A("get_haircut","Get Haircut","errands_mobility",["identity","self_respect","confidence"],["money"],"salon",["any"],30, -2,-3,-20,1,0,3,2,2,False),
    A("get_car_washed","Get Car Washed","errands_mobility",["order","self_respect"],["money","car"],"car_wash",["any"],15, -1,0,-10,0,0,0,1,2),
    A("get_oil_changed","Get Oil Changed","errands_mobility",["preparedness","stability","mobility"],["money","car"],"mechanic",["any"],30, -3,2,-40,0,0,0,-1,4,False),
    A("get_tires_checked","Get Tires Checked","errands_mobility",["security","preparedness","mobility"],["car"],"mechanic",["any"],20, -2,1,-10,0,0,0,0,3),
    A("renew_parking_pass","Renew Parking Pass","errands_mobility",["order","stability"],["money"],"office",["any"],10, -1,2,-30,0,0,0,-1,3,False),
    A("return_library_books","Return Library Books","errands_mobility",["order","discipline"],["books"],"library",["any"],10, -2,-1,0,0,0,0,0,3),
    A("drop_off_donation","Drop Off Donation","errands_mobility",["service","meaning","community"],["donation_items"],"donation_center",["any"],15, -3,-2,0,2,0,0,2,3),
    A("pick_up_prescription_errand","Pick Up Prescription","errands_mobility",["health","survival"],["money"],"pharmacy",["any"],15, -3,1,-10,0,2,0,0,3),
    A("gas_up_car","Gas Up Car","errands_mobility",["mobility","preparedness"],["money","car"],"gas_station",["any"],10, -2,0,-30,0,0,0,0,2),
    A("check_tire_pressure","Check Tire Pressure","errands_mobility",["security","preparedness"],["tire_gauge"],"home",["any"],5, -1,0,0,0,0,0,0,3),
    A("fill_windshield_fluid","Fill Windshield Fluid","errands_mobility",["preparedness","order"],["fluid"],"home",["any"],3, -1,0,-3,0,0,0,0,2),
    A("run_quick_errand","Run Quick Errand","errands_mobility",["productivity","order"],[],"various",["any"],20, -4,1,0,0,0,0,0,2),
    A("schedule_appointment","Schedule Appointment","errands_mobility",["preparedness","discipline"],["phone"],"home",["any"],5, -1,1,0,0,0,0,0,3),
    A("wait_in_line","Wait in Line","errands_mobility",["discipline","routine"],[],"various",["any"],15, -2,5,0,0,0,0,-2,2),
    A("park_car","Park Car","errands_mobility",["mobility","routine"],["car"],"parking_lot",["any"],5, -1,1,0,0,0,0,0,1),
    A("get_keys_copied","Get Keys Copied","errands_mobility",["security","preparedness"],["money","keys"],"store",["any"],10, -1,0,-5,0,0,0,0,2,False),
    A("drop_off_kid","Drop Off Kid","errands_mobility",["family","routine","support"],["car"],"school",["morning"],15, -3,2,0,2,0,0,0,3),
    A("pick_up_kid","Pick Up Kid","errands_mobility",["family","routine","support"],["car"],"school",["afternoon"],15, -3,1,0,3,0,0,1,3),
]

# ═══════════════════════════════════════
# CAREGIVING & PARENTING (30)
# ═══════════════════════════════════════
actions += [
    A("feed_baby","Feed Baby","caregiving_parenting",["family","love","survival"],["bottle","formula"],"home",["any"],20, -5,3,0,3,0,0,1,4),
    A("change_diaper","Change Diaper","caregiving_parenting",["family","love","hygiene"],["diapers","wipes"],"home",["any"],10, -3,2,-2,1,0,1,-1,3),
    A("bathe_child","Bathe Child","caregiving_parenting",["family","love","hygiene"],["soap","water"],"bathroom",["evening"],20, -4,1,0,3,0,3,1,4),
    A("read_to_child","Read to Child","caregiving_parenting",["family","love","education"],["book"],"home",["evening"],15, -2,-4,0,5,0,0,4,3),
    A("help_with_homework","Help with Homework","caregiving_parenting",["family","education","support"],["textbook"],"home",["afternoon","evening"],30, -5,3,0,4,0,0,0,5),
    A("pack_school_lunch","Pack School Lunch","caregiving_parenting",["family","discipline","preparedness"],["food","container"],"kitchen",["morning"],10, -3,0,-3,1,0,0,0,4),
    A("drive_to_school","Drive to School","caregiving_parenting",["family","routine"],["car"],"car",["morning"],15, -3,2,0,2,0,0,0,3),
    A("pick_up_from_school","Pick Up from School","caregiving_parenting",["family","routine","love"],["car"],"car",["afternoon"],15, -3,1,0,3,0,0,1,3),
    A("take_child_to_doctor","Take Child to Doctor","caregiving_parenting",["family","health","support"],["insurance_card"],"clinic",["any"],60, -6,5,-30,2,0,0,-2,4,False),
    A("take_child_to_dentist","Take Child to Dentist","caregiving_parenting",["family","health"],["insurance_card"],"clinic",["any"],60, -5,4,-25,2,0,0,-2,4,False),
    A("attend_school_event","Attend School Event","caregiving_parenting",["family","belonging","support"],[],"school",["evening"],90, -5,-1,0,5,0,0,3,3,False),
    A("plan_birthday_party","Plan Birthday Party","caregiving_parenting",["family","celebration","love"],["notepad"],"home",["any"],30, -4,3,-20,3,0,0,3,4,False),
    A("play_with_child","Play with Child","caregiving_parenting",["family","love","fun"],["toys"],"home",["any"],30, -4,-5,0,6,1,0,8,1),
    A("comfort_crying_child","Comfort Crying Child","caregiving_parenting",["family","love","support"],[],"home",["any"],10, -3,4,0,4,0,0,0,3),
    A("put_child_to_bed","Put Child to Bed","caregiving_parenting",["family","love","routine"],[],"bedroom",["evening"],15, -3,1,0,3,0,0,1,4),
    A("wake_child_up","Wake Child Up","caregiving_parenting",["family","routine","discipline"],[],"bedroom",["morning"],5, -1,2,0,2,0,0,0,3),
    A("brush_child_teeth","Brush Child's Teeth","caregiving_parenting",["family","health","hygiene"],["toothbrush"],"bathroom",["morning","evening"],3, -1,1,0,2,1,2,0,3),
    A("dress_child","Dress Child","caregiving_parenting",["family","routine"],["clothes"],"bedroom",["morning"],5, -2,1,0,2,0,1,0,3),
    A("monitor_screen_time","Monitor Screen Time","caregiving_parenting",["discipline","family","control"],[],"home",["any"],5, -1,2,0,-1,0,0,-1,4),
    A("check_on_sleeping_child","Check on Sleeping Child","caregiving_parenting",["family","love","security"],[],"bedroom",["night"],2, -1,0,0,2,0,0,0,2),
    A("feed_pet","Feed Pet","caregiving_parenting",["love","routine","support"],["pet_food"],"home",["morning","evening"],5, -1,-1,-1,1,0,0,1,3),
    A("walk_dog","Walk Dog","caregiving_parenting",["love","health","routine"],["leash"],"outdoors",["morning","evening"],20, -4,-4,0,2,3,0,3,3),
    A("clean_litter_box","Clean Litter Box","caregiving_parenting",["discipline","hygiene","order"],["litter"],"home",["any"],5, -2,1,0,0,0,2,-1,3),
    A("groom_pet","Groom Pet","caregiving_parenting",["love","hygiene"],["brush"],"home",["any"],15, -3,-1,0,2,0,1,1,3),
    A("take_pet_to_vet","Take Pet to Vet","caregiving_parenting",["love","health","support"],["carrier","money"],"vet",["any"],60, -5,4,-50,1,0,0,-1,4,False),
    A("play_with_pet","Play with Pet","caregiving_parenting",["love","fun","restoration"],["toy"],"home",["any"],15, -2,-4,0,3,1,0,6,1),
    A("supervise_playtime","Supervise Playtime","caregiving_parenting",["family","security","support"],[],"home",["any"],30, -3,2,0,3,0,0,1,3),
    A("apply_bandage","Apply Bandage","caregiving_parenting",["support","healing","love"],["bandage"],"home",["any"],3, -1,1,0,2,1,0,0,2),
    A("give_medicine_to_child","Give Medicine to Child","caregiving_parenting",["family","health","support"],["medicine"],"home",["any"],5, -1,2,0,1,2,0,-1,3),
    A("call_pediatrician","Call Pediatrician","caregiving_parenting",["family","health","support"],["phone"],"home",["any"],10, -1,3,0,0,1,0,0,3),
]

# ═══════════════════════════════════════
# MAINTENANCE & REPAIR (30)
# ═══════════════════════════════════════
actions += [
    A("change_light_bulb","Change Light Bulb","maintenance_repair",["homebuilding","order"],["light_bulb"],"home",["any"],5, -1,0,-3,0,0,0,0,3),
    A("replace_batteries","Replace Batteries","maintenance_repair",["order","preparedness"],["batteries"],"home",["any"],3, -1,0,-2,0,0,0,0,2),
    A("tighten_loose_screw","Tighten Loose Screw","maintenance_repair",["homebuilding","order","mastery"],["screwdriver"],"home",["any"],5, -1,-1,0,0,0,0,0,3),
    A("fix_leaky_faucet","Fix Leaky Faucet","maintenance_repair",["homebuilding","mastery","independence"],["wrench"],"home",["any"],30, -6,-1,0,0,0,0,1,5),
    A("unclog_drain","Unclog Drain","maintenance_repair",["homebuilding","discipline"],["plunger"],"bathroom",["any"],15, -5,2,0,0,0,1,-1,4),
    A("patch_small_hole","Patch Small Hole","maintenance_repair",["homebuilding","mastery"],["spackle","putty_knife"],"home",["any"],20, -4,-1,-3,0,0,0,0,4),
    A("touch_up_paint","Touch Up Paint","maintenance_repair",["homebuilding","self_expression"],["paint","brush"],"home",["any"],30, -5,-2,-5,0,0,0,1,4),
    A("replace_air_filter","Replace Air Filter","maintenance_repair",["health","homebuilding","preparedness"],["air_filter"],"home",["any"],10, -2,0,-8,0,1,0,0,3,False),
    A("clean_gutters","Clean Gutters","maintenance_repair",["homebuilding","security","preparedness"],["ladder","gloves"],"outdoors",["any"],45, -10,2,-0,0,0,0,-2,5,False),
    A("mow_lawn","Mow Lawn","maintenance_repair",["homebuilding","order","reputation"],["mower"],"yard",["morning","afternoon"],45, -12,-2,0,0,2,-1,1,5),
    A("trim_hedge","Trim Hedge","maintenance_repair",["homebuilding","order"],["hedge_trimmer"],"yard",["any"],30, -8,-1,0,0,1,0,0,4),
    A("rake_leaves","Rake Leaves","maintenance_repair",["homebuilding","order","discipline"],["rake"],"yard",["any"],30, -8,-1,0,0,1,0,0,4),
    A("shovel_snow","Shovel Snow","maintenance_repair",["security","homebuilding","discipline"],["shovel"],"outdoors",["morning"],30, -15,2,0,0,2,-1,-1,5),
    A("salt_walkway","Salt Walkway","maintenance_repair",["security","preparedness"],["salt"],"outdoors",["morning"],5, -2,0,-3,0,0,0,0,3),
    A("seal_window","Seal Window","maintenance_repair",["homebuilding","security","comfort"],["caulk"],"home",["any"],20, -4,-1,-5,0,0,0,0,4,False),
    A("caulk_tub","Caulk Tub","maintenance_repair",["homebuilding","hygiene","mastery"],["caulk"],"bathroom",["any"],20, -4,-1,-5,0,0,1,0,4,False),
    A("fix_running_toilet","Fix Running Toilet","maintenance_repair",["homebuilding","mastery","independence"],["repair_kit"],"bathroom",["any"],30, -6,2,-10,0,0,0,0,5),
    A("replace_doorknob","Replace Doorknob","maintenance_repair",["homebuilding","security","mastery"],["doorknob","screwdriver"],"home",["any"],20, -4,-1,-15,0,0,0,0,4,False),
    A("hang_shelf","Hang Shelf","maintenance_repair",["homebuilding","mastery","order"],["drill","brackets"],"home",["any"],30, -6,-2,-15,0,0,0,1,5),
    A("assemble_furniture","Assemble Furniture","maintenance_repair",["homebuilding","mastery","independence"],["tools"],"home",["any"],90, -12,3,-0,0,0,0,2,5,False),
    A("move_furniture","Move Furniture","maintenance_repair",["homebuilding","order","strength"],[],"home",["any"],20, -8,2,0,0,-1,0,0,3),
    A("organize_garage","Organize Garage","maintenance_repair",["order","homebuilding","control"],[],"garage",["any"],60, -10,-2,0,0,0,0,0,5),
    A("clean_garage","Clean Garage","maintenance_repair",["order","homebuilding"],["broom"],"garage",["any"],45, -8,-1,0,0,0,1,-1,4),
    A("wash_car","Wash Car","maintenance_repair",["order","self_respect","homebuilding"],["soap","water","hose"],"driveway",["any"],30, -6,-2,-2,0,0,0,1,4),
    A("wax_car","Wax Car","maintenance_repair",["self_respect","mastery","order"],["car_wax"],"driveway",["any"],45, -8,-2,-5,0,0,0,1,4),
    A("check_smoke_detector","Check Smoke Detector","maintenance_repair",["security","preparedness"],[],"home",["any"],2, -1,0,0,0,0,0,0,3),
    A("replace_smoke_detector_battery","Replace Smoke Detector Battery","maintenance_repair",["security","preparedness"],["battery"],"home",["any"],5, -1,0,-3,0,0,0,0,3,False),
    A("test_carbon_monoxide_detector","Test Carbon Monoxide Detector","maintenance_repair",["security","preparedness","health"],[],"home",["any"],2, -1,0,0,0,0,0,0,3),
    A("winterize_pipes","Winterize Pipes","maintenance_repair",["homebuilding","security","preparedness"],["insulation"],"home",["any"],30, -5,-1,-10,0,0,0,0,5,False),
    A("service_hvac","Service HVAC","maintenance_repair",["homebuilding","comfort","preparedness"],["money"],"home",["any"],60, -3,2,-80,0,0,0,-1,4,False),
]

# ── Add seq_in_category ──
cat_counters = {}
for a in actions:
    cat = a["category"]
    cat_counters[cat] = cat_counters.get(cat, 0) + 1
    a["seq_in_category"] = cat_counters[cat]

data["counts"]["actions"] = len(actions)
data["actions"] = actions

# ── Write JSON ──
output_path = r"E:\batallion\other\everyday-life-rpg-systems.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# ── Summary ──
print(f"✅ Complete! Written to: {output_path}")
print(f"   Actions:    {len(actions)}")
print(f"   Motives:    {len(data['motives'])}")
print(f"   Categories: {len(data['categories'])}")
print(f"   Breakdown by category:")
for cat_id, count in cat_counters.items():
    print(f"     {cat_id}: {count}")
