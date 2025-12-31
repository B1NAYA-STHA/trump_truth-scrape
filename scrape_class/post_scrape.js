import fs from "fs";

// Default headers for HTTP requests
const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

// Sleep helper for delays
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Class for scraping TruthSocial statuses

export class TruthSocialScraper {

  constructor({ 
    username, 
    httpClient, 
    store = null, 
    outputFile = "statuses.json", 
    delay = 4000, 
    maxRetries = 5, 
    maxStatuses = null 
  }) {
    if (!username) throw new Error("username is required");
    if (typeof httpClient !== "function") throw new Error("httpClient must be a function");

    this.username = username;
    this.httpClient = httpClient;
    this.store = store || new JsonStore(); // use default JSON storage if none provided
    this.outputFile = outputFile;
    this.delay = delay;
    this.maxRetries = maxRetries;
    this.maxStatuses = maxStatuses;

    // Internal state tracking
    this.userId = null;   // numeric user ID
    this.maxId = null;    // last fetched status ID
    this.page = 1;        // current page number
    this.totalCount = 0;  // total statuses already fetched
  }

  // Initialize scraper: get user ID and load previous state 
  async init() {
    this.userId = await this.getUserId();
    console.log(`User ID for ${this.username}: ${this.userId}`);

    const state = this.store.loadState(this.outputFile);
    this.maxId = state.maxId;
    this.page = state.page;
    this.totalCount = state.totalCount;

    console.log(this.maxId ? `Resuming from page ${this.page} (max_id=${this.maxId})` : "Starting fresh scrape");
  }

  // Get numeric user ID from username 
  async getUserId() {
    const url = `https://truthsocial.com/api/v1/accounts/lookup?acct=${this.username}`;
    const res = await this.httpClient(url, { headers: HEADERS });
    if (res.status !== 200) throw new Error(`Failed to lookup user: ${res.status}`);
    return res.data.id;
  }

  //Retry helper
  async withRetry(fn) {
    let retries = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        retries++;
        if (retries > this.maxRetries) throw new Error("Too many retries. Stop & resume later.");
        const wait = 10000 * Math.pow(2, retries - 1);
        console.log(`Error occurred. Waiting ${wait / 1000}s (retry ${retries})`);
        await sleep(wait);
      }
    }
  }

  // Main scraping loop
  async scrape() {
    await this.init();

    // Adjust remaining statuses to fetch if maxStatuses is set
    let remainingToFetch = this.maxStatuses !== null ? this.maxStatuses - this.totalCount : null;
    let totalFetchedThisRun = 0;

    while (true) {
      console.log(`Fetching page ${this.page}`);

      // Build query parameters
      const params = new URLSearchParams({
        exclude_replies: "true",
        only_replies: "false",
        with_muted: "true",
        limit: "20",
      });
      if (this.maxId) params.append("max_id", this.maxId);

      const url = `https://truthsocial.com/api/v1/accounts/${this.userId}/statuses?${params.toString()}`;

      // Fetch data with retry
      const data = await this.withRetry(async () => {
        const res = await this.httpClient(url, { headers: HEADERS });
        if (res.status !== 200) throw new Error(`Fetch failed: ${res.status}`);
        return res.data;
      });

      // Stop if no more data
      if (!Array.isArray(data) || data.length === 0) {
        console.log("No more data.");
        break;
      }

      // Limit page data if maxStatuses is set
      let pageData = data;
      if (remainingToFetch !== null) {
        if (remainingToFetch <= 0) break;
        pageData = data.slice(0, remainingToFetch);
      }

      // Save page
      this.store.savePage(this.outputFile, { maxId: this.maxId, data: pageData }, this.page);

      totalFetchedThisRun += pageData.length;
      if (remainingToFetch !== null) remainingToFetch -= pageData.length;

      this.maxId = data.at(-1).id;
      this.page++;

      console.log(`Saved page ${this.page - 1} (total fetched this run: ${totalFetchedThisRun})`);

      if (remainingToFetch !== null && remainingToFetch <= 0) {
        console.log(`Reached requested maxStatuses: ${this.maxStatuses}`);
        break;
      }

      // Randomized delay to avoid being blocked
      await sleep(this.delay + Math.floor(Math.random() * 2000));
    }
  }
}

// Default JSON storage class 
export class JsonStore {
  // Load scraper state from file
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
  }

  // Save a page of data to file 
  savePage(file, pageData, pageNumber) {
    const pages = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : [];
    pages.push({
      page: pageNumber,
      fetched_at: new Date().toISOString(),
      data: pageData.data,
    });
    fs.writeFileSync(file, JSON.stringify(pages, null, 2));
  }
}
