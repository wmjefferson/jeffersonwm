// Lionfish Companion Extension - Background Service Worker
const WS_URL = "ws://127.0.0.1:48123/ws/";
let ws = null;
let reconnectTimer = null;
let keepAliveTimer = null;
let isRecording = false;
const messageQueue = [];

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[Lionfish] Connected to desktop app at", WS_URL);
      chrome.storage.local.set({ isConnected: true, lastConnected: Date.now() });
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }

      // Send handshake
      sendToApp({ type: "HELLO", client: "LionfishBrowserExtension", version: "1.0.0" });

      // Flush queued messages
      while (messageQueue.length > 0) {
        const queued = messageQueue.shift();
        try {
          ws.send(JSON.stringify(queued));
        } catch (_) {}
      }

      // Keepalive ping every 15s to keep MV3 service worker active
      if (!keepAliveTimer) {
        keepAliveTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "PING" }));
          }
        }, 15000);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "PING" || msg.type === "PONG") return;
        console.log("[Lionfish] Received message from desktop app:", msg);
        await handleAppMessage(msg);
      } catch (err) {
        console.error("[Lionfish] Error parsing message from desktop app:", err);
      }
    };

    ws.onclose = () => {
      chrome.storage.local.set({ isConnected: false });
      ws = null;
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      // Quietly handle connection waiting
      console.log("[Lionfish] Waiting for Lionfish desktop app on port 48123...");
      try { ws.close(); } catch (_) {}
    };
  } catch (err) {
    console.error("[Lionfish] Failed to create WebSocket:", err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setInterval(() => {
      connectWebSocket();
    }, 3000);
  }
}

function sendToApp(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  // Queue message for delivery once connected
  messageQueue.push(data);
  connectWebSocket();
  return false;
}

async function handleAppMessage(msg) {
  switch (msg.type) {
    case "EXECUTE_DOCS_HIGHLIGHT": {
      let tab = await getActivePageTab();
      if (!tab || !tab.url || !tab.url.includes("docs.google.com")) {
        const docsTabs = await chrome.tabs.query({ url: "*://docs.google.com/*" });
        tab = docsTabs[0] || tab;
      }
      if (!tab || !tab.id) {
        console.warn("[Lionfish] No Google Docs tab found to highlight.");
        break;
      }

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "DOCS_HIGHLIGHT",
          color: msg.color
        });
      } catch (err) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          });
          await new Promise(r => setTimeout(r, 100));
          await chrome.tabs.sendMessage(tab.id, {
            type: "DOCS_HIGHLIGHT",
            color: msg.color
          });
        } catch (injectErr) {
          console.error("[Lionfish] Failed to deliver DOCS_HIGHLIGHT:", injectErr);
        }
      }
      break;
    }

    case "EXECUTE_WEB_ACTION": {
      const { urlMatch, steps } = msg.action;
      const tab = await getTargetTab(urlMatch);
      if (!tab) {
        sendToApp({
          type: "ACTION_COMPLETED",
          success: false,
          error: "No matching or active browser tab found for action."
        });
        return;
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "EXECUTE_STEPS",
          steps: steps
        });
        sendToApp({
          type: "ACTION_COMPLETED",
          success: response?.success ?? true,
          stepsExecuted: response?.stepsExecuted ?? steps.length,
          error: response?.error
        });
      } catch (err) {
        sendToApp({
          type: "ACTION_COMPLETED",
          success: false,
          error: `Error communicating with tab: ${err.message}`
        });
      }
      break;
    }

    case "START_RECORDING": {
      await startRecordingOnActiveTab();
      break;
    }

    case "STOP_RECORDING": {
      await stopRecordingOnActiveTab();
      break;
    }
  }
}

async function getActivePageTab() {
  const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focusedTabs.length > 0 && isValidPageUrl(focusedTabs[0].url)) {
    return focusedTabs[0];
  }
  const allActiveTabs = await chrome.tabs.query({ active: true });
  for (const t of allActiveTabs) {
    if (isValidPageUrl(t.url)) return t;
  }
  return focusedTabs[0] || allActiveTabs[0];
}

function isValidPageUrl(url) {
  if (!url) return false;
  return !url.startsWith("chrome://") && !url.startsWith("edge://") && !url.startsWith("chrome-extension://") && !url.startsWith("about:");
}

async function startRecordingOnActiveTab() {
  isRecording = true;
  const tab = await getActivePageTab();
  if (!tab || !tab.id) {
    console.warn("[Lionfish] No active browser tab found to record.");
    return;
  }

  if (!isValidPageUrl(tab.url)) {
    console.warn("[Lionfish] Cannot record clicks on internal browser page:", tab.url);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "SET_RECORDING_MODE", enabled: true });
  } catch (err) {
    // If content script was not loaded yet (e.g. page opened before extension reloaded), dynamically inject it now!
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      await new Promise(r => setTimeout(r, 150));
      await chrome.tabs.sendMessage(tab.id, { type: "SET_RECORDING_MODE", enabled: true });
    } catch (injectErr) {
      console.error("[Lionfish] Failed to inject content script into tab", tab.id, injectErr);
    }
  }

  sendToApp({ type: "RECORDING_STATE_CHANGED", isRecording: true });
}

async function stopRecordingOnActiveTab() {
  isRecording = false;
  const tab = await getActivePageTab();
  if (tab && tab.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "SET_RECORDING_MODE", enabled: false });
    } catch (_) {}
  }
  sendToApp({ type: "RECORDING_STATE_CHANGED", isRecording: false });
}

async function getTargetTab(urlMatch) {
  // 1. Try active tab in current window
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && matchUrl(activeTab.url, urlMatch)) {
    return activeTab;
  }

  // 2. Query all tabs for URL match
  if (urlMatch && urlMatch !== "*") {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (matchUrl(tab.url, urlMatch)) {
        return tab;
      }
    }
  }

  // 3. Fallback to active tab
  return activeTab;
}

function matchUrl(url, pattern) {
  if (!pattern || pattern === "*" || pattern === "<all_urls>") return true;
  if (!url) return false;

  // Simple glob matching (* and exact match)
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${regexPattern}$`, "i").test(url);
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RECORDED_CLICK_STEP") {
    const tabUrl = sender.tab?.url || "";
    sendToApp({
      type: "WEB_CLICK_RECORDED",
      step: message.step,
      url: tabUrl
    });
    sendResponse({ received: true });
  } else if (message.type === "START_RECORDING_POPUP") {
    startRecordingOnActiveTab().then(() => sendResponse({ status: "ok" }));
    return true;
  } else if (message.type === "STOP_RECORDING_POPUP" || message.type === "RECORDING_STOPPED_FROM_BANNER") {
    stopRecordingOnActiveTab().then(() => sendResponse({ status: "ok" }));
    return true;
  } else if (message.type === "GET_CONNECTION_STATUS") {
    sendResponse({
      isConnected: ws && ws.readyState === WebSocket.OPEN,
      isRecording: isRecording
    });
  } else if (message.type === "RECONNECT") {
    connectWebSocket();
    sendResponse({
      isConnected: ws && ws.readyState === WebSocket.OPEN,
      isRecording: isRecording
    });
  }
  return true;
});

// Start connection
connectWebSocket();
