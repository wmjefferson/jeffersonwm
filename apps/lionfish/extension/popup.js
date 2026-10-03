// Lionfish Extension Popup Logic
document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");
  const tabTitle = document.getElementById("tabTitle");
  const tabUrl = document.getElementById("tabUrl");
  const reconnectBtn = document.getElementById("reconnectBtn");
  const recordToggleBtn = document.getElementById("recordToggleBtn");
  const invalidPageAlert = document.getElementById("invalidPageAlert");

  let isPageValid = true;
  let currentlyRecording = false;

  function isValidPageUrl(url) {
    if (!url) return false;
    return !url.startsWith("chrome://") && !url.startsWith("edge://") && !url.startsWith("chrome-extension://") && !url.startsWith("about:");
  }

  // Query active tab
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      tabTitle.textContent = activeTab.title || "Untitled Tab";
      tabUrl.textContent = activeTab.url || "about:blank";
      isPageValid = isValidPageUrl(activeTab.url);
      if (!isPageValid) {
        if (invalidPageAlert) invalidPageAlert.style.display = "block";
      }
    }
  } catch (_) {
    tabTitle.textContent = "Unable to read active tab";
    tabUrl.textContent = "";
  }

  // Record button in popup
  if (recordToggleBtn) {
    recordToggleBtn.addEventListener("click", () => {
      if (!isPageValid) return;
      const type = currentlyRecording ? "STOP_RECORDING_POPUP" : "START_RECORDING_POPUP";
      chrome.runtime.sendMessage({ type: type }, () => {
        // Automatically close popup so user sees the recording banner on the page immediately!
        window.close();
      });
    });
  }

  // Query background connection status
  chrome.runtime.sendMessage({ type: "GET_CONNECTION_STATUS" }, (response) => {
    updateStatus(response?.isConnected ?? false, response?.isRecording ?? false);
  });

  // Recheck / Reconnect button
  reconnectBtn.addEventListener("click", () => {
    reconnectBtn.textContent = "Checking...";
    reconnectBtn.disabled = true;

    chrome.runtime.sendMessage({ type: "RECONNECT" }, () => {
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: "GET_CONNECTION_STATUS" }, (statusRes) => {
          updateStatus(statusRes?.isConnected ?? false, statusRes?.isRecording ?? false);
          reconnectBtn.disabled = false;
        });
      }, 500);
    });
  });

  function updateStatus(isConnected, isRecording) {
    currentlyRecording = isRecording;
    if (isConnected) {
      statusBadge.className = "status-badge status-connected";
      statusText.textContent = "Connected";
      reconnectBtn.textContent = "🔄 Recheck Connection";
      reconnectBtn.style.background = "#333333";

      if (recordToggleBtn) {
        if (!isPageValid) {
          recordToggleBtn.disabled = true;
          recordToggleBtn.style.opacity = "0.5";
          recordToggleBtn.textContent = "⚠️ Switch to a Website to Record";
          recordToggleBtn.style.background = "#666666";
        } else {
          recordToggleBtn.disabled = false;
          recordToggleBtn.style.opacity = "1";
          recordToggleBtn.textContent = isRecording ? "⏹ Recording... Click to Stop" : "🔴 Start Recording Clicks";
          recordToggleBtn.style.background = isRecording ? "#5C5C5C" : "#E84118";
        }
      }
    } else {
      statusBadge.className = "status-badge status-disconnected";
      statusText.textContent = "Disconnected";
      reconnectBtn.textContent = "🔄 Connect to Lionfish";
      reconnectBtn.style.background = "#FF6B35";

      if (recordToggleBtn) {
        recordToggleBtn.disabled = true;
        recordToggleBtn.style.opacity = "0.5";
        recordToggleBtn.textContent = "⚠️ Start Lionfish App First";
        recordToggleBtn.style.background = "#666666";
      }
    }
  }
});
