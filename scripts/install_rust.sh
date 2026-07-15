#!/bin/bash
echo "[CloudBanana] Installing Rust..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
echo "[CloudBanana] Rust installation complete"
echo "[CloudBanana] Run 'source \$HOME/.cargo/env' to use Rust"
