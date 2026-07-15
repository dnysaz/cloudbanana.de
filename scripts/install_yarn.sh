#!/bin/bash
echo "[CloudBanana] Installing Yarn..."
npm install -g yarn 2>/dev/null || {
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --dearmor -o /usr/share/keyrings/yarn.gpg
  echo "deb [signed-by=/usr/share/keyrings/yarn.gpg] https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list
  apt update -qq && apt install -y yarn
}
echo "[CloudBanana] Yarn installation complete"
