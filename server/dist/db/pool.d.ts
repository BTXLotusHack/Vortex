import { type QueryResultRow } from "pg";
export declare function query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<import("pg").QueryResult<T>>;
//# sourceMappingURL=pool.d.ts.map