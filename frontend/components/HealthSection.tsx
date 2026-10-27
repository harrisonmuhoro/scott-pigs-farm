import React, { useEffect, useState } from 'react';
import { HealthRecord, HealthReminder, LitterRecord, PigProfile, VaccinationSchedule } from '../types';
import { api } from '../src/services/api';

type Props = { pigs: PigProfile[]; litters: LitterRecord[] };

const HealthSection: React.FC<Props> = ({ pigs, litters }) => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [schedules, setSchedules] = useState<VaccinationSchedule[]>([]);
  const [reminders, setReminders] = useState<HealthReminder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reminderBusy, setReminderBusy] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<'pig' | 'litter'>('pig');
  const [recordForm, setRecordForm] = useState({ target_id: '', record_type: 'observation', occurred_on: '', symptoms: '', product_name: '', dose_as_entered: '', dose_unit: '', route: '', withdrawal_days: '', responsible_person: '', follow_up_due: '', notes: '' });
  const [scheduleForm, setScheduleForm] = useState({ target_id: '', vaccine_name: '', due_date: '', interval_days: '', notes: '' });

  const refresh = async () => {
    setError('');
    try {
      const [healthRows, scheduleRows, reminderRows] = await Promise.all([api.getHealthRecords(), api.getVaccinationSchedules(), api.getHealthReminders()]);
      setRecords(healthRows);
      setSchedules(scheduleRows);
      setReminders(reminderRows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load health records');
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const saveRecord = async () => {
    setError('');
    try {
      await api.createHealthRecord({
        pig_id: targetType === 'pig' ? recordForm.target_id : null,
        litter_id: targetType === 'litter' ? recordForm.target_id : null,
        record_type: recordForm.record_type as HealthRecord['record_type'],
        occurred_on: recordForm.occurred_on,
        symptoms: recordForm.symptoms || null,
        product_name: recordForm.product_name || null,
        dose_as_entered: recordForm.dose_as_entered || null,
        dose_unit: recordForm.dose_unit || null,
        route: recordForm.route || null,
        withdrawal_days: recordForm.withdrawal_days === '' ? null : Number(recordForm.withdrawal_days),
        responsible_person: recordForm.responsible_person || null,
        follow_up_due: recordForm.follow_up_due || null,
        follow_up_status: 'open',
        notes: recordForm.notes || null,
      });
      setRecordForm({ target_id: '', record_type: 'observation', occurred_on: '', symptoms: '', product_name: '', dose_as_entered: '', dose_unit: '', route: '', withdrawal_days: '', responsible_person: '', follow_up_due: '', notes: '' });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save health record'); }
  };

  const saveSchedule = async () => {
    setError('');
    try {
      await api.createVaccinationSchedule({
        pig_id: targetType === 'pig' ? scheduleForm.target_id : null,
        litter_id: targetType === 'litter' ? scheduleForm.target_id : null,
        vaccine_name: scheduleForm.vaccine_name,
        due_date: scheduleForm.due_date,
        interval_days: scheduleForm.interval_days === '' ? null : Number(scheduleForm.interval_days),
        notes: scheduleForm.notes || null,
      });
      setScheduleForm({ target_id: '', vaccine_name: '', due_date: '', interval_days: '', notes: '' });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save vaccination schedule'); }
  };

  const updateStatus = async (record: HealthRecord, status: HealthRecord['follow_up_status']) => {
    try { await api.updateFollowup(record.id, status); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update follow-up'); }
  };

  const updateSchedule = async (schedule: VaccinationSchedule) => {
    try { await api.setVaccinationScheduleActive(schedule.id, !schedule.active); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update schedule'); }
  };

  const resolveReminder = async (reminder: HealthReminder) => {
    const key = `${reminder.reminder_type}-${reminder.reminder_id}`;
    setReminderBusy(key);
    setError('');
    try {
      if (reminder.reminder_type === 'follow_up') {
        await api.updateFollowup(reminder.reminder_id, 'completed');
      } else if (reminder.reminder_type === 'vaccination') {
        const schedule = schedules.find(item => item.id === reminder.reminder_id);
        if (!schedule) throw new Error('Refresh the schedule list before dismissing this reminder.');
        await api.setVaccinationScheduleActive(reminder.reminder_id, false);
      }
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update reminder'); }
    finally { setReminderBusy(null); }
  };

  const targetOptions = targetType === 'pig'
    ? pigs.map(pig => ({ id: pig.id, label: `${pig.tag_id} · ${pig.name || pig.breed}` }))
    : litters.map(litter => ({ id: litter.id, label: `${litter.litter_code} · dam ${litter.dam_tag || litter.dam_id}` }));

  return <section>
    <h2 className="section-title">Health and Veterinary Records</h2>
    <p>Recordkeeping only. Diagnosis and treatment decisions, including doses, belong to a qualified veterinarian.</p>
    {error && <div className="error-message" role="alert">{error}</div>}
    <h3>Record an observation, treatment, or vaccination</h3>
    <div className="finance-controls">
      <div className="form-group"><label htmlFor="health-target-type">Record applies to</label><select id="health-target-type" className="form-input" value={targetType} onChange={e => { setTargetType(e.target.value as 'pig' | 'litter'); setRecordForm({ ...recordForm, target_id: '' }); setScheduleForm({ ...scheduleForm, target_id: '' }); }}><option value="pig">Individual pig</option><option value="litter">Litter</option></select></div>
      <div className="form-group"><label htmlFor="health-target">Pig / litter</label><select id="health-target" className="form-input" value={recordForm.target_id} onChange={e => setRecordForm({ ...recordForm, target_id: e.target.value })}><option value="">Choose a record</option>{targetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
      <div className="form-group"><label htmlFor="health-type">Record type</label><select id="health-type" className="form-input" value={recordForm.record_type} onChange={e => setRecordForm({ ...recordForm, record_type: e.target.value })}><option value="observation">Observation</option><option value="treatment">Treatment</option><option value="vaccination">Vaccination administration</option></select></div>
      <div className="form-group"><label htmlFor="health-date">Date</label><input id="health-date" type="date" className="form-input" value={recordForm.occurred_on} onChange={e => setRecordForm({ ...recordForm, occurred_on: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-symptoms">Symptoms / observation notes</label><textarea id="health-symptoms" className="form-input" maxLength={5000} value={recordForm.symptoms} onChange={e => setRecordForm({ ...recordForm, symptoms: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-product">Medicine / vaccine product</label><input id="health-product" className="form-input" maxLength={255} value={recordForm.product_name} onChange={e => setRecordForm({ ...recordForm, product_name: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-dose">Dose as entered</label><input id="health-dose" className="form-input" maxLength={80} value={recordForm.dose_as_entered} onChange={e => setRecordForm({ ...recordForm, dose_as_entered: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-dose-unit">Dose unit</label><input id="health-dose-unit" className="form-input" maxLength={40} value={recordForm.dose_unit} onChange={e => setRecordForm({ ...recordForm, dose_unit: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-route">Route (if entered)</label><input id="health-route" className="form-input" maxLength={80} value={recordForm.route} onChange={e => setRecordForm({ ...recordForm, route: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-withdrawal">Withdrawal period (days)</label><input id="health-withdrawal" type="number" min="0" max="3650" step="1" className="form-input" value={recordForm.withdrawal_days} onChange={e => setRecordForm({ ...recordForm, withdrawal_days: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-responsible">Responsible staff / vet</label><input id="health-responsible" className="form-input" maxLength={120} value={recordForm.responsible_person} onChange={e => setRecordForm({ ...recordForm, responsible_person: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-followup">Follow-up due</label><input id="health-followup" type="date" className="form-input" value={recordForm.follow_up_due} onChange={e => setRecordForm({ ...recordForm, follow_up_due: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="health-notes">Notes</label><textarea id="health-notes" className="form-input" maxLength={5000} value={recordForm.notes} onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })} /></div>
      <button className="btn-add" onClick={saveRecord}>Save Health Record</button>
    </div>

    <h3>Vaccination reminders</h3>
    <p>Due and overdue dates are reminders only; they do not confirm that a vaccination or follow-up occurred.</p>
    {reminders.length === 0 ? <p>No upcoming or overdue health reminders.</p> : <div className="table-container"><table className="data-table"><thead><tr><th>Type</th><th>Reminder</th><th>Target</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{reminders.map(item => { const key = `${item.reminder_type}-${item.reminder_id}`; return <tr key={key}><td>{item.reminder_type.replace('_', ' ')}</td><td>{item.title}</td><td>{item.target}</td><td>{item.due_date}</td><td>{item.reminder_status}</td><td><button className="action-btn btn-edit-pig" disabled={reminderBusy === key} onClick={() => resolveReminder(item)}>{reminderBusy === key ? 'Saving…' : item.reminder_type === 'follow_up' ? 'Complete' : 'Dismiss schedule'}</button></td></tr>; })}</tbody></table></div>}

    <h3>Vaccination schedule</h3>
    <div className="finance-controls">
      <div className="form-group"><label htmlFor="schedule-target">Pig / litter</label><select id="schedule-target" className="form-input" value={scheduleForm.target_id} onChange={e => setScheduleForm({ ...scheduleForm, target_id: e.target.value })}><option value="">Choose a record</option>{targetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
      <div className="form-group"><label htmlFor="schedule-vaccine">Vaccine name</label><input id="schedule-vaccine" className="form-input" maxLength={255} value={scheduleForm.vaccine_name} onChange={e => setScheduleForm({ ...scheduleForm, vaccine_name: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="schedule-date">Due date</label><input id="schedule-date" type="date" className="form-input" value={scheduleForm.due_date} onChange={e => setScheduleForm({ ...scheduleForm, due_date: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="schedule-interval">Repeat interval (days, optional)</label><input id="schedule-interval" type="number" min="1" max="3650" step="1" className="form-input" value={scheduleForm.interval_days} onChange={e => setScheduleForm({ ...scheduleForm, interval_days: e.target.value })} /></div>
      <div className="form-group"><label htmlFor="schedule-notes">Notes</label><input id="schedule-notes" className="form-input" maxLength={2000} value={scheduleForm.notes} onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })} /></div>
      <button className="btn-add" onClick={saveSchedule}>Save Schedule</button>
    </div>
    {loading ? <p role="status">Loading health history…</p> : <>
      <div className="table-container"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Pig / litter</th><th>Product / observation</th><th>Follow-up</th><th>Status</th><th>Action</th></tr></thead><tbody>{records.length === 0 ? <tr><td colSpan={7}>No health records have been saved.</td></tr> : records.map(record => <tr key={record.id}><td>{record.occurred_on}</td><td>{record.record_type}</td><td>{record.tag_id || record.litter_code || '—'}</td><td>{record.product_name || record.symptoms || '—'}</td><td>{record.follow_up_due || '—'}</td><td>{record.follow_up_status}</td><td>{record.follow_up_status === 'open' && <button className="action-btn btn-edit-pig" onClick={() => updateStatus(record, 'completed')}>Complete</button>}</td></tr>)}</tbody></table></div>
      <div className="table-container"><table className="data-table"><thead><tr><th>Vaccine</th><th>Target</th><th>Due</th><th>Repeat</th><th>Status</th><th>Action</th></tr></thead><tbody>{schedules.length === 0 ? <tr><td colSpan={6}>No vaccination schedules saved.</td></tr> : schedules.map(schedule => <tr key={schedule.id}><td>{schedule.vaccine_name}</td><td>{schedule.tag_id || schedule.litter_code || '—'}</td><td>{schedule.due_date}</td><td>{schedule.interval_days ? `${schedule.interval_days} days` : '—'}</td><td>{schedule.active ? 'Active' : 'Inactive'}</td><td><button className="action-btn btn-edit-pig" onClick={() => updateSchedule(schedule)}>{schedule.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>
    </>}
  </section>;
};

export default HealthSection;
