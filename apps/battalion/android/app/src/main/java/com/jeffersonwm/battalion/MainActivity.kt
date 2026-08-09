package com.jeffersonwm.battalion

// ============================================================
//  MainActivity.kt
//
//  The main screen of the app. Three sections:
//  1. Stats header: Level, HP bar, XP bar, Gold
//  2. Emotion chips: tap to log how you feel
//  3. Action grid: tap to perform a real-life action
//
//  CONCEPT: ViewModel keeps data alive across screen rotations.
//  Without it, rotating your phone would reset all loaded data.
//
//  CONCEPT: LaunchedEffect runs code when a Composable first
//  appears on screen — perfect for initial data loading.
// ============================================================

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// --- Color palette ---
val BgDark = Color(0xFF1a1a2e)
val BgMid = Color(0xFF16213e)
val Accent = Color(0xFF4fc3f7)
val AccentDim = Color(0xFF0d47a1)
val CardBg = Color(0xFF1e2a4a)
val TextPrimary = Color(0xFFe8eaf6)
val TextMuted = Color(0xFF90a4ae)
val HpColor = Color(0xFF66bb6a)
val XpColor = Color(0xFF4fc3f7)
val GoldColor = Color(0xFFffd54f)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // If not logged in, redirect to login screen
        if (!ApiClient.isLoggedIn(this)) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        setContent {
            MainScreen()
        }
    }
}

@Composable
fun MainScreen() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    // State: mutableStateOf triggers UI recomposition when value changes
    var player by remember { mutableStateOf(PlayerState()) }
    var emotions by remember { mutableStateOf<List<Emotion>>(emptyList()) }
    var actions by remember { mutableStateOf<List<Action>>(emptyList()) }
    var searchQuery by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }

    // Dialog state for the tier picker
    var selectedEmotion by remember { mutableStateOf<Emotion?>(null) }
    var showTierDialog by remember { mutableStateOf(false) }

    // Helper to refresh the dashboard stats
    fun refreshStats() {
        coroutineScope.launch {
            val result = withContext(Dispatchers.IO) { ApiClient.fetchDashboard() }
            result.onSuccess { player = it.player }
        }
    }

    // LaunchedEffect(Unit) runs once when this Composable first appears — like componentDidMount
    LaunchedEffect(Unit) {
        coroutineScope.launch {
            // Load all data in parallel using separate coroutines
            val dashboard = withContext(Dispatchers.IO) { ApiClient.fetchDashboard() }
            val emotionList = withContext(Dispatchers.IO) { ApiClient.fetchEmotions() }
            val actionList = withContext(Dispatchers.IO) { ApiClient.fetchActions() }

            dashboard.onSuccess { player = it.player }
            emotionList.onSuccess { emotions = it }
            actionList.onSuccess { actions = it }
            isLoading = false
        }
    }

    // Tier picker dialog — shown when user taps an emotion chip
    if (showTierDialog && selectedEmotion != null) {
        TierPickerDialog(
            emotion = selectedEmotion!!,
            onDismiss = { showTierDialog = false; selectedEmotion = null },
            onTierSelected = { tier ->
                showTierDialog = false
                coroutineScope.launch {
                    val result = withContext(Dispatchers.IO) {
                        ApiClient.logEmotion(selectedEmotion!!.id, tier)
                    }
                    result.onSuccess {
                        Toast.makeText(context, "${selectedEmotion!!.name} logged!", Toast.LENGTH_SHORT).show()
                        selectedEmotion = null
                        refreshStats()
                    }
                    result.onFailure {
                        Toast.makeText(context, "Failed to log emotion", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }

    // Main layout
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(colors = listOf(BgDark, BgMid)))
    ) {
        // ---- Stats Header ----
        StatsHeader(player = player)

        if (isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Accent)
            }
            return@Column
        }

        // ---- Emotion Section ----
        SectionLabel("HOW ARE YOU FEELING?")
        EmotionChips(
            emotions = emotions,
            onEmotionTapped = { emotion ->
                selectedEmotion = emotion
                showTierDialog = true
            }
        )

        // ---- Action Section ----
        SectionLabel("WHAT DID YOU DO?")

        // Search bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search actions...", color = TextMuted) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Accent,
                unfocusedBorderColor = Color(0xFF334466),
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                cursorColor = Accent
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Action grid — filtered by search query
        val filteredActions = if (searchQuery.isBlank()) actions
            else actions.filter { it.name.contains(searchQuery, ignoreCase = true) }

        // CONCEPT: LazyVerticalGrid only renders the cards currently visible on screen,
        // making it efficient even with hundreds of actions.
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(filteredActions) { action ->
                ActionCard(action = action, onClick = {
                    coroutineScope.launch {
                        val result = withContext(Dispatchers.IO) { ApiClient.performAction(action.id) }
                        result.fold(
                            onSuccess = { perf ->
                                val msg = if (perf.xpEarned > 0)
                                    "+${perf.xpEarned} XP  +${perf.goldEarned} Gold"
                                else "Logged: ${action.name}"
                                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                refreshStats()
                            },
                            onFailure = {
                                Toast.makeText(context, "Action failed", Toast.LENGTH_SHORT).show()
                            }
                        )
                    }
                })
            }
        }
    }
}

// ---- Sub-composables ----

@Composable
fun StatsHeader(player: PlayerState) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0d1117))
            .padding(16.dp)
    ) {
        // Title row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("⚔ Battalion", color = Accent, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Lv.${player.level} ${player.title}", color = TextMuted, fontSize = 14.sp)
        }

        Spacer(modifier = Modifier.height(10.dp))

        // HP bar
        StatBar(
            label = "HP",
            current = player.hp,
            max = player.maxHp,
            color = HpColor
        )

        Spacer(modifier = Modifier.height(6.dp))

        // XP bar
        StatBar(
            label = "XP",
            current = player.xp,
            max = player.xpToNext,
            color = XpColor
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Gold + mood row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("💰 ${player.gold} Gold", color = GoldColor, fontSize = 14.sp)
            Text("Mood: ${player.currentMood}", color = TextMuted, fontSize = 13.sp)
        }
    }
}

@Composable
fun StatBar(label: String, current: Int, max: Int, color: Color) {
    val fraction = if (max > 0) current.toFloat() / max else 0f
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(label, color = TextMuted, fontSize = 12.sp)
            Text("$current / $max", color = TextMuted, fontSize = 12.sp)
        }
        Spacer(modifier = Modifier.height(3.dp))
        LinearProgressIndicator(
            progress = { fraction },
            modifier = Modifier.fillMaxWidth().height(8.dp),
            color = color,
            trackColor = Color(0xFF2a2a4a)
        )
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(
        text = text,
        color = Accent,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.5.sp,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
    )
}

@Composable
fun EmotionChips(emotions: List<Emotion>, onEmotionTapped: (Emotion) -> Unit) {
    // HorizontalScrollView equivalent in Compose: Row + horizontalScroll
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        emotions.forEach { emotion ->
            SuggestionChip(
                onClick = { onEmotionTapped(emotion) },
                label = {
                    Text(
                        "${emotion.emoji} ${emotion.name}",
                        color = TextPrimary,
                        fontSize = 13.sp
                    )
                },
                colors = SuggestionChipDefaults.suggestionChipColors(
                    containerColor = CardBg
                ),
                border = SuggestionChipDefaults.suggestionChipBorder(
                    enabled = true,
                    borderColor = Color(0xFF334466)
                )
            )
        }
    }
    Spacer(modifier = Modifier.height(4.dp))
}

@Composable
fun ActionCard(action: Action, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1.3f),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = CardBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize().padding(12.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = action.name,
                color = TextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ---- Tier Picker Dialog ----

@Composable
fun TierPickerDialog(emotion: Emotion, onDismiss: () -> Unit, onTierSelected: (Int) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CardBg,
        title = {
            Text(
                "${emotion.emoji} ${emotion.name}",
                color = TextPrimary,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                Text("How intense is this feeling?", color = TextMuted, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(16.dp))
                // Tier buttons 1-5
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    (1..5).forEach { tier ->
                        val stars = "★".repeat(tier)
                        Button(
                            onClick = { onTierSelected(tier) },
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(4.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AccentDim)
                        ) {
                            Text(tier.toString(), fontSize = 16.sp, color = Accent)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text("1 = mild  ·  5 = intense", color = TextMuted, fontSize = 12.sp,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextMuted)
            }
        }
    )
}
