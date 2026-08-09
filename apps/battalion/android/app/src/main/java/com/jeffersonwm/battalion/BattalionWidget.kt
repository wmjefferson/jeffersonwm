package com.jeffersonwm.battalion

// ============================================================
//  BattalionWidget.kt
//
//  A home screen widget that shows HP, XP, Gold, mood, and
//  3 quick-action buttons.
//
//  CONCEPT: AppWidgetProvider is a special BroadcastReceiver.
//  The Android system wakes it up when the widget needs to
//  update (on a timer, on reboot, or when the user taps a button).
//
//  CONCEPT: RemoteViews is the only way to draw widget UI.
//  Unlike normal Compose/XML for Activities, widgets live in
//  the launcher process — not your app's process. RemoteViews
//  sends a description of the UI across processes. This is why
//  widgets can only use a limited set of View types
//  (TextView, Button, ProgressBar, LinearLayout, etc.)
//
//  CONCEPT: PendingIntent is a pre-packaged Intent that another
//  app (or the system) can fire on your behalf later — like a
//  pre-addressed, pre-stamped envelope you hand to someone else.
// ============================================================

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.widget.RemoteViews
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

// Action string for quick-action button taps
const val ACTION_PERFORM_WIDGET = "com.jeffersonwm.battalion.PERFORM_ACTION"
const val EXTRA_ACTION_ID = "action_id"
const val EXTRA_ACTION_NAME = "action_name"

// The 3 hardcoded quick-action buttons for the widget
val WIDGET_QUICK_ACTIONS = listOf(
    Triple("drink_water",   "💧 Water",   R.id.widget_btn_action1),
    Triple("make_the_bed",  "🛏 Bed",     R.id.widget_btn_action2),
    Triple("go_for_a_walk", "🚶 Walk",    R.id.widget_btn_action3)
)

class BattalionWidget : AppWidgetProvider() {

    // Called by Android whenever a widget instance needs to update its UI.
    // This happens on the schedule defined in battalion_widget_info.xml,
    // on reboot, and whenever we manually trigger an update.
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Update every widget instance (users can add multiple copies)
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    // Called when the widget is first added to the home screen
    override fun onEnabled(context: Context) {
        // Schedule the 30-minute refresh alarm
        scheduleRefreshAlarm(context)
    }

    // Called when the last widget instance is removed from the home screen
    override fun onDisabled(context: Context) {
        // Cancel the alarm — no point in running it with no widgets visible
        cancelRefreshAlarm(context)
    }

    // Called when a broadcast is received — including our button taps
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent) // Let the parent handle standard widget events

        when (intent.action) {
            ACTION_PERFORM_WIDGET -> {
                // A quick-action button was tapped — perform the action in the background
                val actionId = intent.getStringExtra(EXTRA_ACTION_ID) ?: return
                val actionName = intent.getStringExtra(EXTRA_ACTION_NAME) ?: actionId

                // CoroutineScope(Dispatchers.IO) creates a background thread for the network call
                CoroutineScope(Dispatchers.IO).launch {
                    // Re-login if needed (widget may start when app cookie is expired)
                    val password = ApiClient.getSavedPassword(context)
                    if (password != null) {
                        ApiClient.login(password) // Refreshes the session cookie
                    }

                    val result = ApiClient.performAction(actionId)
                    result.onSuccess {
                        // Refresh all widget instances after the action
                        val manager = AppWidgetManager.getInstance(context)
                        val ids = manager.getAppWidgetIds(
                            ComponentName(context, BattalionWidget::class.java)
                        )
                        for (id in ids) {
                            updateWidget(context, manager, id)
                        }
                    }
                }
            }

            AppWidgetManager.ACTION_APPWIDGET_UPDATE -> {
                // System-triggered update (from alarm or reboot)
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(
                    ComponentName(context, BattalionWidget::class.java)
                )
                onUpdate(context, manager, ids)
            }
        }
    }
}

// ---- Update a single widget instance ----

fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
    // Fetch fresh data from the API (no auth needed for dashboard)
    CoroutineScope(Dispatchers.IO).launch {
        val result = ApiClient.fetchDashboard()
        val player = result.getOrDefault(DashboardResponse()).player

        // RemoteViews: specify the layout XML and package, then set individual view values
        val views = RemoteViews(context.packageName, R.layout.widget_layout)

        // Set text values
        views.setTextViewText(R.id.widget_level, "⚔ Lv.${player.level} ${player.title}")
        views.setTextViewText(R.id.widget_mood, moodEmoji(player.currentMood) + " " + player.currentMood)
        views.setTextViewText(R.id.widget_hp_text, "HP ${player.hp}/${player.maxHp}")
        views.setTextViewText(R.id.widget_xp_text, "XP ${player.xp}/${player.xpToNext}")
        views.setTextViewText(R.id.widget_gold, "💰 ${player.gold}g")

        // Set progress bars (0–10000 scale for precision; ProgressBar max defaults to 100)
        val hpMax = if (player.maxHp > 0) player.maxHp else 100
        views.setProgressBar(R.id.widget_hp_bar, hpMax, player.hp, false)
        views.setProgressBar(R.id.widget_xp_bar, player.xpToNext.coerceAtLeast(1), player.xp, false)

        // Tapping the HP/XP area opens the main app
        val openAppIntent = Intent(context, MainActivity::class.java)
        val openAppPending = PendingIntent.getActivity(
            context, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_stats_area, openAppPending)

        // Set up quick-action buttons
        for ((actionId, actionName, viewId) in WIDGET_QUICK_ACTIONS) {
            views.setTextViewText(viewId, actionName)

            // Each button broadcasts ACTION_PERFORM_WIDGET with the action ID
            val actionIntent = Intent(context, BattalionWidget::class.java).apply {
                action = ACTION_PERFORM_WIDGET
                putExtra(EXTRA_ACTION_ID, actionId)
                putExtra(EXTRA_ACTION_NAME, actionName)
            }
            // PendingIntent.getBroadcast wraps the intent so the launcher can send it
            val pendingAction = PendingIntent.getBroadcast(
                context,
                actionId.hashCode(), // unique request code per action
                actionIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(viewId, pendingAction)
        }

        // Push the updated RemoteViews to the widget on screen
        // This call must happen on any thread — AppWidgetManager is thread-safe
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}

// ---- 30-minute refresh alarm ----

fun scheduleRefreshAlarm(context: Context) {
    // AlarmManager wakes up the app every 30 minutes to refresh widget data.
    // Android's built-in updatePeriodMillis (in widget info XML) only works when
    // the screen is on. AlarmManager is more reliable.
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

// Mood string → emoji
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
