# Implementation Summary

**Goal**: Implement an endless daily-life progression system with XP, HP, and Stress.

## Steps
1. Load the final package JSON on app start.
2. Track the current emotion state and the last 5 emotion-adjusted results.
3. For each action, read its tags, sensitivity band, and related motives.
4. Compute the rolling baseline multiplier from the last 5 states.
5. Apply emotion tier shift, tag affinity shift, and optional motive shift.
6. Clamp the multiplier to the action sensitivity band and global bounds.
7. Apply the final multiplier to XP, HP, and Stress deltas.
8. Allow direct XP/HP loss only for `strong_negative` or `extreme_negative` emotions when appropriate.
9. Write the adjusted result back to history and update the three meters.

## Runtime Rules
* Neutral emotions stabilize the baseline.
* Positive emotions increase gains and lower stress.
* Negative emotions reduce gains and raise stress.
* Severe negative emotions can create direct loss.
* Stress acts as both an outcome meter and a modifier meter.

## Practical Notes
* Use the action tag families and override catalog for special cases like smoking or conflict.
* Keep most multipliers conservative and reserve large swings for high-sensitivity actions.
* The system is endless, so setbacks should feel meaningful but not terminal.
