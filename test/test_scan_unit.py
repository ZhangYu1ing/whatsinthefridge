"""Runs the existing in-browser unit tests of the scan feature (scan/tests.html)."""


def test_scan_unit_tests_pass(page, base_url):
    page.goto(f"{base_url}/scan/tests.html")
    page.wait_for_function("window.__SCAN_TEST_RESULT__ !== undefined", timeout=30_000)
    result = page.evaluate("window.__SCAN_TEST_RESULT__")

    failed = [r for r in result["results"] if not r["ok"]]
    assert result["total"] > 0
    assert not failed, failed
