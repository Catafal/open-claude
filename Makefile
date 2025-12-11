# =============================================================================
# Open Claude - Makefile
# =============================================================================
# Quick commands for development and setup
#
# Usage:
#   make help          - Show all available commands
#   make setup         - Full setup (app + vibevoice)
#   make dev           - Start development
#   make build         - Build the app
#   make dist          - Create distributable .dmg
# =============================================================================

.PHONY: help setup setup-app setup-vibevoice dev build dist clean start-vibevoice

# Default target
help:
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║              Open Claude - Development Commands               ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "  Setup Commands:"
	@echo "    make setup           - Full setup (npm install + vibevoice)"
	@echo "    make setup-app       - Install npm dependencies only"
	@echo "    make setup-vibevoice - Setup VibeVoice TTS server"
	@echo ""
	@echo "  Development Commands:"
	@echo "    make dev             - Build and run in development mode"
	@echo "    make build           - Build TypeScript and renderer"
	@echo "    make start           - Run the built app"
	@echo ""
	@echo "  Distribution Commands:"
	@echo "    make dist            - Create .dmg for distribution"
	@echo "    make pack            - Create unpacked app (for testing)"
	@echo "    make clean           - Remove build artifacts"
	@echo ""
	@echo "  VibeVoice Commands:"
	@echo "    make start-vibevoice       - Start VibeVoice server (0.5B)"
	@echo "    make start-vibevoice-1.5b  - Start VibeVoice server (1.5B)"
	@echo ""

# =============================================================================
# Setup Commands
# =============================================================================

# Full setup - everything needed to develop
setup: setup-app setup-vibevoice
	@echo ""
	@echo "✓ Full setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Run 'make dev' to start the app"
	@echo "  2. Run 'make start-vibevoice' in another terminal for TTS"

# Install npm dependencies
setup-app:
	@echo "Installing npm dependencies..."
	pnpm install
	@echo "✓ App dependencies installed"

# Setup VibeVoice TTS server
setup-vibevoice:
	@echo "Setting up VibeVoice TTS..."
	@chmod +x scripts/setup-vibevoice.sh
	@./scripts/setup-vibevoice.sh

# =============================================================================
# Development Commands
# =============================================================================

# Build and run in development mode
dev:
	pnpm run dev

# Build TypeScript and renderer bundles
build:
	pnpm run build

# Run the already-built app
start:
	electron .

# =============================================================================
# Distribution Commands
# =============================================================================

# Create distributable .dmg
dist: build
	pnpm run dist
	@echo ""
	@echo "✓ Distribution created in release/"

# Create unpacked app for testing
pack: build
	pnpm run pack
	@echo ""
	@echo "✓ Unpacked app created in release/"

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf release/
	rm -rf static/js/*.js
	@echo "✓ Build artifacts cleaned"

# =============================================================================
# VibeVoice Commands
# =============================================================================

# Start VibeVoice server with 0.5B model (fast)
start-vibevoice:
	@if [ -f "$$HOME/.vibevoice/start-server.sh" ]; then \
		$$HOME/.vibevoice/start-server.sh 0.5b; \
	else \
		echo "VibeVoice not set up. Run 'make setup-vibevoice' first."; \
		exit 1; \
	fi

# Start VibeVoice server with 1.5B model (quality)
start-vibevoice-1.5b:
	@if [ -f "$$HOME/.vibevoice/start-server.sh" ]; then \
		$$HOME/.vibevoice/start-server.sh 1.5b; \
	else \
		echo "VibeVoice not set up. Run 'make setup-vibevoice' first."; \
		exit 1; \
	fi
