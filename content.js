(async function processConfluencePage() {
  const TARGET_HEADING_SUBSTRINGS = [
    "summary",
    "table filter",
    "financials",
    "project metrics",
    "appendix"
  ];

  const MACRO_LOAD_WAIT_MS = 3000;
  const EXPANSION_WAIT_MS = 2000;

  console.log("[Confluence Exporter] Script execution started...");

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeText = (text) => {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
  };

  // Wait for dynamic tables/macros
  await sleep(MACRO_LOAD_WAIT_MS);

  // Expand sections under target headings
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
  let expandedCount = 0;

  headings.forEach((heading) => {
    const rawHeadingText = heading.textContent || heading.innerText || "";
    const cleanHeadingText = normalizeText(rawHeadingText);

    const matchesTarget = TARGET_HEADING_SUBSTRINGS.some((target) => {
      return cleanHeadingText.includes(normalizeText(target));
    });

    if (matchesTarget) {
      console.log(`[Confluence Exporter] Matched heading: "${rawHeadingText.trim()}"`);

      let currentElement = heading.nextElementSibling;

      while (currentElement && !["H1", "H2", "H3"].includes(currentElement.tagName)) {
        if (currentElement.tagName === "DETAILS" && !currentElement.open) {
          currentElement.open = true;
          expandedCount++;
        }

        const expandTriggers = currentElement.querySelectorAll(
          'details:not([open]), .expand-control, [aria-expanded="false"], .ak-editor-expand'
        );

        expandTriggers.forEach((trigger) => {
          if (trigger.tagName === "DETAILS") {
            trigger.open = true;
            expandedCount++;
          } else if (typeof trigger.click === "function") {
            trigger.click();
            expandedCount++;
          }
        });

        currentElement = currentElement.nextElementSibling;
      }
    }
  });

  console.log(`[Confluence Exporter] Expanded ${expandedCount} section(s).`);

  // Wait for expansion animation & table rendering
  await sleep(EXPANSION_WAIT_MS);

  // Send request to background script to trigger native MHTML capture
  chrome.runtime.sendMessage({
    action: "download_mhtml",
    title: document.title || "confluence_page"
  });

  console.log("[Confluence Exporter] Expansion complete. Requested MHTML capture.");
})();
