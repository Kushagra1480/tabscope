const browserAPI = typeof browser !== "undefined" ? browser : chrome;
let isVisible = false;
let tabs = [];
let filteredTabs = [];
let selectedIdx = 0;

const overlay = document.createElement("div");
overlay.id = "tabscope-tab-switcher-overlay";
overlay.innerHTML = `
  <div class="tabscope-tab-switcher-container">
    <input
      type = "text"
      id = "tabscope-tab-switcher-input"
      placeholder = "search tabs..."
      autocomplete = "off"
    />
    <div id="tabscope-tab-switcher-results"></div>
  </div>
  `;
document.body.appendChild(overlay);

const input = document.getElementById("tabscope-tab-switcher-input");
const results = document.getElementById("tabscope-tab-switcher-results");

browserAPI.runtime.onMessage.addListener((message) => {
  if (message.action === "toggle") {
    toggleOverlay();
  }
});

async function toggleOverlay() {
  console.log("Toggle called, isVisible:", isVisible);
  isVisible = !isVisible;
  if (isVisible) {
    tabs = await browserAPI.runtime.sendMessage({ action: "getTabs" });

    console.log("Got tabs:", tabs.length);
    filteredTabs = tabs;
    selectedIdx = 0;

    overlay.style.display = "flex";
    input.value = "";
    input.focus();
    renderTabs();
    setTimeout(() => input.focus(), 50);
  } else {
    overlay.style.display = "none";
  }
}

function fuzzyMatch(text, query) {
  text = text.toLowerCase();
  query = query.toLowerCase();

  let queryIndex = 0;
  let score = 0;
  let lastMatchIdx = -1;
  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      if (i === 0 || text[i - 1] === " " || text[i - 1] === "-") {
        score += 10;
      }

      if (lastMatchIdx === i - 1) {
        score += 5;
      }

      score += 1;
      lastMatchIdx = i;
      queryIndex++;
    }
  }
  if (queryIndex !== query.length) {
    return { matched: false, score: 0 };
  }
  if (text.startsWith(query)) {
    score += 30;
  }
  if (text.includes(query)) {
    score += 30;
  }
  return { matched: true, score };
}

function filterTabs(query) {
  if (!query) {
    filteredTabs = tabs;
  } else {
    const scored = tabs.map((tab) => {
      const titleMatch = fuzzyMatch(tab.title, query);
      const urlMatch = fuzzyMatch(tab.url, query);

      const titleScore = titleMatch.score * 3;
      const urlScore = urlMatch.score * 1;
      const bestScore = Math.max(titleScore, urlScore);
      const matched = titleMatch.matched || urlMatch.matched;
      return { tab, score: bestScore, matched };
    });
    filteredTabs = scored
      .filter((item) => item.matched)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.tab);
  }
  selectedIdx = 0;
  renderTabs();
}

function renderTabs() {
  console.log("Rendering tabs, count:", filteredTabs.length);
  results.innerHTML = "";
  if (filteredTabs.length === 0) {
    console.log("No tabs to render!");
    results.innerHTML =
      '<div style="padding: 20px; color: white;">No tabs</div>';
    return;
  }
  filteredTabs.forEach((tab, index) => {
    console.log("Rendering tab:", tab.title);
    const item = document.createElement("div");
    item.className =
      "tabscope-tab-item" + (index === selectedIdx ? " selected" : "");
    const faviconHtml = tab.favIconUrl
      ? `<img src="${tab.favIconUrl}" class="tabscope-tab-favicon" />`
      : `<div class="tabscope-tab-favicon" style="display: flex; align-items: center; justify-content: center; color: #888;">🌐</div>`;

    item.innerHTML = `
      ${faviconHtml}
        <div class="tabscope-tab-info">
          <div class="tabscope-tab-title">${escapeHtml(tab.title)}</div>
          <div class="tabscope-tab-url">${escapeHtml(tab.url)}</div>
        </div>
      `;
    item.addEventListener("click", () => switchToTab(tab.id));
    results.appendChild(item);
    if (index === selectedIdx) {
      setTimeout(
        () => item.scrollIntoView({ block: "nearest", behavior: "smooth" }),
        0,
      );
    }
  });
}

function switchToTab(tabId) {
  overlay.style.display = "none";
  isVisible = false;
  browserAPI.runtime.sendMessage({
    action: "switchTab",
    tabId: tabId,
  });
}

input.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Escape":
      e.preventDefault();
      e.stopPropagation();
      toggleOverlay();
      break;
    case "ArrowDown":
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, filteredTabs.length - 1);
      renderTabs();
      break;
    case "ArrowUp":
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      renderTabs();
      break;
    case "Enter":
      e.preventDefault();
      if (filteredTabs[selectedIdx]) {
        switchToTab(filteredTabs[selectedIdx].id);
      }
      break;
  }
});

input.addEventListener("input", (e) => {
  filterTabs(e.target.value);
});

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) {
    toggleOverlay();
  }
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
