# Anvil NextJS Bridge

A NextJS-based bridge that enables Anvil applications to run with enhanced deployment capabilities, modern web standards, and enterprise-grade performance while maintaining full Anvil functionality.

## 🎯 Vision

Transform the Anvil development experience by allowing developers to:
- **Build** in Anvil's intuitive drag-and-drop cloud IDE
- **Deploy** via NextJS for enhanced performance, SEO, and customization
- **Maintain** full Anvil functionality (server calls, data tables, authentication)
- **Scale** with modern web standards and hosting solutions

## 📋 Project Status

**Current Phase**: Milestone 1 - Research & Setup Foundation

### ✅ Completed Tasks
- [x] NextJS project structure setup with TypeScript and Tailwind CSS
- [x] Core dependencies installation (WebSocket, YAML parsing, React Query)
- [x] TypeScript configuration with path aliases
- [x] Initial type definitions for Anvil protocol
- [x] YAML parser for Anvil app configurations and form templates
- [x] Basic WebSocket proxy foundation
- [x] NextJS API route structure for WebSocket handling

### 🔄 Current Progress
Working on Milestone 1.2: Anvil Runtime Deep Dive
- Setting up local Anvil test server
- Protocol reverse engineering
- Component system analysis

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   NextJS Client │◄──►│  Bridge Server   │◄──►│  Anvil Server   │
│                 │    │                  │    │                 │
│ • React Components    │ • WebSocket Proxy│    │ • App Logic     │
│ • YAML Parser    │    │ • HTTP Proxy     │    │ • Data Tables   │
│ • Event System   │    │ • Session Mgmt   │    │ • Authentication│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.8+ (for Anvil server)
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd anvil-runtime/bridge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Anvil server configuration
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

### Environment Variables

Create a `.env.local` file with:

```env
ANVIL_SERVER_URL=localhost
ANVIL_SERVER_PORT=3030
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3000/api/ws
```

## 📁 Project Structure

```
bridge/
├── src/
│   ├── app/                    # NextJS 13+ app router
│   │   └── api/               # API routes
│   │       └── ws/            # WebSocket proxy endpoint
│   ├── components/            # React components
│   │   └── anvil/            # Anvil-specific component library
│   ├── lib/                  # Utilities and helpers
│   │   ├── protocol/         # WebSocket/HTTP protocol handlers
│   │   └── parsers/          # YAML/JSON parsers for Anvil apps
│   └── types/                # TypeScript definitions
├── tests/
│   ├── unit/                 # Jest unit tests
│   └── e2e/                  # Playwright E2E tests
├── docs/                     # Documentation
└── package.json
```

## 🧪 Testing

### Unit Tests
```bash
npm test                      # Run tests once
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Run tests with coverage
```

### End-to-End Tests
```bash
npm run test:e2e             # Run E2E tests
```

### Type Checking
```bash
npm run type-check           # TypeScript type checking
```

## 🔧 Development Scripts

- `npm run dev` - Start development server with turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests

## 📚 Documentation

- [Architecture Documentation](./docs/anvil-architecture.md) - Deep dive into Anvil's architecture
- [Protocol Specification](./docs/protocol-spec.md) - WebSocket/HTTP protocol details
- [Component Mapping](./docs/component-mapping.md) - Anvil to React component mappings
- [Local Setup Guide](./docs/local-anvil-setup.md) - Setting up local Anvil server

## 🤝 Contributing

This project follows a structured development approach:

1. **Discovery** → **Understanding** → **Acknowledgement** → **Planning** → **Development** → **Testing** → **Implementation**
2. Each milestone must be completed before advancing
3. All changes require comprehensive testing
4. Document findings and decisions immediately

## 📈 Roadmap

### Milestone 1: Research & Setup Foundation (Current)
- Environment setup and project structure ✅
- Anvil runtime deep dive 🔄
- Local Anvil test server setup

### Milestone 2: Communication Proxy Layer
- WebSocket proxy implementation
- HTTP proxy and fallback
- Integration testing

### Milestone 3: YAML Parsing & Component Virtualization
- YAML parser and component mapper
- State and data binding
- Virtualization testing

### Milestone 4: Event & API Parity
- Event system implementation
- Anvil API emulation
- Feature testing

### Milestone 5: Optimization & Production Readiness
- Performance optimization
- PWA implementation
- Comprehensive testing and documentation

## 📄 License

This project is part of the Anvil Runtime ecosystem. See [LICENSE](../LICENSE) for details.

## 🔗 Related Projects

- [Anvil Runtime](https://github.com/anvil-works/anvil-runtime) - The main Anvil runtime system
- [Anvil App Server](https://pypi.org/project/anvil-app-server/) - Self-hosted Anvil server

---

**Status**: 🔄 Active Development | **Phase**: Foundation Setup | **Next**: Protocol Analysis
