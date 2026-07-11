#!/bin/bash
cd "$(dirname "$0")"
PORT=8996
# 若已在运行则直接打开浏览器
if ! lsof -i :$PORT >/dev/null 2>&1; then
  nohup node server.mjs > /tmp/hogwarts_gaiden_server.log 2>&1 &
  sleep 1
fi
open "http://localhost:$PORT"
