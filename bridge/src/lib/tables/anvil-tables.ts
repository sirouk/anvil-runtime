/**
 * Anvil Tables API Implementation
 * 
 * JavaScript/TypeScript equivalent of Python's anvil.tables module
 * Provides DataTable and DataRow classes with full CRUD operations
 */

import { getServerCallManager, type ServerCallError } from '../server/anvil-server-calls';

export interface TableSchema {
    name: string;
    columns: {
        [columnName: string]: {
            type: 'text' | 'number' | 'date' | 'datetime' | 'bool' | 'link_single' | 'link_multiple' | 'media' | 'simpleObject';
            required?: boolean;
            unique?: boolean;
            target?: string; // For link columns
            admin_ui?: {
                order?: number;
                width?: number;
            };
        };
    };
    client: 'none' | 'search' | 'full';
    server: 'none' | 'search' | 'full';
}

export interface SearchCriteria {
    [columnName: string]: any;
}

export interface SearchOptions {
    max_results?: number;
    page_size?: number;
    page_token?: string;
    order_by?: string | string[];
    columns_by_name?: string[];
}

export interface SearchResult<T = DataRow> {
    rows: T[];
    has_more: boolean;
    next_page_token?: string;
    total_count?: number;
}

/**
 * DataRow class representing a single row in an Anvil table
 * Matches the Python anvil.tables.Row API
 */
export class DataRow {
    private _table: DataTable;
    private _data: Record<string, any>;
    private _original_data: Record<string, any>;
    private _is_new: boolean;
    private _is_deleted: boolean;

    constructor(table: DataTable, data: Record<string, any> = {}, isNew: boolean = false) {
        this._table = table;
        this._data = { ...data };
        this._original_data = { ...data };
        this._is_new = isNew;
        this._is_deleted = false;

        // Create property getters/setters for each column
        this._createColumnProperties();
    }

    /**
     * Create dynamic properties for table columns
     */
    private _createColumnProperties(): void {
        const schema = this._table.getSchema();

        Object.keys(schema.columns).forEach(columnName => {
            Object.defineProperty(this, columnName, {
                get: () => this._data[columnName],
                set: (value: any) => {
                    this._data[columnName] = value;
                },
                enumerable: true,
                configurable: true
            });
        });
    }

    /**
     * Get the table this row belongs to
     */
    getTable(): DataTable {
        return this._table;
    }

    /**
     * Get all data as plain object
     */
    getData(): Record<string, any> {
        return { ...this._data };
    }

    /**
     * Get a specific column value
     */
    get(columnName: string): any {
        return this._data[columnName];
    }

    /**
     * Set a specific column value
     */
    set(columnName: string, value: any): void {
        this._data[columnName] = value;
    }

    /**
     * Update multiple columns at once
     */
    update(data: Record<string, any>): void {
        Object.assign(this._data, data);
    }

    /**
     * Save changes to the server
     */
    async save(): Promise<void> {
        try {
            if (this._is_new) {
                // Create new row
                const result = await getServerCallManager().call(
                    'anvil.tables.create_row',
                    [this._table.getName(), this._data]
                );
                this._data = result;
                this._original_data = { ...result };
                this._is_new = false;
            } else {
                // Update existing row
                const changes = this._getChanges();
                if (Object.keys(changes).length > 0) {
                    const result = await getServerCallManager().call(
                        'anvil.tables.update_row',
                        [this._table.getName(), this._data.id, changes]
                    );
                    this._data = result;
                    this._original_data = { ...result };
                }
            }
        } catch (error) {
            throw new AnvilTablesError(`Failed to save row: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Delete this row from the server
     */
    async delete(): Promise<void> {
        try {
            if (!this._is_new) {
                await getServerCallManager().call(
                    'anvil.tables.delete_row',
                    [this._table.getName(), this._data.id]
                );
            }
            this._is_deleted = true;
        } catch (error) {
            throw new AnvilTablesError(`Failed to delete row: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Get changes since last save
     */
    private _getChanges(): Record<string, any> {
        const changes: Record<string, any> = {};

        Object.keys(this._data).forEach(key => {
            if (this._data[key] !== this._original_data[key]) {
                changes[key] = this._data[key];
            }
        });

        return changes;
    }

    /**
     * Check if row has unsaved changes
     */
    isDirty(): boolean {
        return Object.keys(this._getChanges()).length > 0 || this._is_new;
    }

    /**
     * Check if row is new (not yet saved)
     */
    isNew(): boolean {
        return this._is_new;
    }

    /**
     * Check if row is deleted
     */
    isDeleted(): boolean {
        return this._is_deleted;
    }

    /**
     * Revert changes to last saved state
     */
    revert(): void {
        this._data = { ...this._original_data };
    }

    /**
     * Convert to JSON
     */
    toJSON(): Record<string, any> {
        return this.getData();
    }

    /**
     * String representation
     */
    toString(): string {
        return `DataRow(${this._table.getName()}, ${JSON.stringify(this._data)})`;
    }
}

/**
 * DataTable class representing an Anvil data table
 * Matches the Python anvil.tables.Table API
 */
export class DataTable {
    private _name: string;
    private _schema: TableSchema;

    constructor(name: string, schema: TableSchema) {
        this._name = name;
        this._schema = schema;
    }

    /**
     * Get table name
     */
    getName(): string {
        return this._name;
    }

    /**
     * Get table schema
     */
    getSchema(): TableSchema {
        return this._schema;
    }

    /**
     * Create a new row instance (not saved until .save() is called)
     */
    addRow(data: Record<string, any> = {}): DataRow {
        return new DataRow(this, data, true);
    }

    /**
     * Get a single row by ID
     */
    async getById(id: string | number): Promise<DataRow | null> {
        try {
            const result = await getServerCallManager().call(
                'anvil.tables.get_by_id',
                [this._name, id]
            );

            return result ? new DataRow(this, result, false) : null;
        } catch (error) {
            throw new AnvilTablesError(`Failed to get row by ID: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Search for rows matching criteria
     */
    async search(
        criteria: SearchCriteria = {},
        options: SearchOptions = {}
    ): Promise<SearchResult<DataRow>> {
        try {
            const result = await getServerCallManager().call(
                'anvil.tables.search',
                [this._name, criteria, options]
            );

            return {
                rows: result.rows.map((rowData: any) => new DataRow(this, rowData, false)),
                has_more: result.has_more || false,
                next_page_token: result.next_page_token,
                total_count: result.total_count
            };
        } catch (error) {
            throw new AnvilTablesError(`Failed to search table: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Get all rows (use with caution on large tables)
     */
    async getAll(options: SearchOptions = {}): Promise<DataRow[]> {
        const result = await this.search({}, options);
        return result.rows;
    }

    /**
     * Search for a single row
     */
    async getFirst(criteria: SearchCriteria = {}): Promise<DataRow | null> {
        const result = await this.search(criteria, { max_results: 1 });
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Count rows matching criteria
     */
    async count(criteria: SearchCriteria = {}): Promise<number> {
        try {
            const result = await getServerCallManager().call(
                'anvil.tables.count',
                [this._name, criteria]
            );
            return result;
        } catch (error) {
            throw new AnvilTablesError(`Failed to count rows: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Check if any rows match criteria
     */
    async exists(criteria: SearchCriteria = {}): Promise<boolean> {
        const count = await this.count(criteria);
        return count > 0;
    }

    /**
     * Delete all rows matching criteria
     */
    async deleteAll(criteria: SearchCriteria): Promise<number> {
        try {
            const result = await getServerCallManager().call(
                'anvil.tables.delete_all',
                [this._name, criteria]
            );
            return result;
        } catch (error) {
            throw new AnvilTablesError(`Failed to delete rows: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Create multiple rows in batch
     */
    async createBatch(rows: Record<string, any>[]): Promise<DataRow[]> {
        try {
            const result = await getServerCallManager().call(
                'anvil.tables.create_batch',
                [this._name, rows]
            );

            return result.map((rowData: any) => new DataRow(this, rowData, false));
        } catch (error) {
            throw new AnvilTablesError(`Failed to create batch: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Update multiple rows in batch
     */
    async updateBatch(updates: Array<{ id: string | number; data: Record<string, any> }>): Promise<DataRow[]> {
        try {
            const result = await getServerCallManager().call(
                'anvil.tables.update_batch',
                [this._name, updates]
            );

            return result.map((rowData: any) => new DataRow(this, rowData, false));
        } catch (error) {
            throw new AnvilTablesError(`Failed to update batch: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }
}

/**
 * Custom error class for table operations
 */
export class AnvilTablesError extends Error {
    public originalError?: ServerCallError;

    constructor(message: string, originalError?: ServerCallError) {
        super(message);
        this.name = 'AnvilTablesError';
        this.originalError = originalError;
    }
}

/**
 * Table Registry - manages available tables
 */
export class TableRegistry {
    private static tables: Map<string, DataTable> = new Map();
    private static schemas: Map<string, TableSchema> = new Map();

    /**
     * Register a table with its schema
     */
    static registerTable(name: string, schema: TableSchema): DataTable {
        this.schemas.set(name, schema);
        const table = new DataTable(name, schema);
        this.tables.set(name, table);
        return table;
    }

    /**
     * Get a registered table
     */
    static getTable(name: string): DataTable | null {
        return this.tables.get(name) || null;
    }

    /**
     * Get all registered tables
     */
    static getAllTables(): DataTable[] {
        return Array.from(this.tables.values());
    }

    /**
     * Check if table is registered
     */
    static hasTable(name: string): boolean {
        return this.tables.has(name);
    }

    /**
     * Load table schemas from server
     */
    static async loadSchemasFromServer(): Promise<void> {
        try {
            const schemas = await getServerCallManager().call('anvil.tables.list_tables');

            for (const schema of schemas) {
                this.registerTable(schema.name, schema);
            }
        } catch (error) {
            throw new AnvilTablesError(`Failed to load table schemas: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Clear all registered tables
     */
    static clear(): void {
        this.tables.clear();
        this.schemas.clear();
    }
}

/**
 * Main app_tables object - equivalent to Python's anvil.tables.app_tables
 */
export class AppTables {
    private static instance: AppTables | null = null;

    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Get singleton instance
     */
    static getInstance(): AppTables {
        if (!this.instance) {
            this.instance = new AppTables();
        }
        return this.instance;
    }

    /**
     * Initialize app tables (load schemas from server)
     */
    async initialize(): Promise<void> {
        await TableRegistry.loadSchemasFromServer();
        this._createTableProperties();
    }

    /**
     * Create dynamic properties for each table
     */
    private _createTableProperties(): void {
        TableRegistry.getAllTables().forEach(table => {
            const tableName = table.getName();
            Object.defineProperty(this, tableName, {
                get: () => table,
                enumerable: true,
                configurable: true
            });
        });
    }

    /**
     * Get table by name
     */
    getTable(name: string): DataTable | null {
        return TableRegistry.getTable(name);
    }

    /**
     * List all available tables
     */
    listTables(): string[] {
        return TableRegistry.getAllTables().map(table => table.getName());
    }
}

// Export singleton instance
export const app_tables = AppTables.getInstance();

/**
 * Query builder for complex searches
 */
export class Query {
    private criteria: SearchCriteria = {};
    private searchOptions: SearchOptions = {};

    /**
     * Add equality condition
     */
    eq(column: string, value: any): Query {
        this.criteria[column] = value;
        return this;
    }

    /**
     * Add not equal condition
     */
    ne(column: string, value: any): Query {
        this.criteria[`${column}__ne`] = value;
        return this;
    }

    /**
     * Add greater than condition
     */
    gt(column: string, value: any): Query {
        this.criteria[`${column}__gt`] = value;
        return this;
    }

    /**
     * Add greater than or equal condition
     */
    gte(column: string, value: any): Query {
        this.criteria[`${column}__gte`] = value;
        return this;
    }

    /**
     * Add less than condition
     */
    lt(column: string, value: any): Query {
        this.criteria[`${column}__lt`] = value;
        return this;
    }

    /**
     * Add less than or equal condition
     */
    lte(column: string, value: any): Query {
        this.criteria[`${column}__lte`] = value;
        return this;
    }

    /**
     * Add contains condition (for text fields)
     */
    contains(column: string, value: string): Query {
        this.criteria[`${column}__contains`] = value;
        return this;
    }

    /**
     * Add starts with condition
     */
    startsWith(column: string, value: string): Query {
        this.criteria[`${column}__startswith`] = value;
        return this;
    }

    /**
     * Add in condition (value in list)
     */
    in(column: string, values: any[]): Query {
        this.criteria[`${column}__in`] = values;
        return this;
    }

    /**
     * Add null check
     */
    isNull(column: string): Query {
        this.criteria[`${column}__isnull`] = true;
        return this;
    }

    /**
     * Add not null check
     */
    isNotNull(column: string): Query {
        this.criteria[`${column}__isnull`] = false;
        return this;
    }

    /**
     * Set order by
     */
    orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): Query {
        const orderBy = direction === 'desc' ? `-${column}` : column;
        this.searchOptions.order_by = orderBy;
        return this;
    }

    /**
     * Set limit
     */
    limit(count: number): Query {
        this.searchOptions.max_results = count;
        return this;
    }

    /**
     * Set page size for pagination
     */
    pageSize(size: number): Query {
        this.searchOptions.page_size = size;
        return this;
    }

    /**
     * Select specific columns
     */
    select(...columns: string[]): Query {
        this.searchOptions.columns_by_name = columns;
        return this;
    }

    /**
     * Execute query on table
     */
    async execute(table: DataTable): Promise<SearchResult<DataRow>> {
        return table.search(this.criteria, this.searchOptions);
    }

    /**
     * Get first result from query
     */
    async first(table: DataTable): Promise<DataRow | null> {
        this.limit(1);
        const result = await this.execute(table);
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Count results without fetching data
     */
    async count(table: DataTable): Promise<number> {
        return table.count(this.criteria);
    }

    /**
     * Get criteria object
     */
    getCriteria(): SearchCriteria {
        return { ...this.criteria };
    }

    /**
     * Get options object
     */
    getOptions(): SearchOptions {
        return { ...this.searchOptions };
    }
}

/**
 * Create a new query builder
 */
export function q(): Query {
    return new Query();
}

// Export main anvil.tables namespace
export const anvil_tables = {
    app_tables,
    DataTable,
    DataRow,
    Query,
    q,
    TableRegistry,
    AnvilTablesError
}; 