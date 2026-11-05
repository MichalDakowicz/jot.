# Jot. — class notes

A React Native (Expo) build of the *Class Notes* design canvas: a notebook per
subject, markdown that sets itself as you leave a line, `@` mentions that become
two-way links, tags you can travel through, and a link map of the whole
thing. Login, notes and files all live in Supabase.

## What it does

| Screen | Route | What is there |
| --- | --- | --- |
| Onboarding | `/onboarding` | The three first-run cards, then straight to sign-in |
| Sign in / sign up | `/sign-in` | Google, or email + password |
| Today | `/today` | Greeting, today's timetable, the four notes you touched last |
| Notebooks | `/shelf` | Notebook grid, link-map and tag shortcuts, notebook creation |
| A notebook | `/notebook/[id]` | Its notes with tags, and notebook deletion |
| A note | `/note/[id]` | The note; on the web it opens straight into the editor, with tags, forward and back links |
| Public share | `/share/note/[id]` or `/share/notebook/[id]` | Read-only published content, no sign-in required |
| Editor | `/editor/[id]` | Line-by-line source editing, Enter splits, Backspace merges, `@` picker, the notebook and tag row under the title |
| Search | `/search` | Free text or `#tag` search across every note |
| Tags | `/tags` | Tag cloud sized by use, plus the notes under the selected tag |
| Link map | `/graph` | One cluster per notebook, an edge for every `@` mention |

The three-island navigation bar (action · destinations · you) sits over every
screen, and the action button morphs the way the design says: `+` on a list,
a pen on a note, a tick in the editor.

Past 900 px wide — a browser window, a tablet, a phone turned sideways — the
islands unroll into the design's desktop layout: an icon rail, a permanent
notebook column, a note list with its own search field, and the note itself in
the remaining pane. Same routes, same notes, same markdown; the note you have
open is still `/note/<id>`, so links are shareable.

The profile island opens the sheet: profile picture upload, the link map, every
tag, notebook export, sign out.

## The look

An editor for notes: slate dark or paper light (following the system), one
sage accent, lavender for links, everything set in **JetBrains Mono**, which
covers Polish. Markdown is edited as source that sets itself — a heading line
is set large and keeps its `#`, muted, in front. On the web a notebook is a
single file: each note is a `# Title` section in it, so a new note is just a
new `# ` line, and the sidebar lists notebooks as files with the open one's
notes as an outline. The bar under the top shows the note the caret is in —
its tags, its own public link, its links — and **notebook** opens the
notebook's name, course code, teacher, colour, class times and sharing. On the web the note sits in a
CodeMirror editor with line numbers, embeds under image, video and link lines,
and a minimap beside it that swells into readable text under the pointer. Right-click
opens Jot's own menu: editing and formatting in the editor, "show this note only",
and hiding or showing the map.
Share pages drop all of that and render the note for reading.

The mark is a monospace "j" with a square cursor on the slate tile, shown
without a wordmark. Its
geometry and colours are in `packages/core/src/theme/logo.json`; both apps
draw from it, and so does the icon script:

```bash
npm run icons   # store icon, Android adaptive + monochrome layers, splash, favicons
```

## Setup

### Public sharing

After applying `supabase/schema.sql`, run `supabase/public-sharing.sql` in the
Supabase SQL editor (also required for existing databases). Notes and notebooks
start private. Their detail screens have a **Public link** control to enable,
copy/share, or disable a public read-only link. Recipients need no account.

Publishing a notebook publishes all its current and future notes. A note can
also be published separately; disabling its notebook does not disable that
separate publication. Moving a note into a public notebook makes it public;
moving it out removes inherited access. Revocation takes effect on subsequent
requests; previously read or copied content cannot be recalled. Public rows
are readable through the API as well as through links. Profiles, class schedules,
and unrelated private notes stay private.

Web links use the current origin. Native links use `EXPO_PUBLIC_SITE_URL`,
defaulting to `https://jot-notebook.web.app`. Publish the web build at that URL
so recipients can open links. Public pages use anonymous access even for owners,
so a disabled link shows the same unavailable state for everyone.

Run `npm run test:sharing` to verify the sharing SQL against an isolated local
PostgreSQL engine, including anonymous access, write protection, and revocation.

1. **Environment.** Copy `.env.example` to `.env` and fill in:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```

   Only these two belong in the app. A `service_role` / `sb_secret_…` key must
   never be put in an Expo project — everything prefixed `EXPO_PUBLIC_` is
   compiled into the shipped bundle.

2. **Database.** Open Supabase Studio → SQL editor and run
   [`supabase/schema.sql`](supabase/schema.sql). It creates:

   - `profiles`, `notebooks`, `notes`, `class_sessions`
   - row-level security so every row is readable only by its owner
   - a trigger that makes a profile row on signup, and one that keeps
     `notes.updated_at` current
   - the private `avatars` and `exports` storage buckets, with per-user
     folder policies

3. **Auth.** In Authentication → Providers, keep *Email* enabled. If
   "Confirm email" is on, a new account has to click the mail link before the
   first sign-in; turn it off while developing if you would rather not.

4. **Run it.**

   ```bash
   npm install              # once, at the repo root: installs every workspace
   npm run mobile           # expo start in apps/mobile
   ```

   The phone's `.env` lives in `apps/mobile/`, the web's in `apps/web/`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). `npm run web` starts the
   web app; `npm run deploy -w @jot/web` builds it and publishes it to
   `jot-notebook.web.app`.

On the first sign-in the Today screen offers to fill five notebooks with the
sample term from the design (nine linked notes, tags, a Mon–Fri timetable), or
to start with a single empty notebook.

## How it is put together

An npm-workspaces monorepo: two apps with their own frontends over one shared core.

```
packages/core/src/       @jot/core — no React Native or DOM imports
  client.ts              the Supabase clients each app hands over at startup
  auth.tsx               session, profile, avatar signed URLs
  store.tsx              notebooks/notes/classes, debounced writes, export, seeding
  markdown.ts            the markdown dialect: blocks and inline spans
  seed.ts                first-run content from the design
  theme/ink.ts           the editor inks, dark and light
  theme/scheme.ts        maps the phone's palette roles onto the inks at launch
  theme/logo.json        the mark's geometry and colours
  embed.ts, fisheye.ts, graph.ts, publicContent.ts, oauth.ts
  __tests__/             Vitest tests for the pure helpers
apps/web/                the Vite + React web app
  src/editor/            CodeMirror: live markdown, embeds, @ and / menus, the minimap
  src/pages/             one file per route; Share.tsx renders published notes
  src/components/        the shell (explorer, top bar, status bar) and its parts
apps/mobile/             the Expo app
  app/                   expo-router routes
    _layout.tsx          fonts, providers, the auth gate
    (main)/_layout.tsx   stack + islands on a phone, rail + columns when wide
  lib/supabase.ts        AsyncStorage-backed clients, AppState as the foreground signal
  components/
    Markdown.tsx         renders parsed markdown as React Native text
    NavIslands.tsx       the three-island nav
    LinkMap.tsx          the SVG graph
    DesktopChrome.tsx    the rail, notebook column and note list past 900 px
    Logo.tsx             wordmark, app mark and lockup
supabase/schema.sql      tables, RLS, triggers, buckets
scripts/
  make-icons.mjs         every icon asset, drawn from the logo
```

`sharp` is a dev-only dependency, used by the icon script.

Notes are edited locally and pushed to Supabase on a 700 ms debounce, so typing
never waits for the network; leaving the editor flushes anything pending.

Changes made anywhere else — the website, another phone — arrive over Supabase
Realtime while the app is open, and the app reads everything again when it
comes back from the background. A note with an edit of its own still on the
way keeps that edit rather than the server's older copy.

Links are derived from the note body itself — `@Note title` — so there is no
join table to keep in sync. Tags are not: they sit in `notes.tags` and are set
in the row under a note's title, so a `#` in the text is just a character.

## Scripts

```bash
npm start          # expo start
npm run android    # expo start --android
npm run ios        # expo start --ios
npm run web        # expo start --web
npm run typecheck  # tsc --noEmit
npm run icons      # rebuild the icons
```
