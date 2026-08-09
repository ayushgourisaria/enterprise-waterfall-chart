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

  // Maximum time to wait (in ms) for Stiltsoft tables to render before giving up
  const MAX_MACRO_WAIT_TIMEOUT_MS = 20000;

  // Interval (in ms) between DOM check polls
  const POLL_INTERVAL_MS = 500;

  // Post-expansion wait time (ms) before capturing MHTML
  const EXPANSION_WAIT_MS = 1500;

  // =========================================================================
  // EXECUTION LOGIC
  // =========================================================================

  console.log("[Confluence Exporter] Script execution started...");

  // Helper function: Promise-based delay
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper function: Normalize text for case-insensitive matching
  const normalizeText = (text) => {
    return (text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  };

  // Helper function: Wait until Stiltsoft dynamic tables exist and have rows loaded
  const waitForStiltsoftTablesToLoad = async () => {
    console.log("[Confluence Exporter] Waiting for Stiltsoft macros/tables to render...");
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_MACRO_WAIT_TIMEOUT_MS) {
      // Check if any loading spinners are present
      const spinners = document.querySelectorAll(
        ".stiltsoft-table-filter-loading, .aui-icon-wait, .spinner, [data-macro-name='table-filter'] .loading"
      );

      // Check for actual table rows inside rendered macro containers
      const tablesWithRows = Array.from(
        document.querySelectorAll("table.confluenceTable, table.stiltsoft-tf-table")
      ).filter((table) => {
        const rows = table.querySelectorAll("tbody tr");
        return rows.length > 0;
      });

      // If no spinners are active and at least one rendered table with data rows exists, proceed
      if (spinners.length === 0 && tablesWithRows.length > 0) {
        console.log(
          `[Confluence Exporter] Stiltsoft tables loaded successfully (${tablesWithRows.length} active table(s) detected).`
        );
        return true;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    console.warn(
      "[Confluence Exporter] Timeout reached waiting for tables to load. Proceeding with current DOM state..."
    );
    return false;
  };

  // Step 1: Wait actively for the macro and dynamic DOM tables to finish rendering
  await waitForStiltsoftTablesToLoad();

  // Step 2: Query all heading elements (H1, H2, H3) on the page
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
  let expandedCount = 0;

  headings.forEach((heading) => {
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

        // 2. Confluence interactive expand elements & controls inside sibling block
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

  // Step 3: Pause briefly to allow expansion animation & nested tables to settle
  await sleep(EXPANSION_WAIT_MS);

  // Step 4: Extract page title and request MHTML snapshot creation
  const pageTitle = document.title || "confluence_page";

  chrome.runtime.sendMessage({
    action: "download_mhtml",
    title: pageTitle
  });

  console.log("[Confluence Exporter] MHTML capture request sent.");
})();
