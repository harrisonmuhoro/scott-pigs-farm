import { Product, User, MonthlyFinance, PigProfile, LitterRecord, WeightRecord, LitterWeightRecord, HerdGroup, HerdGroupEvent, PenRecord, PigTransfer, HealthRecord, VaccinationSchedule, HealthReminder, BreedingEvent, InventoryItem, SupplierRecord, StockMovement, InventoryAlerts, PurchaseRecord, FinancialTransaction, SaleRecord, FinancePayment, DashboardSummary } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost/pork-farm/backend/api';
let csrfToken = '';

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (authenticated && csrfToken) headers.set('X-CSRF-Token', csrfToken);
    const response = await fetch(`${API_BASE_URL}/${path}`, { ...init, headers, credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
    return payload as T;
}

export const api = {
    session: async (): Promise<User | null> => {
        const result = await request<{ user: User | null; csrfToken?: string }>('auth.php');
        csrfToken = result.csrfToken || '';
        return result.user;
    },
    logout: async (): Promise<void> => {
        await request('auth.php', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }, true);
        csrfToken = '';
    },
    getFinances: (): Promise<MonthlyFinance[]> => request('finances.php', {}, true),
    saveFinance: (finance: Partial<MonthlyFinance>): Promise<{ status: string }> => request('finances.php', { method: 'POST', body: JSON.stringify(finance) }, true),
    deleteFinance: (id: string): Promise<{ status: string }> => request('finances.php', { method: 'DELETE', body: JSON.stringify({ id }) }, true),
    getTransactions: (): Promise<FinancialTransaction[]> => request('finance_transactions.php?resource=transactions', {}, true),
    getOutstandingTransactions: (): Promise<FinancialTransaction[]> => request('finance_transactions.php?resource=transactions&outstanding=1', {}, true),
    createTransaction: (transaction: Partial<FinancialTransaction> & { request_key: string }): Promise<FinancialTransaction> => request('finance_transactions.php?resource=transactions', { method: 'POST', body: JSON.stringify(transaction) }, true),
    recordFinancePayment: (payment: { request_key: string; transaction_id: string; payment_date: string; amount: string; payment_method: string; reference?: string; notes?: string }): Promise<{ id: string; status: string }> => request('finance_transactions.php?resource=payments', { method: 'POST', body: JSON.stringify(payment) }, true),
    getFinancePayments: (): Promise<FinancePayment[]> => request('finance_transactions.php?resource=payments', {}, true),
    downloadReport: async (report: string, from: string, to: string, format: 'csv' | 'xlsx' = 'csv'): Promise<void> => {
        const query = new URLSearchParams({ report, from, to, format });
        const response = await fetch(`${API_BASE_URL}/reports.php?${query}`, { credentials: 'include' });
        if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Report request failed (${response.status})`); }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `scott-farm-${report}.${format}`;
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    },
    openPrintableReport: (report: string, from: string, to: string): Window | null => {
        const query = new URLSearchParams({ report, from, to, format: 'print' });
        return window.open(`${API_BASE_URL}/reports.php?${query}`, '_blank');
    },
    getSales: (): Promise<SaleRecord[]> => request('sales.php', {}, true),
    createSale: (sale: Record<string, unknown>): Promise<{ id: string; total: string; payment_status: string }> => request('sales.php', { method: 'POST', body: JSON.stringify(sale) }, true),
    getProducts: (): Promise<Product[]> => request('products.php'),
    createProduct: (product: Omit<Product, 'id'>): Promise<Product> => request('products.php', { method: 'POST', body: JSON.stringify(product) }, true),
    updateProduct: (product: Product): Promise<Product> => request('products.php', { method: 'PUT', body: JSON.stringify(product) }, true),
    deleteProduct: (id: string): Promise<{ status: string }> => request('products.php', { method: 'DELETE', body: JSON.stringify({ id }) }, true),
    getPigs: (): Promise<PigProfile[]> => request('pigs.php', {}, true),
    savePig: (pig: Partial<PigProfile>): Promise<PigProfile> => request('pigs.php', { method: pig.id ? 'PUT' : 'POST', body: JSON.stringify(pig) }, true),
    archivePig: (id: string): Promise<void> => request('pigs.php', { method: 'DELETE', body: JSON.stringify({ id }) }, true),
    uploadPigPhoto: async (pigId: string, photo: File): Promise<void> => {
        const form = new FormData();
        form.append('pig_id', pigId);
        form.append('photo', photo);
        const headers = new Headers();
        if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
        const response = await fetch(`${API_BASE_URL}/pig_photos.php`, { method: 'POST', body: form, headers, credentials: 'include' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Photo upload failed (${response.status})`);
    },
    getPigPhoto: async (pigId: string): Promise<Blob> => {
        const response = await fetch(`${API_BASE_URL}/pig_photos.php?pig_id=${encodeURIComponent(pigId)}`, { credentials: 'include' });
        if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || `Photo request failed (${response.status})`); }
        return response.blob();
    },
    deletePigPhoto: async (pigId: string): Promise<void> => { await request<{ status: string }>('pig_photos.php', { method: 'DELETE', body: JSON.stringify({ pig_id: pigId }) }, true); },
    getLitters: (): Promise<LitterRecord[]> => request('litters.php', {}, true),
    saveLitter: (litter: Partial<LitterRecord>): Promise<LitterRecord> => request('litters.php', { method: litter.id ? 'PUT' : 'POST', body: JSON.stringify(litter) }, true),
    getWeights: (pigId?: string): Promise<WeightRecord[]> => request(`weights.php${pigId ? `?pig_id=${encodeURIComponent(pigId)}` : ''}`, {}, true),
    addWeight: (weight: { pig_id: string; measured_at: string; weight_kg: string; notes?: string }): Promise<WeightRecord> => request('weights.php', { method: 'POST', body: JSON.stringify(weight) }, true),
    getLitterWeights: (): Promise<LitterWeightRecord[]> => request('litter_weights.php', {}, true),
    addLitterWeight: (weight: { litter_id: string; measured_at: string; sample_count: number; average_weight_kg: string; notes?: string }): Promise<LitterWeightRecord> => request('litter_weights.php', { method: 'POST', body: JSON.stringify(weight) }, true),
    getHerdGroups: (): Promise<HerdGroup[]> => request('groups.php', {}, true),
    getHerdGroupHistory: (id: string): Promise<{ group: HerdGroup; events: HerdGroupEvent[] }> => request(`groups.php?id=${encodeURIComponent(id)}`, {}, true),
    createHerdGroup: (group: { group_code: string; name: string; group_type: HerdGroup['group_type']; started_on: string; head_count: number; current_pen_id?: string | null; notes?: string }): Promise<HerdGroup> => request('groups.php', { method: 'POST', body: JSON.stringify({ ...group, action: 'create' }) }, true),
    recordHerdGroupEvent: (event: { group_id: string; event_type: HerdGroupEvent['event_type']; occurred_on: string; reason: string; notes?: string; new_count?: number; new_status?: HerdGroup['lifecycle_status']; new_pen_id?: string | null }): Promise<HerdGroup> => request('groups.php', { method: 'POST', body: JSON.stringify({ ...event, action: 'event' }) }, true),
    getPens: (): Promise<PenRecord[]> => request('pens.php', {}, true),
    createPen: (pen: { code: string; name: string; capacity: number; notes?: string }): Promise<PenRecord> => request('pens.php', { method: 'POST', body: JSON.stringify(pen) }, true),
    updatePen: (id: string, pen: { code: string; name: string; capacity: number; notes?: string; active: boolean }): Promise<PenRecord> => request('pens.php', { method: 'PATCH', body: JSON.stringify({ id, ...pen }) }, true),
    getTransfers: (): Promise<PigTransfer[]> => request('transfers.php', {}, true),
    transferPig: (transfer: { pig_id: string; to_pen_id: string | null; transferred_on: string; reason: string }): Promise<PigTransfer> => request('transfers.php', { method: 'POST', body: JSON.stringify(transfer) }, true),
    getHealthRecords: (): Promise<HealthRecord[]> => request('health.php?resource=records', {}, true),
    createHealthRecord: (record: Partial<HealthRecord>): Promise<HealthRecord> => request('health.php?resource=records', { method: 'POST', body: JSON.stringify(record) }, true),
    updateFollowup: async (id: string, follow_up_status: HealthRecord['follow_up_status']): Promise<void> => { await request<{ status: string }>('health.php?resource=records', { method: 'PATCH', body: JSON.stringify({ id, follow_up_status }) }, true); },
    getVaccinationSchedules: (): Promise<VaccinationSchedule[]> => request('health.php?resource=schedules', {}, true),
    createVaccinationSchedule: (schedule: Partial<VaccinationSchedule>): Promise<VaccinationSchedule> => request('health.php?resource=schedules', { method: 'POST', body: JSON.stringify(schedule) }, true),
    setVaccinationScheduleActive: async (id: string, active: boolean): Promise<void> => { await request<{ status: string }>('health.php?resource=schedules', { method: 'PATCH', body: JSON.stringify({ id, active }) }, true); },
    getHealthReminders: (): Promise<HealthReminder[]> => request('health.php?resource=reminders', {}, true),
    getBreedingEvents: (): Promise<BreedingEvent[]> => request('breeding.php', {}, true),
    createBreedingEvent: (event: Partial<BreedingEvent>): Promise<BreedingEvent> => request('breeding.php', { method: 'POST', body: JSON.stringify(event) }, true),
    getInventoryItems: (): Promise<InventoryItem[]> => request('inventory.php?resource=items', {}, true),
    createInventoryItem: (item: Partial<InventoryItem>): Promise<InventoryItem> => request('inventory.php?resource=items', { method: 'POST', body: JSON.stringify(item) }, true),
    setInventoryItemActive: async (id: string, active: boolean): Promise<void> => { await request<{ status: string }>('inventory.php?resource=items', { method: 'PATCH', body: JSON.stringify({ id, active }) }, true); },
    getSuppliers: (): Promise<SupplierRecord[]> => request('inventory.php?resource=suppliers', {}, true),
    createSupplier: (supplier: Partial<SupplierRecord>): Promise<SupplierRecord> => request('inventory.php?resource=suppliers', { method: 'POST', body: JSON.stringify(supplier) }, true),
    getStockMovements: (): Promise<StockMovement[]> => request('inventory.php?resource=movements', {}, true),
    getInventoryAlerts: (): Promise<InventoryAlerts> => request('inventory.php?resource=alerts', {}, true),
    getPurchases: (): Promise<PurchaseRecord[]> => request('inventory.php?resource=purchases', {}, true),
    receivePurchase: (purchase: Record<string, unknown>): Promise<{ id: string; status: string; line_count: number }> => request('inventory.php?resource=purchases', { method: 'POST', body: JSON.stringify(purchase) }, true),
    createStockMovement: (movement: Record<string, unknown>): Promise<{ id: string; status: string }> => request('inventory.php?resource=movements', { method: 'POST', body: JSON.stringify(movement) }, true),
    login: async (username: string, password: string): Promise<{ user: User }> => {
        const result = await request<{ user: User; csrfToken: string }>('auth.php', { method: 'POST', body: JSON.stringify({ username, password }) });
        csrfToken = result.csrfToken;
        return { user: result.user };
    },
    updateProfile: async (currentPassword: string, newUsername?: string, newPassword?: string): Promise<{ status: string; message: string; user: User }> => {
        const result = await request<{ status: string; message: string; csrfToken: string; user: User }>('auth.php', {
            method: 'POST', body: JSON.stringify({ action: 'update_profile', current_password: currentPassword, new_username: newUsername, new_password: newPassword }),
        }, true);
        csrfToken = result.csrfToken;
        return result;
    },
    getUsers: (): Promise<User[]> => request('users.php', {}, true),
    getSystemStatus: (): Promise<{ php_version: string; database_connected: boolean; database_version: string }> => request('system_status.php', {}, true),
    getDashboardSummary: (): Promise<DashboardSummary> => request('dashboard.php', {}, true),
    createUser: (user: { username: string; password: string; role: 'developer' | 'owner' }): Promise<User> => request('users.php', { method: 'POST', body: JSON.stringify(user) }, true),
    resetUserPassword: (id: string): Promise<{ status: string; temporary_password: string }> => request('users.php', { method: 'PATCH', body: JSON.stringify({ id, action: 'reset_password' }) }, true),
    updateUser: async (id: string, changes: { action: 'set_role'; role: User['role'] } | { action: 'set_active'; active: boolean }): Promise<void> => { await request<{ status: string }>('users.php', { method: 'PATCH', body: JSON.stringify({ id, ...changes }) }, true); },
};
