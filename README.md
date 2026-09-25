# Presenzio

Presenzio is a React/Vite gradebook that uses Supabase for shared data and IndexedDB for browser-side offline queuing.

## Run with Docker

Install dependencies, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`, then start the development site:

```powershell
npm install
npm run dev
```

For a production container, pass the same Supabase values as build arguments:

If you use the assessment attempt and time-window controls, run the complete `supabase/schema.sql` in the Supabase SQL Editor after updating this project. It adds the assessment availability fields and allows multiple numbered attempts per student. Existing assessments default to one attempt with no time window.

```text
docker compose --env-file .env.local up --build -d
```

Open `http://localhost:5500` when the container is running. Stop it with:

```powershell
docker compose down
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
