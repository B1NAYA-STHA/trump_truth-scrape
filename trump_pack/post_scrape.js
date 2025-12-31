import fs from "fs";

const BASE_URL =
  "https://truthsocial.com/api/v1/accounts/107780257626128497/statuses";

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// retry function

async function withRetry(fn, maxRetries = 5) {
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      retries++;
      if (retries > maxRetries) throw new Error("Too many retries. Stop & resume later.");

      const wait = 10000 * Math.pow(2, retries - 1);
      console.log(`Error occurred. Waiting ${wait / 1000}s (retry ${retries})`);
      await sleep(wait);
    }
  }
}

// default json storage

export const jsonStore = {
  loadState(file) {
    if (!fs.existsSync(file)) return { maxId: null, page: 1 };

    const pages = JSON.parse(fs.readFileSync(file, "utf-8"));
    const last = pages.at(-1);

    return {
      maxId: last?.data?.at(-1)?.id || null,
      page: pages.length + 1,
    };
  },

  savePage(file, pageData, pageNumber) {
    const pages = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : [];

    pages.push({
      page: pageNumber,
      fetched_at: new Date().toISOString(),
      data: pageData.data,
    });

    fs.writeFileSync(file, JSON.stringify(pages, null, 2));
  },
};

// main function

export async function scrapeStatuses({
  httpClient,             // Required: function(url, options) => {status, data}
  store = jsonStore,       // Optional: any storage object with loadState & savePage
  outputFile = "statuses.data",
  delay = 4000,
  maxRetries = 5,
}) {
  if (typeof httpClient !== "function") throw new Error("httpClient must be a function");
  if (!store?.loadState || !store?.savePage) throw new Error("store must implement loadState & savePage");

  let { maxId, page } = store.loadState(outputFile);

  console.log(
    maxId ? `Resuming from page ${page} (max_id=${maxId})` : "Starting fresh scrape"
  );

  while (true) {
    console.log(`Fetching page ${page}`);

    const params = new URLSearchParams({
      exclude_replies: "true",
      only_replies: "false",
      with_muted: "true",
      limit: "20",
    });

    if (maxId) params.append("max_id", maxId);

    const url = `${BASE_URL}?${params.toString()}`;

    const data = await withRetry(async () => {
      const res = await httpClient(url, { headers: HEADERS });

      if (res.status !== 200) throw new Error(`Fetch failed: ${res.status}`);

      return res.data;
    }, maxRetries);

    if (!Array.isArray(data) || data.length === 0) {
      console.log("No more data.");
      break;
    }

    store.savePage(outputFile, { maxId, data }, page);

    maxId = data.at(-1).id;
    page++;

    console.log(`Saved page ${page - 1}`);
    await sleep(delay + Math.floor(Math.random() * 2000));
  }
}
