# Project maintenance skills

Before using a DSH plugin lifecycle skill, read `skills/README.md`: this repository vendors only the maintenance subset (6 skills). Other lifecycle skills are resolved live from the shared memory vault (memory-eternal); query the vault for the current skill address instead of copying them here.

Skill examples are community guidance. Historical version examples are not the current support policy; verify exact Harness tags, npm artifacts, the resolved dependency graph, and AgentTeams behavior.

User instructions and authorization take precedence over skill defaults. Do not repeat confirmation for work the user has already authorized.

# Browser automation

For interactive browser automation, use the `ego-browser` skill from Ego Lite. Do not use `agent-browser` or another browser-control skill unless the user explicitly requests it or Ego Lite is unavailable.
