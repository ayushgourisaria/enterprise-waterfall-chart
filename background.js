const TARGET_CONFLUENCE_URL = "https://your-confluence-domain.com/pages/viewpage.action?pageId=123456";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download_clean_html") {
    const sanitizedTitle = request.title.replace(/[\\/:*?"<>|]/g, "_").trim();
    const subfolder = "Confluence_Exports";
    const filename = `${subfolder}/${sanitizedTitle}.html`;

    // Encode raw clean HTML directly as a Data URL
    const encodedHtml = encodeURIComponent(request.html);
    const dataUrl = `data:text/html;charset=utf-8,${encodedHtml}`;

    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("[Confluence Exporter] Download error:", chrome.runtime.lastError.message);
      } else {
        console.log(`[Confluence Exporter] Exported clean file: Downloads/${filename}`);
      }
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  console.log(`[Confluence Exporter] Navigating to: ${TARGET_CONFLUENCE_URL}`);
  const updatedTab = await chrome.tabs.update(tab.id, { url: TARGET_CONFLUENCE_URL });

  let scriptInjected = false;
  const inject = () => {
    if (scriptInjected) return;
    scriptInjected = true;
    chrome.scripting.executeScript({
      target: { tabId: updatedTab.id },
      files: ["content.js"]
    });
  };

  const listener = (tabId, changeInfo) => {
    if (tabId === updatedTab.id && changeInfo.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      inject();
    }
  };

  chrome.tabs.onUpdated.addListener(listener);
  setTimeout(() => inject(), 5000); // Fallback timer
});
