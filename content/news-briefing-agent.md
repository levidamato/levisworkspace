# Global & U.S. News Briefing Agent

This concept describes a personal news agent that helps a reader stay informed
on important world and United States news without needing to constantly refresh
feeds.

## Core promise

The agent should answer three questions every time it briefs the reader:

1. **What happened?** A plain-English summary of confirmed developments.
2. **Why does it matter?** The practical stakes, context and affected people.
3. **What should I watch next?** Upcoming votes, court decisions, weather
   risks, diplomatic meetings, market releases or unresolved facts.

## Daily rhythm

- **Morning briefing:** Top global and U.S. stories, overnight updates and the
  day's expected events.
- **Midday check-in:** Only meaningful changes since the morning briefing.
- **Evening wrap:** Confirmed developments, open questions and tomorrow's watch
  list.
- **Breaking alerts:** Reserved for high-impact events such as public safety
  alerts, major geopolitical developments, election calls, severe weather,
  sudden market-moving news or large-scale infrastructure disruptions.

## Coverage map

The first version should cover:

- U.S. national news: White House, Congress, courts, elections, federal agencies
  and major state stories.
- World news: diplomacy, conflicts, elections, humanitarian crises, global
  markets and regional developments from every major region.
- Economy: jobs, inflation, rates, consumer prices, energy, housing and major
  company or industry news.
- Science, technology, health and climate: public health, AI, cybersecurity,
  space, climate and severe weather.
- Culture and sports when a story has broad public interest.

## Source and trust rules

The agent should be transparent about where information comes from:

- Prefer primary documents, official releases and direct statements when
  available.
- Cross-check high-impact claims with more than one credible source before
  presenting them as settled.
- Label developing news, analysis, projections and opinion clearly.
- Explain when facts have changed or a correction has been made.
- Avoid sensational phrasing and do not send frequent low-value alerts.

## Personalization questions

During setup, the agent should ask:

1. Which regions outside the U.S. do you care about most?
2. Do you want local or state news included?
3. Which topics should always be included?
4. Which topics should be minimized or avoided?
5. How many alerts per day is acceptable?
6. Do you prefer short bullet briefings, deeper explainers or both?
7. Where should briefings be delivered: email, SMS, Slack, browser or app?

## First product milestone

A practical first milestone is a static or scheduled briefing system that:

1. Pulls RSS feeds and/or licensed news API results.
2. Clusters duplicate coverage of the same story.
3. Ranks stories by public impact, freshness, safety relevance and user
   interests.
4. Produces a morning briefing with citations.
5. Stores prior briefings so the next run can say what changed.

## Example briefing format

```text
Good morning. Here are the top developments to know.

Top 5
1. [Headline] - One sentence on what happened and why it matters.
2. [Headline] - One sentence on what changed since the last briefing.
3. [Headline] - One sentence on who is affected.
4. [Headline] - One sentence on what remains uncertain.
5. [Headline] - One sentence on what to watch next.

U.S.
- [Story]: summary, context, next step.

World
- [Story]: summary, affected region, next step.

Economy
- [Story]: summary and practical impact.

Science, tech, health and climate
- [Story]: summary and why it matters.

What changed since your last briefing
- [Story]: confirmed update or correction.

What to watch next
- [Event, vote, hearing, data release or expected update].
```

## Long-term capabilities

- Topic and region preferences.
- Alert thresholds that prevent notification fatigue.
- Source citations and audit logs.
- "Explain this like I am new to the story" mode.
- "Compare coverage" mode that shows how different credible sources frame the
  same topic.
- Weekly recap and "stories that fell off the front page" summaries.
