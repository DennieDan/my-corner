## Prerequisites

Use Node.js 24.14.1 and npm 11.11.0 as specified in `.nvmrc` and `package.json`.

`my-corner` is a Next.js 16 app (App Router under `app/`) with React 19, TypeScript, Tailwind CSS v4, and shadcn-style UI (`components/ui/`).

| Command       | Purpose                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| npm run dev   | Development server                                                                                                     |
| npm run build | Production build                                                                                                       |
| npm run start | Run production build (after build)                                                                                     |
| npm run test:chat | Check the chat stream client and history limits |

## Dennie RAG development

The custom RAG chatbot lives in isolated packages so the static website can build and deploy independently. See [docs/development-environments.md](docs/development-environments.md) for setup and evaluation, and [docs/phase-9-release.md](docs/phase-9-release.md) for production release and rollback commands. Production has its own Agent and Monitoring stacks and shares the development Knowledge Base.

## View the Phase 7 chat interface

From a fresh checkout, run:

```bash
npm ci
cp .env.example .env.local
```

Set `NEXT_PUBLIC_AGENT_API_URL` in `.env.local` to the public API stage base URL (for the current development deployment, `https://13qkqk965i.execute-api.ap-southeast-1.amazonaws.com/development`). Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and select **Chat with Dennie** in the lower right. The [Dennie information page](http://localhost:3000/dennie) describes the chat's scope and data handling. The browser sends requests directly to the API; `NEXT_PUBLIC_AGENT_API_URL` is public and must not contain a key. Restart the development server after changing it.

Run `npm run test:chat` to check stream parsing and history limits. Run `npx tsc --noEmit` to type-check the website independently of the agent and infrastructure packages.
