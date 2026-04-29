export async function executeProviderExtractor(provider, tabId) {
  const [injectionResult] = await chrome.scripting.executeScript({
    args: [null, provider.extractorOptions ?? {}],
    target: { tabId },
    func: provider.extract
  });

  return injectionResult?.result ?? {
    status: "error",
    error: `No usage result returned from ${provider.name} page`
  };
}
