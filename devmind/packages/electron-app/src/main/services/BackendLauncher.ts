import { spawn, execSync, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { app } from 'electron';

export class BackendLauncher extends EventEmitter {
    private springProcess: ChildProcess | null = null;
    private javaPath: string = '/opt/homebrew/opt/openjdk@21/bin/java';

    constructor() {
        super();
        try {
            if (!fs.existsSync(this.javaPath)) {
                this.javaPath = 'java';
            }
        } catch (e) {
            this.javaPath = 'java';
        }
    }

    async start() {
        try {
            this.emit('status', 'Checking Neo4j...');
            try {
                await this.ensureNeo4jRunning();
            } catch (neoError: any) {
                console.warn(`[BackendLauncher] Neo4j startup failed, but continuing: ${neoError.message}`);
                this.emit('status', 'Neo4j fail (Optional). Starting Spring...');
            }

            this.emit('status', 'Starting Spring Boot backend...');
            await this.startSpringBoot();

            this.emit('ready');
        } catch (error: any) {
            this.emit('error', error.message);
            throw error;
        }
    }

    private async ensureNeo4jRunning(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Check if neo4j is already running via brew services
                let isRunning = false;
                try {
                    const statusOutput = execSync('brew services info neo4j --json', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
                    const info = JSON.parse(statusOutput);
                    if (info[0] && info[0].status === 'started') {
                        isRunning = true;
                    }
                } catch (e) {
                    // fall back to port check
                }

                if (isRunning) {
                    console.log('[BackendLauncher] Neo4j is already running.');
                    resolve();
                    return;
                }

                // If not running, try to start it
                console.log('[BackendLauncher] Starting Neo4j...');
                try {
                    execSync('brew services start neo4j', { stdio: 'inherit' });
                } catch (e: any) {
                    console.warn('[BackendLauncher] brew services start failed, trying port check anyway...');
                }

                // Wait for it to be ready
                let retries = 0;
                const checkInterval = setInterval(() => {
                    try {
                        execSync('nc -z localhost 7687', { stdio: 'ignore' });
                        clearInterval(checkInterval);
                        console.log('[BackendLauncher] Neo4j is ready.');
                        resolve();
                    } catch (e) {
                        retries++;
                        if (retries > 10) { // Reduced timeout for non-critical check
                            clearInterval(checkInterval);
                            console.warn('[BackendLauncher] Neo4j port 7687 not responsive. Moving on.');
                            resolve(); // Resolve anyway to allow Spring to try
                        }
                    }
                }, 1000);
            } catch (error: any) {
                console.warn('[BackendLauncher] General Neo4j check error:', error.message);
                resolve();
            }
        });
    }

    private async startSpringBoot(): Promise<void> {
        return new Promise((resolve, reject) => {
            const jarPath = app.isPackaged
                ? path.join(process.resourcesPath, 'java-backend', 'spring-backend-0.0.1-SNAPSHOT.jar')
                : path.resolve(process.cwd(), '../spring-backend/build/libs/spring-backend-0.0.1-SNAPSHOT.jar');

            if (!fs.existsSync(jarPath)) {
                console.warn(`[BackendLauncher] Spring Boot JAR not found at ${jarPath}. Skipping.`);
                resolve();
                return;
            }

            console.log(`[BackendLauncher] Spawning Spring Boot: ${this.javaPath} -jar ${jarPath}`);
            this.springProcess = spawn(this.javaPath, ['-jar', jarPath], {
                cwd: path.dirname(jarPath)
            });

            this.springProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log(`[Spring] ${output}`);
                if (output.includes('Started SpringBackendApplication')) {
                    resolve();
                }
            });

            this.springProcess.stderr?.on('data', (data: Buffer) => {
                const output = data.toString();
                console.error(`[Spring Error] ${output}`);
                if (output.includes('Web server failed to start') || output.includes('Port') && output.includes('in use')) {
                    this.emit('error', 'Spring Port Conflict');
                }
            });

            this.springProcess.on('error', (err: Error) => {
                this.emit('error', err.message);
                reject(err);
            });

            this.springProcess.on('exit', (code: number | null) => {
                console.log(`[BackendLauncher] Spring Boot exited with code ${code}`);
                if (code !== 0 && code !== null) {
                    this.emit('error', `Spring Boot exited with code ${code}`);
                }
            });

            // Timeout to resolve if it takes too long but doesn't exit
            setTimeout(() => resolve(), 15000);
        });
    }

    stop() {
        if (this.springProcess) {
            this.springProcess.kill();
        }
    }
}
