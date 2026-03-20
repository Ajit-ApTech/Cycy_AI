import { chromium, Browser, Page } from 'playwright';

export class PlaywrightService {
    private browser: Browser | null = null;
    private page: Page | null = null;

    constructor() { }

    public async init() {
        console.log('[PlaywrightService] Launching local browser instance...');
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage();
    }

    public async navigate(url: string) {
        if (!this.page) throw new Error('Browser not initialized');
        await this.page.goto(url);
        console.log(`[PlaywrightService] Navigated to ${url}`);
    }

    public async scrapeText(): Promise<string> {
        if (!this.page) throw new Error('Browser not initialized');
        return await this.page.evaluate(() => document.body.innerText);
    }

    public async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
