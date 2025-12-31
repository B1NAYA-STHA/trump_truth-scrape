import { Impit } from "impit";
import { TruthSocialScraper, JsonStore } from "./post_scrape.js";

const username = "realDonaldTrump"; // Target username

// Initialize Impit HTTP client
const impit = new Impit({ browser: "chrome", ignoreTlsErrors: true });

const httpClient = async (url, options) => {
  const res = await impit.fetch(url, options);
  return { status: res.status, data: await res.json() };
};

// Create scraper instance
const scraper = new TruthSocialScraper({
  username,
  httpClient,
  store: new JsonStore(),
  outputFile: "statuses.json",
  delay: 4000,
  maxStatuses: 100, 
});

// Run scraper
await scraper.scrape();
