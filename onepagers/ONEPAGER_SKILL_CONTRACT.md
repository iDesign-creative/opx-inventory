# One-Pager Skill → OPX Inventory contract

How the partner one-pager skill should output so files drop straight into the OPX
Inventory and feed the print-sync auto-compare. (Replaces Adobe Express.)

## 1. Where files go
Each partner-program one-pager is written into this repo:

```
onepagers/
  <partner-slug>-<program-slug>.html   # the source one-pager (self-contained)
  <partner-slug>-<program-slug>.pdf     # print export of that HTML
  assets/                               # shared fonts + per-partner images
    fonts/…                             # local .ttf (no CDN dependency)
    <partner-slug>-<program>/…          # crest, photos, icons for that piece
```

Slugs: lowercase, hyphenated. Examples: `salve-msnfnp`, `uttyler-msnfnp`.

**Self-contained rule:** all asset URLs in the HTML are **relative** (`assets/…`) so
the file renders identically opened directly, served on GitHub Pages, or exported to
PDF headlessly. Bundle fonts locally in `assets/fonts/` — never rely on Google Fonts.

## 2. Register it in the inventory
In `index.html`, the partner's `files:[…]` array gets one entry per one-pager:

```js
{ prog:'MSN-FNP',                         // short label shown on the thumbnail
  img:'thumbs/salve-msnfnp.jpg',          // optional preview image (thumbs/)
  html:'onepagers/salve-msnfnp.html',     // View link
  pdf:'onepagers/salve-msnfnp.pdf',       // PDF link
  check:{                                 // print fields the auto-compare verifies (see §3)
    'Program name':'Family Nurse Practitioner',
    'Tuition':['$39,408','$41,712'],
    'Credit hours':'42 credits'
  }
}
```

A file WITH `html` shows View + PDF and is print-sync-checked. A file WITHOUT `html`
shows a legacy preview + "PDF pending" (no Adobe Express anywhere).

## 3. The `check` object (drives the auto-compare)
These are the print-relevant facts that must stay in sync with the live microsite:
**program/course name, tuition/cost, credit hours** (add more as needed).

- Key = human label shown in the flag ("Tuition").
- Value = the exact string as it appears on the live site when CORRECT, OR an array
  of acceptable variants (e.g. per-credit and total tuition).
- After a website review is **archived**, the inventory fetches the live microsite and
  checks each value is still present. Any value it can't find → the one-pager is
  badged **"Needs revision: <field>"** so print never silently drifts from the web.

Keep `check` values verbatim from the one-pager so the comparison is meaningful.
Regenerating the one-pager (skill re-run) should refresh both the files and `check`,
which clears the flag on the next check.
