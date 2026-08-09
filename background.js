// =========================================================================
// CONFIGURATION: Set your target Confluence URL here
// =========================================================================
const TARGET_CONFLUENCE_URL = "https://your-confluence-domain.com/pages/viewpage.action?pageId=123456";

// Listener for messages from content script to generate MHTML
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download_mhtml") {
    const tabId = sender.tab.id;

    // Sanitize title to create a valid file name
    const sanitizedTitle = request.title.replace(/[\\/:*?"<>|]/g, "_").trim();
    const subfolder = "Confluence_Exports";
    const filename = `${subfolder}/${sanitizedTitle}.mhtml`;

    // Native browser MHTML capture API
    chrome.pageCapture.saveAsMHTML({ tabId: tabId }, (mhtmlBlob) => {
      if (chrome.runtime.lastError) {
        console.error("[Confluence Exporter] MHTML capture failed:", chrome.runtime.lastError);
        return;
      }

      const blobUrl = URL.createObjectURL(mhtmlBlob);

      // Trigger automatic file download
      chrome.downloads.download({
        url: blobUrl,
        filename: filename,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("[Confluence Exporter] Download failed:", chrome.runtime.lastError);
        } else {
          console.log(`[Confluence Exporter] Successfully exported to Downloads/${filename}`);
        }
      });
    });
  }
});

// Trigger execution when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  console.log(`[Confluence Exporter] Navigating to target URL: ${TARGET_CONFLUENCE_URL}`);

  // Step 1: Update the active tab to load the specified URL
  const updatedTab = await chrome.tabs.update(tab.id, { url: TARGET_CONFLUENCE_URL });

  // Step 2: Listen for the page load completion event
  const listener = (tabId, changeInfo) => {
    if (tabId === updatedTab.id && changeInfo.status === "complete") {
      // Remove listener so it only runs once
      chrome.tabs.onUpdated.removeListener(listener);

      console.log("[Confluence Exporter] Page loaded. Injecting content.js...");

      // Step 3: Inject content.js once the page is fully loaded
      chrome.scripting.executeScript({
        target: { tabId: updatedTab.id },
        files: ["content.js"]
      });
    }
  };

  chrome.tabs.onUpdated.addListener(listener);
});
