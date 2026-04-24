#!/bin/bash
# Claude Code SessionStart hook: TheSevenSimulation 세션 시작 시 컨텍스트 로드
# 출력 내용이 Claude의 세션 시작 컨텍스트에 포함됩니다.

echo "=== TheSevenSimulation — 세션 컨텍스트 ==="

# 브랜치 + 최근 커밋
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$BRANCH" ]; then
    echo "브랜치: $BRANCH"
    echo ""
    echo "최근 커밋:"
    git log --oneline -5 2>/dev/null | while read -r line; do
        echo "  $line"
    done
fi

# src/ 코드 건강도
if [ -d "src" ]; then
    TODO_COUNT=$(grep -r "TODO" src/ 2>/dev/null | wc -l | tr -d ' ')
    FIXME_COUNT=$(grep -r "FIXME" src/ 2>/dev/null | wc -l | tr -d ' ')
    if [ "$TODO_COUNT" -gt 0 ] || [ "$FIXME_COUNT" -gt 0 ]; then
        echo ""
        echo "코드 상태: TODO ${TODO_COUNT}개, FIXME ${FIXME_COUNT}개 in src/"
    fi
fi

# 이전 세션 상태 감지
STATE_FILE="docs/session-state.md"
if [ -f "$STATE_FILE" ]; then
    echo ""
    echo "=== 이전 세션 상태 ==="
    head -40 "$STATE_FILE" 2>/dev/null
    TOTAL_LINES=$(wc -l < "$STATE_FILE" 2>/dev/null | tr -d ' ')
    if [ "$TOTAL_LINES" -gt 40 ]; then
        echo "  ... (총 ${TOTAL_LINES}줄 — 전체 파일을 읽어 컨텍스트 복구)"
    fi
    echo "=== 세션 상태 끝 ==="
fi

echo "==========================================="
exit 0