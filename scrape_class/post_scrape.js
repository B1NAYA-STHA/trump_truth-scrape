import fs from "fs";

// Default request headers
const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

// Sleep helper
const sleep = ms => new Promise(r => setTimeout(r, ms));

// scraper class
export class TruthSocialScraper {
  constructor({
    username,
    httpClient,
    store = null,
    outputFile = "statuses.json",
    delay = 4000,
    maxRetries = 5,
    maxStatuses = null,
  }) {
    if (!username) throw new Error("username is required");
    if (typeof httpClient !== "function")
      throw new Error("httpClient must be a function");

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

  // All HTTP requests go through this method
  async fetch(url) {
    return this.withRetry(async () => {
      const res = await this.httpClient(url, { headers: HEADERS });
      if (res.status !== 200) {
        throw new Error(`Fetch failed: ${res.status}`);
      }
      return res.data;
    });
  }

  // Load previous scrape state
  load() {
    return this.store.loadState(this.outputFile);
  }

  // Save one page of data
  save(pageData, pageNumber) {
    return this.store.savePage(this.outputFile, pageData, pageNumber);
  }

  // helpers

  // Convert username to numeric userId
  async getUserId() {
    const url = `https://truthsocial.com/api/v1/accounts/lookup?acct=${this.username}`;
    const res = await this.httpClient(url, { headers: HEADERS });

    if (res.status !== 200) {
      throw new Error(`Failed to lookup user: ${res.status}`);
    }

    return res.data.id;
  }

  // Retry helper 
  async withRetry(fn) {
    let retries = 0;

    while (true) {
      try {
        return await fn();
      } catch (err) {
        retries++;
        if (retries > this.maxRetries) {
          throw new Error("Too many retries. Stop & resume later.");
        }

        const wait = 10000 * Math.pow(2, retries - 1);
        console.log(`Retrying in ${wait / 1000}s (attempt ${retries})`);
        await sleep(wait);
      }
    }
  }

  // Initialize scraper state

  async init() {
    // Resolve numeric user ID
    this.userId = await this.getUserId();
    console.log(`User ID for ${this.username}: ${this.userId}`);

    // Load saved state
    const state = this.load();
    this.maxId = state.maxId;
    this.page = state.page;
    this.totalCount = state.totalCount;

    console.log(
      this.maxId
        ? `Resuming from page ${this.page} (existing ${this.totalCount} statuses)`
        : "Starting fresh scrape"
    );
  }

  // Main scrape loop

  async scrape() {
    await this.init();

    while (true) {
      // Stop immediately if limit already reached
      if (
        this.maxStatuses !== null &&
        this.totalCount >= this.maxStatuses
      ) {
        console.log(`Reached maxStatuses (${this.maxStatuses}). Stopping.`);
        break;
      }

      console.log(`Fetching page ${this.page}`);

      // Build query parameters
      const params = new URLSearchParams({
        exclude_replies: "true",
        only_replies: "false",
        with_muted: "true",
        limit: "20",
      });

      if (this.maxId) params.append("max_id", this.maxId);

      const url = `https://truthsocial.com/api/v1/accounts/${this.userId}/statuses?${params}`;

      const data = await this.fetch(url);

      if (!Array.isArray(data) || data.length === 0) {
        console.log("No more data.");
        break;
      }

      // Trim page if it exceeds maxStatuses
      let pageData = data;
      if (this.maxStatuses !== null) {
        const remaining = this.maxStatuses - this.totalCount;
        pageData = data.slice(0, remaining);
      }

      // Save page
      this.save({ data: pageData, maxId: this.maxId }, this.page);

      // Update counters
      this.totalCount += pageData.length;
      this.maxId = data.at(-1).id;

      console.log(
        `Page ${this.page} saved ${pageData.length} statuses | total = ${this.totalCount}`
      );

      this.page++;

      // Stop if limit reached after saving
      if (
        this.maxStatuses !== null &&
        this.totalCount >= this.maxStatuses
      ) {
        console.log(`Reached maxStatuses (${this.maxStatuses}).`);
        break;
      }

      await sleep(this.delay + Math.random() * 2000);
    }
  }
}

// default JSON file storage

export class JsonStore {
  // Load saved pages and compute total count
  loadState(file) {
    if (!fs.existsSync(file)) {
      return { maxId: null, page: 1, totalCount: 0 };
    }

    const pages = JSON.parse(fs.readFileSync(file, "utf-8"));
    const last = pages.at(-1);

    return {
      maxId: last?.data?.at(-1)?.id ?? null,
      page: pages.length + 1,
      totalCount: pages.reduce((a, p) => a + p.data.length, 0),
    };
  }

  // Save page data
  savePage(file, pageData, pageNumber) {
    const pages = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf-8"))
      : [];

    pages.push({
      page: pageNumber,
      fetched_at: new Date().toISOString(),
      data: pageData.data,
    });

    fs.writeFileSync(file, JSON.stringify(pages, null, 2));
  }
}
