import { chromium, Browser, Page, BrowserContext } from 'playwright';

export class BrowserAutomationService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async launch(headless: boolean = true) {
        if (this.browser) return;

        console.log('[BrowserAutomation] Launching browser...');
        this.browser = await chromium.launch({ headless });
        this.context = await this.browser.newContext();
        this.page = await this.context.newPage();
        console.log('[BrowserAutomation] Browser launched.');
    }

    async navigate(url: string) {
        if (!this.page) await this.launch();
        if (!this.page) throw new Error('Failed to initialize page');

        console.log(`[BrowserAutomation] Navigating to ${url}...`);
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        return { title: await this.page.title(), url: this.page.url() };
    }

    async screenshot(): Promise<string> {
        if (!this.page) throw new Error('No active page to screenshot');

        console.log('[BrowserAutomation] Taking screenshot...');
        const buffer = await this.page.screenshot({ type: 'png' });
        return buffer.toString('base64');
    }

    async getContent(): Promise<string> {
        if (!this.page) throw new Error('No active page');
        return await this.page.content();
    }

    async close() {
        if (this.browser) {
            console.log('[BrowserAutomation] Closing browser...');
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
    }
}
