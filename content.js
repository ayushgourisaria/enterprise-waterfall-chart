(async function processConfluencePage() {
  // =========================================================================
  // CONFIGURATION SECTION
  // =========================================================================

  // Add your heading substrings here (Completely case-insensitive)
  const TARGET_HEADING_SUBSTRINGS = [
    "summary",
    "table filter",
    "financials",
    "project metrics",
    "appendix"
  ];

  // Initial wait time (ms) to allow dynamic macros (Stiltsoft, dynamic tables) to render
  const MACRO_LOAD_WAIT_MS = 3000;

  // Post-expansion wait time (ms) before capturing the page HTML
  const EXPANSION_WAIT_MS = 1500;

  // =========================================================================
  // EXECUTION LOGIC
  // =========================================================================

  console.log("[Confluence Exporter] Script execution started...");

  // Helper function: Promise-based delay
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper function: Normalizes text (lowercases + cleans extra spaces/newlines)
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .replace(/\s+/g, " ") // Converts all newlines, tabs, multiple spaces to a single space
      .trim();
  };

  // Step 1: Wait for Stiltsoft table filters and dynamic scripts to finish loading
  await sleep(MACRO_LOAD_WAIT_MS);

  // Step 2: Query all heading elements (H1, H2, H3) on the page
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
  let expandedCount = 0;

  headings.forEach((heading) => {
    // Normalize raw heading text (removes extra spaces and converts to lowercase)
    const rawHeadingText = heading.textContent || heading.innerText || "";
    const cleanHeadingText = normalizeText(rawHeadingText);

    // Check if ANY target substring exists inside cleanHeadingText
    const matchesTarget = TARGET_HEADING_SUBSTRINGS.some((target) => {
      const cleanTarget = normalizeText(target);
      return cleanHeadingText.includes(cleanTarget);
    });

    if (matchesTarget) {
      console.log(`[Confluence Exporter] Matched heading: "${rawHeadingText.trim()}"`);

      // Traverse forward through siblings beneath this heading until the next heading is reached
      let currentElement = heading.nextElementSibling;

      while (currentElement && !["H1", "H2", "H3"].includes(currentElement.tagName)) {
        
        // 1. Standard HTML <details> tag expansion
        if (currentElement.tagName === "DETAILS" && !currentElement.open) {
          currentElement.open = true;
          expandedCount++;
        }

        // 2. Confluence interactive expand elements & controls inside the sibling block
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

        // Move to the next sibling element under the heading
        currentElement = currentElement.nextElementSibling;
      }
    }
  });

  console.log(`[Confluence Exporter] Expanded ${expandedCount} section(s).`);

  // Step 3: Pause briefly to allow expansion animation & nested tables to render
  await sleep(EXPANSION_WAIT_MS);

  // Step 4: Extract page title and full DOM output
  const pageTitle = document.title || "confluence_page";
  const fullHtml = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;

  // Step 5: Send message to background.js to initiate HTML download
  chrome.runtime.sendMessage({
    action: "download_html",
    title: pageTitle,
    html: fullHtml
  });

  console.log("[Confluence Exporter] Page DOM captured and sent for download.");
})();