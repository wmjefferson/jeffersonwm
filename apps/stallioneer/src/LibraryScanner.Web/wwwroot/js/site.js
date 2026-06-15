document.addEventListener("DOMContentLoaded", () => {
    const scanInput = document.querySelector("[data-scan-code]");
    if (scanInput instanceof HTMLInputElement) {
        const shouldFocus = scanInput.getAttribute("data-scan-focus") === "true";
        if (shouldFocus) {
            scanInput.focus();
            scanInput.select();
        }

        scanInput.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") {
                return;
            }

            const value = scanInput.value.trim();
            scanInput.value = value;
            if (!value) {
                return;
            }

            const submitButton = document.querySelector("[data-scan-submit]");
            if (submitButton instanceof HTMLButtonElement) {
                event.preventDefault();
                submitButton.click();
            }
        });

        const cameraPanel = document.querySelector("[data-camera-panel]");
        const cameraVideo = document.querySelector("[data-camera-video]");
        const cameraStatus = document.querySelector("[data-camera-status]");
        const cameraStart = document.querySelector("[data-camera-start]");
        const cameraStop = document.querySelector("[data-camera-stop]");
        let cameraStream = null;
        let cameraActive = false;
        let zxingReader = null;

        const setCameraStatus = (message) => {
            if (cameraStatus instanceof HTMLElement) {
                cameraStatus.textContent = message;
            }
        };

        const showCamera = () => {
            cameraPanel?.removeAttribute("hidden");
            cameraVideo?.removeAttribute("hidden");
            cameraStop?.removeAttribute("hidden");
        };

        const stopCamera = () => {
            cameraActive = false;
            if (zxingReader) {
                zxingReader.reset();
                zxingReader = null;
            }

            if (cameraStream) {
                cameraStream.getTracks().forEach((track) => track.stop());
                cameraStream = null;
            }

            if (cameraVideo instanceof HTMLVideoElement) {
                cameraVideo.srcObject = null;
                cameraVideo.setAttribute("hidden", "");
            }

            if (cameraStop instanceof HTMLButtonElement) {
                cameraStop.setAttribute("hidden", "");
            }
        };

        const submitScannedCode = (code) => {
            scanInput.value = code;
            stopCamera();
            cameraPanel?.setAttribute("hidden", "");

            const submitButton = document.querySelector("[data-scan-submit]");
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.click();
            }
        };

        const findCode = async (detector) => {
            if (!cameraActive || !(cameraVideo instanceof HTMLVideoElement)) {
                return;
            }

            if (cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                const barcodes = await detector.detect(cameraVideo);
                const code = barcodes[0]?.rawValue?.trim();
                if (code) {
                    submitScannedCode(code);
                    return;
                }
            }

            window.requestAnimationFrame(() => {
                findCode(detector).catch(() => {
                    setCameraStatus("Camera scanning stopped. You can type or scan with hardware instead.");
                    stopCamera();
                });
            });
        };

        const loadZxing = () => new Promise((resolve, reject) => {
            if (window.ZXing) {
                resolve(window.ZXing);
                return;
            }

            const script = document.createElement("script");
            script.src = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";
            script.async = true;
            script.onload = () => window.ZXing ? resolve(window.ZXing) : reject();
            script.onerror = reject;
            document.head.append(script);
        });

        const startNativeCameraScan = async () => {
            const detector = new BarcodeDetector({
                formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
            });
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: false
            });

            if (cameraVideo instanceof HTMLVideoElement) {
                showCamera();
                cameraVideo.srcObject = cameraStream;
                await cameraVideo.play();
                cameraActive = true;
                setCameraStatus("Scanning... hold the barcode steady in the camera view.");
                await findCode(detector);
            }
        };

        const startZxingCameraScan = async () => {
            if (!(cameraVideo instanceof HTMLVideoElement)) {
                return;
            }

            const zxing = await loadZxing();
            const hints = new Map();
            hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
                zxing.BarcodeFormat.EAN_13,
                zxing.BarcodeFormat.EAN_8,
                zxing.BarcodeFormat.UPC_A,
                zxing.BarcodeFormat.UPC_E,
                zxing.BarcodeFormat.CODE_128
            ]);

            zxingReader = new zxing.BrowserMultiFormatReader(hints);
            showCamera();
            cameraActive = true;
            setCameraStatus("Camera is open. Hold the barcode steady until it is detected.");
            await zxingReader.decodeFromVideoDevice(undefined, cameraVideo, (result) => {
                const code = result?.getText?.().trim();
                if (code) {
                    submitScannedCode(code);
                }
            });
        };

        if (cameraStart instanceof HTMLButtonElement) {
            cameraStart.addEventListener("click", async () => {
                if (!navigator.mediaDevices?.getUserMedia) {
                    cameraPanel?.removeAttribute("hidden");
                    setCameraStatus("Camera access is not available in this browser.");
                    stopCamera();
                    return;
                }

                try {
                    if ("BarcodeDetector" in window) {
                        await startNativeCameraScan();
                    } else {
                        await startZxingCameraScan();
                    }
                } catch {
                    cameraPanel?.removeAttribute("hidden");
                    setCameraStatus("Camera could not start or the scanner library could not load. You can still use the hardware scanner or manual entry.");
                    stopCamera();
                }
            });
        }

        if (cameraStop instanceof HTMLButtonElement) {
            cameraStop.addEventListener("click", () => {
                stopCamera();
                cameraPanel?.setAttribute("hidden", "");
            });
        }
    }

    document.querySelectorAll("[data-copy-text], [data-copy-source]").forEach((button) => {
        button.addEventListener("click", async () => {
            const directText = button.getAttribute("data-copy-text") ?? "";
            const primarySelector = button.getAttribute("data-copy-source");
            const secondarySelector = button.getAttribute("data-copy-secondary-source");
            const primaryInput = primarySelector ? document.querySelector(primarySelector) : null;
            const secondaryInput = secondarySelector ? document.querySelector(secondarySelector) : null;
            const primaryValue = primaryInput instanceof HTMLInputElement ? primaryInput.value.trim() : "";
            const secondaryValue = secondaryInput instanceof HTMLInputElement ? secondaryInput.value.trim() : "";
            const text = primaryValue
                ? (secondaryValue ? `${primaryValue} — ${secondaryValue}` : primaryValue)
                : directText;
            if (!text) {
                return;
            }

            try {
                await navigator.clipboard.writeText(text);
                button.classList.add("copied");
                window.setTimeout(() => {
                    button.classList.remove("copied");
                }, 900);
            } catch {
                // Ignore clipboard failures for now.
            }
        });
    });

    const selectAll = document.querySelector("[data-select-all]");
    if (selectAll instanceof HTMLInputElement) {
        const items = Array.from(document.querySelectorAll("[data-select-item]"))
            .filter((item) => item instanceof HTMLInputElement);

        selectAll.addEventListener("change", () => {
            items.forEach((item) => {
                item.checked = selectAll.checked;
            });
        });

        items.forEach((item) => {
            item.addEventListener("change", () => {
                selectAll.checked = items.length > 0 && items.every((checkbox) => checkbox.checked);
                selectAll.indeterminate = items.some((checkbox) => checkbox.checked) && !selectAll.checked;
            });
        });
    }

    document.querySelectorAll("[data-tag-suggestion][data-tag-target]").forEach((button) => {
        button.addEventListener("click", () => {
            const suggestion = button.getAttribute("data-tag-suggestion");
            const targetSelector = button.getAttribute("data-tag-target");
            if (!suggestion || !targetSelector) {
                return;
            }

            const input = document.querySelector(targetSelector);
            if (!(input instanceof HTMLInputElement)) {
                return;
            }

            const existingTags = input.value
                .split(/[;,]/)
                .map((value) => value.trim())
                .filter(Boolean);

            if (!existingTags.some((tag) => tag.localeCompare(suggestion, undefined, { sensitivity: "accent" }) === 0)) {
                existingTags.push(suggestion);
            }

            input.value = existingTags.length === 0 ? "" : `${existingTags.join(", ")}, `;
            input.focus();
        });
    });

    document.querySelectorAll("[data-tab-button]").forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.getAttribute("data-tab-target");
            if (!target) {
                return;
            }

            document.querySelectorAll("[data-tab-button]").forEach((item) => {
                item.classList.toggle("is-active", item === button);
            });

            document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
                const matches = panel.getAttribute("data-tab-panel") == target;
                panel.toggleAttribute("hidden", !matches);
                panel.classList.toggle("is-active", matches);
            });
        });
    });
});
