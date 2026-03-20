import * as Parser from 'web-tree-sitter';

export interface ASTNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    children: ASTNode[];
}

export class TreeSitterParser {
    private parser: any | null = null;
    private languageMap: Map<string, any> = new Map();

    /**
     * Initialize the WebAssembly Tree-sitter parser.
     * Note: In a production build, the .wasm files must be copied into the packaged app assets.
     */
    public async initialize() {
        if (this.parser) return;

        console.log('[TreeSitterParser] Initializing WASM parser...');
        await (Parser as any).init();
        this.parser = new (Parser as any)();
        console.log('[TreeSitterParser] Initialization complete.');
    }

    /**
     * Load a specific language grammar WASM file.
     * @param lang The language identifier (e.g. 'javascript', 'python')
     * @param wasmPath The absolute path to the compiled tree-sitter-[lang].wasm file.
     */
    public async loadLanguage(lang: string, wasmPath: string) {
        if (!this.parser) throw new Error('Parser not initialized. Call initialize() first.');

        console.log(`[TreeSitterParser] Loading language grammar: ${lang} from ${wasmPath}`);
        try {
            const Language = await (Parser as any).Language.load(wasmPath);
            this.languageMap.set(lang, Language);
            return true;
        } catch (error) {
            console.error(`[TreeSitterParser] Failed to load language ${lang}:`, error);
            return false;
        }
    }

    /**
     * Parse code into a serialized AST structure.
     */
    public parse(code: string, lang: string): ASTNode {
        if (!this.parser) throw new Error('Parser not initialized.');

        const language = this.languageMap.get(lang);
        if (!language) {
            throw new Error(`Language '${lang}' not loaded. Call loadLanguage() first.`);
        }

        this.parser.setLanguage(language);
        const tree = this.parser.parse(code);

        return this.serializeNode(tree.rootNode);
    }

    private serializeNode(node: any): ASTNode {
        return {
            type: node.type,
            text: node.text,
            startPosition: { row: node.startPosition.row, column: node.startPosition.column },
            endPosition: { row: node.endPosition.row, column: node.endPosition.column },
            children: node.children.map((child: any) => this.serializeNode(child))
        };
    }
}
