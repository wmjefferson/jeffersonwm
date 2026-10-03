using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Lionfish.Core.Actions;

namespace Lionfish.Core.Web;

public class BrowserBridgeService : IDisposable
{
    public static BrowserBridgeService? Instance { get; private set; }

    private const string ServerPrefix = "http://127.0.0.1:48123/";
    private HttpListener? _listener;
    private CancellationTokenSource? _cts;
    private readonly List<WebSocket> _clients = new();
    private readonly object _clientsLock = new();

    private TaskCompletionSource<bool>? _pendingActionTcs;

    public event Action<bool>? ConnectionStateChanged;
    public event Action<bool>? RecordingStateChanged;
    public event Action<WebStep, string>? WebClickRecorded;
    public event Action<bool, string?>? ActionCompleted;

    public bool IsConnected
    {
        get
        {
            lock (_clientsLock)
            {
                return _clients.Any(c => c.State == WebSocketState.Open);
            }
        }
    }

    private static void Log(string msg)
    {
        try
        {
            var logPath = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Lionfish", "startup.log");
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(logPath)!);
            System.IO.File.AppendAllText(logPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] [BrowserBridge] {msg}{Environment.NewLine}");
        }
        catch { }
    }

    public BrowserBridgeService()
    {
        Instance = this;
        Log("BrowserBridgeService instance created");
    }

    public void Start()
    {
        Log("Start called");
        if (_listener != null && _listener.IsListening)
        {
            Log("Already listening");
            return;
        }

        _cts = new CancellationTokenSource();
        _listener = new HttpListener();
        _listener.Prefixes.Add(ServerPrefix);

        try
        {
            _listener.Start();
            Task.Run(() => AcceptConnectionsAsync(_cts.Token), _cts.Token);
            Log($"Started WebSocket server on {ServerPrefix}");
        }
        catch (Exception ex)
        {
            Log($"Failed to start WebSocket server: {ex}");
        }
    }

    private async Task AcceptConnectionsAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && _listener != null && _listener.IsListening)
        {
            try
            {
                var context = await _listener.GetContextAsync();
                if (context.Request.IsWebSocketRequest)
                {
                    _ = Task.Run(async () =>
                    {
                        HttpListenerWebSocketContext wsContext;
                        try
                        {
                            wsContext = await context.AcceptWebSocketAsync(subProtocol: null);
                        }
                        catch (Exception ex)
                        {
                            try
                            {
                                context.Response.StatusCode = 500;
                                context.Response.Close();
                            }
                            catch { }
                            Log($"AcceptWebSocketAsync failed: {ex.Message}");
                            return;
                        }

                        var ws = wsContext.WebSocket;
                        lock (_clientsLock)
                        {
                            _clients.Add(ws);
                        }
                        Log("WebSocket client connected successfully");
                        ConnectionStateChanged?.Invoke(true);

                        await HandleClientAsync(ws, ct);

                        lock (_clientsLock)
                        {
                            _clients.Remove(ws);
                        }
                        ConnectionStateChanged?.Invoke(IsConnected);
                    }, ct);
                }
                else
                {
                    try
                    {
                        context.Response.StatusCode = 200;
                        context.Response.ContentType = "application/json";
                        byte[] data = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"service\":\"LionfishBrowserBridge\"}");
                        context.Response.OutputStream.Write(data, 0, data.Length);
                        context.Response.Close();
                    }
                    catch { }
                }
            }
            catch (HttpListenerException)
            {
                break;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                Log($"GetContextAsync error: {ex.Message}");
            }
        }
    }

    private async Task HandleClientAsync(WebSocket ws, CancellationToken ct)
    {
        var buffer = new byte[8192];
        var ms = new MemoryStream();

        while (!ct.IsCancellationRequested && ws.State == WebSocketState.Open)
        {
            try
            {
                ms.SetLength(0);
                WebSocketReceiveResult result;
                do
                {
                    result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", ct);
                        return;
                    }
                    ms.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);

                string json = Encoding.UTF8.GetString(ms.ToArray());
                ProcessIncomingMessage(json);
            }
            catch (Exception)
            {
                break;
            }
        }
    }

    private void ProcessIncomingMessage(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("type", out var typeProp)) return;

            string type = typeProp.GetString() ?? "";

            switch (type)
            {
                case "HELLO":
                    ConnectionStateChanged?.Invoke(true);
                    break;

                case "PING":
                    // Keepalive ping from extension service worker
                    break;

                case "RECORDING_STATE_CHANGED":
                    if (root.TryGetProperty("isRecording", out var isRecProp))
                    {
                        RecordingStateChanged?.Invoke(isRecProp.GetBoolean());
                    }
                    break;

                case "WEB_CLICK_RECORDED":
                    if (root.TryGetProperty("step", out var stepProp))
                    {
                        var step = JsonSerializer.Deserialize<WebStep>(stepProp.GetRawText(), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        string url = root.TryGetProperty("url", out var urlProp) ? (urlProp.GetString() ?? "") : "";
                        if (step != null)
                        {
                            WebClickRecorded?.Invoke(step, url);
                        }
                    }
                    break;

                case "ACTION_COMPLETED":
                    bool success = root.TryGetProperty("success", out var succProp) && succProp.GetBoolean();
                    string? error = root.TryGetProperty("error", out var errProp) ? errProp.GetString() : null;
                    ActionCompleted?.Invoke(success, error);
                    _pendingActionTcs?.TrySetResult(success);
                    break;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[BrowserBridge] Message processing error: {ex.Message}");
        }
    }

    public async Task<bool> ExecuteWebActionAsync(WebAction action, CancellationToken ct = default)
    {
        if (!IsConnected)
        {
            System.Diagnostics.Debug.WriteLine("[BrowserBridge] Cannot execute web action: No browser extension connected.");
            return false;
        }

        var payload = new
        {
            type = "EXECUTE_WEB_ACTION",
            action = new
            {
                urlMatch = action.UrlMatch,
                steps = action.Steps
            }
        };

        string json = JsonSerializer.Serialize(payload);
        _pendingActionTcs = new TaskCompletionSource<bool>();

        await BroadcastAsync(json, ct);

        // Wait up to 5 seconds for completion
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        try
        {
            using (linkedCts.Token.Register(() => _pendingActionTcs.TrySetCanceled()))
            {
                return await _pendingActionTcs.Task;
            }
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> ExecuteDocsHighlightAsync(string color, CancellationToken ct = default)
    {
        if (!IsConnected)
        {
            return false;
        }

        var payload = new
        {
            type = "EXECUTE_DOCS_HIGHLIGHT",
            color = color
        };

        await BroadcastAsync(JsonSerializer.Serialize(payload), ct);
        return true;
    }

    public void StartRecording()
    {
        var payload = new { type = "START_RECORDING" };
        _ = BroadcastAsync(JsonSerializer.Serialize(payload));
    }

    public void StopRecording()
    {
        var payload = new { type = "STOP_RECORDING" };
        _ = BroadcastAsync(JsonSerializer.Serialize(payload));
    }

    private async Task BroadcastAsync(string message, CancellationToken ct = default)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(message);
        var segment = new ArraySegment<byte>(bytes);

        List<WebSocket> active;
        lock (_clientsLock)
        {
            active = _clients.Where(c => c.State == WebSocketState.Open).ToList();
        }

        foreach (var client in active)
        {
            try
            {
                await client.SendAsync(segment, WebSocketMessageType.Text, true, ct);
            }
            catch { }
        }
    }

    public void Stop()
    {
        _cts?.Cancel();

        lock (_clientsLock)
        {
            foreach (var client in _clients)
            {
                try
                {
                    client.Abort();
                    client.Dispose();
                }
                catch { }
            }
            _clients.Clear();
        }

        if (_listener != null)
        {
            try
            {
                _listener.Stop();
                _listener.Close();
            }
            catch { }
            _listener = null;
        }

        ConnectionStateChanged?.Invoke(false);
    }

    public void Dispose()
    {
        Stop();
        _cts?.Dispose();
    }
}
