import fs from "fs";

const BASE_URL =
  "https://truthsocial.com/api/v1/accounts/107780257626128497/statuses";

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

const OUTPUT_FILE = "statuseses.json";
const USE_BROWSER = true; // true = Impit, false = Axios

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Fetcher function (Axios / Impit)

async function fetcher(url, headers, useBrowser) {
  if (useBrowser) {
    const { Impit } = await import("impit");

    const impit = new Impit({
      browser: "chrome",
      ignoreTlsErrors: true,
    });

    const res = await impit.fetch(url, { headers });

    if (!res.ok) {
      const err = new Error("Impit fetch failed");
      err.statusCode = res.status;
      throw err;
    }

    return res.json();
  } else {
    const axiosModule = await import("axios");
    const axios = axiosModule.default;

    try {
      const res = await axios.get(url, { headers });
      return res.data;
    } catch (err) {
      const e = new Error("Axios fetch failed");
      e.statusCode = err.response?.status;
      throw e;
    }
  }
}

// Retry function

async function withRetry(fn, maxRetries = 5) {
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err.statusCode !== 429) {
        throw err;
      }

      retries++;
      if (retries > maxRetries) {
        throw new Error("Too many retries. Stop & resume later.");
      }

      const wait = 10000 * Math.pow(2, retries - 1);
      console.log(`429 hit. Waiting ${wait / 1000}s (retry ${retries})`);
      await sleep(wait);
    }
  }
}

// Resume function 

function loadResumeState(file) {
  if (!fs.existsSync(file)) {
    return { maxId: null, page: 1 };
  }

  const pages = JSON.parse(fs.readFileSync(file, "utf-8"));
  const lastPage = pages.at(-1);

  return {
    maxId: lastPage?.data?.at(-1)?.id || null,
    page: lastPage ? lastPage.page + 1 : 1,
  };
}

// save to json function

function saveToJson(pageData, pageNumber) {
  const pages = fs.existsSync(OUTPUT_FILE)
    ? JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"))
    : [];

  pages.push({
    page: pageNumber,
    max_id_used: pageData.maxId,
    count: pageData.data.length,
    fetched_at: new Date().toISOString(),
    data: pageData.data,
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pages, null, 2));
}

// scrape function

async function scrapePage(maxId) {
  const params = new URLSearchParams({
    exclude_replies: "true",
    only_replies: "false",
    with_muted: "true",
    limit: "20",
  });

  if (maxId) params.append("max_id", maxId);

  const url = `${BASE_URL}?${params.toString()}`;

  return withRetry(() => fetcher(url, HEADERS, USE_BROWSER));
}

// main function

(async () => {
  let { maxId, page } = loadResumeState(OUTPUT_FILE);

  console.log(
    maxId
      ? `Resuming from page ${page} (max_id=${maxId})`
      : "Starting fresh scrape"
  );

  while (true) {
    console.log(`Fetching page ${page}`);

    const data = await scrapePage(maxId);

    if (!Array.isArray(data) || data.length === 0) {
      console.log("No more data.");
      break;
    }

    saveToJson(
      { maxId, data },
      page
    );

    maxId = data.at(-1).id;
    page++;

    console.log(`Saved page ${page - 1}`);
    await sleep(4000);
  }
})();
