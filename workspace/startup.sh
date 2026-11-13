#!/usr/bin/env bash
cd /app/applet
if ! curl -s http://127.0.0.1:3000/ > /dev/null; then
  npm run dev &
fi
