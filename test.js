import { Impit } from "impit";

const impit = new Impit({
  browser: "chrome",
  ignoreTlsErrors: true,
});

async function fetchStatuses(username) {
  try {
    // Step 1: Lookup the user to get numeric ID
    const lookupUrl = `https://truthsocial.com/api/v1/accounts/lookup?acct=${username}`;
    const lookupRes = await impit.fetch(lookupUrl, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      },
    });
    const userData = await lookupRes.json();
    const userId = userData.id;
    console.log("User ID:", userId);

    // Step 2: Fetch statuses using the numeric ID
    const statusesUrl = `https://truthsocial.com/api/v1/accounts/${userId}/statuses?exclude_replies=true&only_replies=false&with_muted=true`;
    const statusesRes = await impit.fetch(statusesUrl, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      },
    });
    const statusesData = await statusesRes.json();
    console.log("Statuses:", statusesData);

  } catch (err) {
    console.error("Error fetching statuses:", err);
  }
}

// Example usage
fetchStatuses("FoxNews");
