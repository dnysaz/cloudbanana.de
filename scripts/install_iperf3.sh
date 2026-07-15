#!/bin/bash
echo "[CloudBanana] Installing iperf3..."
apt update -qq && apt install -y iperf3
echo "[CloudBanana] iperf3 installation complete"
