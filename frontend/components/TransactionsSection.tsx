import React, { useEffect, useState } from 'react';
import { FinancialTransaction, PigProfile, SaleRecord } from '../types';
import { api } from '../src/services/api';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const key = () => crypto.randomUUID();

export default function TransactionsSection({ pigs, role }: { pigs: PigProfile[]; role: 'developer' | 'owner' }) {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [outstanding, setOutstanding] = useState<FinancialTransaction[]>([]);
  const [payments, setPayments] = useState<import('../types').FinancePayment[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [entry, setEntry] = useState({ transaction_type: 'expense', transaction_date: today(), category: '', amount: '', amount_paid: '0', payment_status: 'unpaid', payment_method: '', counterparty: '', reference: '' });
  const [sale, setSale] = useState({ sale_date: today(), pig_id: '', description: '', unit_price: '', customer: '', amount_paid: '0', payment_status: 'unpaid', payment_method: '' });
  const [payment, setPayment] = useState({ transaction_id: '', payment_date: today(), amount: '', payment_method: 'cash', reference: '' });
  const refresh = async () => {
    setBusy(true); setError('');
    try {
      const [tx, saleRows, pending, paymentRows] = await Promise.all([api.getTransactions(), api.getSales(), api.getOutstandingTransactions(), api.getFinancePayments()]);
      setTransactions(tx); setSales(saleRows); setOutstanding(pending); setPayments(paymentRows);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load transactions'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, [role]);
  const submitEntry = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      await api.createTransaction({ ...entry, request_key: key(), accounting_class: entry.transaction_type === 'income' ? 'other_income' : 'operating_expense', payment_method: entry.payment_method || null, counterparty: entry.counterparty || null, reference: entry.reference || null });
      setEntry({ ...entry, category: '', amount: '', amount_paid: '0', payment_status: 'unpaid', payment_method: '', counterparty: '', reference: '' }); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save transaction'); }
  };
  const submitSale = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const pig = pigs.find(row => row.id === sale.pig_id);
    try {
      await api.createSale({ request_key: key(), sale_date: sale.sale_date, customer: sale.customer || null, amount_paid: sale.amount_paid, payment_status: sale.payment_status, payment_method: sale.payment_method || null, lines: [{ pig_id: pig?.id || null, description: pig ? `Live pig ${pig.tag_id}` : sale.description, quantity: '1', unit_price: sale.unit_price }] });
      setSale({ ...sale, pig_id: '', description: '', unit_price: '', customer: '', amount_paid: '0', payment_status: 'unpaid', payment_method: '' }); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record sale'); }
  };
  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      await api.recordFinancePayment({ ...payment, request_key: key() });
      setPayment({ ...payment, amount: '', reference: '' }); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record payment'); }
  };
  const selectedOutstanding = outstanding.find(row => row.id === payment.transaction_id);
  return <section>
    <h2 className="section-title">Sales and transactions</h2>
    <p>Sale totals are calculated by the server. Live pig sales update the pig lifecycle and remain in its history. Website catalog inquiries are not recorded as sales.</p>
    {error && <div className="error-message" role="alert">{error}</div>}
    {role === 'owner' && <form className="finance-controls" onSubmit={submitEntry} style={{ background: '#fff7ed' }}>
      <h3 style={{ width: '100%' }}>Record income or expense</h3>
      <label>Type<select className="form-input" value={entry.transaction_type} onChange={e => setEntry({ ...entry, transaction_type: e.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select></label>
      <label>Date<input required type="date" className="form-input" max={today()} value={entry.transaction_date} onChange={e => setEntry({ ...entry, transaction_date: e.target.value })}/></label>
      <label>Category<input required maxLength={100} className="form-input" value={entry.category} onChange={e => setEntry({ ...entry, category: e.target.value })}/></label>
      <label>Amount (KES)<input required type="number" min="0.01" step="0.01" className="form-input" value={entry.amount} onChange={e => setEntry({ ...entry, amount: e.target.value })}/></label>
      <label>Paid so far<input required type="number" min="0" step="0.01" className="form-input" value={entry.amount_paid} onChange={e => { const amountPaid=e.target.value; setEntry({...entry,amount_paid:amountPaid,payment_status:Number(amountPaid)===0?'unpaid':Number(amountPaid)>=Number(entry.amount)?'paid':'partial'}); }}/></label>
      <label>Payment method<select className="form-input" value={entry.payment_method} onChange={e => setEntry({...entry,payment_method:e.target.value})}><option value="">None</option>{['cash','mobile_money','bank','credit','other'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Counterparty<input maxLength={180} className="form-input" value={entry.counterparty} onChange={e => setEntry({...entry,counterparty:e.target.value})}/></label>
      <button className="btn-add" type="submit">Save transaction</button>
    </form>}
    {role === 'owner' && <form className="finance-controls" onSubmit={submitSale} style={{ background: '#f0fdf4' }}>
      <h3 style={{ width: '100%' }}>Record a sale</h3>
      <label>Date<input required type="date" max={today()} className="form-input" value={sale.sale_date} onChange={e=>setSale({...sale,sale_date:e.target.value})}/></label>
      <label>Live pig (optional)<select className="form-input" value={sale.pig_id} onChange={e=>setSale({...sale,pig_id:e.target.value})}><option value="">Other item or service</option>{pigs.filter(p=>!['sold','deceased'].includes(p.lifecycle_status)).map(p=><option key={p.id} value={p.id}>{p.tag_id}</option>)}</select></label>
      {!sale.pig_id && <label>Description<input required maxLength={255} className="form-input" value={sale.description} onChange={e=>setSale({...sale,description:e.target.value})}/></label>}
      <label>Unit price (KES)<input required type="number" min="0.01" step="0.01" className="form-input" value={sale.unit_price} onChange={e=>setSale({...sale,unit_price:e.target.value})}/></label>
      <label>Customer<input maxLength={180} className="form-input" value={sale.customer} onChange={e=>setSale({...sale,customer:e.target.value})}/></label>
      <label>Amount paid<input required type="number" min="0" step="0.01" className="form-input" value={sale.amount_paid} onChange={e=>setSale({...sale,amount_paid:e.target.value})}/></label>
      <label>Payment method<select className="form-input" value={sale.payment_method} onChange={e=>setSale({...sale,payment_method:e.target.value})}><option value="">None</option>{['cash','mobile_money','bank','credit','other'].map(x=><option key={x}>{x}</option>)}</select></label>
      <button className="btn-add" type="submit">Save sale</button>
    </form>}
    {busy ? <p role="status">Loading financial records…</p> : <>
      <h3>Sales</h3><div className="table-container"><table className="data-table"><thead><tr><th>Date</th><th>Customer</th><th>Lines</th><th>Total (KES)</th><th>Paid</th><th>Status</th></tr></thead><tbody>{sales.length===0?<tr><td colSpan={6}>No sales recorded.</td></tr>:sales.map(s=><tr key={s.id}><td>{s.sale_date}</td><td>{s.customer||'—'}</td><td>{s.line_count}</td><td>{s.total}</td><td>{s.amount_paid}</td><td>{s.payment_status}</td></tr>)}</tbody></table></div>
      {role==='owner' && <><h3>Manual income and expenses</h3><div className="table-container"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount (KES)</th><th>Paid</th><th>Status</th></tr></thead><tbody>{transactions.length===0?<tr><td colSpan={6}>No transaction records.</td></tr>:transactions.map(t=><tr key={t.id}><td>{t.transaction_date}</td><td>{t.transaction_type}</td><td>{t.category}</td><td>{t.amount}</td><td>{t.amount_paid}</td><td>{t.payment_status}</td></tr>)}</tbody></table></div>
        <h3>Record a payment against an outstanding transaction</h3>
        {outstanding.length===0 ? <p>No outstanding transactions.</p> : <form className="finance-controls" onSubmit={submitPayment}>
          <label>Transaction<select required className="form-input" value={payment.transaction_id} onChange={e=>setPayment({...payment,transaction_id:e.target.value})}><option value="">Choose transaction</option>{outstanding.map(t=><option key={t.id} value={t.id}>{t.transaction_date} · {t.transaction_type} · {t.category} · due KES {(Number(t.amount)-Number(t.amount_paid)).toFixed(2)}</option>)}</select></label>
          <label>Payment date<input required type="date" max={today()} className="form-input" value={payment.payment_date} onChange={e=>setPayment({...payment,payment_date:e.target.value})}/></label>
          <label>Amount (KES)<input required type="number" min="0.01" step="0.01" max={selectedOutstanding ? (Number(selectedOutstanding.amount)-Number(selectedOutstanding.amount_paid)).toFixed(2) : undefined} className="form-input" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})}/></label>
          <label>Method<select className="form-input" value={payment.payment_method} onChange={e=>setPayment({...payment,payment_method:e.target.value})}>{['cash','mobile_money','bank','credit','other'].map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Reference<input maxLength={120} className="form-input" value={payment.reference} onChange={e=>setPayment({...payment,reference:e.target.value})}/></label>
          <button className="btn-add" type="submit">Record payment</button>
        </form>}
        <h3>Recent payments</h3><div className="table-container"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Counterparty</th><th>Amount (KES)</th><th>Method</th><th>Reference</th></tr></thead><tbody>{payments.length===0?<tr><td colSpan={7}>No payments recorded.</td></tr>:payments.map(p=><tr key={p.id}><td>{p.payment_date}</td><td>{p.transaction_type}</td><td>{p.category}</td><td>{p.counterparty||'—'}</td><td>{p.amount}</td><td>{p.payment_method}</td><td>{p.reference||'—'}</td></tr>)}</tbody></table></div>
      </>}
    </>}
  </section>;
}
