# 🚀 CI/CD & Containerized Testing Guide

## Overview

The Anvil-NextJS Bridge includes a comprehensive CI/CD pipeline that ensures code quality, test coverage, and deployment readiness for any Anvil application.

## 🐳 Containerized Test Environment

### Quick Start

```bash
# Run all tests in Docker
npm run test:all:ci

# Clean up after tests
npm run test:all:ci:clean

# Run specific test suites
npm run test:unit
npm run test:integration  
npm run test:e2e:todo:docker
```

### Test Types

| Test Type | Description | Command | Docker Support |
|-----------|-------------|---------|----------------|
| **Unit Tests** | Component logic, utilities, state management | `npm run test:unit` | ✅ |
| **Integration Tests** | Service integration, API calls, data flow | `npm run test:integration` | ✅ |
| **Component Tests** | React component rendering, user interactions | `npm run test:components` | ✅ |
| **Protocol Tests** | Anvil protocol compliance, WebSocket communication | `npm run test:protocol` | ✅ |
| **E2E Tests** | Full application workflows with Playwright | `npm run test:e2e` | ✅ |
| **Todo Demo Test** | Complete user workflow with data persistence | `npm run test:e2e:todo:docker` | ✅ |

### Docker Architecture

```mermaid
graph TB
    A[GitHub Actions] --> B[Docker Compose]
    B --> C[PostgreSQL Container]
    B --> D[Test Runner Container]
    D --> E[Anvil Server :3030]
    D --> F[WebSocket Bridge :3001]
    D --> G[NextJS Bridge :3000]
    D --> H[Playwright Browser]
    
    C --> I[(Test Database)]
    E --> I
    H --> G
    G --> F
    F --> E
```

### Environment Configuration

The containerized tests automatically configure:

- **PostgreSQL**: `postgres:5432` (inside container)
- **Anvil Server**: `localhost:3030`
- **WebSocket Bridge**: `localhost:3001` 
- **NextJS Bridge**: `localhost:3000`
- **Test Database**: `anvil_test` with full schema migration

## 🔄 GitHub Actions Workflow

### Pipeline Stages

1. **🔍 Lint & Type Check** (2-3 minutes)
   - ESLint code quality checks
   - TypeScript type validation
   - Fast feedback for basic issues

2. **🧪 Test Matrix** (5-10 minutes)
   - Unit tests with coverage
   - Integration tests
   - E2E tests in parallel

3. **🐳 Docker Integration** (10-15 minutes)
   - Full containerized test suite
   - Real database with migrations
   - Complete user workflow testing

4. **🔒 Security Checks** (2-3 minutes)
   - Dependency vulnerability audit
   - Outdated package detection

5. **⚡ Performance Benchmarks** (3-5 minutes)
   - Component render performance
   - WebSocket latency testing
   - Memory usage validation

6. **✅ Status Check** (Required for PR merges)
   - Aggregates all test results
   - Blocks PRs if any stage fails

### Branch Protection Setup

To enable PR protection rules:

1. Go to **Settings** → **Branches** in your GitHub repo
2. Add rule for `main`/`master` branch
3. Enable **"Require status checks to pass before merging"**
4. Select these required checks:
   - `🔍 Lint & Type Check`
   - `🧪 Comprehensive Test Suite`
   - `🐳 Docker Integration Test`
   - `🔒 Security & Dependency Check`
   - `✅ All Tests Passed`

### Workflow Triggers

- **Push** to `main`, `master`, `develop`
- **Pull Request** to protected branches
- **Manual dispatch** via GitHub UI
- **Schedule** (optional): Daily at 2 AM UTC

## 🧪 Test Development Guidelines

### Writing Docker-Compatible Tests

```typescript
// ✅ Good: Environment-aware configuration
const databaseUrl = process.env.DOCKER_ENV
  ? 'postgresql://anvil_user:anvil_password@postgres:5432/anvil_test'
  : 'postgresql://localhost:5432/anvil_test';

// ✅ Good: Timeout handling for containerized environments  
const timeout = process.env.DOCKER_ENV ? 120000 : 60000;

// ✅ Good: Service verification
async function waitForService(url: string, retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
    } catch (error) {
      console.log(`Service check ${i+1}/${retries} failed:`, error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Service at ${url} not responding after ${retries} attempts`);
}
```

### Test Isolation

Each test suite runs in isolation with:
- Fresh database per test run
- Clean Anvil app creation
- Independent service instances
- Separate result directories

### Performance Considerations

- **Parallel Execution**: Unit/integration tests run in parallel
- **Docker Layer Caching**: Dependencies cached between runs  
- **Browser Reuse**: Playwright browsers shared across E2E tests
- **Database Persistence**: PostgreSQL data volume for faster restarts

## 🎯 Quality Gates

### Coverage Requirements

- **Unit Tests**: ≥ 80% code coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical user workflows covered
- **Component Tests**: All public components tested

### Performance Thresholds

- **Test Suite Duration**: < 20 minutes total
- **Memory Usage**: < 2GB during tests
- **Database Migration**: < 30 seconds
- **Service Startup**: < 60 seconds in Docker

### Security Standards

- **Dependency Audit**: No high/critical vulnerabilities
- **Code Quality**: ESLint score ≥ 95%
- **Type Safety**: Zero TypeScript errors
- **Container Security**: Base image vulnerabilities scanned

## 🔧 Troubleshooting

### Common Issues

**Docker build failures:**
```bash
# Clear Docker cache
docker system prune -af

# Rebuild without cache
docker-compose -f docker-compose.test-all.yml build --no-cache
```

**Port conflicts:**
```bash
# Check running services
lsof -i :3000 -i :3001 -i :3030

# Kill conflicting processes
pkill -f "anvil-app-server"
pkill -f "websocket-server"
```

**Database migration timeouts:**
```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.test-all.yml logs postgres

# Connect to database directly
docker exec -it anvil-test-all-postgres psql -U anvil_user -d anvil_test
```

**Test result artifacts:**
```bash
# View test results locally
ls -la bridge/test-results/

# Download from GitHub Actions
# Go to Actions → Workflow Run → Artifacts
```

### Debugging in CI

```yaml
# Add to GitHub Actions for debugging
- name: 🐛 Debug environment
  run: |
    echo "Node version: $(node --version)"
    echo "Docker version: $(docker --version)"
    echo "Available memory: $(free -h)"
    echo "Disk space: $(df -h)"
    docker ps -a
    docker images
```

## 🚀 Future Enhancements

### Planned Improvements

- **Visual Regression Testing**: Screenshot comparisons
- **Load Testing**: Stress testing with multiple concurrent users  
- **Cross-Browser Testing**: Firefox, Safari, Edge support
- **Mobile Testing**: Responsive design validation
- **Accessibility Testing**: WCAG compliance checks
- **API Documentation**: Auto-generated from tests
- **Test Report Dashboard**: Historical test metrics

### Contributing

When adding new tests:

1. Follow the existing patterns in `tests/` directories
2. Ensure Docker compatibility with `DOCKER_ENV` checks
3. Add appropriate timeouts for containerized environments
4. Update this documentation if introducing new test types
5. Verify tests pass both locally and in CI

## 📊 Metrics & Monitoring

The CI/CD pipeline collects metrics on:

- Test execution times
- Coverage percentages  
- Flaky test detection
- Resource usage patterns
- Dependency update impact

These metrics help optimize the testing strategy and maintain high code quality standards for all Anvil developers using the bridge. 