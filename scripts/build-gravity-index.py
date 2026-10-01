#!/usr/bin/env python3
"""Derive the Gravity read model from the existing page-cited explorer index.

The original graph and PDFs remain the authority. This compact read model is
regenerated after the PDF graph is rebuilt; it never invents edges or scores.
"""
import gzip
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "public/corpus/explorer.bin"
target = root / "src/generated/gravity-index.json"
graph = json.loads(gzip.decompress(source.read_bytes()))
payload = {
    "nodes": [
        {"id": node["id"], "label": node["label"], "type": node["type"],
         "mentionCount": node["mentionCount"]}
        for node in graph["nodes"]
    ],
    "links": [
        {"source": link["source"], "target": link["target"],
         "relation": link["relation"], "count": link["count"],
         "sources": link["sources"][:5]}
        for link in graph["links"] if link["sources"]
    ],
}
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Gravity read model: {len(payload['nodes'])} entities, {len(payload['links'])} sourced links")
