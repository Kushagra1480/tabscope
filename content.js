let isVisible = false;
let tabs = [];
let filteredTabs = [];
let selectedIdx = 0;

const overlay = document.createElement("div");
overlay.id = "tab-switcher-overlay";
overlay.innerHTML = `
  <div>
    <input
      type = "text"
      id = "tab-switcher-input"
      placeholder = "search tabs..."
      autocomplete = "off"
    />
    <div id="tab-switcher-results"></div>
  </div>
  `;
document.body.appendChild(overlay);

const input = document.getElementById("tab-switcher-input");
const results = document.getElementById("tab-switcher-results");

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "toggle") {
    toggleOverlay();
  }
});

async function toggleOverlay() {
  isVisible = !isVisible;
  if (isVisible) {
    tabs = await browser.runtime.sendMessage({ action: "getTabs" });
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
  results.innerHTML = "";
  filteredTabs.forEach((tab, index) => {
    const item = document.createElement("div");
    item.className = "tab-item" + (index === selectedIdx ? " selected" : "");
    const faviconHtml = tab.favIconUrl
      ? `<img src="${tab.favIconUrl}" class="tab-favicon" />`
      : `<div class="tab-favicon" style="display: flex; align-items: center; justify-content: center; color: #888;">🌐</div>`;

    item.innerHTML = `
      ${faviconHtml}
        <div class="tab-info">
          <div class="tab-title">${escapeHtml(tab.title)}</div>
          <div class="tab-url">${escapeHtml(tab.url)}</div>
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
  browser.runtime.sendMessage({
    action: "switchTab",
    tabId: tabId,
  });
  if (isVisible) {
    toggleOverlay();
  }
}

input.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Escape":
      e.preventDefault();
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
