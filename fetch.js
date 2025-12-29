import { Impit } from "impit";
import * as cheerio from "cheerio";
import fs from "fs";

const BASE_URL = "https://www.trumpstruth.org";
const OUTPUT_FILE = "output.json";

const impit = new Impit({
  browser: "chrome",       
  ignoreTlsErrors: true,  
});

const results = [];

async function scrapePage(pageUrl, pageNum) {
  console.log(`\nScraping page ${pageNum}`);
  console.log(`URL: ${pageUrl}`);

  const res = await impit.fetch(pageUrl, {
    headers: { "Accept": "text/html" }
  });

  const html = await res.text();
  const $ = cheerio.load(html);

  $("div.status[data-status-url]").each((_, el) => {
    const status = $(el);

    const contentText = status.find(".status__content").text().trim();
    const content = contentText.length ? contentText : null;

    const dateText =
      status.find(".status-info__meta-item time").attr("datetime") ||
      status.find(".status-info__meta-item").last().text().trim();

    const originalPostLink =
      status.find(".status__external-link").attr("href") || null;

    const link = status.attr("data-status-url") || null;

    results.push({
      content,
      date: dateText,
      originalPostLink,
      link,
    });
  });

  const nextHref = $('.pagination a:contains("Next Page")').attr("href");
  if (!nextHref) return null;
  return nextHref.startsWith("http") ? nextHref : new URL(nextHref, BASE_URL).href;
}

(async () => {
  let pageUrl = BASE_URL;
  let pageNum = 1;

  while (pageUrl) {
    try {
      pageUrl = await scrapePage(pageUrl, pageNum);

      fs.writeFileSync(
        OUTPUT_FILE,
        JSON.stringify({ data: results, total_count: results.length }, null, 2)
      );

      console.log(`Total statuses scraped: ${results.length}`);

      pageNum++;
      // small delay to avoid rapid requests
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error(" Error:", err.message);
      break;
    }
  }

  console.log("\nScraping complete! Total statuses:", results.length);
})();
