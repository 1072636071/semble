#!/bin/bash

# 读取标准输入
INPUT=$(cat)
# 从 JSON 中提取命令
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# 危险命令模式列表
DANGEROUS_PATTERNS=(
  "git push"
  "git reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
  "push --force"
  "reset --hard"
)

# 检查命令是否匹配危险模式
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. The user has prevented you from doing this." >&2
    exit 2
  fi
done

exit 0
