# 冰箱里面有什么 (What's in the Fridge)
A mobile-first, single-file web prototype for tracking the food in your fridge and planning tonight's dinner.

## Features
- **Home**: food summary grouped by zone (cold store / freezer / outside fridge) and a dinner preview.
- **Photo intake**: upload a photo and review recognized items (currently a mock, with hard-coded results).
- **My fridge**: drag items between zones, edit name/quantity, or mark as used up.
- **Dinner**: add a dish with ingredients; unknown ingredients are auto-added to the fridge zone.

## Run
Open `index.html` in a browser. No build or dependencies required.

## Status
Prototype. Data is saved in the browser (`localStorage`) and survives refresh. Photo recognition is simulated.

## Data storage
Items are persisted in the browser's `localStorage` under the key `whatsinthefridge.items.v1`.

- **Data layer**: `loadItems()`, `saveItems()`, `addItem()` and `removeItem()` in `index.html`. UI code goes through these functions, so a backend (e.g. Supabase) can replace them later without UI changes.
- **Seed data**: `seedItems` holds the sample items and is only used on first load or when storage is empty.
- **Operations**: adding calls `addItem`, deleting calls `removeItem`, and saving an edit calls `saveItems`.
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

## Next Steps
- Add a database for storing and sharing data.
- Test and verify object detection for photo intake.
- Register recipes from well-known chefs, so users can follow a chef's account and obtain recipes.
- Add secret and surprise recipes that pop up based on a main ingredient in stock.