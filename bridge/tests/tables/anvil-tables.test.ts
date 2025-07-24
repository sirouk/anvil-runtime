/**
 * Anvil Tables Test Suite
 * 
 * Comprehensive tests for the anvil.tables system
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import {
    DataTable,
    DataRow,
    TableRegistry,
    AppTables,
    app_tables,
    Query,
    AnvilTablesError,
    type TableSchema,
    type SearchCriteria,
    type SearchOptions
} from '../../src/lib/tables/anvil-tables';

import {
    useTable,
    useRow,
    useQuery,
    useBatchOperations,
    useTableInfo,
    useAppTables,
    useTableForm
} from '../../src/lib/tables/use-anvil-tables';

// Mock server call manager
const mockServerCall = jest.fn();
jest.mock('../../src/lib/server/anvil-server-calls', () => ({
    getServerCallManager: () => ({
        call: mockServerCall
    })
}));

describe('DataRow Tests', () => {
    let schema: TableSchema;
    let table: DataTable;

    beforeEach(() => {
        schema = {
            name: 'users',
            columns: {
                id: { type: 'number', required: true, unique: true },
                name: { type: 'text', required: true },
                email: { type: 'text', required: true, unique: true },
                age: { type: 'number' },
                is_active: { type: 'bool' },
                created_date: { type: 'datetime' }
            },
            client: 'full',
            server: 'full'
        };

        table = new DataTable('users', schema);
        mockServerCall.mockClear();
    });

    describe('Basic Row Operations', () => {
        test('should create new row', () => {
            const row = table.addRow({ name: 'John Doe', email: 'john@test.com' });

            expect(row).toBeInstanceOf(DataRow);
            expect(row.isNew()).toBe(true);
            expect(row.isDirty()).toBe(true);
            expect(row.get('name')).toBe('John Doe');
            expect(row.get('email')).toBe('john@test.com');
        });

        test('should create row from existing data', () => {
            const existingData = {
                id: 1,
                name: 'Jane Doe',
                email: 'jane@test.com',
                age: 30,
                is_active: true
            };

            const row = new DataRow(table, existingData, false);

            expect(row.isNew()).toBe(false);
            expect(row.isDirty()).toBe(false);
            expect(row.get('id')).toBe(1);
            expect(row.get('name')).toBe('Jane Doe');
        });

        test('should track property changes', () => {
            const row = new DataRow(table, { id: 1, name: 'John', email: 'john@test.com' }, false);

            expect(row.isDirty()).toBe(false);

            row.set('name', 'John Smith');
            expect(row.isDirty()).toBe(true);
            expect(row.get('name')).toBe('John Smith');
        });

        test('should update multiple properties', () => {
            const row = new DataRow(table, { id: 1, name: 'John', email: 'john@test.com' }, false);

            row.update({
                name: 'John Smith',
                age: 25,
                is_active: true
            });

            expect(row.get('name')).toBe('John Smith');
            expect(row.get('age')).toBe(25);
            expect(row.get('is_active')).toBe(true);
            expect(row.isDirty()).toBe(true);
        });

        test('should revert changes', () => {
            const originalData = { id: 1, name: 'John', email: 'john@test.com' };
            const row = new DataRow(table, originalData, false);

            row.set('name', 'John Smith');
            expect(row.get('name')).toBe('John Smith');
            expect(row.isDirty()).toBe(true);

            row.revert();
            expect(row.get('name')).toBe('John');
            expect(row.isDirty()).toBe(false);
        });

        test('should convert to JSON', () => {
            const data = { id: 1, name: 'John', email: 'john@test.com' };
            const row = new DataRow(table, data, false);

            const json = row.toJSON();
            expect(json).toEqual(data);
        });

        test('should provide string representation', () => {
            const data = { id: 1, name: 'John' };
            const row = new DataRow(table, data, false);

            const str = row.toString();
            expect(str).toContain('DataRow(users');
            expect(str).toContain(JSON.stringify(data));
        });
    });

    describe('Row Persistence', () => {
        test('should save new row', async () => {
            const newRowData = { name: 'John Doe', email: 'john@test.com' };
            const savedRowData = { id: 1, ...newRowData };

            mockServerCall.mockResolvedValue(savedRowData);

            const row = table.addRow(newRowData);
            expect(row.isNew()).toBe(true);

            await row.save();

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.create_row',
                ['users', newRowData]
            );
            expect(row.isNew()).toBe(false);
            expect(row.isDirty()).toBe(false);
            expect(row.get('id')).toBe(1);
        });

        test('should update existing row', async () => {
            const originalData = { id: 1, name: 'John', email: 'john@test.com' };
            const updatedData = { id: 1, name: 'John Smith', email: 'john@test.com' };

            mockServerCall.mockResolvedValue(updatedData);

            const row = new DataRow(table, originalData, false);
            row.set('name', 'John Smith');

            await row.save();

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.update_row',
                ['users', 1, { name: 'John Smith' }]
            );
            expect(row.isDirty()).toBe(false);
            expect(row.get('name')).toBe('John Smith');
        });

        test('should not save if no changes', async () => {
            const data = { id: 1, name: 'John', email: 'john@test.com' };
            const row = new DataRow(table, data, false);

            await row.save();

            expect(mockServerCall).not.toHaveBeenCalled();
        });

        test('should delete row', async () => {
            const data = { id: 1, name: 'John', email: 'john@test.com' };
            mockServerCall.mockResolvedValue(undefined);

            const row = new DataRow(table, data, false);
            await row.delete();

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.delete_row',
                ['users', 1]
            );
            expect(row.isDeleted()).toBe(true);
        });

        test('should handle save errors', async () => {
            const error = new Error('Server error');
            mockServerCall.mockRejectedValue(error);

            const row = table.addRow({ name: 'John', email: 'john@test.com' });

            await expect(row.save()).rejects.toThrow(AnvilTablesError);
        });

        test('should handle delete errors', async () => {
            const error = new Error('Server error');
            mockServerCall.mockRejectedValue(error);

            const row = new DataRow(table, { id: 1, name: 'John' }, false);

            await expect(row.delete()).rejects.toThrow(AnvilTablesError);
        });
    });
});

describe('DataTable Tests', () => {
    let schema: TableSchema;
    let table: DataTable;

    beforeEach(() => {
        schema = {
            name: 'products',
            columns: {
                id: { type: 'number', required: true, unique: true },
                name: { type: 'text', required: true },
                price: { type: 'number', required: true },
                category: { type: 'text' },
                in_stock: { type: 'bool' }
            },
            client: 'full',
            server: 'full'
        };

        table = new DataTable('products', schema);
        mockServerCall.mockClear();
    });

    describe('Basic Table Operations', () => {
        test('should create table instance', () => {
            expect(table.getName()).toBe('products');
            expect(table.getSchema()).toEqual(schema);
        });

        test('should add new row', () => {
            const row = table.addRow({ name: 'Widget', price: 19.99 });

            expect(row).toBeInstanceOf(DataRow);
            expect(row.getTable()).toBe(table);
            expect(row.isNew()).toBe(true);
        });
    });

    describe('Data Retrieval', () => {
        test('should get row by ID', async () => {
            const rowData = { id: 1, name: 'Widget', price: 19.99 };
            mockServerCall.mockResolvedValue(rowData);

            const row = await table.getById(1);

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.get_by_id',
                ['products', 1]
            );
            expect(row).toBeInstanceOf(DataRow);
            expect(row?.get('id')).toBe(1);
            expect(row?.get('name')).toBe('Widget');
        });

        test('should return null for non-existent row', async () => {
            mockServerCall.mockResolvedValue(null);

            const row = await table.getById(999);

            expect(row).toBeNull();
        });

        test('should search with criteria', async () => {
            const searchResult = {
                rows: [
                    { id: 1, name: 'Widget A', price: 19.99, category: 'tools' },
                    { id: 2, name: 'Widget B', price: 29.99, category: 'tools' }
                ],
                has_more: false,
                total_count: 2
            };

            mockServerCall.mockResolvedValue(searchResult);

            const criteria = { category: 'tools' };
            const options = { max_results: 10 };
            const result = await table.search(criteria, options);

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.search',
                ['products', criteria, options]
            );
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0]).toBeInstanceOf(DataRow);
            expect(result.has_more).toBe(false);
            expect(result.total_count).toBe(2);
        });

        test('should get all rows', async () => {
            const searchResult = {
                rows: [{ id: 1, name: 'Widget', price: 19.99 }],
                has_more: false
            };

            mockServerCall.mockResolvedValue(searchResult);

            const rows = await table.getAll();

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.search',
                ['products', {}, {}]
            );
            expect(rows).toHaveLength(1);
        });

        test('should get first matching row', async () => {
            const searchResult = {
                rows: [{ id: 1, name: 'Widget', price: 19.99 }],
                has_more: false
            };

            mockServerCall.mockResolvedValue(searchResult);

            const row = await table.getFirst({ category: 'tools' });

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.search',
                ['products', { category: 'tools' }, { max_results: 1 }]
            );
            expect(row).toBeInstanceOf(DataRow);
        });

        test('should return null when no matches found', async () => {
            const searchResult = { rows: [], has_more: false };
            mockServerCall.mockResolvedValue(searchResult);

            const row = await table.getFirst({ category: 'nonexistent' });

            expect(row).toBeNull();
        });
    });

    describe('Aggregate Operations', () => {
        test('should count rows', async () => {
            mockServerCall.mockResolvedValue(42);

            const count = await table.count({ category: 'tools' });

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.count',
                ['products', { category: 'tools' }]
            );
            expect(count).toBe(42);
        });

        test('should check if rows exist', async () => {
            mockServerCall.mockResolvedValue(5);

            const exists = await table.exists({ category: 'tools' });

            expect(exists).toBe(true);
        });

        test('should return false when no rows exist', async () => {
            mockServerCall.mockResolvedValue(0);

            const exists = await table.exists({ category: 'nonexistent' });

            expect(exists).toBe(false);
        });
    });

    describe('Batch Operations', () => {
        test('should delete all matching rows', async () => {
            mockServerCall.mockResolvedValue(3);

            const deletedCount = await table.deleteAll({ category: 'discontinued' });

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.delete_all',
                ['products', { category: 'discontinued' }]
            );
            expect(deletedCount).toBe(3);
        });

        test('should create multiple rows', async () => {
            const newRows = [
                { name: 'Widget A', price: 19.99 },
                { name: 'Widget B', price: 29.99 }
            ];

            const createdRows = [
                { id: 1, name: 'Widget A', price: 19.99 },
                { id: 2, name: 'Widget B', price: 29.99 }
            ];

            mockServerCall.mockResolvedValue(createdRows);

            const rows = await table.createBatch(newRows);

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.create_batch',
                ['products', newRows]
            );
            expect(rows).toHaveLength(2);
            expect(rows[0]).toBeInstanceOf(DataRow);
        });

        test('should update multiple rows', async () => {
            const updates = [
                { id: 1, data: { price: 24.99 } },
                { id: 2, data: { price: 34.99 } }
            ];

            const updatedRows = [
                { id: 1, name: 'Widget A', price: 24.99 },
                { id: 2, name: 'Widget B', price: 34.99 }
            ];

            mockServerCall.mockResolvedValue(updatedRows);

            const rows = await table.updateBatch(updates);

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.tables.update_batch',
                ['products', updates]
            );
            expect(rows).toHaveLength(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle search errors', async () => {
            const error = new Error('Database error');
            mockServerCall.mockRejectedValue(error);

            await expect(table.search({ category: 'tools' }))
                .rejects.toThrow(AnvilTablesError);
        });

        test('should handle count errors', async () => {
            const error = new Error('Database error');
            mockServerCall.mockRejectedValue(error);

            await expect(table.count())
                .rejects.toThrow(AnvilTablesError);
        });
    });
});

describe('TableRegistry Tests', () => {
    beforeEach(() => {
        TableRegistry.clear();
        mockServerCall.mockClear();
    });

    test('should register table', () => {
        const schema: TableSchema = {
            name: 'test_table',
            columns: { id: { type: 'number' }, name: { type: 'text' } },
            client: 'full',
            server: 'full'
        };

        const table = TableRegistry.registerTable('test_table', schema);

        expect(table).toBeInstanceOf(DataTable);
        expect(TableRegistry.hasTable('test_table')).toBe(true);
        expect(TableRegistry.getTable('test_table')).toBe(table);
    });

    test('should get all tables', () => {
        const schema1: TableSchema = {
            name: 'table1',
            columns: { id: { type: 'number' } },
            client: 'full',
            server: 'full'
        };

        const schema2: TableSchema = {
            name: 'table2',
            columns: { id: { type: 'number' } },
            client: 'full',
            server: 'full'
        };

        TableRegistry.registerTable('table1', schema1);
        TableRegistry.registerTable('table2', schema2);

        const allTables = TableRegistry.getAllTables();
        expect(allTables).toHaveLength(2);
    });

    test('should load schemas from server', async () => {
        const schemas = [
            {
                name: 'users',
                columns: { id: { type: 'number' }, name: { type: 'text' } },
                client: 'full',
                server: 'full'
            },
            {
                name: 'products',
                columns: { id: { type: 'number' }, name: { type: 'text' } },
                client: 'full',
                server: 'full'
            }
        ];

        mockServerCall.mockResolvedValue(schemas);

        await TableRegistry.loadSchemasFromServer();

        expect(mockServerCall).toHaveBeenCalledWith('anvil.tables.list_tables');
        expect(TableRegistry.hasTable('users')).toBe(true);
        expect(TableRegistry.hasTable('products')).toBe(true);
    });

    test('should clear all tables', () => {
        const schema: TableSchema = {
            name: 'test_table',
            columns: { id: { type: 'number' } },
            client: 'full',
            server: 'full'
        };

        TableRegistry.registerTable('test_table', schema);
        expect(TableRegistry.hasTable('test_table')).toBe(true);

        TableRegistry.clear();
        expect(TableRegistry.hasTable('test_table')).toBe(false);
        expect(TableRegistry.getAllTables()).toHaveLength(0);
    });
});

describe('AppTables Tests', () => {
    beforeEach(() => {
        TableRegistry.clear();
        mockServerCall.mockClear();
    });

    test('should be singleton', () => {
        const instance1 = AppTables.getInstance();
        const instance2 = AppTables.getInstance();

        expect(instance1).toBe(instance2);
        expect(instance1).toBe(app_tables);
    });

    test('should initialize and create table properties', async () => {
        const schemas = [
            {
                name: 'users',
                columns: { id: { type: 'number' }, name: { type: 'text' } },
                client: 'full',
                server: 'full'
            }
        ];

        mockServerCall.mockResolvedValue(schemas);

        await app_tables.initialize();

        expect(app_tables.getTable('users')).toBeInstanceOf(DataTable);
        expect((app_tables as any).users).toBeInstanceOf(DataTable);
    });

    test('should list all table names', async () => {
        const schemas = [
            {
                name: 'users',
                columns: { id: { type: 'number' } },
                client: 'full',
                server: 'full'
            },
            {
                name: 'products',
                columns: { id: { type: 'number' } },
                client: 'full',
                server: 'full'
            }
        ];

        mockServerCall.mockResolvedValue(schemas);
        await app_tables.initialize();

        const tableNames = app_tables.listTables();
        expect(tableNames).toEqual(['users', 'products']);
    });
});

describe('Query Builder Tests', () => {
    test('should build equality query', () => {
        const query = new Query()
            .eq('status', 'active')
            .eq('category', 'electronics');

        const criteria = (query as any).criteria;
        expect(criteria).toEqual({
            status: 'active',
            category: 'electronics'
        });
    });

    test('should build not equal query', () => {
        const query = new Query().ne('status', 'deleted');

        const criteria = (query as any).criteria;
        expect(criteria).toEqual({
            'status__ne': 'deleted'
        });
    });

    test('should build greater than query', () => {
        const query = new Query().gt('price', 100);

        const criteria = (query as any).criteria;
        expect(criteria).toEqual({
            'price__gt': 100
        });
    });

    test('should chain multiple conditions', () => {
        const query = new Query()
            .eq('category', 'electronics')
            .gt('price', 50)
            .ne('status', 'deleted');

        const criteria = (query as any).criteria;
        expect(criteria).toEqual({
            category: 'electronics',
            'price__gt': 50,
            'status__ne': 'deleted'
        });
    });
});

describe('React Hooks Integration', () => {
    beforeEach(() => {
        mockServerCall.mockClear();
    });

    describe('useTable Hook', () => {
        test('should provide table instance', () => {
            const schema: TableSchema = {
                name: 'test_table',
                columns: { id: { type: 'number' } },
                client: 'full',
                server: 'full'
            };

            TableRegistry.registerTable('test_table', schema);

            const { result } = renderHook(() => useTable('test_table'));

            expect(result.current).toBeInstanceOf(DataTable);
            expect(result.current.getName()).toBe('test_table');
        });

        test('should return null for non-existent table', () => {
            const { result } = renderHook(() => useTable('nonexistent'));

            expect(result.current).toBeNull();
        });
    });

    describe('useAppTables Hook', () => {
        test('should provide app tables instance', () => {
            const { result } = renderHook(() => useAppTables());

            expect(result.current).toBe(app_tables);
        });
    });

    describe('useTableInfo Hook', () => {
        test('should provide table metadata', () => {
            const schema: TableSchema = {
                name: 'test_table',
                columns: {
                    id: { type: 'number', required: true },
                    name: { type: 'text', required: true }
                },
                client: 'full',
                server: 'full'
            };

            TableRegistry.registerTable('test_table', schema);

            const { result } = renderHook(() => useTableInfo('test_table'));

            expect(result.current?.schema).toEqual(schema);
            expect(result.current?.columnNames).toEqual(['id', 'name']);
            expect(result.current?.requiredColumns).toEqual(['id', 'name']);
        });
    });
});

describe('Error Handling', () => {
    test('should create proper error instances', () => {
        const error = new AnvilTablesError('Test error');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('AnvilTablesError');
        expect(error.message).toBe('Test error');
    });

    test('should preserve original error', () => {
        const originalError = { type: 'ServerError', message: 'Server failed' };
        const error = new AnvilTablesError('Wrapped error', originalError as any);

        expect(error.originalError).toBe(originalError);
    });
});

describe('Type Safety', () => {
    test('should provide proper TypeScript types', () => {
        const schema: TableSchema = {
            name: 'typed_table',
            columns: {
                id: { type: 'number', required: true, unique: true },
                name: { type: 'text', required: true },
                optional_field: { type: 'text' }
            },
            client: 'full',
            server: 'full'
        };

        const criteria: SearchCriteria = {
            name: 'test',
            id: 1
        };

        const options: SearchOptions = {
            max_results: 10,
            order_by: ['name', '-id'],
            columns_by_name: ['id', 'name']
        };

        expect(schema.name).toBe('typed_table');
        expect(criteria.name).toBe('test');
        expect(options.max_results).toBe(10);
    });
}); 