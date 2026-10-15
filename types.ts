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
}