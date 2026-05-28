# Emotion action formula spec

This artifact defines the exact calculation model for combining emotion tiers, action sensitivity bands, action tags, and optional motive alignment.

## Order

- Start from neutral multiplier 1.0
- Apply tier pressure based on emotion intensity and emotional valence direction
- Apply tag affinity shift using favored_tags and avoided_tags
- Apply optional motive alignment shift
- Clamp to action emotion_multiplier_band
- Apply final multiplier to action deltas
- Add any flat emotion modifiers after scaled deltas are computed

## Sensitivity bands

- low: min 0.95, max 1.1, tag_step 0.03, motive_step 0.02
- medium: min 0.85, max 1.2, tag_step 0.06, motive_step 0.04
- high: min 0.7, max 1.35, tag_step 0.1, motive_step 0.06

## Tier pressure

- Tier 1: 0.0
- Tier 2: 0.03
- Tier 3: 0.06
- Tier 4: 0.1
- Tier 5: 0.15

## Pseudocode

- band = sensitivity_bands[action.emotion_sensitivity]
- mult = 1.0
- favored_matches = count(action.emotion_tags ∩ emotion.favored_tags)
- avoided_matches = count(action.emotion_tags ∩ emotion.avoided_tags)
- aligned_motives = optional count(action.related_motives ∩ emotion.supported_motives)
- misaligned_motives = optional count(action.related_motives ∩ emotion.opposed_motives)
- mult += favored_matches * band.tag_step
- mult -= avoided_matches * band.tag_step
- mult += aligned_motives * band.motive_step
- mult -= misaligned_motives * band.motive_step
- if emotion.tier >= 4 and favored_matches > avoided_matches: mult += tier_pressure[tier]
- if emotion.tier >= 4 and avoided_matches > favored_matches: mult -= tier_pressure[tier]
- mult = clamp(mult, band.min, band.max)
- final_delta = round(base_action_delta * mult)
- final_delta += emotion.flat_modifier_for_same_metric

## Sample cases

### Hopeful -> Study for Exam
- Sensitivity: high
- Tags: achievement, learning, discipline_building
- Estimated multiplier: 1.35

### Fear -> Argue With Friend
- Sensitivity: high
- Tags: social, conflict, risky
- Estimated multiplier: 0.7

### Connected -> Call Family
- Sensitivity: medium
- Tags: social, care, comfort
- Estimated multiplier: 1.18
