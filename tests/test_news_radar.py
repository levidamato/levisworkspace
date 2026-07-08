import unittest

from tools.news_radar import Source, build_radar, cluster_items, parse_feed


TRACKED_KEYWORDS = ["White House", "border", "DOJ", "storm"]


class NewsRadarTests(unittest.TestCase):
    def test_parse_rss_feed_normalizes_items(self):
        source = Source(
            id="sample-source",
            name="Sample Source",
            publisher="Sample",
            type="official",
            category="Politics",
            feed_url="https://example.com/feed.xml",
            site_url="https://example.com/news",
            trust_label="Official source",
            priority_weight=9,
        )
        xml = """<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>White House releases border update</title>
              <link>https://example.com/story</link>
              <pubDate>Wed, 08 Jul 2026 02:00:00 GMT</pubDate>
              <description><![CDATA[<p>DOJ response expected later.</p>]]></description>
            </item>
          </channel>
        </rss>
        """

        items = parse_feed(xml, source, TRACKED_KEYWORDS, limit=5)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "White House releases border update")
        self.assertEqual(items[0]["url"], "https://example.com/story")
        self.assertEqual(items[0]["publishedAt"], "2026-07-08T02:00:00Z")
        self.assertEqual(items[0]["summary"], "DOJ response expected later.")
        self.assertIn("White House", items[0]["keywordHits"])
        self.assertIn("border", items[0]["keywordHits"])
        self.assertIn("DOJ", items[0]["keywordHits"])

    def test_parse_atom_feed_uses_href_links(self):
        source = Source(
            id="atom-source",
            name="Atom Source",
            publisher="Atom",
            type="wire",
            category="Weather",
            feed_url="https://example.com/atom.xml",
            site_url="https://example.com",
            trust_label="Wire service",
            priority_weight=7,
        )
        xml = """<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Storm alerts expand</title>
            <link href="https://example.com/storm" />
            <updated>2026-07-08T03:15:00Z</updated>
            <summary>Official storm alert language changed.</summary>
          </entry>
        </feed>
        """

        items = parse_feed(xml, source, TRACKED_KEYWORDS, limit=5)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["url"], "https://example.com/storm")
        self.assertEqual(items[0]["publishedAt"], "2026-07-08T03:15:00Z")
        self.assertIn("storm", items[0]["keywordHits"])

    def test_cluster_items_groups_related_titles(self):
        items = [
            {
                "id": "a",
                "sourceId": "official",
                "sourceName": "Official",
                "sourceType": "official",
                "trustLabel": "Official source",
                "category": "Politics",
                "title": "White House releases border update",
                "url": "https://example.com/a",
                "publishedAt": "2026-07-08T02:00:00Z",
                "summary": "First summary.",
                "priorityWeight": 9,
                "keywordHits": ["White House", "border"],
                "titleTerms": ["border", "releases", "update", "white", "house"],
            },
            {
                "id": "b",
                "sourceId": "wire",
                "sourceName": "Wire",
                "sourceType": "wire",
                "trustLabel": "Wire service",
                "category": "Politics",
                "title": "Border update draws White House reaction",
                "url": "https://example.com/b",
                "publishedAt": "2026-07-08T02:05:00Z",
                "summary": "Second summary.",
                "priorityWeight": 8,
                "keywordHits": ["White House", "border"],
                "titleTerms": ["border", "draws", "update", "white", "house", "reaction"],
            },
            {
                "id": "c",
                "sourceId": "weather",
                "sourceName": "Weather",
                "sourceType": "official",
                "trustLabel": "Official source",
                "category": "Weather",
                "title": "Storm alerts expand",
                "url": "https://example.com/c",
                "publishedAt": "2026-07-08T02:10:00Z",
                "summary": "Third summary.",
                "priorityWeight": 9,
                "keywordHits": ["storm"],
                "titleTerms": ["alerts", "expand", "storm"],
            },
        ]

        clusters = cluster_items(items)
        cluster_sizes = sorted(len(cluster) for cluster in clusters)

        self.assertEqual(cluster_sizes, [1, 2])

    def test_build_radar_includes_alerts_and_briefs(self):
        source_config = [
            {"id": "official", "enabled": True},
            {"id": "wire", "enabled": True},
        ]
        items = [
            {
                "id": "a",
                "sourceId": "official",
                "sourceName": "Official",
                "sourceType": "official",
                "trustLabel": "Official source",
                "category": "Politics",
                "title": "White House releases border update",
                "url": "https://example.com/a",
                "publishedAt": "2026-07-08T02:00:00Z",
                "summary": "First summary.",
                "priorityWeight": 10,
                "keywordHits": ["White House", "border"],
                "titleTerms": ["border", "releases", "update", "white", "house"],
            }
        ]

        radar = build_radar(items, source_config)

        self.assertEqual(radar["mode"], "live")
        self.assertEqual(radar["itemCount"], 1)
        self.assertEqual(len(radar["clusters"]), 1)
        self.assertIn("productionBrief", radar["clusters"][0])
        self.assertIn("Official source posted", radar["clusters"][0]["alertHits"])


if __name__ == "__main__":
    unittest.main()
