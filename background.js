// -------------------------------------------------------------
// CONFIGURATION: Set your specific target Confluence page URL
// -------------------------------------------------------------
const TARGET_CONFLUENCE_URL = "https://your-confluence-domain.com/pages/viewpage.action?pageId=123456";

chrome.action.onClicked.addListener(async (tab) => {
  // Option 1: Open the configured URL if the user isn't already on it
  if (!tab.url.includes(TARGET_CONFLUENCE_URL)) {
    const updatedTab = await chrome.tabs.update(tab.id, { url: TARGET_CONFLUENCE_URL });
    
    // Wait for the tab to finish loading before injecting script
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === updatedTab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.scripting.executeScript({
          target: { tabId: updatedTab.id },
          files: ["content.js"]
        });
      }
    });
  } else {
    // Option 2: Execute directly if already on the target URL
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  }
});

// Download handler remains the same
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download_html") {
    const sanitizedTitle = request.title.replace(/[\\/:*?"<>|]/g, "_").trim();
    const subfolder = "Confluence_Exports";
    const filename = `${subfolder}/${sanitizedTitle}.html`;

    const blobUrl = "data:text/html;charset=utf-8," + encodeURIComponent(request.html);

    chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: false
    });
  }
});