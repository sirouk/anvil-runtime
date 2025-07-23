# Anvil Runtime Architecture Analysis

**Date**: 2025-01-22  
**Purpose**: Deep dive analysis of anvil-runtime codebase structure for NextJS bridge development

## Overview

Anvil is a full-stack web development platform that runs Python code both client-side (via Skulpt) and server-side (via native Python). The architecture consists of three main layers:

1. **Clojure/JVM Server Runtime** - Backend services and app hosting
2. **JavaScript/TypeScript Client Runtime** - Browser-based UI and Python execution  
3. **Python Application Layer** - User code and business logic

## Server Architecture (Clojure/JVM)

### Core Server Components

**Main Server (`anvil.runtime.server`)**
- HTTP/WebSocket server built on `org.httpkit.server`
- Handles client connections and app serving
- Routes requests to appropriate handlers (browser-ws, browser-http)
- Manages app sessions and authentication

**Dispatcher System (`anvil.dispatcher.core`)**
- Central request routing and execution system
- Priority-based handler registration (UPLINK=10, DOWNLINK=20, SANDBOX=30)
- Manages call stacks and execution contexts
- Handles background tasks and async operations

**Executors**
- **Uplink** (`anvil.executors.uplink`): Browser client connections
- **Downlink** (`anvil.executors.downlink`): Server Python process connections  
- **WebSocket Server** (`anvil.executors.ws-server`): Common WebSocket functionality

**App Data Management (`anvil.runtime.app-data`)**
- YAML app configuration parsing
- Dependency resolution and loading
- App versioning and environment management
- Database schema management

### Communication Protocols

**WebSocket Protocol** (Primary)
- Endpoint: `ws://host:port/_/uplink` 
- Bidirectional message passing between client and server
- JSON-based message format with binary blob support
- Message types: CALL, RESPONSE, EVENT, PING/PONG, AUTH, ERROR

**HTTP Protocol** (Fallback)
- RESTful endpoints for file uploads, media serving
- Form submissions and chunked data transfer
- Handles requests that don't fit WebSocket model

### Session and Authentication
- PostgreSQL-backed session storage (`anvil.runtime.sessions`)
- Cookie and URL token authentication
- Session persistence across requests
- User authentication integration with Data Tables service

## Client Architecture (JavaScript/TypeScript)

### Runtime Core (`client/js/`)

**Module System**
- **`modules/anvil.js`**: Core Anvil API (get_url_hash, app info, form navigation)
- **`modules/server.ts`**: Server communication (anvil.server.call, RPC handling)
- **`modules/_server/`**: Internal server communication infrastructure

**Component Rendering System (`runner/`)**
- **`component-creation.ts`**: YAML-to-React component instantiation
- **`instantiation.ts`**: Component factory and dependency resolution
- **`python-environment.ts`**: Skulpt Python runtime setup
- **`python-objects.ts`**: Python object lifecycle management

### Skulpt Python Integration (`@Sk/`)

**Core Python-to-JS Compilation**
- TypeScript definitions for Python object system
- Built-in Python types (str, dict, list, etc.) mapped to JavaScript
- Exception handling and stack trace management
- Suspension system for async operations

**Python Object System**
- Every Python object implements `pyObject` interface
- Type system with `tp$` prefixed methods (tp$call, tp$getattr, etc.)
- Descriptor protocol for properties and methods
- Memory management and garbage collection integration

### Communication Layer (`modules/_server/`)

**WebSocket Management (`websocket.ts`)**
- Automatic connection and reconnection handling
- Heartbeat implementation for connection health
- Message queuing for offline scenarios
- Fallback to HTTP polling when WebSocket unavailable

**RPC System (`rpc.ts`)**
- Request/response correlation with unique IDs
- Binary blob handling for large data transfers
- Suspension-based async handling for server calls
- Loading indicator integration

**Serialization (`serialize.ts`, `deserialize.ts`)**
- Python object serialization for server communication
- Live object proxies for server-side objects
- Media object handling (files, images, etc.)
- Capability-based security for object access

## App Structure and Lifecycle

### App Definition (YAML)

**anvil.yaml Structure**
```yaml
dependencies: []           # App dependencies
services: []              # Anvil services (Tables, Users, Email, etc.)
package_name: "MyApp"     # Python package name
name: "My App"            # Human-readable name
allow_embedding: false   # Iframe embedding permission
runtime_options:          # Python version and settings
  version: 2
  client_version: "3"
metadata:                 # App metadata (title, description, logo)
  title: "My App"
startup: {type: form, module: Form1}  # Entry point
```

**Form Template Structure**
```yaml
components:               # Component tree definition
  - type: TextBox         # Component type
    name: text_box_1      # Instance name
    properties:           # Component properties
      text: "Hello World"
    layout_properties:    # Layout constraints
      row: 0
      col: 0
    components: []        # Nested components
container:               # Container settings
  type: ColumnPanel
  properties: {}
event_bindings:          # Event handlers
  click: self.button_click
data_bindings: []        # Data binding expressions
is_package: true         # Package vs module form
```

### Component Lifecycle

**1. App Initialization**
- Parse anvil.yaml and load dependencies
- Set up Python environment with Skulpt
- Initialize service configurations (Tables, Users, etc.)
- Create WebSocket connection to server

**2. Form Creation (`component-creation.ts`)**
- Parse form_template.yaml for component tree
- Instantiate components via factory system
- Apply properties and layout constraints
- Bind event handlers and data bindings
- Add components to containers recursively

**3. Component Rendering**
- Convert Anvil components to DOM elements
- Apply Material Design styling and themes
- Handle responsive layout calculations
- Manage component visibility and focus

**4. Event Handling**
- Map DOM events to Python handlers
- Execute Python code via Skulpt
- Handle async operations with suspensions
- Update UI based on Python state changes

### Data Flow Patterns

**Client-to-Server Communication**
1. Python code calls `anvil.server.call(function_name, args)`
2. Serialization converts Python objects to JSON + binary blobs
3. WebSocket sends request with unique ID to server
4. Server executes Python function in sandboxed environment
5. Response serialized and sent back via WebSocket
6. Client deserializes response and resumes Python execution

**Server-to-Client Events**
1. Server code triggers events via anvil.server.send_event()
2. Event propagated to all connected clients
3. Client event handlers executed in Python
4. UI updates based on event handling results

**Component Property Updates**
1. Python code modifies component property
2. Property setter triggers DOM update
3. Layout recalculation if needed
4. Visual changes applied with animations/transitions

## Service Integration

### Data Tables Service
- PostgreSQL backend with automatic schema management
- Python ORM with search(), get(), add(), update(), delete()
- Client-server synchronization of data changes
- Row-level security and permissions
- Automatic column creation and type inference

### Users Service
- Authentication via email/password, Google, Facebook, Microsoft
- Session management with automatic token refresh
- Role-based permissions and user groups
- Password hashing and security best practices
- Multi-factor authentication support

### Email Service
- SMTP integration for transactional emails
- Template system for email content
- Attachment support via Media objects
- Bounce and delivery tracking

## Key Insights for Bridge Development

### Protocol Compatibility
- WebSocket endpoint: `ws://host:port/_/uplink`
- Message format: JSON with binary blob attachments
- Authentication via session tokens and uplink keys
- Heartbeat interval: ~30 seconds

### Component Mapping Strategy
- Parse form_template.yaml to extract component tree
- Map Anvil component types to React equivalents
- Preserve property names and event bindings
- Implement layout containers (ColumnPanel, LinearPanel, etc.)
- Support theme system and Material Design styling

### State Management Requirements
- Maintain component property synchronization
- Handle async operations with suspension/promise pattern
- Implement form navigation and startup logic
- Support data binding expressions and computed properties

### Critical Compatibility Points
- anvil.server.call() function signature and behavior
- Component instantiation from YAML specifications
- Event binding format and execution context
- Data Tables service API compatibility
- Users service authentication flows

## Architecture Strengths

1. **Clean Separation**: Server (Clojure) and client (JS) have distinct responsibilities
2. **Extensible Services**: Plugin architecture for adding new services
3. **Robust Communication**: WebSocket with HTTP fallback and automatic reconnection
4. **Python Everywhere**: Consistent Python API for both client and server
5. **Component System**: Reusable UI components with property/event binding
6. **Development Experience**: Visual designer with code generation

This analysis provides the foundation for building a compatible NextJS bridge that can parse Anvil apps, render components as React equivalents, and maintain full protocol compatibility with Anvil servers. 