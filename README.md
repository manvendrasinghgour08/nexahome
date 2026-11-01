# NexaHome 🏠

**Intelligent Living. Connected Everywhere.**

NexaHome is a smart-home app that is simple enough for anyone — even someone who has never used smart-home technology.
You can turn lights on and off, check the temperature, see who rang the doorbell, run one-tap quick actions and create
routines like *"When I wake up → turn on my bedroom light"*.

> **This is a demo.** Every device in NexaHome is pretend (simulated). It does not connect to, or control, any real
> lights, locks, cameras or other hardware. Everything runs in your own browser and nothing is sent to a server.

## Features

- **Home** — a friendly welcome, an "Is my home okay?" status with one-tap fixes, favourite devices and quick actions
  (Good Morning, Good Night, Away Mode, All lights off).
- **Rooms** — Living Room, Bedroom, Kitchen, Bathroom, Entrance and Study Room, each with a photo and big
  **Turn On / Turn Off** buttons. Lights have brightness and colour; heating & cooling has simple − / + controls.
- **Automations** — *When this happens → Do this* routines, with ready-made ideas. Optional conditions sit behind an
  **Advanced** section.
- **Doors & Safety and Doorbell** — pretend doors, windows, movement sensors and visitors, all clearly marked **Demo**.
- **Alerts and History** — every event with a time, filters and "mark as read".
- **Settings** — light or night theme, larger text, °C/°F, add or rename devices and rooms, backup and reset.
- Works on phones, tablets and computers, with large tap targets and On/Off always shown in words, not colour alone.

## Built with

React 19 · TypeScript · Vite · React Router · Recharts · lucide-react icons · locally bundled Inter and Fraunces fonts.
No backend, database, API keys or paid services. Data is saved in the browser's `localStorage`.

## Requirements

- [Node.js](https://nodejs.org/) **22.12 or newer** (includes npm)
- Google Chrome — only needed to run the end-to-end browser test

## Getting started

```bash
git clone <your-repository-url> nexahome
cd nexahome
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server at http://localhost:5173 |
| `npm run build` | Type-check and build the production site into `dist/` |
| `npm run preview` | Serve the production build locally at http://localhost:4173 |
| `npm test` | Run the unit tests (devices, routines, quick actions, saving) |
| `npm run test:e2e` | Click through the whole app in headless Chrome (start `npm run dev` first) |

To run the browser test against the production build instead, start `npm run preview` and run
`BASE_URL=http://localhost:4173 npm run test:e2e`. Screenshots are saved to `e2e/screenshots/` (not committed).

## Project structure

```
src/core/        app logic: types, engine (devices, routines, quick actions), simulation, saving
src/state/       React store, demo simulation loop, confirmation messages, doorbell sound
src/components/  reusable pieces: layout, device cards, room cards, charts, alerts, logo
src/pages/       one file per page
public/rooms/    room photos (Unsplash License)
e2e/smoke.mjs    end-to-end browser test
```

## Privacy and security

- No accounts, no tracking and no network requests — the app works entirely offline once loaded.
- No API keys, passwords or tokens are needed or included. `.env` files and credentials are ignored by git.
- Each visitor's demo home is stored only in their own browser. Clearing site data resets it.

## Deployment

NexaHome builds to a static site in `dist/`. `vercel.json` contains ready-made settings for Vercel (build command,
output folder, a rewrite so links like `/rooms/room-living` work, and basic security headers). Any static host works.

## Credits

Room photos are from [Unsplash](https://unsplash.com/license) and are bundled with the app; the list of photos is in
**Settings → Advanced → About & photo credits**. If a photo fails to load, the room shows a simple drawing instead.

## Notes for developers

The brand name and tagline live in `src/core/brand.ts`, and the logo in `src/components/Logo.tsx`.
The app was first called SmartNest, so browser-storage keys keep the `smartnest:` prefix to preserve saved demo homes.
