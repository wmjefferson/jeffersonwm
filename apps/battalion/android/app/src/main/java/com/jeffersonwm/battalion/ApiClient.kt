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
    @SerializedName("current_mood") val currentMood: String = "okay",
    val title: String = "Recruit"
)

/** Top-level dashboard response wrapper */
data class DashboardResponse(
    val player: PlayerState = PlayerState()
)

/** One emotion from GET /api/emotions */
data class Emotion(
    val id: String = "",
    val name: String = "",
    val category: String = "",
    val emoji: String = "😐"
)

/** One action from GET /api/actions */
data class Action(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val category: String = ""
)

/** Response from POST /api/actions/:id/perform */
data class PerformResult(
    val success: Boolean = false,
    @SerializedName("xp_earned") val xpEarned: Int = 0,
    @SerializedName("gold_earned") val goldEarned: Int = 0,
    val message: String = ""
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

    fun savePassword(context: Context, password: String) {
        getPrefs(context).edit().putString("password", password).apply()
    }

    fun getSavedPassword(context: Context): String? =
        getPrefs(context).getString("password", null)

    // ---- API Calls ----
    // All functions return Result<T>: either Result.success(data) or Result.failure(exception).
    // IMPORTANT: these are blocking calls — always call them from Dispatchers.IO (a background thread).

    /** POST /api/auth/login — stores the session cookie automatically via cookieJar */
    fun login(password: String): Result<Unit> = try {
        val body = """{"password":"$password"}""".toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/login")
            .post(body)
            .build()
        val response = client.newCall(request).execute()
        if (response.isSuccessful) Result.success(Unit)
        else Result.failure(Exception("Login failed: ${response.code}"))
    } catch (e: Exception) { Result.failure(e) }

    /** GET /api/public/dashboard — no auth needed; safe to call from widget */
    fun fetchDashboard(): Result<DashboardResponse> = try {
        val request = Request.Builder().url("$BASE_URL/api/public/dashboard").get().build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: "{}"
        Result.success(gson.fromJson(body, DashboardResponse::class.java))
    } catch (e: Exception) { Result.failure(e) }

    /** GET /api/emotions — returns list of emotion categories */
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

    /** POST /api/emotions/log — records the emotion with tier 1-5 */
    fun logEmotion(emotionId: String, tier: Int, notes: String? = null): Result<Unit> = try {
        val json = JsonObject().apply {
            addProperty("emotion_id", emotionId)
            addProperty("tier", tier)
            if (notes != null) addProperty("notes", notes)
        }
        val body = gson.toJson(json).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/emotions/log")
            .post(body)
            .build()
        val response = client.newCall(request).execute()
        if (response.isSuccessful) Result.success(Unit) else Result.failure(Exception("Error ${response.code}"))
    } catch (e: Exception) { Result.failure(e) }

    /** POST /api/actions/:id/perform — performs an action, returns XP/Gold earned */
    fun performAction(actionId: String): Result<PerformResult> = try {
        val body = "{}".toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/actions/$actionId/perform")
            .post(body)
            .build()
        val response = client.newCall(request).execute()
        val bodyStr = response.body?.string() ?: "{}"
        Result.success(gson.fromJson(bodyStr, PerformResult::class.java))
    } catch (e: Exception) { Result.failure(e) }
}
