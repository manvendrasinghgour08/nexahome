import { ArrowRight, Pencil, Play, Plus, Trash2, Workflow, X, Zap } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Card, Disclosure, EmptyState, PageHeader, Status, Toggle } from '../components/ui';
import { describeAction, describeCondition, describeTrigger } from '../core/describe';
import { MAX_ACTIONS, isSwitchable, ruleProblems, triggerDeviceType, type RuleDraft } from '../core/engine';
import { fromUnit, HEX_RE, LIGHT_COLORS, MODE_LABEL, relativeTime, toUnit } from '../core/format';
import type { AppState, Condition, DeviceType, Rule, RuleAction, Settings, ThermostatMode, Trigger } from '../core/types';
import { useFlash } from '../state/flash';
import { useNow, useStore } from '../state/store';

type Unit = Settings['tempUnit'];

// ---------- option lists ----------

const TRIGGERS: { kind: Trigger['kind']; label: string }[] = [
  { kind: 'motion_detected', label: 'Someone moves near a sensor' },
  { kind: 'contact_opened', label: 'A door or window opens' },
  { kind: 'contact_closed', label: 'A door or window closes' },
  { kind: 'doorbell_pressed', label: 'The doorbell rings' },
  { kind: 'temp_above', label: 'A room gets warmer than' },
  { kind: 'temp_below', label: 'A room gets cooler than' },
  { kind: 'humidity_above', label: 'The air gets damp (humidity above)' },
  { kind: 'time', label: 'It is a certain time of day' },
  { kind: 'scene_started', label: 'I start a quick action (like leaving home)' },
];

const CONDITIONS: { kind: Condition['kind']; label: string }[] = [
  { kind: 'time_between', label: 'Time is between' },
  { kind: 'security_is', label: 'Away protection is' },
  { kind: 'device_is', label: 'A light or device is on/off' },
  { kind: 'temp_is', label: 'A room is warmer/cooler than' },
];

const ACTIONS: { kind: RuleAction['kind']; label: string }[] = [
  { kind: 'turn_on', label: 'Turn On a light or device' },
  { kind: 'turn_off', label: 'Turn Off a light or device' },
  { kind: 'toggle', label: 'Switch a light or device (on ↔ off)' },
  { kind: 'light_set', label: 'Turn on a light with brightness & colour' },
  { kind: 'set_thermostat', label: 'Change heating & cooling' },
  { kind: 'all_off', label: 'Turn everything off' },
  { kind: 'arm_security', label: 'Turn Away protection on or off' },
  { kind: 'activate_scene', label: 'Start a quick action' },
  { kind: 'notify', label: 'Send me an alert' },
];

// ---------- form model (strings, so inputs can be edited freely) ----------

interface TriggerForm { kind: Trigger['kind']; deviceId: string; threshold: string; at: string; sceneId: string }
interface ConditionForm { key: number; kind: Condition['kind']; from: string; to: string; armed: boolean; deviceId: string; on: boolean; op: 'above' | 'below'; value: string }
interface ActionForm { key: number; kind: RuleAction['kind']; deviceId: string; brightness: string; color: string; mode: ThermostatMode; target: string; allOff: 'lights' | 'appliances'; armed: boolean; sceneId: string; message: string }
interface FormValues { name: string; trigger: TriggerForm; conditions: ConditionForm[]; actions: ActionForm[] }

let keySeq = 1;
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const firstOf = (state: AppState, type: DeviceType | 'switchable' | null) =>
  type === null ? '' : state.devices.find((d) => (type === 'switchable' ? isSwitchable(d) : d.type === type))?.id ?? '';

function actionDeviceType(kind: RuleAction['kind']): DeviceType | 'switchable' | null {
  if (kind === 'turn_on' || kind === 'turn_off' || kind === 'toggle') return 'switchable';
  if (kind === 'light_set') return 'light';
  if (kind === 'set_thermostat') return 'thermostat';
  return null;
}

function blankCondition(state: AppState, kind: Condition['kind'] = 'time_between'): ConditionForm {
  return { key: keySeq++, kind, from: '18:00', to: '23:00', armed: true, deviceId: firstOf(state, kind === 'device_is' ? 'switchable' : kind === 'temp_is' ? 'climate' : null), on: true, op: 'above', value: '' };
}

function blankAction(state: AppState, kind: RuleAction['kind'] = 'turn_on'): ActionForm {
  return { key: keySeq++, kind, deviceId: firstOf(state, actionDeviceType(kind)), brightness: '80', color: LIGHT_COLORS[0].hex, mode: 'auto', target: '', allOff: 'lights', armed: true, sceneId: state.scenes[0]?.id ?? '', message: '' };
}

function emptyForm(state: AppState): FormValues {
  return { name: '', trigger: { kind: 'motion_detected', deviceId: firstOf(state, 'motion'), threshold: '', at: '19:00', sceneId: state.scenes[0]?.id ?? '' }, conditions: [], actions: [blankAction(state)] };
}

function formFromRule(state: AppState, rule: Rule, unit: Unit): FormValues {
  const t = rule.trigger;
  const threshold = t.kind === 'temp_above' || t.kind === 'temp_below' ? toUnit(t.threshold, unit).toFixed(1) : t.kind === 'humidity_above' ? String(t.threshold) : '';
  return {
    name: rule.name,
    trigger: { kind: t.kind, deviceId: 'deviceId' in t ? t.deviceId : '', threshold, at: t.kind === 'time' ? t.at : '19:00', sceneId: t.kind === 'scene_started' ? t.sceneId : state.scenes[0]?.id ?? '' },
    conditions: rule.conditions.map((c) => ({
      ...blankCondition(state, c.kind),
      ...(c.kind === 'time_between' ? { from: c.from, to: c.to } : {}),
      ...(c.kind === 'security_is' ? { armed: c.armed } : {}),
      ...(c.kind === 'device_is' ? { deviceId: c.deviceId, on: c.on } : {}),
      ...(c.kind === 'temp_is' ? { deviceId: c.deviceId, op: c.op, value: toUnit(c.value, unit).toFixed(1) } : {}),
    })),
    actions: rule.actions.map((a) => ({
      ...blankAction(state, a.kind),
      ...('deviceId' in a ? { deviceId: a.deviceId } : {}),
      ...(a.kind === 'light_set' ? { brightness: String(a.brightness), color: a.color } : {}),
      ...(a.kind === 'set_thermostat' ? { mode: a.mode, target: toUnit(a.target, unit).toFixed(1) } : {}),
      ...(a.kind === 'all_off' ? { allOff: a.target } : {}),
      ...(a.kind === 'arm_security' ? { armed: a.armed } : {}),
      ...(a.kind === 'activate_scene' ? { sceneId: a.sceneId } : {}),
      ...(a.kind === 'notify' ? { message: a.message } : {}),
    })),
  };
}

function toTrigger(t: TriggerForm, unit: Unit): Trigger {
  switch (t.kind) {
    case 'time': return { kind: 'time', at: t.at };
    case 'scene_started': return { kind: 'scene_started', sceneId: t.sceneId };
    case 'temp_above':
    case 'temp_below': return { kind: t.kind, deviceId: t.deviceId, threshold: Math.round(fromUnit(num(t.threshold), unit) * 100) / 100 };
    case 'humidity_above': return { kind: t.kind, deviceId: t.deviceId, threshold: num(t.threshold) };
    default: return { kind: t.kind, deviceId: t.deviceId };
  }
}

function toCondition(c: ConditionForm, unit: Unit): Condition {
  switch (c.kind) {
    case 'time_between': return { kind: c.kind, from: c.from, to: c.to };
    case 'security_is': return { kind: c.kind, armed: c.armed };
    case 'device_is': return { kind: c.kind, deviceId: c.deviceId, on: c.on };
    case 'temp_is': return { kind: c.kind, deviceId: c.deviceId, op: c.op, value: Math.round(fromUnit(num(c.value), unit) * 100) / 100 };
  }
}

function toAction(a: ActionForm, unit: Unit): RuleAction {
  switch (a.kind) {
    case 'turn_on':
    case 'turn_off':
    case 'toggle': return { kind: a.kind, deviceId: a.deviceId };
    case 'light_set': return { kind: a.kind, deviceId: a.deviceId, brightness: num(a.brightness), color: a.color };
    case 'set_thermostat': return { kind: a.kind, deviceId: a.deviceId, mode: a.mode, target: a.mode === 'off' && a.target.trim() === '' ? 22 : Math.round(fromUnit(num(a.target), unit) * 10) / 10 };
    case 'all_off': return { kind: a.kind, target: a.allOff };
    case 'arm_security': return { kind: a.kind, armed: a.armed };
    case 'activate_scene': return { kind: a.kind, sceneId: a.sceneId };
    case 'notify': return { kind: a.kind, message: a.message.trim() };
  }
}

const toDraft = (v: FormValues, unit: Unit): RuleDraft => ({
  name: v.name.trim(),
  trigger: toTrigger(v.trigger, unit),
  conditions: v.conditions.map((c) => toCondition(c, unit)),
  actions: v.actions.map((a) => toAction(a, unit)),
});

// ---------- templates ----------

const light = (state: AppState, id: string) => state.devices.find((d) => d.id === id)?.id ?? firstOf(state, 'light');

/** Ready-made ideas, written the way people talk. */
function templates(state: AppState): { when: string; then: string; form: () => FormValues }[] {
  const base = emptyForm(state);
  const sceneId = (icon: string) => state.scenes.find((s) => s.icon === icon)?.id ?? state.scenes[0]?.id ?? '';
  return [
    {
      when: 'When I wake up (7:00 AM)',
      then: 'Turn on my bedroom light',
      form: () => ({ ...base, name: 'Wake-up light', trigger: { ...base.trigger, kind: 'time', at: '07:00' }, actions: [{ ...blankAction(state, 'turn_on'), deviceId: light(state, 'light-bedroom-main') }] }),
    },
    {
      when: 'At sunset (about 6:30 PM)',
      then: 'Turn on the living room light',
      form: () => ({ ...base, name: 'Sunset light', trigger: { ...base.trigger, kind: 'time', at: '18:30' }, actions: [{ ...blankAction(state, 'turn_on'), deviceId: light(state, 'light-living-main') }] }),
    },
    {
      when: 'When I leave home (Away Mode)',
      then: 'Turn off selected lights',
      form: () => ({
        ...base,
        name: 'Leaving home',
        trigger: { ...base.trigger, kind: 'scene_started', sceneId: sceneId('plane') },
        actions: [{ ...blankAction(state, 'turn_off'), deviceId: light(state, 'light-living-main') }, { ...blankAction(state, 'turn_off'), deviceId: light(state, 'light-kitchen') }],
      }),
    },
    {
      when: 'When the front door opens',
      then: 'Send me an alert',
      form: () => ({ ...base, name: 'Front door notification', trigger: { ...base.trigger, kind: 'contact_opened', deviceId: state.devices.find((d) => d.id === 'contact-front')?.id ?? firstOf(state, 'contact') }, actions: [{ ...blankAction(state, 'notify'), message: 'The front door just opened.' }] }),
    },
    {
      when: 'At bedtime (11:00 PM)',
      then: 'Start Good Night',
      form: () => ({ ...base, name: 'Bedtime', trigger: { ...base.trigger, kind: 'time', at: '23:00' }, actions: [{ ...blankAction(state, 'activate_scene'), sceneId: sceneId('moon') }] }),
    },
  ];
}

// ---------- form pieces ----------

function Field({ label, children, grow = false }: { label: string; children: ReactNode; grow?: boolean }) {
  return (
    <label className={`field ${grow ? 'grow' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function DeviceSelect({ state, type, value, onChange, label }: { state: AppState; type: DeviceType | 'switchable'; value: string; onChange: (id: string) => void; label: string }) {
  const options = state.devices.filter((d) => (type === 'switchable' ? isSwitchable(d) : d.type === type));
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.length === 0 && <option value="">No matching devices</option>}
        {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </Field>
  );
}

function RuleForm({ editing, onDone }: { editing: Rule | null; onDone: () => void }) {
  const { state, dispatch } = useStore();
  const unit = state.settings.tempUnit;
  const [v, setV] = useState<FormValues>(() => (editing ? formFromRule(state, editing, unit) : emptyForm(state)));
  const [errors, setErrors] = useState<string[]>([]);
  const flash = useFlash();
  const t = v.trigger;
  const setTrigger = (patch: Partial<TriggerForm>) => setV((p) => ({ ...p, trigger: { ...p.trigger, ...patch } }));
  const setCond = (key: number, patch: Partial<ConditionForm>) => setV((p) => ({ ...p, conditions: p.conditions.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  const setAct = (key: number, patch: Partial<ActionForm>) => setV((p) => ({ ...p, actions: p.actions.map((a) => (a.key === key ? { ...a, ...patch } : a)) }));

  const changeTriggerKind = (kind: Trigger['kind']) => {
    const type = triggerDeviceType(kind);
    const keep = type !== null && state.devices.find((d) => d.id === t.deviceId)?.type === type;
    setTrigger({ kind, deviceId: keep ? t.deviceId : firstOf(state, type), threshold: kind === t.kind ? t.threshold : '' });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const draft = toDraft(v, unit);
    const problems = ruleProblems(state, draft);
    if (problems.length) return setErrors(problems);
    dispatch(editing ? { type: 'rule/update', ruleId: editing.id, rule: draft } : { type: 'rule/add', rule: draft });
    flash(editing ? 'Changes saved' : `Routine “${draft.name}” saved`);
    onDone();
  };

  const triggerType = triggerDeviceType(t.kind);

  return (
    <form className="rule-form" onSubmit={submit} noValidate>
      {!editing && (
        <div className="templates">
          <span className="muted">Pick an idea to start quickly, or fill in the steps yourself:</span>
          <div className="idea-grid">
            {templates(state).map((tpl) => (
              <button key={tpl.when} type="button" className="idea" onClick={() => { setV(tpl.form()); setErrors([]); }}>
                <span className="idea-when">{tpl.when}</span>
                <span className="idea-then"><ArrowRight size={16} /> {tpl.then}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Field label="Name your routine" grow>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Kitchen motion lights" maxLength={80} />
      </Field>

      <fieldset className="step step-when">
        <legend><Zap size={16} /> 1 · When this happens</legend>
        <Field label="What should start it?">
          <select value={t.kind} onChange={(e) => changeTriggerKind(e.target.value as Trigger['kind'])} aria-label="Trigger">
            {TRIGGERS.map((o) => <option key={o.kind} value={o.kind}>{o.label}</option>)}
          </select>
        </Field>
        {t.kind === 'time' ? (
          <>
            <Field label="Time">
              <input type="time" value={t.at} onChange={(e) => setTrigger({ at: e.target.value })} aria-label="Trigger time" />
            </Field>
            <p className="help-text step-help">Pick any time. For sunset, about 6:30 PM works — NexaHome doesn't look up real sunset times, so change it to suit where you live.</p>
          </>
        ) : t.kind === 'scene_started' ? (
          <>
            <Field label="Quick action">
              <select value={t.sceneId} onChange={(e) => setTrigger({ sceneId: e.target.value })} aria-label="Quick action">
                {state.scenes.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </Field>
            <p className="help-text step-help">Runs when you tap Start on this quick action — for example Away Mode when you leave home.</p>
          </>
        ) : (
          <DeviceSelect state={state} type={triggerType!} value={t.deviceId} onChange={(deviceId) => setTrigger({ deviceId })} label="Sensor" />
        )}
        {(t.kind === 'temp_above' || t.kind === 'temp_below' || t.kind === 'humidity_above') && (
          <Field label={t.kind === 'humidity_above' ? 'Threshold (%)' : `Threshold (°${unit})`}>
            <input type="number" step={t.kind === 'humidity_above' ? 1 : 0.1} value={t.threshold} onChange={(e) => setTrigger({ threshold: e.target.value })} aria-label="Threshold" />
          </Field>
        )}
      </fieldset>



      <fieldset className="step step-then">
        <legend><Play size={16} /> 2 · Do this</legend>
        {v.actions.map((a, i) => {
          const devType = actionDeviceType(a.kind);
          return (
            <div key={a.key} className="step-row" data-testid="action-row">
              <Field label={`Action ${i + 1}`}>
                <select
                  value={a.kind}
                  aria-label={`Action ${i + 1} type`}
                  onChange={(e) => setV((p) => ({ ...p, actions: p.actions.map((x) => (x.key === a.key ? { ...blankAction(state, e.target.value as RuleAction['kind']), key: a.key } : x)) }))}
                >
                  {ACTIONS.map((o) => <option key={o.kind} value={o.kind}>{o.label}</option>)}
                </select>
              </Field>
              {devType && <DeviceSelect state={state} type={devType} value={a.deviceId} onChange={(deviceId) => setAct(a.key, { deviceId })} label={`Action ${i + 1} device`} />}
              {a.kind === 'light_set' && (
                <>
                  <Field label="Brightness %"><input type="number" min={1} max={100} value={a.brightness} onChange={(e) => setAct(a.key, { brightness: e.target.value })} aria-label={`Action ${i + 1} brightness`} /></Field>
                  <Field label="Colour"><input type="color" value={HEX_RE.test(a.color) ? a.color : '#ffffff'} onChange={(e) => setAct(a.key, { color: e.target.value })} aria-label={`Action ${i + 1} colour`} /></Field>
                </>
              )}
              {a.kind === 'set_thermostat' && (
                <>
                  <Field label="Mode">
                    <select value={a.mode} onChange={(e) => setAct(a.key, { mode: e.target.value as ThermostatMode })} aria-label={`Action ${i + 1} mode`}>
                      {(['off', 'heat', 'cool', 'auto'] as const).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                    </select>
                  </Field>
                  {a.mode !== 'off' && <Field label={`Target °${unit}`}><input type="number" step="0.5" value={a.target} onChange={(e) => setAct(a.key, { target: e.target.value })} aria-label={`Action ${i + 1} target`} /></Field>}
                </>
              )}
              {a.kind === 'all_off' && (
                <Field label="What">
                  <select value={a.allOff} onChange={(e) => setAct(a.key, { allOff: e.target.value as 'lights' | 'appliances' })} aria-label={`Action ${i + 1} what`}>
                    <option value="lights">All lights</option>
                    <option value="appliances">All appliances</option>
                  </select>
                </Field>
              )}
              {a.kind === 'arm_security' && (
                <Field label="Security">
                  <select value={a.armed ? 'arm' : 'disarm'} onChange={(e) => setAct(a.key, { armed: e.target.value === 'arm' })} aria-label={`Action ${i + 1} security`}>
                    <option value="arm">Turn on</option>
                    <option value="disarm">Turn off</option>
                  </select>
                </Field>
              )}
              {a.kind === 'activate_scene' && (
                <Field label="Scene">
                  <select value={a.sceneId} onChange={(e) => setAct(a.key, { sceneId: e.target.value })} aria-label={`Action ${i + 1} scene`}>
                    {state.scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              )}
              {a.kind === 'notify' && (
                <Field label="Message" grow>
                  <input value={a.message} onChange={(e) => setAct(a.key, { message: e.target.value })} placeholder="e.g. Back door was opened" maxLength={140} aria-label={`Action ${i + 1} message`} />
                </Field>
              )}
              <button type="button" className="icon-btn danger" disabled={v.actions.length === 1} aria-label={`Remove action ${i + 1}`} onClick={() => setV((p) => ({ ...p, actions: p.actions.filter((x) => x.key !== a.key) }))}><X size={16} /></button>
            </div>
          );
        })}
        <button type="button" className="btn small" disabled={v.actions.length >= MAX_ACTIONS} onClick={() => setV((p) => ({ ...p, actions: [...p.actions, blankAction(state)] }))}><Plus size={16} /> Add another action</button>
      </fieldset>

      <Disclosure advanced label="Only run at certain times or situations" hint="Optional — most routines don't need this" defaultOpen={v.conditions.length > 0}>
        <fieldset className="step step-if">
        
        {v.conditions.length === 0 && <p className="muted small step-empty">No conditions: the routine runs every time step 1 happens.</p>}
        {v.conditions.map((c, i) => (
          <div key={c.key} className="step-row" data-testid="condition-row">
            <Field label={`Condition ${i + 1}`}>
              <select
                value={c.kind}
                aria-label={`Condition ${i + 1} type`}
                onChange={(e) => setV((p) => ({ ...p, conditions: p.conditions.map((x) => (x.key === c.key ? { ...blankCondition(state, e.target.value as Condition['kind']), key: c.key } : x)) }))}
              >
                {CONDITIONS.map((o) => <option key={o.kind} value={o.kind}>{o.label}</option>)}
              </select>
            </Field>
            {c.kind === 'time_between' && (
              <>
                <Field label="From"><input type="time" value={c.from} onChange={(e) => setCond(c.key, { from: e.target.value })} aria-label={`Condition ${i + 1} from`} /></Field>
                <Field label="To"><input type="time" value={c.to} onChange={(e) => setCond(c.key, { to: e.target.value })} aria-label={`Condition ${i + 1} to`} /></Field>
              </>
            )}
            {c.kind === 'security_is' && (
              <Field label="State">
                <select value={c.armed ? 'armed' : 'disarmed'} onChange={(e) => setCond(c.key, { armed: e.target.value === 'armed' })} aria-label={`Condition ${i + 1} security state`}>
                  <option value="armed">On</option>
                  <option value="disarmed">Off</option>
                </select>
              </Field>
            )}
            {c.kind === 'device_is' && (
              <>
                <DeviceSelect state={state} type="switchable" value={c.deviceId} onChange={(deviceId) => setCond(c.key, { deviceId })} label={`Condition ${i + 1} device`} />
                <Field label="Is">
                  <select value={c.on ? 'on' : 'off'} onChange={(e) => setCond(c.key, { on: e.target.value === 'on' })} aria-label={`Condition ${i + 1} on or off`}>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </Field>
              </>
            )}
            {c.kind === 'temp_is' && (
              <>
                <DeviceSelect state={state} type="climate" value={c.deviceId} onChange={(deviceId) => setCond(c.key, { deviceId })} label={`Condition ${i + 1} sensor`} />
                <Field label="Is">
                  <select value={c.op} onChange={(e) => setCond(c.key, { op: e.target.value as 'above' | 'below' })} aria-label={`Condition ${i + 1} comparison`}>
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </Field>
                <Field label={`°${unit}`}><input type="number" step="0.1" value={c.value} onChange={(e) => setCond(c.key, { value: e.target.value })} aria-label={`Condition ${i + 1} temperature`} /></Field>
              </>
            )}
            <button type="button" className="icon-btn danger" aria-label={`Remove condition ${i + 1}`} onClick={() => setV((p) => ({ ...p, conditions: p.conditions.filter((x) => x.key !== c.key) }))}><X size={16} /></button>
          </div>
        ))}
        <button type="button" className="btn small" onClick={() => setV((p) => ({ ...p, conditions: [...p.conditions, blankCondition(state)] }))}><Plus size={16} /> Add a condition</button>
      </fieldset>
      </Disclosure>

      {errors.length > 0 && (
        <ul className="form-errors" role="alert">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="row end">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn primary">{editing ? 'Save changes' : 'Save routine'}</button>
      </div>
    </form>
  );
}

// ---------- page ----------

export function Automations() {
  const { state, dispatch } = useStore();
  const flash = useFlash();
  const now = useNow();
  const [mode, setMode] = useState<'closed' | 'new' | Rule>('closed');
  const unit = state.settings.tempUnit;
  const editing = typeof mode === 'object' ? mode : null;

  const remove = (rule: Rule) => {
    if (window.confirm(`Delete the routine “${rule.name}”?`)) {
      dispatch({ type: 'rule/delete', ruleId: rule.id });
      flash('Routine deleted');
    }
  };

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle={<>Routines make your home do things by itself — like turning on a light when someone walks in. <strong>{state.rules.filter((r) => r.enabled).length} of {state.rules.length}</strong> routines are active.</>}
        actions={mode === 'closed' && <button className="btn primary big" onClick={() => setMode('new')}><Plus size={20} /> Create a Routine</button>}
      />

      {mode !== 'closed' && (
        <Card title={editing ? `Edit “${editing.name}”` : 'Create a Routine'} icon={<Workflow size={18} />} actions={<button className="icon-btn" aria-label="Close form" onClick={() => setMode('closed')}><X size={18} /></button>}>
          <RuleForm key={editing?.id ?? 'new'} editing={editing} onDone={() => setMode('closed')} />
        </Card>
      )}

      {state.rules.length === 0 ? (
        <EmptyState icon={<Workflow size={28} />} title="No routines yet">Tap “Create a Routine” to make your home do something by itself.</EmptyState>
      ) : (
        <div className="rules">
          {state.rules.map((rule) => (
            <div key={rule.id} className={`rule ${rule.enabled ? '' : 'disabled'}`} data-testid={`rule-${rule.id}`}>
              <Toggle checked={rule.enabled} onText="Active" offText="Paused" label={`${rule.enabled ? 'Pause' : 'Start'} routine ${rule.name}`} onChange={() => dispatch({ type: 'rule/toggle', ruleId: rule.id })} />
              <div className="rule-body">
                <div className="rule-name">
                  {rule.name} {!rule.enabled && <Status tone="neutral">Paused</Status>}
                </div>
                <div className="rule-flow">
                  <span className="pill when">When {describeTrigger(state, rule.trigger, unit)}</span>
                  {rule.conditions.map((c, i) => <span key={i} className="pill if">Only if {describeCondition(state, c, unit)}</span>)}
                  <ArrowRight size={14} />
                  {rule.actions.map((a, i) => <span key={i} className="pill then">{describeAction(state, a, unit)}</span>)}
                </div>
                <div className="device-meta">Has run {rule.runCount} time{rule.runCount === 1 ? '' : 's'} · last {relativeTime(rule.lastRunAt, now)}</div>
              </div>
              <div className="rule-actions">
                <button className="btn small" title="Do the actions right now, to see what happens" aria-label={`Try routine ${rule.name} now`} onClick={() => {
                    dispatch({ type: 'rule/test', ruleId: rule.id });
                    flash(`“${rule.name}” ran`);
                  }}><Play size={16} /> Try it now</button>
                <button className="btn small" aria-label={`Edit routine ${rule.name}`} onClick={() => setMode(rule)}><Pencil size={16} /> Edit</button>
                <button className="btn small ghost danger" aria-label={`Delete routine ${rule.name}`} onClick={() => remove(rule)}><Trash2 size={16} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
