import React, { useEffect, useState } from 'react';
import { api } from '../src/services/api';
import { BreedingEvent, LitterRecord, PigProfile } from '../types';

export default function BreedingSection({ pigs, litters }: { pigs: PigProfile[]; litters: LitterRecord[] }) {
  const [events, setEvents] = useState<BreedingEvent[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ pig_id: '', related_pig_id: '', litter_id: '', event_type: 'mating', event_date: '', method: '', result: '', notes: '' });
  const refresh = async () => {
    try { setEvents(await api.getBreedingEvents()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load breeding events'); }
  };
  useEffect(() => { void refresh(); }, []);
  const save = async () => {
    setError('');
    try {
      const saved = await api.createBreedingEvent({ ...form, related_pig_id: form.related_pig_id || null, litter_id: form.litter_id || null, event_type: form.event_type as BreedingEvent['event_type'] });
      setEvents(current => [saved, ...current]);
      setForm({ pig_id: '', related_pig_id: '', litter_id: '', event_type: 'mating', event_date: '', method: '', result: '', notes: '' });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save breeding event'); }
  };
  return <section>
    <h2 className="section-title">Breeding Events</h2>
    <p>Record matings, inseminations, pregnancy checks, farrowing, and weaning. Estimated dates do not confirm an event.</p>
    {error && <div className="error-message" role="alert">{error}</div>}
    <div className="finance-controls">
      <div className="form-group"><label htmlFor="breeding-type">Event</label><select id="breeding-type" className="form-input" value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>{['mating','insemination','pregnancy_check','farrowing','weaning','other'].map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></div>
      <div className="form-group"><label htmlFor="breeding-pig">Primary pig</label><select id="breeding-pig" className="form-input" value={form.pig_id} onChange={e => setForm({ ...form, pig_id: e.target.value })}><option value="">Choose a pig</option>{pigs.map(pig => <option key={pig.id} value={pig.id}>{pig.tag_id} · {pig.sex}</option>)}</select></div>
      <div className="form-group"><label htmlFor="breeding-related">Related pig (optional)</label><select id="breeding-related" className="form-input" value={form.related_pig_id} onChange={e => setForm({ ...form, related_pig_id: e.target.value })}><option value="">None</option>{pigs.map(pig => <option key={pig.id} value={pig.id}>{pig.tag_id} · {pig.sex}</option>)}</select></div>
      <div className="form-group"><label htmlFor="breeding-litter">Litter (optional)</label><select id="breeding-litter" className="form-input" value={form.litter_id} onChange={e => setForm({ ...form, litter_id: e.target.value })}><option value="">None</option>{litters.map(litter => <option key={litter.id} value={litter.id}>{litter.litter_code}</option>)}</select></div>
      <div className="form-group"><label htmlFor="breeding-date">Event date</label><input id="breeding-date" type="date" className="form-input" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="breeding-method">Method</label><input id="breeding-method" className="form-input" maxLength={120} value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="breeding-result">Result / check outcome</label><input id="breeding-result" className="form-input" maxLength={255} value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="breeding-notes">Notes</label><textarea id="breeding-notes" className="form-input" maxLength={5000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      <button className="btn-add" onClick={save}>Save Event</button>
    </div>
    <div className="table-container"><table className="data-table"><thead><tr><th>Date</th><th>Event</th><th>Pig</th><th>Related pig</th><th>Litter</th><th>Result</th></tr></thead><tbody>{events.length === 0 ? <tr><td colSpan={6}>No breeding events recorded.</td></tr> : events.map(event => <tr key={event.id}><td>{event.event_date}</td><td>{event.event_type.replace('_', ' ')}</td><td>{event.pig_tag || event.pig_id}</td><td>{event.related_tag || '—'}</td><td>{event.litter_code || '—'}</td><td>{event.result || event.notes || '—'}</td></tr>)}</tbody></table></div>
  </section>;
}
