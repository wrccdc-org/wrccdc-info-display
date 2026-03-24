# WRCCDC Info Display

A lobby display for the Western Regional Collegiate Cyber Defense Competition. Shows a real-time service status grid pulled from [Quotient](https://github.com/dbaseqp/Quotient).

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser (ideally fullscreen/kiosk mode on a TV).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port for the display server |
| `QUOTIENT_URL` | `http://localhost:8080` | Internal URL for the Quotient scoring engine |
| `QUOTIENT_TOKEN` | _(empty)_ | Quotient auth cookie value (optional) |
| `QUOTIENT_PUBLIC_URL` | Value of `QUOTIENT_URL` | Public-facing URL shown on the display |

Example:

```bash
QUOTIENT_URL=https://scoring.wccomps.org QUOTIENT_TOKEN=abc123 QUOTIENT_PUBLIC_URL=https://scoring.wccomps.org npm run dev
```
