#!/bin/bash

# Anvil-NextJS Universal Bridge Demo Cleanup Script
# This script removes all packages, databases, and configurations installed by install-demo.sh
# 
# ⚠️  WARNING: This will remove:
# - Java, PostgreSQL, Node.js, npm, git (if installed by our script)
# - All databases and data created during installation
# - Python virtual environments and dependencies
# - All demo applications and logs
#
# Use with caution! This may affect other projects on your system.

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

# Stop all running services
stop_services() {
    log_info "Stopping all demo services..."
    
    # Stop Anvil app server
    log_info "Stopping Anvil app server..."
    pkill -f "anvil-app-server" 2>/dev/null || true
    pkill -f "java.*anvil" 2>/dev/null || true
    
    # Stop NextJS server
    log_info "Stopping NextJS server..."
    pkill -f "next" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    
    # Stop WebSocket bridge server
    log_info "Stopping WebSocket bridge server..."
    pkill -f "node.*websocket-server" 2>/dev/null || true
    
    # Stop downlink host
    pkill -f "anvil_downlink_host" 2>/dev/null || true
    
    log_success "Services stopped"
}

# Clean up databases
cleanup_databases() {
    log_info "Cleaning up databases..."
    
    if [[ "$OS" == "linux" ]]; then
        # Stop PostgreSQL service
        sudo systemctl stop postgresql 2>/dev/null || true
        
        # Remove database and user
        sudo -u postgres dropdb anvil_test_db 2>/dev/null || true
        sudo -u postgres psql -c "DROP USER IF EXISTS anvil_user;" 2>/dev/null || true
        
        log_success "Database cleanup complete (Linux)"
        
    elif [[ "$OS" == "macos" ]]; then
        # Stop PostgreSQL service
        brew services stop postgresql@14 2>/dev/null || true
        brew services stop postgresql 2>/dev/null || true
        
        # Remove database
        dropdb anvil_test_db 2>/dev/null || true
        
        log_success "Database cleanup complete (macOS)"
    fi
}

# Remove Python virtual environment and packages
cleanup_python_env() {
    log_info "Cleaning up Python environment..."
    
    # Deactivate virtual environment if active
    if [[ -n "$VIRTUAL_ENV" ]]; then
        deactivate 2>/dev/null || true
    fi
    
    # Remove virtual environment
    rm -rf .venv 2>/dev/null || true
    
    # Remove Python cache files
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -name "*.pyc" -delete 2>/dev/null || true
    
    log_success "Python environment cleaned up"
}

# Remove demo applications and logs
cleanup_demo_files() {
    log_info "Cleaning up demo files and logs..."
    
    # Remove demo applications
    rm -rf anvil-testing/* 2>/dev/null || true
    
    # Remove log files
    rm -f anvil-server.log nextjs-server.log websocket-server.log 2>/dev/null || true
    
    # Remove NextJS build files and dependencies
    if [[ -d "bridge" ]]; then
        cd bridge
        rm -rf .next node_modules package-lock.json 2>/dev/null || true
        rm -f .env.local 2>/dev/null || true
        # Remove copied Anvil CSS and font files
        rm -rf public/anvil-css public/fonts 2>/dev/null || true
        cd ..
    fi
    
    log_success "Demo files and logs cleaned up"
}

# Remove system packages
remove_system_packages() {
    log_warning "⚠️  This will remove system packages that may be used by other applications!"
    read -p "Are you sure you want to remove Java, PostgreSQL, Node.js, etc.? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping system package removal"
        return 0
    fi
    
    log_info "Removing system packages..."
    
    if [[ "$OS" == "linux" ]]; then
        log_info "Removing Linux packages..."
        
        # Remove packages installed by the demo script
        sudo apt-get remove -y openjdk-11-jdk libpq-dev postgresql postgresql-contrib google-chrome-stable ghostscript 2>/dev/null || true
        sudo apt-get autoremove -y 2>/dev/null || true
        
        # Remove Google Chrome repository
        sudo rm -f /etc/apt/sources.list.d/google-chrome.list 2>/dev/null || true
        sudo apt-key del $(apt-key list | grep -A1 "Google" | grep "pub" | awk '{print $2}' | cut -d'/' -f2) 2>/dev/null || true
        
        # Remove PostgreSQL data directory
        sudo rm -rf /var/lib/postgresql 2>/dev/null || true
        sudo rm -rf /etc/postgresql 2>/dev/null || true
        
        log_success "Linux packages removed"
        
    elif [[ "$OS" == "macos" ]]; then
        log_info "Removing macOS packages..."
        
        # Remove packages installed by brew
        brew uninstall --ignore-dependencies openjdk@11 postgresql pgcli node npm git 2>/dev/null || true
        
        # Remove PostgreSQL data directories
        rm -rf /opt/homebrew/var/postgresql@14 /opt/homebrew/var/postgres* 2>/dev/null || true
        rm -f ~/.pgpass 2>/dev/null || true
        
        # Clean up Homebrew
        brew cleanup 2>/dev/null || true
        
        log_success "macOS packages removed"
    fi
}

# Reset environment variables
reset_environment() {
    log_info "Cleaning up environment variables..."
    
    # Remove Java environment variables from common shell config files
    for config_file in ~/.bashrc ~/.zshrc ~/.bash_profile ~/.profile; do
        if [[ -f "$config_file" ]]; then
            # Remove JAVA_HOME exports added by our script
            sed -i.bak '/# Added by anvil-demo/,+2d' "$config_file" 2>/dev/null || true
            sed -i.bak '/export JAVA_HOME.*openjdk/d' "$config_file" 2>/dev/null || true
            sed -i.bak '/export PATH.*JAVA_HOME/d' "$config_file" 2>/dev/null || true
        fi
    done
    
    log_success "Environment variables cleaned up"
}

# Verify cleanup
verify_cleanup() {
    log_info "Verifying cleanup..."
    
    local issues=0
    
    # Check for running processes
    if pgrep -f "anvil-app-server\|java.*anvil\|next.*dev\|websocket-server\|anvil_downlink_host" >/dev/null 2>&1; then
        log_warning "Some processes are still running"
        issues=$((issues + 1))
    fi
    
    # Check for remaining files
    if [[ -d ".venv" ]] || [[ -f "anvil-server.log" ]] || [[ -f "nextjs-server.log" ]]; then
        log_warning "Some demo files still exist"
        issues=$((issues + 1))
    fi
    
    # Check for database
    if command -v psql >/dev/null 2>&1 && psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw anvil_test_db; then
        log_warning "Database anvil_test_db still exists"
        issues=$((issues + 1))
    fi
    
    if [[ $issues -eq 0 ]]; then
        log_success "Cleanup verification passed!"
    else
        log_warning "Cleanup completed with $issues potential issues (see warnings above)"
    fi
}

# Main cleanup function
main() {
    log_info "Starting Anvil-NextJS Universal Bridge Demo Cleanup..."
    
    # Get project root directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR"
    
    # Check if we're in the right directory
    if [[ ! -d "bridge" ]] || [[ ! -f "README.md" ]]; then
        log_error "This script must be run from the anvil-runtime project root directory"
        exit 1
    fi
    
    # Final warning
    echo
    log_warning "🚨 WARNING: This will remove all demo installations and may affect other projects!"
    echo
    echo "This script will remove:"
    echo "  • All running demo servers (Anvil, NextJS)"
    echo "  • Python virtual environment and packages"
    echo "  • Demo applications and databases"
    echo "  • Log files and temporary files"
    echo "  • System packages (Java, PostgreSQL, Node.js) [optional]"
    echo
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
    
    detect_os
    stop_services
    cleanup_databases
    cleanup_python_env
    cleanup_demo_files
    
    # Ask about system packages separately
    echo
    remove_system_packages
    
    reset_environment
    verify_cleanup
    
    # Final success message
    echo
    echo "🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯"
    log_success "                   🧹 CLEANUP COMPLETE! 🧹"
    echo "🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯"
    echo
    log_success "✨ All Anvil-NextJS demo components have been removed!"
    echo
    echo "📋 What was cleaned up:"
    echo "  ✅ Stopped all demo servers and processes"
    echo "  ✅ Removed Python virtual environment"
    echo "  ✅ Cleaned up databases and data"
    echo "  ✅ Removed demo applications and logs"
    echo "  ✅ Cleaned up temporary files and caches"
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  ✅ Removed system packages (Java, PostgreSQL, Node.js)"
    else
        echo "  ⏭️  Kept system packages (Java, PostgreSQL, Node.js)"
    fi
    echo
    echo "🔄 To reinstall the demo:"
    echo "  ./install-demo.sh"
    echo
    echo "🗂️  Remaining files:"
    echo "  • bridge/ directory (NextJS bridge code)"
    echo "  • Source code and documentation"
    echo "  • This cleanup script"
    echo
    log_success "🎊 System is now clean and ready for fresh installation!"
    echo
}

# Handle script interruption
trap 'log_error "Cleanup interrupted"; exit 1' INT TERM

# Run main function
main "$@" 