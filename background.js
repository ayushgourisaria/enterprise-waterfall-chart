// =========================================================================
// CONFIGURATION SECTION: Yahan apna Target Confluence URL daalein
// =========================================================================
const TARGET_CONFLUENCE_URL = "https://your-confluence-domain.com/pages/viewpage.action?pageId=123456";

// MHTML Download Handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download_mhtml") {
    const tabId = sender.tab.id;
    const pageTitle = request.title || "confluence_page";
    
    // Sanitize file name for file system
    const sanitizedTitle = pageTitle.replace(/[\\/:*?"<>|]/g, "_").trim();
    const filename = `Confluence_Exports/${sanitizedTitle}.mhtml`;

    // Native Chrome API to capture page as MHTML
    chrome.pageCapture.saveAsMHTML({ tabId: tabId }, (mhtmlBlob) => {
      if (chrome.runtime.lastError) {
        console.error("[Confluence Exporter] MHTML Capture failed:", chrome.runtime.lastError);
        return;
      }

      const blobUrl = URL.createObjectURL(mhtmlBlob);

      chrome.downloads.download({
        url: blobUrl,
        filename: filename,
        saveAs: false
      }, () => {
        URL.revokeObjectURL(blobUrl);
        console.log(`[Confluence Exporter] Exported MHTML to Downloads/${filename}`);
      });
    });
  }
});

// Extension Click Handler: Open URL & Execute Script
chrome.action.onClicked.addListener(async (tab) => {
  // Option 1: Agare user target URL par nahi hai, to us URL ko open karo
  if (!tab.url.includes(TARGET_CONFLUENCE_URL)) {
    console.log(`[Confluence Exporter] Navigating to: ${TARGET_CONFLUENCE_URL}`);
    const updatedTab = await chrome.tabs.update(tab.id, { url: TARGET_CONFLUENCE_URL });
    
    // Page load complete hone ka wait karo script run karne se pehle
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
    // Option 2: Agar user pehle se target URL par hai, directly run kar do
    console.log("[Confluence Exporter] Already on target page. Running script...");
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  }
});
