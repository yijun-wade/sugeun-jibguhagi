#!/bin/zsh
# 발행 자동화 정지 (2026-09-09 결정: 이번 주까지만 올리고 중단).
#
# 왜: 8주간 24편을 발행했으나 suzip.kr 유입 0클릭(utm_source=naver_blog 0명,
# blog.naver.com 리퍼러 0건). 12일 중단 자연실험에서도 트래픽 변화 없음.
# 반면 유지비는 실측됨 — 한 달에 두 번 중단(DarkWake 17일, 셀렉터·세션 12일).
#
# 되돌리려면:
#   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/kr.suzip.publish.plist
set -u
LOG=/Users/jeon-yijun/Documents/develope/sugeun-jibguhagi/.publish-state/launchd.log
UID_=$(id -u)

echo "\n─────────  발행 정지 $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG"
launchctl bootout "gui/$UID_/kr.suzip.publish" 2>>"$LOG" \
  && echo "  ✅ kr.suzip.publish 정지됨" >> "$LOG" \
  || echo "  ⚠ 이미 정지 상태였거나 정지 실패" >> "$LOG"

# 자기 자신도 치운다 — 한 번 쓰고 사라지는 잡이다.
launchctl bootout "gui/$UID_/kr.suzip.publish.stop" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/kr.suzip.publish.stop.plist"
echo "  ✅ 정지 잡 자체도 제거" >> "$LOG"
