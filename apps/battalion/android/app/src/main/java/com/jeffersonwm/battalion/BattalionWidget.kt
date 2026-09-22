package com.jeffersonwm.battalion

// ============================================================
//  BattalionWidget.kt
//
//  Stats home screen widget (3x1 expandable to 4x1, 5x1, 3x2, 4x2, 5x2).
//  - Supports explicit display modes in Settings:
//    - HP Only
//    - XP Only
//    - Health Only
//    - All Three (HP, XP & Health)
//    - Auto (1-row shows chosen stat, 2-row shows all three)
//  - Tapping ⚙ opens Settings directly.
//  - Tapping stat area cycles HP -> XP -> Health.
// ============================================================

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.widget.RemoteViews
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

const val ACTION_CYCLE_STAT = "com.jeffersonwm.battalion.CYCLE_STAT"
const val EXTRA_WIDGET_ID = "extra_widget_id"

class BattalionWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateStatsWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateStatsWidget(context, appWidgetManager, appWidgetId, newOptions)
    }

    override fun onEnabled(context: Context) {
        scheduleRefreshAlarm(context)
    }

    override fun onDisabled(context: Context) {
        cancelRefreshAlarm(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_CYCLE_STAT -> {
                val appWidgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    val prefs = context.getSharedPreferences("battalion_widget_prefs", Context.MODE_PRIVATE)
                    val currentMode = prefs.getString("display_mode_$appWidgetId", null)
                    val currentStat = if (currentMode in listOf("hp", "xp", "health")) currentMode
                        else prefs.getString("stat_pref_$appWidgetId", "hp") ?: "hp"
                    val nextStat = when (currentStat) {
                        "hp" -> "xp"
                        "xp" -> "health"
                        else -> "hp"
                    }
                    prefs.edit()
                        .putString("display_mode_$appWidgetId", nextStat)
                        .putString("stat_pref_$appWidgetId", nextStat)
                        .apply()

                    val statDisplayName = when (nextStat) {
                        "hp" -> "HP"
                        "xp" -> "XP"
                        "health" -> "Health"
                        else -> "HP"
                    }
                    Toast.makeText(context, "Showing $statDisplayName", Toast.LENGTH_SHORT).show()

                    val manager = AppWidgetManager.getInstance(context)
                    updateStatsWidget(context, manager, appWidgetId)
                }
            }

            AppWidgetManager.ACTION_APPWIDGET_UPDATE -> {
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(ComponentName(context, BattalionWidget::class.java))
                for (id in ids) {
                    updateStatsWidget(context, manager, id)
                }
            }
        }
    }
}

// ---- Update stats widget instance ----

fun updateStatsWidget(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    optionsBundle: Bundle? = null
) {
    CoroutineScope(Dispatchers.IO).launch {
        val result = ApiClient.fetchDashboard()
        val player = result.getOrDefault(DashboardResponse()).player

        val prefs = context.getSharedPreferences("battalion_widget_prefs", Context.MODE_PRIVATE)
        val displayMode = prefs.getString("display_mode_$appWidgetId", "auto") ?: "auto"
        val statPref = prefs.getString("stat_pref_$appWidgetId", "hp") ?: "hp"

        val options = optionsBundle ?: appWidgetManager.getAppWidgetOptions(appWidgetId)
        val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 50)
        val rowSpan = options.getInt("semAppWidgetRowSpan", 0)

        // Samsung One UI rowSpan: 1 row = rowSpan 1, minHeight ~104dp; 2 rows = rowSpan 2, minHeight ~210dp.
        // On standard launchers: 1 row is ~40-80dp, 2 rows is >=120dp.
        val is2RowBySize = if (rowSpan > 0) rowSpan >= 2 else minHeight >= 140

        val showAllThree = when (displayMode) {
            "all_three" -> true
            "hp", "xp", "health" -> false
            else -> is2RowBySize // "auto"
        }

        val openAppIntent = Intent(context, MainActivity::class.java)
        val openAppPending = PendingIntent.getActivity(
            context, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Settings intent for the ⚙ button
        val configIntent = Intent(context, StatsWidgetConfigActivity::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val configPending = PendingIntent.getActivity(
            context,
            appWidgetId + 20000,
            configIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val views: RemoteViews

        if (showAllThree) {
            // ---- 2-Row Mode: Show all 3 stats (HP, XP, Health) ----
            views = RemoteViews(context.packageName, R.layout.widget_stats_2row)

            views.setTextViewText(R.id.widget_2row_title, "⚔ Lv.${player.level} ${player.title}")
            views.setTextViewText(R.id.widget_2row_gold, "💰 ${player.gold}g")
            views.setTextViewText(R.id.widget_2row_mood, "${moodEmoji(player.currentMood)} ${player.currentMood}")

            // HP
            val hpMax = if (player.maxHp > 0) player.maxHp else 100
            views.setTextViewText(R.id.widget_2row_hp_text, "HP ${player.hp}/$hpMax")
            views.setProgressBar(R.id.widget_2row_hp_bar, hpMax, player.hp, false)

            // XP
            val xpMax = if (player.xpToNext > 0) player.xpToNext else 500
            views.setTextViewText(R.id.widget_2row_xp_text, "XP ${player.xp}/$xpMax")
            views.setProgressBar(R.id.widget_2row_xp_bar, xpMax, player.xp, false)

            // Health
            val healthMax = if (player.healthXpToNext > 0) player.healthXpToNext else 100
            views.setTextViewText(R.id.widget_2row_health_text, "Health Lv.${player.healthLevel} ${player.healthXp}/$healthMax")
            views.setProgressBar(R.id.widget_2row_health_bar, healthMax, player.healthXp, false)

            views.setOnClickPendingIntent(R.id.widget_2row_settings, configPending)
            views.setOnClickPendingIntent(R.id.widget_2row_root, openAppPending)

        } else {
            // ---- 1-Row Mode: Show single chosen stat (HP, XP, or Health) ----
            views = RemoteViews(context.packageName, R.layout.widget_stats_1row)

            views.setTextViewText(R.id.widget_1row_title, "⚔ Lv.${player.level} ${player.title}")
            views.setTextViewText(R.id.widget_1row_gold, "💰 ${player.gold}g")

            // Active stat: if displayMode is specifically hp/xp/health, use that; otherwise use statPref
            val activeStat = if (displayMode in listOf("hp", "xp", "health")) displayMode else statPref

            when (activeStat) {
                "xp" -> {
                    views.setTextViewText(R.id.widget_1row_stat_badge, "[XP ⟳]")
                    val xpMax = if (player.xpToNext > 0) player.xpToNext else 500
                    views.setTextViewText(R.id.widget_1row_stat_label, "XP ${player.xp}/$xpMax")
                    views.setProgressBar(R.id.widget_1row_progress_bar, xpMax, player.xp, false)
                }
                "health" -> {
                    views.setTextViewText(R.id.widget_1row_stat_badge, "[Health ⟳]")
                    val healthMax = if (player.healthXpToNext > 0) player.healthXpToNext else 100
                    views.setTextViewText(R.id.widget_1row_stat_label, "Health Lv.${player.healthLevel} ${player.healthXp}/$healthMax")
                    views.setProgressBar(R.id.widget_1row_progress_bar, healthMax, player.healthXp, false)
                }
                else -> { // "hp" default
                    views.setTextViewText(R.id.widget_1row_stat_badge, "[HP ⟳]")
                    val hpMax = if (player.maxHp > 0) player.maxHp else 100
                    views.setTextViewText(R.id.widget_1row_stat_label, "HP ${player.hp}/$hpMax")
                    views.setProgressBar(R.id.widget_1row_progress_bar, hpMax, player.hp, false)
                }
            }

            // Tapping anywhere on the 1-row widget cycles stat: HP -> XP -> Health
            val cycleIntent = Intent(context, BattalionWidget::class.java).apply {
                action = ACTION_CYCLE_STAT
                putExtra(EXTRA_WIDGET_ID, appWidgetId)
            }
            val cyclePending = PendingIntent.getBroadcast(
                context,
                appWidgetId,
                cycleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_1row_root, cyclePending)
            views.setOnClickPendingIntent(R.id.widget_1row_header, cyclePending)
            views.setOnClickPendingIntent(R.id.widget_1row_title, cyclePending)
            views.setOnClickPendingIntent(R.id.widget_1row_gold, cyclePending)
            views.setOnClickPendingIntent(R.id.widget_1row_stat_badge, cyclePending)
            views.setOnClickPendingIntent(R.id.widget_1row_stat_click_area, cyclePending)
            views.setOnClickPendingIntent(R.id.widget_1row_stat_label, cyclePending)
            views.setOnClickPendingIntent(R.id.widget_1row_progress_bar, cyclePending)

            // Tapping settings ⚙ opens configuration
            views.setOnClickPendingIntent(R.id.widget_1row_settings, configPending)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}

fun refreshAllStatsWidgets(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val ids = manager.getAppWidgetIds(ComponentName(context, BattalionWidget::class.java))
    for (id in ids) {
        updateStatsWidget(context, manager, id)
    }
}

// ---- Refresh alarms ----

fun scheduleRefreshAlarm(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(context, BattalionWidget::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
    }
    val pending = PendingIntent.getBroadcast(
        context, 1001, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val thirtyMinutes = 30 * 60 * 1000L
    alarmManager.setRepeating(
        AlarmManager.ELAPSED_REALTIME,
        SystemClock.elapsedRealtime() + thirtyMinutes,
        thirtyMinutes,
        pending
    )
}

fun cancelRefreshAlarm(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(context, BattalionWidget::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
    }
    val pending = PendingIntent.getBroadcast(
        context, 1001, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    alarmManager.cancel(pending)
}

fun moodEmoji(mood: String): String = when (mood.lowercase()) {
    "terrible"  -> "😭"
    "miserable" -> "😢"
    "bad"       -> "😟"
    "unpleasant"-> "😕"
    "okay"      -> "😐"
    "fine"      -> "🙂"
    "good"      -> "😊"
    "great"     -> "😄"
    "excellent" -> "🤩"
    "fantastic" -> "🥳"
    else        -> "😐"
}
