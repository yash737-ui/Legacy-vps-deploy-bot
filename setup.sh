#!/bin/bash
sudo apt update -y && sudo apt install -y git curl docker.io
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
git clone https://github.com/yash737-ui/Legacy-vps-deploy-bot.git
cd Legacy-vps-deploy-bot/vps-bot
npm install
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
docker pull ubuntu:22.04
nano config.json
