import { Impit } from "impit";
import { scrapeStatuses, jsonStore } from "./post_scrape.js";

// initialize Impit
const impit = new Impit({
  browser: "chrome",
  ignoreTlsErrors: true,
});

// wrap Impit into httpClient for scraper
const httpClient = async (url, options) => {
  const res = await impit.fetch(url, options);
  return {
    status: res.status,
    data: await res.json(),
  };
};

// run the scraper with JSON storage (default)
await scrapeStatuses({
  httpClient,
  store: jsonStore,       
  outputFile: "statuses.json",
  delay: 4000,
});
