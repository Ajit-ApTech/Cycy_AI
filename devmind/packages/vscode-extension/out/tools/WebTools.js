"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebTools = void 0;
class WebTools {
    async webSearch(query, allowedDomains, blockedDomains) {
        try {
            // We use DuckDuckGo HTML search for a zero-config web search
            const url = new URL('https://html.duckduckgo.com/html/');
            url.searchParams.append('q', query);
            if (allowedDomains && allowedDomains.length > 0) {
                const siteQuery = allowedDomains.map(d => `site:${d}`).join(' OR ');
                url.searchParams.set('q', `${query} ${siteQuery}`);
            }
            const response = await fetch(url.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (!response.ok) {
                return `WebSearch Error: Received status ${response.status} from search engine.`;
            }
            const text = await response.text();
            // Very basic extraction of search results from DuckDuckGo HTML
            // In a production app you'd use a better parser (like cheerio) or a real API
            const results = [];
            const resultRegex = /<a class="result__url" href="([^"]+)">([^<]+)<\/a>.*?<a class="result__snippet[^>]+>(.*?)<\/a>/gs;
            let match;
            while ((match = resultRegex.exec(text)) !== null && results.length < 5) {
                results.push({
                    url: match[1].trim(),
                    title: match[2].trim(),
                    // Remove nested HTML tags from snippet
                    snippet: match[3].replace(/<[^>]+>/g, '').trim()
                });
            }
            if (results.length === 0) {
                return "No search results found or parsing failed. Try WebFetch directly if you know the URL.";
            }
            let output = `Search Results for "${query}":\n\n`;
            results.forEach((r, i) => {
                output += `${i + 1}. ${r.title}\nURL: ${r.url}\n${r.snippet}\n\n`;
            });
            return output;
        }
        catch (error) {
            return `WebSearch Error: ${error.message}`;
        }
    }
    async webFetch(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            if (!response.ok) {
                return `WebFetch Error: HTTP ${response.status} ${response.statusText}`;
            }
            const contentType = response.headers.get('content-type') || '';
            const text = await response.text();
            if (contentType.includes('application/json')) {
                return text;
            }
            // For HTML, we do a very naive strip of script/style tags and then general tags.
            // A more robust implementation would use something like Turndown or Node.js DOM parser.
            let stripped = text
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '\n')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '\n')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            // Truncate to a reasonable character limit so we don't blow up context
            const LIMIT = 15000;
            if (stripped.length > LIMIT) {
                stripped = stripped.substring(0, LIMIT) + '\n\n...[Content Truncated]...';
            }
            return stripped;
        }
        catch (error) {
            return `WebFetch Error: ${error.message}`;
        }
    }
}
exports.WebTools = WebTools;
//# sourceMappingURL=WebTools.js.map