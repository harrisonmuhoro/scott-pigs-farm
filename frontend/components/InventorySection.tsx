import React, { useEffect, useState } from 'react';
import { InventoryAlerts, InventoryItem, PurchaseRecord, StockMovement, SupplierRecord, User } from '../types';
import { api } from '../src/services/api';

const uuid = () => crypto.randomUUID();
const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export default function InventorySection({ user }: { user: User }) {
  const canManage = user.role === 'owner';
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlerts>({ low_stock: [], expiry: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [itemForm, setItemForm] = useState({ sku: '', name: '', category: 'feed', unit: 'kg', brand: '', description: '', reorder_threshold: '0', preferred_supplier_id: '', track_batches: false });
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_name: '', phone: '', email: '', notes: '' });
  const [purchaseForm, setPurchaseForm] = useState({ request_key: uuid(), supplier_id: '', invoice_reference: '', purchase_date: today(), received_date: today(), amount_paid: '0', payment_status: 'unpaid', payment_method: '', notes: '' });
  const emptyLine = () => ({ item_id: '', quantity: '', unit_cost: '', batch_lot: '', expiry_date: '' });
  const [lines, setLines] = useState([emptyLine()]);
  const [movementForm, setMovementForm] = useState({ request_key: uuid(), item_id: '', movement_type: 'usage', quantity: '', direction: 'negative', batch_lot: '', expiry_date: '', movement_date: today(), reason: '', notes: '', unit_cost: '' });

  const refresh = async () => {
    setError('');
    try {
      const [itemRows, supplierRows, movementRows, alertRows, purchaseRows] = await Promise.all([
        api.getInventoryItems(), api.getSuppliers(), api.getStockMovements(), api.getInventoryAlerts(), canManage ? api.getPurchases() : Promise.resolve([]),
      ]);
      setItems(itemRows); setSuppliers(supplierRows); setMovements(movementRows); setAlerts(alertRows); setPurchases(purchaseRows);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load inventory'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [canManage]);

  const createItem = async () => {
    try {
      await api.createInventoryItem({ ...itemForm, preferred_supplier_id: itemForm.preferred_supplier_id || null });
      setItemForm({ sku: '', name: '', category: 'feed', unit: 'kg', brand: '', description: '', reorder_threshold: '0', preferred_supplier_id: '', track_batches: false });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create item'); }
  };
  const createSupplier = async () => {
    try { await api.createSupplier(supplierForm); setSupplierForm({ name: '', contact_name: '', phone: '', email: '', notes: '' }); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create supplier'); }
  };
  const receive = async () => {
    try {
      await api.receivePurchase({ ...purchaseForm, supplier_id: purchaseForm.supplier_id || null, payment_method: purchaseForm.payment_method || null, lines });
      setPurchaseForm(current => ({ ...current, request_key: uuid(), invoice_reference: '', notes: '', purchase_date: today(), received_date: today(), amount_paid: '0', payment_status: 'unpaid', payment_method: '' }));
      setLines([emptyLine()]); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not receive purchase'); }
  };
  const moveStock = async () => {
    try {
      await api.createStockMovement({ ...movementForm, expiry_date: movementForm.expiry_date || null, unit_cost: movementForm.unit_cost || null });
      setMovementForm(current => ({ ...current, request_key: uuid(), quantity: '', batch_lot: '', expiry_date: '', reason: '', notes: '', unit_cost: '', movement_date: today() }));
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not record stock movement'); }
  };
  const toggleItem = async (item: InventoryItem) => {
    try { await api.setInventoryItemActive(item.id, !item.active); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update item'); }
  };

  return <section>
    <h2 className="section-title">Farm Inventory and Procurement</h2>
    <p>On-hand stock is calculated from the signed movement ledger. Website catalog listings are managed separately.</p>
    {error && <div className="error-message" role="alert">{error}</div>}
    {loading ? <p role="status">Loading inventory…</p> : <>
      <h3>Stock alerts</h3>
      {alerts.low_stock.length === 0 && alerts.expiry.length === 0 ? <p>No low-stock or expiry alerts.</p> : <div className="table-container"><table className="data-table"><thead><tr><th>Item</th><th>Alert</th><th>Batch</th><th>Quantity</th><th>Date / threshold</th></tr></thead><tbody>{alerts.low_stock.map(alert => <tr key={`low-${alert.id}`}><td>{alert.name} ({alert.sku})</td><td>Low stock</td><td>—</td><td>{alert.on_hand} {alert.unit}</td><td>Reorder at {alert.reorder_threshold}</td></tr>)}{alerts.expiry.map((alert, index) => <tr key={`expiry-${alert.item_id}-${alert.batch_lot}-${index}`}><td>{alert.name} ({alert.sku})</td><td>{alert.status}</td><td>{alert.batch_lot || '—'}</td><td>{alert.on_hand} {alert.unit}</td><td>{alert.expiry_date}</td></tr>)}</tbody></table></div>}

      {canManage && <>
        <h3>Suppliers</h3>
        <div className="finance-controls">
          <div className="form-group"><label htmlFor="supplier-name">Supplier name</label><input id="supplier-name" className="form-input" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="supplier-contact">Contact name</label><input id="supplier-contact" className="form-input" value={supplierForm.contact_name} onChange={e => setSupplierForm({ ...supplierForm, contact_name: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="supplier-phone">Phone</label><input id="supplier-phone" className="form-input" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="supplier-email">Email</label><input id="supplier-email" type="email" className="form-input" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} /></div>
          <button className="btn-add" onClick={createSupplier}>Add Supplier</button>
        </div>

        <h3>Inventory items</h3>
        <div className="finance-controls">
          <div className="form-group"><label htmlFor="item-sku">SKU / code</label><input id="item-sku" className="form-input" value={itemForm.sku} onChange={e => setItemForm({ ...itemForm, sku: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="item-name">Item name</label><input id="item-name" className="form-input" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="item-category">Category</label><select id="item-category" className="form-input" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>{['feed','medicine_vaccine','supplement','equipment','consumable','other'].map(category => <option key={category} value={category}>{category.replace('_', ' ')}</option>)}</select></div>
          <div className="form-group"><label htmlFor="item-unit">Unit of measure</label><input id="item-unit" className="form-input" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="item-brand">Brand</label><input id="item-brand" className="form-input" value={itemForm.brand} onChange={e => setItemForm({ ...itemForm, brand: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="item-threshold">Reorder threshold</label><input id="item-threshold" type="number" min="0" step="0.001" className="form-input" value={itemForm.reorder_threshold} onChange={e => setItemForm({ ...itemForm, reorder_threshold: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="item-supplier">Preferred supplier</label><select id="item-supplier" className="form-input" value={itemForm.preferred_supplier_id} onChange={e => setItemForm({ ...itemForm, preferred_supplier_id: e.target.value })}><option value="">None</option>{suppliers.filter(supplier => !!supplier.active).map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <label><input type="checkbox" checked={itemForm.track_batches} onChange={e => setItemForm({ ...itemForm, track_batches: e.target.checked })} /> Track batch / lot and expiry</label>
          <button className="btn-add" onClick={createItem}>Add Item</button>
        </div>
      </>}

      <h3>Current stock</h3>
      <div className="table-container"><table className="data-table"><thead><tr><th>SKU</th><th>Item</th><th>Category</th><th>On hand</th><th>Reorder</th>{canManage && <th>Ledger valuation*</th>}{canManage && <th>Status</th>}</tr></thead><tbody>{items.length === 0 ? <tr><td colSpan={canManage ? 7 : 5}>No inventory items recorded.</td></tr> : items.map(item => <tr key={item.id}><td>{item.sku}</td><td>{item.name} · {item.unit}{item.track_batches ? ' · batch tracked' : ''}</td><td>{item.category.replace('_', ' ')}</td><td>{item.on_hand}</td><td>{item.reorder_threshold}</td>{canManage && <td>{item.stock_value ?? '—'}</td>}{canManage && <td><button className="action-btn btn-edit-pig" onClick={() => toggleItem(item)}>{item.active ? 'Discontinue' : 'Reactivate'}</button></td>}</tr>)}</tbody></table></div>
      {canManage && <p>* Valuation is based on recorded movement costs; stock without a recorded cost basis is not fully valued.</p>}

      {canManage && <>
        <h3>Receive a purchase</h3>
        <div className="finance-controls">
          <div className="form-group"><label htmlFor="purchase-supplier">Supplier</label><select id="purchase-supplier" className="form-input" value={purchaseForm.supplier_id} onChange={e => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}><option value="">Not recorded</option>{suppliers.filter(supplier => !!supplier.active).map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <div className="form-group"><label htmlFor="purchase-reference">Invoice / reference</label><input id="purchase-reference" className="form-input" value={purchaseForm.invoice_reference} onChange={e => setPurchaseForm({ ...purchaseForm, invoice_reference: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="purchase-date">Purchase date</label><input id="purchase-date" type="date" className="form-input" value={purchaseForm.purchase_date} onChange={e => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="received-date">Received date</label><input id="received-date" type="date" className="form-input" value={purchaseForm.received_date} onChange={e => setPurchaseForm({ ...purchaseForm, received_date: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="purchase-paid">Amount paid (KES)</label><input id="purchase-paid" type="number" min="0" step="0.01" className="form-input" value={purchaseForm.amount_paid} onChange={e => setPurchaseForm({ ...purchaseForm, amount_paid: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="purchase-status">Payment status</label><select id="purchase-status" className="form-input" value={purchaseForm.payment_status} onChange={e => setPurchaseForm({ ...purchaseForm, payment_status: e.target.value })}><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option></select></div>
          <div className="form-group"><label htmlFor="purchase-method">Payment method</label><select id="purchase-method" className="form-input" value={purchaseForm.payment_method} onChange={e => setPurchaseForm({ ...purchaseForm, payment_method: e.target.value })}><option value="">Not recorded</option>{['cash','mobile_money','bank','credit','other'].map(method => <option key={method} value={method}>{method.replace('_', ' ')}</option>)}</select></div>
          {lines.map((line, index) => <React.Fragment key={index}>
            <div className="form-group"><label>Item</label><select className="form-input" value={line.item_id} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, item_id: e.target.value } : row))}><option value="">Choose an item</option>{items.filter(item => !!item.active).map(item => <option key={item.id} value={item.id}>{item.sku} · {item.name} ({item.unit})</option>)}</select></div>
            <div className="form-group"><label>Quantity</label><input type="number" min="0.001" step="0.001" className="form-input" value={line.quantity} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} /></div>
            <div className="form-group"><label>Unit cost (KES)</label><input type="number" min="0" step="0.01" className="form-input" value={line.unit_cost} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, unit_cost: e.target.value } : row))} /></div>
            <div className="form-group"><label>Batch / lot</label><input className="form-input" value={line.batch_lot} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, batch_lot: e.target.value } : row))} /></div>
            <div className="form-group"><label>Expiry date</label><input type="date" className="form-input" value={line.expiry_date} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, expiry_date: e.target.value } : row))} /></div>
          </React.Fragment>)}
          <button type="button" className="btn-cancel" onClick={() => setLines(current => [...current, emptyLine()])}>Add purchase line</button>
          <button className="btn-add" onClick={receive}>Receive Stock</button>
        </div>
        <p>Receipt posts purchase lines and stock movements together. The same request key prevents duplicate receipt on retry.</p>
        <h3>Recent purchases</h3>
        <div className="table-container"><table className="data-table"><thead><tr><th>Date received</th><th>Supplier</th><th>Invoice</th><th>Lines</th><th>Total purchase cost (KES)</th></tr></thead><tbody>{purchases.length === 0 ? <tr><td colSpan={5}>No purchases received.</td></tr> : purchases.map(purchase => <tr key={purchase.id}><td>{purchase.received_date}</td><td>{purchase.supplier || '—'}</td><td>{purchase.invoice_reference || '—'}</td><td>{purchase.line_count}</td><td>{purchase.total_cost}</td></tr>)}</tbody></table></div>
      </>}

      <h3>Record stock usage, wastage, return, or adjustment</h3>
      <div className="finance-controls">
        <div className="form-group"><label htmlFor="movement-item">Item</label><select id="movement-item" className="form-input" value={movementForm.item_id} onChange={e => setMovementForm({ ...movementForm, item_id: e.target.value })}><option value="">Choose an item</option>{items.filter(item => !!item.active).map(item => <option key={item.id} value={item.id}>{item.sku} · {item.name} ({item.unit})</option>)}</select></div>
        <div className="form-group"><label htmlFor="movement-type">Movement type</label><select id="movement-type" className="form-input" value={movementForm.movement_type} onChange={e => setMovementForm({ ...movementForm, movement_type: e.target.value })}><option value="usage">Usage</option><option value="wastage">Wastage</option><option value="return">Return</option>{canManage && <option value="adjustment">Adjustment</option>}</select></div>
        {movementForm.movement_type === 'adjustment' && <div className="form-group"><label htmlFor="adjust-direction">Adjustment direction</label><select id="adjust-direction" className="form-input" value={movementForm.direction} onChange={e => setMovementForm({ ...movementForm, direction: e.target.value })}><option value="negative">Negative</option><option value="positive">Positive</option></select></div>}
        <div className="form-group"><label htmlFor="movement-quantity">Quantity</label><input id="movement-quantity" type="number" min="0.001" step="0.001" className="form-input" value={movementForm.quantity} onChange={e => setMovementForm({ ...movementForm, quantity: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="movement-lot">Batch / lot (required for tracked items)</label><input id="movement-lot" className="form-input" value={movementForm.batch_lot} onChange={e => setMovementForm({ ...movementForm, batch_lot: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="movement-date">Movement date</label><input id="movement-date" type="date" className="form-input" value={movementForm.movement_date} onChange={e => setMovementForm({ ...movementForm, movement_date: e.target.value })} /></div>
        {(movementForm.movement_type === 'return' || (movementForm.movement_type === 'adjustment' && movementForm.direction === 'positive')) && <div className="form-group"><label htmlFor="movement-cost">Unit cost (KES, if no prior cost basis)</label><input id="movement-cost" type="number" min="0" step="0.01" className="form-input" value={movementForm.unit_cost} onChange={e => setMovementForm({ ...movementForm, unit_cost: e.target.value })} /></div>}
        <div className="form-group"><label htmlFor="movement-reason">Reason</label><input id="movement-reason" className="form-input" maxLength={1000} value={movementForm.reason} onChange={e => setMovementForm({ ...movementForm, reason: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="movement-notes">Notes</label><input id="movement-notes" className="form-input" maxLength={3000} value={movementForm.notes} onChange={e => setMovementForm({ ...movementForm, notes: e.target.value })} /></div>
        <button className="btn-add" onClick={moveStock}>Record Movement</button>
      </div>
      <div className="table-container"><table className="data-table"><thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Quantity delta</th><th>Batch</th><th>Reason</th></tr></thead><tbody>{movements.length === 0 ? <tr><td colSpan={6}>No stock movements recorded.</td></tr> : movements.map(move => <tr key={move.id}><td>{move.movement_date}</td><td>{move.sku} · {move.item_name}</td><td>{move.movement_type}</td><td>{move.quantity_delta} {move.unit}</td><td>{move.batch_lot || '—'}</td><td>{move.reason || '—'}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
