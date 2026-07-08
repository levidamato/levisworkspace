const radarDataUrl = "../../data/news-radar/radar.json";
const sourceDataUrl = "../../data/news-radar/sources.json";

const state = {
  radar: null,
  sources: null,
  query: "",
  category: "all",
  officialOnly: false,
  highPriority: false,
  sort: "urgency",
};

const elements = {
  status: document.querySelector("#radar-status"),
  generated: document.querySelector("#radar-generated"),
  clusterCount: document.querySelector("#cluster-count"),
  clusters: document.querySelector("#clusters"),
  alerts: document.querySelector("#alerts-list"),
  alertCount: document.querySelector("#alert-count"),
  sourceMix: document.querySelector("#source-mix"),
  search: document.querySelector("#search-input"),
  category: document.querySelector("#category-filter"),
  officialOnly: document.querySelector("#official-only"),
  highPriority: document.querySelector("#high-priority"),
  sort: document.querySelector("#sort-filter"),
  reset: document.querySelector("[data-reset]"),
  template: document.querySelector("#cluster-template"),
};

async function loadRadar() {
  try {
    const [radarResponse, sourceResponse] = await Promise.all([
      fetch(radarDataUrl),
      fetch(sourceDataUrl),
    ]);

    if (!radarResponse.ok) {
      throw new Error(`Radar data request failed with status ${radarResponse.status}`);
    }

    if (!sourceResponse.ok) {
      throw new Error(`Source data request failed with status ${sourceResponse.status}`);
    }

    state.radar = await radarResponse.json();
    state.sources = await sourceResponse.json();
    bindControls();
    hydrateFilters();
    render();
  } catch (error) {
    elements.status.textContent = "Unavailable";
    elements.generated.textContent = "Check that the local server is running from repo root.";
    elements.clusters.innerHTML = `
      <div class="error-state">
        <strong>The radar dashboard could not load.</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function bindControls() {
  elements.search.addEventListener("input", () => {
    state.query = elements.search.value.trim().toLowerCase();
    renderClusters();
  });

  elements.category.addEventListener("change", () => {
    state.category = elements.category.value;
    renderClusters();
  });

  elements.officialOnly.addEventListener("change", () => {
    state.officialOnly = elements.officialOnly.checked;
    renderClusters();
  });

  elements.highPriority.addEventListener("change", () => {
    state.highPriority = elements.highPriority.checked;
    renderClusters();
  });

  elements.sort.addEventListener("change", () => {
    state.sort = elements.sort.value;
    renderClusters();
  });

  elements.reset.addEventListener("click", () => {
    elements.search.value = "";
    elements.category.value = "all";
    elements.officialOnly.checked = false;
    elements.highPriority.checked = false;
    elements.sort.value = "urgency";
    Object.assign(state, {
      query: "",
      category: "all",
      officialOnly: false,
      highPriority: false,
      sort: "urgency",
    });
    renderClusters();
  });
}

function hydrateFilters() {
  const categories = [...new Set(state.radar.clusters.map((cluster) => cluster.category))]
    .filter(Boolean)
    .sort();

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.category.append(option);
  });
}

function render() {
  const modeLabel = state.radar.mode === "sample" ? "Sample data" : "Live feed data";
  elements.status.textContent = `${state.radar.clusters.length} clusters`;
  elements.generated.textContent = `${modeLabel} generated ${formatDateTime(state.radar.generatedAt)}`;
  renderAlerts();
  renderSourceMix();
  renderClusters();
}

function renderAlerts() {
  const alerts = state.radar.alerts || [];
  elements.alertCount.textContent = String(alerts.length);

  if (alerts.length === 0) {
    elements.alerts.innerHTML = `<p class="empty-state">No active alerts in the current data file.</p>`;
    return;
  }

  elements.alerts.innerHTML = "";
  alerts.forEach((alert) => {
    const card = document.createElement("article");
    card.className = `alert-card ${alert.level || "medium"}`;
    card.innerHTML = `
      <strong>${escapeHtml(alert.level || "alert").toUpperCase()}</strong>
      <p>${escapeHtml(alert.message)}</p>
    `;
    elements.alerts.append(card);
  });
}

function renderSourceMix() {
  const counts = new Map();
  state.radar.clusters.forEach((cluster) => {
    cluster.sourceTypes.forEach((type) => {
      counts.set(type, (counts.get(type) || 0) + 1);
    });
  });

  elements.sourceMix.innerHTML = "";
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const pill = document.createElement("span");
      pill.className = "source-type";
      pill.textContent = `${formatSourceType(type)}: ${count}`;
      elements.sourceMix.append(pill);
    });
}

function renderClusters() {
  const clusters = getFilteredClusters();
  elements.clusterCount.textContent = `${clusters.length} ${clusters.length === 1 ? "cluster" : "clusters"} in view`;
  elements.clusters.innerHTML = "";

  if (clusters.length === 0) {
    elements.clusters.innerHTML = `
      <div class="empty-state">
        <strong>No clusters match the current filters.</strong>
        <p>Try clearing search, category or priority filters.</p>
      </div>
    `;
    return;
  }

  clusters.forEach((cluster) => {
    elements.clusters.append(renderClusterCard(cluster));
  });
}

function getFilteredClusters() {
  return [...state.radar.clusters]
    .filter((cluster) => {
      if (state.category !== "all" && cluster.category !== state.category) {
        return false;
      }

      if (state.officialOnly && !cluster.sourceTypes.includes("official")) {
        return false;
      }

      if (state.highPriority && cluster.urgencyScore < 80) {
        return false;
      }

      if (!state.query) {
        return true;
      }

      const haystack = [
        cluster.title,
        cluster.category,
        cluster.status,
        ...(cluster.topics || []),
        ...(cluster.alertHits || []),
        ...(cluster.items || []).flatMap((item) => [item.title, item.summary, item.sourceName]),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(state.query);
    })
    .sort((a, b) => {
      if (state.sort === "latest") {
        return new Date(b.latestUpdateAt) - new Date(a.latestUpdateAt);
      }

      if (state.sort === "sources") {
        return b.sources.length - a.sources.length;
      }

      return b.urgencyScore - a.urgencyScore;
    });
}

function renderClusterCard(cluster) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector(".cluster-card");
  const status = fragment.querySelector(".status-pill");
  const score = fragment.querySelector(".score-pill");
  const title = fragment.querySelector("h3");
  const meta = fragment.querySelector(".cluster-meta");
  const topics = fragment.querySelector(".topic-row");
  const brief = fragment.querySelector(".brief");
  const sourceList = fragment.querySelector(".source-list");
  const itemList = fragment.querySelector(".item-list");
  const copyBrief = fragment.querySelector("[data-copy-brief]");
  const copyLinks = fragment.querySelector("[data-copy-links]");

  status.textContent = cluster.status;
  status.classList.add((cluster.status || "").toLowerCase());
  score.textContent = `Urgency ${cluster.urgencyScore}`;
  title.textContent = cluster.title;
  meta.textContent = `${cluster.category} | ${cluster.sources.length} sources | Updated ${formatDateTime(cluster.latestUpdateAt)}`;

  (cluster.topics || []).forEach((topic) => {
    const pill = document.createElement("span");
    pill.className = "topic";
    pill.textContent = topic;
    topics.append(pill);
  });

  brief.innerHTML = renderBrief(cluster);

  cluster.sources.forEach((source) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)}</a>
      <small>${escapeHtml(formatSourceType(source.type))} | ${escapeHtml(source.trustLabel)}</small>
    `;
    sourceList.append(item);
  });

  cluster.items.forEach((clusterItem) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <a href="${escapeAttribute(clusterItem.url)}" target="_blank" rel="noreferrer">${escapeHtml(clusterItem.title)}</a>
      <small>${escapeHtml(clusterItem.sourceName)} | ${formatDateTime(clusterItem.publishedAt)}</small>
    `;
    itemList.append(item);
  });

  copyBrief.addEventListener("click", () => {
    copyText(formatHandoff(cluster), copyBrief);
  });

  copyLinks.addEventListener("click", () => {
    copyText(formatVerificationLinks(cluster), copyLinks);
  });

  card.dataset.clusterId = cluster.id;
  return fragment;
}

function renderBrief(cluster) {
  const brief = cluster.productionBrief || {};
  const checks = (brief.whatToCheck || [])
    .map((check) => `<li>${escapeHtml(check)}</li>`)
    .join("");
  const alertHits = (cluster.alertHits || [])
    .map((hit) => `<span class="topic">${escapeHtml(hit)}</span>`)
    .join("");

  return `
    <h4>Production brief</h4>
    <p><strong>What happened:</strong> ${escapeHtml(brief.whatHappened || "No brief available.")}</p>
    <p><strong>Latest update:</strong> ${escapeHtml(brief.latestUpdate || "No update available.")}</p>
    ${checks ? `<ul>${checks}</ul>` : ""}
    <div class="topic-row" aria-label="Alert hits">${alertHits}</div>
  `;
}

function formatHandoff(cluster) {
  const brief = cluster.productionBrief || {};
  const checks = (brief.whatToCheck || []).map((check) => `- ${check}`).join("\n");
  const keywords = (brief.suggestedSeoKeywords || []).join(", ");

  return [
    `${cluster.title}`,
    `Status: ${cluster.status} | Category: ${cluster.category} | Urgency: ${cluster.urgencyScore}`,
    `Latest: ${formatDateTime(cluster.latestUpdateAt)}`,
    "",
    `What happened: ${brief.whatHappened || ""}`,
    `Latest update: ${brief.latestUpdate || ""}`,
    "",
    "What to check:",
    checks || "- No checks provided",
    "",
    `SEO keywords: ${keywords || "None provided"}`,
    "",
    `Handoff: ${brief.handoffNote || ""}`,
  ].join("\n");
}

function formatVerificationLinks(cluster) {
  const links = cluster.verificationLinks || [];

  if (links.length === 0) {
    return "No verification links provided.";
  }

  return links.map((link) => `${link.label}: ${link.url}`).join("\n");
}

async function copyText(text, button) {
  const originalLabel = button.textContent;

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch (error) {
    button.textContent = "Copy failed";
  }

  window.setTimeout(() => {
    button.textContent = originalLabel;
  }, 1600);
}

function formatSourceType(type) {
  return String(type || "unknown")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value) {
  if (!value) {
    return "unknown time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value || "#");
}

loadRadar();
