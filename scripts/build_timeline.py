#!/usr/bin/env python3
"""Generate a cautious, page-cited event timeline from the indexed PDF corpus."""
import difflib
import gzip
import hashlib
import calendar
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public/corpus"
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
graph = json.loads(gzip.decompress((ROOT / "graph.bin").read_bytes()))
documents = {item["id"]: item for item in manifest}
month_names = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}
month_pattern = "|".join(month_names)
date_patterns = [
    re.compile(rf"\b(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s+(?P<month>{month_pattern})[,]?\s+(?P<year>\d{{4}})\b", re.I),
    re.compile(rf"\b(?P<month>{month_pattern})\s+(?P<day>\d{{1,2}})(?:st|nd|rd|th)?[,]?\s+(?P<year>\d{{4}})\b", re.I),
]
month_year_pattern = re.compile(rf"\b(?P<month>{month_pattern})\s+(?P<year>\d{{4}})\b", re.I)
year_pattern = re.compile(r"\b(?:17|18|19)\d{2}\b")
entity_person_terms = []
for node in graph.get("nodes", []):
    if node.get("type") == "PERSON":
        entity_person_terms.extend(word for word in re.findall(r"[A-Za-z]{4,}", node.get("label", "")) if word.lower() not in {"mahatma", "babasaheb"})
focus_terms = [
    "Ambedkar", "Babasaheb", "Bhimrao", "Constituent Assembly", "Round Table Conference",
    "Depressed Classes Federation", "Scheduled Castes Federation", "Poona Pact", "Mahad Satyagraha",
    "Yeola Conference", "Hindu Code Bill", "Gandhi", "Nehru", *entity_person_terms,
]
focus_pattern = re.compile(r"\b(?:" + "|".join(sorted({re.escape(term) for term in focus_terms}, key=len, reverse=True)) + r")\b", re.I)
publication_header_pattern = re.compile(
    r"\b(?:BABASAHEB\s+|DR\.?\s*)?(?:B\.?\s*R\.?\s*)?AMBEDKAR\s*:\s*WRITINGS\s+AND\s+SPEECHES(?:\s+(?:VOL(?:UME)?\.?\s*)?[IVX0-9-]+)?",
    re.I,
)
speaker_prefix_pattern = re.compile(r"^\s*(?:DR\.?\s*)?(?:B\.?\s*R\.?\s*)?AMBEDKAR\s*:\s*", re.I)
action_pattern = re.compile(
    r"\b(?:held|passed|founded|formed|established|adopted|delivered|signed|convened|"
    r"addressed|born|died|resigned|appointed|elected|converted|marched|met|proposed|"
    r"launched|opened|declared|resolved|presented|submitted|celebrated|participated)\b", re.I,
)


def normalize_space(value):
    return " ".join(value.replace("\u00ad", "").split()).strip(" \t\r\n·—–-_")


def parse_date(source, candidate_year):
    for pattern in date_patterns:
        for match in pattern.finditer(source):
            year = int(match.group("year"))
            if year != candidate_year:
                continue
            month = month_names[match.group("month").lower()]
            day = int(match.group("day"))
            if 1 <= day <= calendar.monthrange(year, month)[1]:
                return {"date": f"{year:04d}-{month:02d}-{day:02d}", "precision": "DAY", "year": year, "month": month, "day": day}
    for match in month_year_pattern.finditer(source):
        year = int(match.group("year"))
        if year == candidate_year:
            month = month_names[match.group("month").lower()]
            return {"date": f"{year:04d}-{month:02d}", "precision": "MONTH", "year": year, "month": month, "day": None}
    return {"date": str(candidate_year), "precision": "YEAR", "year": candidate_year, "month": None, "day": None}


def date_matches(clause):
    found = []
    occupied = []
    precise_years = set()
    for pattern in date_patterns:
        for match in pattern.finditer(clause):
            year = int(match.group("year"))
            month = month_names[match.group("month").lower()]
            day = int(match.group("day"))
            if not 1700 <= year <= 1999 or not 1 <= day <= calendar.monthrange(year, month)[1]:
                continue
            found.append(({"date": f"{year:04d}-{month:02d}-{day:02d}", "precision": "DAY", "year": year, "month": month, "day": day}, match.span()))
            occupied.append(match.span())
            precise_years.add(year)
    for match in month_year_pattern.finditer(clause):
        year = int(match.group("year"))
        month = month_names[match.group("month").lower()]
        if not 1700 <= year <= 1999 or any(start <= match.start() < end for start, end in occupied):
            continue
        found.append(({"date": f"{year:04d}-{month:02d}", "precision": "MONTH", "year": year, "month": month, "day": None}, match.span()))
        occupied.append(match.span())
        precise_years.add(year)
    for match in year_pattern.finditer(clause):
        year = int(match.group())
        if year in precise_years or any(start <= match.start() < end for start, end in occupied):
            continue
        found.append(({"date": str(year), "precision": "YEAR", "year": year, "month": None, "day": None}, match.span()))
    return found


def event_clauses(source):
    return [normalize_space(part) for part in re.split(r"(?<=[.!?])\s+(?=[A-Z“\"'])|;\s*", source) if normalize_space(part)]


def date_label(parsed):
    if parsed["precision"] == "DAY":
        import calendar
        day = parsed["day"]
        suffix = "th" if 11 <= day % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix} {calendar.month_name[parsed['month']]} {parsed['year']}"
    if parsed["precision"] == "MONTH":
        import calendar
        return f"{calendar.month_name[parsed['month']]} {parsed['year']}"
    return str(parsed["year"])


def candidate_title(source, page, entities, parsed):
    clean = normalize_space(source)
    headings = [normalize_space(h.get("title", "")) for h in page.get("headings", [])]
    for heading in headings:
        if 6 <= len(heading) <= 100 and heading.casefold() in clean.casefold():
            return heading
    signal = action_pattern.search(clean)
    if signal:
        subject = next((item["label"] for item in entities if item["type"] in {"PERSON", "ORGANIZATION", "INSTITUTION", "EVENT REFERENCE", "WORK"}), None)
        if subject:
            tail = clean[signal.end():]
            stops = [match.start() for pattern in (*date_patterns, month_year_pattern, year_pattern) for match in pattern.finditer(tail)]
            if stops:
                tail = tail[:min(stops)]
            tail = re.split(r"[.!?;]", tail, maxsplit=1)[0].strip(" ,:—–-\t")
            tail = re.sub(r"\b(?:in|on|at|of|the|a|an)\s*$", "", tail, flags=re.I).strip()
            tail = tail[:58].rsplit(" ", 1)[0] if len(tail) > 58 else tail
            detail = " ".join(part for part in (signal.group(0), tail) if part)
            return f"{subject} — {detail}".strip(" —")
        lead = clean[:signal.start()].strip(" :;,.-—–")
        if 8 <= len(lead) <= 76:
            lead = re.sub(r"^(?:ambedkar|babasaheb ambedkar)\s*[:—-]\s*", "", lead, flags=re.I)
            if 8 <= len(lead) <= 100:
                return f"{lead} — {signal.group(0)}"
    date = date_label(parsed)
    if signal:
        return f"{signal.group(0).capitalize()} · {date}"
    first_clause = re.split(r"(?<=[.!?])\s+|\s+[—–]\s+", clean, maxsplit=1)[0]
    if len(first_clause) > 92:
        first_clause = first_clause[:89].rsplit(" ", 1)[0] + "…"
    return first_clause or f"Source event reference · {page['pageNumber']}"


def excerpt(source):
    clean = normalize_space(source)
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z“\"'])", clean)
    selected = " ".join(sentences[:2]).strip()
    if len(selected) > 560:
        selected = selected[:557].rsplit(" ", 1)[0] + "…"
    return selected


def normalized_for_match(value):
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def related_entities(document_id, page_number, by_page, passage):
    labels = by_page.get((document_id, page_number), [])
    entities = []
    for item in labels:
        if item["type"] == "DOCUMENT":
            continue
        terms = [item["label"]]
        if item["type"] == "PERSON":
            terms.append(item["label"].split()[-1])
        if not any(re.search(r"\b" + re.escape(term) + r"\b", passage, re.I) for term in terms if term):
            continue
        record = {"label": item["label"], "type": item["type"]}
        if record not in entities:
            entities.append(record)
    people = [item["label"] for item in entities if item["type"] == "PERSON"]
    topics = [item["label"] for item in entities if item["type"] == "TOPIC"]
    places = [item["label"] for item in entities if item["type"] == "PLACE"]
    return entities[:8], people[:5], topics[:6], places[:4]


by_page = defaultdict(list)
for node in graph.get("nodes", []):
    for document_id, page_number in node.get("pages", []):
        by_page[(document_id, page_number)].append({"label": node["label"], "type": node["type"]})

volume_cache = {}
raw_events = []
for candidate in graph.get("events", []):
    source = normalize_space(candidate.get("sourceText", ""))
    if not source:
        continue
    document_id = candidate["documentId"]
    page_number = int(candidate["pageNumber"])
    if document_id not in volume_cache:
        with gzip.open(ROOT / f"{document_id}.bin", "rt", encoding="utf-8") as stream:
            volume_cache[document_id] = json.load(stream)
    page = volume_cache[document_id]["pages"][page_number - 1]
    record = documents.get(document_id, {})
    pdf_url = (
        f"/api/archive/supplied?documentId={document_id}"
        if record.get("delivery") == "R2"
        else f"/corpus/pdf/{record.get('filename', '')}"
    )
    for clause in event_clauses(source):
        if not action_pattern.search(clause):
            continue
        focus_text = speaker_prefix_pattern.sub(" ", publication_header_pattern.sub(" ", clause))
        if not focus_pattern.search(focus_text):
            continue
        entities, people, topics, places = related_entities(document_id, page_number, by_page, clause)
        actions = list(action_pattern.finditer(clause))
        for parsed, date_span in date_matches(clause):
            nearest_action = min(actions, key=lambda action: min(abs(action.start() - date_span[0]), abs(action.end() - date_span[1])))
            distance = min(abs(nearest_action.start() - date_span[0]), abs(nearest_action.end() - date_span[1]))
            if distance > 135:
                continue
            reference = {
                "documentId": document_id,
                "documentTitle": record.get("title", document_id),
                "pageNumber": page_number,
                "pageId": page.get("pageId", f"{document_id}-P{page_number:04d}"),
                "method": page.get("method", "UNKNOWN"),
                "confidence": page.get("confidence"),
                "sourceText": clause,
                "pdfUrl": pdf_url,
            }
            title = candidate_title(clause, page, entities, parsed)
            signature = f"{parsed['date']}|{normalized_for_match(title)}|{normalized_for_match(clause)}"
            digest = hashlib.sha1(signature.encode("utf-8")).hexdigest()[:14]
            raw_events.append({
                "id": f"EV-{parsed['year']}-{digest}",
                "date": parsed["date"],
                "datePrecision": parsed["precision"],
                "dateLabel": date_label(parsed),
                "year": parsed["year"],
                "month": parsed["month"],
                "day": parsed["day"],
                "title": title,
                "description": excerpt(clause),
                "sourceText": clause,
                "people": people,
                "topics": topics,
                "places": places,
                "entities": entities,
                "sourceReferences": [reference],
                "imagePreview": {"documentId": document_id, "pageNumber": page_number, "pdfUrl": pdf_url, "method": page.get("method", "UNKNOWN")},
                "reviewStatus": "CANDIDATE",
                "extraction": "PAGE_INDEX_EVENT_CANDIDATE",
            })


def event_order(item):
    return (item["year"], item["month"] or 0, item["day"] or 0, item["title"].casefold(), item["sourceReferences"][0]["documentId"], item["sourceReferences"][0]["pageNumber"])


raw_events.sort(key=event_order)
events = []
for event in raw_events:
    source_key = normalized_for_match(event["sourceText"])
    match = None
    for existing in reversed(events):
        if existing["date"] != event["date"]:
            continue
        a = normalized_for_match(existing["sourceText"])
        if difflib.SequenceMatcher(None, a, source_key, autojunk=False).ratio() >= 0.91:
            match = existing
            break
    if match:
        known = {(ref["documentId"], ref["pageNumber"]) for ref in match["sourceReferences"]}
        for ref in event["sourceReferences"]:
            if (ref["documentId"], ref["pageNumber"]) not in known:
                match["sourceReferences"].append(ref)
        for key in ("people", "topics", "places"):
            match[key] = list(dict.fromkeys(match[key] + event[key]))
        known_entities = {(entity["label"], entity["type"]) for entity in match["entities"]}
        match["entities"] += [entity for entity in event["entities"] if (entity["label"], entity["type"]) not in known_entities]
        match["entities"] = match["entities"][:8]
        continue
    events.append(event)

pdf_pages = sum(int(item.get("pageCount", 0)) for item in manifest)
indexed_pages = sum(int(item.get("extraction", {}).get("native", 0)) + int(item.get("extraction", {}).get("ocr", 0)) for item in manifest)
unreadable_pages = sum(int(item.get("extraction", {}).get("unreadable", 0)) for item in manifest)
output = {
    "schemaVersion": 1,
    "generatedFrom": "PDF Page Index and source entity/event extraction",
    "sourceDocumentCount": len(manifest),
    "sourcePageCount": indexed_pages,
    "pdfPageCount": pdf_pages,
    "unreadablePageCount": unreadable_pages,
    "eventCandidateCount": len(events),
    "events": events,
}
(ROOT / "timeline.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(events)} source-backed event candidates from {len(manifest)} PDFs; {indexed_pages} text-indexed of {pdf_pages} PDF pages")
