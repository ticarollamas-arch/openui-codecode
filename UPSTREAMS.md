# Upstream projects and integration map

- OpenCode: https://github.com/anomalyco/opencode — used as the real execution engine through the official `@opencode-ai/sdk`. This web application is not a reimplementation of its agent runtime.
- Skills Main (user-owned): https://github.com/ticarollamas-arch/skills-main — bootstrap script clones it into `.agents/skills`; the OpenCode config loads `SKILL.md` instructions from that directory.
- ZipToGit (user-owned): https://github.com/ticarollamas-arch/ziptogithub — the UI provides a separate ZipToGit workspace and server-side GitHub publishing adapter. The full upstream repository source was not vendored in this build environment.
- Token economy: https://github.com/Tarquinen/opencode-dynamic-context-pruning — loaded as an OpenCode plugin dependency in `opencode.json`; AGPL-3.0 applies to the plugin.

The current build container had no outbound DNS/network access to clone GitHub. The project therefore wires the runtime interfaces and documents upstream integration points, but does not contain full source copies of the three upstream repositories.


## Model catalog and token optimization reference
- OpenCode providers: https://opencode.ai/docs/providers/
- OpenCode models: https://opencode.ai/docs/models/
- OpenCode server API (provider catalog and auth endpoints): https://docs.opencode.ai/docs/server/
- Headroom token/context compression: https://github.com/rtk-ai/rtk
