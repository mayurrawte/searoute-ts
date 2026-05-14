# searoute-ts web demo

Interactive map demo for [`searoute-ts`](https://www.npmjs.com/package/searoute-ts).
Click two points on the ocean and get a real shipping route — with canal
restrictions, vessel-draft gating, and shareable URLs.

Stack: Vite 5 · TypeScript 5 · MapLibre GL · searoute-ts 2.

## Run locally

```bash
cd examples/web-demo
npm install
npm run dev
```

Open http://localhost:5173.

## Build

```bash
npm run build       # → dist/
npm run preview     # serves the built files locally
```

## Deploy

The `dist/` folder is a static SPA. Drop it on any host:

```bash
# Vercel
npx vercel --prod

# Netlify
npx netlify deploy --prod --dir=dist

# GitHub Pages, Cloudflare Pages, S3+CloudFront — all work out of the box.
```

The included `vercel.json` rewrites all routes to `index.html`.

## URL parameters

The demo serializes its state to the URL so routes are shareable:

```
?from=121.5,31.0&to=4.4,51.9&restrict=suez,babelmandeb&draft=14&speed=22&arctic=1
```
