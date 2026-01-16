async function handle(details) {
  if (details.frameId !== 0) return;
  if (!details.url?.startsWith("https://console.cloud.google.com/")) return;

  const u = new URL(details.url);
  const q = u.searchParams.get("q");
  if (!q) return;

  await chrome.storage.session.set({ [`query_${details.tabId}`]: q });

  u.searchParams.delete("q");
  chrome.tabs.update(details.tabId, { url: u.toString() });
}

chrome.webNavigation.onHistoryStateUpdated.addListener(handle);
chrome.webNavigation.onCommitted.addListener(handle);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "GET_QUERY") return;
  const tabId = sender.tab?.id;
  if (!tabId) return;

  chrome.storage.session.get(`query_${tabId}`).then((data) => {
    sendResponse({ query: data[`query_${tabId}`] ?? null });
  });

  return true;
});