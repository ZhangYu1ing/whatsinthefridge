"""Shared fixtures: a local static server and an `app` helper around a Playwright page."""
import functools
import http.server
import threading
from datetime import datetime, timezone
from pathlib import Path

import pytest
from playwright.sync_api import expect

ROOT = Path(__file__).resolve().parent.parent

# The sample data in shared/storage.js has fixed dates, so tests run on a fixed "today".
FIXED_NOW = datetime(2026, 11, 22, 10, 0, tzinfo=timezone.utc)

ITEMS_KEY = "whatsinthefridge.items.v1"

# Fonts and images are not needed by the tests and only slow them down or make them flaky.
_SKIPPED_TYPES = {"image", "font", "media"}
_SKIPPED_HOSTS = ("fonts.googleapis.com", "fonts.gstatic.com")


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="session")
def base_url():
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {**browser_context_args, "timezone_id": "UTC", "locale": "en-US"}


class App:
    def __init__(self, page, base_url):
        self.page = page
        self.base_url = base_url
        self.dialogs = []  # messages of alert()/confirm() boxes, all accepted automatically
        self.errors = []  # uncaught JavaScript errors

    def open_home(self):
        self.page.goto(f"{self.base_url}/index.html")
        self.wait_until_ready()

    def reload(self):
        self.page.reload()
        self.wait_until_ready()

    def wait_until_ready(self):
        # index.html sets this once the items are loaded and the first render is done.
        self.page.wait_for_selector("body[data-ready='true']", state="attached")

    def open_menu(self):
        self.page.click("#open-menu")

    def open_all_storage(self):
        self.open_menu()
        self.page.click("#drawer >> text=All Storage")
        expect(self.page.locator("#inventory-modal")).to_be_visible()
        expect(self.page.locator("#view-title")).to_have_text("All Storage")

    def card(self, name):
        return self.page.locator("#inventory-grid > div").filter(has_text=name)

    def stored_items(self):
        return self.page.evaluate(
            "key => JSON.parse(localStorage.getItem(key) || 'null')", ITEMS_KEY
        )


@pytest.fixture
def app(page, base_url):
    def route(r):
        request = r.request
        if request.resource_type in _SKIPPED_TYPES or any(h in request.url for h in _SKIPPED_HOSTS):
            r.abort()
        else:
            r.continue_()

    page.route("**/*", route)
    page.clock.set_fixed_time(FIXED_NOW)

    helper = App(page, base_url)

    def on_dialog(dialog):
        helper.dialogs.append(dialog.message)
        dialog.accept()

    page.on("dialog", on_dialog)
    page.on("pageerror", lambda error: helper.errors.append(str(error)))

    yield helper

    assert helper.errors == [], f"Uncaught JavaScript errors: {helper.errors}"
