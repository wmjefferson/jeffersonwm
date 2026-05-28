import json

with open("E:/batallion/other/everyday-life-rpg-systems.json", "r", encoding="utf-8") as f:
    d = json.load(f)

cats = {}
for a in d["actions"]:
    c = a["category"]
    cats[c] = cats.get(c, 0) + 1

print("=== CATEGORY BREAKDOWN ===")
for k, v in cats.items():
    print(f"  {k}: {v}")

# Check all actions have required fields
required = ["id","label","category","seq_in_category","related_motives","needs",
            "location","time_of_day","time_minutes",
            "energy_delta","stress_delta","money_delta","social_delta",
            "health_delta","hygiene_delta","fun_delta","discipline_delta",
            "repeatable","prerequisites"]

missing = []
for a in d["actions"]:
    for r in required:
        if r not in a:
            missing.append(f"{a['id']} missing {r}")

if missing:
    print("\nMISSING FIELDS:")
    for m in missing:
        print(f"  {m}")
else:
    print("\nAll 354 actions have all required fields!")

# Check for duplicate IDs
ids = [a["id"] for a in d["actions"]]
dupes = set([x for x in ids if ids.count(x) > 1])
if dupes:
    print(f"\nDUPLICATE IDS: {dupes}")
else:
    print("No duplicate action IDs!")
