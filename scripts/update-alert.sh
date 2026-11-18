#!/usr/bin/env bash
# Keeps one GitHub issue open while the scheduled data update is failing, so the owner hears about it by e-mail,
# and closes it once an update succeeds again.
#   update-alert.sh fail   after a failed run: open the issue (mentioning the owner) or add this failure to it
#   update-alert.sh ok     after a successful run: close the open issue, if any
# Environment: GH_TOKEN (issues: write), RUN_URL, OWNER, FAILED (download | unit | smoke | commit | setup),
# RUNNER_TEMP (where the steps tee their output as <step>.log). Never fails the job: problems are only printed.
set -u
LABEL=data-update-failure
TITLE='数据自动更新失败 / The daily data update failed'
num=$(gh issue list --label "$LABEL" --state open --json number --jq '.[0].number' 2>/dev/null || true)
now_utc=$(date -u '+%Y-%m-%d %H:%M')
when="$now_utc UTC（纽约 $(TZ=America/New_York date '+%m-%d %H:%M')，北京 $(TZ=Asia/Shanghai date '+%m-%d %H:%M')）"

if [ "${1:-}" = ok ]; then
  [ -n "$num" ] || exit 0
  gh issue close "$num" --comment "已恢复：$when 的更新成功，数据重新开始每天更新（$RUN_URL）。
Fixed: the update at $now_utc UTC succeeded and daily updates have resumed." || echo "could not close issue #$num"
  exit 0
fi

case "${FAILED:-setup}" in
  download) step='下载并校验新数据 / downloading and verifying new sessions' ;;
  unit) step='用新数据跑单元测试 / unit tests on the updated data' ;;
  smoke) step='用新数据跑浏览器冒烟测试 / browser smoke test on the updated data' ;;
  commit) step='提交并重新部署 / committing and redeploying' ;;
  *) step='准备运行环境 / setting up the run' ;;
esac
log="${RUNNER_TEMP:-/tmp}/${FAILED:-setup}.log"
excerpt=''
if [ -s "$log" ]; then
  clean=$(sed 's/\x1b\[[0-9;]*m//g' "$log")
  case "${FAILED:-}" in
    unit) excerpt=$(printf '%s\n' "$clean" | grep -A 14 '^not ok' | head -n 60) ;;
    smoke) excerpt=$(printf '%s\n' "$clean" | grep -E '^FAIL|Error' | head -n 30) ;;
  esac
  [ -n "$excerpt" ] || excerpt=$(printf '%s\n' "$clean" | grep -v '^[[:space:]]*$' | tail -n 30)
fi
asof=$(git show HEAD:data/market-data.js 2>/dev/null | grep -o '"asOf":"[0-9-]*"' | head -n 1 | cut -d'"' -f4)
body="每日数据自动更新失败，网站数据会停在 **${asof:-?}**，直到更新恢复（恢复后这个 issue 会自动关闭）。

- 运行记录：$RUN_URL
- 时间：$when
- 失败的步骤：$step

日志摘录 / Log excerpt:

\`\`\`text
${excerpt:-(没有日志 / no log)}
\`\`\`

The daily data update failed, so the site's data stay at ${asof:-?} until an update succeeds; this issue closes itself when one does."

if [ -n "$num" ]; then
  gh issue comment "$num" --body "又失败了一次 / Failed again.

$body" || echo "could not comment on issue #$num"
else
  gh label create "$LABEL" --color B60205 --description 'The scheduled data update is failing' --force >/dev/null 2>&1 || true
  gh issue create --title "$TITLE" --label "$LABEL" --body "@${OWNER:-} $body" || echo 'could not open the alert issue'
fi
exit 0
