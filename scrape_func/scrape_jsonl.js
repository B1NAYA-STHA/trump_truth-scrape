import fs from "fs";
import { Impit } from "impit";
import { scrapeStatuses } from "./post_scrape.js";

// JSONL storage 
const jsonlStore = {
  loadState(file) {
    if (!fs.existsSync(file)) return { maxId: null, page: 1 };
    const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
    const last = JSON.parse(lines.at(-1));
    return { maxId: last.data.at(-1).id, page: lines.length + 1 };
  },
  savePage(file, pageData, pageNumber) {
    const record = {
      page: pageNumber,
      fetched_at: new Date().toISOString(),
      data: pageData.data,
    };
    fs.appendFileSync(file, JSON.stringify(record) + "\n");
  },
};

// initialize Impit
const impit = new Impit({
  browser: "chrome",
  ignoreTlsErrors: true,
});

const httpClient = async (url, options) => {
  const res = await impit.fetch(url, options);
  return {
    status: res.status,
    data: await res.json(),
  };
};

// run scraper
await scrapeStatuses({
  httpClient,
  store: jsonlStore,
  outputFile: "statuses.jsonl",
  delay: 4000,
});
