// End-to-end test: drives the real app in your installed Google Chrome.
// Usage: start the app (npm run dev), then in another terminal: npm run test:e2e
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const errors = [];
let passed = 0;
let failed = 0;
let page;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    await page?.screenshot({ path: SHOTS + `FAILED-${name.slice(0, 40).replace(/[^a-z0-9]+/gi, '-')}.png` }).catch(() => {});
    console.error(`  ✗ ${name}\n    ${e.message.split('\n')[0]}`);
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}
/** Retry an async check — the UI re-renders just after a click. */
async function until(check, msg, ms = 4000) {
  const end = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > end) throw new Error(msg);
    await new Promise((r) => setTimeout(r, 100));
  }
}
const watch = (p, label) => {
  p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`${label} console: ${m.text()}`));
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
page = await context.newPage();
watch(page, 'desktop');

const h1 = (name) => page.getByRole('heading', { level: 1, name }).waitFor();
const go = async (path, heading) => {
  await page.goto(BASE + path);
  await h1(heading);
};
const nav = async (label) => {
  await page.locator('.side-nav').getByRole('link', { name: new RegExp(`^${label}`) }).click();
  // Wait until the new page has replaced the old one (Home's heading is a greeting).
  await page.getByRole('heading', { level: 1, name: label === 'Home' ? /^Good / : label }).waitFor();
};
const sw = (name) => page.getByRole('switch', { name, exact: true });
const btn = (name) => page.getByRole('button', { name, exact: true });
const open = (label) => page.getByRole('button', { name: new RegExp(`^(Advanced\\s*)?${label}`) }).first().click();
const toast = (text, timeout = 4000) => page.locator('.toast', { hasText: text }).first().waitFor({ timeout });
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('smartnest:v2') ?? 'null'));
const device = async (id) => (await stored()).devices.find((d) => d.id === id);

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
// Pretend movement could switch lights mid-check, so turn it off for deterministic results.
await nav('Settings');
await open('Demo simulation');
await sw('Random motion').click();

console.log('Look & navigation');
await step('light ivory theme by default, 4 main menu items with text labels', async () => {
  await nav('Home');
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'not light theme');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg === 'rgb(245, 240, 231)', `background is ${bg}, expected ivory #F5F0E7`);
  const labels = await page.locator('.side-nav .nav-label').allTextContents();
  expect(labels.join() === 'Home,Rooms,Automations,Settings', `menu is ${labels.join()}`);
});

console.log('Home');
await step('welcome, home status, favourites, quick actions and room photos', async () => {
  await page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening|night)/ }).waitFor();
  await page.getByRole('heading', { name: 'A few things need a look' }).waitFor(); // bedroom window starts open
  expect((await page.locator('.status-list').textContent()).includes('Bedroom Window is open'), 'open window not listed');
  expect((await page.locator('.fav-tile').count()) === 6, 'expected 6 favourites');
  const quick = (await page.locator('.scene-tile strong').allTextContents()).join();
  expect(quick === 'Good Morning,Good Night,Away Mode,All lights off', `Home quick actions are ${quick}`);
  expect((await page.locator('.room-grid .room-card').count()) === 6, 'expected 6 room cards');
  expect((await page.getByRole('img', { name: /A (cosy|quiet) house/ }).count()) === 1, 'home illustration missing');
  expect((await page.locator('.recharts-wrapper').count()) === 0, 'Home should not show charts');
  for (const card of await page.locator('.room-card').all()) await card.scrollIntoViewIfNeeded();
  await until(() => page.evaluate(() => [...document.querySelectorAll('.room-card img')].every((i) => i.complete && i.naturalWidth > 0)), 'room photos did not load');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: SHOTS + 'home.png', fullPage: true });
});
await step('one-tap fixes: mark window closed → "Everything looks good" + friendly confirmation', async () => {
  await btn('Mark as closed').click();
  await page.getByRole('heading', { name: 'Everything looks good' }).waitFor();
  await page.locator('.flash', { hasText: 'Bedroom Window marked as closed' }).waitFor();
});
await step('Good Night quick action from Home shows a confirmation', async () => {
  await btn('Start Good Night').click();
  await page.locator('.flash', { hasText: 'Good Night started' }).waitFor();
  await until(async () => (await device('light-bedside'))?.brightness === 8, 'Good Night did not run');
  await btn('Start Good Morning').click();
  await until(async () => !(await stored()).settings.securityArmed, 'Good Morning did not run');
});
await step('keyboard: first Tab shows "Skip to main content"', async () => {
  await page.goto(BASE + '/');
  await page.locator('h1').first().waitFor();
  await page.keyboard.press('Tab');
  expect((await page.evaluate(() => document.activeElement?.textContent)) === 'Skip to main content', 'skip link not first');
  await page.keyboard.press('Enter');
  expect((await page.evaluate(() => document.activeElement?.id)) === 'main', 'skip link did not move focus');
});
await step('favourite tile shows On/Off in words and toggles in one tap', async () => {
  const off = page.getByRole('button', { name: /^Smart TV, Living Room: Off/ });
  expect((await off.locator('.fav-state').textContent()) === 'Off', 'Off text missing');
  await off.click();
  const on = page.getByRole('button', { name: /^Smart TV, Living Room: On/ });
  expect((await on.locator('.fav-state').textContent()) === 'On', 'On text missing');
  await on.click();
});
await step('Away protection can be turned on and off from Home', async () => {
  await page.locator('.status-list li', { hasText: 'Away protection' }).getByRole('button', { name: 'Turn On' }).click();
  await until(async () => (await stored()).settings.securityArmed, 'not armed');
  await page.locator('.status-list li', { hasText: 'Away protection' }).getByRole('button', { name: 'Turn Off' }).click();
  await until(async () => !(await stored()).settings.securityArmed, 'not disarmed');
});

console.log('Rooms');
await step('rooms page with browse-by-type shortcuts', async () => {
  await nav('Rooms');
  for (const name of ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Entrance', 'Study Room']) {
    expect((await page.getByRole('link', { name: `Open ${name}` }).count()) === 1, `missing room ${name}`);
  }
  for (const t of ['Lights', 'Temperature', 'Doors & Safety', 'Doorbell', 'Quick actions']) {
    expect((await page.locator('.link-tile', { hasText: t }).count()) >= 1, `missing shortcut ${t}`);
  }
});
await step('room page: big Turn On button, all lights, add to Home', async () => {
  await page.getByRole('link', { name: 'Open Bathroom' }).click();
  await h1('Bathroom');
  expect((await page.locator('.room-hero').textContent()).includes('humidity'), 'room humidity missing');
  await btn('Turn On Exhaust Fan').click();
  await btn('Turn Off Exhaust Fan').waitFor();
  expect((await page.getByTestId('appliance-fan-bathroom').locator('.status').textContent()) === 'On', 'status word missing');
  await btn('Turn on all lights').click();
  await until(async () => (await device('light-bathroom'))?.on && (await device('light-mirror'))?.on, 'room lights not on');
  await btn('Add Exhaust Fan to Home').click();
  await page.locator('.flash', { hasText: 'Exhaust Fan added to Home' }).waitFor();
  await nav('Home');
  await page.getByRole('button', { name: /^Exhaust Fan, Bathroom: On/ }).waitFor();
  await go('/rooms/room-bathroom', 'Bathroom');
  await btn('Remove Exhaust Fan from Home').click();
  await page.screenshot({ path: SHOTS + 'room-bathroom.png', fullPage: true });
});
await step('heating & cooling: warmer/cooler and plain-language modes', async () => {
  await go('/rooms/room-living', 'Living Room');
  const card = page.getByTestId('thermostat-thermo-living');
  const start = (await device('thermo-living')).target;
  await card.getByRole('button', { name: 'Make Living Thermostat warmer' }).click();
  await until(async () => (await device('thermo-living'))?.target === start + 0.5, 'target did not rise');
  expect((await card.textContent()).includes(`${(start + 0.5).toFixed(1)}°C`), 'new target not shown');
  await card.getByRole('button', { name: 'Warm up' }).click();
  await until(async () => (await device('thermo-living'))?.mode === 'heat', 'mode not saved');
  expect((await card.textContent()).includes('Warms the room up'), 'mode explanation missing');
  await card.getByRole('button', { name: 'Off', exact: true }).click();
  expect(await card.getByRole('button', { name: 'Make Living Thermostat warmer' }).isDisabled(), '+ should be disabled when off');
  await card.getByRole('button', { name: 'Automatic' }).click();
});

console.log('Lights');
await step('brightness & colour behind a labelled button; settings remembered', async () => {
  await go('/lighting', 'Lights');
  const card = page.getByTestId('light-light-living-lamp');
  await card.getByRole('button', { name: 'Turn On Floor Lamp' }).click();
  await card.getByRole('button', { name: /^Brightness & colour/ }).click();
  await card.getByLabel('Brightness for Floor Lamp').fill('35');
  await card.getByRole('button', { name: 'Ocean for Floor Lamp' }).click();
  await until(async () => (await card.textContent()).includes('Shining at 35%'), 'brightness not shown');
  await card.getByRole('button', { name: 'Turn Off Floor Lamp' }).click();
  await card.getByRole('button', { name: 'Turn On Floor Lamp' }).click();
  await until(async () => (await device('light-living-lamp'))?.color === '#4aa8ff' && (await device('light-living-lamp'))?.brightness === 35, 'not remembered');
});
await step('light mood for one room; room choice remembered after reload', async () => {
  await page.getByRole('tab', { name: 'Bedroom' }).click();
  const kitchenBefore = await device('light-kitchen');
  await page.getByRole('button', { name: /^Night light/ }).click();
  await until(async () => (await device('light-bedside'))?.brightness === 8 && (await device('light-bedroom-main'))?.on, 'mood not applied');
  const kitchenAfter = await device('light-kitchen');
  expect(kitchenAfter.brightness === kitchenBefore.brightness && kitchenAfter.color === kitchenBefore.color, 'mood leaked to other rooms');
  await page.reload();
  await h1('Lights');
  expect((await page.getByRole('tab', { name: 'Bedroom' }).getAttribute('aria-selected')) === 'true', 'room choice not remembered');
  await page.getByRole('tab', { name: 'All rooms' }).click();
  await page.screenshot({ path: SHOTS + 'lights.png', fullPage: true });
});

console.log('Quick actions (scenes)');
await step('Movie Night changes several devices', async () => {
  await go('/scenes', 'Quick actions');
  await btn('Start Movie Night').click();
  await until(async () => (await btn('Start Movie Night').textContent()).includes('Running'), 'not shown as running');
  await until(async () => {
    const s = await stored();
    const get = (id) => s.devices.find((d) => d.id === id);
    return get('tv-living').on && !get('light-living-main').on && get('light-living-strip').brightness === 35;
  }, 'Movie Night device states wrong');
});
await step('Away Mode, Good Night and Good Morning', async () => {
  await btn('Start Away Mode').click();
  await until(async () => (await stored()).settings.securityArmed, 'Away Mode did not protect home');
  const s = await stored();
  expect(s.devices.filter((d) => d.type === 'light' && d.on).map((d) => d.id).join() === 'light-porch', 'Away Mode lights wrong');
  await btn('Start Good Night').click();
  await until(async () => (await device('thermo-bedroom'))?.mode === 'cool', 'Good Night thermostat not set');
  await btn('Start Good Morning').click();
  await until(async () => !(await stored()).settings.securityArmed && (await device('plug-coffee'))?.on, 'Good Morning did not run');
  await page.screenshot({ path: SHOTS + 'quick-actions.png', fullPage: true });
});

console.log('Doors & Safety');
await step('test-open a door → alert + routine alert + safety history', async () => {
  await go('/security', 'Doors & Safety');
  await page.getByTestId('contact-contact-front').getByRole('button', { name: 'Test: open the door' }).click();
  await toast('Front Door OPENED');
  await toast('The front door was opened.');
  expect((await page.getByTestId('contact-contact-front').locator('.status').textContent()).includes('Open'), 'Open word missing');
  await open('Safety history');
  await until(async () => (await page.locator('.activity').textContent()).includes('Front Door OPENED'), 'history missing event');
});
await step('Away protection raises urgent alerts for windows and movement', async () => {
  await btn('Turn On protection').click();
  await page.getByTestId('contact-contact-bathroom-window').getByRole('button', { name: 'Test: open the window' }).click();
  await page.locator('.toast-alert', { hasText: 'Bathroom Window OPENED' }).waitFor();
  await page.getByTestId('motion-motion-kitchen').getByRole('button', { name: 'Test: someone walks by' }).click();
  await page.locator('.toast-alert', { hasText: 'Motion detected by Kitchen Motion' }).waitFor();
  await page.screenshot({ path: SHOTS + 'safety.png', fullPage: true });
  await btn('Mark all as closed').click();
  await btn('Turn Off protection').click();
  await btn('Turn On protection').waitFor();
});
await step('entrance movement runs the hall-light routine', async () => {
  await page.getByTestId('motion-motion-entrance').getByRole('button', { name: 'Test: someone walks by' }).click();
  await until(async () => (await device('light-hall'))?.on, 'hall light not switched on by routine');
});

console.log('Temperature');
await step('temperature & humidity shown simply; chart is an advanced option', async () => {
  await go('/climate', 'Temperature');
  const card = page.getByTestId('climate-climate-kitchen');
  expect((await card.textContent()).includes('how damp the air is'), 'humidity not explained');
  expect((await page.locator('.recharts-wrapper').count()) === 0, 'chart should be hidden until asked for');
  await open('Temperature history');
  // The chart code loads on demand; a "Loading chart…" message may show briefly first.
  await page.locator('.recharts-wrapper').first().waitFor();
  const before = (await device('climate-kitchen')).readings.length;
  await btn('New reading').click();
  await until(async () => (await device('climate-kitchen')).readings.length > before, 'reading not added');
  await btn('Humidity').click();
  await until(async () => /\d+%/.test(await page.locator('.chart').textContent()), 'humidity axis missing');
  await page.getByRole('combobox', { name: 'Room to show' }).selectOption({ label: 'Bathroom Sensor' });
  await until(async () => (await page.locator('.chart path.recharts-area-curve').count()) === 1, 'room filter did not narrow chart');
  await btn('15 min').click();
  await btn('°F').click();
  await until(async () => (await card.textContent()).includes('°F'), 'unit not switched');
  await page.screenshot({ path: SHOTS + 'temperature.png', fullPage: true });
  await btn('°C').click();
  await btn('Temperature').click();
});
await step('test temperature fires the automatic cooling routine (2 actions)', async () => {
  await nav('Settings');
  await open('Set a test temperature');
  await page.getByRole('combobox', { name: 'Sensor', exact: true }).selectOption({ label: 'Living Room Sensor' });
  await page.getByLabel('Temperature value').fill('24');
  await btn('Set').click();
  await page.getByText(/^Done — Living Room Sensor now reads 24/).waitFor();
  await page.getByLabel('Temperature value').fill('27.5');
  await btn('Set').click();
  await until(async () => (await device('thermo-living'))?.mode === 'cool' && (await device('fan-living'))?.on, 'cooling routine did not run');
  await page.getByLabel('Temperature value').fill('999');
  await btn('Set').click();
  await page.getByText(/Enter a temperature between/).waitFor();
});

console.log('Doorbell');
await step('ring → pretend visitor, alert, history; answered; shows on Home; clear list', async () => {
  await go('/doorbell', 'Doorbell');
  await page.getByText(/no camera or video/).waitFor();
  expect((await page.locator('.simple-status').textContent()).includes('Doorbell: Ready'), 'doorbell status missing');
  await btn('Ring Front Doorbell').click();
  await toast('is at the door');
  expect((await page.locator('.toast', { hasText: 'is at the door' }).first().textContent()).includes('Demo'), 'doorbell pop-up not marked Demo');
  await until(async () => (await page.getByTestId('visitor').count()) === 1, 'no visitor in list');
  expect((await page.getByTestId('visitor').first().textContent()).includes('Demo'), 'visitor not marked Demo');
  expect((await page.locator('.simple-status').textContent()).includes('Someone is waiting'), 'doorbell status not updated');
  await until(async () => (await device('light-porch'))?.brightness === 100, 'porch light routine did not run');
  await page.getByRole('button', { name: /^Mark .* as answered$/ }).click();
  await until(async () => (await page.getByTestId('visitor').first().textContent()).includes('Answered'), 'not marked answered');
  await btn('Ring Front Doorbell').click();
  await nav('Home');
  await until(async () => (await page.locator('.status-list').textContent()).includes('rang the doorbell'), 'waiting visitor not on Home');
  await page.getByRole('link', { name: 'See visitor' }).click();
  await h1('Doorbell');
  await open('Doorbell history');
  expect((await page.locator('.activity').textContent()).includes('simulated visitor'), 'doorbell history missing');
  await page.screenshot({ path: SHOTS + 'doorbell.png', fullPage: true });
  await page.getByRole('button', { name: 'Clear list' }).click();
  await page.getByText('No visitors yet').waitFor();
});

console.log('Automations');
await step('"Create a Routine" validation lists every problem', async () => {
  await nav('Automations');
  await btn('Create a Routine').click();
  await page.getByRole('combobox', { name: 'Action 1 type' }).selectOption('notify');
  await btn('Save routine').click();
  await page.getByText('Give the rule a name.').waitFor();
  await page.getByText('Action: write the notification message.').waitFor();
});
await step('ideas prefill the form; conditions hidden under Advanced', async () => {
  for (const idea of ['When I wake up', 'At sunset', 'When I leave home']) {
    expect((await page.getByRole('button', { name: new RegExp(idea) }).count()) === 1, `missing idea: ${idea}`);
  }
  await page.getByRole('button', { name: /When the front door opens/ }).click();
  expect((await page.getByPlaceholder('e.g. Kitchen motion lights').inputValue()) === 'Front door notification', 'idea not applied');
  expect((await page.getByRole('button', { name: 'Add a condition' }).count()) === 0, 'conditions should start hidden');
});
await step('time trigger + condition + 2 actions routine runs on schedule', async () => {
  const at = await page.evaluate(() => {
    const d = new Date(Date.now() + (new Date().getSeconds() > 50 ? 15_000 : 0));
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  await page.getByPlaceholder('e.g. Kitchen motion lights').fill('Scheduled speaker');
  await page.getByRole('combobox', { name: 'Trigger', exact: true }).selectOption('time');
  await page.getByLabel('Trigger time').fill(at);
  await page.getByRole('combobox', { name: 'Action 1 type' }).selectOption('turn_on');
  await page.getByRole('combobox', { name: 'Action 1 device' }).selectOption({ label: 'Kitchen Speaker' });
  await btn('Add another action').click();
  await page.getByRole('combobox', { name: 'Action 2 type' }).selectOption('notify');
  await page.getByLabel('Action 2 message').fill('Scheduled rule ran!');
  await open('Only run at certain times or situations');
  await btn('Add a condition').click();
  await page.getByRole('combobox', { name: 'Condition 1 type' }).selectOption('security_is');
  await page.getByRole('combobox', { name: 'Condition 1 security state' }).selectOption('disarmed');
  await page.screenshot({ path: SHOTS + 'create-routine.png', fullPage: true });
  await btn('Save routine').click();
  await page.locator('.rule-name', { hasText: 'Scheduled speaker' }).waitFor();
  await toast('Scheduled rule ran!', 70_000);
  await until(async () => (await device('speaker-kitchen'))?.on, 'scheduled routine did not turn on the speaker');
  await until(async () => (await page.locator('.rule', { hasText: 'Scheduled speaker' }).textContent()).includes('Has run 1 time'), 'run count not shown');
});
await step('a condition stops the routine when it is not met', async () => {
  await btn('Edit routine Scheduled speaker').click();
  await page.getByRole('combobox', { name: 'Condition 1 security state' }).selectOption('armed');
  await page.getByRole('combobox', { name: 'Trigger', exact: true }).selectOption('motion_detected');
  await page.getByRole('combobox', { name: 'Sensor' }).selectOption({ label: 'Living Room Motion' });
  await btn('Save changes').click();
  await page.getByText('Only if Away protection is on').waitFor();
  await go('/security', 'Doors & Safety');
  await page.getByTestId('motion-motion-living').getByRole('button', { name: 'Test: someone walks by' }).click();
  await go('/activity', 'History');
  await until(async () => (await page.locator('.activity').textContent()).includes('“Scheduled speaker” triggered but its conditions were not met'), 'condition not evaluated');
});
await step('try now, pause and delete a routine (buttons have text)', async () => {
  await nav('Automations');
  await btn('Try routine Scheduled speaker now').click();
  await toast('Scheduled rule ran!');
  await sw('Pause routine Scheduled speaker').click();
  await sw('Start routine Scheduled speaker').waitFor();
  expect((await page.locator('.rule', { hasText: 'Scheduled speaker' }).textContent()).includes('Paused'), 'Paused word missing');
  const before = await page.locator('.rule').count();
  await btn('Delete routine Scheduled speaker').click();
  await until(async () => (await page.locator('.rule').count()) === before - 1, 'routine not deleted');
  await page.screenshot({ path: SHOTS + 'automations.png', fullPage: true });
});

await step('"When I leave home" idea runs when Away Mode starts', async () => {
  await btn('Create a Routine').click();
  await page.getByRole('button', { name: /When I leave home/ }).click();
  expect((await page.getByRole('combobox', { name: 'Quick action' }).inputValue()) === 'scene-away', 'Away Mode not chosen');
  await btn('Save routine').click();
  await page.locator('.flash', { hasText: 'Routine “Leaving home” saved' }).waitFor();
  await page.getByText('When I start “Away Mode”').waitFor();
  await nav('Home');
  await btn('Start Away Mode').click();
  await until(async () => (await stored()).rules.find((r) => r.name === 'Leaving home')?.runCount === 1, 'leaving-home routine did not run');
  await btn('Start Good Morning').click();
});

console.log('Alerts');
await step('Alerts button, popover, mark read, delete, delete all', async () => {
  const bell = page.getByRole('button', { name: /^Alerts/ });
  expect(/\(\d+ new\)/.test(await bell.getAttribute('aria-label')), 'no new-alert count');
  await bell.click();
  await page.getByRole('dialog', { name: 'Recent alerts' }).waitFor();
  await btn('Mark all as read').click();
  await until(async () => (await bell.getAttribute('aria-label')) === 'Alerts', 'mark all read did not clear count');
  await page.getByRole('link', { name: 'See all alerts' }).click();
  await h1('Alerts');
  await go('/doorbell', 'Doorbell');
  await btn('Ring Front Doorbell').click();
  await go('/notifications', 'Alerts');
  const item = page.getByTestId('notification').filter({ hasText: 'is at the door' }).first();
  expect((await item.getAttribute('class')).includes('unread'), 'new alert not marked new');
  expect((await item.textContent()).includes('New'), '"New" word missing');
  await item.locator('.notif-body').click();
  await until(async () => (await item.getAttribute('class')).includes(' read'), 'tap did not mark as read');
  const count = await page.getByTestId('notification').count();
  await page.getByRole('button', { name: /^Delete alert/ }).first().click();
  await until(async () => (await page.getByTestId('notification').count()) === count - 1, 'delete failed');
  await btn('Delete all').click();
  await page.getByText('No alerts').waitFor();
});

console.log('History');
await step('timestamps, simple filters, advanced filters', async () => {
  await nav('Settings');
  await page.getByRole('link', { name: /See everything that happened/ }).click();
  await h1('History');
  await until(async () => (await page.locator('.activity li').count()) > 10, 'too few entries');
  expect((await page.locator('.activity time').first().textContent()).match(/\d{1,2}:\d{2}/), 'no timestamp');
  await page.getByRole('tab', { name: 'Quick actions' }).click();
  await until(async () => (await page.locator('.activity-msg').allTextContents()).every((m) => m.startsWith('Scene')), 'quick-action filter wrong');
  await page.getByRole('tab', { name: 'Everything' }).click();
  await open('More filters, chart and export');
  await page.getByRole('combobox', { name: 'Importance' }).selectOption('alert');
  await until(async () => (await page.locator('.activity li').count()) > 0 && (await page.locator('.activity li:not(.sev-alert)').count()) === 0, 'importance filter wrong');
  await page.getByRole('combobox', { name: 'Importance' }).selectOption('all');
  await page.getByLabel('Search history').fill('Rule “');
  await until(async () => (await page.locator('.activity-msg').allTextContents()).every((m) => m.includes('Rule “')), 'search wrong');
  await page.getByLabel('Search history').fill('');
  await btn('Clear history').click();
  await page.getByText('No activity yet').waitFor();
});

console.log('Settings');
await step('add a room and a device, rename, remove', async () => {
  await nav('Settings');
  await open('Your rooms');
  await page.getByLabel('New room name').fill('Guest Bath');
  await page.getByRole('combobox', { name: 'Room photo' }).selectOption('bathroom');
  await btn('Add room').click();
  await open('Your devices');
  await page.getByLabel('New device name').fill('Guest Fan');
  await page.getByRole('combobox', { name: 'Device type' }).selectOption('appliance');
  await page.getByRole('combobox', { name: 'Appliance kind' }).selectOption('fan');
  await page.getByLabel('Room for new device').selectOption({ label: 'Guest Bath' });
  await btn('Add device').click();
  await page.getByText('Added “Guest Fan”.').waitFor();
  await page.getByLabel('Name of Guest Fan').fill('Guest Exhaust');
  await btn('Save Guest Fan').click();
  await page.getByLabel('Name of Guest Exhaust').waitFor();
  await nav('Rooms');
  await page.getByRole('link', { name: 'Open Guest Bath' }).click();
  await btn('Turn On Guest Exhaust').click();
  await btn('Turn Off Guest Exhaust').waitFor();
  await nav('Settings');
  await open('Your devices');
  await open('Your rooms');
  expect(await btn('Remove room Guest Bath').isDisabled(), 'room with devices should not be removable');
  await btn('Remove Guest Exhaust').click();
  await btn('Remove room Guest Bath').click();
  await until(async () => (await page.getByLabel('Remove room Guest Bath').count()) === 0, 'room not removed');
});
await step('Night theme, larger text — both saved after reload', async () => {
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Night' }).click();
  await until(() => page.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'night theme not applied');
  await sw('Larger text').click();
  await until(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize === '18.5px'), 'larger text not applied');
  await page.waitForTimeout(400);
  await page.reload();
  await h1('Settings');
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'theme not saved');
  expect((await page.evaluate(() => document.documentElement.dataset.text)) === 'large', 'text size not saved');
  await nav('Home');
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOTS + 'home-night-large.png' });
  await nav('Settings');
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Light' }).click();
  await sw('Larger text').click();
});
await step('demo simulation runs on its own and can be paused', async () => {
  await open('Demo simulation');
  await page.getByRole('combobox', { name: 'Update interval' }).selectOption('2');
  const before = (await device('climate-bedroom')).readings.length;
  await page.waitForTimeout(4600);
  expect((await device('climate-bedroom')).readings.length >= before + 2, 'simulation did not tick');
  await sw('Run simulation').click();
  const paused = (await device('climate-bedroom')).readings.length;
  await page.waitForTimeout(2600);
  expect((await device('climate-bedroom')).readings.length === paused, 'simulation kept running while paused');
  await sw('Run simulation').click();
});
await step('reset demo data (behind Advanced)', async () => {
  await open('Backup & start over');
  await btn('Reset demo data').click();
  await page.getByText('Your devices (37)').waitFor();
  await until(async () => (await stored()).rules.length === 7, 'routines not restored');
});

console.log('Saving & images');
await step('device state and running quick action survive a reload', async () => {
  await go('/scenes', 'Quick actions');
  await btn('Start Movie Night').click();
  await page.waitForTimeout(400);
  await page.reload();
  await h1('Quick actions');
  expect((await btn('Start Movie Night').getAttribute('aria-pressed')) === 'true', 'running quick action lost');
  expect((await device('tv-living')).on, 'device state lost');
});
await step('room cards still work when a photo fails to load', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/rooms/kitchen.jpg', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`fallback pageerror: ${e.message}`));
  await p.goto(BASE + '/rooms');
  await p.locator('[data-testid="room-room-kitchen"] .room-img.fallback').waitFor();
  expect((await p.getByTestId('room-room-kitchen').textContent()).includes('Kitchen'), 'fallback card lost its name');
  await ctx.close();
});

console.log('Branding');
await step('browser tab, logo, tagline and every page say NexaHome — no SmartNest left', async () => {
  await page.goto(BASE + '/');
  await page.locator('h1').first().waitFor();
  expect((await page.title()).startsWith('NexaHome'), `tab title is "${await page.title()}"`);
  expect((await page.getByRole('img', { name: 'NexaHome logo' }).count()) >= 1, 'logo missing');
  expect((await page.locator('.sidebar').textContent()).includes('Intelligent Living. Connected Everywhere.'), 'tagline missing');
  expect((await page.locator('.sidebar').textContent()).includes('NexaHome Dashboard'), 'dashboard name missing');
  for (const path of ['/', '/rooms', '/rooms/room-living', '/rooms/room-study', '/scenes', '/lighting', '/climate', '/security', '/doorbell', '/automations', '/notifications', '/activity', '/settings', '/nope']) {
    await page.goto(BASE + path);
    await page.locator('h1, .empty').first().waitFor();
    const text = await page.evaluate(() => document.body.innerText + document.title);
    expect(!/smart\s*nest/i.test(text), `"SmartNest" still visible on ${path}`);
  }
});

console.log('Phones & tablets');
for (const [label, width, height] of [['phone', 390, 844], ['tablet', 820, 1180]]) {
  await step(`${label} (${width}px): bottom tab bar, big tap targets, no sideways scrolling`, async () => {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: label === 'phone', hasTouch: true });
    const m = await ctx.newPage();
    watch(m, label);
    for (const path of ['/', '/rooms', '/rooms/room-living', '/rooms/room-study', '/scenes', '/lighting', '/climate', '/security', '/doorbell', '/automations', '/notifications', '/activity', '/settings']) {
      await m.goto(BASE + path);
      await m.locator('h1').first().waitFor();
      await m.waitForTimeout(150);
      const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow <= 0, `${path} overflows by ${overflow}px`);
      const small = await m.evaluate(() =>
        [...document.querySelectorAll('.btn, .power-btn, .switch, .tab, .nav-link, .fav-tile, .scene-tile, .alerts-btn, .disclosure-btn, .round-btn')]
          .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height < 40)
          .map((e) => e.textContent.trim().slice(0, 20)),
      );
      expect(small.length === 0, `${path}: small tap targets: ${small.join(' | ')}`);
    }
    await m.goto(BASE + '/');
    await m.locator('h1').first().waitFor();
    await m.waitForTimeout(400);
    const tabs = await m.locator('.tab-bar .nav-label').allTextContents();
    expect(tabs.join() === 'Home,Rooms,Automations,Settings', `tab bar is ${tabs.join()}`);
    await m.screenshot({ path: SHOTS + `${label}-home.png` });
    await m.locator('.tab-bar').getByRole('link', { name: 'Automations' }).click();
    await m.getByRole('heading', { level: 1, name: 'Automations' }).waitFor();
    expect((await m.locator('.tab-bar .nav-link.active').textContent()) === 'Automations', 'active tab not highlighted');
    await m.getByRole('button', { name: 'Create a Routine' }).click();
    await m.screenshot({ path: SHOTS + `${label}-create-routine.png`, fullPage: true });
    await m.goto(BASE + '/lighting');
    await m.locator('h1').first().waitFor();
    expect((await m.locator('.tab-bar .nav-link.active').textContent()) === 'Rooms', 'Lights should sit under Rooms');
    await ctx.close();
  });
}

await step('no console or page errors anywhere', async () => {
  expect(errors.length === 0, errors.slice(0, 3).join(' | '));
});

await browser.close();
console.log(`\n${passed} checks passed${failed ? `, ${failed} FAILED` : ''}`);
if (failed) process.exitCode = 1;
