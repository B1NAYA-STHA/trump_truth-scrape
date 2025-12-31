import fs from "fs";

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Retry helper
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

// Default JSON storage
export const jsonStore = {
  loadState(file) {
    if (!fs.existsSync(file)) return { maxId: null, page: 1, totalCount: 0 };
    const pages = JSON.parse(fs.readFileSync(file, "utf-8"));
    const last = pages.at(-1);
    const totalCount = pages.reduce((acc, p) => acc + p.data.length, 0);
    return {
      maxId: last?.data?.at(-1)?.id || null,
      page: pages.length + 1,
      totalCount,
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

// Helper: get numeric ID from username 
async function getUserId(username, httpClient) {
  const url = `https://truthsocial.com/api/v1/accounts/lookup?acct=${username}`;
  const res = await httpClient(url, { headers: HEADERS });
  if (res.status !== 200) throw new Error(`Failed to lookup user: ${res.status}`);
  return res.data.id;
}

// Main scraping function
export async function scrapeStatuses({
  username,              // Required: username to scrape
  httpClient,            // Required: function(url, options) => {status, data}
  store = jsonStore,      // Optional: storage object with loadState & savePage
  outputFile = "statuses.json",
  delay = 4000,
  maxRetries = 5,
  maxStatuses = null,     // Optional: number of statuses to scrape, null = scrape all
}) {
  if (!username) throw new Error("username is required");
  if (typeof httpClient !== "function") throw new Error("httpClient must be a function");
  if (!store?.loadState || !store?.savePage) throw new Error("store must implement loadState & savePage");

  // Get numeric user ID
  const userId = await getUserId(username, httpClient);
  console.log(`User ID for ${username}: ${userId}`);

  // Load existing data
  let { maxId, page, totalCount } = store.loadState(outputFile);
  console.log(maxId ? `Resuming from page ${page} (max_id=${maxId})` : "Starting fresh scrape");

  // Adjust maxStatuses based on already existing posts
  let remainingToFetch = maxStatuses !== null ? maxStatuses - totalCount : null;
  let totalFetchedThisRun = 0;

  while (true) {
    console.log(`Fetching page ${page}`);

    const params = new URLSearchParams({
      exclude_replies: "true",
      only_replies: "false",
      with_muted: "true",
      limit: "20",
    });
    if (maxId) params.append("max_id", maxId);

    const url = `https://truthsocial.com/api/v1/accounts/${userId}/statuses?${params.toString()}`;

    const data = await withRetry(async () => {
      const res = await httpClient(url, { headers: HEADERS });
      if (res.status !== 200) throw new Error(`Fetch failed: ${res.status}`);
      return res.data;
    }, maxRetries);

    if (!Array.isArray(data) || data.length === 0) {
      console.log("No more data.");
      break;
    }

    // Limit page data to remaining posts if maxStatuses is set
    let pageData = data;
    if (remainingToFetch !== null) {
      if (remainingToFetch <= 0) break;
      pageData = data.slice(0, remainingToFetch);
    }

    store.savePage(outputFile, { maxId, data: pageData }, page);

    totalFetchedThisRun += pageData.length;
    if (remainingToFetch !== null) remainingToFetch -= pageData.length;

    maxId = data.at(-1).id;
    page++;
    console.log(`Saved page ${page - 1} (total fetched this run: ${totalFetchedThisRun})`);

    if (remainingToFetch !== null && remainingToFetch <= 0) {
      console.log(`Reached requested maxStatuses: ${maxStatuses}`);
      break;
    }

    await sleep(delay + Math.floor(Math.random() * 2000));
  }
}
