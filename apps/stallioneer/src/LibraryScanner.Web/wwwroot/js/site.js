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
