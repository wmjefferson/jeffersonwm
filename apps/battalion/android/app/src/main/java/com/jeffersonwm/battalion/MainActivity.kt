package com.jeffersonwm.battalion

// ============================================================
//  MainActivity.kt
//
//  The main screen of the app. Three sections:
//  1. Stats header: Level, HP bar, XP bar, Gold, Mood
//  2. Emotion categories & emotions: tap category to expand,
//     tap emotion to immediately log
//  3. Actions: horizontal scroll categories, search bar,
//     and masonry vertical scroll grid (LazyVerticalStaggeredGrid)
// ============================================================

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.Image
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// --- Color palette ---
val BgDark = Color(0xFF1a1a2e)
val BgMid = Color(0xFF16213e)
val Accent = Color(0xFF4fc3f7)
val CardBg = Color(0xFF1e2a4a)
val TextPrimary = Color(0xFFe8eaf6)
val TextMuted = Color(0xFF90a4ae)
val HpColor = Color(0xFF66bb6a)
val XpColor = Color(0xFF4fc3f7)
val GoldColor = Color(0xFFffd54f)

// --- In-App Game Notice Banner Model ---
data class InAppNotice(
    val title: String,
    val subtitle: String,
    val icon: String,
    val accentColor: Color,
    val timestamp: Long = System.currentTimeMillis()
)

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
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val prefs = remember { context.getSharedPreferences("battalion_app_prefs", Context.MODE_PRIVATE) }

    // State: mutableStateOf triggers UI recomposition when value changes
    var player by remember { mutableStateOf(PlayerState()) }
    var categories by remember { mutableStateOf<List<EmotionCategory>>(emptyList()) }
    var emotions by remember { mutableStateOf<List<Emotion>>(emptyList()) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var actions by remember { mutableStateOf<List<Action>>(emptyList()) }
    var selectedActionCategory by remember { mutableStateOf("all") }
    var searchQuery by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }

    // Favorites persisted in SharedPreferences
    var favoriteActionIds by remember {
        mutableStateOf(prefs.getStringSet("action_favorites", emptySet())?.toSet() ?: emptySet())
    }

    // In-app game confirmation notice
    var activeNotice by remember { mutableStateOf<InAppNotice?>(null) }
    var showAccountDialog by remember { mutableStateOf(false) }

    // Auto-dismiss in-app popup after 2.5 seconds
    LaunchedEffect(activeNotice?.timestamp) {
        if (activeNotice != null) {
            delay(2500)
            activeNotice = null
        }
    }

    fun toggleFavorite(action: Action) {
        val isFav = favoriteActionIds.contains(action.actionId)
        val newFavorites = if (isFav) {
            favoriteActionIds - action.actionId
        } else {
            favoriteActionIds + action.actionId
        }
        favoriteActionIds = newFavorites
        prefs.edit().putStringSet("action_favorites", newFavorites).apply()

        if (!isFav) {
            activeNotice = InAppNotice(
                title = "Added to Favorites!",
                subtitle = action.name,
                icon = "⭐",
                accentColor = Color(0xFF2ECC71)
            )
        } else {
            activeNotice = InAppNotice(
                title = "Removed from Favorites",
                subtitle = action.name,
                icon = "⭐",
                accentColor = Color(0xFF90A4AE)
            )
        }
    }

    // Helper to refresh dashboard stats
    fun refreshStats() {
        coroutineScope.launch {
            val result = withContext(Dispatchers.IO) { ApiClient.fetchDashboard() }
            result.onSuccess { player = it.player }
        }
    }

    // Load initial data in parallel
    LaunchedEffect(Unit) {
        coroutineScope.launch {
            val dashboard = withContext(Dispatchers.IO) { ApiClient.fetchDashboard() }
            val catList = withContext(Dispatchers.IO) { ApiClient.fetchEmotionCategories() }
            val emotionList = withContext(Dispatchers.IO) { ApiClient.fetchEmotions() }
            val actionList = withContext(Dispatchers.IO) { ApiClient.fetchActions() }

            dashboard.onSuccess { player = it.player }
            catList.onSuccess {
                categories = it
                if (selectedCategory == null && it.isNotEmpty()) {
                    selectedCategory = it.first().categoryId
                }
            }
            emotionList.onSuccess { emotions = it }
            actionList.onSuccess { actions = it }
            isLoading = false
        }
    }

    // Extract distinct action categories with "all" in front, then "favorites" immediately to the right
    val actionCategories = remember(actions) {
        val otherCats = actions.map { it.category }.filter { it.isNotBlank() }.distinct().sorted()
        listOf("all", "favorites") + otherCats
    }

    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        // App background artwork: battvert03
        Image(
            painter = painterResource(id = R.drawable.battvert03),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        // Dark gradient scrim overlay for high contrast and readability
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xE60A0E1A), // ~90% dark navy at top
                            Color(0xCC0F172A), // ~80% dark slate in middle
                            Color(0xF00A0E1A)  // ~94% dark navy at bottom
                        )
                    )
                )
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            // ---- Stats Header ----
            StatsHeader(
                player = player,
                onLogoutClick = { showAccountDialog = true }
            )

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Accent)
                }
                return@Column
            }

            // ---- Emotion Section ----
            SectionLabel("HOW ARE YOU FEELING?")

            // Category selector chips (horizontal scroll)
            EmotionCategoryChips(
                categories = categories,
                selectedCategory = selectedCategory,
                onCategorySelected = { catId ->
                    selectedCategory = if (selectedCategory == catId) null else catId
                }
            )

            // Expanded emotions in selected category
            if (selectedCategory != null) {
                val categoryEmotions = emotions.filter { it.categoryId == selectedCategory }
                if (categoryEmotions.isNotEmpty()) {
                    EmotionItemsRow(
                        emotions = categoryEmotions,
                        onEmotionSelected = { emotion ->
                            coroutineScope.launch {
                                val result = withContext(Dispatchers.IO) {
                                    ApiClient.logEmotion(emotion.name, emotion.categoryId, context = context)
                                }
                                result.fold(
                                    onSuccess = {
                                        activeNotice = InAppNotice(
                                            title = "Feeling Logged",
                                            subtitle = emotion.name,
                                            icon = "💭",
                                            accentColor = Accent
                                        )
                                        refreshStats()
                                    },
                                    onFailure = { err ->
                                        activeNotice = InAppNotice(
                                            title = "Log Failed",
                                            subtitle = err.message ?: "Could not log emotion",
                                            icon = "⚠️",
                                            accentColor = Color(0xFFE57373)
                                        )
                                    }
                                )
                            }
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // ---- Action Section ----
            SectionLabel("WHAT DID YOU DO?")

            // Action category chips (horizontal scroll)
            ActionCategoryChips(
                categories = actionCategories,
                selectedCategory = selectedActionCategory,
                onCategorySelected = { cat ->
                    selectedActionCategory = cat
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Search bar: singleLine = true and ImeAction.Search closes keyboard without newline
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search actions...", color = TextMuted) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Search
                ),
                keyboardActions = KeyboardActions(
                    onSearch = {
                        focusManager.clearFocus()
                        keyboardController?.hide()
                    }
                ),
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

            // Filter actions by category and search query
            val filteredActions = remember(actions, selectedActionCategory, searchQuery, favoriteActionIds) {
                actions.filter { action ->
                    val matchesCategory = when (selectedActionCategory) {
                        "all" -> true
                        "favorites" -> favoriteActionIds.contains(action.actionId)
                        else -> action.category == selectedActionCategory
                    }
                    val matchesSearch = searchQuery.isBlank() || action.name.contains(searchQuery, ignoreCase = true)
                    matchesCategory && matchesSearch
                }
            }

            if (filteredActions.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    val emptyMsg = when {
                        selectedActionCategory == "favorites" && favoriteActionIds.isEmpty() ->
                            "No favorites yet.\nHold-press any action card to favorite it!"
                        searchQuery.isNotBlank() ->
                            "No actions matching \"$searchQuery\""
                        else ->
                            "No actions in this category"
                    }
                    Text(
                        text = emptyMsg,
                        color = TextMuted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp
                    )
                }
            } else {
                // Masonry vertical scroll grid
                LazyVerticalStaggeredGrid(
                    columns = StaggeredGridCells.Fixed(2),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalItemSpacing = 10.dp,
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredActions, key = { it.actionId }) { action ->
                        ActionCard(
                            action = action,
                            isFavorite = favoriteActionIds.contains(action.actionId),
                            onClick = {
                                coroutineScope.launch {
                                    val result = withContext(Dispatchers.IO) { ApiClient.performAction(action.actionId, context) }
                                    result.fold(
                                        onSuccess = { perf ->
                                            val rewardText = if (perf.xpEarned > 0 || perf.goldEarned > 0)
                                                "+${perf.xpEarned} XP   +${perf.goldEarned} Gold"
                                            else "Action logged"
                                            activeNotice = InAppNotice(
                                                title = action.name,
                                                subtitle = rewardText,
                                                icon = "⚔️",
                                                accentColor = GoldColor
                                            )
                                            refreshStats()
                                        },
                                        onFailure = { err ->
                                            activeNotice = InAppNotice(
                                                title = "Action Failed",
                                                subtitle = err.message ?: "Failed to perform action",
                                                icon = "⚠️",
                                                accentColor = Color(0xFFE57373)
                                            )
                                        }
                                    )
                                }
                            },
                            onLongClick = {
                                toggleFavorite(action)
                            }
                        )
                    }
                }
            }
        }

        // In-App Notification HUD Banner (Game Popup)
        AnimatedVisibility(
            visible = activeNotice != null,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 20.dp, start = 20.dp, end = 20.dp)
        ) {
            activeNotice?.let { notice ->
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFA121A2F)
                    ),
                    border = BorderStroke(1.5.dp, notice.accentColor),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { activeNotice = null }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = notice.icon,
                            fontSize = 24.sp,
                            modifier = Modifier.padding(end = 12.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = notice.title,
                                color = notice.accentColor,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = notice.subtitle,
                                color = TextPrimary,
                                fontSize = 12.sp
                            )
                        }
                        Text(
                            text = "✕",
                            color = TextMuted,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(start = 8.dp)
                        )
                    }
                }
            }
        }

        // Account & Session Dialog
        if (showAccountDialog) {
            val savedUsername = ApiClient.getSavedUsername(context) ?: "Player"
            AlertDialog(
                onDismissRequest = { showAccountDialog = false },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("⚔", fontSize = 22.sp, modifier = Modifier.padding(end = 8.dp))
                        Text("Account & Session", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    }
                },
                text = {
                    Column {
                        Text("Logged in as:", color = TextMuted, fontSize = 13.sp)
                        Text(savedUsername, color = Accent, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "If you encounter authentication errors, tap Refresh to renew your session credentials, or Log Out to return to the login screen.",
                            color = TextMuted,
                            fontSize = 13.sp,
                            lineHeight = 18.sp
                        )
                    }
                },
                confirmButton = {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        // Refresh Session button
                        OutlinedButton(
                            onClick = {
                                showAccountDialog = false
                                coroutineScope.launch {
                                    val success = withContext(Dispatchers.IO) {
                                        ApiClient.reAuthIfNeeded(context)
                                    }
                                    if (success) {
                                        refreshStats()
                                        activeNotice = InAppNotice(
                                            title = "Session Refreshed",
                                            subtitle = "Connected as $savedUsername",
                                            icon = "🔄",
                                            accentColor = Accent
                                        )
                                    } else {
                                        activeNotice = InAppNotice(
                                            title = "Refresh Failed",
                                            subtitle = "Please log out and log back in",
                                            icon = "⚠️",
                                            accentColor = Color(0xFFE57373)
                                        )
                                    }
                                }
                            },
                            border = BorderStroke(1.dp, Accent),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Refresh", color = Accent, fontSize = 13.sp)
                        }

                        // Log Out button
                        Button(
                            onClick = {
                                showAccountDialog = false
                                ApiClient.logout(context)
                                val intent = Intent(context, LoginActivity::class.java).apply {
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                                }
                                context.startActivity(intent)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F)),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Log Out", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAccountDialog = false }) {
                        Text("Cancel", color = TextMuted)
                    }
                },
                containerColor = Color(0xFF16213E),
                shape = RoundedCornerShape(16.dp)
            )
        }
    }
}

// ---- Sub-composables ----

fun formatCategory(cat: String): String {
    if (cat.equals("all", ignoreCase = true)) return "All"
    if (cat.equals("favorites", ignoreCase = true)) return "⭐ Favorites"
    return cat.split('_')
        .joinToString(" ") { word ->
            word.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
        }
}

@Composable
fun StatsHeader(player: PlayerState, onLogoutClick: () -> Unit) {
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
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("Lv.${player.level} ${player.title}", color = TextMuted, fontSize = 13.sp)
                IconButton(
                    onClick = onLogoutClick,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ExitToApp,
                        contentDescription = "Account & Logout",
                        tint = TextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
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
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
    )
}

@Composable
fun EmotionCategoryChips(
    categories: List<EmotionCategory>,
    selectedCategory: String?,
    onCategorySelected: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        categories.forEach { cat ->
            val isSelected = cat.categoryId == selectedCategory
            FilterChip(
                selected = isSelected,
                onClick = { onCategorySelected(cat.categoryId) },
                label = {
                    val labelText = cat.label.ifBlank {
                        formatCategory(cat.categoryId)
                    }
                    Text(
                        text = labelText,
                        fontSize = 13.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    containerColor = CardBg,
                    labelColor = TextMuted,
                    selectedContainerColor = Accent,
                    selectedLabelColor = Color(0xFF1a1a2e)
                ),
                border = FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = isSelected,
                    borderColor = if (isSelected) Accent else Color(0xFF334466)
                )
            )
        }
    }
}

@Composable
fun EmotionItemsRow(
    emotions: List<Emotion>,
    onEmotionSelected: (Emotion) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        emotions.forEach { emotion ->
            SuggestionChip(
                onClick = { onEmotionSelected(emotion) },
                label = {
                    Text(
                        text = emotion.name,
                        color = TextPrimary,
                        fontSize = 12.sp
                    )
                },
                colors = SuggestionChipDefaults.suggestionChipColors(
                    containerColor = Color(0xFF253355)
                ),
                border = SuggestionChipDefaults.suggestionChipBorder(
                    enabled = true,
                    borderColor = Color(0xFF4a5d88)
                )
            )
        }
    }
}

@Composable
fun ActionCategoryChips(
    categories: List<String>,
    selectedCategory: String,
    onCategorySelected: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        categories.forEach { cat ->
            val isSelected = cat == selectedCategory
            FilterChip(
                selected = isSelected,
                onClick = { onCategorySelected(cat) },
                label = {
                    Text(
                        text = formatCategory(cat),
                        fontSize = 13.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    containerColor = CardBg,
                    labelColor = TextMuted,
                    selectedContainerColor = Accent,
                    selectedLabelColor = Color(0xFF1a1a2e)
                ),
                border = FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = isSelected,
                    borderColor = if (isSelected) Accent else Color(0xFF334466)
                )
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ActionCard(
    action: Action,
    isFavorite: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    // Quick fade: turns emerald green when favorited, fades back to CardBg (blue/navy) when unfavorited
    val targetBg = if (isFavorite) Color(0xFF14452F) else CardBg
    val targetBorder = if (isFavorite) Color(0xFF2ECC71) else Color.Transparent

    val animatedBg by animateColorAsState(
        targetValue = targetBg,
        animationSpec = tween(durationMillis = 250),
        label = "actionCardBg"
    )
    val animatedBorder by animateColorAsState(
        targetValue = targetBorder,
        animationSpec = tween(durationMillis = 250),
        label = "actionCardBorder"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (isFavorite) 1.5.dp else 0.dp,
                color = animatedBorder,
                shape = RoundedCornerShape(12.dp)
            )
            .clip(RoundedCornerShape(12.dp))
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = animatedBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                if (isFavorite) {
                    Text("⭐ ", fontSize = 12.sp)
                }
                Text(
                    text = action.name,
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center
                )
            }

            // Show stat impact badges if present
            val deltas = mutableListOf<String>()
            if (action.energyDelta != 0) deltas.add("⚡${if (action.energyDelta > 0) "+" else ""}${action.energyDelta}")
            if (action.healthDelta != 0) deltas.add("❤${if (action.healthDelta > 0) "+" else ""}${action.healthDelta}")
            if (action.stressDelta != 0) deltas.add("😰${if (action.stressDelta > 0) "+" else ""}${action.stressDelta}")

            if (deltas.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = deltas.joinToString("  "),
                    color = TextMuted,
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
