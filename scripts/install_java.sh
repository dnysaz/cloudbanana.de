#!/bin/bash
echo "[CloudBanana] Installing OpenJDK 17..."
apt update -qq && apt install -y openjdk-17-jdk
echo "[CloudBanana] OpenJDK 17 installation complete"
