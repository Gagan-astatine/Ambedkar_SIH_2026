#!/usr/bin/env python3
"""Build a page-level inverted keyword index from the supplied PDF Page Index."""
import gzip
import json
import re
import sqlite3
import tempfile
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public/corpus"
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
token_pattern = re.compile(r"[a-z0-9]+")
locations = []
methods = []
lengths = []


def tokens(value):
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    return token_pattern.findall(normalized)


with tempfile.TemporaryDirectory(prefix="ambedkar-keyword-index-") as temporary:
    db = sqlite3.connect(Path(temporary) / "postings.sqlite")
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("PRAGMA temp_store=FILE")
    db.execute("CREATE TABLE postings (term TEXT NOT NULL, page_index INTEGER NOT NULL, frequency INTEGER NOT NULL, PRIMARY KEY(term, page_index)) WITHOUT ROWID")
    insert = db.cursor()
    for document in manifest:
        with gzip.open(ROOT / f"{document['id']}.bin", "rt", encoding="utf-8") as stream:
            pages = json.load(stream)["pages"]
        for page in pages:
            page_tokens = tokens(page.get("text", ""))
            if not page_tokens:
                continue
            page_index = len(locations)
            locations.append([document["id"], int(page["pageNumber"])])
            methods.append(page.get("method", "UNKNOWN"))
            lengths.append(len(page_tokens))
            frequencies = Counter(page_tokens)
            insert.executemany(
                "INSERT INTO postings(term, page_index, frequency) VALUES(?,?,?)",
                ((term, page_index, frequency) for term, frequency in frequencies.items()),
            )
        db.commit()
        print(f"INDEXED {document['id']} · {len(pages)} PDF pages", flush=True)

    term_count = db.execute("SELECT count(DISTINCT term) FROM postings").fetchone()[0]
    output = ROOT / "keyword-index.bin"
    with gzip.open(output, "wt", encoding="utf-8", compresslevel=8) as stream:
        stream.write('{"schemaVersion":1,"generatedFrom":"PDF Page Index","pageLocations":')
        json.dump(locations, stream, separators=(",", ":"), ensure_ascii=False)
        stream.write(',"pageMethods":')
        json.dump(methods, stream, separators=(",", ":"), ensure_ascii=False)
        stream.write(',"pageLengths":')
        json.dump(lengths, stream, separators=(",", ":"))
        stream.write(',"averagePageLength":')
        json.dump((sum(lengths) / len(lengths)) if lengths else 0, stream)
        stream.write(',"termCount":')
        json.dump(term_count, stream)
        stream.write(',"postings":{')
        cursor = db.execute("SELECT term, page_index, frequency FROM postings ORDER BY term, page_index")
        current = None
        first_term = True
        first_posting = True
        for term, page_index, frequency in cursor:
            if term != current:
                if current is not None:
                    stream.write("]")
                if not first_term:
                    stream.write(",")
                json.dump(term, stream, ensure_ascii=False)
                stream.write(":")
                stream.write("[")
                current = term
                first_term = False
                first_posting = True
            if not first_posting:
                stream.write(",")
            json.dump([page_index, frequency], stream, separators=(",", ":"))
            first_posting = False
        if current is not None:
            stream.write("]")
        stream.write("}}")
    db.close()
    print(f"BUILT {len(locations)} page postings across {term_count} terms → {output}", flush=True)
