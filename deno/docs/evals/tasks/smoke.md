---
id: smoke
fixture: smoke
docs: []
maxTurns: 10
graders:
  - kind: file-exists
    path: answer.txt
  - kind: file-contains
    path: answer.txt
    pattern: ZEPHYR-42
---
This workspace contains a few project files. One of them states a
deploy codeword. Find the codeword and write it — just the codeword,
nothing else — to a new file called answer.txt in the workspace root.
