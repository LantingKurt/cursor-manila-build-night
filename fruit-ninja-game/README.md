# Fruit Ninja (Webcam) — Next.js + TensorFlow.js scaffold

Production-ready-ish scaffold for a Fruit Ninja-style game using **webcam hand tracking** (TensorFlow hand pose) + Canvas rendering.

## Requirements
- Node.js 18+ recommended
- A browser that supports `getUserMedia` (Chrome/Edge recommended)

## Setup

```bash
cd fruit-ninja-game
npm install
npm run dev
```

Open `http://localhost:3000`.

## How to use (current boilerplate)
- Click **Enable Webcam**
- Click **Load Model** (first load downloads assets)
- Click **Start**
- Move your hand quickly to trigger a **slash** (basic speed threshold)

## Project structure
- `src/app/page.tsx`: main UI layout + wires hooks
- `src/components/*`: `GameCanvas`, `WebcamFeed`, `Stats`, `Controls`, `Leaderboard`
- `src/hooks/*`: `useWebcam`, `useHandDetection`, `useGame`, `useLocalStorage`
- `src/lib/*`: `handDetection` (TF integration), `gameEngine` (spawn/score/lives), `physics`, `utils`
- `src/constants/*`: `gameConfig`, `colors`
- `src/app/api/*`: leaderboard API routes

## API routes
Next.js App Router routes:
- `GET /api/leaderboard` → top 10
- `POST /api/leaderboard` → `{ name, score }`
- `GET/POST /api/scores` → alias for compatibility

By default this uses **in-memory storage** (resets on server restart). Swap it for a real DB for production.

## Environment variables
Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_LEADERBOARD_ENABLED=true
```

## Notes / next steps
- Add proper slash trail + multi-hand support (currently uses index finger tip as primary point)
- Implement fruit splitting into two pieces on slice
- Persist leaderboard to a database or localStorage fallback
- Performance tuning: throttle detector FPS and decouple render loop from detection loop
