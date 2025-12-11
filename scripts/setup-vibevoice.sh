#!/bin/bash
# =============================================================================
# VibeVoice TTS Setup Script for Open Claude
# =============================================================================
# This script sets up the VibeVoice local TTS server.
# Run once after installing Open Claude to enable expressive TTS.
#
# Requirements:
#   - Python 3.8+
#   - pip
#   - ~8GB disk space for model
#   - GPU with 8GB+ VRAM (for best performance)
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# VibeVoice installation directory
VIBEVOICE_DIR="$HOME/.vibevoice"
VENV_DIR="$VIBEVOICE_DIR/venv"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           VibeVoice TTS Setup for Open Claude                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# -----------------------------------------------------------------------------
# Check Python installation
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/4] Checking Python installation...${NC}"

if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    echo -e "${GREEN}✓ Found Python $PYTHON_VERSION${NC}"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    PYTHON_VERSION=$(python --version 2>&1 | cut -d' ' -f2)
    echo -e "${GREEN}✓ Found Python $PYTHON_VERSION${NC}"
else
    echo -e "${RED}✗ Python not found!${NC}"
    echo ""
    echo "Please install Python 3.8+ first:"
    echo "  macOS:   brew install python"
    echo "  Ubuntu:  sudo apt install python3 python3-pip python3-venv"
    echo "  Windows: Download from https://python.org"
    exit 1
fi

# Check Python version is 3.8+
MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 8 ]); then
    echo -e "${RED}✗ Python 3.8+ required (found $PYTHON_VERSION)${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# Create installation directory
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/4] Setting up installation directory...${NC}"

mkdir -p "$VIBEVOICE_DIR"
echo -e "${GREEN}✓ Created $VIBEVOICE_DIR${NC}"

# -----------------------------------------------------------------------------
# Create virtual environment and install packages
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/4] Creating virtual environment and installing packages...${NC}"

if [ ! -d "$VENV_DIR" ]; then
    $PYTHON_CMD -m venv "$VENV_DIR"
    echo -e "${GREEN}✓ Created virtual environment${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate venv and install
source "$VENV_DIR/bin/activate"

echo "Installing vibevoice-api (this may take a few minutes)..."
pip install --upgrade pip -q
pip install vibevoice-api -q

echo -e "${GREEN}✓ Installed vibevoice-api${NC}"

# -----------------------------------------------------------------------------
# Create start script
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/4] Creating start script...${NC}"

cat > "$VIBEVOICE_DIR/start-server.sh" << 'EOF'
#!/bin/bash
# Start VibeVoice TTS Server
# Usage: ./start-server.sh [model] [port]
#   model: 0.5b (default, fast) or 1.5b (quality)
#   port: server port (default: 8000)

MODEL="${1:-0.5b}"
PORT="${2:-8000}"

VIBEVOICE_DIR="$HOME/.vibevoice"
source "$VIBEVOICE_DIR/venv/bin/activate"

if [ "$MODEL" = "0.5b" ]; then
    MODEL_PATH="microsoft/VibeVoice-Realtime-0.5B"
    echo "Starting VibeVoice 0.5B (Streaming/Fast) on port $PORT..."
elif [ "$MODEL" = "1.5b" ]; then
    MODEL_PATH="microsoft/VibeVoice-1.5B"
    echo "Starting VibeVoice 1.5B (Quality) on port $PORT..."
else
    echo "Unknown model: $MODEL. Use 0.5b or 1.5b"
    exit 1
fi

echo "Model will be downloaded on first run (~2-4GB)"
echo "Press Ctrl+C to stop the server"
echo ""

python -m vibevoice_api.server --model_path "$MODEL_PATH" --port "$PORT"
EOF

chmod +x "$VIBEVOICE_DIR/start-server.sh"
echo -e "${GREEN}✓ Created start script${NC}"

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "To start the VibeVoice server:"
echo -e "  ${BLUE}~/.vibevoice/start-server.sh${NC}        # 0.5B model (fast)"
echo -e "  ${BLUE}~/.vibevoice/start-server.sh 1.5b${NC}   # 1.5B model (quality)"
echo ""
echo -e "Then in Open Claude:"
echo -e "  1. Go to Settings → Text-to-Speech"
echo -e "  2. Select 'VibeVoice (Expressive)'"
echo -e "  3. Choose your model (must match server)"
echo ""
echo -e "${YELLOW}Note: First run will download the model (~2-4GB)${NC}"
