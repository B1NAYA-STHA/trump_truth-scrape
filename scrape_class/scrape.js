import { Impit } from "impit";
import { TruthSocialScraper } from "./post_scrape.js";

// Init Impit
const impit = new Impit({
  browser: "chrome",
  ignoreTlsErrors: true,
});

// Wrap Impit to httpClient
const httpClient = async (url, options = {}) => {
  const res = await impit.fetch(url, options);
  return {
    status: res.status,
    data: await res.json(),
  };
};

// Create scraper
const scraper = new TruthSocialScraper({
  username: "realDonaldTrump",
  httpClient,
  outputFile: "statuses.json",
  maxStatuses: 100,
});

await scraper.scrape();
