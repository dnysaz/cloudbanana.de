#!/bin/bash
echo "[CloudBanana] Installing Portainer..."
docker volume create portainer_data 2>/dev/null
docker run -d -p 9443:9443 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest
echo "[CloudBanana] Portainer installed on https://$(curl -s ifconfig.me):9443"
