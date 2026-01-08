/**
 * LinkedIn Automation Module
 *
 * WARNING: This violates LinkedIn's Terms of Service.
 * Use at your own risk - account suspension is possible.
 *
 * Tips to reduce detection:
 * - Don't run too frequently (wait 24h between sessions)
 * - Keep search counts low (50-100 per session)
 * - Use during normal hours
 * - Don't run headless (set headless: false)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Storage for session cookies
const COOKIES_PATH = path.join(__dirname, '.linkedin-cookies.json');

class LinkedInScraper {
  constructor(options = {}) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.options = {
      headless: false, // Set to false to reduce detection
      slowMo: 100, // Slow down actions to appear more human
      ...options
    };
  }

  // Random delay to appear human
  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Initialize browser
  async init() {
    this.browser = await chromium.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    // Load saved cookies if they exist
    await this.loadCookies();

    this.page = await this.context.newPage();

    // Add stealth scripts
    await this.page.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    });
  }

  // Save cookies for session persistence
  async saveCookies() {
    const cookies = await this.context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('Cookies saved');
  }

  // Load cookies from previous session
  async loadCookies() {
    try {
      if (fs.existsSync(COOKIES_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
        await this.context.addCookies(cookies);
        console.log('Cookies loaded from previous session');
        return true;
      }
    } catch (error) {
      console.log('No saved cookies found');
    }
    return false;
  }

  // Check if logged in
  async isLoggedIn() {
    await this.page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
    await this.randomDelay(2000, 4000);

    // Check for feed or login page
    const url = this.page.url();
    return !url.includes('/login') && !url.includes('/checkpoint');
  }

  // Login to LinkedIn
  async login(email, password) {
    console.log('Attempting to log in...');

    await this.page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });
    await this.randomDelay(2000, 4000);

    // Enter email
    await this.page.fill('#username', email);
    await this.randomDelay(500, 1500);

    // Enter password
    await this.page.fill('#password', password);
    await this.randomDelay(500, 1500);

    // Click sign in
    await this.page.click('[type="submit"]');

    // Wait for navigation
    await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await this.randomDelay(3000, 5000);

    // Check for security checkpoint
    const url = this.page.url();
    if (url.includes('/checkpoint')) {
      console.log('Security checkpoint detected. Please complete the verification manually.');
      console.log('Waiting 60 seconds for manual verification...');

      // Wait for manual verification
      await this.page.waitForURL('**/feed/**', { timeout: 60000 }).catch(() => {
        throw new Error('Login failed - security checkpoint not completed');
      });
    }

    // Verify login success
    if (await this.isLoggedIn()) {
      console.log('Login successful!');
      await this.saveCookies();
      return true;
    } else {
      throw new Error('Login failed - please check credentials');
    }
  }

  // Build search URL from job requirements
  buildSearchUrl(job, options = {}) {
    const { page = 1, location = '' } = options;

    // Base people search URL
    let url = 'https://www.linkedin.com/search/results/people/?';

    // Build keywords from job title and skills
    const keywords = [
      job.title,
      ...(job.requiredSkills || []).slice(0, 5)
    ].join(' ');

    const params = new URLSearchParams({
      keywords: keywords,
      origin: 'GLOBAL_SEARCH_HEADER',
      page: page.toString()
    });

    // Add location if specified
    if (location || job.location?.city) {
      params.append('geoUrn', ''); // Would need to map cities to LinkedIn geo URNs
    }

    return url + params.toString();
  }

  // Search for candidates
  async searchCandidates(job, options = {}) {
    const { maxResults = 100, location = '' } = options;
    const candidates = [];
    let page = 1;
    const resultsPerPage = 10;
    const maxPages = Math.ceil(maxResults / resultsPerPage);

    console.log(`Searching for candidates matching: ${job.title}`);
    console.log(`Target: ${maxResults} candidates`);

    while (candidates.length < maxResults && page <= maxPages) {
      console.log(`Fetching page ${page}...`);

      const searchUrl = this.buildSearchUrl(job, { page, location });
      await this.page.goto(searchUrl, { waitUntil: 'networkidle' });
      await this.randomDelay(3000, 6000);

      // Check for "no results" or blocked
      const noResults = await this.page.$('.search-reusable-search-no-results');
      if (noResults) {
        console.log('No more results found');
        break;
      }

      // Extract profile cards
      const profileCards = await this.page.$$('.reusable-search__result-container');

      if (profileCards.length === 0) {
        console.log('No profile cards found - might be rate limited');
        break;
      }

      for (const card of profileCards) {
        if (candidates.length >= maxResults) break;

        try {
          const candidate = await this.extractCandidateFromCard(card);
          if (candidate) {
            candidates.push(candidate);
            console.log(`Found: ${candidate.name} - ${candidate.headline}`);
          }
        } catch (error) {
          console.log('Error extracting candidate:', error.message);
        }
      }

      // Random delay between pages (important for avoiding detection)
      await this.randomDelay(5000, 10000);
      page++;
    }

    console.log(`Found ${candidates.length} candidates`);
    return candidates;
  }

  // Extract candidate info from search result card
  async extractCandidateFromCard(card) {
    try {
      // Get name
      const nameEl = await card.$('.entity-result__title-text a span[aria-hidden="true"]');
      const name = nameEl ? await nameEl.textContent() : null;

      if (!name || name === 'LinkedIn Member') return null;

      // Get profile URL
      const linkEl = await card.$('.entity-result__title-text a');
      const profileUrl = linkEl ? await linkEl.getAttribute('href') : null;

      // Get headline (current position)
      const headlineEl = await card.$('.entity-result__primary-subtitle');
      const headline = headlineEl ? await headlineEl.textContent() : '';

      // Get location
      const locationEl = await card.$('.entity-result__secondary-subtitle');
      const location = locationEl ? await locationEl.textContent() : '';

      // Get summary/snippet
      const summaryEl = await card.$('.entity-result__summary');
      const summary = summaryEl ? await summaryEl.textContent() : '';

      return {
        name: name.trim(),
        headline: headline.trim(),
        location: location.trim(),
        summary: summary.trim(),
        profileUrl: profileUrl ? `https://www.linkedin.com${profileUrl.split('?')[0]}` : null,
        source: 'LinkedIn'
      };
    } catch (error) {
      return null;
    }
  }

  // Get full profile details
  async getProfileDetails(profileUrl) {
    console.log(`Fetching profile: ${profileUrl}`);

    await this.page.goto(profileUrl, { waitUntil: 'networkidle' });
    await this.randomDelay(3000, 6000);

    const profile = {
      profileUrl,
      source: 'LinkedIn'
    };

    try {
      // Name
      const nameEl = await this.page.$('h1.text-heading-xlarge');
      profile.name = nameEl ? (await nameEl.textContent()).trim() : 'Unknown';

      // Headline
      const headlineEl = await this.page.$('.text-body-medium.break-words');
      profile.headline = headlineEl ? (await headlineEl.textContent()).trim() : '';

      // Location
      const locationEl = await this.page.$('.text-body-small.inline.t-black--light.break-words');
      profile.location = locationEl ? (await locationEl.textContent()).trim() : '';

      // About/Summary
      const aboutSection = await this.page.$('#about ~ .display-flex .inline-show-more-text');
      profile.summary = aboutSection ? (await aboutSection.textContent()).trim() : '';

      // Experience
      profile.experience = await this.extractExperience();

      // Skills
      profile.skills = await this.extractSkills();

      // Education
      profile.education = await this.extractEducation();

      // Calculate years of experience
      profile.yearsOfExperience = this.calculateYearsOfExperience(profile.experience);

    } catch (error) {
      console.log('Error extracting profile details:', error.message);
    }

    return profile;
  }

  // Extract experience section
  async extractExperience() {
    const experiences = [];

    try {
      // Click to expand experience section if needed
      const expSection = await this.page.$('#experience');
      if (!expSection) return experiences;

      const expItems = await this.page.$$('#experience ~ .pvs-list__outer-container > ul > li');

      for (const item of expItems.slice(0, 5)) { // Limit to 5 most recent
        try {
          const titleEl = await item.$('.t-bold span[aria-hidden="true"]');
          const companyEl = await item.$('.t-normal span[aria-hidden="true"]');
          const durationEl = await item.$('.t-black--light span[aria-hidden="true"]');

          const title = titleEl ? (await titleEl.textContent()).trim() : '';
          const company = companyEl ? (await companyEl.textContent()).trim() : '';
          const duration = durationEl ? (await durationEl.textContent()).trim() : '';

          if (title) {
            experiences.push({
              title,
              company,
              duration,
              current: duration.toLowerCase().includes('present')
            });
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.log('Error extracting experience:', error.message);
    }

    return experiences;
  }

  // Extract skills section
  async extractSkills() {
    const skills = [];

    try {
      // Navigate to skills section
      const skillsLink = await this.page.$('a[href*="/details/skills"]');
      if (skillsLink) {
        await skillsLink.click();
        await this.randomDelay(2000, 4000);

        const skillItems = await this.page.$$('.pvs-list__paged-list-item .t-bold span[aria-hidden="true"]');

        for (const item of skillItems.slice(0, 20)) {
          const skill = await item.textContent();
          if (skill) skills.push(skill.trim());
        }

        // Go back
        await this.page.goBack();
        await this.randomDelay(1000, 2000);
      }
    } catch (error) {
      console.log('Error extracting skills:', error.message);
    }

    return skills;
  }

  // Extract education
  async extractEducation() {
    const education = { level: '', field: '' };

    try {
      const eduSection = await this.page.$('#education ~ .pvs-list__outer-container > ul > li');
      if (eduSection) {
        const degreeEl = await eduSection.$('.t-bold span[aria-hidden="true"]');
        const fieldEl = await eduSection.$('.t-normal span[aria-hidden="true"]');

        const degree = degreeEl ? (await degreeEl.textContent()).trim() : '';
        const field = fieldEl ? (await fieldEl.textContent()).trim() : '';

        // Parse degree level
        if (degree.toLowerCase().includes('phd') || degree.toLowerCase().includes('doctor')) {
          education.level = 'PhD';
        } else if (degree.toLowerCase().includes('master') || degree.toLowerCase().includes('mba') || degree.toLowerCase().includes('m.s')) {
          education.level = 'Masters';
        } else if (degree.toLowerCase().includes('bachelor') || degree.toLowerCase().includes('b.s') || degree.toLowerCase().includes('b.a')) {
          education.level = 'Bachelors';
        } else {
          education.level = degree;
        }

        education.field = field;
      }
    } catch (error) {
      console.log('Error extracting education:', error.message);
    }

    return education;
  }

  // Calculate years of experience from experience list
  calculateYearsOfExperience(experiences) {
    let totalMonths = 0;

    for (const exp of experiences) {
      const duration = exp.duration || '';

      // Parse years
      const yearsMatch = duration.match(/(\d+)\s*yr/i);
      if (yearsMatch) totalMonths += parseInt(yearsMatch[1]) * 12;

      // Parse months
      const monthsMatch = duration.match(/(\d+)\s*mo/i);
      if (monthsMatch) totalMonths += parseInt(monthsMatch[1]);
    }

    return Math.round(totalMonths / 12);
  }

  // Full search with profile details
  async searchAndGetDetails(job, options = {}) {
    const { maxResults = 50, getFullProfiles = false } = options;

    // First, do a search
    const searchResults = await this.searchCandidates(job, { maxResults });

    if (!getFullProfiles) {
      return searchResults;
    }

    // Get full details for each profile (slower but more data)
    console.log('Fetching full profile details...');
    const detailedCandidates = [];

    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      if (!result.profileUrl) continue;

      console.log(`[${i + 1}/${searchResults.length}] ${result.name}`);

      try {
        const details = await this.getProfileDetails(result.profileUrl);
        detailedCandidates.push(details);

        // Important: delay between profile views
        await this.randomDelay(8000, 15000);
      } catch (error) {
        console.log(`Error fetching ${result.name}:`, error.message);
        detailedCandidates.push(result); // Use basic info
      }
    }

    return detailedCandidates;
  }

  // Close browser
  async close() {
    if (this.browser) {
      await this.saveCookies();
      await this.browser.close();
      console.log('Browser closed');
    }
  }
}

module.exports = LinkedInScraper;
