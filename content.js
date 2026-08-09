(async function processConfluencePage() {
  // =========================================================================
  // CONFIGURATION
  // =========================================================================
  const TARGET_HEADING_SUBSTRINGS = [
    "summary",
    "table filter",
    "financials",
    "project metrics",
    "appendix"
  ];

  const MAX_MACRO_WAIT_TIMEOUT_MS = 20000;
  const POLL_INTERVAL_MS = 500;
  const EXPANSION_WAIT_MS = 1500;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeText = (text) => (text || "").toLowerCase().replace(/\s+/g, " ").trim();

  // Step 1: Wait for Stiltsoft dynamic tables to populate
  console.log("[Confluence Exporter] Waiting for dynamic tables to render...");
  const startTime = Date.now();
  while (Date.now() - startTime < MAX_MACRO_WAIT_TIMEOUT_MS) {
    const spinners = document.querySelectorAll(
      ".stiltsoft-table-filter-loading, .aui-icon-wait, .spinner"
    );
    const tablesWithRows = Array.from(
      document.querySelectorAll("table.confluenceTable, table.stiltsoft-tf-table")
    ).filter((t) => t.querySelectorAll("tbody tr").length > 0);

    if (spinners.length === 0 && tablesWithRows.length > 0) break;
    await sleep(POLL_INTERVAL_MS);
  }

  // Step 2: Expand sections under target headings
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
  headings.forEach((heading) => {
    const cleanHeadingText = normalizeText(heading.textContent || heading.innerText);
    const matchesTarget = TARGET_HEADING_SUBSTRINGS.some((target) =>
      cleanHeadingText.includes(normalizeText(target))
    );

    if (matchesTarget) {
      let currentElement = heading.nextElementSibling;
      while (currentElement && !["H1", "H2", "H3"].includes(currentElement.tagName)) {
        if (currentElement.tagName === "DETAILS" && !currentElement.open) {
          currentElement.open = true;
        }

        const expandTriggers = currentElement.querySelectorAll(
          'details:not([open]), .expand-control, [aria-expanded="false"], .ak-editor-expand'
        );
        expandTriggers.forEach((trigger) => {
          if (trigger.tagName === "DETAILS") trigger.open = true;
          else if (typeof trigger.click === "function") trigger.click();
        });

        currentElement = currentElement.nextElementSibling;
      }
    }
  });

  await sleep(EXPANSION_WAIT_MS);

  // =========================================================================
  // STEP 3: SANITIZE DOM (Stops Offline Network Requests & Redirects)
  // =========================================================================
  const domClone = document.documentElement.cloneNode(true);

  // 1. Remove all <script> tags so JS can never run offline
  domClone.querySelectorAll("script").forEach((el) => el.remove());

  // 2. Remove iframes or external media triggers
  domClone.querySelectorAll("iframe, object, embed").forEach((el) => el.remove());

  // 3. Remove META refresh tags that force redirects
  domClone.querySelectorAll('meta[http-equiv="refresh"]').forEach((el) => el.remove());

  // 4. Disable base href redirects
  domClone.querySelectorAll("base").forEach((el) => el.remove());

  const cleanHtml = "<!DOCTYPE html>\n" + domClone.outerHTML;
  const pageTitle = document.title || "confluence_page";

  // Send clean HTML back to background script
  chrome.runtime.sendMessage({
    action: "download_clean_html",
    title: pageTitle,
    html: cleanHtml
  });

  console.log("[Confluence Exporter] Clean static HTML generated and sent.");
})();
