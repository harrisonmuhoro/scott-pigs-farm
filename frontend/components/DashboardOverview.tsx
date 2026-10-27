import React, { useEffect, useState } from 'react';
import { Activity, Baby, CalendarClock, CircleAlert, HeartPulse, Package, PiggyBank, TrendingUp, Weight } from 'lucide-react';
import { api } from '../src/services/api';
import { DashboardSummary } from '../types';
import './DashboardOverview.css';

type Props = { onNavigate: (page: string) => void };

const formatMoney = (amount: string | number) => `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DashboardOverview({ onNavigate }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getDashboardSummary()
      .then(data => { if (active) setSummary(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load farm overview'); });
    return () => { active = false; };
  }, []);

  const metrics = summary ? [
    { label: 'Active herd', value: summary.active_herd, detail: 'Current pigs on the farm', icon: PiggyBank, page: 'pig-form', tone: 'green' },
    { label: 'Born this year', value: summary.births_this_year, detail: 'Live births recorded', icon: Baby, page: 'litter-records', tone: 'blue' },
    { label: 'Weaned this year', value: summary.weaned_this_year, detail: 'Piglets recorded as weaned', icon: Weight, page: 'litter-records', tone: 'violet' },
    { label: 'Farrowing due soon', value: summary.farrowing_next_30_days, detail: `${summary.farrowing_overdue} overdue · next 30 days`, icon: CalendarClock, page: 'litter-records', tone: 'amber' },
    { label: 'Health follow-ups', value: summary.open_health_tasks, detail: 'Open and due within 30 days', icon: HeartPulse, page: 'health-records', tone: 'rose' },
    { label: 'Vaccinations due', value: summary.due_vaccinations, detail: 'Active schedules due within 30 days', icon: Activity, page: 'health-records', tone: 'blue' },
    { label: 'Low-stock items', value: summary.low_stock_items, detail: 'At or below reorder threshold', icon: Package, page: 'inventory-records', tone: 'amber' },
    { label: 'Expiring stock lots', value: summary.expiring_lots, detail: 'Expired or expiring within 30 days', icon: CircleAlert, page: 'inventory-records', tone: 'rose' },
    { label: 'Sales this month', value: formatMoney(summary.sales_this_month), detail: 'Sales recorded this month', icon: TrendingUp, page: 'transactions', tone: 'green' },
    { label: 'Net cash flow', value: formatMoney(summary.net_cash_flow_this_month), detail: `Cash in ${formatMoney(summary.cash_in_this_month)} · out ${formatMoney(summary.cash_out_this_month)}`, icon: TrendingUp, page: 'transactions', tone: 'violet' },
  ] : [];

  return <section className="farm-overview" aria-labelledby="farm-overview-title">
    <div className="farm-overview-heading">
      <div>
        <h2 id="farm-overview-title">Farm overview</h2>
        <p>Live summary from saved farm records{summary ? ` · Updated ${summary.as_of}` : ''}</p>
      </div>
      <button type="button" className="farm-overview-refresh" onClick={() => {
        setError('');
        api.getDashboardSummary().then(setSummary).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load farm overview'));
      }}>Refresh</button>
    </div>
    {error && <div className="error-message" role="alert">{error}</div>}
    {!summary && !error && <p role="status">Loading farm overview…</p>}
    {summary && <div className="farm-metric-grid">
      {metrics.map(metric => {
        const Icon = metric.icon;
        return <button type="button" className={`farm-metric-card tone-${metric.tone}`} key={metric.label} onClick={() => onNavigate(metric.page)}>
          <span className="farm-metric-icon"><Icon size={20} aria-hidden="true" /></span>
          <span className="farm-metric-label">{metric.label}</span>
          <strong className="farm-metric-value">{metric.value}</strong>
          <span className="farm-metric-detail">{metric.detail}</span>
        </button>;
      })}
    </div>}
  </section>;
}
