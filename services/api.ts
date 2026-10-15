import { Product } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost/pork-farm/api';

export const api = {
  // ── Products ──────────────────────────────────────────────
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${BASE_URL}/products.php`);
    if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
    return res.json();
  },

  async saveProduct(product: Partial<Product>): Promise<{ message: string; id?: string }> {
    const res = await fetch(`${BASE_URL}/products.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) throw new Error(`Failed to save product: ${res.status}`);
    return res.json();
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/products.php`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error(`Failed to delete product: ${res.status}`);
    return res.json();
  },

  // ── Auth ──────────────────────────────────────────────────
  async login(username: string, password: string): Promise<{ id: string; username: string }> {
    const res = await fetch(`${BASE_URL}/auth.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    return res.json();
  },

  // ── Finances ──────────────────────────────────────────────
  async getFinances(): Promise<unknown[]> {
    const res = await fetch(`${BASE_URL}/finances.php`);
    if (!res.ok) throw new Error(`Failed to fetch finances: ${res.status}`);
    return res.json();
  },

  // ── Metrics ───────────────────────────────────────────────
  async getMetrics(): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/metrics.php`);
    if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`);
    return res.json();
  },
};
