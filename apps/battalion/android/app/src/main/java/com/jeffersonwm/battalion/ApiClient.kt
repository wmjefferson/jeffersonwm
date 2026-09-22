package com.jeffersonwm.battalion

// ============================================================
//  ApiClient.kt  -  The single networking hub for the app.
//
//  CONCEPT: OkHttp is a popular HTTP library. We create ONE
//  shared OkHttpClient (a singleton) and reuse it everywhere.
//
//  CONCEPT: A CookieJar stores the session cookie the server
//  sends after login, and replays it on every future request.
//  This is how the app stays "logged in" like a browser does.
// ============================================================

import android.content.Context
import android.content.SharedPreferences
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.annotations.SerializedName

// ---- Data classes: Gson maps JSON fields to these Kotlin objects ----

/** The player block inside /api/public/dashboard */
data class PlayerState(
    val level: Int = 1,
    val xp: Int = 0,
    @SerializedName("xp_to_next") val xpToNext: Int = 500,
    val hp: Int = 35,
    @SerializedName("max_hp") val maxHp: Int = 100,
    val gold: Int = 0,
    @SerializedName("stat_energy") val statEnergy: Int = 50,
    @SerializedName("stat_stress") val statStress: Int = 30,
    @SerializedName("stat_health") val statHealth: Int = 50,
    @SerializedName("health_level") val healthLevel: Int = 1,
    @SerializedName("health_xp") val healthXp: Int = 0,
    @SerializedName("health_xp_to_next") val healthXpToNext: Int = 100,
    @SerializedName("current_mood") val currentMood: String = "okay",
    val title: String = "Recruit"
)

/** Top-level dashboard response wrapper */
data class DashboardResponse(
    val player: PlayerState = PlayerState()
)

/** One emotion category from GET /api/emotions/categories */
data class EmotionCategory(
    @SerializedName("category_id") val categoryId: String = "",
    val label: String = "",
    @SerializedName("energy_flat") val energyFlat: Int = 0,
    @SerializedName("stress_flat") val stressFlat: Int = 0
)

/** One emotion from GET /api/emotions */
data class Emotion(
    val id: Int = 0,
    val name: String = "",
    @SerializedName("category_id") val categoryId: String = "",
    val tier: Int = 3,
    @SerializedName("brief_description") val briefDescription: String? = null
)

/** One action from GET /api/actions */
data class Action(
    val id: Int = 0,
    @SerializedName("action_id") val actionId: String = "",
    @SerializedName("label") val label: String = "",
    val category: String = "",
    @SerializedName("energy_delta") val energyDelta: Int = 0,
    @SerializedName("stress_delta") val stressDelta: Int = 0,
    @SerializedName("health_delta") val healthDelta: Int = 0,
    @SerializedName("time_minutes") val timeMinutes: Int = 5
) {
    val name: String get() = label.ifBlank { actionId }
}

/** Response from POST /api/actions/:id/perform */
data class PerformResult(
    val success: Boolean = false,
    val action: String = "",
    val xpEarned: Int = 0,
    val goldEarned: Int = 0,
    val leveledUp: Boolean = false,
    val newLevel: Int = 0
)

// ---- Singleton object ----

object ApiClient {

    const val BASE_URL = "https://api-battalion.jeffersonwm.com"
    private val JSON = "application/json; charset=utf-8".toMediaType()
    val gson = Gson()

    // In-memory cookie store: host -> list of cookies
    private val cookieStore = mutableMapOf<String, List<Cookie>>()

    private val cookieJar = object : CookieJar {
        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            cookieStore[url.host] = cookies
        }
        override fun loadForRequest(url: HttpUrl): List<Cookie> {
            return cookieStore[url.host] ?: emptyList()
        }
    }

    // The shared OkHttpClient — created once, reused everywhere
    val client = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .build()

    // ---- SharedPreferences helpers ----
    // SharedPreferences = Android's simple key-value store (like localStorage on the web)

    fun getPrefs(context: Context): SharedPreferences =
        context.getSharedPreferences("battalion_prefs", Context.MODE_PRIVATE)

    fun isLoggedIn(context: Context): Boolean =
        getPrefs(context).getBoolean("logged_in", false)

    fun setLoggedIn(context: Context, value: Boolean) {
        getPrefs(context).edit().putBoolean("logged_in", value).apply()
    }

    fun saveCredentials(context: Context, username: String, password: String) {
        getPrefs(context).edit()
            .putString("username", username)
            .putString("password", password)
            .apply()
    }

    fun getSavedUsername(context: Context): String? =
        getPrefs(context).getString("username", null)

    fun getSavedPassword(context: Context): String? =
        getPrefs(context).getString("password", null)

    fun logout(context: Context) {
        setLoggedIn(context, false)
        cookieStore.clear()
        getPrefs(context).edit()
            .remove("password")
            .putBoolean("logged_in", false)
            .apply()
    }

    // ---- API Calls ----
    // All functions return Result<T>: either Result.success(data) or Result.failure(exception).
    // IMPORTANT: these are blocking calls — always call them from Dispatchers.IO (a background thread).

    /**
     * POST /api/auth/login — sends {username, password} as JSON.
     * The session cookie returned by the server is stored automatically by the cookieJar.
     * Returns a detailed error on failure:
     *   - HTTP 400 = username or password missing
     *   - HTTP 401 = wrong credentials
     *   - HTTP 404 = endpoint URL is wrong
     *   - network exception = no internet / server unreachable
     */
    fun login(username: String, password: String): Result<Unit> = try {
        val body = """{"username":"$username","password":"$password"}""".toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/login")
            .post(body)
            .build()
        val response = client.newCall(request).execute()
        val responseBody = response.body?.string() ?: "(no body)"
        if (response.isSuccessful) {
            Result.success(Unit)
        } else {
            // Include status code AND body so we can see exactly what the server said
            Result.failure(Exception("HTTP ${response.code}: $responseBody"))
        }
    } catch (e: Exception) {
        // Network-level error (no internet, DNS failure, SSL issue, etc.)
        Result.failure(Exception("Network error: ${e.message}"))
    }

    /**
     * Re-authenticates using saved credentials on app startup.
     * Needed because the in-memory cookie jar is wiped every time the process is killed.
     */
    fun reAuthIfNeeded(context: Context): Boolean {
        val username = getSavedUsername(context) ?: return false
        val password = getSavedPassword(context) ?: return false
        return login(username, password).isSuccess
    }

    /** GET /api/public/dashboard — no auth needed; safe to call from widget */
    fun fetchDashboard(): Result<DashboardResponse> = try {
        val request = Request.Builder().url("$BASE_URL/api/public/dashboard").get().build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: "{}"
        Result.success(gson.fromJson(body, DashboardResponse::class.java))
    } catch (e: Exception) { Result.failure(e) }

    /** GET /api/emotions/categories — returns list of emotion categories */
    fun fetchEmotionCategories(): Result<List<EmotionCategory>> = try {
        val request = Request.Builder().url("$BASE_URL/api/emotions/categories").get().build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: "[]"
        val type = object : com.google.gson.reflect.TypeToken<List<EmotionCategory>>() {}.type
        Result.success(gson.fromJson(body, type))
    } catch (e: Exception) { Result.failure(e) }

    /** GET /api/emotions — returns list of individual emotions */
    fun fetchEmotions(): Result<List<Emotion>> = try {
        val request = Request.Builder().url("$BASE_URL/api/emotions").get().build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: "[]"
        val type = object : com.google.gson.reflect.TypeToken<List<Emotion>>() {}.type
        Result.success(gson.fromJson(body, type))
    } catch (e: Exception) { Result.failure(e) }

    /** GET /api/actions — returns list of available actions */
    fun fetchActions(): Result<List<Action>> = try {
        val request = Request.Builder().url("$BASE_URL/api/actions").get().build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: "[]"
        val type = object : com.google.gson.reflect.TypeToken<List<Action>>() {}.type
        Result.success(gson.fromJson(body, type))
    } catch (e: Exception) { Result.failure(e) }

    /** POST /api/emotions/log — records the emotion with emotion_name and category_id */
    fun logEmotion(
        emotionName: String,
        categoryId: String,
        tier: Int = 3,
        notes: String? = null,
        context: Context? = null
    ): Result<Unit> = try {
        val json = JsonObject().apply {
            addProperty("emotion_name", emotionName)
            addProperty("category_id", categoryId)
            addProperty("tier", tier)
            if (notes != null) addProperty("notes", notes)
        }
        val body = gson.toJson(json).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/emotions/log")
            .post(body)
            .build()
        var response = client.newCall(request).execute()

        // If 401 Unauthorized, automatically try to re-authenticate and retry once
        if (response.code == 401 && context != null && reAuthIfNeeded(context)) {
            val retryBody = gson.toJson(json).toRequestBody(JSON)
            val retryRequest = Request.Builder()
                .url("$BASE_URL/api/emotions/log")
                .post(retryBody)
                .build()
            response = client.newCall(retryRequest).execute()
        }

        if (response.isSuccessful) {
            Result.success(Unit)
        } else {
            val errBody = response.body?.string() ?: ""
            Result.failure(Exception("HTTP ${response.code}: $errBody"))
        }
    } catch (e: Exception) { Result.failure(e) }

    /** POST /api/actions/:id/perform — performs an action, returns XP/Gold earned */
    fun performAction(actionId: String, context: Context? = null): Result<PerformResult> = try {
        val body = "{}".toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/actions/$actionId/perform")
            .post(body)
            .build()
        var response = client.newCall(request).execute()

        // If 401 Unauthorized, automatically try to re-authenticate and retry once
        if (response.code == 401 && context != null && reAuthIfNeeded(context)) {
            val retryBody = "{}".toRequestBody(JSON)
            val retryRequest = Request.Builder()
                .url("$BASE_URL/api/actions/$actionId/perform")
                .post(retryBody)
                .build()
            response = client.newCall(retryRequest).execute()
        }

        if (response.isSuccessful) {
            val bodyStr = response.body?.string() ?: "{}"
            Result.success(gson.fromJson(bodyStr, PerformResult::class.java))
        } else {
            val bodyStr = response.body?.string() ?: ""
            Result.failure(Exception("HTTP ${response.code}: $bodyStr"))
        }
    } catch (e: Exception) { Result.failure(e) }
}
