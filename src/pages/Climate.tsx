import { RefreshCw, Thermometer } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Metric } from '../components/Charts';
import { ClimateChart } from '../components/LazyCharts';
import { ClimateCard, ThermostatCard } from '../components/DeviceControls';
import { Disclosure, EmptyState, PageHeader, Section, Segmented, Toggle } from '../components/ui';
import { describeAction, describeTrigger } from '../core/describe';
import { usePersistentState, useNow, useStore } from '../state/store';

const RANGES = { '15m': 15 * 60_000, '1h': 60 * 60_000, all: Infinity } as const;
type Range = keyof typeof RANGES;

export function Climate() {
  const { state, dispatch, simulateTick } = useStore();
  const now = useNow(5000);
  const unit = state.settings.tempUnit;
  const sensors = state.devices.filter((d) => d.type === 'climate');
  const thermostats = state.devices.filter((d) => d.type === 'thermostat');
  const [selected, setSelected] = usePersistentState<string>('climate-sensor', 'all');
  const [metric, setMetric] = usePersistentState<Metric>('climate-metric', 'temperature', ['temperature', 'humidity']);
  const [range, setRange] = usePersistentState<Range>('climate-range', 'all', ['15m', '1h', 'all']);
  const picked = sensors.filter((s) => s.id === selected);
  const shown = picked.length ? picked : sensors;
  const since = range === 'all' ? 0 : now - RANGES[range];
  const climateRules = state.rules.filter(
    (r) => r.trigger.kind === 'temp_above' || r.trigger.kind === 'temp_below' || r.trigger.kind === 'humidity_above' || r.actions.some((a) => a.kind === 'set_thermostat'),
  );

  return (
    <>
      <PageHeader
        title="Temperature"
        back={{ to: '/rooms', label: 'Rooms' }}
        subtitle="How warm each room is, and the heating and cooling that keeps it comfortable."
        actions={<Segmented label="Temperature unit" value={unit} onChange={(u) => dispatch({ type: 'settings/update', patch: { tempUnit: u } })} options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]} />}
      />

      {thermostats.length > 0 && (
        <Section title="Heating & cooling" hint="Use − and + to choose the temperature you want.">
          <div className="device-grid">{thermostats.map((t) => <ThermostatCard key={t.id} device={t} />)}</div>
        </Section>
      )}

      <Section title="Each room right now">
        {sensors.length ? (
          <div className="device-grid">{sensors.map((s) => <ClimateCard key={s.id} sensor={s} />)}</div>
        ) : (
          <EmptyState icon={<Thermometer size={28} />} title="No temperature sensors">Add one in Settings → Devices & rooms.</EmptyState>
        )}
      </Section>

      {sensors.length > 0 && (
        <Disclosure advanced label="Temperature history" hint="A chart of past readings">
          <div className="chart-controls">
            <Segmented<Metric> label="Chart shows" value={metric} onChange={setMetric} options={[{ value: 'temperature', label: 'Temperature' }, { value: 'humidity', label: 'Humidity' }]} />
            <Segmented<Range> label="Time range" value={range} onChange={setRange} options={[{ value: '15m', label: '15 min' }, { value: '1h', label: '1 hour' }, { value: 'all', label: 'All' }]} />
            <select value={picked.length ? selected : 'all'} onChange={(e) => setSelected(e.target.value)} aria-label="Room to show">
              <option value="all">All rooms</option>
              {sensors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn small" onClick={simulateTick}><RefreshCw size={16} /> New reading</button>
          </div>
          <ClimateChart sensors={shown} unit={unit} metric={metric} since={since} height={300} />
        </Disclosure>
      )}

      <Disclosure advanced label="Automatic temperature routines" hint={`${climateRules.filter((r) => r.enabled).length} running`}>
        {climateRules.length ? (
          <ul className="mini-rules">
            {climateRules.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <span className="muted small">When {describeTrigger(state, r.trigger, unit)} → {r.actions.map((a) => describeAction(state, a, unit)).join(', ')}</span>
                </div>
                <Toggle checked={r.enabled} label={`${r.enabled ? 'Pause' : 'Start'} routine ${r.name}`} onChange={() => dispatch({ type: 'rule/toggle', ruleId: r.id })} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No temperature routines yet.</p>
        )}
        <Link to="/automations" className="link">Change these in Automations</Link>
      </Disclosure>
    </>
  );
}
