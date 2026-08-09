package com.jeffersonwm.battalion

// ============================================================
//  LoginActivity.kt
//
//  This is the first screen shown when the user hasn't
//  authenticated yet. It collects the password, calls the
//  API, and on success redirects to MainActivity.
//
//  CONCEPT: In Android, each "screen" is called an Activity.
//  Activities have a lifecycle: onCreate → onStart → onResume
//  → (user interacts) → onPause → onStop → onDestroy.
//
//  CONCEPT: Jetpack Compose lets us describe the UI as Kotlin
//  functions (called Composables) instead of XML files.
//  The UI automatically re-draws whenever state changes.
// ============================================================

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // If already logged in (from a previous session), skip straight to main
        if (ApiClient.isLoggedIn(this)) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContent {
            LoginScreen(
                onLoginSuccess = {
                    // After login, navigate to the main screen
                    // finish() removes LoginActivity from the back stack so pressing
                    // Back won't return to the login screen
                    startActivity(Intent(this, MainActivity::class.java))
                    finish()
                },
                context = this
            )
        }
    }
}

// ---- UI Composable ----

@Composable
fun LoginScreen(onLoginSuccess: () -> Unit, context: android.content.Context) {
    // State variables: when these change, Compose automatically re-draws the UI
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }

    // coroutineScope lets us launch background tasks from a Composable
    val coroutineScope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF1a1a2e), Color(0xFF16213e))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            // Title
            Text("⚔", fontSize = 64.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Battalion",
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF4fc3f7)
            )
            Text(
                "Companion",
                fontSize = 18.sp,
                color = Color(0xFF90caf9)
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Password field
            OutlinedTextField(
                value = password,
                onValueChange = { password = it; errorMessage = "" },
                label = { Text("Password", color = Color(0xFF90caf9)) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF4fc3f7),
                    unfocusedBorderColor = Color(0xFF444466),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    cursorColor = Color(0xFF4fc3f7)
                ),
                modifier = Modifier.fillMaxWidth()
            )

            if (errorMessage.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(errorMessage, color = Color(0xFFef5350), fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Connect button
            Button(
                onClick = {
                    if (password.isBlank()) { errorMessage = "Please enter your password"; return@Button }
                    isLoading = true

                    // CONCEPT: coroutineScope.launch runs code asynchronously.
                    // We switch to Dispatchers.IO (background thread) for the network call,
                    // then back to the main thread to update the UI.
                    coroutineScope.launch {
                        val result = withContext(Dispatchers.IO) {
                            ApiClient.login(password)
                        }

                        // Back on main thread
                        isLoading = false
                        result.fold(
                            onSuccess = {
                                ApiClient.setLoggedIn(context, true)
                                ApiClient.savePassword(context, password)
                                onLoginSuccess()
                            },
                            onFailure = {
                                errorMessage = "Connection failed. Check your password."
                            }
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4fc3f7)),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color(0xFF1a1a2e), modifier = Modifier.size(20.dp))
                } else {
                    Text("Connect to Battalion", color = Color(0xFF1a1a2e), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}
