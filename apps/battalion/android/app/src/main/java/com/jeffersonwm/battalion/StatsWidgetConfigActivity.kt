package com.jeffersonwm.battalion

// ============================================================
//  StatsWidgetConfigActivity.kt
//
//  Settings screen for the Battalion Stats Widget.
//  Allows explicitly choosing display mode:
//  - HP Only
//  - XP Only
//  - Health Only
//  - All Three (HP, XP & Health)
//  - Auto (1-row shows chosen stat, 2-row shows all three)
// ============================================================

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class StatsWidgetConfigActivity : ComponentActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Find widget id from intent
        val extras = intent.extras
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
        }

        val prefs = getSharedPreferences("battalion_widget_prefs", Context.MODE_PRIVATE)
        val initialMode = prefs.getString("display_mode_$appWidgetId", "auto") ?: "auto"
        val initialStat = prefs.getString("stat_pref_$appWidgetId", "hp") ?: "hp"

        setContent {
            StatsConfigScreen(
                currentMode = initialMode,
                currentStat = initialStat,
                onSave = { mode, stat ->
                    prefs.edit()
                        .putString("display_mode_$appWidgetId", mode)
                        .putString("stat_pref_$appWidgetId", stat)
                        .apply()

                    // Update widget immediately
                    val manager = AppWidgetManager.getInstance(this)
                    updateStatsWidget(this, manager, appWidgetId)

                    val resultValue = Intent().apply {
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                    }
                    setResult(Activity.RESULT_OK, resultValue)
                    finish()
                },
                onCancel = { finish() }
            )
        }
    }
}

@Composable
fun StatsConfigScreen(
    currentMode: String,
    currentStat: String,
    onSave: (mode: String, stat: String) -> Unit,
    onCancel: () -> Unit
) {
    var selectedMode by remember { mutableStateOf(currentMode) }
    var selectedStat by remember { mutableStateOf(currentStat) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(colors = listOf(BgDark, BgMid)))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(20.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Widget Display Settings",
                    color = Accent,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = onCancel) {
                    Text("Cancel", color = TextMuted)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "Choose what this stats widget displays:",
                color = TextPrimary,
                fontSize = 14.sp
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Option 1: Auto
            ModeOptionCard(
                title = "Auto (Size-Based)",
                description = "1-row height shows your selected stat. 2-row height shows all three stats.",
                isSelected = selectedMode == "auto",
                onClick = { selectedMode = "auto" }
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Option 2: All Three Always
            ModeOptionCard(
                title = "All Three (HP, XP & Health)",
                description = "Always display all 3 progress bars simultaneously.",
                isSelected = selectedMode == "all_three",
                onClick = { selectedMode = "all_three" }
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Option 3: HP Only
            ModeOptionCard(
                title = "HP Only (💚 Green)",
                description = "Compact single bar showing your current Hit Points.",
                isSelected = selectedMode == "hp",
                onClick = {
                    selectedMode = "hp"
                    selectedStat = "hp"
                }
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Option 4: XP Only
            ModeOptionCard(
                title = "XP Only (💙 Cyan)",
                description = "Compact single bar showing your level and XP progress.",
                isSelected = selectedMode == "xp",
                onClick = {
                    selectedMode = "xp"
                    selectedStat = "xp"
                }
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Option 5: Health Only
            ModeOptionCard(
                title = "Health Only (🌿 Emerald)",
                description = "Compact single bar showing your Health Level & Health XP.",
                isSelected = selectedMode == "health",
                onClick = {
                    selectedMode = "health"
                    selectedStat = "health"
                }
            )

            // If Auto is selected, show which stat to show in 1-row mode
            if (selectedMode == "auto") {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "Default stat for 1-row mode:",
                    color = Accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("hp" to "HP", "xp" to "XP", "health" to "Health").forEach { (statKey, label) ->
                        val isChosen = selectedStat == statKey
                        FilterChip(
                            selected = isChosen,
                            onClick = { selectedStat = statKey },
                            label = { Text(label, fontWeight = if (isChosen) FontWeight.Bold else FontWeight.Normal) },
                            colors = FilterChipDefaults.filterChipColors(
                                containerColor = CardBg,
                                labelColor = TextMuted,
                                selectedContainerColor = Accent,
                                selectedLabelColor = Color(0xFF1a1a2e)
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = isChosen,
                                borderColor = if (isChosen) Accent else Color(0xFF334466)
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = {
                    val statToSave = if (selectedMode in listOf("hp", "xp", "health")) selectedMode else selectedStat
                    onSave(selectedMode, statToSave)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Accent)
            ) {
                Text(
                    "Save Widget Settings",
                    color = Color(0xFF1a1a2e),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun ModeOptionCard(
    title: String,
    description: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Color(0xFF22355e) else CardBg
        ),
        border = CardDefaults.outlinedCardBorder().copy(
            brush = Brush.horizontalGradient(
                listOf(
                    if (isSelected) Accent else Color(0xFF334466),
                    if (isSelected) Color(0xFF90caf9) else Color(0xFF223355)
                )
            ),
            width = if (isSelected) 2.dp else 1.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadioButton(
                selected = isSelected,
                onClick = onClick,
                colors = RadioButtonDefaults.colors(
                    selectedColor = Accent,
                    unselectedColor = TextMuted
                )
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = title,
                    color = if (isSelected) Accent else TextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = description,
                    color = TextMuted,
                    fontSize = 11.sp
                )
            }
        }
    }
}
