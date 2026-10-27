import React, { useEffect, useState } from 'react';
import { HerdGroup, HerdGroupEvent, PenRecord } from '../types';
import { api } from '../src/services/api';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const emptyGroup = { group_code: '', name: '', group_type: 'cohort' as HerdGroup['group_type'], started_on: today(), head_count: '1', current_pen_id: '', notes: '' };

export default function GroupsSection() {
  const [groups, setGroups] = useState<HerdGroup[]>([]);
  const [events, setEvents] = useState<HerdGroupEvent[]>([]);
  const [pens, setPens] = useState<PenRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [groupForm, setGroupForm] = useState(emptyGroup);
  const [eventForm, setEventForm] = useState({ event_type: 'count_adjustment' as HerdGroupEvent['event_type'], occurred_on: today(), new_count: '', new_status: 'closed' as HerdGroup['lifecycle_status'], new_pen_id: '', reason: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async (id = selectedId) => {
    const [rows, penRows] = await Promise.all([api.getHerdGroups(), api.getPens()]);
    setGroups(rows);
    setPens(penRows);
    const validId = rows.some(group => group.id === id) ? id : rows[0]?.id || '';
    setSelectedId(validId);
    if (validId) {
      const details = await api.getHerdGroupHistory(validId);
      setEvents(details.events);
    } else setEvents([]);
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getHerdGroups(), api.getPens()]).then(async ([rows, penRows]) => {
      if (!mounted) return;
      setGroups(rows);
      setPens(penRows);
      const firstId = rows[0]?.id || '';
      setSelectedId(firstId);
      if (firstId) {
        const details = await api.getHerdGroupHistory(firstId);
        if (mounted) setEvents(details.events);
      }
    }).catch(reason => { if (mounted) setError(reason instanceof Error ? reason.message : 'Could not load herd groups'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const submitGroup = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const created = await api.createHerdGroup({ ...groupForm, head_count: Number(groupForm.head_count), current_pen_id: groupForm.current_pen_id || null });
      setGroupForm(emptyGroup);
      await refresh(created.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create group'); }
    finally { setBusy(false); }
  };

  const submitEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true); setError('');
    try {
      await api.recordHerdGroupEvent({
        group_id: selectedId,
        event_type: eventForm.event_type,
        occurred_on: eventForm.occurred_on,
        reason: eventForm.reason,
        notes: eventForm.notes || undefined,
        ...(eventForm.event_type === 'count_adjustment' ? { new_count: Number(eventForm.new_count) } : eventForm.event_type === 'status_change' ? { new_status: eventForm.new_status } : { new_pen_id: eventForm.new_pen_id || null }),
      });
      setEventForm(current => ({ ...current, reason: '', notes: '' }));
      await refresh(selectedId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not record group event'); }
    finally { setBusy(false); }
  };

  const changeSelection = async (id: string) => {
    setSelectedId(id); setEvents([]); setError('');
    if (!id) return;
    try { setEvents((await api.getHerdGroupHistory(id)).events); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load group history'); }
  };
  const selected = groups.find(group => group.id === selectedId);

  return <section>
    <h2 className="section-title">Herd groups and cohorts</h2>
    <p>Track independent cohorts alongside litter-linked groups. Head-count, lifecycle, and pen changes are saved as dated events. Pen capacity counts both individual pigs and group head counts.</p>
    {error && <div className="error-message" role="alert">{error}</div>}
    <h3>Create an independent group</h3>
    <form className="finance-controls" onSubmit={submitGroup}>
      <label>Group code<input required maxLength={64} className="form-input" value={groupForm.group_code} onChange={e => setGroupForm({ ...groupForm, group_code: e.target.value })} /></label>
      <label>Name<input required maxLength={120} className="form-input" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} /></label>
      <label>Type<select className="form-input" value={groupForm.group_type} onChange={e => setGroupForm({ ...groupForm, group_type: e.target.value as HerdGroup['group_type'] })}><option value="cohort">Cohort</option><option value="quarantine">Quarantine</option><option value="breeding">Breeding</option><option value="other">Other</option></select></label>
      <label>Start date<input required type="date" max={today()} className="form-input" value={groupForm.started_on} onChange={e => setGroupForm({ ...groupForm, started_on: e.target.value })} /></label>
      <label>Starting head count<input required type="number" min="0" max="32767" step="1" className="form-input" value={groupForm.head_count} onChange={e => setGroupForm({ ...groupForm, head_count: e.target.value })} /></label>
      <label>Starting pen<select className="form-input" value={groupForm.current_pen_id} onChange={e => setGroupForm({ ...groupForm, current_pen_id: e.target.value })}><option value="">Unassigned</option>{pens.filter(pen => !!pen.active).map(pen => <option key={pen.id} value={pen.id}>{pen.code} · {pen.name} ({pen.occupancy}/{pen.capacity})</option>)}</select></label>
      <label>Notes<input maxLength={3000} className="form-input" value={groupForm.notes} onChange={e => setGroupForm({ ...groupForm, notes: e.target.value })} /></label>
      <button className="btn-add" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create group'}</button>
    </form>

    <h3>Groups and event history</h3>
    {loading ? <p role="status">Loading groups…</p> : groups.length === 0 ? <p>No independent herd groups are recorded yet.</p> : <>
      <div className="finance-controls"><label>Selected group<select className="form-input" value={selectedId} onChange={e => void changeSelection(e.target.value)}>{groups.map(group => <option key={group.id} value={group.id}>{group.group_code} · {group.name}</option>)}</select></label></div>
      {selected && <div className="table-container"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Started</th><th>Head count</th><th>Linked pigs</th><th>Pen</th><th>Status</th></tr></thead><tbody><tr><td>{selected.group_code}</td><td>{selected.name}</td><td>{selected.group_type}</td><td>{selected.started_on}</td><td>{selected.head_count}</td><td>{selected.member_count ?? 0}</td><td>{selected.current_pen_code || 'Unassigned'}</td><td>{selected.lifecycle_status}</td></tr></tbody></table></div>}
      <h4>Record group change</h4>
      <p>Before closing a group, record its head count as zero and transfer it to Unassigned.</p>
      <form className="finance-controls" onSubmit={submitEvent}>
        <label>Change type<select className="form-input" value={eventForm.event_type} onChange={e => setEventForm({ ...eventForm, event_type: e.target.value as HerdGroupEvent['event_type'] })}><option value="count_adjustment" disabled={selected?.lifecycle_status !== 'active'}>Head-count change</option><option value="status_change">Lifecycle status</option><option value="pen_transfer" disabled={selected?.lifecycle_status !== 'active'}>Pen transfer</option></select></label>
        <label>Date<input required type="date" max={today()} className="form-input" value={eventForm.occurred_on} onChange={e => setEventForm({ ...eventForm, occurred_on: e.target.value })} /></label>
        {eventForm.event_type === 'count_adjustment' ? <label>New head count<input required type="number" min="0" max="32767" step="1" className="form-input" value={eventForm.new_count} onChange={e => setEventForm({ ...eventForm, new_count: e.target.value })} /></label> : eventForm.event_type === 'status_change' ? <label>New status<select className="form-input" value={eventForm.new_status === selected?.lifecycle_status ? (selected?.lifecycle_status === 'active' ? 'closed' : 'active') : eventForm.new_status} onChange={e => setEventForm({ ...eventForm, new_status: e.target.value as HerdGroup['lifecycle_status'] })}><option value="active" disabled={selected?.lifecycle_status === 'active'}>Active</option><option value="closed" disabled={selected?.lifecycle_status === 'closed'}>Closed</option></select></label> : <label>Destination pen<select className="form-input" value={eventForm.new_pen_id} onChange={e => setEventForm({ ...eventForm, new_pen_id: e.target.value })}><option value="">Unassigned</option>{pens.filter(pen => !!pen.active).map(pen => <option key={pen.id} value={pen.id}>{pen.code} · {pen.name} ({pen.occupancy}/{pen.capacity})</option>)}</select></label>}
        <label>Reason<input required maxLength={255} className="form-input" value={eventForm.reason} onChange={e => setEventForm({ ...eventForm, reason: e.target.value })} /></label>
        <label>Notes<input maxLength={3000} className="form-input" value={eventForm.notes} onChange={e => setEventForm({ ...eventForm, notes: e.target.value })} /></label>
        <button className="btn-add" type="submit" disabled={busy || !selectedId}>{busy ? 'Saving…' : 'Record event'}</button>
      </form>
      <div className="table-container"><table className="data-table"><thead><tr><th>Date</th><th>Event</th><th>Count</th><th>Pen</th><th>Status</th><th>Reason</th><th>Notes</th></tr></thead><tbody>{events.length === 0 ? <tr><td colSpan={7}>No group events.</td></tr> : events.map(row => <tr key={row.id}><td>{row.occurred_on}</td><td>{row.event_type.replace('_', ' ')}</td><td>{row.previous_count} → {row.new_count}</td><td>{row.from_pen_code || '—'} → {row.to_pen_code || '—'}</td><td>{row.previous_status} → {row.new_status}</td><td>{row.reason}</td><td>{row.notes || '—'}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
