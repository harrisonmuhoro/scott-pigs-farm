import React, { useState } from 'react';
import { api } from '../src/services/api';

const todayInFarmZone = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const startOfMonth = () => `${todayInFarmZone().slice(0, 7)}-01`;
const options = [
  ['herd', 'Herd and lifecycle'], ['litters', 'Litters and farrowing'], ['weights', 'Weight history'],
  ['health', 'Health and follow-up'], ['stock', 'Stock movements'], ['purchases', 'Purchases'],
  ['sales', 'Sales'], ['finance', 'Finance transactions (owner only)'],
];

export default function ReportsSection({ role }: { role: 'developer' | 'owner' }) {
  const [report, setReport] = useState(role === 'owner' ? 'finance' : 'herd');
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayInFarmZone());
  const [busy, setBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [error, setError] = useState('');
  if (role !== 'owner') return null;
  const exportReport = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await api.downloadReport(report, from, to); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not export report'); }
    finally { setBusy(false); }
  };
  const exportExcel = async () => {
    setError(''); setBusy(true);
    try { await api.downloadReport(report, from, to, 'xlsx'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not export Excel report'); }
    finally { setBusy(false); }
  };
  const printReport = () => {
    setError(''); setPrintBusy(true);
    try {
      const reportWindow = api.openPrintableReport(report, from, to);
      if (!reportWindow) setError('Allow pop-ups for this site to open the print-ready report.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open print-ready report'); }
    finally { setPrintBusy(false); }
  };
  return <section>
    <h2 className="section-title">Reports and exports</h2>
    <p>Exports use saved records. Download CSV or an Excel workbook, or print the filtered report to PDF. Date filters use each report’s event or transaction date; exports are limited to 10,000 rows.</p>
    {error && <div className="error-message" role="alert">{error}</div>}
    <form className="finance-controls" onSubmit={exportReport}>
      <label>Report<select className="form-input" value={report} onChange={e=>setReport(e.target.value)}>{options.filter(([value])=>value!=='finance'||role==='owner').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>From<input required type="date" className="form-input" max={to} value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>To<input required type="date" className="form-input" min={from} max={todayInFarmZone()} value={to} onChange={e=>setTo(e.target.value)}/></label>
      <button className="btn-add" type="submit" disabled={busy||printBusy||!from||!to||from>to}>{busy?'Preparing…':'Download CSV'}</button>
      <button className="btn-cancel" type="button" onClick={exportExcel} disabled={busy||printBusy||!from||!to||from>to}>{busy?'Preparing…':'Download XLSX'}</button>
      <button className="btn-cancel" type="button" onClick={printReport} disabled={busy||printBusy||!from||!to||from>to}>{printBusy?'Opening report…':'Print / Save as PDF'}</button>
    </form>
  </section>;
}
