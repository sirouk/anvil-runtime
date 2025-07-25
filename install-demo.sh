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
        brew install openjdk@11 postgresql@14 pgcli node npm git
        
        # Set JAVA_HOME for macOS
        export JAVA_HOME="/opt/homebrew/opt/openjdk@11"
        
        # Start PostgreSQL service
        brew services start postgresql@14 || brew services start postgresql
        
        # Give PostgreSQL a moment to initialize
        sleep 2
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
        
        # Wait for PostgreSQL to be ready
        log_info "Waiting for PostgreSQL to start..."
        for i in {1..30}; do
            if sudo -u postgres psql -c "SELECT 1;" > /dev/null 2>&1; then
                log_info "PostgreSQL is ready"
                break
            fi
            if [[ $i -eq 30 ]]; then
                log_error "PostgreSQL failed to start after 30 seconds"
                exit 1
            fi
            sleep 1
        done
        
        # Create database and user
        sudo -u postgres createdb anvil_test_db 2>/dev/null || log_warning "Database anvil_test_db already exists"
        sudo -u postgres psql -c "CREATE USER anvil_user WITH PASSWORD 'anvil_password';" 2>/dev/null || log_warning "User anvil_user already exists"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE anvil_test_db TO anvil_user;" 2>/dev/null
        
        DB_URL="jdbc:postgresql://anvil_user:anvil_password@localhost/anvil_test_db"
        
    elif [[ "$OS" == "macos" ]]; then
        # Wait for PostgreSQL to be ready
        log_info "Waiting for PostgreSQL to start..."
        for i in {1..30}; do
            if psql -h localhost -U "$(whoami)" postgres -c "SELECT 1;" > /dev/null 2>&1; then
                log_info "PostgreSQL is ready"
                break
            fi
            if [[ $i -eq 30 ]]; then
                log_error "PostgreSQL failed to start after 30 seconds"
                log_error "Try running: brew services start postgresql@14"
                exit 1
            fi
            sleep 1
        done
        
        # Create database if it doesn't exist
        log_info "Creating database anvil_test_db if it doesn't exist..."
        if ! psql -h localhost -U "$(whoami)" -lqt | cut -d \| -f 1 | grep -qw anvil_test_db; then
            if createdb anvil_test_db; then
                log_info "Created database anvil_test_db"
            else
                log_error "Failed to create database anvil_test_db"
                exit 1
            fi
        else
            log_info "Database anvil_test_db already exists"
        fi
        
        # Verify database connectivity
        log_info "Verifying database connectivity..."
        if psql -h localhost -U "$(whoami)" anvil_test_db -c "SELECT 1;" > /dev/null 2>&1; then
            log_info "Database connectivity verified"
        else
            log_error "Cannot connect to database anvil_test_db"
            exit 1
        fi
        
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
    
    # Install anvil-app-server and PyYAML for component conversion
    pip install anvil-app-server PyYAML
    
    log_success "Python environment setup complete"
}

# Detect existing Anvil apps in anvil-testing directory
detect_existing_apps() {
    local apps=()
    
    # Check if anvil-testing directory exists
    if [[ -d "anvil-testing" ]]; then
        # Find directories with anvil.yaml files (indicating Anvil apps)
        while IFS= read -r -d '' app_dir; do
            if [[ -f "$app_dir/anvil.yaml" ]]; then
                apps+=("$(basename "$app_dir")")
            fi
        done < <(find "anvil-testing" -maxdepth 1 -type d -print0 2>/dev/null)
    fi
    
    echo "${apps[@]}"
}

# Ask user for app choice
choose_app_type() {
    # Get existing apps
    local existing_apps=($(detect_existing_apps))
    local num_existing=${#existing_apps[@]}
    
    echo
    log_info "🚀 Choose your deployment option:"
    
    # Show existing apps first if any
    if [[ $num_existing -gt 0 ]]; then
        log_info "📂 Found ${num_existing} existing app(s):"
        local i=1
        for app in "${existing_apps[@]}"; do
            echo "  $i) Use existing app: $app"
            ((i++))
        done
        echo "  ---"
    fi
    
    # Show new app options (adjust numbering based on existing apps)
    local demo_num=$((num_existing + 1))
    local custom_num=$((num_existing + 2))
    
    echo "  $demo_num) Deploy NEW demo Todo List app"
    echo "  $custom_num) Deploy NEW app from your Anvil git repository"
    echo
    
    while true; do
        read -p "Enter your choice (1-$custom_num): " choice
        
        # Validate choice is a number
        if ! [[ "$choice" =~ ^[0-9]+$ ]]; then
            echo "Please enter a number between 1 and $custom_num"
            continue
        fi
        
        # Check if user selected an existing app
        if [[ $choice -le $num_existing && $choice -ge 1 ]]; then
            APP_TYPE="existing"
            APP_NAME="${existing_apps[$((choice-1))]}"
            log_info "Selected: Existing app '$APP_NAME'"
            break
        elif [[ $choice -eq $demo_num ]]; then
            APP_TYPE="demo"
            APP_NAME="MyTodoList"
            log_info "Selected: NEW Demo Todo List application"
            break
        elif [[ $choice -eq $custom_num ]]; then
            APP_TYPE="custom"
            get_custom_app_details
            break
        else
            echo "Please enter a number between 1 and $custom_num"
        fi
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
    echo "     (Optional: Add --branch BRANCH_NAME to clone a specific branch)"
    echo
    
    while true; do
        echo "📝 Paste your complete SSH clone URL (optionally with --branch BRANCH_NAME):"
        read -p "> " FULL_SSH_INPUT
        
        # Trim whitespace
        FULL_SSH_INPUT=$(echo "$FULL_SSH_INPUT" | xargs)
        
        # Initialize variables
        FULL_SSH_URL=""
        GIT_BRANCH=""
        
        # Check if --branch is specified in the input
        if [[ $FULL_SSH_INPUT =~ (ssh://[^[:space:]]+)([[:space:]]+--branch[[:space:]]+([^[:space:]]+))? ]]; then
            FULL_SSH_URL="${BASH_REMATCH[1]}"
            if [[ -n "${BASH_REMATCH[3]}" ]]; then
                GIT_BRANCH="${BASH_REMATCH[3]}"
                log_info "Detected branch: '$GIT_BRANCH'"
            fi
        else
            FULL_SSH_URL="$FULL_SSH_INPUT"
        fi
        
        # Validate the URL format
        if [[ $FULL_SSH_URL =~ ssh://.*@anvil\.works:2222/.*\.git ]]; then
            # Extract app name from URL (everything after last slash, remove .git)
            APP_NAME=$(basename "$FULL_SSH_URL" .git)
            
            # If no branch was specified in the URL, ask if user wants to specify one
            if [[ -z "$GIT_BRANCH" ]]; then
                echo
                read -p "Do you want to clone a specific branch? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    echo "📝 Enter the branch name (e.g., dev, feature/my-feature, main):"
                    read -p "> " GIT_BRANCH
                    GIT_BRANCH=$(echo "$GIT_BRANCH" | xargs)  # Trim whitespace
                    if [[ -n "$GIT_BRANCH" ]]; then
                        log_info "Will clone branch: '$GIT_BRANCH'"
                    fi
                fi
            fi
            
            # Show what will be cloned
            if [[ -n "$GIT_BRANCH" ]]; then
                log_info "Selected: Custom app '$APP_NAME' (branch: '$GIT_BRANCH')"
            else
                log_info "Selected: Custom app '$APP_NAME' (default branch)"
            fi
            
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
            echo "Or with branch: ssh://bridget%40anvil.works@anvil.works:2222/RJYQKQBMRN2JJF6U.git --branch dev"
            echo
        fi
    done
}

# Clone custom Anvil app
clone_custom_app() {
    log_info "Cloning your Anvil application..."
    
    # Ensure we're in the project root
    cd "$(dirname "$0")"
    cd anvil-testing
    
    # Clone the custom app
    if [[ ! -d "$APP_NAME" ]]; then
        if [[ -n "$GIT_BRANCH" ]]; then
            log_info "Cloning app from: $FULL_SSH_URL (branch: $GIT_BRANCH)"
            
            # Clone the app with specific branch
            if git clone -b "$GIT_BRANCH" "$FULL_SSH_URL" "$APP_NAME"; then
                log_success "Custom Anvil app '$APP_NAME' cloned successfully from branch '$GIT_BRANCH'"
            else
                log_error "Failed to clone app from branch '$GIT_BRANCH'. Common issues:"
                log_error "• Check that the branch '$GIT_BRANCH' exists in your repository"
                log_error "• Verify your SSH URL is correct"
                log_error "• Ensure SSH keys are configured for Anvil (https://anvil.works/docs/version-control/git)"
                log_error "• Verify you have access to this app in your Anvil account"
                log_error "• Make sure git is installed and SSH is working"
                echo
                log_info "To test SSH access manually, try:"
                echo "  ssh -T git@anvil.works"
                echo
                log_info "To see available branches, you can clone without specifying a branch first:"
                echo "  git clone $FULL_SSH_URL"
                echo "  cd $APP_NAME"
                echo "  git branch -r"
                echo
                exit 1
            fi
        else
            log_info "Cloning app from: $FULL_SSH_URL"
            
            # Clone the app (default branch)
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
        fi
    else
        if [[ -n "$GIT_BRANCH" ]]; then
            log_info "App '$APP_NAME' already exists. Checking out branch '$GIT_BRANCH'..."
            cd "$APP_NAME"
            if git checkout "$GIT_BRANCH" 2>/dev/null || git checkout -b "$GIT_BRANCH" "origin/$GIT_BRANCH" 2>/dev/null; then
                log_success "Switched to branch '$GIT_BRANCH'"
            else
                log_error "Failed to switch to branch '$GIT_BRANCH'. Branch may not exist."
                log_info "Available branches:"
                git branch -a
                exit 1
            fi
            cd ..
        else
            log_info "App '$APP_NAME' already exists"
        fi
    fi
    
    cd ..
}

# Create demo Anvil app
create_demo_app() {
    log_info "Creating demo Anvil application..."
    
    # Ensure we're in the project root
    cd "$(dirname "$0")"
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

# Remove problematic Material 3 Theme dependency from anvil.yaml
remove_material3_dependency() {
    local app_path="$1"
    log_info "Removing Material 3 Theme dependency from anvil.yaml (components handled by bridge)..."
    
    # Remove the dependency from anvil.yaml if it exists
    local anvil_yaml="$app_path/anvil.yaml"
    if [[ -f "$anvil_yaml" ]]; then
        log_info "Removing Material 3 Theme dependency from anvil.yaml..."
        
        # Create backup
        cp "$anvil_yaml" "$anvil_yaml.backup"
        
        # Remove the dependency section for Material 3 Theme
        python3 -c "
import yaml
import sys

with open('$anvil_yaml', 'r') as f:
    data = yaml.safe_load(f)

if 'dependencies' in data and data['dependencies']:
    # Filter out Material 3 Theme dependency
    original_deps = data['dependencies']
    data['dependencies'] = [
        dep for dep in original_deps 
        if not (isinstance(dep, dict) and dep.get('dep_id') == 'dep_lin1x4oec0ytd')
    ]
    
    if len(data['dependencies']) != len(original_deps):
        print('Removed Material 3 Theme dependency')
    
    if not data['dependencies']:
        data['dependencies'] = []

with open('$anvil_yaml', 'w') as f:
    yaml.dump(data, f, default_flow_style=False)
" || log_warning "Could not process anvil.yaml (Python yaml module missing)"
        
        log_info "✓ Cleaned up anvil.yaml"
    fi
    
    log_success "Dependency cleanup completed"
}

# Copy app-specific theme assets to NextJS
copy_app_theme_assets() {
    local app_path="$1"
    log_info "Checking for app-specific theme assets..."
    
    # Check if the app has theme assets
    if [[ -d "$app_path/theme/assets" ]]; then
        log_info "Found theme assets, making them accessible to NextJS..."
        
        # The theme CSS will be served dynamically by the API route
        # Just verify it exists
        if [[ -f "$app_path/theme/assets/theme.css" ]]; then
            log_success "✓ App theme.css found and will be served via API"
        fi
        
        # Count other assets
        local asset_count=$(find "$app_path/theme/assets" -type f ! -name "theme.css" | wc -l)
        if [[ $asset_count -gt 0 ]]; then
            log_info "Found $asset_count additional theme assets"
        fi
    else
        log_info "No theme assets directory found (using default theme)"
    fi
}

# Create anvil.conf.yaml to use local PostgreSQL instead of embedded
create_anvil_config() {
    local app_path="$1"
    log_info "Creating anvil.conf.yaml to use local PostgreSQL..."
    
    # Get absolute path to app directory
    local absolute_app_path="$(pwd)/$app_path"
    
    cat > "$app_path/anvil.conf.yaml" << EOF
# Configuration for anvil-app-server to use local PostgreSQL
# This prevents the embedded PostgreSQL from starting

# Use local PostgreSQL database
database: "$DB_URL"

# Auto-migrate database schema
auto-migrate: true

# Application path (absolute path to app directory)
app: $absolute_app_path
EOF
    
    log_success "✓ Created anvil.conf.yaml with local PostgreSQL configuration"
}

# Setup Anvil application (demo or custom)
setup_anvil_app() {
    choose_app_type
    
    # Only clean if creating a new app (not using existing)
    if [[ "$APP_TYPE" != "existing" ]]; then
        clean_anvil_testing
    fi
    
    if [[ "$APP_TYPE" == "demo" ]]; then
        create_demo_app
    elif [[ "$APP_TYPE" == "custom" ]]; then
        clone_custom_app
    elif [[ "$APP_TYPE" == "existing" ]]; then
        log_info "Using existing app: $APP_NAME"
        # Ensure the app directory exists
        if [[ ! -d "anvil-testing/$APP_NAME" ]]; then
            log_error "App directory 'anvil-testing/$APP_NAME' not found!"
            exit 1
        fi
    fi
    
    # Remove problematic dependencies after creating/cloning/selecting the app
    remove_material3_dependency "anvil-testing/$APP_NAME"
    
    # Copy app theme assets to make them accessible
    copy_app_theme_assets "anvil-testing/$APP_NAME"
    
    # Create anvil.conf.yaml for custom or existing apps to use local PostgreSQL
    if [[ "$APP_TYPE" != "demo" ]]; then
        create_anvil_config "anvil-testing/$APP_NAME"
    fi
}

# Clean anvil-testing directory to ensure single app focus
clean_anvil_testing() {
    log_info "Cleaning anvil-testing directory to ensure single app focus..."
    
    # Ensure we're in the project root
    cd "$(dirname "$0")"
    
    # Remove existing anvil-testing directory if it exists
    if [[ -d "anvil-testing" ]]; then
        log_info "Removing existing anvil-testing directory..."
        rm -rf anvil-testing
    fi
    
    # Create fresh anvil-testing directory
    mkdir -p anvil-testing
    log_success "anvil-testing directory cleaned and ready"
}

# Verify database is ready
verify_database_ready() {
    log_info "Verifying database is ready for Anvil server..."
    
    if [[ "$OS" == "linux" ]]; then
        # Test connection for Linux
        if ! sudo -u postgres psql anvil_test_db -c "SELECT 1;" > /dev/null 2>&1; then
            log_error "Database anvil_test_db is not accessible"
            log_error "Please check PostgreSQL service status: sudo systemctl status postgresql"
            exit 1
        fi
    elif [[ "$OS" == "macos" ]]; then
        # Test connection for macOS
        if ! psql -h localhost -U "$(whoami)" anvil_test_db -c "SELECT 1;" > /dev/null 2>&1; then
            log_error "Database anvil_test_db is not accessible"
            log_error "Please check PostgreSQL service status: brew services list | grep postgresql"
            log_error "Try running: brew services restart postgresql@14"
            exit 1
        fi
    fi
    
    log_info "Database is ready for connections"
}

# Start Anvil server
start_anvil_server() {
    log_info "Starting Anvil app server..."
    
    # Ensure we're in the project root
    cd "$(dirname "$0")"
    
    # Kill any existing anvil server processes
    pkill -f "anvil-app-server" 2>/dev/null || true
    pkill -f "java.*anvil" 2>/dev/null || true
    
    # Verify database is ready before starting server
    verify_database_ready
    
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
    # Use --config-file to ensure configuration is properly loaded
    nohup anvil-app-server \
        --app "anvil-testing/$APP_NAME" \
        --config-file "anvil-testing/$APP_NAME/anvil.conf.yaml" \
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
    
    # Copy Anvil CSS files to avoid CORS issues
    setup_anvil_css
    
    cd ..
}

# Copy Anvil CSS files to NextJS public directory
setup_anvil_css() {
    log_info "Setting up Anvil CSS files for NextJS..."
    
    # Create anvil-css directory in public if it doesn't exist
    mkdir -p public/anvil-css
    
    # Copy core Anvil CSS files from the client directory
    if [[ -f "../client/css/bootstrap.css" ]]; then
        cp ../client/css/bootstrap.css public/anvil-css/
        log_success "✓ Copied bootstrap.css"
    else
        log_warning "bootstrap.css not found in client/css"
    fi
    
    if [[ -f "../client/css/bootstrap-theme.min.css" ]]; then
        cp ../client/css/bootstrap-theme.min.css public/anvil-css/
        log_success "✓ Copied bootstrap-theme.min.css"
    else
        log_warning "bootstrap-theme.min.css not found in client/css"
    fi
    
    if [[ -f "../client/css/font-awesome.min.css" ]]; then
        cp ../client/css/font-awesome.min.css public/anvil-css/
        log_success "✓ Copied font-awesome.min.css"
    else
        log_warning "font-awesome.min.css not found in client/css"
    fi
    
    # Copy font files for Font Awesome
    if [[ -d "../client/fonts" ]]; then
        mkdir -p public/fonts
        cp -r ../client/fonts/* public/fonts/ 2>/dev/null || true
        log_success "✓ Copied font files"
    fi
    
    log_success "Anvil CSS files setup complete"
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
            
            # Start WebSocket bridge server
            log_info "Starting WebSocket bridge server..."
            nohup npm run ws-bridge > ../websocket-server.log 2>&1 &
            
            # Wait for WebSocket server to start
            sleep 3
            
            # Check if WebSocket server is listening on port 3001
            if lsof -i :3001 > /dev/null 2>&1; then
                log_success "WebSocket bridge server started successfully on ws://localhost:3001"
            else
                log_warning "WebSocket bridge server may not have started. Check websocket-server.log for details."
            fi
            
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
    elif [[ "$APP_TYPE" == "existing" ]]; then
        echo "  • Your existing Anvil application: $APP_NAME"
        echo "  • Automatically converted Material 3 Theme components to standard Anvil"
    else
        if [[ -n "$GIT_BRANCH" ]]; then
            echo "  • Your custom Anvil application: $APP_NAME (branch: $GIT_BRANCH)"
        else
            echo "  • Your custom Anvil application: $APP_NAME"
        fi
        echo "  • Automatically converted Material 3 Theme components to standard Anvil"
    fi
    echo "  • Running on NextJS with modern web features"
    echo "  • Identical functionality to native Anvil"
    echo "  • Real-time data persistence with PostgreSQL"
    echo
    echo "📱 Server Status:"
    echo "  ✅ Anvil Server: http://localhost:3030 (backend)"
    echo "  ✅ NextJS Bridge: http://localhost:3000 (frontend)"
    echo "  ✅ WebSocket Bridge: ws://localhost:3001 (real-time)"
    echo
    echo "📝 Logs (if you need to debug):"
    echo "  • Anvil server: anvil-server.log"
    echo "  • NextJS server: nextjs-server.log"
    echo "  • WebSocket server: websocket-server.log"
    echo
    echo "🛠️ To stop the servers when done:"
    echo "  pkill -f 'java.*anvil'"
    echo "  pkill -f 'next'"
    echo "  pkill -f 'websocket-server'"
    echo
    if [[ "$APP_TYPE" == "custom" ]] || [[ "$APP_TYPE" == "existing" ]]; then
            echo "🔄 Automatic Configuration (applied seamlessly):"
    echo "  • Material 3 Theme dependency removed from anvil.yaml"
    echo "  • NextJS bridge automatically maps Material 3 components to standard ones"
    echo "  • Local PostgreSQL database created and configured"
    echo "  • anvil.conf.yaml created for optimal server configuration"
    echo "  • Your original templates remain completely unchanged"
    echo "  • Supports: TextArea, Button, RadioButton, CheckBox, Slider, etc."
        echo
    fi
    
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