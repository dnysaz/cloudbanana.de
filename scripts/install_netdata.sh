#!/bin/bash
echo "[CloudBanana] Installing Netdata..."
wget -q -O /tmp/netdata-kickstart.sh https://my-netdata.io/kickstart.sh
bash /tmp/netdata-kickstart.sh --stable-channel --disable-telemetry
rm /tmp/netdata-kickstart.sh
echo "[CloudBanana] Netdata installation complete"
