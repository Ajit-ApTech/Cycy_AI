import { ESLint, Linter } from 'eslint';
import * as path from 'path';
import * as fs from 'fs';

export interface LintResult {
    filePath: string;
    messages: {
        line: number;
        column: number;
        severity: Linter.Severity;
        message: string;
        ruleId: string | null;
    }[];
    errorCount: number;
    warningCount: number;
}

export class LinterService {
    private eslint: ESLint;
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        this.eslint = this.createEslintInstance(projectRoot);
    }

    private createEslintInstance(root: string): ESLint {
        return new ESLint({
            cwd: root,
            overrideConfig: [
                {
                    rules: {
                        'no-unused-vars': 'warn',
                        'no-console': 'off'
                    }
                }
            ]
        });
    }

    public setCwd(newRoot: string) {
        this.projectRoot = newRoot;
        this.eslint = this.createEslintInstance(newRoot);
        console.log(`[LinterService] CWD updated to: ${newRoot}`);
    }

    async lintFile(filePath: string): Promise<LintResult | null> {
        try {
            if (!fs.existsSync(filePath)) return null;

            const results = await this.eslint.lintFiles([filePath]);
            const result = results[0];

            return {
                filePath: result.filePath,
                messages: result.messages.map((m: Linter.LintMessage) => ({
                    line: m.line,
                    column: m.column,
                    severity: m.severity,
                    message: m.message,
                    ruleId: m.ruleId
                })),
                errorCount: result.errorCount,
                warningCount: result.warningCount
            };
        } catch (error: any) {
            console.error(`[LinterService] Lint error: ${error.message}`);
            return null;
        }
    }

    async lintText(text: string, filePath: string): Promise<LintResult | null> {
        try {
            const results = await this.eslint.lintText(text, { filePath });
            const result = results[0];

            return {
                filePath: result.filePath || filePath,
                messages: result.messages.map((m: Linter.LintMessage) => ({
                    line: m.line,
                    column: m.column,
                    severity: m.severity,
                    message: m.message,
                    ruleId: m.ruleId
                })),
                errorCount: result.errorCount,
                warningCount: result.warningCount
            };
        } catch (error: any) {
            console.error(`[LinterService] Lint text error: ${error.message}`);
            return null;
        }
    }
}
