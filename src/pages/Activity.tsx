import { Download, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActivityList } from '../components/ActivityList';
import { ActivityChart } from '../components/LazyCharts';
import { Card, Disclosure, PageHeader } from '../components/ui';
import { BRAND } from '../core/brand';
import type { EventCategory, Severity } from '../core/types';
import { useNow, useStore } from '../state/store';

const CATEGORIES: { id: EventCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'device', label: 'Lights & devices' },
  { id: 'automation', label: 'Routines' },
  { id: 'scene', label: 'Quick actions' },
  { id: 'security', label: 'Doors & safety' },
  { id: 'doorbell', label: 'Doorbell' },
  { id: 'climate', label: 'Temperature' },
  { id: 'system', label: 'App' },
];
const SEVERITIES: { id: Severity | 'all'; label: string }[] = [
  { id: 'all', label: 'Any importance' },
  { id: 'info', label: 'Information' },
  { id: 'success', label: 'Done' },
  { id: 'warning', label: 'Worth a look' },
  { id: 'alert', label: 'Urgent' },
];
const PERIODS = { all: Infinity, '1h': 3_600_000, today: -1 } as const;
type Period = keyof typeof PERIODS;

export function Activity() {
  const { state, dispatch } = useStore();
  const now = useNow(30_000);
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('category');
  const category = (CATEGORIES.some((c) => c.id === fromUrl) ? fromUrl : 'all') as EventCategory | 'all';
  const setCategory = (c: string) => setParams(c === 'all' ? {} : { category: c }, { replace: true });
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const since = period === 'all' ? 0 : period === 'today' ? startOfDay : now - PERIODS['1h'];
  const events = state.activity.filter(
    (e) => (category === 'all' || e.category === category) && (severity === 'all' || e.severity === severity) && e.ts >= since && (!q || e.message.toLowerCase().includes(q)),
  );

  const clear = () => {
    if (window.confirm(`Delete all ${state.activity.length} history entries? This cannot be undone.`)) dispatch({ type: 'activity/clear' });
  };

  const exportCsv = () => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = ['timestamp,category,severity,message', ...events.map((e) => [new Date(e.ts).toISOString(), e.category, e.severity, escape(e.message)].join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${BRAND.filePrefix}-activity-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="History"
        back={{ to: '/settings', label: 'Settings' }}
        subtitle="Everything that happened in your home, newest first."
        actions={<button className="btn ghost danger" onClick={clear} disabled={state.activity.length === 0}><Trash2 size={18} /> Clear history</button>}
      />
      <Card>
        <div className="filters">
          <div className="tabs" role="tablist" aria-label="Show">
            {CATEGORIES.map((c) => (
              <button key={c.id} role="tab" aria-selected={category === c.id} className={`tab ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search history" aria-label="Search history" />
          </label>
        </div>
        <Disclosure advanced label="More filters, chart and export">
          <div className="filter-row">
            <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | 'all')} aria-label="Importance">
              {SEVERITIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="When">
              <option value="all">Any time</option>
              <option value="1h">Last hour</option>
              <option value="today">Today</option>
            </select>
            <button className="btn small" onClick={exportCsv} disabled={events.length === 0}><Download size={16} /> Download as spreadsheet (CSV)</button>
          </div>
          <ActivityChart events={state.activity} now={now} height={140} />
        </Disclosure>
        <p className="muted small">{events.length} of {state.activity.length} entries shown</p>
        <ActivityList events={events} />
      </Card>
    </>
  );
}
