# 冰箱里面有什么 (What's in the Fridge)
A mobile-first, single-file web prototype for tracking the food in your fridge and planning tonight's dinner.

## Features
- **Home**: food summary grouped by zone (cold store / freezer / outside fridge) and a dinner preview.
- **Photo intake**: take or upload a photo on the Scan page (`scan/`); a vision model on OpenRouter lists the food items, you pick a zone for each and add them to the fridge.
- **My fridge**: drag items between zones, edit name/quantity, or mark as used up.
- **Dinner**: add a dish with ingredients; unknown ingredients are auto-added to the fridge zone.

## Run
Open `index.html` in a browser. No build or dependencies required.

## Tests
Automated browser tests (pytest + Playwright) live in `test/`. They cover the sample data and expiry alert, add/edit/delete surviving a refresh, the scan hand-off, and the existing `scan/tests.html` unit tests. The pages are served from a temporary local server and the date is fixed to 2026-11-22.

```
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r test/requirements.txt
playwright install chromium       # or skip this and pass --browser-channel msedge
pytest
```

The Tailwind and Lucide scripts are loaded from their CDNs, so the tests need internet access. CI runs `pytest` on every push and pull request (`.github/workflows/tests.yml`); screenshots and traces of failed tests are uploaded as an artifact.

## Status
Prototype. Data is saved in the browser (`localStorage`) and survives refresh. Photo recognition uses OpenRouter (receipts not supported yet).

## Scan (photo recognition)
All scan code lives in `scan/`. `index.html` only links to it and imports the result.

- `scan/scan.html`: settings, photo, recognition, review. `scan-core.js`: pure helpers (parsing, validation, image compression). `scan-api.js`: the only file that calls the recognition provider.
- **Run with a local server** (e.g. VS Code Live Server), not `file://`, so `index.html` and `scan/scan.html` share `localStorage`.
- **Providers**: OpenRouter or Google Gemini (AI Studio), chosen in Scan → Settings.
- **API key**: paste your key (openrouter.ai/keys or aistudio.google.com/apikey) in Settings and click Use. The key and model are kept in memory only while the Scan page is open; nothing is saved, so you enter them again each time. Never put the key in the code. A public deployment needs a backend proxy.
- **Model**: must accept image input. On OpenRouter use a `:free` model with image input (openrouter.ai/models); for Gemini use a model name from AI Studio. Free models change often.
- **Privacy**: photos are sent to the selected provider. Google may use data sent on the Gemini free tier to improve its products.
- **Flow**: the model returns English item names only (brand included when readable). You set zone, quantity and category, then "Add to Fridge" stores the items under `whatsinthefridge.scan.pending.v1`, and `index.html` imports them on load and removes that key.
- **Tests**: open `scan/tests.html` in a browser; all checks should be green (no network or API key needed).

## Data storage
Items are persisted in the browser's `localStorage` under the key `whatsinthefridge.items.v1`.

- **Data layer**: `shared/storage.js` (`window.ItemStore`) is the only code that reads or writes items. Its functions are all async (`getAll`, `add`, `addMany`, `update`, `remove`), so a backend (e.g. Supabase) can replace the `localStorage` inside it without changing callers.
- **Item rules**: `shared/items.js` (`window.Items`) holds the zones, item defaults and expiry helpers. Expiry is stored as `'YYYY-MM-DD'`, `'YYYY-MM'` or `null`; anything else is turned into `null` when an item is saved or loaded.
- **Seed data**: `SEED_ITEMS` in `shared/storage.js` holds the sample items and is only used until the first change is saved.
- **Errors**: `ItemStore` throws when a write fails (e.g. storage full); `index.html` catches this and shows an alert.
- **Storage limit**: uploaded photos are stored as base64, so large or many photos can exceed the ~5MB browser quota. An alert is shown when saving fails.
- **Scope**: data is per browser and per origin. `file://` and `http://127.0.0.1:5500` keep separate data, and nothing is synced between devices or people.

### Reset data
Run this in the browser console, then refresh the page (do not add/edit anything before refreshing, or the in-memory data is written back):

```js
localStorage.removeItem('whatsinthefridge.items.v1')
```

## Problems
- Add new ingredient not working.

## Limitations
- The date is hard-coded and does not update dynamically.
- Multi-user sharing does not work yet.
- The animations need a better design.
- Navigation: menu pages open as overlays on top of the main page. To switch to another fridge zone, users must close the overlay with the X button (top right) and pick again from the main page. Planned: give each fridge zone its own page with a URL, so users can move between zones with the browser's Back button.

## Next Steps
- Add a database for storing and sharing data.
- Test and verify object detection for photo intake.
- Scan: let the model also suggest each item's category and storage zone; the review list pre-fills them and the user confirms or changes them.
- Scan: show each item's own picture in the fridge list instead of the default placeholder image (e.g. crop it from the scanned photo).
- Register recipes from well-known chefs, so users can follow a chef's account and obtain recipes.
- Add secret and surprise recipes that pop up based on a main ingredient in stock.