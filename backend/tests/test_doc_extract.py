"""Tests for the markitdown-based document extractor (RAG ingestion)."""

from __future__ import annotations

from app.services.doc_extract import SUPPORTED_EXTS, extract_markdown, is_supported


def test_is_supported_accepts_docs_rejects_pdf_and_images():
    assert is_supported("lesson.docx")
    assert is_supported("slides.PPTX")  # case-insensitive
    assert is_supported("data.xlsx")
    assert is_supported("page.html")
    # PDFs and images have their own (page-aware / vision) paths.
    assert not is_supported("book.pdf")
    assert not is_supported("photo.png")
    assert ".pdf" not in SUPPORTED_EXTS


def test_extract_markdown_from_html_preserves_structure():
    html = (
        b"<html><body><h1>Ohm's Law</h1>"
        b"<p>V = I * R.</p>"
        b"<table><tr><th>Quantity</th><th>Unit</th></tr>"
        b"<tr><td>Voltage</td><td>Volt</td></tr></table></body></html>"
    )
    md = extract_markdown(html, "lesson.html")
    assert "Ohm's Law" in md
    assert "V = I" in md
    # Table survives as Markdown, which chunks/retrieves better than a flat dump.
    assert "| Quantity | Unit |" in md


def test_extract_markdown_empty_on_garbage():
    # An unreadable blob should yield empty text, not raise.
    out = extract_markdown(b"\x00\x01\x02not a real document", "broken.html")
    assert isinstance(out, str)
