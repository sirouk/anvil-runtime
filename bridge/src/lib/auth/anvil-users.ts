/**
 * Anvil Users API Implementation
 * 
 * JavaScript/TypeScript equivalent of Python's anvil.users module
 * Provides User class and authentication functions
 */

import { getServerCallManager, type ServerCallError } from '../server/anvil-server-calls';

export interface UserData {
    id?: string | number;
    email: string;
    enabled?: boolean;
    signed_up?: Date;
    confirmed_email?: boolean;
    password_hash?: string;
    n_password_failures?: number;
    last_login?: Date;
    remembered_logins?: any[];
    mfa?: any[];
    mfa_method?: string | null;
    remember_me?: boolean;
    groups?: string[];
    [key: string]: any; // Allow custom user data
}

export interface LoginOptions {
    rememberMe?: boolean;
    mfaCode?: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
    remember?: boolean;
    mfa_token?: string;
}

export interface SignupData extends Omit<UserData, 'id' | 'signed_up' | 'password_hash'> {
    password: string;
    confirm_password?: string;
}

export interface AuthenticationResult {
    success: boolean;
    user?: User | null;
    error?: string;
    requires_mfa?: boolean;
    mfa_required?: boolean;
    mfa_methods?: string[];
}

export interface PasswordResetResult {
    success: boolean;
    message: string;
}

export interface UserPermissions {
    can_read?: boolean;
    can_write?: boolean;
    can_delete?: boolean;
    custom_permissions?: Record<string, boolean>;
}

/**
 * User class representing an Anvil user
 * Matches the Python anvil.users.User API
 */
export class User {
    private _data: UserData;
    private _original_data: UserData;
    private _is_current_user: boolean = false;

    constructor(data: UserData, isCurrentUser: boolean = false) {
        this._data = { ...data };
        this._original_data = { ...data };
        this._is_current_user = isCurrentUser;

        // Create property getters/setters for user data
        this._createUserProperties();
    }

    /**
     * Create dynamic properties for user data
     */
    private _createUserProperties(): void {
        const standardFields = [
            'id', 'email', 'enabled', 'signed_up', 'confirmed_email',
            'n_password_failures', 'last_login', 'remembered_logins', 'mfa', 'groups'
        ];

        // Create getters/setters for all user data
        Object.keys(this._data).forEach(key => {
            if (!standardFields.includes(key) || !Object.prototype.hasOwnProperty.call(this, key)) {
                Object.defineProperty(this, key, {
                    get: () => this._data[key],
                    set: (value: any) => {
                        this._data[key] = value;
                    },
                    enumerable: true,
                    configurable: true
                });
            }
        });
    }

    /**
     * Get user ID
     */
    getId(): string | number | undefined {
        return this._data.id;
    }

    /**
     * Get user email
     */
    getEmail(): string {
        return this._data.email;
    }

    /**
     * Check if user is enabled
     */
    isEnabled(): boolean {
        return this._data.enabled !== false;
    }

    /**
     * Check if user email is confirmed
     */
    isEmailConfirmed(): boolean {
        return this._data.confirmed_email === true;
    }

    /**
     * Get user signup date
     */
    getSignupDate(): Date | undefined {
        return this._data.signed_up;
    }

    /**
     * Get last login date
     */
    getLastLogin(): Date | undefined {
        return this._data.last_login;
    }

    /**
     * Get user groups
     */
    getGroups(): string[] {
        return this._data.groups || [];
    }

    /**
     * Check if user is in a specific group
     */
    isInGroup(groupName: string): boolean {
        return this.getGroups().includes(groupName);
    }

    /**
     * Get all user data as plain object
     */
    getData(): UserData {
        return { ...this._data };
    }

    /**
     * Get a specific user property
     */
    get(propertyName: string): any {
        return this._data[propertyName];
    }

    /**
     * Set a specific user property
     */
    set(propertyName: string, value: any): void {
        this._data[propertyName] = value;
    }

    /**
     * Update multiple user properties at once
     */
    update(data: Partial<UserData>): void {
        Object.assign(this._data, data);
    }

    /**
     * Save changes to the server
     */
    async save(): Promise<void> {
        try {
            const changes = this._getChanges();
            if (Object.keys(changes).length > 0) {
                const result = await getServerCallManager().call(
                    'anvil.users.update_user',
                    [this._data.id, changes]
                );
                this._data = result;
                this._original_data = { ...result };
            }
        } catch (error) {
            throw new AnvilUsersError(`Failed to save user: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Delete this user
     */
    async delete(): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.delete_user',
                [this._data.id]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to delete user: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Add user to a group
     */
    async addToGroup(groupName: string): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.add_user_to_group',
                [this._data.id, groupName]
            );

            if (!this._data.groups) {
                this._data.groups = [];
            }
            if (!this._data.groups.includes(groupName)) {
                this._data.groups.push(groupName);
            }
        } catch (error) {
            throw new AnvilUsersError(`Failed to add user to group: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Remove user from a group
     */
    async removeFromGroup(groupName: string): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.remove_user_from_group',
                [this._data.id, groupName]
            );

            if (this._data.groups) {
                this._data.groups = this._data.groups.filter(g => g !== groupName);
            }
        } catch (error) {
            throw new AnvilUsersError(`Failed to remove user from group: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Change user password
     */
    async changePassword(oldPassword: string, newPassword: string): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.change_password',
                [this._data.id, oldPassword, newPassword]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to change password: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Request password reset for this user
     */
    async requestPasswordReset(): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.request_password_reset',
                [this._data.email]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to request password reset: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Confirm user email with token
     */
    async confirmEmail(token: string): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.confirm_email',
                [token]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to confirm email: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Enable MFA for this user
     */
    async enableMFA(method: string): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.enable_mfa',
                [this._data.id, method]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to enable MFA: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Send email confirmation
     */
    async sendEmailConfirmation(): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.send_email_confirmation',
                [this._data.id]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to send email confirmation: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Force logout user from all sessions
     */
    async forceLogout(): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.force_logout',
                [this._data.id]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to force logout: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Get changes since last save
     */
    private _getChanges(): Partial<UserData> {
        const changes: Partial<UserData> = {};

        Object.keys(this._data).forEach(key => {
            if (this._data[key] !== this._original_data[key]) {
                changes[key] = this._data[key];
            }
        });

        return changes;
    }

    /**
     * Check if user has unsaved changes
     */
    isDirty(): boolean {
        return Object.keys(this._getChanges()).length > 0;
    }

    /**
     * Check if this is the current logged-in user
     */
    isCurrentUser(): boolean {
        return this._is_current_user;
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
    toJSON(): UserData {
        return this.getData();
    }

    /**
     * String representation
     */
    toString(): string {
        return `User(${this._data.email}, id=${this._data.id})`;
    }
}

/**
 * Custom error class for user operations
 */
export class AnvilUsersError extends Error {
    public originalError?: ServerCallError;

    constructor(message: string, originalError?: ServerCallError) {
        super(message);
        this.name = 'AnvilUsersError';
        this.originalError = originalError;
    }
}

/**
 * Authentication Manager
 */
export class AuthenticationManager {
    private static instance: AuthenticationManager | null = null;
    private _currentUser: User | null = null;
    private sessionToken: string | null = null;
    private loginCallbacks: Array<(user: User | null) => void> = [];
    private logoutCallbacks: Array<(user: User | null) => void> = [];

    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Get singleton instance
     */
    static getInstance(): AuthenticationManager {
        if (!this.instance) {
            this.instance = new AuthenticationManager();
        }
        return this.instance;
    }

    /**
     * Get current logged-in user
     */
    getCurrentUser(): User | null {
        return this._currentUser;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn(): boolean {
        return this._currentUser !== null;
    }

    /**
     * Get session token
     */
    getSessionToken(): string | null {
        return this.sessionToken;
    }

    /**
     * Login user with email and password (test-compatible signature)
     */
    async login(email: string, password: string, options?: LoginOptions): Promise<User> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.login',
                [email, password, options || {}]
            );

            if (result.success) {
                this._currentUser = new User(result.user, true);
                this.sessionToken = result.session_token;

                // Store session token for future requests
                if (typeof window !== 'undefined' && this.sessionToken) {
                    if (options?.rememberMe) {
                        localStorage.setItem('anvil_session_token', this.sessionToken);
                    } else {
                        sessionStorage.setItem('anvil_session_token', this.sessionToken);
                    }
                }

                // Notify login callbacks
                this.loginCallbacks.forEach(callback => callback(this._currentUser));

                return this._currentUser;
            } else {
                throw new Error(result.error || 'Login failed');
            }

        } catch (error) {
            throw new Error((error as Error).message);
        }
    }

    /**
     * Login user with existing session token
     */
    async loginWithToken(token: string): Promise<AuthenticationResult> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.login_with_token',
                [token]
            );

            if (result.success) {
                this._currentUser = new User(result.user, true);
                this.sessionToken = token;

                // Notify login callbacks
                this.loginCallbacks.forEach(callback => callback(this._currentUser));
            }

            return {
                success: result.success,
                user: this._currentUser,
                error: result.error
            };

        } catch (error) {
            return {
                success: false,
                error: (error as ServerCallError).message
            };
        }
    }

    /**
     * Logout current user
     */
    async logout(): Promise<void> {
        try {
            if (this.sessionToken) {
                await getServerCallManager().call('anvil.users.logout');
            }
        } catch (error) {
            // Continue with logout even if server call fails
            console.warn('Failed to logout on server:', error);
        } finally {
            const user = this._currentUser;
            this._currentUser = null;
            this.sessionToken = null;

            // Clear stored session
            if (typeof window !== 'undefined') {
                localStorage.removeItem('anvil_session_token');
                sessionStorage.removeItem('anvil_session_token');
            }

            // Notify logout callbacks
            this.logoutCallbacks.forEach(callback => callback(user));
        }
    }

    /**
     * Sign up new user
     */
    async signup(signupData: SignupData): Promise<User> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.signup',
                [signupData]
            );

            if (result.success) {
                return new User(result.user, false);
            } else {
                throw new Error(result.error || 'Signup failed');
            }

        } catch (error) {
            throw new Error((error as Error).message);
        }
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email: string): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.request_password_reset',
                [email]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to request password reset: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Reset password
     */
    async resetPassword(token: string, newPassword: string): Promise<void> {
        try {
            await getServerCallManager().call(
                'anvil.users.reset_password',
                [token, newPassword]
            );
        } catch (error) {
            throw new AnvilUsersError(`Failed to reset password: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Refresh current user session
     */
    async refreshCurrentUser(): Promise<User> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.get_current_user'
            );

            if (result.success) {
                this._currentUser = new User(result.user, true);
                return this._currentUser;
            } else {
                // Clear current user on session expiry
                this._currentUser = null;
                throw new Error(result.error || 'Session expired');
            }

        } catch (error) {
            // Clear current user on error
            this._currentUser = null;
            throw new Error((error as Error).message);
        }
    }

    /**
     * Confirm password reset with token
     */
    async confirmPasswordReset(token: string, newPassword: string): Promise<AuthenticationResult> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.confirm_password_reset',
                [token, newPassword]
            );

            return {
                success: result.success,
                error: result.error
            };

        } catch (error) {
            return {
                success: false,
                error: (error as ServerCallError).message
            };
        }
    }

    /**
     * Confirm email address
     */
    async confirmEmail(token: string): Promise<AuthenticationResult> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.confirm_email',
                [token]
            );

            return {
                success: result.success,
                error: result.error
            };

        } catch (error) {
            return {
                success: false,
                error: (error as ServerCallError).message
            };
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(userId: string | number): Promise<User | null> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.get_user',
                [userId]
            );

            return result ? new User(result, false) : null;

        } catch (error) {
            throw new AnvilUsersError(`Failed to get user: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email: string): Promise<User | null> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.get_user_by_email',
                [email]
            );

            return result ? new User(result, false) : null;

        } catch (error) {
            throw new AnvilUsersError(`Failed to get user by email: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Search for users
     */
    async searchUsers(criteria: Record<string, any> = {}, limit: number = 100): Promise<User[]> {
        try {
            const result = await getServerCallManager().call(
                'anvil.users.search_users',
                [criteria, limit]
            );

            return result.map((userData: UserData) => new User(userData, false));

        } catch (error) {
            throw new AnvilUsersError(`Failed to search users: ${(error as ServerCallError).message}`, error as ServerCallError);
        }
    }

    /**
     * Initialize session from stored token
     */
    async initializeSession(): Promise<boolean> {
        if (typeof window === 'undefined') return false;

        const token = localStorage.getItem('anvil_session_token') ||
            sessionStorage.getItem('anvil_session_token');

        if (token) {
            const result = await this.loginWithToken(token);
            return result.success;
        }

        return false;
    }

    /**
     * Add login callback
     */
    onLogin(callback: (user: User | null) => void): void {
        this.loginCallbacks.push(callback);
    }

    /**
     * Add logout callback
     */
    onLogout(callback: (user: User | null) => void): void {
        this.logoutCallbacks.push(callback);
    }

    /**
     * Remove login callback
     */
    removeLoginCallback(callback: (user: User | null) => void): void {
        const index = this.loginCallbacks.indexOf(callback);
        if (index > -1) {
            this.loginCallbacks.splice(index, 1);
        }
    }

    /**
     * Remove logout callback
     */
    removeLogoutCallback(callback: (user: User | null) => void): void {
        const index = this.logoutCallbacks.indexOf(callback);
        if (index > -1) {
            this.logoutCallbacks.splice(index, 1);
        }
    }
}

// Export singleton instance and utility functions
export const auth = AuthenticationManager.getInstance();

/**
 * Get current user (equivalent to anvil.users.get_user())
 */
export function get_user(): User | null {
    return auth.getCurrentUser();
}

/**
 * Login user (equivalent to anvil.users.login())
 */
export async function login(email: string, password: string, remember: boolean = false): Promise<AuthenticationResult> {
    try {
        const user = await auth.login(email, password, { rememberMe: remember });
        return {
            success: true,
            user
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message
        };
    }
}

/**
 * Logout user (equivalent to anvil.users.logout())
 */
export async function logout(): Promise<void> {
    return auth.logout();
}

/**
 * Sign up new user (equivalent to anvil.users.signup())
 */
export async function signup(signupData: SignupData): Promise<AuthenticationResult> {
    try {
        const user = await auth.signup(signupData);
        return {
            success: true,
            user
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message
        };
    }
}

/**
 * Reset password (equivalent to anvil.users.reset_password())
 */
export async function reset_password(email: string): Promise<PasswordResetResult> {
    try {
        await auth.requestPasswordReset(email);
        return {
            success: true,
            message: 'Password reset email sent'
        };
    } catch (error) {
        return {
            success: false,
            message: (error as Error).message
        };
    }
}

/**
 * Get user by email (equivalent to anvil.users.get_user_by_email())
 */
export async function get_user_by_email(email: string): Promise<User | null> {
    return auth.getUserByEmail(email);
}

// Export main anvil.users namespace
export const anvil_users = {
    User,
    get_user,
    login,
    logout,
    signup,
    reset_password,
    get_user_by_email,
    auth,
    AuthenticationManager,
    AnvilUsersError
}; 