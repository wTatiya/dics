from pathlib import Path


def test_smoke():
    assert True


def test_site_assets_exist():
    root = Path(__file__).resolve().parents[1]
    index_path = root / "index.html"
    css_path = root / "assets" / "style.css"

    assert index_path.exists()
    assert css_path.exists()
    assert "lang=\"th\"" in index_path.read_text(encoding="utf-8")
    assert "Google Sans" in css_path.read_text(encoding="utf-8")
