import { Impit } from "impit";
import { scrapeStatuses, jsonStore } from "./post_scrape.js";

const username = "FoxNews"; // username of the account to scrape
const maxStatuses = 50;     // limit number of posts, null = scrape all

// Initialize Impit
const impit = new Impit({
  browser: "chrome",
  ignoreTlsErrors: true,
});

// Wrap Impit into a user-supplied HTTP client for the scraper
const httpClient = async (url, options) => {
  const res = await impit.fetch(url, options);
  return {
    status: res.status,
    data: await res.json(),
  };
};

// Run the scraper
await scrapeStatuses({
  username,           // Pass the username 
  httpClient,         // Use Impit wrapped client
  store: jsonStore,   // JSON storage (default)
  outputFile: "statuses.json", // File to save posts
  maxStatuses,       // optional: Limit number of posts
});
