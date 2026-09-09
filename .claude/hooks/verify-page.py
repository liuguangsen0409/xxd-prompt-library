#!/usr/bin/env python3
"""PostToolUse hook: smoke-check the dev server after editing code files.

Skips silently when the dev server is not running; emits additionalContext
back to the model when the server answers with a non-200 status.
"""
import json
import sys
import urllib.error
import urllib.request

DEV_SERVER_URL = 'http://localhost:3000'
CODE_EXTENSIONS = ('.vue', '.ts', '.tsx', '.js', '.mjs', '.css')


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_input = data.get('tool_input') or {}
    tool_response = data.get('tool_response') or {}
    file_path = (
        tool_input.get('file_path')
        or tool_response.get('filePath')
        or ''
    )

    if not file_path.endswith(CODE_EXTENSIONS):
        sys.exit(0)

    try:
        with urllib.request.urlopen(DEV_SERVER_URL, timeout=5) as resp:
            code = resp.status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception:
        # Dev server not running - nothing to smoke-check.
        sys.exit(0)

    if code == 200:
        sys.exit(0)

    print(json.dumps({
        'hookSpecificOutput': {
            'hookEventName': 'PostToolUse',
            'additionalContext': (
                f'Dev server at {DEV_SERVER_URL} returned HTTP {code} '
                f'after editing {file_path}. The page may be broken - '
                'verify and fix before continuing.'
            ),
        },
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
