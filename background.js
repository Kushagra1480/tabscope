const browserAPI = typeof browser !== "undefined" ? browser : chrome;
browserAPI.commands.onCommand.addListener((command) => {
  if (command === "toggle-switcher") {
    browserAPI.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        browserAPI.tabs.sendMessage(tabs[0].id, { action: "toggle" });
      })
      .catch((err) => console.error("error: " + err));
  }
});

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "switchTab") {
    browserAPI.tabs.update(message.tabId, { active: true });
  }
  if (message.action === "getTabs") {
    browserAPI.tabs.query({ currentWindow: true }).then((tabs) => {
      sendResponse(tabs);
    });
    return true;
  }
});
