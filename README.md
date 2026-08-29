# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Run with Docker

Install Docker Desktop, then run the production site with the Supabase variables from `.env.local`:

```powershell
docker compose --env-file .env.local up --build -d
```

Open `http://localhost:5500`. To use it from another device on the same network, open `http://YOUR-COMPUTER-IP:5500` and allow Docker through the Windows Private network firewall when prompted.

### LAN SQL Server storage

The LAN API stores its assessment cache and pending submissions in the local SQL Server database, then retries synchronization to Supabase when internet is available. Run `sqlserver.schema.sql` once in the `Presenzio` database through SSMS, then add these local-only variables to `.env.local`:

If you use the assessment attempt and time-window controls, run the complete `supabase/schema.sql` in the Supabase SQL Editor after updating this project. It adds the assessment availability fields and allows multiple numbered attempts per student. Existing assessments default to one attempt with no time window.

```text
SQL_SERVER=host.docker.internal
SQL_PORT=1433
SQL_DATABASE=Presenzio
SQL_USER=presenzio_app
SQL_PASSWORD=your-sql-login-password
```

The Docker API uses SQL Server through `host.docker.internal`; port 1433 must be enabled for TCP/IP and allowed on the Windows Private network firewall. Do not run `docker compose down -v`, because the local Docker volume may contain older pending data.

Stop the container with:

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
