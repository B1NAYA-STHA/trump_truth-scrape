import fs from "fs";
import { Impit } from "impit";

const BASE_URL =
  "https://truthsocial.com/api/v1/accounts/107780257626128497/statuses";

const HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
}; 

const OUTPUT_FILE = "statuses.json";
const sleep = ms => new Promise(res => setTimeout(res, ms));

// Initialize impit client
const impit = new Impit({ browser: "chrome", ignoreTlsErrors: true });

// retry function
async function withRetry(fn, maxRetries = 5) {
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err.statusCode !== 429) {
        throw err;
      }

      retries++;
      if (retries > maxRetries) {
        throw new Error("Too many retries. Stop & resume later.");
      }

      const wait = 10000 * Math.pow(2, retries - 1);
      console.log(`429 hit. Waiting ${wait / 1000}s (retry ${retries})`);
      await sleep(wait);
    }
  }
}

// fetch function
async function fetchStatuses(maxId) {
  const params = new URLSearchParams({
    exclude_replies: "true",
    only_replies: "false",
    with_muted: "true",
    limit: "20",
  });

  if (maxId) params.append("max_id", maxId);

  const url = `${BASE_URL}?${params.toString()}`;
  const res = await impit.fetch(url, { headers: HEADERS });

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }

  return res.json();
}

// main function
(async () => {
  let pages = [];
  let maxId = null;
  let page = 1;

  // Resume support
  if (fs.existsSync(OUTPUT_FILE)) {
    pages = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    const lastPage = pages[pages.length - 1];
    maxId = lastPage?.data?.[lastPage.data.length - 1]?.id || null;
    page = lastPage ? lastPage.page + 1 : 1;
    console.log(`Resuming from page ${page} (max_id=${maxId})`);
  }

  while (true) {
    try {
      console.log(
        `\nFetching page ${page} ${maxId ? `(max_id=${maxId})` : ""}`
      );

      const data = await withRetry(() => fetchStatuses(maxId));

      if (!Array.isArray(data) || data.length === 0) {
        console.log("No more data.");
        return;
      }

      pages.push({
        page,
        max_id_used: maxId,
        count: data.length,
        fetched_at: new Date().toISOString(),
        data,
      });

      maxId = data[data.length - 1].id;
      page++;

      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pages, null, 2), "utf-8");

      console.log(`Statuses this page: ${data.length}`);
      console.log(`Pages saved: ${pages.length}`);

      await sleep(4000); // normal delay between pages
    } catch (err) {
      console.error("Error:", err.message);
      return;
    }
  }
})();
