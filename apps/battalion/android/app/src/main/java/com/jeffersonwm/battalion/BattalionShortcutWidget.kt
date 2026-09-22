package com.jeffersonwm.battalion

// ============================================================
//  BattalionShortcutWidget.kt
//
//  1x1 (or any size) shortcut widget assigned to ANY action or emotion.
//  Tapping it on the home screen immediately performs the action
//  or logs the emotion, shows a Toast, and updates stats.
// ============================================================

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

const val ACTION_TRIGGER_SHORTCUT = "com.jeffersonwm.battalion.TRIGGER_SHORTCUT"
const val PREFS_SHORTCUT = "battalion_shortcut_prefs"

class BattalionShortcutWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateShortcutWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateShortcutWidget(context, appWidgetManager, appWidgetId, newOptions)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences(PREFS_SHORTCUT, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        for (id in appWidgetIds) {
            editor.remove("type_$id")
            editor.remove("id_$id")
            editor.remove("name_$id")
            editor.remove("category_$id")
            editor.remove("icon_$id")
            editor.remove("badge_$id")
            editor.remove("color_$id")
        }
        editor.apply()
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == ACTION_TRIGGER_SHORTCUT) {
            val appWidgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return

            val prefs = context.getSharedPreferences(PREFS_SHORTCUT, Context.MODE_PRIVATE)
            val type = prefs.getString("type_$appWidgetId", null)
            val actionId = prefs.getString("id_$appWidgetId", "") ?: ""
            val name = prefs.getString("name_$appWidgetId", "Item") ?: "Item"
            val category = prefs.getString("category_$appWidgetId", "") ?: ""

            if (type == null) {
                // Not configured: open configuration activity
                val configIntent = Intent(context, ShortcutWidgetConfigActivity::class.java).apply {
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(configIntent)
                return
            }

            // CRITICAL: use goAsync() so Android does not kill or freeze the receiver
            // process before the background network call finishes!
            val pendingResult = goAsync()

            // Immediate touch feedback
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(context, "Executing: $name...", Toast.LENGTH_SHORT).show()
            }

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    ApiClient.reAuthIfNeeded(context)

                    if (type == "action") {
                        val result = ApiClient.performAction(actionId)
                        result.fold(
                            onSuccess = { perf ->
                                val msg = if (perf.xpEarned > 0)
                                    "+${perf.xpEarned} XP  +${perf.goldEarned} Gold ($name)"
                                else "Done: $name"
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                }
                                refreshAllStatsWidgets(context)
                            },
                            onFailure = { err ->
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(context, "Failed: ${err.message}", Toast.LENGTH_LONG).show()
                                }
                            }
                        )
                    } else if (type == "emotion") {
                        val result = ApiClient.logEmotion(name, category)
                        result.fold(
                            onSuccess = {
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(context, "Feeling logged: $name!", Toast.LENGTH_SHORT).show()
                                }
                                refreshAllStatsWidgets(context)
                            },
                            onFailure = { err ->
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(context, "Failed: ${err.message}", Toast.LENGTH_LONG).show()
                                }
                            }
                        )
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }
}

fun updateShortcutWidget(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    optionsBundle: Bundle? = null
) {
    val prefs = context.getSharedPreferences(PREFS_SHORTCUT, Context.MODE_PRIVATE)
    val type = prefs.getString("type_$appWidgetId", null)
    val name = prefs.getString("name_$appWidgetId", null)
    val icon = prefs.getString("icon_$appWidgetId", "⚔") ?: "⚔"
    val badge = prefs.getString("badge_$appWidgetId", "") ?: ""
    val hexColor = prefs.getString("color_$appWidgetId", "#16213E") ?: "#16213E"

    val views = RemoteViews(context.packageName, R.layout.widget_shortcut_layout)

    // Set button color tint overlay on top of batthorz01
    val baseColor = try {
        android.graphics.Color.parseColor(hexColor)
    } catch (e: Exception) {
        android.graphics.Color.parseColor("#16213E")
    }
    val overlayColor = (baseColor and 0x00FFFFFF) or (0xCC shl 24)
    views.setInt(R.id.widget_shortcut_color_overlay, "setBackgroundColor", overlayColor)

    // Calculate dimensions for dynamic text/symbol scaling
    val options = optionsBundle ?: appWidgetManager.getAppWidgetOptions(appWidgetId)
    val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 60)
    val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 60)
    val rowSpan = options.getInt("semAppWidgetRowSpan", 0)
    val colSpan = options.getInt("semAppWidgetColSpan", 0)

    // Determine if widget is 1 row high vs 2+ rows high
    // On Samsung: rowSpan == 1 -> 1x high; rowSpan >= 2 -> 2x+ high
    // Fallback if rowSpan is 0: minHeight < 135 -> 1x high
    val is1xHigh = if (rowSpan > 0) rowSpan == 1 else minHeight < 135

    val isCol1 = if (colSpan > 0) colSpan == 1 else minWidth < 120
    val isCol2 = if (colSpan > 0) colSpan == 2 else minWidth in 120..209
    val isCol3Plus = if (colSpan > 0) colSpan >= 3 else minWidth >= 210

    if (is1xHigh) {
        // Remove emoji for all sizes 1x high (1x1, 2x1, 3x1, 4x1)
        views.setViewVisibility(R.id.widget_shortcut_icon, View.GONE)

        val (nameSizeSp, badgeSizeSp) = when {
            isCol3Plus -> Pair(20f, 13.5f)
            isCol2 -> Pair(17.5f, 12.5f)
            else -> Pair(14.5f, 11f) // 1x1
        }
        views.setTextViewTextSize(R.id.widget_shortcut_name, TypedValue.COMPLEX_UNIT_SP, nameSizeSp)
        views.setTextViewTextSize(R.id.widget_shortcut_badge, TypedValue.COMPLEX_UNIT_SP, badgeSizeSp)
    } else {
        // At 2x high or taller: show emoji and adjust size of text to fit widget as much as possible
        views.setViewVisibility(R.id.widget_shortcut_icon, View.VISIBLE)

        val (iconSizeSp, nameSizeSp, badgeSizeSp) = when {
            isCol3Plus || rowSpan >= 3 || minHeight >= 220 -> {
                Triple(70f, 23f, 15f)
            }
            isCol2 -> { // 2x2
                Triple(54f, 19f, 13.5f)
            }
            else -> { // 1x2
                Triple(38f, 14.5f, 11f)
            }
        }
        views.setTextViewTextSize(R.id.widget_shortcut_icon, TypedValue.COMPLEX_UNIT_SP, iconSizeSp)
        views.setTextViewTextSize(R.id.widget_shortcut_name, TypedValue.COMPLEX_UNIT_SP, nameSizeSp)
        views.setTextViewTextSize(R.id.widget_shortcut_badge, TypedValue.COMPLEX_UNIT_SP, badgeSizeSp)
    }

    if (type == null || name == null) {
        // Not configured yet: prompt user to set up
        views.setTextViewText(R.id.widget_shortcut_icon, "➕")
        views.setTextViewText(R.id.widget_shortcut_name, "Configure")
        views.setTextViewText(R.id.widget_shortcut_badge, "Tap to setup")

        val configIntent = Intent(context, ShortcutWidgetConfigActivity::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val configPending = PendingIntent.getActivity(
            context,
            appWidgetId,
            configIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_shortcut_root, configPending)
        views.setOnClickPendingIntent(R.id.widget_shortcut_icon, configPending)
        views.setOnClickPendingIntent(R.id.widget_shortcut_name, configPending)
        views.setOnClickPendingIntent(R.id.widget_shortcut_badge, configPending)
    } else {
        views.setTextViewText(R.id.widget_shortcut_icon, icon)
        views.setTextViewText(R.id.widget_shortcut_name, name)
        views.setTextViewText(R.id.widget_shortcut_badge, badge.ifBlank { if (type == "action") "Action" else "Emotion" })

        // Launch Android dialog activity indicating which button was pressed and executing the action
        val dialogIntent = Intent(context, ShortcutActionDialogActivity::class.java).apply {
            putExtra("EXTRA_NAME", name)
            putExtra("EXTRA_TYPE", type)
            putExtra("EXTRA_ID", prefs.getString("id_$appWidgetId", "") ?: "")
            putExtra("EXTRA_CATEGORY", prefs.getString("category_$appWidgetId", "") ?: "")
            putExtra("EXTRA_ICON", icon)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val dialogPending = PendingIntent.getActivity(
            context,
            appWidgetId + 30000,
            dialogIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(R.id.widget_shortcut_root, dialogPending)
        views.setOnClickPendingIntent(R.id.widget_shortcut_icon, dialogPending)
        views.setOnClickPendingIntent(R.id.widget_shortcut_name, dialogPending)
        views.setOnClickPendingIntent(R.id.widget_shortcut_badge, dialogPending)
    }

    appWidgetManager.updateAppWidget(appWidgetId, views)
}
