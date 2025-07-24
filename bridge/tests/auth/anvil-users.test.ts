/**
 * Anvil Users Test Suite
 * 
 * Tests for the anvil.users authentication system
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import {
    User,
    AuthenticationManager,
    type UserData,
    type LoginOptions,
    type SignupData
} from '../../src/lib/auth/anvil-users';

// Mock server call manager
const mockServerCall = jest.fn();
jest.mock('../../src/lib/server/anvil-server-calls', () => ({
    getServerCallManager: () => ({
        call: mockServerCall
    })
}));

describe('User Class Tests', () => {
    let userData: UserData;

    beforeEach(() => {
        userData = {
            id: 'user123',
            email: 'test@example.com',
            confirmed_email: true,
            enabled: true,
            last_login: new Date('2023-01-01'),
            password_hash: 'hashed_password',
            n_password_failures: 0,
            remember_me: false,
            mfa_method: null,
            signed_up: new Date('2022-01-01')
        };
        mockServerCall.mockClear();
    });

    describe('Basic User Operations', () => {
        test('should create user instance', () => {
            const user = new User(userData);

            expect(user.getId()).toBe('user123');
            expect(user.getEmail()).toBe('test@example.com');
            expect(user.isEnabled()).toBe(true);
            expect(user.isEmailConfirmed()).toBe(true);
        });

        test('should get user properties', () => {
            const user = new User(userData);

            expect(user.get('email')).toBe('test@example.com');
            expect(user.get('enabled')).toBe(true);
            expect(user.get('confirmed_email')).toBe(true);
        });

        test('should update user properties', () => {
            const user = new User(userData);

            user.update({ email: 'newemail@example.com' });
            expect(user.getEmail()).toBe('newemail@example.com');
        });

        test('should track if user data is modified', () => {
            const user = new User(userData);

            expect(user.isDirty()).toBe(false);

            user.update({ email: 'modified@example.com' });
            expect(user.isDirty()).toBe(true);
        });

        test('should convert to JSON', () => {
            const user = new User(userData);
            const json = user.toJSON();

            expect(json).toEqual(userData);
        });
    });

    describe('User Persistence', () => {
        test('should save user changes', async () => {
            mockServerCall.mockResolvedValue({
                ...userData,
                email: 'updated@example.com'
            });

            const user = new User(userData);
            user.update({ email: 'updated@example.com' });

            await user.save();

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.update_user',
                ['user123', { email: 'updated@example.com' }]
            );
            expect(user.isDirty()).toBe(false);
        });

        test('should not save if no changes', async () => {
            const user = new User(userData);

            await user.save();

            expect(mockServerCall).not.toHaveBeenCalled();
        });

        test('should delete user', async () => {
            mockServerCall.mockResolvedValue(undefined);

            const user = new User(userData);
            await user.delete();

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.delete_user',
                ['user123']
            );
        });

        test('should handle save errors', async () => {
            mockServerCall.mockRejectedValue(new Error('Server error'));

            const user = new User(userData);
            user.update({ email: 'new@example.com' });

            await expect(user.save()).rejects.toThrow('Failed to save user');
        });
    });

    describe('User Authentication Methods', () => {
        test('should change password', async () => {
            mockServerCall.mockResolvedValue({ success: true });

            const user = new User(userData);
            await user.changePassword('oldPassword', 'newPassword');

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.change_password',
                ['user123', 'oldPassword', 'newPassword']
            );
        });

        test('should request password reset', async () => {
            mockServerCall.mockResolvedValue({ success: true });

            const user = new User(userData);
            await user.requestPasswordReset();

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.request_password_reset',
                ['test@example.com']
            );
        });

        test('should confirm email', async () => {
            mockServerCall.mockResolvedValue({ success: true });

            const user = new User({ ...userData, confirmed_email: false });
            await user.confirmEmail('confirmation_token');

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.confirm_email',
                ['confirmation_token']
            );
        });

        test('should enable/disable MFA', async () => {
            mockServerCall.mockResolvedValue({ success: true });

            const user = new User(userData);
            await user.enableMFA('totp');

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.enable_mfa',
                ['user123', 'totp']
            );
        });
    });
});

describe('AuthenticationManager Tests', () => {
    let authManager: AuthenticationManager;

    beforeEach(() => {
        authManager = AuthenticationManager.getInstance();
        mockServerCall.mockClear();
        // Clear any existing user state
        (authManager as any)._currentUser = null;
    });

    describe('Singleton Pattern', () => {
        test('should be singleton', () => {
            const instance1 = AuthenticationManager.getInstance();
            const instance2 = AuthenticationManager.getInstance();

            expect(instance1).toBe(instance2);
        });
    });

    describe('Login Operations', () => {
        test('should login with email and password', async () => {
            const userData = {
                id: 'user123',
                email: 'test@example.com',
                confirmed_email: true,
                enabled: true
            };

            mockServerCall.mockResolvedValue({
                success: true,
                user: userData
            });

            const user = await authManager.login('test@example.com', 'password');

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.login',
                ['test@example.com', 'password', {}]
            );
            expect(user).toBeInstanceOf(User);
            expect(user.getEmail()).toBe('test@example.com');
            expect(authManager.getCurrentUser()).toBe(user);
        });

        test('should login with remember me option', async () => {
            const userData = { id: 'user123', email: 'test@example.com' };
            mockServerCall.mockResolvedValue({ success: true, user: userData });

            await authManager.login('test@example.com', 'password', {
                rememberMe: true
            });

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.login',
                ['test@example.com', 'password', { rememberMe: true }]
            );
        });

        test('should handle login failure', async () => {
            mockServerCall.mockResolvedValue({
                success: false,
                error: 'Invalid credentials'
            });

            await expect(
                authManager.login('test@example.com', 'wrongpassword')
            ).rejects.toThrow('Invalid credentials');
        });

        test('should handle MFA login', async () => {
            const userData = { id: 'user123', email: 'test@example.com' };
            mockServerCall.mockResolvedValue({
                success: true,
                user: userData,
                mfa_required: true
            });

            const result = await authManager.login('test@example.com', 'password');

            expect(result).toHaveProperty('mfa_required', true);
        });
    });

    describe('Logout Operations', () => {
        test('should logout current user', async () => {
            const userData = { id: 'user123', email: 'test@example.com' };
            const user = new User(userData);
            (authManager as any)._currentUser = user;

            mockServerCall.mockResolvedValue({ success: true });

            await authManager.logout();

            expect(mockServerCall).toHaveBeenCalledWith('anvil.users.logout');
            expect(authManager.getCurrentUser()).toBeNull();
        });
    });

    describe('User Registration', () => {
        test('should signup new user', async () => {
            const signupData: SignupData = {
                email: 'newuser@example.com',
                password: 'password123'
            };

            const userData = {
                id: 'newuser123',
                email: 'newuser@example.com',
                confirmed_email: false
            };

            mockServerCall.mockResolvedValue({
                success: true,
                user: userData
            });

            const user = await authManager.signup(signupData);

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.signup',
                [signupData]
            );
            expect(user).toBeInstanceOf(User);
            expect(user.getEmail()).toBe('newuser@example.com');
        });

        test('should handle signup failure', async () => {
            const signupData: SignupData = {
                email: 'existing@example.com',
                password: 'password123'
            };

            mockServerCall.mockResolvedValue({
                success: false,
                error: 'Email already exists'
            });

            await expect(
                authManager.signup(signupData)
            ).rejects.toThrow('Email already exists');
        });
    });

    describe('Password Reset', () => {
        test('should request password reset', async () => {
            mockServerCall.mockResolvedValue({ success: true });

            await authManager.requestPasswordReset('user@example.com');

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.request_password_reset',
                ['user@example.com']
            );
        });

        test('should reset password with token', async () => {
            mockServerCall.mockResolvedValue({ success: true });

            await authManager.resetPassword('reset_token', 'newpassword');

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.reset_password',
                ['reset_token', 'newpassword']
            );
        });
    });

    describe('Session Management', () => {
        test('should check if user is logged in', () => {
            expect(authManager.isLoggedIn()).toBe(false);

            const userData = { id: 'user123', email: 'test@example.com' };
            const user = new User(userData);
            (authManager as any)._currentUser = user;

            expect(authManager.isLoggedIn()).toBe(true);
        });

        test('should get current user', () => {
            expect(authManager.getCurrentUser()).toBeNull();

            const userData = { id: 'user123', email: 'test@example.com' };
            const user = new User(userData);
            (authManager as any)._currentUser = user;

            expect(authManager.getCurrentUser()).toBe(user);
        });

        test('should refresh current user session', async () => {
            const userData = {
                id: 'user123',
                email: 'test@example.com',
                enabled: true
            };

            const user = new User(userData);
            (authManager as any)._currentUser = user;

            const updatedUserData = {
                ...userData,
                last_login: new Date()
            };

            mockServerCall.mockResolvedValue({
                success: true,
                user: updatedUserData
            });

            const refreshedUser = await authManager.refreshCurrentUser();

            expect(mockServerCall).toHaveBeenCalledWith(
                'anvil.users.get_current_user'
            );
            expect(refreshedUser).toBeInstanceOf(User);
        });

        test('should handle session expiry', async () => {
            const userData = { id: 'user123', email: 'test@example.com' };
            const user = new User(userData);
            (authManager as any)._currentUser = user;

            mockServerCall.mockResolvedValue({
                success: false,
                error: 'Session expired'
            });

            await expect(
                authManager.refreshCurrentUser()
            ).rejects.toThrow('Session expired');

            // Should clear current user on session expiry
            expect(authManager.getCurrentUser()).toBeNull();
        });
    });

    describe('Event Callbacks', () => {
        test('should trigger login callbacks', async () => {
            const onLogin = jest.fn();
            authManager.onLogin(onLogin);

            const userData = { id: 'user123', email: 'test@example.com' };
            mockServerCall.mockResolvedValue({ success: true, user: userData });

            const user = await authManager.login('test@example.com', 'password');

            expect(onLogin).toHaveBeenCalledWith(user);
        });

        test('should trigger logout callbacks', async () => {
            const onLogout = jest.fn();
            authManager.onLogout(onLogout);

            const userData = { id: 'user123', email: 'test@example.com' };
            const user = new User(userData);
            (authManager as any)._currentUser = user;

            mockServerCall.mockResolvedValue({ success: true });

            await authManager.logout();

            expect(onLogout).toHaveBeenCalledWith(user);
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors', async () => {
            mockServerCall.mockRejectedValue(new Error('Network error'));

            await expect(
                authManager.login('test@example.com', 'password')
            ).rejects.toThrow('Network error');
        });

        test('should handle server errors', async () => {
            mockServerCall.mockResolvedValue({
                success: false,
                error: 'Server maintenance'
            });

            await expect(
                authManager.login('test@example.com', 'password')
            ).rejects.toThrow('Server maintenance');
        });
    });
});

describe('Authentication State Management', () => {
    test('should handle authentication state changes', () => {
        const authManager = AuthenticationManager.getInstance();

        // Initially not logged in
        expect(authManager.isLoggedIn()).toBe(false);
        expect(authManager.getCurrentUser()).toBeNull();

        // Simulate login
        const userData = { id: 'user123', email: 'test@example.com' };
        const user = new User(userData);
        (authManager as any)._currentUser = user;

        expect(authManager.isLoggedIn()).toBe(true);
        expect(authManager.getCurrentUser()).toBe(user);

        // Simulate logout
        (authManager as any)._currentUser = null;

        expect(authManager.isLoggedIn()).toBe(false);
        expect(authManager.getCurrentUser()).toBeNull();
    });
});

describe('Type Safety', () => {
    test('should provide proper TypeScript types', () => {
        const userData: UserData = {
            id: 'user123',
            email: 'test@example.com',
            confirmed_email: true,
            enabled: true,
            last_login: new Date(),
            password_hash: 'hash',
            n_password_failures: 0,
            remember_me: false,
            mfa_method: null,
            signed_up: new Date()
        };

        const loginOptions: LoginOptions = {
            rememberMe: true,
            mfaCode: '123456'
        };

        const signupData: SignupData = {
            email: 'new@example.com',
            password: 'password123'
        };

        expect(userData.id).toBe('user123');
        expect(loginOptions.rememberMe).toBe(true);
        expect(signupData.email).toBe('new@example.com');
    });
}); 