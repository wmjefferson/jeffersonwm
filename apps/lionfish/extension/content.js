// Lionfish Companion Extension - Content Script
let isRecording = false;
let recordBanner = null;
let lastClickTime = Date.now();
let lastRecordedEventTime = 0;

// 1. Message listener from background worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_RECORDING_MODE") {
    setRecordingMode(message.enabled);
    sendResponse({ status: "ok", recording: isRecording });
  } else if (message.type === "EXECUTE_STEPS") {
    executeSteps(message.steps)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  } else if (message.type === "DOCS_HIGHLIGHT") {
    highlightGoogleDocs(message.color)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }
});

function setRecordingMode(enabled) {
  isRecording = enabled;
  if (isRecording) {
    lastClickTime = Date.now();
    lastRecordedEventTime = 0;
    showRecordBanner();
    // Listen to both mousedown (to catch menus/palettes before they dismiss) and click
    document.addEventListener("mousedown", onRecordedClick, true);
    document.addEventListener("click", onRecordedClick, true);
  } else {
    hideRecordBanner();
    document.removeEventListener("mousedown", onRecordedClick, true);
    document.removeEventListener("click", onRecordedClick, true);
  }
}

function showRecordBanner() {
  if (!recordBanner) {
    const iconUrl = chrome.runtime.getURL("icons/icon48.png");
    recordBanner = document.createElement("div");
    recordBanner.id = "lionfish-record-banner";
    recordBanner.innerHTML = `
      <div style="
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        background: #1E1E2E;
        color: #FFFFFF;
        border: 2px solid #FF6B35;
        border-radius: 8px;
        padding: 10px 16px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
      ">
        <img src="${iconUrl}" style="width:20px; height:20px; vertical-align:middle; border-radius:3px;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#FF453A; box-shadow:0 0 8px #FF453A; animation: lionfish-pulse 1s infinite alternate;"></span>
        <span><strong>Lionfish:</strong> <span id="lionfish-status-msg">Click elements to capture actions...</span></span>
        <button id="lionfish-stop-btn" style="
          background: #FF6B35;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 5px 12px;
          font-weight: bold;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.15s;
        ">Done</button>
      </div>
      <style>
        @keyframes lionfish-pulse {
          from { opacity: 0.4; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1.15); }
        }
        #lionfish-stop-btn:hover {
          background: #E85A26 !important;
        }
      </style>
    `;
    document.body.appendChild(recordBanner);
    document.getElementById("lionfish-stop-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      setRecordingMode(false);
      chrome.runtime.sendMessage({ type: "RECORDING_STOPPED_FROM_BANNER" });
    });
  }
  updateBannerStatus("Click elements to capture actions...");
  recordBanner.style.display = "block";
}

function hideRecordBanner() {
  if (recordBanner) {
    recordBanner.style.display = "none";
  }
}

function updateBannerStatus(msg) {
  const statusMsg = document.getElementById("lionfish-status-msg");
  if (statusMsg) {
    statusMsg.textContent = msg;
  }
}

function getMeaningfulElement(el) {
  if (!el || el === document.body || el === document.documentElement) return el;
  // Support standard controls, ARIA controls, and Google Docs / Closure components
  const selector = "button, a, [role='button'], [role='menuitem'], [role='menuitemcheckbox'], [role='menuitemradio'], [role='tab'], [role='combobox'], [role='option'], [role='gridcell'], [tabindex='0'], input, select, textarea, [data-color], .goog-toolbar-button, .goog-toolbar-menu-button, .goog-menuitem, .goog-palette-cell, .docs-material-color-palette-cell, .docs-icon-editor";
  const interactive = el.closest(selector);
  return interactive || el;
}

function onRecordedClick(e) {
  if (!isRecording) return;
  // Ignore clicks inside our own recording banner
  if (recordBanner && recordBanner.contains(e.target)) return;

  const now = Date.now();
  // Debounce duplicate mousedown + click events on the same element within 250ms
  if (now - lastRecordedEventTime < 250) {
    return;
  }
  lastRecordedEventTime = now;

  const target = getMeaningfulElement(e.target);
  const selector = computeBestSelector(target);
  const description = computeDescription(target);

  const delay = Math.min(Math.max(now - lastClickTime, 50), 3000);
  lastClickTime = now;

  console.log("[Lionfish] Captured click:", { selector, description, delay });

  // Visual highlight feedback on clicked element
  highlightElement(target);
  updateBannerStatus(`🎯 Captured: ${description}`);

  chrome.runtime.sendMessage({
    type: "RECORDED_CLICK_STEP",
    step: {
      type: "click",
      selector: selector,
      description: description,
      delayMs: delay
    }
  });
}

function highlightElement(el) {
  if (!el || !el.style) return;
  const prevOutline = el.style.outline;
  const prevTransition = el.style.transition;
  el.style.transition = "outline 0.1s ease";
  el.style.outline = "3px solid #FF6B35";
  setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.transition = prevTransition;
  }, 400);
}

function computeBestSelector(el) {
  // 1. Stable, meaningful ID (e.g. #boldButton, #italicButton, #undoButton, #docs-file-menu)
  if (el.id && !/\d{5,}/.test(el.id) && !el.id.startsWith("react-") && !el.id.startsWith("ember") && !el.id.startsWith(":")) {
    return `#${CSS.escape(el.id)}`;
  }

  // 2. Data attributes commonly used for color swatches, buttons, toolbars
  const dataColor = el.getAttribute("data-color");
  if (dataColor) {
    return `[data-color="${CSS.escape(dataColor)}"]`;
  }

  // 3. Accessibility attributes (gold standard for Google Docs, Sheets, Slack, etc.)
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    return `[aria-label="${CSS.escape(ariaLabel)}"]`;
  }

  const role = el.getAttribute("role");
  const title = el.getAttribute("title");
  if (title) {
    return `[title="${CSS.escape(title)}"]`;
  }

  if (el.hasAttribute("data-testid")) {
    return `[data-testid="${CSS.escape(el.getAttribute("data-testid"))}"]`;
  }
  if (el.hasAttribute("data-id")) {
    return `[data-id="${CSS.escape(el.getAttribute("data-id"))}"]`;
  }
  if (el.hasAttribute("data-action")) {
    return `[data-action="${CSS.escape(el.getAttribute("data-action"))}"]`;
  }

  // 4. Input name
  if (el.name) {
    return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
  }

  // 5. Button/link with text content
  const text = (el.textContent || "").trim();
  if ((el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button" || el.getAttribute("role") === "menuitem") && text && text.length < 30) {
    return `${el.tagName.toLowerCase()}:has-text("${text}")`;
  }

  // 6. Build relative selector path
  let current = el;
  const path = [];
  while (current && current !== document.body && current !== document.documentElement && path.length < 4) {
    let selector = current.tagName.toLowerCase();
    if (current.className && typeof current.className === "string") {
      const classes = current.className
        .split(/\s+/)
        .filter(c => c && !c.includes(":") && !c.startsWith("ng-") && !c.startsWith("css-"))
        .slice(0, 2);
      if (classes.length > 0) {
        selector += "." + classes.map(c => CSS.escape(c)).join(".");
      }
    }
    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(" > ");
}

function computeDescription(el) {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return `Click "${ariaLabel}"`;

  const title = el.getAttribute("title");
  if (title) return `Click "${title}"`;

  const dataColor = el.getAttribute("data-color");
  if (dataColor) return `Click color swatch (${dataColor})`;

  if (el.id && !/\d{5,}/.test(el.id)) {
    // Humanize camelCase ID like boldButton -> Bold
    const humanized = el.id.replace(/Button$/i, "").replace(/([A-Z])/g, " $1").trim();
    if (humanized.length > 0 && humanized.length < 25) {
      return `Click "${humanized}"`;
    }
  }

  const text = (el.textContent || "").trim();
  if (text && text.length < 25) return `Click "${text}"`;

  return `Click <${el.tagName.toLowerCase()}>`;
}

// 2. Action Execution Engine
async function executeSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { success: false, error: "No steps provided to execute." };
  }

  let count = 0;
  for (const step of steps) {
    if (step.delayMs && step.delayMs > 0) {
      await sleep(step.delayMs);
    }

    const el = await findElement(step.selector);
    if (!el) {
      console.warn(`[Lionfish] Could not find element for selector: ${step.selector}`);
      return {
        success: false,
        stepsExecuted: count,
        error: `Could not find element: ${step.selector}`
      };
    }

    highlightElement(el);
    triggerClick(el);
    count++;
  }

  return { success: true, stepsExecuted: count };
}

async function findElement(selector) {
  // 1. Direct query
  try {
    let el = document.querySelector(selector);
    if (el) return el;
  } catch (_) {}

  // 2. has-text fallback
  if (selector.includes(":has-text(")) {
    const match = selector.match(/([a-zA-Z0-9_\-\*]*):has-text\("([^"]+)"\)/);
    if (match) {
      const tag = match[1] || "button, a, [role='button'], [role='menuitem']";
      const text = match[2];
      const buttons = Array.from(document.querySelectorAll(tag));
      const found = buttons.find(b => (b.textContent || "").trim().includes(text));
      if (found) return found;
    }
  }

  // 3. Fallback: if selector is [aria-label="..."], try prefix match (e.g. "Bold" matching "Bold (Ctrl+B)")
  if (selector.startsWith('[aria-label="') && selector.endsWith('"]')) {
    const label = selector.slice(13, -2);
    const prefix = label.split(" (")[0];
    if (prefix && prefix !== label) {
      try {
        let el = document.querySelector(`[aria-label^="${CSS.escape(prefix)}"]`);
        if (el) return el;
      } catch (_) {}
    }
  }

  // 4. Retry for up to 1200ms (to allow menus/dropdowns to animate in)
  const startTime = Date.now();
  while (Date.now() - startTime < 1200) {
    await sleep(60);
    try {
      let el = document.querySelector(selector);
      if (el) return el;
    } catch (_) {}
  }

  return null;
}

function triggerClick(el) {
  const target = getMeaningfulElement(el);
  const rect = (target || el).getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  // Try focusing element
  try { if (typeof (target || el).focus === "function") (target || el).focus(); } catch (_) {}

  const commonInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: clientX,
    clientY: clientY,
    screenX: (window.screenX || 0) + clientX,
    screenY: (window.screenY || 0) + clientY
  };

  const elementsToTrigger = target && target !== el ? [target, el] : [el];

  for (const elem of elementsToTrigger) {
    // Dispatch hover / mousemove sequence (crucial for Google Closure widgets)
    elem.dispatchEvent(new MouseEvent("mousemove", { ...commonInit, button: 0, buttons: 0 }));
    elem.dispatchEvent(new MouseEvent("mouseover", { ...commonInit, button: 0, buttons: 0 }));
    elem.dispatchEvent(new MouseEvent("mouseenter", { ...commonInit, bubbles: false, cancelable: false, button: 0, buttons: 0 }));

    // Pointer down & Mouse down (buttons: 1 is REQUIRED by Google Docs / Closure)
    elem.dispatchEvent(new PointerEvent("pointerdown", { ...commonInit, isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, which: 1 }));
    elem.dispatchEvent(new MouseEvent("mousedown", { ...commonInit, button: 0, buttons: 1, which: 1 }));

    // Pointer up & Mouse up
    elem.dispatchEvent(new PointerEvent("pointerup", { ...commonInit, isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 0, which: 1 }));
    elem.dispatchEvent(new MouseEvent("mouseup", { ...commonInit, button: 0, buttons: 0, which: 1 }));

    // Click event
    elem.dispatchEvent(new MouseEvent("click", { ...commonInit, button: 0, buttons: 0, which: 1 }));

    if (typeof elem.click === "function") {
      try { elem.click(); } catch (_) {}
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Google Docs Native Highlighting Engine ──────────────────────────────────
// Dedicated DOM automation inspired by Docs Hotkey (MIT License, Zack Murry).
async function highlightGoogleDocs(colorName) {
  const normColor = (colorName || "yellow").toLowerCase().trim();
  console.log("[Lionfish] Executing Google Docs highlight for:", normColor);

  // 1. Locate Highlight Color tool on Google Docs toolbar
  const highlightBtn = document.querySelector('[aria-label*="Highlight color" i]')
                    || document.querySelector('[data-tooltip*="Highlight color" i]')
                    || document.querySelector('#bgColorButton')
                    || document.querySelector('.docs-icon-highlight-color')?.closest('.goog-toolbar-menu-button, button, [role="button"]')
                    || document.querySelector('.goog-toolbar-menu-button[aria-label*="Highlight" i]')
                    || Array.from(document.querySelectorAll('.goog-toolbar-menu-button, button, [role="button"]')).find(el => {
                         const lbl = (el.getAttribute("aria-label") || el.getAttribute("data-tooltip") || "").toLowerCase();
                         return lbl.includes("highlight color") || lbl.includes("highlight");
                       });

  if (!highlightBtn) {
    console.warn("[Lionfish] Google Docs highlight button not found on toolbar.");
    return { success: false, error: "Highlight button not found on toolbar" };
  }

  // 2. Click highlight button to open palette
  triggerClick(highlightBtn);

  // 3. Locate color palette container (poll briefly for animation/render)
  let palette = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(50);
    palette = document.querySelector('.goog-palette')
           || document.querySelector('.docs-material-color-palette')
           || document.querySelector('.goog-menu[style*="visible"]')
           || document.querySelector('[role="dialog"][aria-label*="Highlight" i], [role="menu"][aria-label*="Highlight" i]')
           || document.querySelector('[role="gridcell"]')?.closest('.goog-palette, [role="grid"], [role="dialog"], [role="menu"]');
    if (palette) break;
  }

  const searchRoot = palette || document;

  // 4. Color keyword aliases for Google Docs color swatches
  const colorKeywords = {
    yellow: ["yellow", "#ffff00", "#ffd966", "#fff2cc", "rgb(255, 255, 0)"],
    green: ["green", "#6aa84f", "#b6d7a8", "#d9ead3", "rgb(106, 168, 79)"],
    cyan: ["cyan", "turquoise", "light cyan", "#45818e", "#76a5af", "#a2c4c9", "#d0e0e3", "#67e8f9"],
    magenta: ["magenta", "pink", "#a64d79", "#c27ba0", "#d5a6bd", "#ead1dc", "#f0abfc"],
    blue: ["blue", "cornflower", "#3d85c6", "#6fa8dc", "#9fc5e8", "#cfe2f3", "#93c5fd"],
    orange: ["orange", "#e69138", "#f6b26b", "#f9cb9c", "#fce5cd", "#fdba74"],
    red: ["red", "berry", "#cc0000", "#e06666", "#ea9999", "#f4cccc", "#fca5a5"],
    purple: ["purple", "#674ea7", "#8e7cc3", "#b4a7d6", "#d9d2e9", "#c084fc"],
    none: ["none", "transparent", "reset", "clear", "remove"]
  };

  const targets = colorKeywords[normColor] || [normColor];

  // 5. Query all interactive cells in palette
  const cells = Array.from(searchRoot.querySelectorAll(
    '.goog-palette-cell, .docs-material-color-palette-cell, [role="gridcell"], [data-color], [title], [aria-label]'
  ));

  let targetSwatch = null;

  // Strategy A: Match by aria-label, title, or inner text
  for (const cell of cells) {
    const label = ((cell.getAttribute("aria-label") || "") + " " + (cell.getAttribute("title") || "") + " " + (cell.innerText || "")).toLowerCase();
    for (const kw of targets) {
      if (label && label.includes(kw)) {
        targetSwatch = cell;
        break;
      }
    }
    if (targetSwatch) break;
  }

  // Strategy B: Match by data-color or style.backgroundColor
  if (!targetSwatch) {
    for (const cell of cells) {
      const dataColor = (cell.getAttribute("data-color") || "").toLowerCase();
      const bg = (cell.style?.backgroundColor || "").toLowerCase();
      for (const kw of targets) {
        if (dataColor === kw || bg.includes(kw)) {
          targetSwatch = cell;
          break;
        }
      }
      if (targetSwatch) break;
    }
  }

  if (targetSwatch) {
    console.log("[Lionfish] Located swatch for:", normColor);
    triggerClick(targetSwatch);
    return { success: true, color: normColor };
  } else {
    console.warn("[Lionfish] Could not locate exact swatch for:", normColor);
    return { success: false, error: `Swatch for ${normColor} not found` };
  }
}

