#!/bin/sh
set -eu

if [ -f "./package.json" ]; then
  ROOT_DIR="."
elif [ -f "/package.json" ]; then
  ROOT_DIR="/"
elif [ -d "/workspace" ] && [ -f "/workspace/package.json" ]; then
  ROOT_DIR="/workspace"
elif [ -d "/app/applet" ] && [ -f "/app/applet/package.json" ]; then
  ROOT_DIR="/app/applet"
else
  ROOT_DIR="."
fi

cd "$ROOT_DIR"

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:3000/; then
  exit 0
fi

npm run dev >>/tmp/app-startup.log 2>&1 &
