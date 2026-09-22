package com.jeffersonwm.battalion

// ============================================================
//  ShortcutActionDialogActivity.kt
//
//  A lightweight, translucent dialog activity launched when a
//  1x1 (or resized) shortcut widget is tapped on the home screen.
//  Displays an Android confirmation dialog indicating which button
//  was pressed and logs the action/emotion with live feedback.
// ============================================================

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ShortcutActionDialogActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val buttonName = intent.getStringExtra("EXTRA_NAME") ?: "Shortcut"
        val type = intent.getStringExtra("EXTRA_TYPE") ?: "action"
        val id = intent.getStringExtra("EXTRA_ID") ?: ""
        val category = intent.getStringExtra("EXTRA_CATEGORY") ?: ""
        val icon = intent.getStringExtra("EXTRA_ICON") ?: "⚔"

        setContent {
            ActionDialog(
                buttonName = buttonName,
                type = type,
                id = id,
                category = category,
                icon = icon,
                onDismiss = { finish() }
            )
        }
    }
}

@Composable
fun ActionDialog(
    buttonName: String,
    type: String,
    id: String,
    category: String,
    icon: String,
    onDismiss: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var statusMessage by remember { mutableStateOf("Executing...") }
    var isSuccess by remember { mutableStateOf<Boolean?>(null) }

    // Execute the action/emotion immediately upon opening
    LaunchedEffect(Unit) {
        coroutineScope.launch {
            if (!ApiClient.isLoggedIn(context)) {
                statusMessage = "Please log in to Battalion first."
                isSuccess = false
                return@launch
            }

            if (type == "emotion") {
                val result = withContext(Dispatchers.IO) {
                    ApiClient.logEmotion(id.ifBlank { buttonName }, category)
                }
                result.fold(
                    onSuccess = {
                        statusMessage = "Emotion logged!"
                        isSuccess = true
                        refreshAllStatsWidgets(context)
                    },
                    onFailure = { err ->
                        statusMessage = "Failed: ${err.message ?: "Unknown error"}"
                        isSuccess = false
                    }
                )
            } else {
                val result = withContext(Dispatchers.IO) {
                    ApiClient.performAction(id)
                }
                result.fold(
                    onSuccess = { perf ->
                        val reward = if (perf.xpEarned > 0 || perf.goldEarned > 0)
                            "+${perf.xpEarned} XP   +${perf.goldEarned} Gold"
                        else "Completed successfully!"
                        statusMessage = reward
                        isSuccess = true
                        refreshAllStatsWidgets(context)
                    },
                    onFailure = { err ->
                        statusMessage = "Failed: ${err.message ?: "Action failed"}"
                        isSuccess = false
                    }
                )
            }
        }
    }

    // Auto-dismiss dialog after 1.8 seconds when successful
    LaunchedEffect(isSuccess) {
        if (isSuccess == true) {
            delay(1800)
            onDismiss()
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        ),
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "⚔ Battalion",
                    color = Accent,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Button Pressed:",
                    color = TextMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = icon,
                        fontSize = 28.sp,
                        modifier = Modifier.padding(end = 10.dp)
                    )
                    Text(
                        text = buttonName,
                        color = TextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = Color(0xFF334466), thickness = 1.dp)
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (isSuccess == null) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Accent
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                    } else if (isSuccess == true) {
                        Text(
                            text = "✓",
                            color = Color(0xFF2ECC71),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    } else {
                        Text("⚠️", fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                    }

                    Text(
                        text = statusMessage,
                        color = when (isSuccess) {
                            true -> GoldColor
                            false -> Color(0xFFE57373)
                            else -> TextMuted
                        },
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(
                    text = "OK",
                    color = Accent,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
            }
        },
        containerColor = CardBg,
        shape = RoundedCornerShape(16.dp),
        tonalElevation = 6.dp
    )
}
