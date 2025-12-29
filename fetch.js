const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = "https://trumpstruth.org/";
const MAX_PAGES = 10;

let serial = 1;

async function scrapePage(url) {
  try {
    const response = await axios.get(url);
    if (response.status !== 200) {
      console.log(`Failed to load page: ${response.status}`);
      return null;
    }

    const $ = cheerio.load(response.data);
    const statuses = $('div.status');

    statuses.each((i, status) => {
      const $status = $(status);
      const statusUrl = $status.attr('data-status-url')?.trim();
      if (!statusUrl) return;

      const profileName = $status.find('.status-info__account-name').text().trim();
      const username = $status.find('.status-info__meta-item').first().text().trim();
      const date = $status.find('.status-info__meta-item').last().text().trim();
      const originalPostLink = $status.find('.status__external-link').attr('href');
      const content = $status.find('.status__content').text().trim();

      console.log(`Status ${serial}:`);
      console.log(`Data-status-url: ${statusUrl}`);
      console.log(`Profile Name: ${profileName}`);
      console.log(`Username: ${username}`);
      console.log(`Date: ${date}`);
      console.log(`Original Post Link: ${originalPostLink}`);
      console.log(`Content: ${content}`);
      console.log('-'.repeat(80));
      serial++;
    });

    // Get next page URL
    const nextPageLink = $('.pagination a:contains("Next Page")').attr('href');
    return nextPageLink ? nextPageLink : null;

  } catch (error) {
    console.error(error);
    return null;
  }
}

(async () => {
  let pageUrl = BASE_URL;
  for (let i = 0; i < MAX_PAGES; i++) {
    if (!pageUrl) break;
    console.log(`\nScraping page ${i + 1}...`);
    pageUrl = await scrapePage(pageUrl);
  }
})();
