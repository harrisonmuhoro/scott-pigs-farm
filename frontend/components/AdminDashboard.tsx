// Pork/components/AdminDashboard.tsx

import React, { useState, useEffect } from 'react';
import { Product, MonthlyFinance, PigProfile, LitterRecord, WeightRecord, LitterWeightRecord, HerdGroup, PenRecord, PigTransfer, User } from '../types';
import { Save, Edit2, Trash2, PlusCircle, X, Menu, Home, LogOut, Settings } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';

// import { createClient } from '@supabase/supabase-js'; // UNCOMMENT FOR SQL
import './AdminDashboard.css';

// --- SUPABASE CONFIGURATION ---
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);

import { api } from '../src/services/api';
import HealthSection from './HealthSection';
import BreedingSection from './BreedingSection';
import InventorySection from './InventorySection';
import TransactionsSection from './TransactionsSection';
import ReportsSection from './ReportsSection';
import DashboardOverview from './DashboardOverview';
import GroupsSection from './GroupsSection';

interface AdminDashboardProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onHome: () => void;
  onLogout: () => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onUserUpdate, onHome, onLogout, products, setProducts }) => {
  // --- State Management ---
  const [monthlyFinances, setMonthlyFinances] = useState<MonthlyFinance[]>([]);
  const [financeError, setFinanceError] = useState('');
  const [pigs, setPigs] = useState<PigProfile[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [pens, setPens] = useState<PenRecord[]>([]);
  const [transfers, setTransfers] = useState<PigTransfer[]>([]);
  const [locationError, setLocationError] = useState('');
  const [penForm, setPenForm] = useState({ code: '', name: '', capacity: 1, notes: '', active: true });
  const [editingPenId, setEditingPenId] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({ pig_id: '', to_pen_id: '', transferred_on: '', reason: '' });
  const [weightForm, setWeightForm] = useState({ pig_id: '', measured_at: '', weight_kg: '', notes: '' });
  const [weightError, setWeightError] = useState('');
  const [weightLoading, setWeightLoading] = useState(true);
  const [weightPigId, setWeightPigId] = useState('');
  const [litterWeights, setLitterWeights] = useState<LitterWeightRecord[]>([]);
  const [litterWeightError, setLitterWeightError] = useState('');
  const [litterWeightLoading, setLitterWeightLoading] = useState(true);
  const [groupWeightForm, setGroupWeightForm] = useState({ litter_id: '', measured_at: '', sample_count: '1', average_weight_kg: '', notes: '' });
  const [litters, setLitters] = useState<LitterRecord[]>([]);
  const [herdGroups, setHerdGroups] = useState<HerdGroup[]>([]);
  const [litterError, setLitterError] = useState('');
  const [litterLoading, setLitterLoading] = useState(true);
  const [pigLoading, setPigLoading] = useState(true);
  const [pigError, setPigError] = useState('');
  const [pigPhotoUrl, setPigPhotoUrl] = useState('');
  const [pigPhotoError, setPigPhotoError] = useState('');
  const [pigPhotoBusy, setPigPhotoBusy] = useState(false);

  // Form States
  const [financeForm, setFinanceForm] = useState<Partial<MonthlyFinance>>({
    month: '', revenue: 0, feed_cost: 0, labour_cost: 0, other_cost: 0
  });

  // Pig Form State
  const emptyPigForm: Partial<PigProfile> = {
    tag_id: '', name: '', sex: 'unknown', breed: '', birth_date: '', birth_date_estimated: false,
    source: '', acquired_date: '', dam_id: '', sire_id: '', litter_id: '', herd_group_id: '', lifecycle_status: 'piglet', notes: ''
  };
  const [pigForm, setPigForm] = useState<Partial<PigProfile>>({
    ...emptyPigForm
  });
  const emptyLitterForm: Partial<LitterRecord> = {
    litter_code: '', dam_id: '', sire_id: null, mating_date: '', expected_farrowing_date: '', farrowing_date: '',
    total_born: null, born_alive: null, stillborn: null, fostered: 0, weaned_count: null, weaned_date: '', notes: ''
  };
  const [litterForm, setLitterForm] = useState<Partial<LitterRecord>>({ ...emptyLitterForm });
  const [editingLitterId, setEditingLitterId] = useState<string | null>(null);
  const [editingPigId, setEditingPigId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProductForm, setEditProductForm] = useState<Partial<Product>>({});

  // Settings State
  const [showSettings, setShowSettings] = useState(() => ['account-settings', 'user-management', 'system-status'].includes(window.location.hash.replace(/^#dashboard\//, '')));
  const [menuOpen, setMenuOpen] = useState(false);
  const availableDashboardPages = user.role === 'owner'
    ? ['farm-overview', 'finance-overview', 'transactions', 'reports', 'pig-form', 'weight-history', 'housing-records', 'litter-records', 'group-records', 'health-records', 'breeding-records', 'inventory-records', 'website-products', 'account-settings']
    : ['website-products', 'account-settings', 'user-management', 'system-status'];
  const defaultDashboardPage = user.role === 'owner' ? 'farm-overview' : 'website-products';
  const [activeDashboardPage, setActiveDashboardPage] = useState(() => {
    const requestedPage = window.location.hash.replace(/^#dashboard\//, '');
    return availableDashboardPages.includes(requestedPage) ? requestedPage : defaultDashboardPage;
  });
  const [settingsForm, setSettingsForm] = useState({
    currentPassword: '',
    newUsername: '',
    newPassword: ''
  });
  const [users, setUsers] = useState<User[]>([]);
  const [userError, setUserError] = useState('');
  const [resetPasswordResult, setResetPasswordResult] = useState<{ username: string; password: string } | null>(null);
  const [newUser, setNewUser] = useState<{ username: string; password: string; role: 'developer' | 'owner' }>({ username: '', password: '', role: 'owner' });
  const [systemStatus, setSystemStatus] = useState<{ php_version: string; database_connected: boolean; database_version: string } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPigPhotoUrl('');
    setPigPhotoError('');
    const selectedPig = pigs.find(pig => pig.id === editingPigId);
    if (editingPigId && selectedPig?.has_photo) {
      api.getPigPhoto(editingPigId).then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPigPhotoUrl(objectUrl);
      }).catch(error => {
        if (active) setPigPhotoError(error instanceof Error ? error.message : 'Could not load pig photo');
      });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [editingPigId]);

  // --- SQL INTEGRATION: Fetch Data ---
  useEffect(() => {
    if (user.force_password_change) return;
    if (user.role === 'owner') fetchFinances();
    if (user.role === 'developer') { fetchUsers(); api.getSystemStatus().then(setSystemStatus).catch(() => setSystemStatus(null)); }
    if (user.role === 'owner') { fetchPigs(); fetchLitters(); fetchWeights(); fetchLitterWeights(); fetchLocations(); api.getHerdGroups().then(setHerdGroups).catch(() => setHerdGroups([])); }
  }, [user.role, user.force_password_change]);

  const fetchFinances = async () => {
    setFinanceError('');
    try {
      const data = await api.getFinances();
      setMonthlyFinances(data);
    } catch (error) {
      console.error("Failed to load finances", error);
      setFinanceError(error instanceof Error ? error.message : 'Could not load financial records');
    }
  };

  const fetchPigs = async () => {
    setPigError('');
    try {
      setPigs(await api.getPigs());
    } catch (error) {
      setPigError(error instanceof Error ? error.message : 'Could not load pig records');
    } finally {
      setPigLoading(false);
    }
  };

  const fetchLitters = async () => {
    setLitterError('');
    try { setLitters(await api.getLitters()); }
    catch (error) { setLitterError(error instanceof Error ? error.message : 'Could not load litters'); }
    finally { setLitterLoading(false); }
  };

  const fetchWeights = async () => {
    setWeightError('');
    try { setWeights(await api.getWeights()); }
    catch (error) { setWeightError(error instanceof Error ? error.message : 'Could not load weight history'); }
    finally { setWeightLoading(false); }
  };

  const fetchLitterWeights = async () => {
    setLitterWeightError('');
    try { setLitterWeights(await api.getLitterWeights()); }
    catch (error) { setLitterWeightError(error instanceof Error ? error.message : 'Could not load litter group weights'); }
    finally { setLitterWeightLoading(false); }
  };

  const fetchLocations = async () => {
    setLocationError('');
    try {
      const [penRows, transferRows] = await Promise.all([api.getPens(), api.getTransfers()]);
      setPens(penRows);
      setTransfers(transferRows);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Could not load housing records');
    }
  };

  const handleCreatePen = async () => {
    setLocationError('');
    try {
      const saved = editingPenId ? await api.updatePen(editingPenId, penForm) : await api.createPen(penForm);
      setPens(current => editingPenId ? current.map(pen => pen.id === saved.id ? saved : pen) : [...current, saved]);
      setEditingPenId(null);
      setPenForm({ code: '', name: '', capacity: 1, notes: '', active: true });
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Could not save pen');
    }
  };

  const handlePigTransfer = async () => {
    setLocationError('');
    try {
      await api.transferPig({ ...transferForm, to_pen_id: transferForm.to_pen_id || null });
      setTransferForm(current => ({ ...current, reason: '' }));
      const [updatedPigs, updatedPens, updatedTransfers] = await Promise.all([api.getPigs(), api.getPens(), api.getTransfers()]);
      setPigs(updatedPigs);
      setPens(updatedPens);
      setTransfers(updatedTransfers);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Could not transfer pig');
    }
  };

  const handleAddWeight = async () => {
    if (!weightForm.pig_id || !weightForm.measured_at || !weightForm.weight_kg) {
      setWeightError('Pig, date, and weight are required.');
      return;
    }
    setWeightError('');
    try {
      const saved = await api.addWeight(weightForm);
      setWeights(current => [saved, ...current]);
      setWeightPigId(saved.pig_id);
      setWeightForm(current => ({ ...current, weight_kg: '', notes: '' }));
    } catch (error) {
      setWeightError(error instanceof Error ? error.message : 'Could not save weight record');
    }
  };

  const handleAddGroupWeight = async () => {
    if (!groupWeightForm.litter_id || !groupWeightForm.measured_at || !groupWeightForm.sample_count || !groupWeightForm.average_weight_kg) {
      setLitterWeightError('Litter, date, number sampled, and average weight are required.');
      return;
    }
    setLitterWeightError('');
    try {
      const saved = await api.addLitterWeight({
        litter_id: groupWeightForm.litter_id,
        measured_at: groupWeightForm.measured_at,
        sample_count: Number(groupWeightForm.sample_count),
        average_weight_kg: groupWeightForm.average_weight_kg,
        notes: groupWeightForm.notes || undefined,
      });
      const litter = litters.find(item => item.id === saved.litter_id);
      setLitterWeights(current => [{ ...saved, litter_code: litter?.litter_code }, ...current]);
      setGroupWeightForm(current => ({ ...current, average_weight_kg: '', notes: '' }));
    } catch (error) {
      setLitterWeightError(error instanceof Error ? error.message : 'Could not save group weight');
    }
  };

  const fetchUsers = async () => {
    setUserError('');
    try { setUsers(await api.getUsers()); }
    catch (error) { setUserError(error instanceof Error ? error.message : 'Could not load user accounts'); }
  };

  const handleCreateUser = async () => {
    setUserError('');
    try {
      const created = await api.createUser(newUser);
      setUsers(current => [...current, created]);
      setNewUser({ username: '', password: '', role: 'owner' });
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Could not create user account');
    }
  };

  const handleUserUpdate = async (target: User, changes: { action: 'set_role'; role: User['role'] } | { action: 'set_active'; active: boolean }) => {
    setUserError('');
    try {
      await api.updateUser(target.id, changes);
      await fetchUsers();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Could not update user account');
    }
  };

  const handlePasswordReset = async (target: User) => {
    setUserError('');
    setResetPasswordResult(null);
    try {
      const result = await api.resetUserPassword(target.id);
      setResetPasswordResult({ username: target.username, password: result.temporary_password });
      await fetchUsers();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Could not reset account password');
    }
  };

  // --- Helpers ---
  const formatCurrency = (val: number) => `KES ${val.toLocaleString()}`;

  // Short format for Y-axis (e.g., 450k, 1.2M)
  /*const formatShortCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  }; */

  const calculateAge = (dobString: string | null) => {
    if (!dobString) return 'Not recorded';
    const dob = new Date(dobString);
    const diff = Date.now() - dob.getTime();
    const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
    return `${weeks} weeks`;
  };

  // --- Handlers: Finance ---
  const handleSaveFinance = async () => {
    if (!financeForm.month) {
      alert("Please select a month");
      return;
    }
    try {
      await api.saveFinance(financeForm);
      fetchFinances(); // Refresh
      setFinanceForm({ month: '', revenue: 0, feed_cost: 0, labour_cost: 0, other_cost: 0 });
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to save record");
    }
  };

  const handleDeleteFinance = async (id: string) => {
    if (confirm("Delete this financial record?")) {
      try {
        await api.deleteFinance(id);
        fetchFinances();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const prepareChartData = () => {
    return monthlyFinances.map(f => {
      const totalExpenses = Number(f.feed_cost) + Number(f.labour_cost) + Number(f.other_cost);
      const netProfit = Number(f.revenue) - totalExpenses;
      return {
        month: f.month,
        Revenue: Number(f.revenue),
        Expenses: totalExpenses,
        Profit: netProfit
      };
    });
  };
  const chartPigId = weightPigId || pigs[0]?.id || '';
  const pigWeightTrend = weights.filter(record => record.pig_id === chartPigId).slice().sort((a, b) => a.measured_at.localeCompare(b.measured_at)).map(record => ({ date: record.measured_at, weight: Number(record.weight_kg) }));

  const dashboardMenuItems = user.role === 'owner'
    ? [
      { id: 'farm-overview', label: 'Farm overview' },
      { id: 'finance-overview', label: 'Financial overview' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'reports', label: 'Reports' },
      { id: 'pig-form', label: 'Pig profiles' },
      { id: 'weight-history', label: 'Weight history' },
      { id: 'housing-records', label: 'Pens and transfers' },
      { id: 'litter-records', label: 'Litters and farrowing' },
      { id: 'group-records', label: 'Herd groups and cohorts' },
      { id: 'health-records', label: 'Health and reminders' },
      { id: 'breeding-records', label: 'Breeding' },
      { id: 'inventory-records', label: 'Inventory' },
      { id: 'website-products', label: 'Website products' },
      { id: 'account-settings', label: 'Account settings' },
    ]
    : [
      { id: 'website-products', label: 'Website products' },
      { id: 'user-management', label: 'User and role management' },
      { id: 'system-status', label: 'System status' },
      { id: 'account-settings', label: 'Account settings' },
    ];
  const activeDashboardLabel = dashboardMenuItems.find(item => item.id === activeDashboardPage)?.label || 'Dashboard';

  const navigateDashboard = (sectionId: string) => {
    setMenuOpen(false); // close sidebar on mobile after navigation
    setActiveDashboardPage(sectionId);
    setShowSettings(['account-settings', 'user-management', 'system-status'].includes(sectionId));
    window.history.pushState(null, '', `#dashboard/${sectionId}`);
  };

  useEffect(() => {
    const syncDashboardPage = () => {
      const requestedPage = window.location.hash.replace(/^#dashboard\//, '');
      const nextPage = availableDashboardPages.includes(requestedPage) ? requestedPage : defaultDashboardPage;
      setActiveDashboardPage(nextPage);
      setShowSettings(['account-settings', 'user-management', 'system-status'].includes(nextPage));
      setMenuOpen(false);
    };
    window.addEventListener('popstate', syncDashboardPage);
    return () => window.removeEventListener('popstate', syncDashboardPage);
  }, [user.role]);

  // Pig profiles are stored by the API; local state is refreshed from its response.
  const handleAddOrUpdatePig = async () => {
    if (!pigForm.tag_id?.trim() || !pigForm.breed?.trim()) {
      setPigError('Tag ID and breed are required.');
      return;
    }
    setPigError('');
    try {
      const saved = await api.savePig({ ...pigForm, id: editingPigId || undefined });
      setPigs(current => editingPigId ? current.map(pig => pig.id === saved.id ? saved : pig) : [saved, ...current]);
      setEditingPigId(null);
      setPigForm({ ...emptyPigForm });
    } catch (error) {
      setPigError(error instanceof Error ? error.message : 'Could not save pig record');
    }
  };

  const handlePigPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingPigId) return;
    setPigPhotoError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setPigPhotoError('Choose a JPEG, PNG, or WebP image no larger than 2 MB.');
      event.target.value = '';
      return;
    }
    setPigPhotoBusy(true);
    try {
      await api.uploadPigPhoto(editingPigId, file);
      const photoBlob = await api.getPigPhoto(editingPigId);
      const nextUrl = URL.createObjectURL(photoBlob);
      setPigPhotoUrl(current => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setPigs(current => current.map(pig => pig.id === editingPigId ? { ...pig, has_photo: true } : pig));
    } catch (error) {
      setPigPhotoError(error instanceof Error ? error.message : 'Could not save pig photo');
    } finally {
      setPigPhotoBusy(false);
      event.target.value = '';
    }
  };

  const handlePigPhotoDelete = async () => {
    if (!editingPigId) return;
    setPigPhotoBusy(true);
    setPigPhotoError('');
    try {
      await api.deletePigPhoto(editingPigId);
      setPigPhotoUrl(current => { if (current) URL.revokeObjectURL(current); return ''; });
      setPigs(current => current.map(pig => pig.id === editingPigId ? { ...pig, has_photo: false } : pig));
    } catch (error) {
      setPigPhotoError(error instanceof Error ? error.message : 'Could not remove pig photo');
    } finally { setPigPhotoBusy(false); }
  };

  const handleArchivePig = async (pig: PigProfile) => {
    if (!window.confirm(`Archive ${pig.tag_id}? This keeps its history in the database.`)) return;
    try {
      await api.archivePig(pig.id);
      setPigs(current => current.filter(item => item.id !== pig.id));
    } catch (error) {
      setPigError(error instanceof Error ? error.message : 'Could not archive pig record');
    }
  };

  const handleEditPig = (pig: PigProfile) => {
    setPigForm(pig);
    setEditingPigId(pig.id!);
    // Scroll to form
    const formElement = document.getElementById('pig-form');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveLitter = async () => {
    if (!litterForm.litter_code?.trim() || !litterForm.dam_id) {
      setLitterError('Litter code and dam record ID are required.');
      return;
    }
    setLitterError('');
    try {
      const saved = await api.saveLitter({ ...litterForm, id: editingLitterId || undefined });
      setLitters(current => editingLitterId ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]);
      setLitterForm({ ...emptyLitterForm });
      setEditingLitterId(null);
    } catch (error) {
      setLitterError(error instanceof Error ? error.message : 'Could not save litter');
    }
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProductId(product.id);
    setEditProductForm(product);
    setShowProductForm(true);
  };

  const handleAddProductClick = () => {
    setEditingProductId(null);
    setEditProductForm({});
    setShowProductForm(true);
  };

  const handleSaveProduct = async () => {
    if (!editProductForm.name) {
      alert("Product Name is required");
      return;
    }

    try {
      if (editingProductId) {
        // UPDATE
        await api.updateProduct(editProductForm as Product);
        // Update local state
        const updatedProducts = products.map((p) =>
          p.id === editingProductId ? { ...p, ...editProductForm } : p
        );
        setProducts(updatedProducts as Product[]);
        alert("Product updated successfully!");
      } else {
        // CREATE
        const newProduct = await api.createProduct(editProductForm as Product);
        setProducts([...products, newProduct]);
        alert("Product added successfully!");
      }

      setEditingProductId(null);
      setEditProductForm({});
      setShowProductForm(false);
    } catch (error) {
      alert("Failed to save product");
      console.error(error);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        await api.deleteProduct(id);
        setProducts(products.filter(p => p.id !== id));
        alert("Product deleted successfully");
      } catch (error) {
        console.error(error);
        alert("Failed to delete product");
      }
    }
  };



  const handleUpdateProfile = async () => {
    if (!settingsForm.currentPassword) {
      alert("Current password is required to make changes");
      return;
    }

    try {
      const res = await api.updateProfile(
        settingsForm.currentPassword,
        settingsForm.newUsername,
        settingsForm.newPassword
      );
      onUserUpdate(res.user);
      alert(res.message);
      setSettingsForm({ currentPassword: '', newUsername: '', newPassword: '' });
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (user.force_password_change) return (
    <div className="dashboard-container"><div className="dashboard-content">
      <section style={{ maxWidth: '680px', margin: '3rem auto', background: '#fff7ed', padding: '2rem', borderRadius: '10px' }}>
        <h1 className="section-title">Set a new password</h1>
        <p>This temporary password must be replaced before you can use the farm portal.</p>
        <div className="form-group"><label htmlFor="forced-current-password">Temporary password</label><input id="forced-current-password" type="password" autoComplete="current-password" className="form-input" value={settingsForm.currentPassword} onChange={e => setSettingsForm({ ...settingsForm, currentPassword: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="forced-new-password">New password (12+ characters)</label><input id="forced-new-password" type="password" autoComplete="new-password" minLength={12} className="form-input" value={settingsForm.newPassword} onChange={e => setSettingsForm({ ...settingsForm, newPassword: e.target.value })} /></div>
        <button className="btn-add" onClick={handleUpdateProfile} disabled={settingsForm.newPassword.length < 12}>Update password</button>
      </section>
    </div></div>
  );

  return (
    <div className="dashboard-container">

      {/* ── Mobile overlay backdrop ── */}
      {menuOpen && (
        <button
          type="button"
          className="dashboard-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── Permanent Left Sidebar ── */}
      <aside id="dashboard-navigation" className={`dashboard-sidebar${menuOpen ? ' sidebar-open' : ''}`} aria-label="Dashboard navigation">
        {/* Branding */}
        <div className="sidebar-brand">
          <img src="/Public/images/logo.svg" alt="Scott Pigs Farm" className="sidebar-logo" />
        </div>

        {/* Nav items */}
        <nav className="sidebar-nav">
          <p className="sidebar-section-label">Navigation</p>
          {dashboardMenuItems.map(item => (
            <button
              type="button"
              key={item.id}
              className="sidebar-nav-item"
              aria-current={activeDashboardPage === item.id ? 'page' : undefined}
              onClick={() => navigateDashboard(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-nav-item sidebar-settings-btn"
            aria-current={activeDashboardPage === 'account-settings' ? 'page' : undefined}
            onClick={() => navigateDashboard('account-settings')}
          >
            <Settings size={16} /> Account Settings
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="dashboard-main">
        <header className="dashboard-navbar">
          <button type="button" className="dashboard-navbar-logo" onClick={onHome} aria-label="Return to public home page">
            <img src="/Public/images/logo.svg" alt="Scott Pigs Farm" />
          </button>
          <div className="dashboard-navbar-actions">
            <button type="button" className="dashboard-home-button" onClick={onHome}><Home size={16} /> Home</button>
            <button type="button" className="dashboard-logout-button" onClick={onLogout}><LogOut size={16} /> Logout</button>
          </div>
        </header>
        {/* Top bar (mobile hamburger + page title) */}
        <header className="dashboard-topbar">
          <button
            type="button"
            className="dashboard-hamburger"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="dashboard-navigation"
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="topbar-info">
            <h1 className="dashboard-title">Hello, {user.username || 'Admin'}</h1>
            <p className="dashboard-subtitle">{activeDashboardLabel}</p>
          </div>
        </header>

      <div className="dashboard-content" data-active-page={activeDashboardPage}>

        {user.role === 'owner' && <div id="farm-overview" data-dashboard-page="farm-overview"><DashboardOverview onNavigate={navigateDashboard} /></div>}

        {showSettings && (
          <section id="account-settings" className="dashboard-settings-panel" style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
            <div data-settings-view="account-settings">
            <h2 className="section-title">Account Settings</h2>
            <div className="finance-controls" style={{ backgroundColor: 'transparent', padding: 0, boxShadow: 'none' }}>
              <div className="form-group">
                <label>Current Password <span style={{ color: 'red' }}>*</span></label>
                <input type="password" className="form-input" value={settingsForm.currentPassword} onChange={e => setSettingsForm({ ...settingsForm, currentPassword: e.target.value })} />
              </div>
              <div className="form-group">
                <label>New Username</label>
                <input className="form-input" placeholder={user.username} value={settingsForm.newUsername} onChange={e => setSettingsForm({ ...settingsForm, newUsername: e.target.value })} />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" className="form-input" value={settingsForm.newPassword} onChange={e => setSettingsForm({ ...settingsForm, newPassword: e.target.value })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn-add" onClick={handleUpdateProfile} style={{ marginTop: '0' }}>Update Profile</button>
              </div>
            </div>
            </div>
            {user.role === 'developer' && <div style={{ marginTop: '2rem' }}>
              <div id="user-management" data-settings-view="user-management"><h3>User and Role Management</h3>
              {userError && <div className="error-message" role="alert">{userError}</div>}
              {resetPasswordResult && <div className="success-message" role="status" style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '6px', marginBottom: '1rem' }}><strong>Temporary password for {resetPasswordResult.username}:</strong> <code>{resetPasswordResult.password}</code><p>Copy it now and share it directly with the account holder. They must set a new password at next login.</p><button className="btn-cancel" onClick={() => setResetPasswordResult(null)}>Dismiss</button></div>}
              <div className="finance-controls">
                <div className="form-group"><label htmlFor="new-user-username">Username</label><input id="new-user-username" className="form-input" maxLength={50} value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} /></div>
                <div className="form-group"><label htmlFor="new-user-password">Initial password (12+ characters)</label><input id="new-user-password" type="password" autoComplete="new-password" className="form-input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} /></div>
                <div className="form-group"><label htmlFor="new-user-role">Role</label><select id="new-user-role" className="form-input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as 'developer' | 'owner' })}><option value="owner">Owner</option><option value="developer">Developer</option></select></div>
                <button className="btn-add" onClick={handleCreateUser}>Create Account</button>
              </div>
              <div className="table-container"><table className="data-table"><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Password</th><th>Actions</th></tr></thead><tbody>{users.map(account => <tr key={account.id}><td>{account.username}</td><td><select aria-label={`Role for ${account.username}`} disabled={account.id === user.id} value={account.role} onChange={e => handleUserUpdate(account, { action: 'set_role', role: e.target.value as User['role'] })}><option value="owner">Owner</option><option value="developer">Developer</option></select></td><td>{account.active ? 'Active' : 'Inactive'}</td><td>{account.force_password_change ? 'Change required' : 'Set'}</td><td><button className="action-btn btn-edit-pig" disabled={account.id === user.id} onClick={() => handlePasswordReset(account)}>Issue temporary password</button><button className="action-btn btn-delete-pig" disabled={account.id === user.id} onClick={() => handleUserUpdate(account, { action: 'set_active', active: !account.active })}>{account.active ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody></table></div></div>
              <div id="system-status" data-settings-view="system-status"><h3>System status</h3><p>PHP {systemStatus?.php_version || 'Unavailable'} · Database {systemStatus?.database_connected ? `connected (MySQL ${systemStatus.database_version})` : 'unavailable'}</p></div>
            </div>}
          </section>
        )}

        {user.role === 'owner' && <section id="finance-overview" data-dashboard-page="finance-overview">
          <h2 className="section-title">Financial Performance</h2>
          {financeError && <div className="error-message" role="alert">{financeError}</div>}

          {/* Input Form */}
          <div className="finance-controls" style={{ backgroundColor: '#fff7ed', marginBottom: '2rem' }}>
            <h3 style={{ width: '100%', marginBottom: '1rem' }}>Add/Update Monthly Record</h3>
            <div className="form-group"><label>Month</label><input type="month" className="form-input" value={financeForm.month} onChange={e => setFinanceForm({ ...financeForm, month: e.target.value })} /></div>
            <div className="form-group"><label>Revenue</label><input type="number" className="form-input" placeholder="0" value={financeForm.revenue} onChange={e => setFinanceForm({ ...financeForm, revenue: Number(e.target.value) })} /></div>
            <div className="form-group"><label>Feed Cost</label><input type="number" className="form-input" placeholder="0" value={financeForm.feed_cost} onChange={e => setFinanceForm({ ...financeForm, feed_cost: Number(e.target.value) })} /></div>
            <div className="form-group"><label>Labour Cost</label><input type="number" className="form-input" placeholder="0" value={financeForm.labour_cost} onChange={e => setFinanceForm({ ...financeForm, labour_cost: Number(e.target.value) })} /></div>
            <div className="form-group"><label>Other Cost</label><input type="number" className="form-input" placeholder="0" value={financeForm.other_cost} onChange={e => setFinanceForm({ ...financeForm, other_cost: Number(e.target.value) })} /></div>

            <button className="btn-add" onClick={handleSaveFinance}><Save size={18} /> Save Record</button>
          </div>

          {/* Charts */}
          <div className="charts_container" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', height: '400px' }}>
              <h3>Revenue vs Expenses vs Profit</h3>
              {activeDashboardPage === 'finance-overview' && <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={prepareChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="#10b981" />
                  <Bar dataKey="Expenses" fill="#ef4444" />
                  <Line type="monotone" dataKey="Profit" stroke="#3b82f6" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>}
            </div>
          </div>

          {/* Data Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Revenue</th>
                  <th>Feed</th>
                  <th>Labour</th>
                  <th>Other</th>
                  <th>Total Expenses</th>
                  <th>Net Profit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {monthlyFinances.length === 0 && <tr><td colSpan={8}>No monthly finance records have been saved.</td></tr>}
                {monthlyFinances.map(f => {
                  const totalExpenses = Number(f.feed_cost) + Number(f.labour_cost) + Number(f.other_cost);
                  const netProfit = Number(f.revenue) - totalExpenses;
                  return (
                    <tr key={f.id}>
                      <td>{f.month}</td>
                      <td>{formatCurrency(Number(f.revenue))}</td>
                      <td>{formatCurrency(Number(f.feed_cost))}</td>
                      <td>{formatCurrency(Number(f.labour_cost))}</td>
                      <td>{formatCurrency(Number(f.other_cost))}</td>
                      <td style={{ color: '#ef4444' }}>{formatCurrency(totalExpenses)}</td>
                      <td style={{ fontWeight: 'bold', color: netProfit >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(netProfit)}</td>
                      <td>
                        <button onClick={() => handleDeleteFinance(f.id)} className="action-btn btn-delete-pig"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>}

        {user.role === 'owner' && <>
        <div id="transactions" data-dashboard-page="transactions"><TransactionsSection pigs={pigs} role={user.role} /></div>
        <div id="reports" data-dashboard-page="reports"><ReportsSection role={user.role} /></div>
        <div id="group-records" data-dashboard-page="group-records"><GroupsSection /></div>

        {/* Pig profiles are persisted by the PHP API. */}
        <section id="pig-form" data-dashboard-page="pig-form">
          <h2 className="section-title">Pig Profiles</h2>
          <p>Individual animal records. Sold and deceased pigs remain in the system history.</p>
          {pigError && <div className="error-message" role="alert">{pigError}</div>}

          {editingPigId && <div className="pig-photo-panel">
            <div><h3>Pig photo</h3><p>Upload a JPEG, PNG, or WebP image up to 2 MB.</p></div>
            {pigPhotoUrl ? <img className="pig-photo-preview" src={pigPhotoUrl} alt={`Photo of ${pigs.find(pig => pig.id === editingPigId)?.tag_id || 'pig'}`} /> : <div className="pig-photo-placeholder">{pigPhotoBusy ? 'Saving photo…' : 'No photo added'}</div>}
            <label className="btn-add pig-photo-upload">{pigPhotoBusy ? 'Please wait…' : 'Choose photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePigPhotoUpload} disabled={pigPhotoBusy} /></label>
            {!!pigs.find(pig => pig.id === editingPigId)?.has_photo && <button type="button" className="btn-cancel" onClick={handlePigPhotoDelete} disabled={pigPhotoBusy}>Remove photo</button>}
            {pigPhotoError && <div className="error-message" role="alert">{pigPhotoError}</div>}
          </div>}

          <div className="finance-controls" style={{ backgroundColor: '#fff7ed' }}>
            <div className="form-group"><label htmlFor="pig-tag">Tag / ear ID *</label><input id="pig-tag" className="form-input" maxLength={64} value={pigForm.tag_id || ''} onChange={e => setPigForm({ ...pigForm, tag_id: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="pig-name">Name / alias</label><input id="pig-name" className="form-input" maxLength={100} value={pigForm.name || ''} onChange={e => setPigForm({ ...pigForm, name: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="pig-sex">Sex</label><select id="pig-sex" className="form-input" value={pigForm.sex || 'unknown'} onChange={e => setPigForm({ ...pigForm, sex: e.target.value as PigProfile['sex'] })}><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></div>
            <div className="form-group"><label htmlFor="pig-breed">Breed *</label><input id="pig-breed" className="form-input" maxLength={100} value={pigForm.breed || ''} onChange={e => setPigForm({ ...pigForm, breed: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="pig-birth">Date of birth</label><input id="pig-birth" type="date" className="form-input" value={pigForm.birth_date || ''} onChange={e => setPigForm({ ...pigForm, birth_date: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="pig-status">Lifecycle status</label><select id="pig-status" className="form-input" value={pigForm.lifecycle_status || 'piglet'} onChange={e => setPigForm({ ...pigForm, lifecycle_status: e.target.value })}>{['piglet','weaner','grower','finisher','breeding_gilt','sow','boar','sold','deceased','transferred'].map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></div>
            <div className="form-group"><label htmlFor="pig-source">Source / acquisition</label><input id="pig-source" className="form-input" maxLength={255} value={pigForm.source || ''} onChange={e => setPigForm({ ...pigForm, source: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="pig-acquired">Acquisition date</label><input id="pig-acquired" type="date" className="form-input" value={pigForm.acquired_date || ''} onChange={e => setPigForm({ ...pigForm, acquired_date: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="pig-dam">Dam record ID (optional)</label><input id="pig-dam" type="number" min="1" className="form-input" value={pigForm.dam_id || ''} onChange={e => setPigForm({ ...pigForm, dam_id: e.target.value || null })} /></div>
            <div className="form-group"><label htmlFor="pig-sire">Sire record ID (optional)</label><input id="pig-sire" type="number" min="1" className="form-input" value={pigForm.sire_id || ''} onChange={e => setPigForm({ ...pigForm, sire_id: e.target.value || null })} /></div>
            <div className="form-group"><label htmlFor="pig-litter">Litter record</label><select id="pig-litter" className="form-input" value={pigForm.litter_id || ''} onChange={e => setPigForm({ ...pigForm, litter_id: e.target.value || null })}><option value="">No linked litter</option>{litters.map(litter => <option key={litter.id} value={litter.id}>{litter.litter_code}</option>)}</select></div>
            <div className="form-group"><label htmlFor="pig-herd-group">Independent herd group</label><select id="pig-herd-group" className="form-input" value={pigForm.herd_group_id || ''} onChange={e => setPigForm({ ...pigForm, herd_group_id: e.target.value || null })}><option value="">No linked group</option>{herdGroups.filter(group => group.lifecycle_status === 'active').map(group => <option key={group.id} value={group.id}>{group.group_code} · {group.name}</option>)}</select></div>
            <div className="form-group"><label htmlFor="pig-notes">Notes</label><textarea id="pig-notes" className="form-input" maxLength={5000} value={pigForm.notes || ''} onChange={e => setPigForm({ ...pigForm, notes: e.target.value })} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><input type="checkbox" checked={!!pigForm.birth_date_estimated} onChange={e => setPigForm({ ...pigForm, birth_date_estimated: e.target.checked })} /> Birth date is estimated</label>

            <button className="btn-add" onClick={handleAddOrUpdatePig} style={{ backgroundColor: editingPigId ? 'var(--accent)' : 'var(--primary)' }}>
              {editingPigId ? <Edit2 size={18} /> : <PlusCircle size={18} />}
              {editingPigId ? 'Update Pig' : 'Add Pig'}
            </button>

            {editingPigId && <button className="btn-cancel" onClick={() => { setEditingPigId(null); setPigForm({ ...emptyPigForm }); }}>Cancel</button>}
          </div>

          {pigLoading ? <p role="status">Loading pig records…</p> : pigs.length === 0 ? <p>No pig profiles have been recorded yet.</p> : <div className="pig-grid">
            {pigs.map(pig => (
              <div key={pig.id} className="pig-card">
                <div className="pig-card-header">
                  <div>
                    <div className="pig-breed">{pig.name || pig.tag_id}</div>
                    <div className="pig-dob">{pig.breed} · DOB: {pig.birth_date ? `${pig.birth_date}${pig.birth_date_estimated ? ' (estimated)' : ''} (${calculateAge(pig.birth_date)})` : 'Not recorded'}</div>
                  </div>
                  <div className="pig-count-badge">{pig.lifecycle_status.replace('_', ' ')}</div>
                </div>
                <div className="pig-details">
                  <div className="detail-item"><strong>Tag ID</strong><span>{pig.tag_id}</span></div>
                  <div className="detail-item"><strong>Sex</strong><span>{pig.sex}</span></div>
                  <div className="detail-item"><strong>Dam / Sire</strong><span>{pig.dam_id || '—'} / {pig.sire_id || '—'}</span></div>
                </div>
                <div className="pig-actions">
                  <button onClick={() => handleEditPig(pig)} className="action-btn btn-edit-pig"><Edit2 size={14} /> Edit</button>
                  {(pig.lifecycle_status === 'sold' || pig.lifecycle_status === 'deceased') && <button onClick={() => handleArchivePig(pig)} className="action-btn btn-delete-pig"><Trash2 size={14} /> Archive</button>}
                </div>
              </div>
            ))}
          </div>}
        </section>

        <section id="weight-history" data-dashboard-page="weight-history">
          <h2 className="section-title">Weight History</h2>
          <p>Measurements are stored in kilograms. Historical entries are append-only.</p>
          {weightError && <div className="error-message" role="alert">{weightError}</div>}
          <div className="finance-controls">
            <div className="form-group"><label htmlFor="weight-pig">Pig</label><select id="weight-pig" className="form-input" value={weightForm.pig_id} onChange={e => { setWeightForm({ ...weightForm, pig_id: e.target.value }); setWeightPigId(e.target.value); }}><option value="">Choose a pig</option>{pigs.map(pig => <option key={pig.id} value={pig.id}>{pig.tag_id} · {pig.name || pig.breed}</option>)}</select></div>
            <div className="form-group"><label htmlFor="weight-date">Measured date</label><input id="weight-date" type="date" className="form-input" value={weightForm.measured_at} onChange={e => setWeightForm({ ...weightForm, measured_at: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="weight-kg">Weight (kg)</label><input id="weight-kg" type="number" min="0.001" max="1500" step="0.001" className="form-input" value={weightForm.weight_kg} onChange={e => setWeightForm({ ...weightForm, weight_kg: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="weight-notes">Notes</label><input id="weight-notes" className="form-input" maxLength={1000} value={weightForm.notes} onChange={e => setWeightForm({ ...weightForm, notes: e.target.value })} /></div>
            <button className="btn-add" onClick={handleAddWeight} disabled={pigs.length === 0}>Record Weight</button>
          </div>
          {weightLoading ? <p role="status">Loading weights…</p> : weights.length === 0 ? <p>No weight measurements have been recorded.</p> : <>
            <div style={{ height: '280px', maxWidth: '800px', background: '#fff', padding: '1rem', borderRadius: '8px' }}>
              <h3>Weight trend{chartPigId ? ` · ${pigs.find(pig => pig.id === chartPigId)?.tag_id || ''}` : ''}</h3>
              {pigWeightTrend.length < 2 ? <p>Record at least two measurements for this pig to show a trend.</p> : activeDashboardPage === 'weight-history' ? <ResponsiveContainer width="100%" height={210}><LineChart data={pigWeightTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis unit=" kg" /><Tooltip formatter={value => [`${value} kg`, 'Weight']} /><Line type="monotone" dataKey="weight" stroke="#8B1E1E" strokeWidth={3} /></LineChart></ResponsiveContainer> : null}
            </div>
            <div className="table-container"><table className="data-table"><thead><tr><th>Pig</th><th>Date</th><th>Weight</th><th>Notes</th></tr></thead><tbody>{weights.map(record => <tr key={record.id}><td>{record.tag_id}</td><td>{record.measured_at}</td><td>{record.weight_kg} kg</td><td>{record.notes || '—'}</td></tr>)}</tbody></table></div>
          </>}
          <h3>Litter group weights</h3>
          <p>Record the number of piglets sampled and their average weight for that litter on the measurement date.</p>
          {litterWeightError && <div className="error-message" role="alert">{litterWeightError}</div>}
          <div className="finance-controls">
            <div className="form-group"><label htmlFor="group-weight-litter">Litter group</label><select id="group-weight-litter" className="form-input" value={groupWeightForm.litter_id} onChange={e => setGroupWeightForm({ ...groupWeightForm, litter_id: e.target.value })}><option value="">Choose a litter</option>{litters.map(litter => <option key={litter.id} value={litter.id}>{litter.litter_code}</option>)}</select></div>
            <div className="form-group"><label htmlFor="group-weight-date">Measured date</label><input id="group-weight-date" type="date" className="form-input" value={groupWeightForm.measured_at} onChange={e => setGroupWeightForm({ ...groupWeightForm, measured_at: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="group-weight-sample">Animals sampled</label><input id="group-weight-sample" type="number" min="1" max="1000" step="1" className="form-input" value={groupWeightForm.sample_count} onChange={e => setGroupWeightForm({ ...groupWeightForm, sample_count: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="group-weight-average">Average weight (kg)</label><input id="group-weight-average" type="number" min="0.001" max="999.999" step="0.001" className="form-input" value={groupWeightForm.average_weight_kg} onChange={e => setGroupWeightForm({ ...groupWeightForm, average_weight_kg: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="group-weight-notes">Notes</label><input id="group-weight-notes" className="form-input" maxLength={1000} value={groupWeightForm.notes} onChange={e => setGroupWeightForm({ ...groupWeightForm, notes: e.target.value })} /></div>
            <button className="btn-add" onClick={handleAddGroupWeight} disabled={litters.length === 0}>Record Group Weight</button>
          </div>
          {litterWeightLoading ? <p role="status">Loading litter group weights…</p> : litterWeights.length === 0 ? <p>No group weight measurements have been recorded.</p> : <div className="table-container"><table className="data-table"><thead><tr><th>Litter</th><th>Date</th><th>Animals sampled</th><th>Average weight</th><th>Notes</th></tr></thead><tbody>{litterWeights.map(record => <tr key={record.id}><td>{record.litter_code || record.litter_id}</td><td>{record.measured_at}</td><td>{record.sample_count}</td><td>{record.average_weight_kg} kg</td><td>{record.notes || '—'}</td></tr>)}</tbody></table></div>}
        </section>

        <section id="housing-records" data-dashboard-page="housing-records">
          <h2 className="section-title">Pens and Transfers</h2>
          <p>Occupancy counts active pigs assigned to each pen. Transfers are kept as history.</p>
          {locationError && <div className="error-message" role="alert">{locationError}</div>}
          {user.role === 'owner' && <div className="finance-controls">
            <div className="form-group"><label htmlFor="pen-code">Pen code</label><input id="pen-code" className="form-input" maxLength={64} value={penForm.code} onChange={e => setPenForm({ ...penForm, code: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="pen-name">Pen name</label><input id="pen-name" className="form-input" maxLength={120} value={penForm.name} onChange={e => setPenForm({ ...penForm, name: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="pen-capacity">Capacity (pigs)</label><input id="pen-capacity" type="number" min="1" max="32767" step="1" className="form-input" value={penForm.capacity} onChange={e => setPenForm({ ...penForm, capacity: Number(e.target.value) })} /></div>
            <div className="form-group"><label htmlFor="pen-notes">Notes</label><input id="pen-notes" className="form-input" maxLength={2000} value={penForm.notes} onChange={e => setPenForm({ ...penForm, notes: e.target.value })} /></div>
            {editingPenId && <label><input type="checkbox" checked={penForm.active} onChange={e => setPenForm({ ...penForm, active: e.target.checked })} /> Active</label>}
            <button className="btn-add" onClick={handleCreatePen}>{editingPenId ? 'Update Pen' : 'Add Pen'}</button>
            {editingPenId && <button className="btn-cancel" onClick={() => { setEditingPenId(null); setPenForm({ code: '', name: '', capacity: 1, notes: '', active: true }); }}>Cancel</button>}
          </div>}
          {pens.length === 0 ? <p>No pens have been recorded.</p> : <div className="table-container"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Occupancy / Capacity</th><th>Status</th><th>Action</th></tr></thead><tbody>{pens.map(pen => <tr key={pen.id}><td>{pen.code}</td><td>{pen.name}</td><td>{pen.occupancy} / {pen.capacity}</td><td>{pen.active ? 'Active' : 'Inactive'}</td><td><button className="action-btn btn-edit-pig" onClick={() => { setEditingPenId(pen.id); setPenForm({ code: pen.code, name: pen.name, capacity: pen.capacity, notes: pen.notes || '', active: !!pen.active }); }}>Edit</button></td></tr>)}</tbody></table></div>}
          <h3>Move a pig</h3>
          <div className="finance-controls">
            <div className="form-group"><label htmlFor="transfer-pig">Pig</label><select id="transfer-pig" className="form-input" value={transferForm.pig_id} onChange={e => setTransferForm({ ...transferForm, pig_id: e.target.value })}><option value="">Choose a pig</option>{pigs.filter(pig => !['sold','deceased'].includes(pig.lifecycle_status)).map(pig => <option key={pig.id} value={pig.id}>{pig.tag_id} · {pig.lifecycle_status.replace('_', ' ')}</option>)}</select></div>
            <div className="form-group"><label htmlFor="transfer-to">Destination pen</label><select id="transfer-to" className="form-input" value={transferForm.to_pen_id} onChange={e => setTransferForm({ ...transferForm, to_pen_id: e.target.value })}><option value="">Remove from current pen</option>{pens.filter(pen => !!pen.active).map(pen => <option key={pen.id} value={pen.id}>{pen.code} · {pen.occupancy}/{pen.capacity}</option>)}</select></div>
            <div className="form-group"><label htmlFor="transfer-date">Transfer date</label><input id="transfer-date" type="date" className="form-input" value={transferForm.transferred_on} onChange={e => setTransferForm({ ...transferForm, transferred_on: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="transfer-reason">Reason</label><input id="transfer-reason" className="form-input" maxLength={1000} value={transferForm.reason} onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })} /></div>
            <button className="btn-add" onClick={handlePigTransfer}>Record Transfer</button>
          </div>
          <div className="table-container"><table className="data-table"><thead><tr><th>Pig</th><th>Date</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>{transfers.length === 0 ? <tr><td colSpan={5}>No transfers recorded.</td></tr> : transfers.map(item => <tr key={item.id}><td>{item.tag_id || item.pig_id}</td><td>{item.transferred_on}</td><td>{item.from_pen || 'Unassigned'}</td><td>{item.to_pen || 'Unassigned'}</td><td>{item.reason}</td></tr>)}</tbody></table></div>
        </section>

        <section id="litter-records" data-dashboard-page="litter-records">
          <h2 className="section-title">Litters and Farrowing</h2>
          <p>Expected farrowing dates are estimates based on the mating date and the configured gestation length.</p>
          {litterError && <div className="error-message" role="alert">{litterError}</div>}
          <div className="finance-controls" style={{ backgroundColor: '#f0f9ff' }}>
            <div className="form-group"><label htmlFor="litter-code">Litter code *</label><input id="litter-code" className="form-input" maxLength={64} value={litterForm.litter_code || ''} onChange={e => setLitterForm({ ...litterForm, litter_code: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="litter-dam">Dam pig record ID *</label><input id="litter-dam" type="number" min="1" className="form-input" value={litterForm.dam_id || ''} onChange={e => setLitterForm({ ...litterForm, dam_id: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="litter-sire">Sire pig record ID</label><input id="litter-sire" type="number" min="1" className="form-input" value={litterForm.sire_id || ''} onChange={e => setLitterForm({ ...litterForm, sire_id: e.target.value || null })} /></div>
            <div className="form-group"><label htmlFor="litter-mating">Mating date</label><input id="litter-mating" type="date" className="form-input" value={litterForm.mating_date || ''} onChange={e => setLitterForm({ ...litterForm, mating_date: e.target.value || null })} /></div>
            <div className="form-group"><label htmlFor="litter-expected">Expected farrowing date</label><input id="litter-expected" type="date" className="form-input" value={litterForm.expected_farrowing_date || ''} onChange={e => setLitterForm({ ...litterForm, expected_farrowing_date: e.target.value || null })} /></div>
            <div className="form-group"><label htmlFor="litter-farrowed">Actual farrowing date</label><input id="litter-farrowed" type="date" className="form-input" value={litterForm.farrowing_date || ''} onChange={e => setLitterForm({ ...litterForm, farrowing_date: e.target.value || null })} /></div>
            <div className="form-group"><label htmlFor="litter-total">Total born</label><input id="litter-total" type="number" min="0" step="1" className="form-input" value={litterForm.total_born ?? ''} onChange={e => setLitterForm({ ...litterForm, total_born: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div className="form-group"><label htmlFor="litter-alive">Born alive</label><input id="litter-alive" type="number" min="0" step="1" className="form-input" value={litterForm.born_alive ?? ''} onChange={e => setLitterForm({ ...litterForm, born_alive: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div className="form-group"><label htmlFor="litter-stillborn">Stillborn</label><input id="litter-stillborn" type="number" min="0" step="1" className="form-input" value={litterForm.stillborn ?? ''} onChange={e => setLitterForm({ ...litterForm, stillborn: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div className="form-group"><label htmlFor="litter-fostered">Fostered in</label><input id="litter-fostered" type="number" min="0" step="1" className="form-input" value={litterForm.fostered ?? 0} onChange={e => setLitterForm({ ...litterForm, fostered: Number(e.target.value) })} /></div>
            <div className="form-group"><label htmlFor="litter-weaned">Weaned count</label><input id="litter-weaned" type="number" min="0" step="1" className="form-input" value={litterForm.weaned_count ?? ''} onChange={e => setLitterForm({ ...litterForm, weaned_count: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div className="form-group"><label htmlFor="litter-weaned-date">Weaned date</label><input id="litter-weaned-date" type="date" className="form-input" value={litterForm.weaned_date || ''} onChange={e => setLitterForm({ ...litterForm, weaned_date: e.target.value || null })} /></div>
            <div className="form-group"><label htmlFor="litter-notes">Notes</label><textarea id="litter-notes" className="form-input" maxLength={5000} value={litterForm.notes || ''} onChange={e => setLitterForm({ ...litterForm, notes: e.target.value })} /></div>
            <button className="btn-add" onClick={handleSaveLitter}>{editingLitterId ? 'Update Litter' : 'Save Litter'}</button>
            {editingLitterId && <button className="btn-cancel" onClick={() => { setEditingLitterId(null); setLitterForm({ ...emptyLitterForm }); }}>Cancel</button>}
          </div>
          {litterLoading ? <p role="status">Loading litter records…</p> : litters.length === 0 ? <p>No litter records have been saved yet.</p> : <div className="table-container"><table className="data-table"><thead><tr><th>Code</th><th>Dam</th><th>Sire</th><th>Expected</th><th>Farrowed</th><th>Born alive</th><th>Weaned</th><th>Action</th></tr></thead><tbody>{litters.map(litter => <tr key={litter.id}><td>{litter.litter_code}</td><td>{litter.dam_tag || litter.dam_id}</td><td>{litter.sire_tag || litter.sire_id || '—'}</td><td>{litter.expected_farrowing_date} (estimated)</td><td>{litter.farrowing_date || 'Not recorded'}</td><td>{litter.born_alive ?? '—'}</td><td>{litter.weaned_count ?? '—'}</td><td><button className="action-btn btn-edit-pig" onClick={() => { setLitterForm(litter); setEditingLitterId(litter.id); document.getElementById('litter-code')?.scrollIntoView({ behavior: 'smooth' }); }}>Edit</button></td></tr>)}</tbody></table></div>}
        </section>

        <div id="health-records" data-dashboard-page="health-records"><HealthSection pigs={pigs} litters={litters} /></div>
        <div id="breeding-records" data-dashboard-page="breeding-records"><BreedingSection pigs={pigs} litters={litters} /></div>
        <div id="inventory-records" data-dashboard-page="inventory-records"><InventorySection user={user} /></div>
        </>}

        {/* 3. PRODUCT SECTION (Keep existing) */}
        <section id="website-products" data-dashboard-page="website-products">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Website Product Listings</h2>
            {(user.role === 'owner' || user.role === 'developer') && !showProductForm && (
              <button className="btn-add" onClick={handleAddProductClick}>
                <PlusCircle size={18} /> Add Product
              </button>
            )}
          </div>

          {/* Product Edit Form */}
          {(user.role === 'owner' || user.role === 'developer') && showProductForm && (
            <div className="finance-controls" style={{ backgroundColor: '#f0f9ff', marginBottom: '1rem', border: '1px solid #bae6fd' }}>
              <h3 style={{ width: '100%', marginBottom: '1rem', color: '#0369a1' }}>
                {editingProductId ? 'Edit Product' : 'Add New Product'}
              </h3>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Product Name</label>
                <input className="form-input" value={editProductForm.name || ''} onChange={e => setEditProductForm({ ...editProductForm, name: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Price (KES)</label>
                <input type="number" className="form-input" value={editProductForm.price || ''} onChange={e => setEditProductForm({ ...editProductForm, price: Number(e.target.value) })} />
              </div>

              <div className="form-group">
                <label>Category</label>
                <input className="form-input" value={editProductForm.category || ''} onChange={e => setEditProductForm({ ...editProductForm, category: e.target.value })} />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Image URL</label>
                <input className="form-input" value={editProductForm.image || ''} onChange={e => setEditProductForm({ ...editProductForm, image: e.target.value })} />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Description</label>
                <textarea className="form-input" style={{ height: '80px', fontFamily: 'inherit' }} value={editProductForm.description || ''} onChange={e => setEditProductForm({ ...editProductForm, description: e.target.value })} />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn-add" onClick={handleSaveProduct} style={{ backgroundColor: 'var(--accent)' }}>
                  <Save size={18} /> {editingProductId ? 'Update Product' : 'Save Product'}
                </button>
                <button className="btn-cancel" onClick={() => { setEditingProductId(null); setEditProductForm({}); setShowProductForm(false); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="table-container">
            {/* ... Product Table ... */}
            {/* ... Keep the exact same product table JSX as before ... */}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price (KES)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <img className="product-thumb" src={product.image} alt="" />
                        <div>
                          <div style={{ fontWeight: 500 }}>{product.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>{product.category}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {/* Simplified for brevity, assume similar edit logic */}
                      {formatCurrency(product.price)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {(user.role === 'owner' || user.role === 'developer') && <>
                        <button onClick={() => handleEditProductClick(product)} className="action-btn btn-edit-pig"><Edit2 size={14} /> Edit</button>
                        <button onClick={() => handleDeleteProduct(product.id)} className="action-btn btn-delete-pig" style={{ marginLeft: '0.5rem' }}><Trash2 size={14} /> Delete</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
