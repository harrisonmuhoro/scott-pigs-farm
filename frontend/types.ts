// Pork/types.ts

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  description: string;
  inquire: string;
}

export interface FinancialMetric {
  label: string;
  value: number;
  type: 'income' | 'expense' | 'neutral';
}

// New Interface for Monthly Finance Data
export interface MonthlyFinance {
  id: string;
  month: string; // Format: "YYYY-MM"
  revenue: number;
  feed_cost: number;
  labour_cost: number;
  other_cost: number;
}

// New Interface for Pig Inventory
export interface PigLitter {
  id: string;
  mother: string;
  father: string;
  pigletsBorn: number;
  color: string;
  dob: string;
  breed: string;
  status: string;
  price: number;
  motherImage: string;
  fatherImage: string;

}

export enum ViewState {
  HOME = 'HOME',
  ADMIN = 'ADMIN',
  LOGIN = 'LOGIN'
}

export interface User {
  id: string;
  username: string;
  role: 'developer' | 'owner';
  active?: boolean | number;
  force_password_change?: boolean | number;
  created_at?: string;
}

export interface PigProfile {
  id: string;
  tag_id: string;
  name: string | null;
  sex: 'female' | 'male' | 'unknown';
  breed: string;
  birth_date: string | null;
  birth_date_estimated: boolean;
  source: string | null;
  acquired_date: string | null;
  dam_id: string | null;
  sire_id: string | null;
  litter_id: string | null;
  herd_group_id: string | null;
  pen_id: string | null;
  lifecycle_status: string;
  notes: string | null;
  has_photo?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export interface LitterRecord {
  id: string;
  litter_code: string;
  dam_id: string;
  sire_id: string | null;
  mating_date: string | null;
  expected_farrowing_date: string;
  expected_date_estimated: boolean;
  farrowing_date: string | null;
  total_born: number | null;
  born_alive: number | null;
  stillborn: number | null;
  fostered: number;
  weaned_count: number | null;
  weaned_date: string | null;
  notes: string | null;
  dam_tag?: string;
  sire_tag?: string | null;
}

export interface WeightRecord {
  id: string;
  pig_id: string;
  tag_id: string;
  measured_at: string;
  weight_kg: string;
  notes: string | null;
}

export interface LitterWeightRecord {
  id: string;
  litter_id: string;
  litter_code?: string;
  measured_at: string;
  sample_count: number;
  average_weight_kg: string;
  notes: string | null;
  created_at?: string;
}

export interface HerdGroup {
  id: string;
  group_code: string;
  name: string;
  group_type: 'cohort' | 'quarantine' | 'breeding' | 'other';
  started_on: string;
  lifecycle_status: 'active' | 'closed';
  head_count: number;
  current_pen_id?: string | null;
  current_pen_code?: string | null;
  member_count?: number;
  notes: string | null;
  created_at: string;
}

export interface HerdGroupEvent {
  id: string;
  group_id: string;
  event_type: 'count_adjustment' | 'status_change' | 'pen_transfer';
  occurred_on: string;
  previous_count: number;
  new_count: number;
  previous_status: 'active' | 'closed';
  new_status: 'active' | 'closed';
  from_pen_id?: string | null;
  from_pen_code?: string | null;
  to_pen_id?: string | null;
  to_pen_code?: string | null;
  reason: string;
  notes: string | null;
  recorded_by?: string | null;
}

export interface PenRecord {
  id: string;
  code: string;
  name: string;
  capacity: number;
  occupancy: number;
  notes: string | null;
  active: boolean | number;
}

export interface PigTransfer {
  id: string;
  pig_id: string;
  tag_id?: string;
  from_pen_id: string | null;
  from_pen?: string | null;
  to_pen_id: string | null;
  to_pen?: string | null;
  transferred_on: string;
  reason: string;
}

export interface HealthRecord {
  id: string;
  pig_id: string | null;
  litter_id: string | null;
  record_type: 'observation' | 'treatment' | 'vaccination';
  occurred_on: string;
  symptoms: string | null;
  product_name: string | null;
  dose_as_entered: string | null;
  dose_unit: string | null;
  route: string | null;
  withdrawal_days: number | null;
  responsible_person: string | null;
  follow_up_due: string | null;
  follow_up_status: 'open' | 'completed' | 'cancelled';
  notes: string | null;
  tag_id?: string | null;
  litter_code?: string | null;
}

export interface VaccinationSchedule {
  id: string;
  pig_id: string | null;
  litter_id: string | null;
  vaccine_name: string;
  due_date: string;
  interval_days: number | null;
  notes: string | null;
  active: boolean | number;
  tag_id?: string | null;
  litter_code?: string | null;
}

export interface HealthReminder {
  reminder_id: string;
  reminder_type: string;
  title: string;
  due_date: string;
  reminder_status: 'due' | 'overdue';
  target: string;
}

export interface BreedingEvent {
  id: string;
  pig_id: string;
  related_pig_id: string | null;
  litter_id: string | null;
  event_type: 'mating' | 'insemination' | 'pregnancy_check' | 'farrowing' | 'weaning' | 'other';
  event_date: string;
  method: string | null;
  result: string | null;
  notes: string | null;
  pig_tag?: string;
  related_tag?: string | null;
  litter_code?: string | null;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  brand: string | null;
  description: string | null;
  reorder_threshold: string;
  preferred_supplier_id: string | null;
  track_batches: boolean | number;
  active: boolean | number;
  on_hand: string;
  stock_value?: string;
}

export interface SupplierRecord {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean | number;
}

export interface StockMovement {
  id: string;
  item_id: string;
  sku: string;
  item_name: string;
  movement_type: string;
  quantity_delta: string;
  unit: string;
  unit_cost?: string | null;
  batch_lot: string | null;
  expiry_date: string | null;
  movement_date: string;
  reason: string | null;
  notes: string | null;
}

export interface InventoryAlerts {
  low_stock: Array<{ id: string; sku: string; name: string; unit: string; on_hand: string; reorder_threshold: string }>;
  expiry: Array<{ item_id: string; sku: string; name: string; unit: string; batch_lot: string | null; expiry_date: string; on_hand: string; status: 'expired' | 'expiring' }>;
}

export interface PurchaseRecord {
  id: string;
  invoice_reference: string | null;
  purchase_date: string;
  received_date: string;
  supplier: string | null;
  line_count: number;
  total_cost: string;
}

export interface FinancialTransaction {
  id: string; transaction_type: 'income' | 'expense'; accounting_class: string; transaction_date: string;
  category: string; amount: string; amount_paid: string; currency: string; payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method: string | null; counterparty: string | null; reference: string | null; notes: string | null;
}

export interface SaleRecord { id: string; sale_date: string; customer: string | null; reference: string | null; total: string; amount_paid: string; payment_status: string; line_count: number; }

export interface FinancePayment { id: string; transaction_id: string; payment_date: string; amount: string; payment_method: string; reference: string | null; category: string; transaction_type: string; counterparty: string | null; }

export interface DashboardSummary {
  as_of: string;
  period_from: string;
  period_to: string;
  active_herd: number;
  births_this_year: number;
  weaned_this_year: number;
  farrowing_next_30_days: number;
  farrowing_overdue: number;
  open_health_tasks: number;
  due_vaccinations: number;
  low_stock_items: number;
  expiring_lots: number;
  sales_this_month: string;
  cash_in_this_month: string;
  cash_out_this_month: string;
  net_cash_flow_this_month: string;
}
