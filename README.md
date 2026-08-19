# Stego

A stegosaurus-themed flashcard app. Build decks, study them, and generate tests
that mix write-in, true/false, and matching questions in whatever proportions you
want, over as much of the deck as you want.

Runs as a native app on **macOS** (Electron) and **iOS** (Capacitor) from one
codebase, and in any browser during development.

## What it does

**Create** — decks with a title, description, and any number of front/back cards.
Cards can be reordered by editing, sides swapped in place, and a card back may
list interchangeable answers separated by `;` (e.g. `T. rex; Tyrannosaurus`).

**Study** — a flip-card view with keyboard shortcuts (space to flip, arrows to
move, `1`/`2` to mark), swipe support on touch, shuffle, per-card known/review
tracking, and a "review the ones you missed" round at the end.

**Test** — pick how much of the deck to draw from and how many of each question
type:

| Type | Prompt | Scoring |
| --- | --- | --- |
| Write-in | Card front, you type the back | 1 point; case, punctuation, accents and small typos forgiven |
| True/False | A card paired with an answer that may belong to another card | 1 point |
| Matching | A block of *n* cards against a scrambled answer bank | 1 point per pair, partial credit |

Direction can be front→back, back→front, or mixed. Every card is used at most
once per test, and the setup screen tracks the remaining card budget so the mix
always fits. Results show a per-type breakdown and a full review of every
question with the correct answer.

## Data

Decks live in a single `decks.json` file, the same shape the original build used.

| Platform | Location |
| --- | --- |
| macOS | iCloud container, else `~/Library/Application Support/Stego/decks.json` |
| iOS | iCloud container, else the app's Documents directory |
| Browser | `localStorage` under `stego.decks.json` |

### Syncing Mac and iPhone

Both apps read and write one file in the iCloud container
`iCloud.com.jonlee.stego`, so decks follow you between devices with no accounts
and no server. The desktop app polls the file and picks up changes live; iOS
re-reads whenever the app comes back to the foreground.

Sync is **off until the capability is enabled** and it fails soft: with no
entitlement, no paid account, or no iCloud login, both platforms fall back to
local storage and the app behaves exactly as before. The home screen says which
one is in use.

To turn it on (needs a paid Apple Developer account, see below):

1. `npm run ios:open`, then **App** target ▸ **Signing & Capabilities** ▸
   **+ Capability** ▸ **iCloud**.
2. Tick **iCloud Documents** and add the container `iCloud.com.jonlee.stego`.
   Xcode writes the entitlements file and registers the container for you.
3. Run the iOS app once. That provisions the container, after which the folder
   `~/Library/Mobile Documents/iCloud~com~jonlee~stego/` appears on the Mac and
   the desktop app switches over on its next launch.

The first device to write wins if you edit the same deck on both while offline —
fine for one person on two devices, but worth knowing.

The container id is in three places and they must agree:
[`capacitor.config.ts`](capacitor.config.ts) (app id),
[`electron/main.cjs`](electron/main.cjs) (`ICLOUD_CONTAINER`), and
[`ios/App/App/StegoCloud.swift`](ios/App/App/StegoCloud.swift) (`containerID`).

Import and export are on the deck list screen. The reader also accepts the
2021 Kivy format (`{"decks": [{"name", "description", "deck": [{"info_front",
"info_back"}]}]}`), so an old `decks.json` can be imported as-is.

## Development

```bash
npm install
npm run dev        # browser at http://localhost:5173
npm test           # generation, grading, and storage tests
```

## macOS

```bash
npm run mac        # build and launch the desktop app
npm run mac:dev    # vite dev server + Electron, with hot reload
npm run mac:dist   # signed-less .dmg in release/
```

## iOS

The Xcode project lives in `ios/` and is already set up: themed app icon, light
and dark launch screens, edge-to-edge web view, and `UIFileSharingEnabled` so
exported decks show up in the Files app. Requires **Xcode** and **CocoaPods**
(`brew install cocoapods`).

```bash
npm run ios:sync     # rebuild the web bundle into the native project
npm run ios:open     # ...and open it in Xcode
npm run ios:device   # ...and pick a simulator or connected device to run on
```

### Running on your own iPhone

Signing is set to Automatic with no team, so this is a one-time setup:

1. `npm run ios:open`, then in Xcode select the **App** target ▸ **Signing &
   Capabilities** and pick your Apple ID under **Team**. A free Apple ID works;
   if the bundle id `com.jonlee.stego` is rejected as taken, change it to
   something unique and mirror it in `capacitor.config.ts`.
2. On the iPhone: **Settings ▸ Privacy & Security ▸ Developer Mode**, on. The
   phone restarts.
3. Plug the phone in, trust the Mac, pick it in Xcode's device menu, and Run.
4. First launch only: **Settings ▸ General ▸ VPN & Device Management** and
   trust your developer certificate.

With a free Apple ID the build stops working after 7 days — re-run from Xcode to
refresh it. A paid Apple Developer account extends that to a year and is what
you'd need for TestFlight or the App Store.

## Sharing a build

**macOS.** `npm run mac:dist` writes `release/Stego-1.0.0-arm64.dmg` (Apple
Silicon) and `release/Stego-1.0.0.dmg` (Intel). Drag `Stego.app` into
Applications and it is yours to keep.

The build is signed with an *Apple Development* certificate, which Gatekeeper
does not accept from a stranger's Mac. A friend can still install it: right-click
the app ▸ **Open**, then **System Settings ▸ Privacy & Security ▸ Open Anyway**.
To skip that entirely you need an Apple Developer Program membership, a
*Developer ID Application* certificate, and notarization — set `notarize` in the
`build.mac` block of `package.json` and electron-builder does the rest.

**iOS.** A free Apple ID only signs builds for your own device, for 7 days, and
cannot share them. Real distribution needs the Apple Developer Program
($99/year):

- **TestFlight** — the normal way to hand a build to a friend. Archive in Xcode,
  upload, invite them by email, they install Apple's TestFlight app. Builds last
  90 days and up to 10,000 external testers are allowed.
- **Ad Hoc** — register your friend's device UDID (100 per year) and send them
  an `.ipa`. Fiddlier, but no review step.
- **App Store** — full review, public listing.

### Enrolling, and what changes afterwards

Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/).
An Individual membership is $99/year and needs an Apple ID with two-factor auth;
approval usually lands within a day or two, and doing it through the Apple
Developer app on the iPhone is the quickest route for the identity check.

Once you are in:

1. **Xcode ▸ Settings ▸ Accounts** — your real team appears next to *Personal
   Team*. Switch the App target to it under **Signing & Capabilities**.
2. **iCloud** — add the capability as described under *Syncing Mac and iPhone*.
   This is the step that turns sync on.
3. **macOS signing** — create a *Developer ID Application* certificate, then add
   a `notarize` entry to the `build.mac` block in `package.json` along with an
   App Store Connect API key. After that `npm run mac:dist` produces a `.dmg`
   anyone can open without Gatekeeper warnings.
4. **TestFlight** — in Xcode, **Product ▸ Archive**, then **Distribute App ▸
   TestFlight**. Add your friend as an external tester by email.

**No developer account at all.** Because the app is entirely client-side, the
contents of `dist/` can be hosted on any static host, opened in Safari, and
added to the home screen. Deck data then lives in browser storage instead of a
JSON file, and import/export still work.

## Releasing

Two separate pipelines. iOS and iPadOS are one universal binary going to the App
Store; macOS is a Developer ID build you host yourself. Nothing about the Mac
app goes through App Store Connect.

### Preflight (both)

```bash
npm test          # 32 tests
npm run build     # type-check + bundle
```

Bump versions before every upload. App Store Connect **rejects a build number it
has already seen**, and this is the single most common way a release stalls.

- `MARKETING_VERSION` in Xcode = user-facing version (1.1). Bump for a release.
- `CURRENT_PROJECT_VERSION` = build number. Bump for *every* upload, even a
  re-upload of the same version.
- `version` in `package.json` drives the macOS app and DMG filename. Keep it in
  step with `MARKETING_VERSION`.

### iOS + iPadOS

```bash
npm run ios:sync   # rebuild the web bundle into the native project
npm run ios:open
```

1. Destination → **Any iOS Device (arm64)**. Archive is disabled while a
   simulator is selected.
2. **Product → Archive**. Automatic signing issues the Apple Distribution
   certificate and provisioning profile the first time.
3. Organizer → **Distribute App → App Store Connect → Upload**.
4. Processing takes 5–30 minutes; App Store Connect emails you when the build
   is ready to select.
5. App Store Connect → the app → the version → **Build** → pick the new build.
   Uploading does not attach a build on its own; if an older one is attached you
   have to swap it.
6. First submission only, fill in: screenshots (**6.9" iPhone and 13" iPad are
   both required**), description, keywords, support URL, privacy policy URL,
   category Education, price, and age rating.
7. **App Privacy** → *Data Not Collected*. Matches `PrivacyInfo.xcprivacy`.
8. **Submit for Review.** Typically 24–48 hours.

Export compliance is already answered by `ITSAppUsesNonExemptEncryption` in
`Info.plist`, so the upload will not stop to ask.

### macOS

The signing certificate is different from the one used for day-to-day builds,
and it does not exist until you create it:

1. **Xcode → Settings → Accounts → Manage Certificates → + → Developer ID
   Application.** Requires the Account Holder role. Without this, builds are
   signed "Apple Development" and Gatekeeper rejects them on other Macs.
2. Create an app-specific password at appleid.apple.com.
3. Build, sign, notarize, and staple in one step:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run mac:release
```

4. Verify before publishing anything:

```bash
spctl -a -t exec -vv release/mac-arm64/Stego.app   # must say: accepted
xcrun stapler validate release/Stego-*.dmg          # must say: worked
```

5. Publish both DMGs (arm64 and x64) on GitHub Releases.

`npm run mac:dist` stays un-notarized and is the fast path for local testing.

### iCloud sync caveat

Development and production use **separate iCloud containers**. Decks synced
while testing will not appear in the released app, and the first launch after
release starts empty. That is expected, not a bug. Verify sync on a real device
before submitting, because the entitlement failing silently falls back to
local-only storage.

## Theme

The palette is sampled straight out of the original assets and is documented at
the top of [src/styles/theme.css](src/styles/theme.css): `#0A4E1D` from the
`title.png` lettering, `#5EA131`/`#535C20`/`#C7D42C` from the stegosaurus,
`#118844` from the t-rex, and the `#DCDCC8` moon-mist background from the
pygame prototype. `title.png` is still the
wordmark, and the original `future` and `rockwell` fonts carry the headings and
body text. A dark variant of the same
palette is available from the toggle on the home screen; it follows the system
setting by default.

## Layout

```
src/
  lib/        testgen, grading, storage, cloud, transfer, random
  screens/    Home, DeckList, DeckEditor, Study, TestSetup, TestRun, TestResults
  components/ Icons, shared UI, toasts
  state/      deck store, theme preference, starter deck
electron/     macOS main process and preload bridge
tests/        vitest suites for generation, grading, and file parsing
legacy/       the original 2021 Kivy and pygame sources, kept for reference
assets/       unchanged original images and fonts
```
