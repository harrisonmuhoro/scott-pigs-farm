import { Product, FinancialMetric, User, MonthlyFinance } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost/pork-farm/api';

export const api = {
    // Finances
    getFinances: async (): Promise<MonthlyFinance[]> => {
        const response = await fetch(`${API_BASE_URL}/finances.php`);
        if (!response.ok) throw new Error('Failed to fetch finances');
        return response.json();
    },

    saveFinance: async (finance: Partial<MonthlyFinance>): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/finances.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finance),
        });
        if (!response.ok) throw new Error('Failed to save finance record');
        return response.json();
    },

    deleteFinance: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/finances.php`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (!response.ok) throw new Error('Failed to delete finance record');
        return response.json();
    },
    // Products
    getProducts: async (): Promise<Product[]> => {
        const response = await fetch(`${API_BASE_URL}/products.php`);
        if (!response.ok) throw new Error('Failed to fetch products');
        return response.json();
    },

    createProduct: async (product: Omit<Product, 'id'>): Promise<Product> => {
        const response = await fetch(`${API_BASE_URL}/products.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product),
        });
        if (!response.ok) throw new Error('Failed to create product');
        return response.json();
    },

    updateProduct: async (product: Product): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/products.php`, {
            method: 'POST', // Using POST for updates as well to keep it simple with PHP
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product),
        });
        if (!response.ok) throw new Error('Failed to update product');
        return response.json();
    },

    deleteProduct: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/products.php`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (!response.ok) throw new Error('Failed to delete product');
        return response.json();
    },

    // Metrics
    getMetrics: async (): Promise<FinancialMetric[]> => {
        const response = await fetch(`${API_BASE_URL}/metrics.php`);
        if (!response.ok) throw new Error('Failed to fetch metrics');
        return response.json();
    },

    // Auth
    login: async (username: string, password: string): Promise<{ status: string, user: User }> => {
        const response = await fetch(`${API_BASE_URL}/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }
        return response.json();
    },

    updateProfile: async (userId: string, currentPassword: string, newUsername?: string, newPassword?: string): Promise<{ status: string, message: string }> => {
        const response = await fetch(`${API_BASE_URL}/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_profile',
                user_id: userId,
                current_password: currentPassword,
                new_username: newUsername,
                new_password: newPassword
            }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Update failed');
        }
        return response.json();
    },

    resetPassword: async (username: string, recoveryCode: string, newPassword: string): Promise<{ status: string, message: string }> => {
        const response = await fetch(`${API_BASE_URL}/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'reset_password',
                username,
                recovery_code: recoveryCode,
                new_password: newPassword
            }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Reset failed');
        }
        return response.json();
    },
};
