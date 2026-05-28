import json
import os

actions_file = r"e:\battalion\other\rpg-test-actions.json"
package_file = r"e:\battalion\emotions\final-emotion-core-package.json"
output_file = r"e:\battalion\emotions\everyday-life-rpg-systems-emotion-core-merged.json"

with open(actions_file, 'r', encoding='utf-8') as f:
    actions_data = json.load(f)

with open(package_file, 'r', encoding='utf-8') as f:
    package_data = json.load(f)

def assign_emotion_fields(action):
    cat = action.get("category", "")
    motives = action.get("related_motives", [])
    label = action.get("label", "").lower()
    
    sensitivity = "low"
    band = "0.95-1.10"
    tags = []
    
    # Heuristics for tags
    if "routine" in motives or cat in ["basic_needs", "home_care", "errands_mobility"]:
        tags.append("routine")
        
    if "restoration" in motives or "sleep" in action.get("needs", []):
        tags.append("restorative")
        tags.append("comfort")
        
    if cat == "social_relationships" or "belonging" in motives or "friendship" in motives:
        tags.append("social")
        sensitivity = "high"
        band = "0.70-1.35"
        
    if cat == "leisure_growth":
        if "creativity" in motives:
            tags.append("creative")
        if "fun" in motives:
            tags.append("stimulation")
        if "escape" in motives:
            tags.append("escape")
            sensitivity = "high"
            band = "0.70-1.35"
            
    if "admin" in cat or "order" in motives:
        tags.append("administrative")
        
    if "health" in cat or "health" in motives:
        tags.append("health_support")
        
    if "money" in cat or "wealth" in motives:
        tags.append("financial")
        
    if "care" in cat or "caregiving" in cat or "parenting" in motives:
        tags.append("care")
        
    if cat == "work_study" or "productivity" in motives or "mastery" in motives:
        tags.append("achievement")
        sensitivity = "medium"
        band = "0.85-1.20"
        
    if "learning" in motives or "education" in motives:
        tags.append("learning")
        
    if "mobility" in motives:
        tags.append("mobility")
        
    if "discipline" in motives:
        tags.append("discipline_building")
        
    if "hygiene" in action.get("needs", []):
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
        
    # Default tags if empty
    if not tags:
        tags.append("routine")
        
    # Deduplicate tags
    tags = list(set(tags))
    
    return sensitivity, band, tags

# Process actions
for action in actions_data.get("actions", []):
    sensitivity, band, tags = assign_emotion_fields(action)
    action["emotion_sensitivity"] = sensitivity
    action["emotion_multiplier_band"] = band
    action["emotion_tags"] = tags

# Merge data
package_data["emotion_core"]["actions"] = actions_data.get("actions", [])
package_data["emotion_core"]["categories"] = actions_data.get("categories", [])
package_data["emotion_core"]["motives"] = actions_data.get("motives", [])
package_data["emotion_core"]["schema_notes"].update(actions_data.get("schema_notes", {}))
package_data["emotion_core"]["counts"] = actions_data.get("counts", {})
# Update action count
package_data["emotion_core"]["counts"]["actions"] = len(package_data["emotion_core"]["actions"])

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(package_data, f, indent=2)

print(f"Merged JSON created at {output_file}")
