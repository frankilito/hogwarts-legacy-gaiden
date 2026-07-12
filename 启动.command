#!/bin/bash
# 《霍格沃茨之遗·番外篇》启动器
cd "$(dirname "$0")"
PORT=8996

# 已在运行 → 直接打开
if lsof -i :$PORT >/dev/null 2>&1; then
  open "http://localhost:$PORT"
  echo "🏰 服务器已在运行 → http://localhost:$PORT"
  exit 0
fi

# 寻找 node(Finder 启动的 shell 没有 nvm/homebrew 的 PATH)
NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  for c in "$HOME"/.nvm/versions/node/*/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
    [ -x "$c" ] && NODE_BIN="$c"
  done
fi

if [ -n "$NODE_BIN" ]; then
  nohup "$NODE_BIN" server.mjs > /tmp/hogwarts_gaiden_server.log 2>&1 &
  echo "🏰 已用 node 启动(含联机服务器): $NODE_BIN"
else
  # 降级:python3 静态服务(游戏完整可玩;联机走"同设备多标签"通道)
  /usr/bin/python3 -m http.server $PORT >/dev/null 2>&1 &
  echo "⚠️ 未找到 node,已用 python3 启动纯静态服务(单机+同设备联机可用)"
fi

# 等服务器就绪再开浏览器
for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://localhost:$PORT"; then break; fi
  sleep 0.3
done
open "http://localhost:$PORT"
echo "🎮 霍格沃茨之遗·番外篇 → http://localhost:$PORT"
echo "如需停止:lsof -ti :$PORT | xargs kill"
