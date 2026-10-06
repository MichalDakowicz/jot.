# Jot. — class notes

A React Native (Expo) build of the *Class Notes* design canvas: a notebook per
subject, markdown that sets itself as you leave a line, `@` mentions that become
two-way links, tags you can travel through, and a link map of the whole
thing. Login, notes and files all live in Supabase.

## What it does

| Screen | Route | What is there |
| --- | --- | --- |
| Onboarding | `/onboarding` | The three first-run cards, then straight to sign-in |
| Sign in / sign up | `/sign-in` | Supabase email + password auth |
| Today | `/today` | Greeting, today's timetable, the four notes you touched last |
| Notebooks | `/shelf` | Notebook grid, link-map and tag shortcuts, notebook creation |
| A notebook | `/notebook/[id]` | Its notes with tags, and notebook deletion |
| A note | `/note/[id]` | Rendered markdown on dotted paper, tags, forward and back links |
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

## Type and logo

Headings are set in **Jot Display**: Caprasimo, the display face the design
canvas uses, with the sixteen Polish letters it lacks composed in — the acute
from its own á/Á, the tittle from i, an ogonek mirrored out of the cedilla, a
drawn bar for Ł/ł, plus the middle dot. Caprasimo is OFL with no Reserved Font
Name, so the derivative is allowed; `assets/fonts/OFL.txt` ships with it.
Body text is Figtree, which covers Polish as published.

```bash
npm run font    # rebuild assets/fonts/JotDisplay-Regular.ttf from Caprasimo
npm run icons   # redraw every app icon from the logo
```

The logo is **2a** from the canvas — wordmark with a blob full stop, app mark
as an "n" in the corner of a tile — recoloured: terracotta tile `#c67139`,
cream letter `#fffdf9`, sage stop `#ccdbb2`. `components/Logo.tsx` draws it in
the app; `scripts/make-icons.mjs` renders the store icon, both Android adaptive
layers, the monochrome layer, the splash mark and the favicon, taking the "n"
as an outline straight from the font so nothing depends on a font being
installed.

## Setup

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
   npm install
   npx expo start -c        # -c clears the cache so new env vars are read
   ```

   Then press `a` for Android, `i` for iOS, `w` for the browser, or scan the QR
   code with Expo Go. `npx expo export --platform web` builds a static site.

On the first sign-in the Today screen offers to fill five notebooks with the
sample term from the design (nine linked notes, tags, a Mon–Fri timetable), or
to start with a single empty notebook.

## How it is put together

```
app/                     expo-router routes
  _layout.tsx            fonts, providers, the auth gate
  (main)/_layout.tsx     stack + islands on a phone, rail + columns when wide
lib/
  supabase.ts            client, AsyncStorage session persistence
  auth.tsx              session, profile, avatar signed URLs
  store.tsx              notebooks/notes/classes, debounced writes, export, seeding
  markdown.ts            the markdown dialect: blocks and inline spans
  seed.ts                first-run content from the design
components/
  Markdown.tsx           renders parsed markdown as React Native text
  NavIslands.tsx         the three-island nav
  LinkMap.tsx            the SVG graph
  DesktopChrome.tsx      the rail, notebook column and note list past 900 px
  Blob.tsx, PaperDots.tsx, MentionPicker.tsx, ProfileSheet.tsx, ui.tsx
  Logo.tsx               wordmark, app mark and lockup
theme/tokens.ts          the design system's colours, fonts, shadows, tints
supabase/schema.sql      tables, RLS, triggers, buckets
scripts/
  build-display-font.mjs Caprasimo + composed Polish letters
  make-icons.mjs         every icon asset, drawn from the logo
```

`sharp` and `opentype.js` are dev-only dependencies, used by those two scripts.

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
npm run font       # rebuild the display font
npm run icons      # rebuild the icons
```
