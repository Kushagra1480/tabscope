background.commands.onCommand.addListener((command) => {
  if (command === "toggle-switcher") {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        browser.tabs.sendMesage(tabs[0].id, { action: "toggle" });
      })
      .catch((err) => console.error("error: " + err));
  }
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "switchTab") {
    browser.tabs.update(message.tabId, { active: true });
  }
  if (message.action === "getTabs") {
    return browser.tabs.query({ currentWindow: true });
  }
});
