# Docker-Based Testing

## Overview

The Anvil-NextJS Bridge now supports fully containerized testing using Docker and Docker Compose. This eliminates the need to install PostgreSQL, Python, Java, or other dependencies on your host machine.

## Benefits of Containerized Testing

✅ **Zero Dependencies**: Only requires Docker and Docker Compose  
✅ **Consistent Environment**: Same results across all machines  
✅ **Isolated Testing**: No conflicts with existing services  
✅ **Easy CI/CD**: Perfect for automated testing pipelines  
✅ **Clean Cleanup**: Complete environment teardown  

## Quick Start

### Prerequisites
- Docker (>= 20.10)
- Docker Compose (>= 2.0)

### Run the Complete Todo Demo Test
```bash
# Build and run the entire containerized test environment
npm run test:docker

# Clean up everything afterward
npm run test:docker:clean
```

That's it! The test will:
1. 🐳 Build the test container with all dependencies
2. 🗄️ Start PostgreSQL container
3. 🚀 Create Todo demo app and start all services
4. 🧪 Run complete user workflow test
5. 🧹 Clean up everything

## Available Commands

### Main Commands
```bash
# Run complete containerized test suite
npm run test:docker

# Clean up all containers and volumes
npm run test:docker:clean

# Run just the test inside container (for development)
npm run test:e2e:todo:docker
```

### Development Commands
```bash
# Build the test image only
docker-compose -f docker-compose.test.yml build

# Start services without running test
docker-compose -f docker-compose.test.yml up postgres

# View logs
docker-compose -f docker-compose.test.yml logs

# Execute commands inside test container
docker-compose -f docker-compose.test.yml exec anvil-test /bin/bash
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │   PostgreSQL    │    │         Test Container           │ │
│  │   Container     │    │                                  │ │
│  │                 │    │  ┌─────────────────────────────┐ │ │
│  │ • Database      │◄──►│  │       Anvil Server         │ │ │
│  │ • Port 5432     │    │  │       (Port 3030)          │ │ │
│  │ • Volume persist│    │  └─────────────────────────────┘ │ │
│  └─────────────────┘    │                                  │ │
│                         │  ┌─────────────────────────────┐ │ │
│                         │  │     WebSocket Bridge       │ │ │
│                         │  │       (Port 3001)          │ │ │
│                         │  └─────────────────────────────┘ │ │
│                         │                                  │ │
│                         │  ┌─────────────────────────────┐ │ │
│                         │  │      NextJS Bridge         │ │ │
│                         │  │       (Port 3000)          │ │ │
│                         │  └─────────────────────────────┘ │ │
│                         │                                  │ │
│                         │  ┌─────────────────────────────┐ │ │
│                         │  │    Playwright Browser      │ │ │
│                         │  │      (Chromium)            │ │ │
│                         │  └─────────────────────────────┘ │ │
│                         └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Container Details

### Test Container (`anvil-test`)
- **Base**: Node.js 18 on Debian Bullseye
- **Includes**: Python 3, PostgreSQL client, OpenJDK 11, Playwright
- **Purpose**: Runs the complete test suite
- **Ports**: 3000 (NextJS), 3001 (WebSocket), 3030 (Anvil)

### PostgreSQL Container (`postgres`)
- **Base**: PostgreSQL 15 Alpine
- **Database**: `anvil_test`
- **User**: `anvil_user` / `anvil_password`
- **Port**: 5432
- **Persistence**: Named volume for data

## Environment Variables

The containers use these key environment variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://anvil_user:anvil_password@postgres:5432/anvil_test
PGHOST=postgres
PGPORT=5432
PGDATABASE=anvil_test
PGUSER=anvil_user
PGPASSWORD=anvil_password

# Anvil Configuration
ANVIL_SERVER_URL=localhost
ANVIL_SERVER_PORT=3030
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
NEXT_PUBLIC_ANVIL_SERVER_URL=http://localhost:3030

# Test Configuration
NODE_ENV=test
CI=true
DOCKER_ENV=true
```

## Volume Mounts

```yaml
volumes:
  # Test artifacts (accessible from host)
  - ./test-results:/app/test-results
  
  # Source code (for development)
  - ./src:/app/src
  - ./tests:/app/tests
  - ./tools:/app/tools
  
  # PostgreSQL persistence
  - postgres_data:/var/lib/postgresql/data
```

## Test Artifacts

After running tests, you'll find artifacts in `test-results/`:

```
test-results/
├── videos/
│   └── todo-demo/           # Screen recordings
├── screenshots/             # Failure screenshots
├── traces/                  # Playwright traces
├── har/
│   └── todo-demo.har       # Network traffic logs
└── e2e-results.json        # Test results
```

## Debugging

### View Container Logs
```bash
# All services
docker-compose -f docker-compose.test.yml logs

# Specific service
docker-compose -f docker-compose.test.yml logs anvil-test
docker-compose -f docker-compose.test.yml logs postgres
```

### Access Container Shell
```bash
# Main test container
docker-compose -f docker-compose.test.yml exec anvil-test /bin/bash

# PostgreSQL container
docker-compose -f docker-compose.test.yml exec postgres psql -U anvil_user -d anvil_test
```

### Check Service Health
```bash
# Container status
docker-compose -f docker-compose.test.yml ps

# PostgreSQL health
docker-compose -f docker-compose.test.yml exec postgres pg_isready -U anvil_user

# Port mappings
docker-compose -f docker-compose.test.yml port anvil-test 3000
```

### Run Individual Commands
```bash
# Inside test container
docker-compose -f docker-compose.test.yml exec anvil-test npm test
docker-compose -f docker-compose.test.yml exec anvil-test anvil-app-server --version
docker-compose -f docker-compose.test.yml exec anvil-test npx playwright --version
```

## Troubleshooting

### Common Issues

**Docker Not Running**
```bash
# Check Docker status
docker --version
docker-compose --version
docker ps

# Start Docker (varies by OS)
# macOS: Open Docker Desktop
# Linux: sudo systemctl start docker
```

**Port Conflicts**
```bash
# Check what's using ports
lsof -i :3000
lsof -i :3001
lsof -i :3030
lsof -i :5432

# Stop conflicting services
npm run test:docker:clean
```

**Build Failures**
```bash
# Clean rebuild
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml build --no-cache
```

**Database Connection Issues**
```bash
# Check PostgreSQL container
docker-compose -f docker-compose.test.yml exec postgres pg_isready -U anvil_user

# View PostgreSQL logs
docker-compose -f docker-compose.test.yml logs postgres

# Reset database
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up postgres
```

### Performance Tips

**Speed Up Builds**
- Use `.dockerignore` to exclude unnecessary files
- Leverage Docker build cache
- Use `--parallel` flag for faster startup

**Optimize Test Runs**
- Use `--project=chromium` for single browser testing
- Reduce timeout values for faster feedback
- Run tests in headless mode (default)

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker E2E Tests

on: [push, pull_request]

jobs:
  docker-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Run Docker Tests
      run: |
        cd bridge
        npm run test:docker
    
    - name: Upload Test Artifacts
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: bridge/test-results/
```

### GitLab CI Example
```yaml
docker-tests:
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - apk add --no-cache docker-compose npm
  script:
    - cd bridge
    - npm run test:docker
  artifacts:
    when: always
    paths:
      - bridge/test-results/
```

## Development Workflow

### Iterative Testing
```bash
# 1. Start persistent services
docker-compose -f docker-compose.test.yml up -d postgres

# 2. Run test container interactively
docker-compose -f docker-compose.test.yml run --rm anvil-test /bin/bash

# 3. Inside container, run tests repeatedly
npm run test:e2e:todo:docker --headed

# 4. Cleanup when done
docker-compose -f docker-compose.test.yml down -v
```

### Code Changes
Source code is mounted as volumes, so you can:
1. Edit code on host machine
2. Changes are immediately available in container
3. Re-run tests without rebuilding

## Best Practices

1. **Always Clean Up**: Use `npm run test:docker:clean` after testing
2. **Check Logs**: View container logs when debugging issues
3. **Use Volumes**: Mount important directories for persistence
4. **Resource Limits**: Consider adding memory/CPU limits for CI
5. **Security**: Use non-root users in production containers

This containerized setup provides a robust, reproducible testing environment that works consistently across development, CI/CD, and production scenarios. 