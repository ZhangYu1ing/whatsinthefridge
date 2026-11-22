"""End-to-end checks for the home page: sample data, add/edit/delete persistence, scan hand-off."""
from playwright.sync_api import expect

SCAN_PENDING_KEY = "whatsinthefridge.scan.pending.v1"


def test_sample_data_and_expiry_alert(app):
    page = app.page
    app.open_home()

    # On 2026-11-22 only the bread (2 days) and the avocados (3 days) are due soon.
    expect(page.locator("#expiry-panel")).to_be_visible()
    expect(page.locator("#expiry-summary")).to_have_text("2 expiring soon")

    groups = page.locator("#expiry-groups > div")
    expect(groups).to_have_count(2)  # zones without expiring items are not shown
    expect(groups.nth(0)).to_contain_text("Pantry")
    expect(groups.nth(0)).to_contain_text("Fresh Avocados")
    expect(groups.nth(0)).to_contain_text("3 days left")
    expect(groups.nth(1)).to_contain_text("Outside Fridge")
    expect(groups.nth(1)).to_contain_text("Artisan Sourdough Bread")
    expect(groups.nth(1)).to_contain_text("2 days left")

    # All Storage lists every item, soonest expiry first.
    app.open_all_storage()
    assert page.locator("#inventory-grid h4").all_text_contents() == [
        "Artisan Sourdough Bread",
        "Fresh Avocados",
        "Organic Cherry Tomatoes",
        "Whole Organic Milk",
        "Greek Yogurt (Plain)",
        "Grass-Fed Ribeye Steak",
    ]


def _find_stored(app, name):
    return next((i for i in app.stored_items() if i["name"] == name), None)


def test_add_edit_delete_persist_after_reload(app):
    page = app.page
    app.open_home()

    # --- add ---
    app.open_menu()
    page.click("button[onclick='openAddItem()']")
    page.fill("#add-name", "Test Eggs")
    page.fill("#add-qty", "6")
    page.select_option("#add-zone", "freezer")
    page.select_option("#add-expiry-year", "2027")
    page.select_option("#add-expiry-month", "3")
    page.select_option("#add-expiry-day", "15")
    page.click("#save-add-item")

    expect(page.locator("#inventory-modal")).to_be_visible()
    card = app.card("Test Eggs")
    expect(card).to_have_count(1)
    expect(card).to_contain_text("x6")
    expect(card).to_contain_text("freezer")
    expect(card).to_contain_text("Expiry: Mar 15, 2027")
    stored = _find_stored(app, "Test Eggs")
    assert (stored["zone"], stored["qty"], stored["expiry"]) == ("freezer", 6, "2027-03-15")

    # --- still there after a refresh ---
    app.reload()
    app.open_all_storage()
    expect(app.card("Test Eggs")).to_have_count(1)

    # --- edit ---
    app.card("Test Eggs").get_by_role("button", name="Edit / Move").click()
    expect(page.locator("#edit-item-modal")).to_be_visible()
    page.fill("#edit-name", "Test Eggs XL")
    page.fill("#edit-qty", "12")
    page.select_option("#edit-zone", "pantry")
    page.click("#save-edit-item")

    expect(page.locator("#edit-item-modal")).to_be_hidden()
    expect(app.card("Test Eggs")).to_have_count(1)  # the renamed card still matches "Test Eggs"
    card = app.card("Test Eggs XL")
    expect(card).to_have_count(1)
    expect(card).to_contain_text("x12")
    expect(card).to_contain_text("pantry")
    expect(card).to_contain_text("Expiry: Mar 15, 2027")  # untouched by the edit
    stored = _find_stored(app, "Test Eggs XL")
    assert (stored["zone"], stored["qty"], stored["expiry"]) == ("pantry", 12, "2027-03-15")

    app.reload()
    app.open_all_storage()
    expect(app.card("Test Eggs XL")).to_have_count(1)

    # --- delete ---
    app.card("Test Eggs XL").get_by_role("button", name="Edit / Move").click()
    page.click("#delete-edit-item")

    expect(app.card("Test Eggs")).to_have_count(0)
    assert _find_stored(app, "Test Eggs XL") is None

    app.reload()
    app.open_all_storage()
    expect(app.card("Test Eggs")).to_have_count(0)
    expect(page.locator("#inventory-grid > div")).to_have_count(6)  # only the sample items are left

    # The only dialog is the delete confirmation; no "could not save" alerts.
    assert app.dialogs == ["Remove this item from the fridge?"]


def test_scan_handoff_imports_items_once(app):
    page = app.page

    # Build the hand-off with the real ScanCore, the same way scan.html does when you submit.
    page.goto(f"{app.base_url}/scan/scan.html")
    page.evaluate(
        """() => {
            const r = window.ScanCore.buildPendingItems([
                { name: 'Scanned Milk', zone: 'chilled', qty: '2', category: '' }
            ]);
            localStorage.setItem(window.ScanCore.PENDING_KEY, JSON.stringify(r.items));
        }"""
    )

    app.open_home()

    # Back on the home page the new item is shown straight away.
    expect(page.locator("#inventory-modal")).to_be_visible()
    expect(page.locator("#view-title")).to_have_text("All Storage")
    card = app.card("Scanned Milk")
    expect(card).to_have_count(1)
    expect(card).to_contain_text("x2")
    expect(card).to_contain_text("No expiry set")

    assert page.evaluate("key => localStorage.getItem(key)", SCAN_PENDING_KEY) is None
    stored = _find_stored(app, "Scanned Milk")
    assert (stored["zone"], stored["qty"], stored["expiry"]) == ("chilled", 2, None)

    # A refresh must not import it a second time.
    app.reload()
    app.open_all_storage()
    expect(app.card("Scanned Milk")).to_have_count(1)
