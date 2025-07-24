/**
 * Anvil Tables System - Main Export File
 * 
 * Complete data tables implementation matching Python's anvil.tables API
 * with React hooks integration and TypeScript support
 */

// Core table classes and functionality
export {
    DataTable,
    DataRow,
    Query,
    AppTables,
    TableRegistry,
    AnvilTablesError,
    app_tables,
    anvil_tables,
    q,
    type TableSchema,
    type SearchCriteria,
    type SearchOptions,
    type SearchResult
} from './anvil-tables';

// React hooks for tables
export {
    useTable,
    useRow,
    useQuery,
    useBatchOperations,
    useTableInfo,
    useAppTables,
    useTableForm,
    type UseTableState,
    type UseTableOptions,
    type UseTableResult,
    type UseRowState,
    type UseRowResult
} from './use-anvil-tables';

// Import for internal use
import {
    app_tables,
    DataTable,
    DataRow,
    TableRegistry,
    q,
    type SearchCriteria,
    type SearchOptions,
    type SearchResult
} from './anvil-tables';

// Table utilities and helpers
export const TableUtils = {
    /**
     * Create a typed table interface
     */
    createTypedTable: <T extends Record<string, any>>(tableName: string) => {
        return {
            addRow: (data: Partial<T> = {}) => app_tables.getTable(tableName)?.addRow(data),
            getById: async (id: string | number) => app_tables.getTable(tableName)?.getById(id),
            search: async (criteria: SearchCriteria = {}, options: SearchOptions = {}) =>
                app_tables.getTable(tableName)?.search(criteria, options),
            count: async (criteria: SearchCriteria = {}) =>
                app_tables.getTable(tableName)?.count(criteria),
            exists: async (criteria: SearchCriteria) =>
                app_tables.getTable(tableName)?.exists(criteria)
        };
    },

    /**
     * Create a query builder for a specific table
     */
    createQueryBuilder: (tableName: string) => {
        const table = app_tables.getTable(tableName);
        if (!table) throw new Error(`Table '${tableName}' not found`);

        return q();
    },

    /**
     * Validate row data against table schema
     */
    validateRowData: (tableName: string, data: Record<string, any>): { valid: boolean; errors: string[] } => {
        const table = app_tables.getTable(tableName);
        if (!table) {
            return { valid: false, errors: [`Table '${tableName}' not found`] };
        }

        const schema = table.getSchema();
        const errors: string[] = [];

        Object.entries(schema.columns).forEach(([columnName, columnDef]) => {
            const value = data[columnName];

            // Check required fields
            if (columnDef.required && (value === undefined || value === null || value === '')) {
                errors.push(`Column '${columnName}' is required`);
            }

            // Type validation
            if (value !== undefined && value !== null) {
                switch (columnDef.type) {
                    case 'number':
                        if (typeof value !== 'number' && !Number.isFinite(Number(value))) {
                            errors.push(`Column '${columnName}' must be a number`);
                        }
                        break;
                    case 'bool':
                        if (typeof value !== 'boolean') {
                            errors.push(`Column '${columnName}' must be a boolean`);
                        }
                        break;
                    case 'date':
                    case 'datetime':
                        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
                            errors.push(`Column '${columnName}' must be a valid date`);
                        }
                        break;
                    case 'text':
                        if (typeof value !== 'string') {
                            errors.push(`Column '${columnName}' must be a string`);
                        }
                        break;
                }
            }
        });

        return { valid: errors.length === 0, errors };
    },

    /**
     * Convert row data to form fields
     */
    rowToFormFields: (row: DataRow): Record<string, any> => {
        const data = row.getData();
        const formFields: Record<string, any> = {};

        Object.entries(data).forEach(([key, value]) => {
            // Convert dates to string format for form inputs
            if (value instanceof Date) {
                formFields[key] = value.toISOString().split('T')[0];
            } else {
                formFields[key] = value;
            }
        });

        return formFields;
    },

    /**
     * Convert form fields back to row data
     */
    formFieldsToRowData: (tableName: string, fields: Record<string, any>): Record<string, any> => {
        const table = app_tables.getTable(tableName);
        if (!table) return fields;

        const schema = table.getSchema();
        const rowData: Record<string, any> = {};

        Object.entries(fields).forEach(([key, value]) => {
            const columnDef = schema.columns[key];
            if (!columnDef) {
                rowData[key] = value;
                return;
            }

            // Convert form values back to appropriate types
            switch (columnDef.type) {
                case 'number':
                    rowData[key] = value === '' ? null : Number(value);
                    break;
                case 'bool':
                    rowData[key] = Boolean(value);
                    break;
                case 'date':
                case 'datetime':
                    rowData[key] = value ? new Date(value) : null;
                    break;
                default:
                    rowData[key] = value;
            }
        });

        return rowData;
    },

    /**
     * Generate WHERE clause from search criteria
     */
    criteriaToWhereClause: (criteria: SearchCriteria): string => {
        const conditions: string[] = [];

        Object.entries(criteria).forEach(([key, value]) => {
            if (key.includes('__')) {
                const [column, operator] = key.split('__');
                switch (operator) {
                    case 'ne':
                        conditions.push(`${column} != ${JSON.stringify(value)}`);
                        break;
                    case 'gt':
                        conditions.push(`${column} > ${JSON.stringify(value)}`);
                        break;
                    case 'gte':
                        conditions.push(`${column} >= ${JSON.stringify(value)}`);
                        break;
                    case 'lt':
                        conditions.push(`${column} < ${JSON.stringify(value)}`);
                        break;
                    case 'lte':
                        conditions.push(`${column} <= ${JSON.stringify(value)}`);
                        break;
                    case 'contains':
                        conditions.push(`${column} LIKE '%${value}%'`);
                        break;
                    case 'startswith':
                        conditions.push(`${column} LIKE '${value}%'`);
                        break;
                    case 'in':
                        conditions.push(`${column} IN (${value.map((v: any) => JSON.stringify(v)).join(', ')})`);
                        break;
                    case 'isnull':
                        conditions.push(`${column} IS ${value ? 'NULL' : 'NOT NULL'}`);
                        break;
                }
            } else {
                conditions.push(`${key} = ${JSON.stringify(value)}`);
            }
        });

        return conditions.join(' AND ');
    },

    /**
     * Check if a table has been initialized
     */
    isTableReady: (tableName: string): boolean => {
        return TableRegistry.hasTable(tableName);
    },

    /**
     * Wait for table to be ready
     */
    waitForTable: (tableName: string, timeout: number = 10000): Promise<DataTable> => {
        return new Promise((resolve, reject) => {
            if (TableUtils.isTableReady(tableName)) {
                const table = app_tables.getTable(tableName);
                if (table) {
                    resolve(table);
                } else {
                    reject(new Error(`Table '${tableName}' not found`));
                }
                return;
            }

            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (TableUtils.isTableReady(tableName)) {
                    clearInterval(checkInterval);
                    const table = app_tables.getTable(tableName);
                    if (table) {
                        resolve(table);
                    } else {
                        reject(new Error(`Table '${tableName}' not found`));
                    }
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`Timeout waiting for table '${tableName}'`));
                }
            }, 100);
        });
    }
};

// Pre-configured patterns for common table operations
export const TablePatterns = {
    /**
     * User management patterns
     */
    users: {
        findByEmail: (email: string) => q().eq('email', email),
        findActive: () => q().eq('active', true),
        findByRole: (role: string) => q().eq('role', role),
        findRecent: (days: number = 7) => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            return q().gte('created_date', cutoff);
        }
    },

    /**
     * Content management patterns
     */
    content: {
        findPublished: () => q().eq('status', 'published'),
        findByAuthor: (authorId: string) => q().eq('author_id', authorId),
        findByCategory: (category: string) => q().eq('category', category),
        findRecent: (limit: number = 10) => q().orderBy('created_date', 'desc').limit(limit),
        searchByTitle: (title: string) => q().contains('title', title)
    },

    /**
     * E-commerce patterns
     */
    ecommerce: {
        findActiveProducts: () => q().eq('active', true).eq('in_stock', true),
        findByCategory: (category: string) => q().eq('category', category),
        findInPriceRange: (min: number, max: number) => q().gte('price', min).lte('price', max),
        findTopRated: (minRating: number = 4) => q().gte('rating', minRating).orderBy('rating', 'desc'),
        findOnSale: () => q().gt('discount_percent', 0)
    },

    /**
     * Analytics patterns
     */
    analytics: {
        findByDateRange: (startDate: Date, endDate: Date) =>
            q().gte('date', startDate).lte('date', endDate),
        findTopPerformers: (metric: string, limit: number = 10) =>
            q().orderBy(metric, 'desc').limit(limit),
        findByMetricThreshold: (metric: string, threshold: number) =>
            q().gte(metric, threshold)
    }
};

// Common validation rules
export const ValidationRules = {
    required: (value: any) => value !== undefined && value !== null && value !== '' ? null : 'This field is required',
    email: (value: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Please enter a valid email address';
    },
    minLength: (min: number) => (value: string) =>
        value && value.length >= min ? null : `Must be at least ${min} characters`,
    maxLength: (max: number) => (value: string) =>
        value && value.length <= max ? null : `Must be no more than ${max} characters`,
    numeric: (value: any) =>
        !isNaN(Number(value)) ? null : 'Must be a valid number',
    positive: (value: number) =>
        value > 0 ? null : 'Must be a positive number',
    url: (value: string) => {
        try {
            new URL(value);
            return null;
        } catch {
            return 'Please enter a valid URL';
        }
    },
    date: (value: any) => {
        const date = new Date(value);
        return !isNaN(date.getTime()) ? null : 'Please enter a valid date';
    },
    custom: (validator: (value: any) => boolean, message: string) =>
        (value: any) => validator(value) ? null : message
};

// Export version information
export const ANVIL_TABLES_VERSION = '1.0.0';

// Type aliases for convenience
export type TableRow<T = Record<string, any>> = DataRow & T;
export type TypedTable<T = Record<string, any>> = DataTable & {
    addRow(data?: Partial<T>): TableRow<T>;
    search(criteria?: SearchCriteria, options?: SearchOptions): Promise<SearchResult<TableRow<T>>>;
}; 