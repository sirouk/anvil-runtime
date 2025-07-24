/**
 * React Hooks for Anvil Tables
 * 
 * Provides easy-to-use React hooks for working with Anvil data tables
 * with automatic loading states, error handling, and re-rendering
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    DataTable,
    DataRow,
    Query,
    app_tables,
    type SearchCriteria,
    type SearchOptions,
    type SearchResult,
    type AnvilTablesError
} from './anvil-tables';

export interface UseTableState<T = DataRow> {
    data: T[];
    loading: boolean;
    error: AnvilTablesError | null;
    total: number;
    hasMore: boolean;
    nextPageToken?: string;
}

export interface UseTableOptions extends SearchOptions {
    skip?: boolean;
    pollInterval?: number;
    onCompleted?: (data: DataRow[]) => void;
    onError?: (error: AnvilTablesError) => void;
    refetchOnMount?: boolean;
}

export interface UseTableResult<T = DataRow> extends UseTableState<T> {
    refetch: () => Promise<void>;
    fetchMore: () => Promise<void>;
    reset: () => void;
    search: (criteria: SearchCriteria, options?: SearchOptions) => Promise<void>;
}

export interface UseRowState<T = DataRow> {
    data: T | null;
    loading: boolean;
    error: AnvilTablesError | null;
    saving: boolean;
    deleting: boolean;
}

export interface UseRowResult<T = DataRow> extends UseRowState<T> {
    save: () => Promise<void>;
    delete: () => Promise<void>;
    revert: () => void;
    refetch: () => Promise<void>;
    update: (data: Record<string, any>) => void;
    isDirty: boolean;
    isNew: boolean;
}

/**
 * Hook for querying table data with automatic loading states
 */
export function useTable(
    tableName: string,
    criteria: SearchCriteria = {},
    options: UseTableOptions = {}
): UseTableResult {
    const [state, setState] = useState<UseTableState>({
        data: [],
        loading: false,
        error: null,
        total: 0,
        hasMore: false
    });

    const optionsRef = useRef(options);
    const criteriaRef = useRef(criteria);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    optionsRef.current = options;
    criteriaRef.current = criteria;

    const table = app_tables.getTable(tableName);

    const executeQuery = useCallback(async (searchCriteria?: SearchCriteria, searchOptions?: SearchOptions) => {
        if (!table) {
            setState(prev => ({
                ...prev,
                error: new Error(`Table '${tableName}' not found`) as AnvilTablesError,
                loading: false
            }));
            return;
        }

        const finalCriteria = searchCriteria || criteriaRef.current;
        const finalOptions = { ...optionsRef.current, ...searchOptions };

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const result = await table.search(finalCriteria, finalOptions);

            setState({
                data: result.rows,
                loading: false,
                error: null,
                total: result.total_count || result.rows.length,
                hasMore: result.has_more,
                nextPageToken: result.next_page_token
            });

            if (optionsRef.current.onCompleted) {
                optionsRef.current.onCompleted(result.rows);
            }

        } catch (error) {
            const tableError = error as AnvilTablesError;
            setState(prev => ({
                ...prev,
                loading: false,
                error: tableError
            }));

            if (optionsRef.current.onError) {
                optionsRef.current.onError(tableError);
            }
        }
    }, [table, tableName]);

    const refetch = useCallback(async () => {
        await executeQuery();
    }, [executeQuery]);

    const fetchMore = useCallback(async () => {
        if (!state.hasMore || !state.nextPageToken) return;

        await executeQuery(criteriaRef.current, {
            ...optionsRef.current,
            page_token: state.nextPageToken
        });
    }, [executeQuery, state.hasMore, state.nextPageToken]);

    const search = useCallback(async (newCriteria: SearchCriteria, newOptions?: SearchOptions) => {
        await executeQuery(newCriteria, newOptions);
    }, [executeQuery]);

    const reset = useCallback(() => {
        setState({
            data: [],
            loading: false,
            error: null,
            total: 0,
            hasMore: false
        });
    }, []);

    // Initial load
    useEffect(() => {
        if (!options.skip && (options.refetchOnMount !== false)) {
            executeQuery();
        }
    }, [executeQuery, options.skip, options.refetchOnMount]);

    // Set up polling if specified
    useEffect(() => {
        if (options.pollInterval && options.pollInterval > 0 && !options.skip) {
            pollIntervalRef.current = setInterval(() => {
                executeQuery();
            }, options.pollInterval);

            return () => {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                }
            };
        }
    }, [executeQuery, options.pollInterval, options.skip]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    return {
        ...state,
        refetch,
        fetchMore,
        reset,
        search
    };
}

/**
 * Hook for working with a single data row
 */
export function useRow(
    tableName: string,
    rowId?: string | number,
    initialData?: Record<string, any>
): UseRowResult {
    const [state, setState] = useState<UseRowState>({
        data: null,
        loading: false,
        error: null,
        saving: false,
        deleting: false
    });

    const table = app_tables.getTable(tableName);
    const rowRef = useRef<DataRow | null>(null);

    const fetchRow = useCallback(async () => {
        if (!table || !rowId) return;

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const row = await table.getById(rowId);
            rowRef.current = row;
            setState(prev => ({
                ...prev,
                data: row,
                loading: false
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: error as AnvilTablesError
            }));
        }
    }, [table, rowId]);

    const createRow = useCallback(() => {
        if (!table) return;

        const row = table.addRow(initialData || {});
        rowRef.current = row;
        setState(prev => ({
            ...prev,
            data: row,
            loading: false
        }));
    }, [table, initialData]);

    const save = useCallback(async () => {
        if (!rowRef.current) return;

        setState(prev => ({ ...prev, saving: true, error: null }));

        try {
            await rowRef.current.save();
            setState(prev => ({ ...prev, saving: false }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                saving: false,
                error: error as AnvilTablesError
            }));
        }
    }, []);

    const deleteRow = useCallback(async () => {
        if (!rowRef.current) return;

        setState(prev => ({ ...prev, deleting: true, error: null }));

        try {
            await rowRef.current.delete();
            setState(prev => ({
                ...prev,
                deleting: false,
                data: null
            }));
            rowRef.current = null;
        } catch (error) {
            setState(prev => ({
                ...prev,
                deleting: false,
                error: error as AnvilTablesError
            }));
        }
    }, []);

    const revert = useCallback(() => {
        if (rowRef.current) {
            rowRef.current.revert();
            // Force re-render by creating new state
            setState(prev => ({ ...prev }));
        }
    }, []);

    const update = useCallback((data: Record<string, any>) => {
        if (rowRef.current) {
            rowRef.current.update(data);
            // Force re-render
            setState(prev => ({ ...prev }));
        }
    }, []);

    const refetch = useCallback(async () => {
        await fetchRow();
    }, [fetchRow]);

    // Initialize row
    useEffect(() => {
        if (rowId) {
            fetchRow();
        } else {
            createRow();
        }
    }, [rowId, fetchRow, createRow]);

    return {
        ...state,
        save,
        delete: deleteRow,
        revert,
        refetch,
        update,
        isDirty: rowRef.current?.isDirty() || false,
        isNew: rowRef.current?.isNew() || false
    };
}

/**
 * Hook for performing queries with a query builder
 */
export function useQuery(
    tableName: string,
    queryBuilder?: Query,
    options: UseTableOptions = {}
): UseTableResult & {
    executeQuery: (query: Query) => Promise<void>;
} {
    const [query, setQuery] = useState<Query | null>(queryBuilder || null);

    const table = app_tables.getTable(tableName);

    // Convert query to criteria and options
    const criteria = query?.getCriteria() || {};
    const queryOptions = query?.getOptions() || {};

    const tableResult = useTable(tableName, criteria, { ...options, ...queryOptions });

    const executeQuery = useCallback(async (newQuery: Query) => {
        setQuery(newQuery);
        const newCriteria = newQuery.getCriteria();
        const newOptions = newQuery.getOptions();
        await tableResult.search(newCriteria, newOptions);
    }, [tableResult]);

    return {
        ...tableResult,
        executeQuery
    };
}

/**
 * Hook for batch operations
 */
export function useBatchOperations(tableName: string) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<AnvilTablesError | null>(null);

    const table = app_tables.getTable(tableName);

    const createBatch = useCallback(async (rows: Record<string, any>[]) => {
        if (!table) throw new Error(`Table '${tableName}' not found`);

        setLoading(true);
        setError(null);

        try {
            const result = await table.createBatch(rows);
            setLoading(false);
            return result;
        } catch (err) {
            const tableError = err as AnvilTablesError;
            setError(tableError);
            setLoading(false);
            throw tableError;
        }
    }, [table, tableName]);

    const updateBatch = useCallback(async (updates: Array<{ id: string | number; data: Record<string, any> }>) => {
        if (!table) throw new Error(`Table '${tableName}' not found`);

        setLoading(true);
        setError(null);

        try {
            const result = await table.updateBatch(updates);
            setLoading(false);
            return result;
        } catch (err) {
            const tableError = err as AnvilTablesError;
            setError(tableError);
            setLoading(false);
            throw tableError;
        }
    }, [table, tableName]);

    const deleteAll = useCallback(async (criteria: SearchCriteria) => {
        if (!table) throw new Error(`Table '${tableName}' not found`);

        setLoading(true);
        setError(null);

        try {
            const result = await table.deleteAll(criteria);
            setLoading(false);
            return result;
        } catch (err) {
            const tableError = err as AnvilTablesError;
            setError(tableError);
            setLoading(false);
            throw tableError;
        }
    }, [table, tableName]);

    return {
        createBatch,
        updateBatch,
        deleteAll,
        loading,
        error
    };
}

/**
 * Hook for table statistics and metadata
 */
export function useTableInfo(tableName: string) {
    const [loading, setLoading] = useState(false);
    const [count, setCount] = useState<number | null>(null);
    const [error, setError] = useState<AnvilTablesError | null>(null);

    const table = app_tables.getTable(tableName);

    const getCount = useCallback(async (criteria: SearchCriteria = {}) => {
        if (!table) throw new Error(`Table '${tableName}' not found`);

        setLoading(true);
        setError(null);

        try {
            const result = await table.count(criteria);
            setCount(result);
            setLoading(false);
            return result;
        } catch (err) {
            const tableError = err as AnvilTablesError;
            setError(tableError);
            setLoading(false);
            throw tableError;
        }
    }, [table, tableName]);

    const exists = useCallback(async (criteria: SearchCriteria) => {
        if (!table) throw new Error(`Table '${tableName}' not found`);

        try {
            return await table.exists(criteria);
        } catch (err) {
            throw err as AnvilTablesError;
        }
    }, [table, tableName]);

    return {
        count,
        loading,
        error,
        getCount,
        exists,
        schema: table?.getSchema() || null,
        tableName
    };
}

/**
 * Hook for managing app tables initialization
 */
export function useAppTables() {
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState<AnvilTablesError | null>(null);
    const [tables, setTables] = useState<string[]>([]);

    const initialize = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            await app_tables.initialize();
            setTables(app_tables.listTables());
            setInitialized(true);
            setLoading(false);
        } catch (err) {
            const tableError = err as AnvilTablesError;
            setError(tableError);
            setLoading(false);
        }
    }, []);

    const getTable = useCallback((tableName: string) => {
        return app_tables.getTable(tableName);
    }, []);

    // Auto-initialize on mount
    useEffect(() => {
        if (!initialized) {
            initialize();
        }
    }, [initialized, initialize]);

    return {
        loading,
        initialized,
        error,
        tables,
        initialize,
        getTable
    };
}

/**
 * Higher-order hook for automatic form data binding
 */
export function useTableForm<T = Record<string, any>>(
    tableName: string,
    rowId?: string | number,
    validationRules?: Record<string, (value: any) => string | null>
) {
    const rowResult = useRow(tableName, rowId);
    const [formData, setFormData] = useState<T>({} as T);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Sync form data with row data
    useEffect(() => {
        if (rowResult.data) {
            setFormData(rowResult.data.getData() as T);
        }
    }, [rowResult.data]);

    const updateField = useCallback((fieldName: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));

        // Update row data
        if (rowResult.data) {
            rowResult.data.set(fieldName, value);
        }

        // Clear validation error for this field
        if (validationErrors[fieldName]) {
            setValidationErrors(prev => {
                const { [fieldName]: removed, ...rest } = prev;
                return rest;
            });
        }
    }, [rowResult.data, validationErrors]);

    const validate = useCallback((): boolean => {
        if (!validationRules) return true;

        const errors: Record<string, string> = {};

        Object.entries(validationRules).forEach(([field, validator]) => {
            const value = (formData as any)[field];
            const error = validator(value);
            if (error) {
                errors[field] = error;
            }
        });

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData, validationRules]);

    const saveWithValidation = useCallback(async () => {
        if (validate()) {
            await rowResult.save();
        }
    }, [validate, rowResult]);

    return {
        ...rowResult,
        formData,
        updateField,
        validate,
        validationErrors,
        saveWithValidation,
        isValid: Object.keys(validationErrors).length === 0
    };
} 