document.addEventListener("DOMContentLoaded", () => {
    const unsavedChangesForm = document.querySelector("[data-unsaved-changes-form]");
    if (unsavedChangesForm instanceof HTMLFormElement) {
        let allowNavigation = false;
        const navigationMessage = "Discard unsaved changes?";
        let initialFormState = new FormData(unsavedChangesForm);

        const formStatesMatch = (left, right) => {
            const leftEntries = Array.from(left.entries());
            const rightEntries = Array.from(right.entries());
            if (leftEntries.length !== rightEntries.length) {
                return false;
            }

            return leftEntries.every(([key, value], index) => {
                const [otherKey, otherValue] = rightEntries[index] ?? [];
                return key === otherKey && String(value) === String(otherValue);
            });
        };

        const hasUnsavedChanges = () => !formStatesMatch(initialFormState, new FormData(unsavedChangesForm));

        const confirmNavigation = () => {
            if (allowNavigation || !hasUnsavedChanges()) {
                return true;
            }

            return window.confirm(navigationMessage);
        };

        unsavedChangesForm.addEventListener("submit", () => {
            allowNavigation = true;
        });

        window.addEventListener("beforeunload", (event) => {
            if (allowNavigation || !hasUnsavedChanges()) {
                return;
            }

            event.preventDefault();
            event.returnValue = "";
        });

        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const link = target.closest("a[href]");
            if (!(link instanceof HTMLAnchorElement)) {
                return;
            }

            const href = link.getAttribute("href");
            if (!href || href === "#" || href.startsWith("javascript:")) {
                return;
            }

            if (!confirmNavigation()) {
                event.preventDefault();
                return;
            }

            allowNavigation = true;
        });

        document.addEventListener("submit", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLFormElement) || target === unsavedChangesForm) {
                return;
            }

            if (!confirmNavigation()) {
                event.preventDefault();
                return;
            }

            allowNavigation = true;
        });

        window.setTimeout(() => {
            initialFormState = new FormData(unsavedChangesForm);
        }, 0);
    }

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

    const rawEditTagData = document.getElementById("edit-tag-data")?.textContent ?? "[]";
    const editTags = JSON.parse(rawEditTagData);
    const normalizeTagSearch = (value) => value.trim().replace(/\s+/g, " ").toUpperCase();
    const escapeTagHtml = (value) => String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
    const getActiveTagToken = (value) => {
        const boundary = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
        return value.slice(boundary + 1).trim();
    };
    const splitTagValues = (value) => value
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean);

    const addTagToEditor = (editor, tagName) => {
        if (!(editor instanceof HTMLElement)) {
            return;
        }

        const input = editor.querySelector("[data-live-tag-input]");
        const results = editor.querySelector("[data-live-tag-results]");
        if (!(input instanceof HTMLInputElement)) {
            return;
        }

        const existingTags = splitTagValues(input.value);
        if (!existingTags.some((tag) => tag.localeCompare(tagName, undefined, { sensitivity: "accent" }) === 0)) {
            existingTags.push(tagName.trim());
        }

        input.value = existingTags.length === 0 ? "" : `${existingTags.join(", ")}, `;
        if (results instanceof HTMLElement) {
            results.hidden = true;
        }

        input.focus();
    };

    const renderLiveTagResults = (editor) => {
        if (!(editor instanceof HTMLElement)) {
            return;
        }

        const input = editor.querySelector("[data-live-tag-input]");
        const results = editor.querySelector("[data-live-tag-results]");
        if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) {
            return;
        }

        const token = getActiveTagToken(input.value);
        const query = normalizeTagSearch(token);
        const matchingTags = query.length === 0
            ? editTags.slice(0, 8)
            : editTags
                .filter((tag) => normalizeTagSearch(`${tag.name ?? tag.Name ?? ""} ${tag.description ?? tag.Description ?? ""}`).includes(query))
                .slice(0, 8);

        if (matchingTags.length === 0 && query.length === 0) {
            results.hidden = true;
            results.innerHTML = "";
            return;
        }

        const exactExists = query.length > 0 && editTags.some((tag) => normalizeTagSearch(tag.name ?? tag.Name ?? "") === query);
        const items = matchingTags.map((tag) => {
            const name = tag.name ?? tag.Name;
            const description = tag.description ?? tag.Description ?? "";
            const color = tag.color ?? tag.Color ?? "#245f4c";
            return `
                <button type="button" class="tag-search-item" data-live-tag-value="${escapeTagHtml(name)}">
                    <span class="tag-pill" style="--tag-color:${escapeTagHtml(color)}">${escapeTagHtml(name)}</span>
                    <span class="tag-search-meta">${description ? escapeTagHtml(description) : "Existing tag"}</span>
                </button>`;
        });

        if (query.length > 0 && !exactExists) {
            items.unshift(`
                <button type="button" class="tag-search-item" data-create-live-tag="${escapeTagHtml(token)}">
                    <span class="tag-search-meta">Create and use: <strong>${escapeTagHtml(token)}</strong></span>
                </button>`);
        }

        results.innerHTML = items.join("");
        results.hidden = false;
    };

    const initializeLiveTagEditors = (scope) => {
        const root = scope instanceof Element || scope instanceof Document ? scope : document;
        root.querySelectorAll("[data-live-tag-editor]").forEach((editor) => {
            if (!(editor instanceof HTMLElement) || editor.dataset.tagEditorBound === "true") {
                return;
            }

            const input = editor.querySelector("[data-live-tag-input]");
            const results = editor.querySelector("[data-live-tag-results]");
            if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) {
                return;
            }

            input.addEventListener("input", () => renderLiveTagResults(editor));
            input.addEventListener("focus", () => renderLiveTagResults(editor));
            input.addEventListener("keydown", (event) => {
                if (event.key !== "Enter") {
                    return;
                }

                const token = getActiveTagToken(input.value);
                if (!token) {
                    return;
                }

                event.preventDefault();
                addTagToEditor(editor, token);
            });
            input.addEventListener("blur", () => {
                window.setTimeout(() => {
                    results.hidden = true;
                }, 120);
            });

            results.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                const button = target.closest("[data-live-tag-value], [data-create-live-tag]");
                if (!(button instanceof HTMLElement)) {
                    return;
                }

                const tagValue = button.getAttribute("data-live-tag-value") ?? button.getAttribute("data-create-live-tag");
                if (!tagValue) {
                    return;
                }

                addTagToEditor(editor, tagValue);
            });

            editor.dataset.tagEditorBound = "true";
        });
    };

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

    initializeLiveTagEditors(document);

    const editInventory = document.querySelector("[data-edit-inventory]");
    if (editInventory instanceof HTMLElement) {
        const addCopyButton = editInventory.querySelector("[data-copy-add]");
        const copyList = editInventory.querySelector("[data-copy-list]");
        const copyTemplate = document.querySelector("#copy-card-template");
        const copyCount = editInventory.querySelector("[data-copy-count]");

        const renumberCopyCards = () => {
            if (!(copyList instanceof HTMLElement)) {
                return;
            }

            const cards = Array.from(copyList.querySelectorAll("[data-copy-card]"));
            cards.forEach((card, index) => {
                const title = card.querySelector("[data-copy-title]");
                if (title instanceof HTMLElement) {
                    title.textContent = `Copy ${index + 1}`;
                }

                const idField = card.querySelector("[data-copy-field='id']");
                if (idField instanceof HTMLInputElement) {
                    idField.name = `Input.Copies[${index}].Id`;
                    idField.id = `Input_Copies_${index}__Id`;
                }

                const removeToggle = card.querySelector("[data-copy-remove]");
                if (removeToggle instanceof HTMLElement) {
                    removeToggle.hidden = cards.length <= 1;
                }

                const removeField = card.querySelector("[data-copy-field='remove']");
                if (removeField instanceof HTMLInputElement) {
                    removeField.name = `Input.Copies[${index}].Remove`;
                    removeField.id = `Input_Copies_${index}__Remove`;
                }

                const locationField = card.querySelector("[data-copy-field='location']");
                if (locationField instanceof HTMLSelectElement) {
                    locationField.name = `Input.Copies[${index}].LocationId`;
                    locationField.id = `Input_Copies_${index}__LocationId`;
                }

                const conditionField = card.querySelector("[data-copy-field='condition']");
                if (conditionField instanceof HTMLSelectElement) {
                    conditionField.name = `Input.Copies[${index}].Condition`;
                    conditionField.id = `Input_Copies_${index}__Condition`;
                }

                const statusField = card.querySelector("[data-copy-field='status']");
                if (statusField instanceof HTMLSelectElement) {
                    statusField.name = `Input.Copies[${index}].Status`;
                    statusField.id = `Input_Copies_${index}__Status`;
                }

                const notesField = card.querySelector("[data-copy-field='notes']");
                if (notesField instanceof HTMLTextAreaElement) {
                    notesField.name = `Input.Copies[${index}].Notes`;
                    notesField.id = `Input_Copies_${index}__Notes`;
                }

                const tagsField = card.querySelector("[data-copy-field='tags']");
                if (tagsField instanceof HTMLInputElement) {
                    tagsField.name = `Input.Copies[${index}].TagNames`;
                    tagsField.id = `Input_Copies_${index}__TagNames`;
                }
            });

            if (copyCount instanceof HTMLElement) {
                copyCount.textContent = cards.length === 1 ? "1 copy" : `${cards.length} copies`;
            }
        };

        const createCopyCard = () => {
            if (!(copyTemplate instanceof HTMLTemplateElement)) {
                return null;
            }

            const fragment = copyTemplate.content.cloneNode(true);
            const card = fragment.querySelector("[data-copy-card]");
            if (!(card instanceof HTMLElement)) {
                return null;
            }

            return card;
        };

        if (addCopyButton instanceof HTMLButtonElement && copyList instanceof HTMLElement) {
            addCopyButton.addEventListener("click", () => {
                const newCard = createCopyCard();
                if (!newCard) {
                    return;
                }

                copyList.appendChild(newCard);
                initializeLiveTagEditors(newCard);
                renumberCopyCards();
            });
        }

        renumberCopyCards();
    }

    const additionalInfoList = document.querySelector("[data-additional-info-list]");
    const additionalInfoTemplate = document.querySelector("#additional-info-template");
    const addAdditionalInfoButton = document.querySelector("[data-add-additional-info]");

    const renumberAdditionalInfoRows = () => {
        if (!(additionalInfoList instanceof HTMLElement)) {
            return;
        }

        const rows = Array.from(additionalInfoList.querySelectorAll("[data-additional-info-row]"));
        rows.forEach((row, index) => {
            const idField = row.querySelector("[data-additional-info-field='id']");
            if (idField instanceof HTMLInputElement) {
                idField.name = `Input.AdditionalInfos[${index}].Id`;
                idField.id = `Input_AdditionalInfos_${index}__Id`;
            }

            const typeField = row.querySelector("[data-additional-info-field='type']");
            if (typeField instanceof HTMLSelectElement) {
                typeField.name = `Input.AdditionalInfos[${index}].Type`;
                typeField.id = `Input_AdditionalInfos_${index}__Type`;
            }

            const labelField = row.querySelector("[data-additional-info-field='label']");
            if (labelField instanceof HTMLInputElement) {
                labelField.name = `Input.AdditionalInfos[${index}].Label`;
                labelField.id = `Input_AdditionalInfos_${index}__Label`;
            }

            const valueField = row.querySelector("[data-additional-info-field='value']");
            if (valueField instanceof HTMLTextAreaElement) {
                valueField.name = `Input.AdditionalInfos[${index}].Value`;
                valueField.id = `Input_AdditionalInfos_${index}__Value`;
            }
        });
    };

    if (addAdditionalInfoButton instanceof HTMLButtonElement && additionalInfoList instanceof HTMLElement && additionalInfoTemplate instanceof HTMLTemplateElement) {
        addAdditionalInfoButton.addEventListener("click", () => {
            const fragment = additionalInfoTemplate.content.cloneNode(true);
            additionalInfoList.appendChild(fragment);
            renumberAdditionalInfoRows();
        });
    }

    if (additionalInfoList instanceof HTMLElement) {
        additionalInfoList.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.closest("[data-remove-additional-info]")) {
                return;
            }

            const row = target.closest("[data-additional-info-row]");
            row?.remove();
            if (additionalInfoList.querySelectorAll("[data-additional-info-row]").length === 0 && addAdditionalInfoButton instanceof HTMLButtonElement) {
                addAdditionalInfoButton.click();
            } else {
                renumberAdditionalInfoRows();
            }
        });

        renumberAdditionalInfoRows();
    }
});
