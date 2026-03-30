import { IGNORE_TABLE } from "../utils/constants.js";
import type { RawConnection } from "./connection.js";

export type SchemaMap = Record<string, Array<[string, string]>>;

export class SQLSchemaExtractor {
    private readonly connection: RawConnection;

    constructor(connection: RawConnection) {
        this.connection = connection;
    }

    async extractSchema(): Promise<SchemaMap> {
        if (this.connection.engine === "postgresql") {
            const result = await this.connection.query(`
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
            `);
            return this.parseInformationSchema(result.rows);
        }

        if (this.connection.engine === "mysql") {
            const result = await this.connection.query(`
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                ORDER BY table_name, ordinal_position
            `);
            return this.parseInformationSchema(result.rows);
        }

        if (this.connection.engine === "sqlserver") {
            const result = await this.connection.query(`
                SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'dbo'
                ORDER BY TABLE_NAME, ORDINAL_POSITION
            `);
            return this.parseInformationSchema(result.rows);
        }

        const tablesResult = await this.connection.query(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        const schema: SchemaMap = {};

        for (const row of tablesResult.rows) {
            const tableNameValue = row.name;
            if (typeof tableNameValue !== "string") {
                continue;
            }

            const tableName = tableNameValue.trim();
            if (!tableName || IGNORE_TABLE.has(tableName.toLowerCase())) {
                continue;
            }

            const escapedTableName = tableName.replace(/'/g, "''");
            const columnsResult = await this.connection.query(`PRAGMA table_info('${escapedTableName}')`);

            const columns: Array<[string, string]> = [];
            for (const columnRow of columnsResult.rows) {
                const name = typeof columnRow.name === "string" ? columnRow.name : String(columnRow.name ?? "");
                const typeValue = columnRow.type;
                const type = typeof typeValue === "string" && typeValue.trim() ? typeValue : "TEXT";

                if (name.trim()) {
                    columns.push([name, type]);
                }
            }

            schema[tableName] = columns;
        }

        return schema;
    }

    formatForAI(schema: SchemaMap): string[] {
        return Object.entries(schema).map(([table, columns]) => {
            const columnDescriptions = columns.map(([column, type]) => `${column} (${type})`).join(", ");
            return `Table name: ${table}. It has the following columns: ${columnDescriptions}`;
        });
    }

    private parseInformationSchema(rows: Array<Record<string, unknown>>): SchemaMap {
        const schema: SchemaMap = {};

        for (const row of rows) {
            const tableNameValue = row.table_name;
            const columnNameValue = row.column_name;
            const dataTypeValue = row.data_type;

            if (typeof tableNameValue !== "string" || typeof columnNameValue !== "string") {
                continue;
            }

            const tableName = tableNameValue.trim();
            if (!tableName || IGNORE_TABLE.has(tableName.toLowerCase())) {
                continue;
            }

            const columnName = columnNameValue.trim();
            if (!columnName) {
                continue;
            }

            const dataType = typeof dataTypeValue === "string" && dataTypeValue.trim() ? dataTypeValue : "TEXT";

            if (!schema[tableName]) {
                schema[tableName] = [];
            }

            schema[tableName].push([columnName, dataType]);
        }

        return schema;
    }
}
