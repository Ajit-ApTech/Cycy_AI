import * as vscode from 'vscode';
import { CycyChatViewProvider } from './webview/CycyChatViewProvider';
import { SettingsManager } from './services/SettingsManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Cycy AI Extension is now active!');

    const settingsManager = new SettingsManager(context);
    const provider = new CycyChatViewProvider(context.extensionUri, settingsManager);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(CycyChatViewProvider.viewType, provider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cycy.openChat', () => {
            vscode.commands.executeCommand('workbench.view.extension.cycy-view-container');
        })
    );
}

export function deactivate() {}
