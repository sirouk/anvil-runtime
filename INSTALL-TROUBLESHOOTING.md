# Anvil-NextJS Bridge Installation Troubleshooting Guide

This guide helps resolve common issues encountered during the installation and setup of the Anvil-NextJS Universal Bridge.

## 🚀 Quick Start

Run the automated installer:
```bash
./install-demo.sh
```

If you encounter issues, refer to the troubleshooting sections below.

## 📋 Prerequisites Check

Before running the installer, ensure you have:

### macOS
- **Homebrew**: Install from https://brew.sh/
- **Xcode Command Line Tools**: `xcode-select --install`
- **Python 3.8+**: Should be available via Homebrew

### Linux (Ubuntu/Debian)
- **sudo privileges**: Required for package installation
- **Python 3.8+**: Usually pre-installed
- **curl/wget**: For downloading dependencies

## 🔧 Common Issues and Solutions

### 1. Java Issues

#### Problem: "Unable to locate a Java Runtime"
**Solution:**
```bash
# macOS
export JAVA_HOME="/opt/homebrew/opt/openjdk@11"
export PATH="$JAVA_HOME/bin:$PATH"

# Linux
export JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"
export PATH="$JAVA_HOME/bin:$PATH"
```

#### Problem: "Could not find or load main class"
**Solution:** This usually means Java isn't properly configured. Use the official anvil-app-server command:
```bash
# Set up Java environment
source .venv/bin/activate
export JAVA_HOME="/opt/homebrew/opt/openjdk@11"  # macOS
export JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"  # Linux
export PATH="$JAVA_HOME/bin:$PATH"

# Verify Java is working
java -version

# Run with official command
anvil-app-server \
    --app anvil-testing/MyTodoList \
    --port 3030 \
    --database "jdbc:postgresql://localhost/anvil_test_db"
```

### 2. PostgreSQL Issues

#### Problem: "No suitable driver found for postgresql"
This usually means the database URL format is incorrect.

**Solution:**
```bash
# Use the correct JDBC URL format (note the jdbc: prefix)
anvil-app-server \
    --app anvil-testing/MyTodoList \
    --port 3030 \
    --database "jdbc:postgresql://localhost/anvil_test_db"

# NOT: postgresql://localhost/anvil_test_db (missing jdbc: prefix)
```

The PostgreSQL JDBC driver is bundled with anvil-app-server - no separate download needed.

#### Problem: "Data tables schema out of date" 
This happens when your Anvil app has database table changes that need to be applied.

**Solution:**
```bash
# Add the --auto-migrate flag to automatically apply schema changes
anvil-app-server \
    --app anvil-testing/YourApp \
    --port 3030 \
    --database "jdbc:postgresql://localhost/anvil_test_db" \
    --auto-migrate
```

The `--auto-migrate` flag is included in the install script by default for seamless deployment.

#### Problem: "Connection to DB failed"
**Solution:**
```bash
# Check if PostgreSQL is running
# macOS
brew services list | grep postgresql
brew services start postgresql

# Linux
sudo systemctl status postgresql
sudo systemctl start postgresql

# Test database connection
psql -d anvil_test_db -c "SELECT 1;"
```

#### Problem: Database doesn't exist
**Solution:**
```bash
# macOS
createdb anvil_test_db

# Linux
sudo -u postgres createdb anvil_test_db
```

### 3. Python/Virtual Environment Issues

#### Problem: "python3 command not found"
**Solution:**
```bash
# macOS
brew install python3

# Linux
sudo apt-get install python3 python3-pip python3-venv
```

#### Problem: "anvil-app-server command not found"
**Solution:**
```bash
# Make sure virtual environment is activated
source .venv/bin/activate

# Reinstall if necessary
pip install anvil-app-server

# Verify installation
which anvil-app-server
```

### 4. Node.js/npm Issues

#### Problem: "npm command not found"
**Solution:**
```bash
# macOS
brew install node npm

# Linux
sudo apt-get install nodejs npm

# Or use Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
```

#### Problem: npm permission errors
**Solution:**
```bash
# Fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### 5. Port Conflicts

#### Problem: "Port 3030 already in use" or "Port 3000 already in use"
**Solution:**
```bash
# Find and kill processes using the ports
lsof -ti:3030 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Or use different ports
anvil-app-server --app anvil-testing/MyTodoList --port 3031 --database "postgresql://localhost/anvil_test_db"
```

### 6. Permission Issues

#### Problem: Permission denied errors
**Solution:**
```bash
# Make sure script is executable
chmod +x install-demo.sh

# Check file permissions
ls -la install-demo.sh

# For database setup on Linux
sudo -u postgres createdb anvil_test_db
```

## 🔍 Manual Installation Steps

If the automated installer fails, follow these manual steps:

### Step 1: Install System Dependencies

**macOS:**
```bash
brew install openjdk@11 postgresql pgcli node npm
brew services start postgresql
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install openjdk-11-jdk libpq-dev python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Step 2: Setup Environment
```bash
# Set Java environment
export JAVA_HOME="/opt/homebrew/opt/openjdk@11"  # macOS
export JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"  # Linux
export PATH="$JAVA_HOME/bin:$PATH"

# Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install anvil-app-server
```

### Step 3: Setup Database
```bash
# macOS
createdb anvil_test_db

# Linux
sudo -u postgres createdb anvil_test_db
sudo -u postgres psql -c "CREATE USER anvil_user WITH PASSWORD 'anvil_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE anvil_test_db TO anvil_user;"
```

### Step 4: Create Demo App
```bash
mkdir -p anvil-testing
cd anvil-testing
create-anvil-app todo-list MyTodoList
cd ..
```

### Step 5: Start Servers
```bash
# Start Anvil server
source .venv/bin/activate
export JAVA_HOME="/opt/homebrew/opt/openjdk@11"  # macOS
export JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"  # Linux
export PATH="$JAVA_HOME/bin:$PATH"

# Start Anvil server (PostgreSQL JDBC driver is bundled)
anvil-app-server \
    --app anvil-testing/MyTodoList \
    --port 3030 \
    --database "jdbc:postgresql://localhost/anvil_test_db" \
    --auto-migrate &

# Start NextJS server
cd bridge
npm install
npm run dev &
```

## 🧪 Testing the Installation

### Verify Anvil Server
```bash
curl http://localhost:3030
# Should return HTML content
```

### Verify NextJS Server
```bash
curl http://localhost:3000
# Should return HTML content
```

### Run Test Suite
```bash
cd bridge
npm test
```

## 📋 Environment Variables

Create a `.env.local` file in the `bridge` directory:
```env
ANVIL_SERVER_URL=localhost
ANVIL_SERVER_PORT=3030
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3000/api/ws
NEXT_PUBLIC_ANVIL_SERVER_URL=http://localhost:3030
NODE_ENV=development
```

## 🔧 Useful Debugging Commands

### Check Running Processes
```bash
ps aux | grep anvil
ps aux | grep next
lsof -i :3030
lsof -i :3000
```

### Check Logs
```bash
tail -f anvil-server.log
tail -f nextjs-server.log
```

### Database Debugging
```bash
# Test database connection
psql -d anvil_test_db -c "SELECT version();"

# List databases
psql -l
```

### Java Debugging
```bash
java -version
echo $JAVA_HOME
echo $PATH
```

## 📞 Getting Help

If you're still experiencing issues:

1. **Check the logs**: `anvil-server.log` and `nextjs-server.log`
2. **Verify all prerequisites** are installed
3. **Run the manual installation steps** one by one
4. **Check GitHub issues** for similar problems
5. **Create a new issue** with:
   - Your operating system
   - Error messages
   - Log file contents
   - Output of `java -version`, `python3 --version`, `node --version`

## 🎯 Success Indicators

When everything is working correctly, you should see:

1. ✅ Anvil server responding at http://localhost:3030
2. ✅ NextJS server responding at http://localhost:3000
3. ✅ No error messages in the logs
4. ✅ Demo todo app loads in the browser
5. ✅ Basic tests pass: `npm test`

The installation is complete when you can open http://localhost:3000 and see the Anvil-NextJS Bridge demo application running. 