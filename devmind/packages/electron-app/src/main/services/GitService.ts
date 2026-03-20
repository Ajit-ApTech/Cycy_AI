import { simpleGit, SimpleGit, StatusResult, LogResult } from 'simple-git';

export class GitService {
    private git: SimpleGit;

    constructor(projectRoot: string) {
        this.git = simpleGit(projectRoot);
    }

    public setCwd(newRoot: string) {
        this.git = simpleGit(newRoot);
        console.log(`[GitService] CWD updated to: ${newRoot}`);
    }

    async status(): Promise<StatusResult> {
        return await this.git.status();
    }

    async log(maxCount: number = 10): Promise<LogResult> {
        return await this.git.log({ maxCount });
    }

    async commit(message: string): Promise<any> {
        return await this.git.commit(message);
    }

    async push(remote: string = 'origin', branch: string = 'master'): Promise<any> {
        return await this.git.push(remote, branch);
    }

    async pull(remote: string = 'origin', branch: string = 'master'): Promise<any> {
        return await this.git.pull(remote, branch);
    }

    async listRemotes(): Promise<any> {
        return await this.git.getRemotes(true);
    }
}
