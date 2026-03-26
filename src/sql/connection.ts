import type { AppConfig } from "../utils/config.js";

export type DbEngine = "postgresql" | "mysql" | "sqlite" | "sqlserver";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawConnection = any;

export class Connection {
    private readonly config: AppConfig;

    constructor(config: AppConfig) {
        this.config = config;
    }

    async connect(): Promise<RawConnection> {
        throw new Error(`Not implemented for dbType=${this.config.dbType}`);
    }
}
