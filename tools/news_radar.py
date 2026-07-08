#!/usr/bin/env python3
"""Refresh News Radar dashboard data from configured RSS and Atom feeds."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCES = ROOT / "data" / "news-radar" / "sources.json"
DEFAULT_OUTPUT = ROOT / "data" / "news-radar" / "radar.json"

STOPWORDS = {
    "about",
    "after",
    "again",
    "against",
    "amid",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "how",
    "in",
    "into",
    "is",
    "it",
    "its",
    "new",
    "of",
    "on",
    "over",
    "says",
    "the",
    "to",
    "up",
    "with",
}


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    publisher: str
    type: str
    category: str
    feed_url: str
    site_url: str
    trust_label: str
    priority_weight: int


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh News Radar RSS data.")
    parser.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit-per-source", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=12)
    args = parser.parse_args()

    try:
        config = load_config(args.sources)
    except OSError as exc:
        print(f"Could not read source config: {exc}", file=sys.stderr)
        return 1

    items: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    for source in config["sources"]:
        if not source.get("enabled", True):
            continue

        parsed_source = source_from_dict(source)

        try:
            xml_text = fetch_feed(parsed_source.feed_url, args.timeout)
            items.extend(
                parse_feed(xml_text, parsed_source, config["trackedKeywords"], args.limit_per_source)
            )
        except (ET.ParseError, OSError, urllib.error.URLError, TimeoutError) as exc:
            errors.append(
                {
                    "sourceId": parsed_source.id,
                    "sourceName": parsed_source.name,
                    "message": str(exc),
                }
            )

    radar = build_radar(items, config["sources"], errors)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(radar, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(radar['clusters'])} clusters from {len(items)} items to {args.output}")
    return 0


def load_config(path: Path) -> dict[str, Any]:
    config = json.loads(path.read_text(encoding="utf-8"))
    config.setdefault("trackedKeywords", [])
    config.setdefault("sources", [])
    return config


def source_from_dict(source: dict[str, Any]) -> Source:
    return Source(
        id=source["id"],
        name=source["name"],
        publisher=source.get("publisher", source["name"]),
        type=source.get("type", "unknown"),
        category=source.get("category", "General"),
        feed_url=source["feedUrl"],
        site_url=source.get("siteUrl", source["feedUrl"]),
        trust_label=source.get("trustLabel", "Source"),
        priority_weight=int(source.get("priorityWeight", 5)),
    )


def fetch_feed(url: str, timeout: int) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "NewsRadarMVP/1.0 (+https://example.local/news-radar)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_feed(
    xml_text: str,
    source: Source,
    tracked_keywords: list[str],
    limit: int,
) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    entries = [
        element
        for element in root.iter()
        if local_name(element.tag) in {"item", "entry"}
    ]

    parsed_items: list[dict[str, Any]] = []
    for entry in entries[:limit]:
        title = text_for(entry, {"title"}).strip()
        url = link_for(entry) or source.site_url
        summary = strip_html(text_for(entry, {"description", "summary", "encoded", "content"}))
        published_at = normalize_datetime(
            text_for(entry, {"pubDate", "published", "updated", "date"})
        )

        if not title:
            continue

        item_id = stable_id(source.id, url, title)
        keyword_hits = keyword_matches(f"{title} {summary}", tracked_keywords)
        title_terms = tokenize(title)

        parsed_items.append(
            {
                "id": item_id,
                "sourceId": source.id,
                "sourceName": source.name,
                "sourceSiteUrl": source.site_url,
                "sourceType": source.type,
                "trustLabel": source.trust_label,
                "category": source.category,
                "title": title,
                "url": url,
                "publishedAt": published_at,
                "summary": summary or f"Latest item from {source.name}.",
                "priorityWeight": source.priority_weight,
                "keywordHits": keyword_hits,
                "titleTerms": sorted(title_terms),
            }
        )

    return parsed_items


def build_radar(
    items: list[dict[str, Any]],
    source_config: list[dict[str, Any]],
    errors: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    errors = errors or []
    clusters = cluster_items(items)
    rendered_clusters = [render_cluster(cluster) for cluster in clusters]
    rendered_clusters.sort(key=lambda cluster: cluster["urgencyScore"], reverse=True)
    alerts = build_alerts(rendered_clusters)

    return {
        "version": 1,
        "mode": "live",
        "generatedAt": now_iso(),
        "sourceCount": len([source for source in source_config if source.get("enabled", True)]),
        "itemCount": len(items),
        "clusters": rendered_clusters,
        "alerts": alerts,
        "errors": errors,
    }


def cluster_items(items: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    sorted_items = sorted(
        items,
        key=lambda item: parse_iso(item.get("publishedAt")),
        reverse=True,
    )
    clusters: list[list[dict[str, Any]]] = []

    for item in sorted_items:
        best_cluster: list[dict[str, Any]] | None = None
        best_score = 0.0

        for cluster in clusters:
            score = cluster_similarity(item, cluster)
            if score > best_score:
                best_score = score
                best_cluster = cluster

        if best_cluster is not None and best_score >= 0.32:
            best_cluster.append(item)
        else:
            clusters.append([item])

    return clusters


def cluster_similarity(item: dict[str, Any], cluster: list[dict[str, Any]]) -> float:
    item_terms = set(item.get("titleTerms", []))
    cluster_terms = set().union(*(set(entry.get("titleTerms", [])) for entry in cluster))
    item_keywords = set(item.get("keywordHits", []))
    cluster_keywords = set().union(*(set(entry.get("keywordHits", [])) for entry in cluster))

    if not item_terms or not cluster_terms:
        return 0.0

    term_overlap = len(item_terms & cluster_terms) / len(item_terms | cluster_terms)
    keyword_overlap = 0.0

    if item_keywords and cluster_keywords:
        keyword_overlap = len(item_keywords & cluster_keywords) / len(item_keywords | cluster_keywords)

    same_category_bonus = 0.12 if item["category"] == cluster[0]["category"] else 0.0
    return term_overlap + keyword_overlap + same_category_bonus


def render_cluster(cluster: list[dict[str, Any]]) -> dict[str, Any]:
    cluster = sorted(cluster, key=lambda item: parse_iso(item["publishedAt"]), reverse=True)
    newest = cluster[0]
    source_map = {}
    source_types = set()
    keyword_hits = set()
    title_terms = set()

    for item in cluster:
        source_map[item["sourceId"]] = {
            "sourceId": item["sourceId"],
            "name": item["sourceName"],
            "type": item["sourceType"],
            "trustLabel": item["trustLabel"],
            "url": item.get("sourceSiteUrl") or source_url_from_item(item),
        }
        source_types.add(item["sourceType"])
        keyword_hits.update(item.get("keywordHits", []))
        title_terms.update(item.get("titleTerms", []))

    sources = list(source_map.values())
    urgency_score = score_cluster(cluster, source_types, keyword_hits)
    alert_hits = alert_hits_for(cluster, source_types, keyword_hits)
    verification_links = verification_links_for(sources)
    topics = sorted(keyword_hits)[:6] or sorted(title_terms)[:6]

    return {
        "id": stable_id("cluster", newest["title"], newest["category"]),
        "title": newest["title"],
        "category": newest["category"],
        "status": status_for_score(urgency_score),
        "urgencyScore": urgency_score,
        "latestUpdateAt": newest["publishedAt"],
        "sourceTypes": sorted(source_types),
        "topics": topics,
        "sources": sources,
        "items": [
            {
                "id": item["id"],
                "sourceId": item["sourceId"],
                "sourceName": item["sourceName"],
                "title": item["title"],
                "url": item["url"],
                "publishedAt": item["publishedAt"],
                "summary": item["summary"],
            }
            for item in cluster
        ],
        "alertHits": alert_hits,
        "verificationLinks": verification_links,
        "productionBrief": production_brief(newest, cluster, topics),
    }


def score_cluster(
    cluster: list[dict[str, Any]],
    source_types: set[str],
    keyword_hits: set[str],
) -> int:
    newest = max(parse_iso(item["publishedAt"]) for item in cluster)
    age_seconds = max((datetime.now(UTC) - newest).total_seconds(), 0)

    if age_seconds <= 3600:
        recency = 30
    elif age_seconds <= 3 * 3600:
        recency = 22
    elif age_seconds <= 12 * 3600:
        recency = 14
    else:
        recency = 6

    source_weight = max(int(item.get("priorityWeight", 5)) for item in cluster) * 3
    official_bonus = 10 if "official" in source_types else 0
    diversity_bonus = min(len(source_types) * 5, 15)
    coverage_bonus = min(len({item["sourceId"] for item in cluster}) * 4, 16)
    keyword_bonus = min(len(keyword_hits) * 4, 16)
    return min(source_weight + recency + official_bonus + diversity_bonus + coverage_bonus + keyword_bonus, 99)


def status_for_score(score: int) -> str:
    if score >= 85:
        return "Developing"
    if score >= 70:
        return "Watch"
    return "Monitor"


def alert_hits_for(
    cluster: list[dict[str, Any]],
    source_types: set[str],
    keyword_hits: set[str],
) -> list[str]:
    hits: list[str] = []
    if "official" in source_types:
        hits.append("Official source posted")
    if len({item["sourceId"] for item in cluster}) >= 3:
        hits.append("Three or more sources")
    if len(source_types) >= 2:
        hits.append("Multiple source types")
    hits.extend(f"Tracked keyword: {keyword}" for keyword in sorted(keyword_hits)[:5])
    return hits


def verification_links_for(sources: list[dict[str, Any]]) -> list[dict[str, str]]:
    official_links = [
        {"label": source["name"], "url": source["url"]}
        for source in sources
        if source["type"] == "official"
    ]

    if official_links:
        return official_links

    return [
        {"label": source["name"], "url": source["url"]}
        for source in sources[:3]
    ]


def production_brief(
    newest: dict[str, Any],
    cluster: list[dict[str, Any]],
    topics: list[str],
) -> dict[str, Any]:
    source_names = sorted({item["sourceName"] for item in cluster})
    source_phrase = ", ".join(source_names[:4])
    if len(source_names) > 4:
        source_phrase += f" and {len(source_names) - 4} more"

    return {
        "whatHappened": newest["summary"],
        "latestUpdate": f"{newest['sourceName']} published the newest item at {newest['publishedAt']}.",
        "whatToCheck": [
            "Open the original source link before writing or updating copy.",
            "Compare names, numbers, locations and timestamps across the grouped items.",
            "Use official-source language for claims that affect legal, safety or policy wording.",
        ],
        "suggestedSeoKeywords": topics,
        "handoffNote": (
            f"{newest['category']} cluster from {source_phrase}. "
            f"Newest source: {newest['sourceName']}. Verify source-of-truth details before publishing."
        ),
    }


def build_alerts(clusters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    alerts = []

    for cluster in clusters:
        if cluster["urgencyScore"] < 70:
            continue

        alerts.append(
            {
                "id": stable_id("alert", cluster["id"]),
                "clusterId": cluster["id"],
                "level": "high" if cluster["urgencyScore"] >= 85 else "medium",
                "message": (
                    f"{cluster['title']} has urgency {cluster['urgencyScore']} "
                    f"with {len(cluster['sources'])} source(s)."
                ),
                "triggeredAt": cluster["latestUpdateAt"],
            }
        )

    return alerts[:12]


def source_url_from_item(item: dict[str, Any]) -> str:
    url = item.get("url") or ""
    if url.startswith("http"):
        match = re.match(r"^(https?://[^/]+)", url)
        if match:
            return match.group(1)
    return url


def local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def text_for(element: ET.Element, names: set[str]) -> str:
    for child in element:
        if local_name(child.tag) in names and child.text:
            return child.text
    return ""


def link_for(element: ET.Element) -> str:
    for child in element:
        if local_name(child.tag) != "link":
            continue

        href = child.attrib.get("href")
        if href:
            return href

        if child.text:
            return child.text.strip()

    return text_for(element, {"guid", "id"}).strip()


def strip_html(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", html.unescape(without_tags)).strip()


def normalize_datetime(value: str) -> str:
    if not value:
        return now_iso()

    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return now_iso()

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)

    return parsed.astimezone(UTC).isoformat().replace("+00:00", "Z")


def parse_iso(value: str | None) -> datetime:
    if not value:
        return datetime.fromtimestamp(0, tz=UTC)

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.fromtimestamp(0, tz=UTC)

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)

    return parsed.astimezone(UTC)


def keyword_matches(text: str, tracked_keywords: list[str]) -> list[str]:
    haystack = text.lower()
    return [
        keyword
        for keyword in tracked_keywords
        if keyword.lower() in haystack
    ]


def tokenize(value: str) -> set[str]:
    terms = {
        term
        for term in re.findall(r"[a-zA-Z][a-zA-Z0-9-]{2,}", value.lower())
        if term not in STOPWORDS
    }
    return terms


def stable_id(*parts: str) -> str:
    digest = hashlib.sha1("||".join(parts).encode("utf-8")).hexdigest()[:12]
    return f"nr-{digest}"


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
