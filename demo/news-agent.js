const agentDataUrl = "../data/news-agent/global-us-briefing-agent.json";
const root = document.querySelector("#agent-root");

async function loadAgent() {
  try {
    const response = await fetch(agentDataUrl);

    if (!response.ok) {
      throw new Error(`Agent request failed with status ${response.status}`);
    }

    const agent = await response.json();
    renderAgent(agent);
  } catch (error) {
    root.innerHTML = `
      <p class="error">The news agent could not be loaded.</p>
      <p>${escapeHtml(error.message)}</p>
    `;
  }
}

function renderAgent(agent) {
  root.innerHTML = `
    <h1 class="quiz-title">${escapeHtml(agent.name)}</h1>
    <p class="quiz-dek">${escapeHtml(agent.tagline)}</p>
    <div class="meta-row">
      <span>Global + U.S. coverage</span>
      <span>Scheduled briefings</span>
      <span>Source-aware summaries</span>
    </div>
    <section class="agent-section">
      <h2>Mission</h2>
      <p>${escapeHtml(agent.mission)}</p>
      <p>${escapeHtml(agent.audience)}</p>
    </section>
    ${renderCadence(agent.cadence)}
    ${renderCoverage(agent.coveragePriorities)}
    ${renderSourceStrategy(agent.sourceStrategy)}
    ${renderListSection("Guardrails", agent.guardrails)}
    ${renderListSection("Briefing format", agent.briefingFormat)}
    ${renderSampleBriefing(agent.sampleBriefing)}
    ${renderListSection("Questions to personalize the agent", agent.personalizationQuestions)}
    ${renderListSection("Implementation backlog", agent.implementationBacklog)}
  `;
}

function renderCadence(cadence) {
  const cards = cadence
    .map((item) => {
      return `
        <article class="agent-card">
          <h3>${escapeHtml(item.name)}</h3>
          <p class="agent-card-meta">${escapeHtml(item.time)}</p>
          <p>${escapeHtml(item.goal)}</p>
        </article>
      `;
    })
    .join("");

  return `
    <section class="agent-section">
      <h2>Briefing cadence</h2>
      <div class="agent-grid">${cards}</div>
    </section>
  `;
}

function renderCoverage(priorities) {
  const sections = priorities
    .map((priority) => {
      const topics = priority.topics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join("");

      return `
        <article class="agent-card">
          <h3>${escapeHtml(priority.section)}</h3>
          <ul>${topics}</ul>
        </article>
      `;
    })
    .join("");

  return `
    <section class="agent-section">
      <h2>Coverage priorities</h2>
      <div class="agent-grid">${sections}</div>
    </section>
  `;
}

function renderSourceStrategy(sourceStrategy) {
  const principles = sourceStrategy.principles
    .map((principle) => `<li>${escapeHtml(principle)}</li>`)
    .join("");
  const sources = sourceStrategy.starterSources
    .map((source) => {
      const examples = source.examples.map((example) => `<li>${escapeHtml(example)}</li>`).join("");

      return `
        <article class="agent-card">
          <h3>${escapeHtml(source.type)}</h3>
          <ul>${examples}</ul>
        </article>
      `;
    })
    .join("");

  return `
    <section class="agent-section">
      <h2>Source strategy</h2>
      <ul>${principles}</ul>
      <div class="agent-grid">${sources}</div>
    </section>
  `;
}

function renderSampleBriefing(sampleBriefing) {
  const items = sampleBriefing.items
    .map((item) => {
      return `
        <article class="briefing-item">
          <p class="eyebrow">${escapeHtml(item.section)}</p>
          <h3>${escapeHtml(item.headline)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <p class="agent-card-meta">Status: ${escapeHtml(item.status)}</p>
        </article>
      `;
    })
    .join("");

  return `
    <section class="agent-section">
      <h2>${escapeHtml(sampleBriefing.label)}</h2>
      <p class="agent-card-meta">${escapeHtml(sampleBriefing.note)}</p>
      <div class="briefing-list">${items}</div>
    </section>
  `;
}

function renderListSection(title, items) {
  const list = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `
    <section class="agent-section">
      <h2>${escapeHtml(title)}</h2>
      <ul>${list}</ul>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadAgent();
