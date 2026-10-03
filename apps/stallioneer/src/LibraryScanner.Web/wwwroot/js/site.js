document.addEventListener("DOMContentLoaded", () => {
    const authBaseUrl = document.body?.getAttribute("data-stallioneer-auth-base-url")?.replace(/\/$/, "") || "https://auth.jeffersonwm.com";
    const brandLink = document.querySelector(".page-banner__brand");
    const appHomeUrl = brandLink instanceof HTMLAnchorElement ? brandLink.href : `${window.location.origin}/`;
    const localAuthStatusUrl = new URL("api/auth/status", appHomeUrl).toString();
    const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
    let authPopupPoll = null;

    const applyThemePreference = (theme) => {
        const normalizedTheme = ["light", "dark", "system"].includes(theme) ? theme : "system";
        document.documentElement.dataset.theme = normalizedTheme;
        localStorage.setItem("stallioneer-theme", normalizedTheme);
        document.querySelectorAll("[data-theme-choice]").forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }

            const isActive = button.dataset.themeChoice === normalizedTheme;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    };

    applyThemePreference(localStorage.getItem("stallioneer-theme") || document.documentElement.dataset.theme || "system");

    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
        button.addEventListener("click", () => {
            if (button instanceof HTMLButtonElement) {
                applyThemePreference(button.dataset.themeChoice || "system");
            }
        });
    });

    document.querySelectorAll("[data-page-tabs]").forEach((tabRoot) => {
        if (!(tabRoot instanceof HTMLElement)) {
            return;
        }

        const tabButtons = Array.from(tabRoot.querySelectorAll("[data-page-tab]"))
            .filter((button) => button instanceof HTMLButtonElement);
        const panels = Array.from(tabRoot.querySelectorAll("[data-page-tab-panel]"))
            .filter((panel) => panel instanceof HTMLElement);
        const availableTabs = tabButtons.map((button) => button.dataset.pageTab).filter(Boolean);

        const activateTab = (tabName, updateHash = true) => {
            const nextTab = availableTabs.includes(tabName) ? tabName : availableTabs[0];
            if (!nextTab) {
                return;
            }

            tabButtons.forEach((button) => {
                const isActive = button.dataset.pageTab === nextTab;
                button.classList.toggle("is-active", isActive);
                button.setAttribute("aria-pressed", String(isActive));
            });

            panels.forEach((panel) => {
                const isActive = panel.dataset.pageTabPanel === nextTab;
                panel.classList.toggle("is-active", isActive);
                panel.hidden = !isActive;
            });

            if (updateHash) {
                window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${nextTab}`);
            }
        };

        tabButtons.forEach((button) => {
            button.addEventListener("click", () => activateTab(button.dataset.pageTab || ""));
        });

        activateTab(window.location.hash.replace(/^#/, ""), false);
    });

    document.querySelector("[data-delete-library-form]")?.addEventListener("submit", (event) => {
        const form = event.currentTarget;
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        const deleteCount = form.getAttribute("data-delete-count") || "0";
        if (!window.confirm(`Delete ${deleteCount} library entries? This cannot be undone.`)) {
            event.preventDefault();
        }
    });

    const stopAuthPopupPoll = () => {
        if (authPopupPoll !== null) {
            window.clearInterval(authPopupPoll);
            authPopupPoll = null;
        }
    };

    const showAuthNotice = (message) => {
        let notice = document.querySelector("[data-stallioneer-auth-notice]");
        if (!(notice instanceof HTMLElement)) {
            notice = document.createElement("div");
            notice.className = "auth-notice shell-frame";
            notice.setAttribute("data-stallioneer-auth-notice", "");
            const bodyShell = document.querySelector(".shell-frame--body");
            if (bodyShell?.parentNode) {
                bodyShell.parentNode.insertBefore(notice, bodyShell);
            } else {
                document.body.prepend(notice);
            }
        }

        notice.textContent = message;
    };

    const readLocalAuthStatus = async () => {
        const response = await fetch(localAuthStatusUrl, {
            credentials: "include",
            cache: "no-store"
        });

        if (!response.ok) {
            return null;
        }

        return response.json();
    };

    const refreshAfterAuth = async () => {
        stopAuthPopupPoll();
        try {
            const status = await readLocalAuthStatus();
            if (status?.hasAccess) {
                window.location.reload();
                return;
            }
        } catch {
            // The notice below explains the likely host/cookie mismatch.
        }

        showAuthNotice("Signed in on Auth, but this Stallioneer host cannot read the shared Auth cookie yet. Open Stallioneer through its JeffersonWM domain or local tunnel, and make sure Auth uses SESSION_COOKIE_DOMAIN=.jeffersonwm.com.");
    };

    const openCentralAuth = () => {
        const url = new URL(`${authBaseUrl}/home`);
        url.searchParams.set("returnTo", returnTo);
        url.searchParams.set("popup", "1");

        const width = 440;
        const height = 620;
        const left = Math.max(0, Math.round(window.screenX + ((window.outerWidth - width) / 2)));
        const top = Math.max(0, Math.round(window.screenY + ((window.outerHeight - height) / 2)));
        const popup = window.open(
            url.toString(),
            "stallioneer-auth-popup",
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            window.location.assign(url.toString());
            return;
        }

        popup.focus();
        stopAuthPopupPoll();
        authPopupPoll = window.setInterval(() => {
            if (popup.closed) {
                void refreshAfterAuth();
            }
        }, 700);
    };

    document.querySelectorAll("[data-stallioneer-auth-open]").forEach((button) => {
        button.addEventListener("click", openCentralAuth);
    });

    document.querySelectorAll("[data-stallioneer-auth-sign-out]").forEach((button) => {
        button.addEventListener("click", async () => {
            try {
                await fetch(`${authBaseUrl}/api/auth/logout`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ siteContext: window.location.href })
                });
            } finally {
                window.location.assign(appHomeUrl);
            }
        });
    });

    window.addEventListener("message", (event) => {
        if (event.origin !== authBaseUrl) {
            return;
        }

        if (event.data?.type === "auth:success" || event.data?.type === "auth:logout") {
            void refreshAfterAuth();
        }
    });

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

    document.addEventListener("click", async (event) => {
        const target = event.target;
        const button = target instanceof HTMLElement ? target.closest("[data-copy-text], [data-copy-source]") : null;
        if (!(button instanceof HTMLElement)) {
            return;
        }

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

    const selectAll = document.querySelector("[data-select-all]");
    if (selectAll instanceof HTMLInputElement) {
        const getItems = () => Array.from(document.querySelectorAll("[data-select-item]"))
            .filter((item) => {
                if (!(item instanceof HTMLInputElement)) {
                    return false;
                }

                const row = item.closest("tr");
                return !(row instanceof HTMLTableRowElement) || !row.hidden;
            });

        const syncSelectAllState = () => {
            const items = getItems();
            selectAll.checked = items.length > 0 && items.every((checkbox) => checkbox.checked);
            selectAll.indeterminate = items.some((checkbox) => checkbox.checked) && !selectAll.checked;
        };

        selectAll.addEventListener("change", () => {
            const items = getItems();
            items.forEach((item) => {
                item.checked = selectAll.checked;
                item.dispatchEvent(new Event("change"));
            });
        });

        document.addEventListener("change", (event) => {
            if (event.target instanceof HTMLInputElement && event.target.matches("[data-select-item]")) {
                syncSelectAllState();
            }
        });
    }

    const inventoryFilterForm = document.querySelector("[data-inventory-filter-form]");
    if (inventoryFilterForm instanceof HTMLFormElement) {
        const tableBody = document.querySelector("[data-inventory-table-body]");
        const filterMenu = document.querySelector("[data-inventory-filter-menu]");
        const filterToggle = document.querySelector("[data-inventory-filter-toggle]");
        const filterPopover = document.querySelector("[data-inventory-filter-popover]");
        const sortInput = document.querySelector("[data-inventory-sort-value]");
        const pageNumberInput = document.querySelector("[data-inventory-page-number]");
        const pageSizeInput = document.querySelector("[data-inventory-page-size]");
        const tagModeInput = document.querySelector("[data-inventory-tag-mode-value]");
        const queryInput = document.querySelector("[data-inventory-query]");
        const clearButton = document.querySelector("[data-inventory-filter-clear]");
        const pager = document.querySelector("[data-inventory-pager]");
        const pageSummary = document.querySelector("[data-inventory-page-summary]");
        const previousPageButton = document.querySelector("[data-inventory-page-previous]");
        const nextPageButton = document.querySelector("[data-inventory-page-next]");
        const filterCount = document.querySelector("[data-inventory-filter-count]");
        let currentPage = pageNumberInput instanceof HTMLInputElement ? Number(pageNumberInput.value) || 1 : 1;
        let isLoading = false;

        const escapeHtml = (value) => String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#39;");

        const selectedValues = (name) => Array.from(inventoryFilterForm.querySelectorAll(`input[name="${name}"]:checked`))
            .filter((input) => input instanceof HTMLInputElement)
            .map((input) => input.value);

        const getBaseSort = () => sortInput instanceof HTMLInputElement
            ? sortInput.value.replace(/_desc$/, "") || "title"
            : "title";

        const getQueryParams = (pageNumber, includeHandler = false) => {
            const params = new URLSearchParams();
            const query = queryInput instanceof HTMLInputElement ? queryInput.value.trim() : "";
            const sort = sortInput instanceof HTMLInputElement ? sortInput.value || "title" : "title";
            const pageSize = pageSizeInput instanceof HTMLSelectElement ? pageSizeInput.value : "50";
            const tagMode = tagModeInput instanceof HTMLInputElement ? tagModeInput.value || "and" : "and";

            if (includeHandler) {
                params.set("handler", "InventoryData");
            }
            if (query) {
                params.set("query", query);
            }
            params.set("sort", sort);
            params.set("pageSize", pageSize);
            params.set("pageNumber", String(pageNumber));
            params.set("tagMode", tagMode);
            selectedValues("TagIds").forEach((value) => params.append("tagIds", value));
            selectedValues("CollectionIds").forEach((value) => params.append("collectionIds", value));
            selectedValues("LocationIds").forEach((value) => params.append("locationIds", value));
            selectedValues("Statuses").forEach((value) => params.append("statuses", value));
            return params;
        };

        const updateFilterLabel = () => {
            const baseSort = getBaseSort();
            const isDescending = sortInput instanceof HTMLInputElement && sortInput.value.endsWith("_desc");
            document.querySelectorAll("[data-inventory-sort-option]").forEach((option) => {
                if (!(option instanceof HTMLButtonElement)) {
                    return;
                }

                const active = option.dataset.sort === baseSort;
                option.classList.toggle("is-active", active);
                option.setAttribute("aria-pressed", String(active));
                option.textContent = `${option.dataset.sortLabel ?? option.dataset.sort ?? ""}${active ? (isDescending ? " ↓" : " ↑") : ""}`;
            });

            document.querySelectorAll("[data-inventory-toggle-label]").forEach((label) => {
                if (!(label instanceof HTMLElement)) {
                    return;
                }

                const checkbox = label.querySelector('input[type="checkbox"]');
                const active = checkbox instanceof HTMLInputElement && checkbox.checked;
                label.classList.toggle("is-active", active);
                label.setAttribute("aria-pressed", String(active));
            });
        };

        const renderBooks = (books) => {
            if (!(tableBody instanceof HTMLElement)) {
                return;
            }

            if (!Array.isArray(books) || books.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="form-hint">No books match these filters.</td></tr>';
                if (selectAll instanceof HTMLInputElement) {
                    selectAll.checked = false;
                    selectAll.indeterminate = false;
                }
                return;
            }

            tableBody.innerHTML = books.map((book) => {
                const title = escapeHtml(book.title);
                const authors = escapeHtml(book.authors);
                const publisherLine = book.publisher
                    ? `<small>${escapeHtml(book.publisher)} ${escapeHtml(book.publishedDate)}</small>`
                    : "";
                const titleAuthor = book.authors ? `${book.title} - ${book.authors}` : book.title;
                const cover = book.coverImageUrl
                    ? `<img src="${escapeHtml(book.coverImageUrl)}" alt="" />`
                    : '<div class="cover-placeholder"></div>';
                const collections = (book.collections ?? [])
                    .map((collection) => `<span class="collection-pill">${escapeHtml(collection.name ?? collection.Name ?? collection)}</span>`)
                    .join("");
                const tags = (book.tags ?? [])
                    .map((tag) => {
                        const color = /^#[0-9a-f]{3,8}$/i.test(tag.color ?? "") ? tag.color : "#60708b";
                        return `<span class="tag-pill" style="--tag-color:${color}">${escapeHtml(tag.name ?? tag.Name ?? "")}</span>`;
                    })
                    .join("");

                return `<tr>
                    <td class="selection-column"><input type="checkbox" name="SelectedBookIds" value="${book.id}" data-select-item data-book-id="${book.id}" aria-label="Select ${title}" /></td>
                    <td><div class="book-cell">${cover}<div><div class="copy-line"><a class="book-title-link" href="/Books/Edit?id=${book.id}"><strong>${title}</strong></a><button type="button" class="copy-button" data-copy-text="${escapeHtml(titleAuthor)}" title="Copy title and author" aria-label="Copy title and author"><span class="copy-icon" aria-hidden="true"></span></button></div><span>${authors}</span>${publisherLine}</div></div></td>
                    <td><div class="copy-line"><span>${escapeHtml(book.isbn13)}</span><button type="button" class="copy-button" data-copy-text="${escapeHtml(book.isbn13)}" title="Copy ISBN" aria-label="Copy ISBN"><span class="copy-icon" aria-hidden="true"></span></button></div></td>
                    <td>${escapeHtml(book.quantity)}</td>
                    <td><div class="tag-list tag-list--metadata">${collections}${tags}</div></td>
                    <td><span class="status-pill">${escapeHtml(book.status)}</span></td>
                </tr>`;
            }).join("");

            if (selectAll instanceof HTMLInputElement) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
        };

        const renderPager = (data) => {
            currentPage = Number(data.pageNumber) || 1;
            if (pageNumberInput instanceof HTMLInputElement) {
                pageNumberInput.value = String(currentPage);
            }
            if (pageSummary instanceof HTMLElement) {
                pageSummary.textContent = `Page ${currentPage} of ${data.totalPages} · ${data.filteredCount} books`;
            }
            if (filterCount instanceof HTMLElement) {
                filterCount.textContent = `${data.filteredCount} shown`;
            }
            if (pager instanceof HTMLElement) {
                pager.classList.toggle("is-hidden", Number(data.totalPages) <= 1);
            }
            if (previousPageButton instanceof HTMLButtonElement) {
                previousPageButton.disabled = currentPage <= 1;
            }
            if (nextPageButton instanceof HTMLButtonElement) {
                nextPageButton.disabled = currentPage >= Number(data.totalPages);
            }
        };

        const updateBrowserUrl = () => {
            const query = getQueryParams(currentPage).toString();
            window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
        };

        const loadInventory = async (pageNumber = 1) => {
            if (isLoading) {
                return;
            }

            isLoading = true;
            const params = getQueryParams(pageNumber, true);
            try {
                const response = await fetch(`${window.location.pathname}?${params.toString()}`, {
                    credentials: "same-origin",
                    headers: { Accept: "application/json" }
                });
                if (!response.ok) {
                    throw new Error(`Inventory request failed: ${response.status}`);
                }

                const data = await response.json();
                renderBooks(data.books);
                document.dispatchEvent(new CustomEvent("inventory:books-rendered", {
                    detail: {
                        books: data.books,
                        filteredCount: data.filteredCount
                    }
                }));
                renderPager(data);
                updateFilterLabel();
                updateBrowserUrl();
            } catch {
                window.location.assign(`${window.location.pathname}?${getQueryParams(pageNumber).toString()}`);
            } finally {
                isLoading = false;
            }
        };

        const closeFilters = () => {
            if (filterPopover instanceof HTMLElement) {
                filterPopover.hidden = true;
            }
            if (filterToggle instanceof HTMLButtonElement) {
                filterToggle.setAttribute("aria-expanded", "false");
            }
        };

        filterToggle?.addEventListener("click", () => {
            if (!(filterPopover instanceof HTMLElement) || !(filterToggle instanceof HTMLButtonElement)) {
                return;
            }
            const willOpen = filterPopover.hidden;
            filterPopover.hidden = !willOpen;
            filterToggle.setAttribute("aria-expanded", String(willOpen));
        });

        document.addEventListener("click", (event) => {
            if (filterMenu instanceof HTMLElement && event.target instanceof Node && !filterMenu.contains(event.target)) {
                closeFilters();
            }
        });

        inventoryFilterForm.addEventListener("submit", (event) => {
            event.preventDefault();
            closeFilters();
            void loadInventory(1);
        });

        document.querySelectorAll("[data-inventory-sort-option]").forEach((option) => {
            option.addEventListener("click", () => {
                if (!(option instanceof HTMLButtonElement) || !(sortInput instanceof HTMLInputElement)) {
                    return;
                }
                const requestedSort = option.dataset.sort;
                if (!requestedSort) {
                    return;
                }
                sortInput.value = getBaseSort() === requestedSort && !sortInput.value.endsWith("_desc")
                    ? `${requestedSort}_desc`
                    : requestedSort;
                void loadInventory(1);
            });
        });

        pageSizeInput?.addEventListener("change", () => void loadInventory(1));
        inventoryFilterForm.querySelectorAll('input[name="TagIds"], input[name="CollectionIds"], input[name="LocationIds"], input[name="Statuses"]').forEach((input) => {
            input.addEventListener("change", () => {
                updateFilterLabel();
                void loadInventory(1);
            });
        });
        clearButton?.addEventListener("click", () => {
            if (queryInput instanceof HTMLInputElement) {
                queryInput.value = "";
            }
            if (sortInput instanceof HTMLInputElement) {
                sortInput.value = "title";
            }
            if (tagModeInput instanceof HTMLInputElement) {
                tagModeInput.value = "and";
            }
            inventoryFilterForm.querySelectorAll('input[name="TagIds"], input[name="CollectionIds"], input[name="LocationIds"], input[name="Statuses"]').forEach((input) => {
                if (input instanceof HTMLInputElement) {
                    input.checked = false;
                }
            });
            closeFilters();
            void loadInventory(1);
        });
        previousPageButton?.addEventListener("click", () => void loadInventory(Math.max(1, currentPage - 1)));
        nextPageButton?.addEventListener("click", () => void loadInventory(currentPage + 1));
        updateFilterLabel();
    }

    const rawTagData = document.getElementById("tag-data")?.textContent
        ?? document.getElementById("edit-tag-data")?.textContent
        ?? "[]";
    const availableTags = JSON.parse(rawTagData);
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
    const getTagEntryName = (value) => {
        const [name] = value.split("|", 1);
        return name?.trim() ?? "";
    };
    const hasMatchingTagName = (entries, candidate) => {
        const candidateName = normalizeTagSearch(getTagEntryName(candidate));
        return entries.some((entry) => normalizeTagSearch(getTagEntryName(entry)) === candidateName);
    };

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
        if (!hasMatchingTagName(existingTags, tagName)) {
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
            ? availableTags
            : availableTags
                .filter((tag) => normalizeTagSearch(`${tag.name ?? tag.Name ?? ""} ${tag.description ?? tag.Description ?? ""}`).includes(query));

        if (matchingTags.length === 0 && query.length === 0) {
            results.hidden = true;
            results.innerHTML = "";
            return;
        }

        const exactExists = query.length > 0 && availableTags.some((tag) => normalizeTagSearch(tag.name ?? tag.Name ?? "") === query);
        const items = matchingTags.map((tag) => {
            const name = tag.name ?? tag.Name;
            const description = tag.description ?? tag.Description ?? "";
            const color = tag.color ?? tag.Color ?? "#245f4c";
            const title = description ? `${name} - ${description}` : name;
            return `
                <button type="button" class="tag-search-item" data-live-tag-value="${escapeTagHtml(name)}" title="${escapeTagHtml(title)}" aria-label="${escapeTagHtml(title)}">
                    <span class="tag-pill" style="--tag-color:${escapeTagHtml(color)}">${escapeTagHtml(name)}</span>
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

            if (!hasMatchingTagName(existingTags, suggestion)) {
                existingTags.push(suggestion);
            }

            input.value = existingTags.length === 0 ? "" : `${existingTags.join(", ")}, `;
            input.focus();
        });
    });

    initializeLiveTagEditors(document);

    const inventorySelectionPanel = document.querySelector("[data-inventory-selection-panel]");
    if (inventorySelectionPanel instanceof HTMLElement) {
        const rawInventorySelectionData = document.getElementById("inventory-selection-data")?.textContent ?? "[]";
        let inventoryBooks = JSON.parse(rawInventorySelectionData);
        let inventoryBookMap = new Map(inventoryBooks.map((book) => [String(book.id ?? book.Id), book]));
        const selectedCountText = inventorySelectionPanel.querySelector("[data-inventory-selected-count]");
        const visibleCountText = inventorySelectionPanel.querySelector("[data-inventory-visible-count]");
        const emptyState = inventorySelectionPanel.querySelector("[data-inventory-empty-state]");
        const sharedSection = inventorySelectionPanel.querySelector("[data-inventory-selection-shared]");
        const sharedTags = inventorySelectionPanel.querySelector("[data-inventory-shared-tags]");
        const sharedCollections = inventorySelectionPanel.querySelector("[data-inventory-shared-collections]");
        const sharedStatus = inventorySelectionPanel.querySelector("[data-inventory-shared-status]");
        const sharedLocation = inventorySelectionPanel.querySelector("[data-inventory-shared-location]");
        const tagModeInput = document.querySelector("[data-inventory-tag-mode-value]");
        const inventoryFilterForm = document.querySelector("[data-inventory-filter-form]");
        const tagModeButtons = Array.from(document.querySelectorAll("[data-inventory-tag-mode]"))
            .filter((button) => button instanceof HTMLButtonElement);

        const getSelectionInputs = () => Array.from(document.querySelectorAll("[data-select-item]"))
            .filter((item) => item instanceof HTMLInputElement);
        const selectedTagIds = () => Array.from(document.querySelectorAll('input[name="TagIds"]:checked'))
            .filter((input) => input instanceof HTMLInputElement)
            .map((input) => input.value);
        const distinctValues = (values) => Array.from(new Set(values.filter((value) => value && value.length > 0)));
        const getIntersection = (lists, keySelector) => {
            if (lists.length === 0) {
                return [];
            }

            const firstList = lists[0] ?? [];
            return firstList.filter((item) => {
                const key = keySelector(item);
                return lists.every((list) => list.some((candidate) => keySelector(candidate) === key));
            });
        };
        const renderEmpty = (container, message) => {
            if (container instanceof HTMLElement) {
                container.innerHTML = `<span class="form-hint">${escapeTagHtml(message)}</span>`;
            }
        };
        const renderPills = (container, items, className, emptyMessage, titleSelector) => {
            if (!(container instanceof HTMLElement)) {
                return;
            }

            if (items.length === 0) {
                renderEmpty(container, emptyMessage);
                return;
            }

            container.innerHTML = items.map((item) => {
                const label = item.name ?? item.Name ?? item;
                const title = titleSelector ? titleSelector(item) : "";
                return `<span class="${className}"${title ? ` title="${escapeTagHtml(title)}"` : ""}>${escapeTagHtml(label)}</span>`;
            }).join("");
        };
        const renderTextPills = (container, values, className, emptyMessage) => {
            if (!(container instanceof HTMLElement)) {
                return;
            }

            if (values.length === 0) {
                renderEmpty(container, emptyMessage);
                return;
            }

            container.innerHTML = values
                .map((value) => `<span class="${className}">${escapeTagHtml(value)}</span>`)
                .join("");
        };
        const syncTagModeButtons = () => {
            const activeMode = tagModeInput instanceof HTMLInputElement && tagModeInput.value === "or" ? "or" : "and";
            tagModeButtons.forEach((button) => {
                const isActive = button.dataset.inventoryTagMode === activeMode;
                button.classList.toggle("is-active", isActive);
                button.setAttribute("aria-pressed", String(isActive));
            });
        };
        const submitInventoryFilters = () => {
            if (inventoryFilterForm instanceof HTMLFormElement) {
                inventoryFilterForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            }
        };
        const renderTagToggles = (selectedBooks) => {
            if (!(sharedTags instanceof HTMLElement)) {
                return;
            }

            if (availableTags.length === 0) {
                renderEmpty(sharedTags, "No tags yet");
                return;
            }

            const activeTagIds = selectedTagIds();
            const activeMode = tagModeInput instanceof HTMLInputElement && tagModeInput.value === "or" ? "OR" : "AND";
            const selectedTotal = selectedBooks.length;
            sharedTags.innerHTML = availableTags.map((tag) => {
                const id = String(tag.id ?? tag.Id);
                const label = tag.name ?? tag.Name ?? "";
                const description = tag.description ?? tag.Description ?? "";
                const color = tag.color ?? tag.Color ?? "#2563eb";
                const appliedCount = selectedBooks.filter((book) => {
                    const bookTags = book.tags ?? book.Tags ?? [];
                    return bookTags.some((bookTag) => String(bookTag.id ?? bookTag.Id) === id);
                }).length;
                const hasSelection = selectedTotal > 0;
                const isFilterActive = !hasSelection && activeTagIds.includes(id);
                const isActive = hasSelection && appliedCount === selectedTotal;
                const isMixed = appliedCount > 0 && appliedCount < selectedTotal;
                const stateLabel = !hasSelection
                    ? isFilterActive ? `filtering visible books by this tag (${activeMode})` : "click to filter visible books by this tag"
                    : isActive ? "on all selected books" : isMixed ? "on some selected books" : "off";
                const classes = [
                    "tag-pill",
                    "tag-toggle-button",
                    !hasSelection ? "is-filter-toggle" : "",
                    isFilterActive ? "is-filter-active" : "",
                    isFilterActive && activeTagIds.length > 1 ? "is-filter-combined" : "",
                    isActive ? "is-active" : "",
                    isMixed ? "is-mixed" : ""
                ].filter(Boolean).join(" ");

                return `<button type="button" class="${classes}" style="--tag-color:${escapeTagHtml(color)}" data-inventory-tag-toggle="${escapeTagHtml(id)}" title="${escapeTagHtml(description || `${label} is ${stateLabel}`)}">${escapeTagHtml(label)}</button>`;
            }).join("");
        };
        const updateInventorySelectionSummary = () => {
            const selectedBooks = getSelectionInputs()
                .filter((input) => input.checked)
                .map((input) => inventoryBookMap.get(input.dataset.bookId ?? input.value))
                .filter(Boolean);

            if (selectedCountText instanceof HTMLElement) {
                selectedCountText.textContent = selectedBooks.length === 0
                    ? "No books selected yet."
                    : `${selectedBooks.length} book${selectedBooks.length === 1 ? "" : "s"} selected.`;
            }

            renderTagToggles(selectedBooks);
            syncTagModeButtons();

            if (!(sharedSection instanceof HTMLElement) || !(emptyState instanceof HTMLElement)) {
                return;
            }

            if (selectedBooks.length === 0) {
                sharedSection.hidden = true;
                emptyState.hidden = false;
                return;
            }

            const collectionLists = selectedBooks.map((book) => book.collections ?? book.Collections ?? []);
            const sharedCollectionItems = getIntersection(collectionLists, (collection) => String(collection.id ?? collection.Id ?? collection.name ?? collection.Name));
            const statusValues = distinctValues(selectedBooks.map((book) => book.status ?? book.Status ?? ""));
            const locationValues = distinctValues(selectedBooks.map((book) => book.locationName ?? book.LocationName ?? "No location"));

            renderPills(sharedCollections, sharedCollectionItems, "status-pill collection-pill", "No shared collections", (collection) => collection.description ?? collection.Description ?? "");
            renderTextPills(sharedStatus, statusValues, "status-pill", "No availability set");
            renderTextPills(sharedLocation, locationValues, "status-pill", "No location");

            sharedSection.hidden = false;
            emptyState.hidden = true;
        };

        document.addEventListener("change", (event) => {
            if (event.target instanceof HTMLInputElement && event.target.matches("[data-select-item], input[name='TagIds']")) {
                updateInventorySelectionSummary();
            }
        });

        document.addEventListener("inventory:books-rendered", (event) => {
            const detail = event instanceof CustomEvent ? event.detail : {};
            inventoryBooks = Array.isArray(detail.books) ? detail.books : [];
            inventoryBookMap = new Map(inventoryBooks.map((book) => [String(book.id ?? book.Id), book]));
            if (visibleCountText instanceof HTMLElement) {
                visibleCountText.textContent = String(inventoryBooks.length);
            }
            updateInventorySelectionSummary();
        });

        tagModeButtons.forEach((button) => {
            button.addEventListener("click", () => {
                if (tagModeInput instanceof HTMLInputElement) {
                    tagModeInput.value = button.dataset.inventoryTagMode === "or" ? "or" : "and";
                }
                syncTagModeButtons();
                if (selectedTagIds().length > 0) {
                    submitInventoryFilters();
                } else {
                    updateInventorySelectionSummary();
                }
            });
        });

        if (sharedTags instanceof HTMLElement) {
            sharedTags.addEventListener("click", (event) => {
                const button = event.target instanceof Element
                    ? event.target.closest("[data-inventory-tag-toggle]")
                    : null;
                if (!(button instanceof HTMLButtonElement)) {
                    return;
                }

                const hasSelection = getSelectionInputs().some((input) => input.checked);
                if (hasSelection) {
                    return;
                }

                const tagId = button.dataset.inventoryTagToggle ?? "";
                const tagInputs = Array.from(document.querySelectorAll('input[name="TagIds"]'))
                    .filter((input) => input instanceof HTMLInputElement);
                const targetInput = tagInputs.find((input) => input.value === tagId);
                if (!(targetInput instanceof HTMLInputElement)) {
                    return;
                }

                if (event instanceof MouseEvent && (event.ctrlKey || event.metaKey)) {
                    targetInput.checked = !targetInput.checked;
                } else {
                    const onlyActiveTag = selectedTagIds().length === 1 && targetInput.checked;
                    tagInputs.forEach((input) => {
                        input.checked = false;
                    });
                    targetInput.checked = !onlyActiveTag;
                }

                updateInventorySelectionSummary();
                submitInventoryFilters();
            });
        }

        updateInventorySelectionSummary();
    }

    const editInventory = document.querySelector("[data-edit-inventory]");
    if (editInventory instanceof HTMLElement) {
        const addCopyButton = editInventory.querySelector("[data-copy-add]");
        const duplicateCopyButton = editInventory.querySelector("[data-copy-duplicate]");
        const removeCopyButton = editInventory.querySelector("[data-copy-remove-active]");
        const copyList = editInventory.querySelector("[data-copy-list]");
        const copyTemplate = document.querySelector("#copy-card-template");
        const copyCount = editInventory.querySelector("[data-copy-count]");
        const copySelector = editInventory.querySelector("[data-copy-selector]");
        let activeCopyIndex = copySelector instanceof HTMLSelectElement ? Number(copySelector.value) || 0 : 0;

        const getCopyCards = () => copyList instanceof HTMLElement
            ? Array.from(copyList.querySelectorAll("[data-copy-card]"))
            : [];

        const isCopyRemoved = (card) => {
            const removeField = card.querySelector("[data-copy-field='remove']");
            return removeField instanceof HTMLInputElement && removeField.checked;
        };

        const getVisibleCopyCards = () => getCopyCards().filter((card) => !isCopyRemoved(card));

        const getCopyOptionText = (card, index) => {
            const locationField = card.querySelector("[data-copy-field='location']");
            const statusField = card.querySelector("[data-copy-field='status']");
            const removeField = card.querySelector("[data-copy-field='remove']");
            const locationText = locationField instanceof HTMLSelectElement
                ? locationField.selectedOptions[0]?.textContent?.trim()
                : "";
            const statusText = statusField instanceof HTMLSelectElement ? statusField.value.trim() : "";
            const suffix = [statusText, locationText && locationText !== "No location" ? locationText : ""]
                .filter(Boolean)
                .join(" / ");
            const removed = removeField instanceof HTMLInputElement && removeField.checked;
            return `Copy ${index + 1}${suffix ? ` - ${suffix}` : ""}${removed ? " - remove" : ""}`;
        };

        const syncCopySelector = (cards) => {
            if (!(copySelector instanceof HTMLSelectElement)) {
                return;
            }

            copySelector.innerHTML = "";
            const visibleCards = cards.filter((card) => !isCopyRemoved(card));
            visibleCards.forEach((card, visibleIndex) => {
                const cardIndex = cards.indexOf(card);
                const option = document.createElement("option");
                option.value = String(cardIndex);
                option.textContent = getCopyOptionText(card, visibleIndex);
                copySelector.appendChild(option);
            });

            if (visibleCards.length === 0) {
                activeCopyIndex = 0;
                return;
            }

            if (isCopyRemoved(cards[activeCopyIndex])) {
                activeCopyIndex = cards.indexOf(visibleCards[Math.min(activeCopyIndex, visibleCards.length - 1)]);
            }
            copySelector.value = String(activeCopyIndex);
        };

        const showActiveCopyCard = (cards = getCopyCards()) => {
            const visibleCards = cards.filter((card) => !isCopyRemoved(card));
            if (visibleCards.length === 0) {
                return;
            }

            if (!cards[activeCopyIndex] || isCopyRemoved(cards[activeCopyIndex])) {
                activeCopyIndex = cards.indexOf(visibleCards[0]);
            }
            cards.forEach((card, index) => {
                if (card instanceof HTMLElement) {
                    card.hidden = index !== activeCopyIndex || isCopyRemoved(card);
                }
            });

            if (copySelector instanceof HTMLSelectElement) {
                copySelector.value = String(activeCopyIndex);
            }

            if (removeCopyButton instanceof HTMLButtonElement) {
                removeCopyButton.hidden = visibleCards.length <= 1;
                removeCopyButton.disabled = visibleCards.length <= 1;
            }
        };

        const renumberCopyCards = () => {
            if (!(copyList instanceof HTMLElement)) {
                return;
            }

            const cards = getCopyCards();
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

                const removeField = card.querySelector("[data-copy-field='remove']");
                if (removeField instanceof HTMLInputElement) {
                    removeField.name = `Input.Copies[${index}].Remove`;
                    removeField.id = `Input_Copies_${index}__Remove`;
                }

                const removeHiddenField = card.querySelector("[data-copy-field='remove-hidden']");
                if (removeHiddenField instanceof HTMLInputElement) {
                    removeHiddenField.name = `Input.Copies[${index}].Remove`;
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
                const visibleCount = cards.filter((card) => !isCopyRemoved(card)).length;
                copyCount.textContent = visibleCount === 1 ? "1 copy" : `${visibleCount} copies`;
            }

            syncCopySelector(cards);
            showActiveCopyCard(cards);
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

        const duplicateCopyCard = (sourceCard) => {
            if (!(sourceCard instanceof HTMLElement)) {
                return null;
            }

            const duplicateCard = createCopyCard();
            if (!(duplicateCard instanceof HTMLElement)) {
                return null;
            }

            const fieldNames = ["location", "condition", "status", "notes", "tags"];
            fieldNames.forEach((fieldName) => {
                const sourceField = sourceCard.querySelector(`[data-copy-field='${fieldName}']`);
                const duplicateField = duplicateCard.querySelector(`[data-copy-field='${fieldName}']`);
                if (!sourceField || !duplicateField) {
                    return;
                }

                if (sourceField instanceof HTMLInputElement && duplicateField instanceof HTMLInputElement) {
                    duplicateField.value = sourceField.value;
                    return;
                }

                if (sourceField instanceof HTMLTextAreaElement && duplicateField instanceof HTMLTextAreaElement) {
                    duplicateField.value = sourceField.value;
                    return;
                }

                if (sourceField instanceof HTMLSelectElement && duplicateField instanceof HTMLSelectElement) {
                    duplicateField.value = sourceField.value;
                }
            });

            return duplicateCard;
        };

        if (addCopyButton instanceof HTMLButtonElement && copyList instanceof HTMLElement) {
            addCopyButton.addEventListener("click", () => {
                const newCard = createCopyCard();
                if (!newCard) {
                    return;
                }

                copyList.appendChild(newCard);
                initializeLiveTagEditors(newCard);
                activeCopyIndex = getCopyCards().indexOf(newCard);
                renumberCopyCards();
            });
        }

        if (duplicateCopyButton instanceof HTMLButtonElement && copyList instanceof HTMLElement) {
            duplicateCopyButton.addEventListener("click", () => {
                const cards = getCopyCards();
                const visibleCards = getVisibleCopyCards();
                const sourceCard = cards[activeCopyIndex] && !isCopyRemoved(cards[activeCopyIndex])
                    ? cards[activeCopyIndex]
                    : visibleCards[visibleCards.length - 1];
                const newCard = duplicateCopyCard(sourceCard);
                if (!newCard) {
                    return;
                }

                copyList.appendChild(newCard);
                initializeLiveTagEditors(newCard);
                activeCopyIndex = getCopyCards().indexOf(newCard);
                renumberCopyCards();
            });
        }

        if (removeCopyButton instanceof HTMLButtonElement && copyList instanceof HTMLElement) {
            removeCopyButton.addEventListener("click", () => {
                const cards = getCopyCards();
                const visibleCards = cards.filter((card) => !isCopyRemoved(card));
                if (visibleCards.length <= 1) {
                    return;
                }

                const activeCard = cards[activeCopyIndex];
                if (!(activeCard instanceof HTMLElement)) {
                    return;
                }

                const idField = activeCard.querySelector("[data-copy-field='id']");
                if (idField instanceof HTMLInputElement && idField.value === "0") {
                    const nextVisible = visibleCards.find((card) => card !== activeCard);
                    activeCard.remove();
                    activeCopyIndex = nextVisible ? Math.max(0, getCopyCards().indexOf(nextVisible)) : 0;
                    renumberCopyCards();
                    return;
                }

                const removeField = activeCard.querySelector("[data-copy-field='remove']");
                if (removeField instanceof HTMLInputElement) {
                    removeField.checked = true;
                }

                const remainingCards = getCopyCards().filter((card) => card !== activeCard && !isCopyRemoved(card));
                activeCopyIndex = remainingCards.length > 0 ? getCopyCards().indexOf(remainingCards[0]) : 0;
                renumberCopyCards();
            });
        }

        copySelector?.addEventListener("change", () => {
            if (!(copySelector instanceof HTMLSelectElement)) {
                return;
            }

            activeCopyIndex = Number(copySelector.value) || 0;
            showActiveCopyCard();
        });

        if (copyList instanceof HTMLElement) {
            copyList.addEventListener("change", (event) => {
                const target = event.target;
                if (
                    target instanceof HTMLSelectElement &&
                    ["location", "condition", "status"].includes(target.dataset.copyField ?? "")
                ) {
                    renumberCopyCards();
                    return;
                }

                if (target instanceof HTMLInputElement && target.dataset.copyField === "remove") {
                    renumberCopyCards();
                }
            });
        }

        renumberCopyCards();
    }

    const coverList = document.querySelector("[data-cover-list]");
    const coverTemplate = document.querySelector("#cover-card-template");
    const addCoverButton = document.querySelector("[data-add-cover]");

    const renumberCoverRows = () => {
        if (!(coverList instanceof HTMLElement)) {
            return;
        }

        const rows = Array.from(coverList.querySelectorAll("[data-cover-row]"));
        rows.forEach((row, index) => {
            const idField = row.querySelector("[data-cover-field='id']");
            if (idField instanceof HTMLInputElement) {
                idField.name = `Input.Covers[${index}].Id`;
                idField.id = `Input_Covers_${index}__Id`;
            }

            const labelField = row.querySelector("[data-cover-field='label']");
            if (labelField instanceof HTMLInputElement) {
                labelField.name = `Input.Covers[${index}].Label`;
                labelField.id = `Input_Covers_${index}__Label`;
            }

            const sourceField = row.querySelector("[data-cover-field='source']");
            if (sourceField instanceof HTMLInputElement) {
                sourceField.name = `Input.Covers[${index}].Source`;
                sourceField.id = `Input_Covers_${index}__Source`;
            }

            const urlField = row.querySelector("[data-cover-field='url']");
            if (urlField instanceof HTMLInputElement) {
                urlField.name = `Input.Covers[${index}].Url`;
                urlField.id = `Input_Covers_${index}__Url`;
            }

            const primaryField = row.querySelector("[data-cover-field='primary']");
            if (primaryField instanceof HTMLInputElement) {
                primaryField.name = `Input.Covers[${index}].IsPrimary`;
                primaryField.id = `Input_Covers_${index}__IsPrimary`;
            }

            const primaryHiddenField = row.querySelector("[data-cover-field='primary-hidden']");
            if (primaryHiddenField instanceof HTMLInputElement) {
                primaryHiddenField.name = `Input.Covers[${index}].IsPrimary`;
            }
        });

        const primaryFields = rows
            .map((row) => row.querySelector("[data-cover-field='primary']"))
            .filter((field) => field instanceof HTMLInputElement);

        if (primaryFields.length > 0 && !primaryFields.some((field) => field.checked)) {
            primaryFields[0].checked = true;
        }
    };

    if (addCoverButton instanceof HTMLButtonElement && coverList instanceof HTMLElement && coverTemplate instanceof HTMLTemplateElement) {
        addCoverButton.addEventListener("click", () => {
            const fragment = coverTemplate.content.cloneNode(true);
            coverList.appendChild(fragment);
            renumberCoverRows();
        });
    }

    if (coverList instanceof HTMLElement) {
        coverList.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.closest("[data-remove-cover]")) {
                return;
            }

            const row = target.closest("[data-cover-row]");
            row?.remove();
            if (coverList.querySelectorAll("[data-cover-row]").length === 0 && addCoverButton instanceof HTMLButtonElement) {
                addCoverButton.click();
            } else {
                renumberCoverRows();
            }
        });

        coverList.addEventListener("change", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || target.dataset.coverField !== "primary" || !target.checked) {
                return;
            }

            const primaryFields = coverList.querySelectorAll("[data-cover-field='primary']");
            primaryFields.forEach((field) => {
                if (field instanceof HTMLInputElement && field !== target) {
                    field.checked = false;
                }
            });
        });

        renumberCoverRows();
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
