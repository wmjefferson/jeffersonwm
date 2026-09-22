package com.jeffersonwm.battalion

// ============================================================
//  ShortcutWidgetConfigActivity.kt
//
//  Configuration screen shown when a user adds or reconfigures
//  a Battalion Shortcut Widget (1x1) on their home screen.
//  - Allows choosing ANY Action or ANY Emotion.
//  - Allows choosing a custom Button Color.
//  - Beautiful background art with battvert03.
// ============================================================

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class WidgetColorOption(
    val name: String,
    val hex: String,
    val color: Color
)

val WIDGET_COLOR_OPTIONS = listOf(
    WidgetColorOption("Midnight", "#16213E", Color(0xFF16213E)),
    WidgetColorOption("Emerald", "#14452F", Color(0xFF14452F)),
    WidgetColorOption("Crimson", "#5C1D24", Color(0xFF5C1D24)),
    WidgetColorOption("Gold", "#5C4314", Color(0xFF5C4314)),
    WidgetColorOption("Amethyst", "#3B1E54", Color(0xFF3B1E54)),
    WidgetColorOption("Slate", "#1E222A", Color(0xFF1E222A)),
    WidgetColorOption("Cyan", "#0D4E56", Color(0xFF0D4E56)),
    WidgetColorOption("Wine", "#4A1525", Color(0xFF4A1525))
)

class ShortcutWidgetConfigActivity : ComponentActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set default result to CANCELED so if user cancels, widget isn't placed
        setResult(Activity.RESULT_CANCELED)

        // Find the widget id from the intent
        val extras = intent.extras
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
        }
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            appWidgetId = intent.getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
        }

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val prefs = getSharedPreferences(PREFS_SHORTCUT, Context.MODE_PRIVATE)
        val currentName = prefs.getString("name_$appWidgetId", null)
        val currentIcon = prefs.getString("icon_$appWidgetId", null)
        val currentColor = prefs.getString("color_$appWidgetId", "#16213E") ?: "#16213E"

        setContent {
            ShortcutConfigScreen(
                currentName = currentName,
                currentIcon = currentIcon,
                currentColor = currentColor,
                onActionSelected = { action, color ->
                    saveAndFinish(
                        type = "action",
                        id = action.actionId,
                        name = action.name,
                        category = action.category,
                        icon = getActionIcon(action),
                        badge = getActionBadge(action),
                        color = color
                    )
                },
                onEmotionSelected = { emotion, color ->
                    saveAndFinish(
                        type = "emotion",
                        id = emotion.name,
                        name = emotion.name,
                        category = emotion.categoryId,
                        icon = getEmotionIcon(emotion),
                        badge = formatCategory(emotion.categoryId),
                        color = color
                    )
                },
                onSaveColorOnly = { color ->
                    saveColorOnly(color)
                },
                onCancel = { finish() }
            )
        }
    }

    private fun saveColorOnly(color: String) {
        val prefs = getSharedPreferences(PREFS_SHORTCUT, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("color_$appWidgetId", color)
            .apply()

        // Push widget update
        val appWidgetManager = AppWidgetManager.getInstance(this)
        updateShortcutWidget(this, appWidgetManager, appWidgetId)

        val resultValue = Intent().apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        setResult(Activity.RESULT_OK, resultValue)
        finish()
    }

    private fun saveAndFinish(
        type: String,
        id: String,
        name: String,
        category: String,
        icon: String,
        badge: String,
        color: String
    ) {
        val prefs = getSharedPreferences(PREFS_SHORTCUT, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("type_$appWidgetId", type)
            .putString("id_$appWidgetId", id)
            .putString("name_$appWidgetId", name)
            .putString("category_$appWidgetId", category)
            .putString("icon_$appWidgetId", icon)
            .putString("badge_$appWidgetId", badge)
            .putString("color_$appWidgetId", color)
            .apply()

        // Push widget update
        val appWidgetManager = AppWidgetManager.getInstance(this)
        updateShortcutWidget(this, appWidgetManager, appWidgetId)

        // Return RESULT_OK with widget ID
        val resultValue = Intent().apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        setResult(Activity.RESULT_OK, resultValue)
        finish()
    }
}

@Composable
fun ShortcutConfigScreen(
    currentName: String?,
    currentIcon: String?,
    currentColor: String,
    onActionSelected: (Action, String) -> Unit,
    onEmotionSelected: (Emotion, String) -> Unit,
    onSaveColorOnly: (String) -> Unit,
    onCancel: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current

    val appPrefs = remember { context.getSharedPreferences("battalion_app_prefs", Context.MODE_PRIVATE) }
    val favoriteActionIds = remember {
        appPrefs.getStringSet("action_favorites", emptySet())?.toSet() ?: emptySet()
    }

    var selectedColorHex by remember { mutableStateOf(currentColor) }
    var selectedTab by remember { mutableStateOf(0) } // 0 = Actions, 1 = Emotions
    var actions by remember { mutableStateOf<List<Action>>(emptyList()) }
    var emotions by remember { mutableStateOf<List<Emotion>>(emptyList()) }
    var categories by remember { mutableStateOf<List<EmotionCategory>>(emptyList()) }
    var selectedCategory by remember { mutableStateOf("all") }
    var searchQuery by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }

    val activeColorOption = remember(selectedColorHex) {
        WIDGET_COLOR_OPTIONS.find { it.hex.equals(selectedColorHex, ignoreCase = true) }
            ?: WIDGET_COLOR_OPTIONS.first()
    }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            val actionList = withContext(Dispatchers.IO) { ApiClient.fetchActions() }
            val emotionList = withContext(Dispatchers.IO) { ApiClient.fetchEmotions() }
            val catList = withContext(Dispatchers.IO) { ApiClient.fetchEmotionCategories() }

            actionList.onSuccess { actions = it }
            emotionList.onSuccess { emotions = it }
            catList.onSuccess { categories = it }
            isLoading = false
        }
    }

    // Category options depending on tab: includes "favorites" right after "all" for actions
    val availableCategories = remember(selectedTab, actions, categories) {
        if (selectedTab == 0) {
            val otherCats = actions.map { it.category }.filter { it.isNotBlank() }.distinct().sorted()
            listOf("all", "favorites") + otherCats
        } else {
            listOf("all") + categories.map { it.categoryId }.distinct().sorted()
        }
    }

    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        // Background art: battvert03
        Image(
            painter = painterResource(id = R.drawable.battvert03),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        // Dark gradient scrim overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xE60A0E1A),
                            Color(0xD00F172A),
                            Color(0xF20A0E1A)
                        )
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    if (currentName != null) "Change Widget Shortcut" else "Assign Shortcut Widget",
                    color = Accent,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = onCancel) {
                    Text("Cancel", color = TextMuted)
                }
            }

            // If widget was already assigned, show current selection with quick Save Color
            if (currentName != null) {
                Spacer(modifier = Modifier.height(6.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1B2C4E)),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(currentIcon ?: "⚔", fontSize = 20.sp, modifier = Modifier.padding(end = 8.dp))
                            Column {
                                Text("Current Assignment", color = TextMuted, fontSize = 11.sp)
                                Text(currentName, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Button(
                            onClick = { onSaveColorOnly(selectedColorHex) },
                            colors = ButtonDefaults.buttonColors(containerColor = activeColorOption.color),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.border(1.dp, Color.White.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        ) {
                            Text("Save Color", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Button Color Selector
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "BUTTON COLOR",
                    color = Accent,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Text(
                    activeColorOption.name,
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                for (option in WIDGET_COLOR_OPTIONS) {
                    val isSelected = option.hex.equals(selectedColorHex, ignoreCase = true)
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clickable { selectedColorHex = option.hex }
                            .padding(vertical = 2.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .background(option.color, shape = CircleShape)
                                .border(
                                    width = if (isSelected) 2.5.dp else 1.dp,
                                    color = if (isSelected) Color.White else Color(0x604FC3F7),
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (isSelected) {
                                Text("✓", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = option.name,
                            color = if (isSelected) Color.White else TextMuted,
                            fontSize = 9.5.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Tab Row: Actions vs Emotions
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = CardBg,
                contentColor = Accent
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = {
                        selectedTab = 0
                        selectedCategory = "all"
                    },
                    text = { Text("⚔ Actions (${actions.size})", fontWeight = FontWeight.Bold) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = {
                        selectedTab = 1
                        selectedCategory = "all"
                    },
                    text = { Text("💭 Emotions (${emotions.size})", fontWeight = FontWeight.Bold) }
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = {
                    Text(
                        if (selectedTab == 0) "Search actions..." else "Search emotions...",
                        color = TextMuted
                    )
                },
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
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Category Chips (Horizontal Scroll)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                for (cat in availableCategories) {
                    val isSelected = cat == selectedCategory
                    val chipLabel = when {
                        cat == "all" -> "All"
                        cat == "favorites" -> "⭐ Favorites (${actions.count { favoriteActionIds.contains(it.actionId) }})"
                        selectedTab == 0 -> formatCategory(cat)
                        else -> formatCategory(cat)
                    }
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedCategory = cat },
                        label = {
                            Text(
                                chipLabel,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) Color(0xFF0F172A) else TextPrimary
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = if (cat == "favorites") Color(0xFF2ECC71) else Accent,
                            containerColor = CardBg
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            borderColor = if (isSelected) Color.Transparent else Color(0xFF334466),
                            enabled = true,
                            selected = isSelected
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // List of items
            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Accent)
                }
            } else if (selectedTab == 0) {
                // Action list
                val filteredActions = actions.filter { action ->
                    val matchesCategory = when (selectedCategory) {
                        "all" -> true
                        "favorites" -> favoriteActionIds.contains(action.actionId)
                        else -> action.category.equals(selectedCategory, ignoreCase = true)
                    }
                    val matchesSearch = searchQuery.isBlank() ||
                        action.name.contains(searchQuery, ignoreCase = true) ||
                        action.category.contains(searchQuery, ignoreCase = true)
                    matchesCategory && matchesSearch
                }

                if (filteredActions.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            if (selectedCategory == "favorites") "No favorites yet!\nHold-press actions in app to favorite"
                            else "No matching actions found",
                            color = TextMuted,
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filteredActions, key = { it.actionId }) { action ->
                            Card(
                                onClick = { onActionSelected(action, selectedColorHex) },
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = CardBg),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(getActionIcon(action), fontSize = 24.sp)
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = action.name,
                                            color = TextPrimary,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        val badge = getActionBadge(action)
                                        if (badge.isNotBlank()) {
                                            Text(
                                                text = badge,
                                                color = TextMuted,
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                    Text("Assign", color = Accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            } else {
                // Emotion list
                val filteredEmotions = emotions.filter { emotion ->
                    val matchesCategory = selectedCategory == "all" || emotion.categoryId == selectedCategory
                    val matchesSearch = searchQuery.isBlank() || emotion.name.contains(searchQuery, ignoreCase = true)
                    matchesCategory && matchesSearch
                }

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredEmotions, key = { it.name + "_" + it.categoryId }) { emotion ->
                        Card(
                            onClick = { onEmotionSelected(emotion, selectedColorHex) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = CardBg),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(getEmotionIcon(emotion), fontSize = 24.sp)
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = emotion.name,
                                        color = TextPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Text(
                                        text = formatCategory(emotion.categoryId),
                                        color = TextMuted,
                                        fontSize = 11.sp
                                    )
                                }
                                Text("Assign", color = Accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

fun getActionIcon(action: Action): String {
    val name = action.name.lowercase()
    val cat = action.category.lowercase()
    return when {
        "water" in name || "drink" in name -> "💧"
        "bed" in name || "sleep" in name -> "🛏"
        "walk" in name || "run" in name || "fitness" in cat -> "🚶"
        "bath" in name || "shower" in name || "hygiene" in cat -> "🚿"
        "food" in name || "cook" in name || "meal" in name || "eat" in name -> "🍳"
        "teeth" in name || "brush" in name -> "🪥"
        "code" in name || "study" in name || "work" in name -> "💻"
        "clean" in name || "chore" in name -> "🧹"
        "money" in name || "finance" in cat -> "💰"
        else -> "⚔"
    }
}

fun getActionBadge(action: Action): String {
    val deltas = mutableListOf<String>()
    if (action.energyDelta != 0) deltas.add("⚡${if (action.energyDelta > 0) "+" else ""}${action.energyDelta}")
    if (action.healthDelta != 0) deltas.add("❤${if (action.healthDelta > 0) "+" else ""}${action.healthDelta}")
    if (action.stressDelta != 0) deltas.add("😰${if (action.stressDelta > 0) "+" else ""}${action.stressDelta}")
    return if (deltas.isNotEmpty()) deltas.joinToString("  ") else formatCategory(action.category)
}

fun getEmotionIcon(emotion: Emotion): String {
    val cat = emotion.categoryId.lowercase()
    return when {
        "joy" in cat || "alive" in cat -> "😄"
        "open" in cat || "accept" in cat -> "😌"
        "angry" in cat || "annoy" in cat -> "😤"
        "sad" in cat || "despair" in cat -> "😢"
        "fear" in cat || "stress" in cat -> "😰"
        "grateful" in cat || "hopeful" in cat -> "🙏"
        "tender" in cat || "loving" in cat -> "❤️"
        else -> "💭"
    }
}
