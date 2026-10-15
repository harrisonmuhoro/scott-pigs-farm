// Pork/components/AdminDashboard.tsx

import React, { useState, useEffect } from 'react';
import { Product, MonthlyFinance, PigLitter, FinancialMetric } from '../types';
import { Save, Edit2, Trash2, PlusCircle, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';

// import { createClient } from '@supabase/supabase-js'; // UNCOMMENT FOR SQL
import './AdminDashboard.css';

// --- SUPABASE CONFIGURATION ---
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);

import { api } from '../src/services/api';

interface AdminDashboardProps {
  user: { id: string, username: string };
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, products, setProducts }) => {
  // --- State Management ---
  const [finances, setFinances] = useState<FinancialMetric[]>([]); //np Keep existing for backward compat if needed, or remove if replacing
  const [monthlyFinances, setMonthlyFinances] = useState<MonthlyFinance[]>([]);
  const [pigs, setPigs] = useState<PigLitter[]>([]);

  // Form States
  const [financeForm, setFinanceForm] = useState<Partial<MonthlyFinance>>({
    month: '', revenue: 0, feed_cost: 0, labour_cost: 0, other_cost: 0
  });

  // Pig Form State
  const [pigForm, setPigForm] = useState<Partial<PigLitter>>({
    mother: '', father: '', pigletsBorn: 0, color: '', dob: '', breed: ''
  });
  const [editingPigId, setEditingPigId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProductForm, setEditProductForm] = useState<Partial<Product>>({});

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    currentPassword: '',
    newUsername: '',
    newPassword: ''
  });

  // --- SQL INTEGRATION: Fetch Data ---
  useEffect(() => {
    fetchFinances();
    fetchPigs();
  }, []);

  const fetchFinances = async () => {
    try {
      // Fetch new granular data
      const data = await api.getFinances();
      setMonthlyFinances(data);

      // Optional: Update summary cards based on latest month or aggregate
    } catch (error) {
      console.error("Failed to load finances", error);
    }
  };

  const fetchPigs = () => {
    // Mock Data for Pigs
    setPigs([
      { id: '1', mother: 'Sow 102', father: 'Boar 5', pigletsBorn: 12, color: 'Pink', dob: '2023-11-15', breed: 'Large White' },
      { id: '2', mother: 'Sow 105', father: 'Boar 8', pigletsBorn: 9, color: 'Black spot', dob: '2023-12-01', breed: 'Duroc' },
      { id: '3', mother: 'Sow 110', father: 'Boar 5', pigletsBorn: 14, color: 'White', dob: '2024-01-10', breed: 'Landrace' },
    ]);
  };

  // --- Helpers ---
  const formatCurrency = (val: number) => `KES ${val.toLocaleString()}`;

  // Short format for Y-axis (e.g., 450k, 1.2M)
  /*const formatShortCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  }; */

  const calculateAge = (dobString: string) => {
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
      alert("Financial record saved!");
      fetchFinances(); // Refresh
      setFinanceForm({ month: '', revenue: 0, feed_cost: 0, labour_cost: 0, other_cost: 0 });
    } catch (e) {
      console.error(e);
      alert("Failed to save record");
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

  // --- Pig & Product Handlers (Keep existing logic) ---
  const handleAddOrUpdatePig = () => {
    if (!pigForm.breed || !pigForm.dob) {
      alert("Please fill in the required fields (Breed and Date of Birth)");
      return;
    }

    if (editingPigId) {
      // UPDATE LOGIC: Find existing pig and replace data
      setPigs(prev => prev.map(p =>
        p.id === editingPigId ? { ...p, ...pigForm } as PigLitter : p
      ));
      setEditingPigId(null);
      alert("Pig record updated!");
    } else {
      // ADD LOGIC: Create a new record with a unique ID
      const newPig: PigLitter = {
        ...pigForm as PigLitter,
        id: Math.random().toString(36).substr(2, 9), // Temporary unique ID
      };
      setPigs(prev => [...prev, newPig]);
      alert("New pig added to inventory!");
    }

    // Reset the form
    setPigForm({ mother: '', father: '', pigletsBorn: 0, color: '', dob: '', breed: '' });
  };

  const handleDeletePig = (id: string) => {
    if (window.confirm("Are you sure you want to delete this pig record?")) {
      setPigs(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleEditPig = (pig: PigLitter) => {
    setPigForm(pig);
    setEditingPigId(pig.id!);
    // Scroll to form
    const formElement = document.getElementById('pig-form');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
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
        user.id,
        settingsForm.currentPassword,
        settingsForm.newUsername,
        settingsForm.newPassword
      );
      alert(res.message);
      setSettingsForm({ currentPassword: '', newUsername: '', newPassword: '' });
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">

        <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title"> Hello {user.username || 'Admin'}</h1>
            <p className="dashboard-subtitle">Financial Overview & Inventory Management</p>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="btn-add" style={{ width: 'auto' }}>
            {showSettings ? 'Hide Settings' : 'Settings'}
          </button>
        </header>

        {showSettings && (
          <section style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
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
          </section>
        )}

        <section>
          <h2 className="section-title">Financial Performance</h2>

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
          <div className="charts_container" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem', height: '400px' }}>
            <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3>Revenue vs Expenses vs Profit</h3>
              <ResponsiveContainer width="100%" height="100%">
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
              </ResponsiveContainer>
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
        </section>

        {/* 2. PIG INVENTORY SECTION (Keep existing) */}
        <section id="pig-form">
          <h2 className="section-title">Pig Inventory (Available)</h2>

          <div className="finance-controls" style={{ backgroundColor: '#fff7ed' }}>
            <div className="form-group"><label>Mother ID</label><input className="form-input" value={pigForm.mother} onChange={e => setPigForm({ ...pigForm, mother: e.target.value })} /></div>
            <div className="form-group"><label>Father ID</label><input className="form-input" value={pigForm.father} onChange={e => setPigForm({ ...pigForm, father: e.target.value })} /></div>
            <div className="form-group"><label>Born</label><input type="number" className="form-input" value={pigForm.pigletsBorn} onChange={e => setPigForm({ ...pigForm, pigletsBorn: Number(e.target.value) })} /></div>
            <div className="form-group"><label>DOB</label><input type="date" className="form-input" value={pigForm.dob} onChange={e => setPigForm({ ...pigForm, dob: e.target.value })} /></div>
            <div className="form-group"><label>Breed</label><input className="form-input" value={pigForm.breed} onChange={e => setPigForm({ ...pigForm, breed: e.target.value })} /></div>

            <button className="btn-add" onClick={handleAddOrUpdatePig} style={{ backgroundColor: editingPigId ? 'var(--accent)' : 'var(--primary)' }}>
              {editingPigId ? <Edit2 size={18} /> : <PlusCircle size={18} />}
              {editingPigId ? 'Update Pig' : 'Add Pig'}
            </button>

            {editingPigId && <button className="btn-cancel" onClick={() => { setEditingPigId(null); setPigForm({ mother: '', father: '', pigletsBorn: 0, color: '', dob: '', breed: '' }); }}>Cancel</button>}
          </div>

          <div className="pig-grid">
            {pigs.map(pig => (
              <div key={pig.id} className="pig-card">
                <div className="pig-card-header">
                  <div>
                    <div className="pig-breed">{pig.breed}</div>
                    <div className="pig-dob">DOB: {pig.dob} ({calculateAge(pig.dob)})</div>
                  </div>
                  <div className="pig-count-badge">{pig.pigletsBorn} Piglets</div>
                </div>
                <div className="pig-details">
                  <div className="detail-item"><strong>Mother</strong><span>{pig.mother}</span></div>
                  <div className="detail-item"><strong>Father</strong><span>{pig.father}</span></div>
                  <div className="detail-item"><strong>Color</strong><span>{pig.color}</span></div>
                </div>
                <div className="pig-actions">
                  <button onClick={() => handleEditPig(pig)} className="action-btn btn-edit-pig"><Edit2 size={14} /> Edit</button>
                  <button onClick={() => handleDeletePig(pig.id!)} className="action-btn btn-delete-pig"><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. PRODUCT SECTION (Keep existing) */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Website Product Listings</h2>
            {!showProductForm && (
              <button className="btn-add" onClick={handleAddProductClick}>
                <PlusCircle size={18} /> Add Product
              </button>
            )}
          </div>

          {/* Product Edit Form */}
          {showProductForm && (
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
                      <button onClick={() => handleEditProductClick(product)} className="action-btn btn-edit-pig"><Edit2 size={14} /> Edit</button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="action-btn btn-delete-pig" style={{ marginLeft: '0.5rem' }}><Trash2 size={14} /> Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>

    </div>
  );
};

export default AdminDashboard;