#!/usr/bin/env bash
cd /app/applet
if ! curl -s http://127.0.0.1:3000/ > /dev/null 2>&1 && ! curl -s http://127.0.0.1:8080/ > /dev/null 2>&1; then
  npm run dev &
fi
