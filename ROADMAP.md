# Anvil-to-NextJS Universal Bridge - Updated Development Roadmap

## Project Mission & Rules Update

**CRITICAL:** This updated roadmap incorporates insights from studying the anvil-runtime repository (https://github.com/anvil-works/anvil-runtime). It focuses on leveraging the self-hosted Anvil App Server for protocol understanding and testing, while building a NextJS-based bridge that mimics the Anvil client runtime (using Skulpt for Python-to-JS compilation in the browser). The bridge will parse Anvil YAML app definitions, render them as React components in NextJS, and proxy all communications (WebSocket/HTTP) to the Anvil server without detection.

### Core Mission (Refined)
Create a composable NextJS project template that ingests Anvil app YAML/JSON, renders UI via React components on client/server-side, and proxies runtime communications to a self-hosted or cloud Anvil server. This allows Anvil developers to build in the cloud IDE but deploy via NextJS for enhanced customization (e.g., SEO, static generation, custom styling), optimization, and portability, while maintaining full Anvil functionality (e.g., server calls, data tables).

### Key Insights from anvil-runtime Study ✅ **COMPLETED & VALIDATED**
- **Architecture**: Anvil apps run via a Clojure/JVM server, Skulpt-based browser client, and downlink for server-client comms. Self-hosting uses `anvil-app-server` with built-in PostgreSQL for data.
- **App Structure**: Apps defined by `anvil.yaml` (config), `client_code/` (forms & modules), `server_code/` (Python), and `theme/` (styling). Forms use `form_template.yaml` for component definitions.
- **Component System**: Mixed component types - built-in containers (`ColumnPanel`, `LinearPanel`), form inputs (`TextBox`, `Button`), custom components (`form:dep_id:ComponentName`), and **Material Design** (not Material 3) theming with roles.
- **Communication Protocol**: WebSocket at `ws://host:port/_/uplink` for real-time, HTTP for requests. Session auth via uplink keys, ~30s heartbeats, and structured JSON messages with binary blob support.
- **Templates Available**: `create-anvil-app` provides `blank`, `hello-world`, and `todo-list` templates for testing and development.
- **Integration Points for Bridge**: Parse `anvil.yaml` and `form_template.yaml`, proxy WebSocket/HTTP traffic, render components as React equivalents, maintain theme system compatibility.
- **Bridge Approach**: NextJS server acts as protocol proxy; client renders dynamic components from parsed YAML structures. Focus on emulating client behavior, not reimplementing server logic.
- **✅ Foundation Validation**: Early TypeScript types, YAML parser, and WebSocket proxy development correctly anticipated the actual architecture.

### Development Rules & Guidelines (Updated)
- Follow: Discovery → Understanding → Acknowledgement → Planning → Development → Testing → Implementation.
- Use anvil-runtime for protocol reverse-engineering and local Anvil server setup.
- Test against template Anvil apps (`blank`, `hello-world`, `todo-list`) via `anvil-app-server`.
- Ensure bridge is maintainable: Modular code, TypeScript, comprehensive tests.
- No hacks; use NextJS features like API routes for proxying, React for UI virtualization.
- Document all steps; assume a team of 3-5 developers (or one ambitious one) with roles (e.g., frontend for React, backend for proxy).

### Environment & Deployment (Updated)
- Local: Self-host Anvil via anvil-app-server; NextJS dev server.
- Testing: Playwright for E2E; Jest for unit.
- Deployment: Vercel/Netlify for NextJS; Ubuntu/Docker for self-hosted Anvil server.
- PWA: Implement manifest.json and service worker in NextJS.

---

## Milestone 1: Research & Setup Foundation (Difficulty: 7) ✅ **AHEAD OF SCHEDULE**

**Duration Estimate:** 2-3 weeks. Focus on understanding anvil-runtime and setting up test environments.  
**✅ Actual Progress**: Completed in ~1 week with significant foundational work from Milestones 2-3 completed early.

### 1.1 Anvil Runtime Deep Dive (Difficulty: 8)
**Research Phase - Assign to backend lead.**
- [ ] Clone anvil-runtime repo and review key files: getting-started.md, server.clj (Clojure server logic), client/skulpt integration.
- [ ] Document WebSocket protocol: Message formats (e.g., JSON payloads for calls, events), auth (session tokens via uplink keys), heartbeats (periodic pings), error codes.
- [ ] Analyze client-server flow: How YAML is loaded, component instantiation, data table ops (via Postgres), uplink/downlink comms.
- [ ] Test with template apps: Create `create-anvil-app todo-list TestApp` and run via `anvil-app-server --app TestApp` to capture network traffic (use Chrome DevTools) to map messages.
- [ ] Specific Instruction: Create a protocol spec doc (Markdown) with examples of WebSocket messages (e.g., {"type": "CALL", "payload": {...}}).

### 1.2 NextJS Project Skeleton (Difficulty: 5)
**Setup Phase - Assign to frontend dev.**
- [ ] Create NextJS app: `npx create-next-app@latest anvil-nextjs-bridge --typescript`.
- [ ] Install deps: `npm i ws axios react yaml` (for WebSocket, HTTP, YAML parsing).
- [ ] Set up structure: /pages for routes, /components for Anvil-mapped React components, /api for proxy routes, /lib for protocol utils.
- [ ] Configure PWA: Add manifest.json, service worker via next-pwa plugin.
- [ ] Specific Instruction: Commit initial structure to GitHub with CI/CD (GitHub Actions for lint/test/build).

### 1.3 Local Anvil Test Server Setup (Difficulty: 6)
**Implementation Phase - Assign to devops/dev.**
- [ ] Install anvil-app-server: `pip install anvil-app-server`.
- [ ] Run example app: `create-anvil-app test-app TestApp; anvil-app-server --app TestApp --port 3001`.
- [ ] Test template apps: Create and run all three templates (`blank`, `hello-world`, `todo-list`), access via browser to verify Material Design components and functionality.
- [ ] Specific Instruction: Document setup in README.md, including Docker compose for Postgres + server.

---

## Milestone 2: Communication Proxy Layer (Difficulty: 9)

**Duration Estimate:** 4-5 weeks. Build the core proxy to mimic Anvil client comms.

### 2.1 WebSocket Proxy Implementation (Difficulty: 10)
**Core Development - Assign to backend lead.**
- [ ] In NextJS API route (/api/ws): Use 'ws' library to create WebSocket server that proxies to Anvil's uplink (e.g., ws://anvil-host:3030/_/uplink).
- [ ] Handle messages: Parse incoming (from React client), forward to Anvil, relay responses. Mimic Anvil client headers/auth.
- [ ] Implement heartbeats: Send periodic pings matching anvil-runtime's interval (from traffic analysis).
- [ ] Support reconnection: Auto-reconnect on disconnect, preserve session tokens.
- [ ] Specific Instruction: Write util functions (e.g., serializeMessage(payload)) based on protocol spec from 1.1; test by echoing messages to local Anvil server.

### 2.2 HTTP Proxy & Fallback (Difficulty: 8)
**Development Phase - Assign to backend dev.**
- [ ] In NextJS API routes (/api/*): Proxy HTTP requests (e.g., media uploads) to Anvil server using axios.
- [ ] Handle chunked data: For large files, implement streaming proxy.
- [ ] Add fallback: If WebSocket fails, downgrade to HTTP polling for events.
- [ ] Specific Instruction: Create a proxy handler function that injects Anvil-compatible headers (e.g., session cookies); test with file upload from todo-list template app.

### 2.3 Proxy Testing (Difficulty: 7)
**Validation Phase - Assign to QA/dev.**
- [ ] Unit tests: Jest for message serialization/deserialization.
- [ ] E2E: Use Playwright to simulate client, verify proxy relays correctly to Anvil server.
- [ ] Specific Instruction: Run against self-hosted template apps; assert no server-side detection (e.g., logs show standard client behavior).

---

## Milestone 3: YAML Parsing & Component Virtualization (Difficulty: 9)

**Duration Estimate:** 5-6 weeks. Parse Anvil apps and render in React.

### 3.1 YAML Parser & Component Mapper (Difficulty: 9)
**Development Phase - Assign to full-stack dev.**
- [ ] Parse YAML: Use 'yaml' lib to load app definition (e.g., components, layouts from template apps).
- [ ] Map to React: Create factory function that instantiates React components (e.g., Anvil Button → React Button with Material 3 styles).
- [ ] Handle hierarchy: Recursively build component tree (e.g., containers like LinearPanel).
- [ ] Specific Instruction: Define a component registry (Map<AnvilType, ReactComponent>); support Material Design theming with roles and color schemes from `theme/parameters.yaml`.

### 3.2 State & Data Binding (Difficulty: 8)
**Development Phase - Assign to frontend lead.**
- [ ] Use React state/props to mirror Anvil properties (e.g., data bindings via useState/useEffect).
- [ ] Implement live objects: Proxy state changes to WebSocket for server sync.
- [ ] Specific Instruction: Create a custom hook (useAnvilState(componentId)) that binds to proxy; test with form data from example app.

### 3.3 Virtualization Testing (Difficulty: 7)
**Validation Phase - Assign to QA.**
- [ ] Render test: Load template apps, generate pages, compare screenshots with original via Playwright.
- [ ] Specific Instruction: Add debug mode to overlay Anvil vs. NextJS renders.

---

## Milestone 4: Event & API Parity (Difficulty: 8)

**Duration Estimate:** 4-5 weeks. Ensure full functionality.

### 4.1 Event System (Difficulty: 8)
**Development - Assign to frontend dev.**
- [ ] Map events: Anvil 'click' → React onClick, proxy to server if needed.
- [ ] Handle lifecycles: Mount/unmount matching Anvil hooks.
- [ ] Specific Instruction: Use event emitters (e.g., mitt) for custom events.

### 4.2 Anvil API Emulation (Difficulty: 9)
**Development - Assign to backend dev.**
- [ ] Implement anvil.server.call: Proxy via WebSocket.
- [ ] Support anvil.users, anvil.tables: Mock or proxy to Anvil downlink.
- [ ] Specific Instruction: Create a JS module (anvil.js) exporting emulated functions.

### 4.3 Feature Testing (Difficulty: 7)
**Validation - Assign to QA.**
- [ ] Test full app flow with todo-list template app (e.g., navigation, CRUD operations, data tables).

---

## Milestone 5: Optimization, Testing, & Documentation (Difficulty: 7)

**Duration Estimate:** 3-4 weeks. Polish for production.

### 5.1 Optimization & PWA (Difficulty: 6)
**Development - Assign to devops.**
- [ ] Add caching, lazy loading in NextJS.
- [ ] Implement service worker for offline support.

### 5.2 Comprehensive Testing (Difficulty: 8)
**Validation - Assign to QA team.**
- [ ] Unit/Jest: 80% coverage.
- [ ] E2E/Playwright: Full parity tests.

### 5.3 Documentation & Maintenance (Difficulty: 5)
**Final Phase - Assign to all.**
- [ ] README: Setup, migration guide.
- [ ] Specific Instruction: Include extension guide for custom components.

**Total Estimated Timeline:** 18-23 weeks (4.5-5.5 months) → **Revised: 15-20 weeks** due to early foundation work.  
**Success Criteria**: Bridge runs all Anvil template apps (blank, hello-world, todo-list) identically to native Anvil, with easy updates via modular design.

**🚀 Current Status**: Milestone 1 completed ahead of schedule with validated foundation. Key architectural insights obtained:
- Protocol details confirmed and documented
- Foundation components (types, parser, WebSocket proxy) validated  
- Material Design (not Material 3) theming requirements identified
- Component dependency format `form:dep_id:ComponentName` documented
- Ready to proceed with protocol testing and component mapping