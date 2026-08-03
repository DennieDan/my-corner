## Prerequisites

Node.js: use a current LTS (e.g. 20.x or 22.x). Next 16 expects a reasonably new Node; if next dev complains, upgrade Node.

`my-corner` is a Next.js 16 app (App Router under app/) with React 19, TypeScript, Tailwind CSS v4, and shadcn-style UI (components/ui/). There is no README and no .env / process.env usage in the tree, so nothing special is required beyond Node and installing dependencies.

| Command       | Purpose                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| npm run dev   | Development server                                                                                                     |
| npm run build | Production build                                                                                                       |
| npm run start | Run production build (after build)                                                                                     |
| npm run lint  | ESLint (note: eslint is not listed in devDependencies; if lint fails, you may need to add ESLint or adjust the script) |

## Dennie RAG development

The custom RAG chatbot is being developed in isolated packages so the static website can continue to build and deploy independently. See [docs/development-environments.md](docs/development-environments.md) for setup, checks, CDK environments, knowledge ingestion, evaluation commands, and the environment variable contract.
