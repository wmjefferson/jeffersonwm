import json
import os
import random

# Working directory should be the 'other' folder
v1_path = "everyday-life-rpg-systems.json"
v2_path = os.path.join("..", "emotions", "everyday-life-rpg-systems-emotion-core-merged-v2.json")

# Ensure files exist
if not os.path.exists(v1_path):
    print(f"Error: {v1_path} not found.")
    exit(1)

if not os.path.exists(v2_path):
    print(f"Error: {v2_path} not found.")
    exit(1)

# Load data
with open(v1_path, "r", encoding="utf-8") as f:
    v1_data = json.load(f)

with open(v2_path, "r", encoding="utf-8") as f:
    v2_data = json.load(f)

v1_actions = v1_data["actions"]
v2_actions = v2_data["emotion_core"]["actions"]

# Track existing action IDs in v2
def get_action_id(a):
    return a.get("id") or a.get("action_id")

v2_ids = {get_action_id(a) for a in v2_actions if get_action_id(a)}

# 1. Restore missing actions from v1 (everyday-life-rpg-systems.json)
missing_v1 = [a for a in v1_actions if get_action_id(a) not in v2_ids]
print(f"Restoring {len(missing_v1)} actions from the original everyday-life-rpg-systems.json...")

# Heuristics function from merge_data.py to tag actions emotionally
def assign_emotion_fields(action):
    cat = action.get("category", "")
    motives = action.get("related_motives", [])
    label = action.get("label", "").lower()
    needs = action.get("needs", [])
    
    sensitivity = "low"
    band = "0.95-1.10"
    tags = []
    
    if "routine" in motives or cat in ["basic_needs", "home_care", "errands_mobility", "routine"]:
        tags.append("routine")
        
    if "restoration" in motives or "sleep" in needs:
        tags.append("restorative")
        tags.append("comfort")
        
    if cat == "social_relationships" or "belonging" in motives or "friendship" in motives or cat == "social":
        tags.append("social")
        sensitivity = "high"
        band = "0.70-1.35"
        
    if cat == "leisure_growth" or cat == "recreation":
        if "creativity" in motives:
            tags.append("creative")
        if "fun" in motives:
            tags.append("stimulation")
        if "escape" in motives:
            tags.append("escape")
            sensitivity = "high"
            band = "0.70-1.35"
            
    if "admin" in cat or "order" in motives or cat == "finance":
        tags.append("administrative")
        
    if "health" in cat or "health" in motives or cat == "vitality":
        tags.append("health_support")
        
    if "money" in cat or "wealth" in motives or cat == "finance":
        tags.append("financial")
        
    if "care" in cat or "caregiving" in cat or "parenting" in motives or cat == "caregiving_parenting":
        tags.append("care")
        
    if cat == "work_study" or "productivity" in motives or "mastery" in motives or cat == "work":
        tags.append("achievement")
        sensitivity = "medium"
        band = "0.85-1.20"
        
    if "learning" in motives or "education" in motives or cat == "learning":
        tags.append("learning")
        
    if "mobility" in motives or cat == "transport" or cat == "errands":
        tags.append("mobility")
        
    if "discipline" in motives or cat == "discipline":
        tags.append("discipline_building")
        
    if "hygiene" in needs or "hygiene" in tags:
        tags.append("hygiene")
        
    if "argue" in label or "fight" in label or "conflict" in label:
        tags.append("conflict")
        sensitivity = "high"
        band = "0.70-1.35"
        
    if "smoke" in label or "drink alcohol" in label or "gamble" in label:
        tags.append("risky")
        tags.append("escape")
        sensitivity = "high"
        band = "0.70-1.35"
        
    if "identity" in motives or "self_expression" in motives:
        tags.append("identity")
        
    if "homebuilding" in motives:
        tags.append("domestic")
        
    if not tags:
        tags.append("routine")
        
    tags = list(set(tags))
    return sensitivity, band, tags

# Map missing v1 actions into the correct format and assign emotion fields
restored_actions = []
for a in missing_v1:
    sensitivity, band, tags = assign_emotion_fields(a)
    action_dict = {
        "id": get_action_id(a),
        "label": a.get("label"),
        "category": a.get("category"),
        "related_motives": a.get("related_motives", []),
        "needs": a.get("needs", []),
        "location": a.get("location", "any"),
        "time_of_day": a.get("time_of_day", ["any"]),
        "time_minutes": a.get("time_minutes", 5),
        "energy_delta": a.get("energy_delta", 0),
        "stress_delta": a.get("stress_delta", 0),
        "money_delta": a.get("money_delta", 0),
        "social_delta": a.get("social_delta", 0),
        "health_delta": a.get("health_delta", 0),
        "hygiene_delta": a.get("hygiene_delta", 0),
        "fun_delta": a.get("fun_delta", 0),
        "discipline_delta": a.get("discipline_delta", 0),
        "repeatable": a.get("repeatable", True),
        "prerequisites": a.get("prerequisites", []),
        "emotion_sensitivity": sensitivity,
        "emotion_multiplier_band": band,
        "emotion_tags": tags
    }
    restored_actions.append(action_dict)

# 2. Define 14 custom 'personal' actions
personal_raw = [
    ("lightly_toasted", "Lightly Toasted", 50, -50, 0, 0, 0, 0, 50, -50),
    ("donuts", "Donuts", 0, -50, -50, 0, -150, 0, 100, 0),
    ("st_john", "St. John", 0, -100, 0, 0, 100, 0, 0, 50),
    ("refs", "Refs", 0, 0, 0, 0, 0, 0, 50, 100),
    ("out_of_body", "Out of Body", -200, 100, 0, 0, -100, 0, 0, -100),
    ("food_crave", "Food Crave", 0, 100, 0, 0, 0, 0, -50, 0),
    ("shat_myself", "Shat Myself", -100, 500, 0, -200, -100, -800, 0, 0),
    ("talk_too_much", "Talk Too Much", -100, 100, 0, 100, 0, 0, 0, 0),
    ("lucy", "Lucy", 0, -100, 0, 0, 0, 0, 100, 0),
    ("ustfu", "USTFU", 0, 200, 0, 0, 0, 0, 0, -100),
    ("overloaded", "Overloaded", -300, 400, 0, 0, 0, 0, 0, -100),
    ("meal_cooked", "Meal Cooked", -100, 0, -100, 0, 200, 0, 0, 100),
    ("bobbiecamp", "Bobbiecamp", 0, -50, 0, 0, 0, 0, 100, 0),
    ("b_radisson", "B-Radisson", 0, -50, 0, 0, 0, 0, 100, 0)
]

personal_actions = []
for id_str, label_str, en, st, mo, so, he, hy, fu, di in personal_raw:
    action = {
        "id": id_str,
        "label": label_str,
        "category": "personal",
        "related_motives": [],
        "needs": [],
        "location": "any",
        "time_of_day": ["any"],
        "time_minutes": 5,
        "energy_delta": en,
        "stress_delta": st,
        "money_delta": mo,
        "social_delta": so,
        "health_delta": he,
        "hygiene_delta": hy,
        "fun_delta": fu,
        "discipline_delta": di,
        "repeatable": True,
        "prerequisites": []
    }
    sensitivity, band, tags = assign_emotion_fields(action)
    
    # Custom tags adjustments for personal items
    if id_str == "shat_myself":
        tags.append("hygiene")
    if id_str == "talk_too_much":
        tags.append("social")
    if id_str == "st_john":
        tags.append("health_support")
    if id_str == "donuts":
        tags.append("routine")
        
    action["emotion_sensitivity"] = sensitivity
    action["emotion_multiplier_band"] = band
    action["emotion_tags"] = list(set(tags))
    personal_actions.append(action)

# 3. Create ~150 customized actions reflecting user's life details
# We will define base templates and programmatic variations with slightly adjusted stats (all scaled 10x)
base_custom_definitions = [
    # Sleep/Waking
    {"label": "Wake up early (7 AM)", "cat": "basic_needs", "en": 100, "st": -50, "mo": 0, "so": 0, "he": 50, "hy": 0, "fu": 0, "di": 150, "motives": ["routine", "discipline"]},
    {"label": "Wake up normal (8 AM)", "cat": "basic_needs", "en": 200, "st": 0, "mo": 0, "so": 0, "he": 50, "hy": 0, "fu": 0, "di": 100, "motives": ["routine", "discipline"]},
    {"label": "Wake up late (9 AM)", "cat": "basic_needs", "en": 100, "st": 100, "mo": 0, "so": 0, "he": 0, "hy": 0, "fu": 0, "di": -100, "motives": ["routine"]},
    {"label": "Go to bed on time (10-11 PM)", "cat": "basic_needs", "en": 150, "st": -100, "mo": 0, "so": 0, "he": 150, "hy": 0, "fu": 0, "di": 200, "motives": ["routine", "discipline", "health"]},
    {"label": "Go to bed late (after 11 PM)", "cat": "basic_needs", "en": -200, "st": 150, "mo": 0, "so": 0, "he": -100, "hy": 0, "fu": 0, "di": -150, "motives": ["routine"]},
    {"label": "Experience nightmare", "cat": "basic_needs", "en": -200, "st": 300, "mo": 0, "so": 0, "he": -100, "hy": 0, "fu": 0, "di": 0, "motives": ["mental_stability"]},
    {"label": "Wake up from nightmare in night", "cat": "basic_needs", "en": -300, "st": 400, "mo": 0, "so": 0, "he": -100, "hy": 0, "fu": 0, "di": 0, "motives": ["mental_stability"]},
    {"label": "Get a notable good night's sleep", "cat": "basic_needs", "en": 500, "st": -300, "mo": 0, "so": 0, "he": 300, "hy": 0, "fu": 100, "di": 100, "motives": ["restoration", "health"]},
    
    # Meds
    {"label": "Take anxiety medication", "cat": "basic_needs", "en": 0, "st": -300, "mo": 0, "so": 0, "he": 150, "hy": 0, "fu": 0, "di": 100, "motives": ["health", "mental_stability"]},
    {"label": "Take depression medication", "cat": "basic_needs", "en": 0, "st": -200, "mo": 0, "so": 0, "he": 150, "hy": 0, "fu": 0, "di": 100, "motives": ["health", "mental_stability"]},
    {"label": "Take sleep medication", "cat": "basic_needs", "en": 100, "st": 0, "mo": 0, "so": 0, "he": 100, "hy": 0, "fu": 0, "di": 100, "motives": ["health", "restoration"]},
    
    # Hygiene / Jockstrap
    {"label": "Wear daily jockstrap", "cat": "basic_needs", "en": 0, "st": 0, "mo": 0, "so": 0, "he": 50, "hy": 100, "fu": 0, "di": 100, "motives": ["routine", "confidence"]},
    {"label": "Wear briefs (rare)", "cat": "basic_needs", "en": 0, "st": 0, "mo": 0, "so": 0, "he": 0, "hy": 50, "fu": 0, "di": 50, "motives": ["routine"]},
    
    # Diet / Coffee
    {"label": "Eat in middle of the night", "cat": "food_cooking", "en": 200, "st": 100, "mo": -50, "so": 0, "he": -150, "hy": 0, "fu": 50, "di": -200, "motives": ["comfort", "survival"]},
    {"label": "Drink cup of coffee", "cat": "food_cooking", "en": 200, "st": -50, "mo": -20, "so": 0, "he": -20, "hy": 0, "fu": 50, "di": 50, "motives": ["comfort", "routine"]},
    {"label": "Drink excessive cup of coffee (3+)", "cat": "food_cooking", "en": -100, "st": 250, "mo": -20, "so": 0, "he": -150, "hy": 0, "fu": -50, "di": -100, "motives": ["routine"]},
    
    # Hobbies & Art Student
    {"label": "Code with AI on personal project", "cat": "work_study", "en": -150, "st": -50, "mo": 0, "so": 0, "he": 0, "hy": 0, "fu": 150, "di": 200, "motives": ["mastery", "creativity"]},
    {"label": "Paint on canvas", "cat": "leisure_growth", "en": -150, "st": -150, "mo": -50, "so": 0, "he": 0, "hy": -50, "fu": 200, "di": 150, "motives": ["creativity", "self_expression"]},
    {"label": "Draw in sketchbook", "cat": "leisure_growth", "en": -100, "st": -100, "mo": 0, "so": 0, "he": 0, "hy": 0, "fu": 150, "di": 150, "motives": ["creativity", "self_expression"]},
    {"label": "Write lines of poetry", "cat": "leisure_growth", "en": -50, "st": -150, "mo": 0, "so": 0, "he": 0, "hy": 0, "fu": 100, "di": 100, "motives": ["creativity", "self_expression"]},
    {"label": "Take creative photographs", "cat": "leisure_growth", "en": -150, "st": -100, "mo": -50, "so": 0, "he": 50, "hy": 0, "fu": 150, "di": 100, "motives": ["creativity", "self_expression"]},
    {"label": "Prompt AI for images", "cat": "leisure_growth", "en": -100, "st": -100, "mo": 0, "so": 0, "he": 0, "hy": 0, "fu": 200, "di": 150, "motives": ["creativity", "fun"]},
    
    # News & Videos
    {"label": "Read positive news story", "cat": "leisure_growth", "en": 100, "st": -150, "mo": 0, "so": 0, "he": 50, "hy": 0, "fu": 100, "di": 50, "motives": ["education", "fun"]},
    {"label": "Read negative news story", "cat": "leisure_growth", "en": -100, "st": 250, "mo": 0, "so": 0, "he": -50, "hy": 0, "fu": -50, "di": 0, "motives": ["education"]},
    {"label": "Watch positive video", "cat": "leisure_growth", "en": 100, "st": -150, "mo": 0, "so": 0, "he": 50, "hy": 0, "fu": 150, "di": 0, "motives": ["fun", "restoration"]},
    {"label": "Watch negative video", "cat": "leisure_growth", "en": -50, "st": 200, "mo": 0, "so": 0, "he": -50, "hy": 0, "fu": -50, "di": 0, "motives": ["fun"]},

    # Shopping
    {"label": "Shop online", "cat": "money_admin", "en": 0, "st": -150, "mo": -600, "so": 0, "he": -50, "hy": 0, "fu": 200, "di": -150, "motives": ["pleasure", "control"]},
    {"label": "Shop in person", "cat": "money_admin", "en": -200, "st": 150, "mo": -400, "so": 0, "he": 100, "hy": 0, "fu": 100, "di": 50, "motives": ["mobility", "pleasure"]},

    # Anxiety / Public / Doctor
    {"label": "Experience public anxiety attack", "cat": "health_fitness", "en": -300, "st": 450, "mo": 0, "so": -100, "he": -100, "hy": 0, "fu": -100, "di": 0, "motives": ["mental_stability"]},
    {"label": "Avoid public place due to anxiety", "cat": "health_fitness", "en": 100, "st": -150, "mo": 0, "so": -200, "he": -50, "hy": 0, "fu": -50, "di": -100, "motives": ["mental_stability"]},
    {"label": "Attend session with therapist", "cat": "health_fitness", "en": -100, "st": -250, "mo": -400, "so": 50, "he": 200, "hy": 0, "fu": 50, "di": 150, "motives": ["mental_stability", "healing"]},
    {"label": "Attend session with psychiatrist", "cat": "health_fitness", "en": -50, "st": -200, "mo": -500, "so": 0, "he": 250, "hy": 0, "fu": 0, "di": 150, "motives": ["mental_stability", "healing"]},
    {"label": "Visit primary care doctor", "cat": "health_fitness", "en": -100, "st": -50, "mo": -300, "so": 0, "he": 300, "hy": 0, "fu": 0, "di": 100, "motives": ["health", "security"]},
    {"label": "Answer phone call", "cat": "social_relationships", "en": -100, "st": 150, "mo": 0, "so": 150, "he": 0, "hy": 0, "fu": 0, "di": 100, "motives": ["social", "connection"]},
    {"label": "Unable to answer phone", "cat": "social_relationships", "en": 0, "st": 200, "mo": 0, "so": -100, "he": -50, "hy": 0, "fu": -50, "di": -100, "motives": ["mental_stability"]},
    {"label": "Send email successfully", "cat": "social_relationships", "en": -50, "st": 100, "mo": 0, "so": 100, "he": 0, "hy": 0, "fu": 0, "di": 100, "motives": ["social", "connection"]},
    {"label": "Unable to send email", "cat": "social_relationships", "en": 0, "st": 150, "mo": 0, "so": -50, "he": -50, "hy": 0, "fu": -50, "di": -100, "motives": ["mental_stability"]}
]

# Generate variations dynamically to expand into 150+ actions
variations_pool = [
    # AI Coding Variations
    {"base": "Code with AI on personal project", "variants": [
        "Code with AI: write database schema", "Code with AI: implement dashboard layout", 
        "Code with AI: fix backend route bug", "Code with AI: write data import script",
        "Code with AI: optimize database queries", "Code with AI: refactor styling files",
        "Code with AI: integrate emotion formulas", "Code with AI: debug connection errors",
        "Code with AI: clean up unused modules", "Code with AI: write documentation comments"
    ]},
    # Painting Variations
    {"base": "Paint on canvas", "variants": [
        "Paint on canvas: color theory exercise", "Paint on canvas: still life study",
        "Paint on canvas: sky and lighting sketch", "Paint on canvas: abstract color blocks",
        "Paint on canvas: prepare canvas layers", "Paint on canvas: wash paint brushes",
        "Paint on canvas: apply final varnish layer", "Paint on canvas: review portfolio photos",
        "Paint on canvas: clean studio workspace", "Paint on canvas: outline new concept sketch"
    ]},
    # Drawing Variations
    {"base": "Draw in sketchbook", "variants": [
        "Draw in sketchbook: hand gesture drawings", "Draw in sketchbook: perspective study",
        "Draw in sketchbook: dog anatomy gestures", "Draw in sketchbook: charcoal portraits",
        "Draw in sketchbook: ink outlines", "Draw in sketchbook: watercolor details",
        "Draw in sketchbook: shade and lighting study", "Draw in sketchbook: quick doodles"
    ]},
    # Poetry Variations
    {"base": "Write lines of poetry", "variants": [
        "Write poetry: introspective thoughts", "Write poetry: nature and seasons theme",
        "Write poetry: abstract mental states", "Write poetry: review old draft folders",
        "Write poetry: read classic poetry collection", "Write poetry: format poetry chapbook"
    ]},
    # Photo Variations
    {"base": "Take creative photographs", "variants": [
        "Take creative photographs: morning sunlight shadows", "Take creative photographs: street textures",
        "Take creative photographs: macro lens details", "Take creative photographs: clean camera lenses",
        "Take creative photographs: sort raw files on SD card", "Take creative photographs: edit photography prints"
    ]},
    # AI Image variations
    {"base": "Prompt AI for images", "variants": [
        "Prompt AI: surreal dream landscapes", "Prompt AI: abstract digital paintings",
        "Prompt AI: test lighting and prompt styles", "Prompt AI: generate color palette palettes"
    ]},
    # Online shopping variations
    {"base": "Shop online", "variants": [
        "Shop online: buy new art canvases", "Shop online: buy replacement paint tubes",
        "Shop online: buy dog treats and toys", "Shop online: browse shopping site listings",
        "Shop online: add items to wishlist", "Shop online: review shipping tracking status"
    ]},
    # In-person shopping variations
    {"base": "Shop in person", "variants": [
        "Shop in person: visit art supply store", "Shop in person: buy groceries",
        "Shop in person: buy household items"
    ]}
]

# Generate custom actions using base definitions and variations
custom_actions = []
generated_count = 0

# Set up mapping from base labels to their templates
base_templates = {d["label"]: d for d in base_custom_definitions}

# Generate variations first
for vp in variations_pool:
    base_label = vp["base"]
    if base_label in base_templates:
        template = base_templates[base_label]
        for variant_label in vp["variants"]:
            # Slightly adjust stats to create organic variance (±20%)
            def adj(val):
                if val == 0: return 0
                factor = random.choice([0.8, 0.9, 1.0, 1.1, 1.2])
                return int(val * factor)
                
            var_action = {
                "id": variant_label.lower().replace(":", "").replace(" ", "_").replace("(", "").replace(")", ""),
                "label": variant_label,
                "category": template["cat"],
                "related_motives": template["motives"],
                "needs": [],
                "location": "home" if template["cat"] in ["work_study", "leisure_growth"] else "any",
                "time_of_day": ["any"],
                "time_minutes": random.choice([5, 10, 15, 30, 45]),
                "energy_delta": adj(template["en"]),
                "stress_delta": adj(template["st"]),
                "money_delta": adj(template["mo"]),
                "social_delta": adj(template["so"]),
                "health_delta": adj(template["he"]),
                "hygiene_delta": adj(template["hy"]),
                "fun_delta": adj(template["fu"]),
                "discipline_delta": adj(template["di"]),
                "repeatable": True,
                "prerequisites": []
            }
            sensitivity, band, tags = assign_emotion_fields(var_action)
            var_action["emotion_sensitivity"] = sensitivity
            var_action["emotion_multiplier_band"] = band
            var_action["emotion_tags"] = tags
            custom_actions.append(var_action)
            generated_count += 1

# Add standard base definitions that didn't have variations
for d in base_custom_definitions:
    # Add id
    act_id = d["label"].lower().replace(":", "").replace(" ", "_").replace("(", "").replace(")", "").replace("-", "_")
    base_action = {
        "id": act_id,
        "label": d["label"],
        "category": d["cat"],
        "related_motives": d["motives"],
        "needs": [],
        "location": "any",
        "time_of_day": ["any"],
        "time_minutes": 10,
        "energy_delta": d["en"],
        "stress_delta": d["st"],
        "money_delta": d["mo"],
        "social_delta": d["so"],
        "health_delta": d["he"],
        "hygiene_delta": d["hy"],
        "fun_delta": d["fu"],
        "discipline_delta": d["di"],
        "repeatable": True,
        "prerequisites": []
    }
    sensitivity, band, tags = assign_emotion_fields(base_action)
    base_action["emotion_sensitivity"] = sensitivity
    base_action["emotion_multiplier_band"] = band
    base_action["emotion_tags"] = tags
    custom_actions.append(base_action)
    generated_count += 1

# Add dog feeding/cleaning actions explicitly
extra_dog_actions = [
    {"label": "Feed dog in morning", "cat": "caregiving_parenting", "en": 0, "st": -50, "mo": -50, "so": 0, "he": 0, "hy": 0, "fu": 50, "di": 100, "motives": ["routine", "family"]},
    {"label": "Feed dog in evening", "cat": "caregiving_parenting", "en": 0, "st": -50, "mo": -50, "so": 0, "he": 0, "hy": 0, "fu": 50, "di": 100, "motives": ["routine", "family"]},
    {"label": "Clean dog water bowl", "cat": "caregiving_parenting", "en": -50, "st": 0, "mo": 0, "so": 0, "he": 0, "hy": 100, "fu": 0, "di": 100, "motives": ["routine", "hygiene"]},
    {"label": "Play with dog indoors", "cat": "caregiving_parenting", "en": 50, "st": -150, "mo": 0, "so": 0, "he": 50, "hy": 0, "fu": 150, "di": 50, "motives": ["family", "fun"]}
]

for d in extra_dog_actions:
    act_id = d["label"].lower().replace(" ", "_")
    dog_action = {
        "id": act_id,
        "label": d["label"],
        "category": d["cat"],
        "related_motives": d["motives"],
        "needs": [],
        "location": "home",
        "time_of_day": ["any"],
        "time_minutes": 5,
        "energy_delta": d["en"],
        "stress_delta": d["st"],
        "money_delta": d["mo"],
        "social_delta": d["so"],
        "health_delta": d["he"],
        "hygiene_delta": d["hy"],
        "fun_delta": d["fu"],
        "discipline_delta": d["di"],
        "repeatable": True,
        "prerequisites": []
    }
    sensitivity, band, tags = assign_emotion_fields(dog_action)
    dog_action["emotion_sensitivity"] = sensitivity
    dog_action["emotion_multiplier_band"] = band
    dog_action["emotion_tags"] = tags
    custom_actions.append(dog_action)
    generated_count += 1

print(f"Programmatically generated {generated_count} custom daily-life actions based on user profile.")

# 4. Update the categories list to prepend "personal"
# We want it to be at the absolute top of the category list in the UI
has_personal_cat = any(c["id"] == "personal" for c in v2_data["emotion_core"]["categories"])
if not has_personal_cat:
    v2_data["emotion_core"]["categories"].insert(0, {
        "id": "personal",
        "label": "Personal",
        "description": "User custom personal tracking items"
    })
    print("Prepended 'personal' category at the top of the categories list.")

# Assemble the final actions array
# Order: Personal actions first, then the rest (to show Personal category at the top in UI)
final_actions = personal_actions + custom_actions + restored_actions + v2_actions

# Remove duplicates by ID (keeping the first occurrence, which would be our custom personal/custom actions first)
seen_ids = set()
unique_final_actions = []
for a in final_actions:
    a_id = get_action_id(a)
    if a_id not in seen_ids:
        seen_ids.add(a_id)
        # Ensure ID format uses the "id" key consistently
        a["id"] = a_id
        if "action_id" in a:
            del a["action_id"]
        unique_final_actions.append(a)

v2_data["emotion_core"]["actions"] = unique_final_actions
v2_data["emotion_core"]["counts"]["actions"] = len(unique_final_actions)

print(f"Final action database status:")
print(f"   Original Actions:  {len(v2_actions)}")
print(f"   Total Actions Now: {len(unique_final_actions)}")
print(f"   Breakdown: {len(personal_actions)} personal, {len(custom_actions)} customized, {len(restored_actions)} restored, {len(v2_actions)} original")

# Save updated JSON file
with open(v2_path, "w", encoding="utf-8") as f:
    json.dump(v2_data, f, indent=2, ensure_ascii=False)

print(f"Successfully wrote updated master database to {v2_path}!")
