#!/bin/bash

# Anvil-NextJS Universal Bridge Demo Installer
# This script sets up the complete development environment for the Anvil-NextJS Bridge
# 
# Options:
# 1. Deploy demo Todo List app (no additional setup required)
# 2. Deploy your own Anvil app (requires SSH access to Anvil git repository)
#
# For custom apps, ensure you have SSH keys configured for Anvil:
# https://anvil.works/docs/version-control/git

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    log_info "Detected OS: $OS"
}

# Install system dependencies
install_system_deps() {
    log_info "Installing system dependencies..."
    
    if [[ "$OS" == "linux" ]]; then
        log_info "Installing Linux dependencies..."
        sudo apt-get update
        sudo apt-get install -y openjdk-11-jdk libpq-dev python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib curl wget git
        
        # Install Google Chrome for testing
        if ! command -v google-chrome &> /dev/null; then
            log_info "Installing Google Chrome..."
            wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
            echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
            sudo apt-get update
            sudo apt-get install -y google-chrome-stable
        fi
        
        # Install Ghostscript
        sudo apt-get install -y ghostscript
        
        # Set JAVA_HOME
        export JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"
        
    elif [[ "$OS" == "macos" ]]; then
        log_info "Installing macOS dependencies..."
        
        # Check if Homebrew is installed
        if ! command -v brew &> /dev/null; then
            log_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        # Install dependencies
        brew install openjdk@11 postgresql pgcli node npm git
        
        # Set JAVA_HOME for macOS
        export JAVA_HOME="/opt/homebrew/opt/openjdk@11"
        
        # Start PostgreSQL service
        brew services start postgresql@14 || brew services start postgresql
    fi
    
    export PATH="$JAVA_HOME/bin:$PATH"
    log_success "System dependencies installed"
}

# Setup PostgreSQL database
setup_database() {
    log_info "Setting up PostgreSQL database..."
    
    if [[ "$OS" == "linux" ]]; then
        # Start PostgreSQL service
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        
        # Create database and user
        sudo -u postgres createdb anvil_test_db 2>/dev/null || log_warning "Database anvil_test_db already exists"
        sudo -u postgres psql -c "CREATE USER anvil_user WITH PASSWORD 'anvil_password';" 2>/dev/null || log_warning "User anvil_user already exists"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE anvil_test_db TO anvil_user;" 2>/dev/null
        
        DB_URL="jdbc:postgresql://anvil_user:anvil_password@localhost/anvil_test_db"
        
    elif [[ "$OS" == "macos" ]]; then
        # Create database (assuming current user has postgres privileges)
        createdb anvil_test_db 2>/dev/null || log_warning "Database anvil_test_db already exists"
        DB_URL="jdbc:postgresql://localhost/anvil_test_db"
    fi
    
    log_success "Database setup complete"
}

# Note: PostgreSQL JDBC driver is bundled with anvil-app-server
# No separate driver download needed when using proper jdbc: URL format

# Setup Python environment
setup_python_env() {
    log_info "Setting up Python virtual environment..."
    
    # Create virtual environment
    python3 -m venv .venv
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install anvil-app-server
    pip install anvil-app-server
    
    log_success "Python environment setup complete"
}

# Ask user for app choice
choose_app_type() {
    echo
    log_info "🚀 Choose your deployment option:"
    echo "  1) Deploy the demo Todo List app (recommended for first-time users)"
    echo "  2) Deploy your own Anvil app from git"
    echo
    
    while true; do
        read -p "Enter your choice (1 or 2): " choice
        case $choice in
            1)
                APP_TYPE="demo"
                APP_NAME="MyTodoList"
                log_info "Selected: Demo Todo List application"
                break
                ;;
            2)
                APP_TYPE="custom"
                get_custom_app_details
                break
                ;;
            *)
                echo "Please enter 1 or 2"
                ;;
        esac
    done
}

# Get custom app details from user
get_custom_app_details() {
    echo
    log_info "📋 To clone your Anvil app, you'll need the SSH clone URL from your Anvil Editor."
    echo
    echo "🔍 How to find your SSH clone URL:"
    echo "  1. Open your app in the Anvil Editor (https://anvil.works)"
    echo "  2. Click the 'Version History' tab (⏱️) in the left sidebar"
    echo "  3. Click 'Clone with Git' button"
    echo "  4. Copy the complete SSH URL from the dialog"
    echo "     (Format: ssh://user@anvil.works:2222/ABC123.git)"
    echo
    
    while true; do
        echo "📝 Paste your complete SSH clone URL:"
        read -p "> " FULL_SSH_URL
        
        # Trim whitespace
        FULL_SSH_URL=$(echo "$FULL_SSH_URL" | xargs)
        
        # Validate the URL format
        if [[ $FULL_SSH_URL =~ ssh://.*@anvil\.works:2222/.*\.git ]]; then
            # Extract app name from URL (everything after last slash, remove .git)
            APP_NAME=$(basename "$FULL_SSH_URL" .git)
            log_info "Selected: Custom app '$APP_NAME'"
            
            # Ask for confirmation
            read -p "Deploy app '$APP_NAME'? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                break
            else
                echo "Let's try again..."
                continue
            fi
        else
            log_error "Invalid SSH URL format. Expected: ssh://user@anvil.works:2222/APPID.git"
            echo "Example: ssh://bridget%40anvil.works@anvil.works:2222/RJYQKQBMRN2JJF6U.git"
            echo
        fi
    done
}

# Clone custom Anvil app
clone_custom_app() {
    log_info "Cloning your Anvil application..."
    
    # Ensure we're in the project root
    cd "$(dirname "$0")"
    
    # Create anvil-testing directory
    mkdir -p anvil-testing
    cd anvil-testing
    
    # Clone the custom app
    if [[ ! -d "$APP_NAME" ]]; then
        log_info "Cloning app from: $FULL_SSH_URL"
        
        # Clone the app
        if git clone "$FULL_SSH_URL" "$APP_NAME"; then
            log_success "Custom Anvil app '$APP_NAME' cloned successfully"
        else
            log_error "Failed to clone app. Common issues:"
            log_error "• Check your SSH URL is correct"
            log_error "• Ensure SSH keys are configured for Anvil (https://anvil.works/docs/version-control/git)"
            log_error "• Verify you have access to this app in your Anvil account"
            log_error "• Make sure git is installed and SSH is working"
            echo
            log_info "To test SSH access manually, try:"
            echo "  ssh -T git@anvil.works"
            echo
            exit 1
        fi
    else
        log_info "App '$APP_NAME' already exists"
    fi
    
    cd ..
}

# Create demo Anvil app
create_demo_app() {
    log_info "Creating demo Anvil application..."
    
    # Ensure we're in the project root
    cd "$(dirname "$0")"
    
    # Create anvil-testing directory
    mkdir -p anvil-testing
    cd anvil-testing
    
    # Create demo app if it doesn't exist
    if [[ ! -d "$APP_NAME" ]]; then
        source ../.venv/bin/activate
        create-anvil-app todo-list "$APP_NAME"
        log_success "Demo Anvil app '$APP_NAME' created"
    else
        log_info "Demo app '$APP_NAME' already exists"
    fi
    
    cd ..
}

# Setup Anvil application (demo or custom)
setup_anvil_app() {
    choose_app_type
    
    if [[ "$APP_TYPE" == "demo" ]]; then
        create_demo_app
    else
        clone_custom_app
    fi
}

# Start Anvil server
start_anvil_server() {
    log_info "Starting Anvil app server..."
    
    # Ensure we're in the project root
    cd "$(dirname "$0")"
    
    # Kill any existing anvil server processes
    pkill -f "anvil-app-server" 2>/dev/null || true
    pkill -f "java.*anvil" 2>/dev/null || true
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Set Java environment (needed for anvil-app-server to find Java)
    export JAVA_HOME
    export PATH="$JAVA_HOME/bin:$PATH"
    
    log_info "Using database: $DB_URL"
    log_info "Starting Anvil server on port 3030..."
    
    # Start the server using the official anvil-app-server command
    # PostgreSQL JDBC driver is bundled - no external driver needed
    # --auto-migrate ensures database schema changes are applied automatically
    nohup anvil-app-server \
        --app "anvil-testing/$APP_NAME" \
        --port 3030 \
        --database "$DB_URL" \
        --auto-migrate \
        > anvil-server.log 2>&1 &
    
    # Wait for server to start
    for i in {1..30}; do
        if curl -s http://localhost:3030 > /dev/null 2>&1; then
            log_success "Anvil server started successfully on http://localhost:3030"
            return 0
        fi
        sleep 2
    done
    
    log_error "Anvil server failed to start. Check anvil-server.log for details."
    tail -20 anvil-server.log
    exit 1
}

# Setup NextJS environment
setup_nextjs() {
    log_info "Setting up NextJS environment..."
    
    cd bridge
    
    # Install npm dependencies
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing npm dependencies..."
        npm install
    else
        log_info "npm dependencies already installed"
    fi
    
    # Create .env.local if it doesn't exist
    if [[ ! -f ".env.local" ]]; then
        log_info "Creating .env.local configuration..."
        cat > .env.local << EOF
# Anvil server configuration
ANVIL_SERVER_URL=localhost
ANVIL_SERVER_PORT=3030
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3000/api/ws
NEXT_PUBLIC_ANVIL_SERVER_URL=http://localhost:3030

# Development settings
NODE_ENV=development
EOF
        log_success ".env.local created"
    else
        log_info ".env.local already exists"
    fi
    
    cd ..
}

# Start NextJS development server
start_nextjs_server() {
    log_info "Starting NextJS development server..."
    
    cd bridge
    
    # Kill any existing Next.js processes
    pkill -f "next" 2>/dev/null || true
    
    # Start Next.js in background
    log_info "Starting NextJS server on port 3000..."
    nohup npm run dev > ../nextjs-server.log 2>&1 &
    
    # Wait for server to start
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log_success "NextJS server started successfully on http://localhost:3000"
            cd ..
            return 0
        fi
        sleep 2
    done
    
    log_error "NextJS server failed to start. Check nextjs-server.log for details."
    tail -20 ../nextjs-server.log
    cd ..
    exit 1
}

# Run tests to verify installation
run_verification_tests() {
    log_info "Running verification tests..."
    
    cd bridge
    
    # Run a subset of tests to verify everything is working
    log_info "Running basic test suite..."
    npm test -- --testPathPatterns="tests/protocol/protocol-compliance.test.ts" --verbose
    
    if [[ $? -eq 0 ]]; then
        log_success "Verification tests passed!"
    else
        log_warning "Some tests failed, but the demo should still work"
    fi
    
    cd ..
}

# Main installation function
main() {
    log_info "Starting Anvil-NextJS Universal Bridge Demo Installation..."
    log_info "This will set up a complete development environment with demo applications."
    
    # Get project root directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR"
    
    # Check if we're in the right directory
    if [[ ! -d "bridge" ]] || [[ ! -f "README.md" ]]; then
        log_error "This script must be run from the anvil-runtime project root directory"
        exit 1
    fi
    
    detect_os
    install_system_deps
    setup_database
    setup_python_env
    setup_anvil_app
    setup_nextjs
    start_anvil_server
    start_nextjs_server
    
    # Optional: run verification tests
    read -p "Do you want to run verification tests? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_verification_tests
    fi
    
    # Final success message
    echo
    echo "🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉"
    log_success "                   🚀 INSTALLATION COMPLETE! 🚀"
    echo "🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉"
    echo
    log_success "✨ Your Anvil-NextJS Universal Bridge demo is ready!"
    echo
    echo "🌐 Visit your demo application:"
    echo "  ┌─────────────────────────────────────────────────────┐"
    echo "  │                                                     │"
    echo "  │  🔗 http://localhost:3000                           │"
    echo "  │                                                     │"
    echo "  │  👆 Click this link or copy to your browser        │"
    echo "  │                                                     │"
    echo "  └─────────────────────────────────────────────────────┘"
    echo
    echo "🎯 What you'll see:"
    if [[ "$APP_TYPE" == "demo" ]]; then
        echo "  • Todo List demo application built with Anvil"
    else
        echo "  • Your custom Anvil application: $APP_NAME"
    fi
    echo "  • Running on NextJS with modern web features"
    echo "  • Identical functionality to native Anvil"
    echo "  • Real-time data persistence with PostgreSQL"
    echo
    echo "📱 Server Status:"
    echo "  ✅ Anvil Server: http://localhost:3030 (backend)"
    echo "  ✅ NextJS Bridge: http://localhost:3000 (frontend)"
    echo
    echo "📝 Logs (if you need to debug):"
    echo "  • Anvil server: anvil-server.log"
    echo "  • NextJS server: nextjs-server.log"
    echo
    echo "🛠️ To stop the servers when done:"
    echo "  pkill -f 'java.*anvil'"
    echo "  pkill -f 'next'"
    echo
    echo "📚 Learn more:"
    echo "  • Project README: $(pwd)/bridge/README.md"
    echo "  • Migration Guide: $(pwd)/bridge/docs/migration-guide.md"
    echo "  • Extension Guide: $(pwd)/bridge/docs/extension-guide.md"
    echo
    log_success "🎊 Enjoy exploring the Anvil-NextJS Universal Bridge!"
    echo
}

# Handle script interruption
trap 'log_error "Installation interrupted"; exit 1' INT TERM

# Run main function
main "$@" 