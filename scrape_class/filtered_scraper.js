import { TruthSocialScraper } from "./post_scrape.js";

// Extended scraper that filters statuses

export class FilteredScraper extends TruthSocialScraper {
  constructor(options) {
    super(options); // call parent constructor
    this.keyword = options.keyword?.toLowerCase();
  }

  // Override save() method
  save(pageData, pageNumber) {
    // Filter statuses before saving
    const filtered = this.keyword
      ? pageData.data.filter(
          s => s.content?.toLowerCase().includes(this.keyword)
        )
      : pageData.data;

    console.log( `Page ${pageNumber}: ${filtered.length}/${pageData.data.length} statuses kept`);

    // Call original save logic
    return super.save(
      { ...pageData, data: filtered },
      pageNumber
    );
  }
}
