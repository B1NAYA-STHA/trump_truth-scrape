import { Impit } from "impit";
import { FilteredScraper } from "./filtered_scraper.js";

const impit = new Impit({ browser: "chrome" });

const httpClient = async (url, options = {}) => {
  const res = await impit.fetch(url, options);
  return {
    status: res.status,
    data: await res.json(),
  };
};

// Use extended scraper for filtering posts
const scraper = new FilteredScraper({
  username: "realDonaldTrump",
  httpClient,
  keyword: "election",
  outputFile: "election_posts.json",
  maxStatuses: 10,
});

await scraper.scrape();
