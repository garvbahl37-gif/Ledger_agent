"""
Standalone HTML Report Export
==============================
A single file a reader can open, print or email, with the ledger travelling
alongside the prose.

The constraint that shapes this: a claim the reader cannot check is a claim they
have to take on trust, so the receipts ship inside the same file rather than
behind a link back to a server that may not be running.
"""
from __future__ import annotations

import html
from datetime import datetime

from core.ledger import Ledger, HypothesisStatus


STYLE = """
*{box-sizing:border-box}
body{margin:0;background:#fcfcfd;color:#0f172a;
  font:400 15px/1.7 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;
  letter-spacing:-.011em;-webkit-font-smoothing:antialiased}
.wrap{max-width:820px;margin:0 auto;padding:56px 24px 96px}
h1,h2,h3{letter-spacing:-.03em;line-height:1.2;font-weight:700}
h1{font-size:30px;margin:0 0 8px}
h2{font-size:19px;margin:40px 0 12px}
h3{font-size:15px;margin:0}
.meta{color:#64748b;font-size:13px;margin-bottom:32px}
.meta code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;
  background:#f1f5f9;padding:2px 6px;border-radius:4px}
.banner{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;
  border-radius:12px;margin-bottom:32px;font-size:13.5px;line-height:1.6}
.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857}
.warn{background:#fffbeb;border:1px solid #fde68a;color:#b45309}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  gap:20px;padding:20px;background:#fff;border:1px solid #e2e8f0;
  border-radius:12px;margin-bottom:32px}
.stat b{display:block;font-size:25px;font-weight:600;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums}
.stat span{display:block;font-size:12px;color:#64748b;margin-top:4px}
.prose{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px 32px}
.prose p{margin:0 0 16px}
.prose h1,.prose h2,.prose h3{margin-top:24px}
.entry{background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  padding:18px 20px;margin-bottom:10px}
.entry.rejected{background:#fcfcfd}
.entry-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
.hid{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;
  font-weight:600;color:#64748b;padding-top:2px}
.stmt{flex:1;font-size:14px;line-height:1.5}
.entry.rejected .stmt{color:#64748b}
.pill{font-size:11px;font-weight:500;padding:3px 9px;border-radius:99px;
  white-space:nowrap;border:1px solid}
.pill.s{background:#ecfdf5;color:#047857;border-color:#a7f3d0}
.pill.r{background:#f8fafc;color:#475569;border-color:#e2e8f0}
.pill.e{background:#fff1f2;color:#be123c;border-color:#fecdd3}
table.res{width:100%;border-collapse:collapse;font-size:12.5px;margin:10px 0}
table.res td{padding:4px 0;border-bottom:1px solid #eef2f6;
  font-variant-numeric:tabular-nums}
table.res td:first-child{color:#64748b;width:42%}
table.res td:last-child{font-family:'JetBrains Mono',ui-monospace,monospace}
pre{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
  padding:12px;overflow-x:auto;font-family:'JetBrains Mono',ui-monospace,monospace;
  font-size:12px;line-height:1.6;margin:10px 0}
blockquote{margin:10px 0;padding:10px 14px;border-left:2px solid #0d9488;
  background:#f0fdfa;border-radius:0 8px 8px 0;font-size:13.5px}
.lbl{font-size:10.5px;letter-spacing:.06em;color:#64748b;font-weight:500;
  margin:14px 0 4px}
.note{font-size:12.5px;color:#64748b;line-height:1.6}
footer{margin-top:56px;padding-top:20px;border-top:1px solid #e2e8f0;
  font-size:12px;color:#94a3b8}
@media print{body{background:#fff}.entry,.prose,.stats{break-inside:avoid}}
"""


def _esc(v) -> str:
    return html.escape(str(v if v is not None else "—"))


def _fmt_p(p) -> str:
    if p is None:
        return "—"
    return f"{p:.3g}" if p >= 1e-4 else f"{p:.2e}"


def build_html(ledger: Ledger) -> str:
    ds = ledger.dataset
    entries = ledger.hypotheses
    supported = [h for h in entries if h.status == HypothesisStatus.SUPPORTED]
    rejected = [h for h in entries if h.status == HypothesisStatus.REJECTED]
    errored = [h for h in entries if h.status == HypothesisStatus.ERROR]

    validated = ledger.report_validated
    banner = (
        '<div class="banner ok"><span>&#10003;</span><div>'
        "<strong>The red team cleared this report.</strong> No causal language, overstated "
        "effects or claims outside the registry survived the audit.</div></div>"
        if validated else
        f'<div class="banner warn"><span>&#9888;</span><div>'
        f"<strong>{len(ledger.adversary_violations)} flag(s) were left standing.</strong> "
        f"The rewrite budget ran out with issues outstanding; they are listed at the end "
        f"rather than removed.</div></div>"
    )

    parts = [
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
        "<meta name='viewport' content='width=device-width,initial-scale=1'>",
        f"<title>Ledger — {_esc(ds.filename if ds else 'analysis')}</title>",
        f"<style>{STYLE}</style></head><body><div class='wrap'>",
        f"<h1>{_esc(ds.filename if ds else 'Analysis')}</h1>",
        "<p class='meta'>",
        f"Generated {datetime.utcnow().strftime('%d %B %Y, %H:%M UTC')} · ",
        f"registry <code>{_esc(ledger.registry_hash)}</code> · ",
        f"reproducibility <code>{_esc(ledger.compute_final_hash())}</code>",
        "</p>",
        banner,
        "<div class='stats'>",
        f"<div class='stat'><b>{len(entries)}</b><span>Registered</span></div>",
        f"<div class='stat'><b style='color:#047857'>{len(supported)}</b><span>Supported</span></div>",
        f"<div class='stat'><b style='color:#64748b'>{len(rejected)}</b><span>Not supported</span></div>",
    ]
    if ds:
        parts.append(
            f"<div class='stat'><b>{ds.n_rows:,}</b><span>Rows &times; {ds.n_cols} columns</span></div>"
        )
    parts.append("</div>")

    if ledger.report_html:
        parts.append(f"<div class='prose'>{ledger.report_html}</div>")

    parts.append("<h2>The ledger</h2>")
    parts.append(
        "<p class='note'>All "
        f"{len(entries)} registered hypotheses, including the {len(rejected) + len(errored)} "
        "that produced nothing. The Benjamini&ndash;Hochberg correction was computed across this "
        "whole family, so the failures are part of the arithmetic rather than an omission.</p>"
    )

    for h in entries:
        status = h.status.value if hasattr(h.status, "value") else str(h.status)
        cls = {"SUPPORTED": "s", "REJECTED": "r", "ERROR": "e"}.get(status, "r")
        label = {"SUPPORTED": "Supported", "REJECTED": "Not supported",
                 "ERROR": "Failed to run"}.get(status, status)

        parts.append(f"<div class='entry {'rejected' if cls == 'r' else ''}'>")
        parts.append(
            "<div class='entry-head'>"
            f"<span class='hid'>{_esc(h.id)}</span>"
            f"<span class='stmt'>{_esc(h.statement)}</span>"
            f"<span class='pill {cls}'>{label}</span>"
            "</div>"
        )

        r = h.statistical_result
        if r:
            rows = [
                ("Test selected", _esc(r.test_name)),
                ("Statistic", f"{r.statistic:.6g}"),
                ("Raw p", _fmt_p(r.raw_p_value)),
                ("BH-adjusted p", _fmt_p(r.fdr_adjusted_p_value)),
            ]
            if r.effect_size is not None:
                rows.append(("Effect size", f"{r.effect_size:.4g} ({_esc(r.effect_size_label)})"))
            for a in r.assumptions:
                detail = f" (p = {_fmt_p(a.p_value)})" if a.p_value is not None else ""
                rows.append((_esc(a.name), ("holds" if a.passed else "violated") + detail))

            parts.append("<table class='res'>")
            for k, v in rows:
                parts.append(f"<tr><td>{k}</td><td>{v}</td></tr>")
            parts.append("</table>")

            if r.licensed_text:
                parts.append("<div class='lbl'>LICENSED TEXT</div>")
                parts.append(f"<blockquote>{_esc(r.licensed_text)}</blockquote>")
        elif status == "ERROR":
            parts.append(
                "<p class='note'>The code for this hypothesis could not be made to run, so no "
                "verdict was reached. It remains in the registry and still counts toward the "
                "correction.</p>"
            )

        attempt = h.execution_attempts[-1] if h.execution_attempts else None
        if attempt and attempt.code:
            repairs = len(h.execution_attempts) - 1
            suffix = f" &mdash; repaired {repairs}&times;" if repairs else ""
            parts.append(f"<div class='lbl'>CODE EXECUTED{suffix}</div>")
            parts.append(f"<pre>{_esc(attempt.code)}</pre>")

        parts.append("</div>")

    if ledger.adversary_violations:
        parts.append("<h2>What the red team flagged</h2>")
        for v in ledger.adversary_violations:
            parts.append(
                "<div class='entry'>"
                f"<div class='entry-head'><span class='stmt'><strong>{_esc(v.violation_type)}</strong>"
                f"</span><span class='pill e'>{_esc(v.severity)}</span></div>"
                f"<blockquote>{_esc(v.sentence)}</blockquote>"
                f"<p class='note'>{_esc(v.explanation)}</p>"
                "</div>"
            )

    parts.append(
        "<footer>Produced by Ledger. The language model proposed and phrased; deterministic "
        "statistics decided. Every sentence above traces to an entry in this ledger &mdash; a "
        "sentence without one could not be written.</footer>"
    )
    parts.append("</div></body></html>")
    return "".join(parts)
