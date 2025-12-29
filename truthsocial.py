import cloudscraper

scraper = cloudscraper.create_scraper()  # returns a CloudScraper instance
url = "https://truthsocial.com/api/v1/accounts/107780257626128497/statuses?exclude_replies=true&only_replies=false&with_muted=true"

response = scraper.get(url)
print(response.status_code)
print(response.text)
