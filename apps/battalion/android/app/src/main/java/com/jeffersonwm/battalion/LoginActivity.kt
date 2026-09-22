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
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext


class LoginActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // If already logged in from a previous session, skip the login screen.
        // BUT: we still need to call login() again because the in-memory cookie jar
        // is wiped every time the app process is killed. We re-auth silently in the
        // background using the saved password, then proceed to MainActivity.
        if (ApiClient.isLoggedIn(this)) {
            lifecycleScope.launch {
                withContext(Dispatchers.IO) {
                    ApiClient.reAuthIfNeeded(this@LoginActivity)
                }
                startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                finish()
            }
            return
        }

        setContent {
            LoginScreen(
                onLoginSuccess = {
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
    var username by remember { mutableStateOf(ApiClient.getSavedUsername(context) ?: "") }
    var password by remember { mutableStateOf("") }
    // Controls whether the password is shown as plain text or dots
    var passwordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }

    val coroutineScope = rememberCoroutineScope()

    // Extracted so both the button AND the keyboard Done action can trigger it
    fun doLogin() {
        if (username.isBlank()) { errorMessage = "Please enter your username"; return }
        if (password.isBlank()) { errorMessage = "Please enter your password"; return }
        isLoading = true
        coroutineScope.launch {
            val result = withContext(Dispatchers.IO) {
                ApiClient.login(username.trim(), password)
            }
            isLoading = false
            result.fold(
                onSuccess = {
                    ApiClient.setLoggedIn(context, true)
                    ApiClient.saveCredentials(context, username.trim(), password)
                    onLoginSuccess()
                },
                onFailure = { error ->
                    errorMessage = error.message ?: "Unknown error"
                }
            )
        }
    }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // App background artwork: battvert03
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
                            Color(0xCC0F172A),
                            Color(0xF00A0E1A)
                        )
                    )
                )
        )
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
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

            // Username field — ImeAction.Next moves focus to password field
            OutlinedTextField(
                value = username,
                onValueChange = { username = it; errorMessage = "" },
                label = { Text("Username", color = Color(0xFF90caf9)) },
                placeholder = { Text("Commander", color = Color(0xFF555577)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Next   // keyboard shows "Next" button, not Enter
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF4fc3f7),
                    unfocusedBorderColor = Color(0xFF444466),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    cursorColor = Color(0xFF4fc3f7)
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Password field with eye icon toggle and Done action
            OutlinedTextField(
                value = password,
                onValueChange = { password = it; errorMessage = "" },
                label = { Text("Password", color = Color(0xFF90caf9)) },
                singleLine = true,
                // Toggle between dots and plain text based on passwordVisible
                visualTransformation = if (passwordVisible) VisualTransformation.None
                                       else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done  // keyboard shows "Done", not Enter newline
                ),
                keyboardActions = KeyboardActions(
                    // When user taps Done on keyboard, submit the form
                    onDone = { doLogin() }
                ),
                // Eye icon on the right side of the field
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Filled.VisibilityOff
                                          else Icons.Filled.Visibility,
                            contentDescription = if (passwordVisible) "Hide password" else "Show password",
                            tint = Color(0xFF90caf9)
                        )
                    }
                },
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
                Text(errorMessage, color = Color(0xFFef5350), fontSize = 13.sp)
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = { doLogin() },
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



