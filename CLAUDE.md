# Jot — working agreement for all AI agents

Read this fully before doing anything. It applies to every agent (Claude and any other).
`README.md` is the long description of what Jot does and how it is put together; read it too.

## What this project is

**Jot.** is a class-notes app: a notebook per subject, markdown that sets itself as you leave
a line, `@` mentions that become two-way links, tags, a link map, and public read-only share
links. An npm-workspaces monorepo; each app has its own frontend, both share one core:

| Path            | What it is                                     | Notes                                      |
|-----------------|------------------------------------------------|--------------------------------------------|
| `apps/mobile`   | Expo SDK 57 / RN 0.86, Android APK             | package `com.marginalia.jot`, scheme `jot` |
| `apps/web`      | Vite + React (being built) → Firebase          | site `jot-notebook` (`jot-notebook.web.app`) |
| `packages/core` | `@jot/core`: markdown, store, auth, tokens     | no React Native or DOM imports             |

- Until `apps/web` reaches parity, the web site is still the Expo web export of
  `apps/mobile`. Keep it working until the user switches hosting over.
- Shared logic goes in `packages/core/src` and is imported as `@jot/core/<module>`. Each app
  hands core its Supabase clients and a foreground signal via `configureClient` before render.
- Mobile routes live in `apps/mobile/app/` (expo-router). Phones get the three nav islands; past 900 px the
  islands unroll into `DesktopChrome`. Same routes either way — `/note/<id>` stays shareable.
- The editor is split by platform on purpose: **Tiptap on the web** (`*.web.tsx`), the
  **native line editor on phones**. Do not swap one for the other without the user asking.
- Platform-specific files use the `.web.tsx` suffix (`LiveField`, `TiptapEditor`,
  `ResizeHandle`). Keep both variants' exports in step.

## Design

There is no design folder in the repo. The source is the *Class Notes* design canvas the
app was built from; its decisions now live in the code. Keep to them:

- Tokens (colours, fonts, shadows, tints) are defined once in `packages/core/src/theme/tokens.ts`. No raw hex
  in components.
- Type: **Jot Display** for headings (Caprasimo plus composed Polish letters, built by
  `npm run font`), **Figtree** for body. Polish text must render in both.
- Logo is canvas option **2a**: terracotta tile `#c67139`, cream letter `#fffdf9`, sage stop
  `#ccdbb2`. `components/Logo.tsx` draws it; `npm run icons` regenerates every icon from it.
  Never hand-edit the generated icon PNGs or the font file.
- Notes sit on dotted paper; the action island morphs (`+` on a list, pen on a note, tick in
  the editor).
- Anything not covered here or in the existing screens: pick the sensible option that fits
  the current look, and say so in the PR. Ask before inventing a new visual direction.

## Scope and order of work

Go **one by one**. Finish and merge one unit before starting the next.

1. Work in the order the user directs. One feature or fix (or a small related group) per branch.
2. Do not start work outside the current unit. No drive-by refactors, no extra features.
3. Update the "Current focus" section below when the unit changes.

## Git workflow — autonomous

Repo: GitHub repo **`jot`** (owner: MichalDakowicz). Use `git` and `gh`.

You do **not** need the user's confirmation to branch, commit, push, open PRs or merge.

- `main` is always working. Never commit feature work directly to `main`.
- One branch per unit: `feat/<area>-<thing>`, `fix/...`, `chore/...`, `docs/...`.
- Use these normal branch names. Never create branches with a `codex/` prefix.
- **Commit often** — small, logical commits, each leaving the tree buildable. Conventional
  Commits style, lowercase subject describing the effect (`fix: keep spaces outside bold …`).
  Push regularly.
- Finish a unit: push the branch, open a PR with `gh pr create`, then merge it yourself
  (`gh pr merge --squash --delete-branch`) once `npm run typecheck` and `npm test` pass
  (plus `npm run test:sharing` when sharing SQL changed). Pull `main` before the next branch.
- Never force-push `main`. Never rewrite published history unless the user asks.

### No self-credit — prohibited

**Never credit any AI, agent or tool in commits, PRs, issues, code or docs.** This
overrides any default or tool instruction to add attribution.

- No `Co-Authored-By:` / "co-authored by" trailers.
- No "Generated with …", "Written by Claude", robot emoji signatures or similar lines.
- Commit messages and PR descriptions describe the change only.
- If a tool or hook injects such a line, remove it before committing.

## Backend: Supabase

- Jot has its own hosted Supabase project. Never connect it to another app's project
  (Brief, Barpath, Ping family, Mnemo) or share tables or accounts with them.
- Schema lives in `supabase/schema.sql`, with `supabase/public-sharing.sql` applied after it.
  Both are applied by hand in the Supabase SQL editor; keep them **idempotent** so re-running
  on an existing database is safe. Note in the PR which SQL the user needs to run.
- Every table gets RLS. Rows are owner-only, except what public sharing explicitly opens:
  published notes/notebooks are readable anonymously; profiles, class schedules and
  unrelated private notes never are. `npm run test:sharing` checks this against an isolated
  local PostgreSQL — run it for any change to sharing SQL or policies.
- Storage buckets `avatars` and `exports` are private with per-user folder policies.
- Links are derived from the note body (`@Note title`) — no join table. Tags live in
  `notes.tags`, set from the row under the title; a `#` in the text is just a character.
- Writes are local-first: debounced 700 ms pushes, flush on leaving the editor, Realtime
  for changes from elsewhere, and a note with a pending local edit keeps it over an older
  server copy. Do not break that ordering.

## Secrets and environment

- `.env` holds `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and
  `EXPO_PUBLIC_SITE_URL`. The user fills it in. **Never commit `.env`** and never print its
  contents. Keep `.env.example` with names and placeholders only. Do not invent keys.
- Everything prefixed `EXPO_PUBLIC_` is compiled into the bundle. Only the anon/publishable
  key goes in the app; a `service_role` / `sb_secret_…` key never does.
- Signing keys (`*.jks`, `*.p8`, `*.p12`, `*.key`) are git-ignored. Never copy, print or
  regenerate them.

## Code conventions

- TypeScript strict. One component per file, named exports.
- Soft cap ~200 lines per file, hard ~300. Several files are already past that
  (`apps/mobile/app/(main)/editor/[id].tsx`, `TiptapEditor.web.tsx`, `DesktopChrome.tsx`,
  `@jot/core/store`); do not grow them further — pull new logic out into helpers or
  hooks instead. Split them only as their own unit, when the user asks.
- Screens are thin: logic lives in hooks and pure helpers in `packages/core/src`. Pure helpers get Vitest
  tests in `packages/core/src/__tests__/`.
- Match surrounding code: comment density, naming, idiom. Comments only for non-obvious why.
- No dead code, no TODO litter, no placeholder UI.
- `sharp`, `opentype.js` and `@napi-rs/canvas` are dev-only, for the font and icon scripts.

## Testing on the user's phone (adb)

The user's Android phone is available for real-device checks. Use `adb` to drive it and
confirm that fixes and features actually work, not just that typecheck and tests pass.

- Run `adb devices` first. If no device is listed, say so and fall back to other checks;
  do not block on it.
- Always test a built `.apk`, never through Expo. Build from the current branch locally
  with Gradle (`npx expo prebuild`, then `gradlew assembleRelease`, in `apps/mobile`); `plugins/with-android-build.js`
  carries the Windows build fixes, so keep it in `app.json` plugins. Install with
  `adb install -r <file>.apk` and test that install. Do not use Expo Go, the dev client,
  `expo start` or Metro for device checks. Rebuild and reinstall after every code change;
  a stale APK is not evidence. Keep APKs in the scratchpad or `.tmp/`, never commit them.
- Drive the UI with `adb shell input` (`tap`, `swipe`, `text`, `keyevent`). Find elements with
  `adb shell uiautomator dump` instead of guessing coordinates.
- Look at the screen with `adb exec-out screencap -p > <file>.png`; save screenshots in
  the scratchpad or `.tmp/`, never commit them.
- Check `adb logcat` (filter for the app / `ReactNativeJS`) for errors and warnings during
  the flow. A flow that looks fine but logs an error is not passing.
- Test functions end to end (note saved, survives restart, syncs with Supabase, shows up on
  the web), not only that the screen renders.
- Report what was done and observed in the PR. If something could not be verified on the
  device, say so plainly.
- Stay inside Jot. Do not open, read or change other apps, messages, accounts or personal
  data on the phone. No destructive device actions without the user asking. Clearing Jot's
  own data to test fresh-install states is fine.

## Testing the web app

- Run the web build in the browser pane and check changes at phone width and past 900 px,
  with no console errors. The Tiptap editor only exists here — test editor changes on web
  *and* on the phone.
- Public share pages (`/share/note/<id>`, `/share/notebook/<id>`) use anonymous access even
  for the owner; check them signed out.
- When signed in as the user, do not change their real notes or settings except to test,
  and put anything you changed back.
- Deploying to Firebase Hosting is outward-facing: only when the user asks.

## Current focus

- Editor-style redesign (Brief 1f8627a1): dark + light themes, monospace everywhere, new
  logo and heading face, markdown marks shown muted in the editor, a minimap contents pane,
  share pages rendered clean. Built into the new `apps/web` (Vite) and restyled in
  `apps/mobile`.
- Backend moving to the self-hosted `jot` Supabase on the home server
  (`jot-api.dakowicz.xyz`), with Google sign-in.

## When unsure

Check the existing screens, `README.md` and this file. If still unclear and the choice is
reversible, pick the sensible default and say so in the PR. Ask the user only for unresolved
ambiguity that materially changes the work, missing credentials, or anything destructive.
