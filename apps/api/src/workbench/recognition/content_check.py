"""Locate bounded disagreements and unexplained gaps; never reconstruct text.

PP-OCR's line score is diagnostic only. Complex mathematical notation cannot
be compared as plain text. A matching result does not certify correctness.
"""
import re
import unicodedata
from difflib import SequenceMatcher

import numpy as np

HAN = re.compile(r"[\u4e00-\u9fff]")
TEXT_LABELS = {"text", "paragraph_title"}


def area(box):
    return max(0, box[2] - box[0]) * max(0, box[3] - box[1])


def intersection(a, b):
    return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))


def plain(value):
    value = re.sub(r"\\[()\[\]]|\$", "", value)
    if re.search(r"[\\{}_^]", value):
        return None
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value)).translate(
        str.maketrans({"。": ".", "，": ",", "−": "-", "、": ","}))


def empty_operand(first, second):
    """A shared simple LHS, with one recognizer stopping at the equals sign."""
    for empty, other in ((first, second), (second, first)):
        match = re.fullmatch(r"(.*?)=", plain(empty) or "")
        other = other.replace("$", "").replace(r"\(", "").replace(r"\)", "")
        if match and "=" in other:
            lhs, rhs = other.split("=", 1)
            if plain(lhs) == match.group(1) and re.sub(r"[\s_]+", "", rhs):
                return True
    return False


def conflicts(source, observed):
    # Consecutive matched Chinese characters anchor the same visible segment.
    # Do not compare whole multi-line blocks or discard mathematical operators
    # to force equivalence. Neither source is treated as a corrected answer.
    a, b = list(HAN.finditer(observed)), list(HAN.finditer(source))
    matching = []
    for group in SequenceMatcher(None, [m.group() for m in a], [m.group() for m in b], autojunk=False).get_matching_blocks():
        matching.extend((group.a + i, group.b + i) for i in range(group.size))
    for (pa, pb), (qa, qb) in zip(matching, matching[1:]):
        if qa != pa + 1 or qb != pb + 1:
            continue
        independent = observed[a[pa].end():a[qa].start()]
        primary = source[b[pb].end():b[qb].start()]
        if len(independent) > 100 or len(primary) > 300:
            continue
        left, right = plain(independent), plain(primary)
        if empty_operand(independent, primary) or (left is not None and right is not None and left != right):
            yield {"primaryText": primary, "independentText": independent,
                   "sourceStart": b[pb].start(), "sourceEnd": b[qb].end()}


def gap_source_range(source, left, right):
    """Locate an already detected gap in the primary text, without guessing."""
    characters = list(HAN.finditer(source))
    text = "".join(m.group() for m in characters)
    anchor = "".join(HAN.findall(left + right))
    start = text.find(anchor)
    if anchor and start >= 0 and text.find(anchor, start + 1) < 0:
        return {"sourceStart": characters[start].start(),
                "sourceEnd": characters[start + len(anchor) - 1].end()}
    return {}


def content_issues(primary, independent, page):
    """Return pixel regions in this original page; all source text stays intact."""
    blocks = primary["parsing_res_list"]
    lines, issues = [], []
    for line_index, (text, score, box) in enumerate(zip(independent["rec_texts"], independent["rec_scores"], independent["rec_boxes"])):
        owners = [block for block in blocks if block["block_label"] in TEXT_LABELS
                  and intersection(box, block["block_bbox"]) / max(1, area(box)) > .8]
        block = owners[0] if len(owners) == 1 else None
        lines.append({"text": text, "score": score, "box": box, "block": block, "index": line_index})
        if block:
            for difference in conflicts(block["block_content"], text):
                issues.append({"code": "ocr-text-conflict", "blockId": block["block_id"], "bbox": box,
                               "detail": "这行有不一致的识别结果，请对照原稿核对。", **difference})

    pixels = np.asarray(page.convert("L"))
    gaps = []
    for left in lines:
        a = left["box"]
        rightward = []
        for right in lines:
            b = right["box"]
            height = min(a[3] - a[1], b[3] - b[1])
            overlap = min(a[3], b[3]) - max(a[1], b[1])
            if height > 0 and b[0] > a[2] and overlap / height >= .8:
                rightward.append(right)
        if not rightward:
            continue
        right = min(rightward, key=lambda line: line["box"][0])
        b = right["box"]
        height = min(a[3] - a[1], b[3] - b[1])
        gap = b[0] - a[2]
        if gap / height < 1.3 or not HAN.search(left["text"]) or not HAN.search(right["text"]):
            continue
        box = [a[2], min(a[1], b[1]), b[0], max(a[3], b[3])]
        crop = pixels[box[1]:box[3], box[0]:box[2]]
        ink = float((crop < 180).mean()) if crop.size else 1
        gaps.append({"left": left, "right": right, "height": height, "box": box,
                     "gapRatio": gap / height, "inkFraction": ink})

    # A detector can retain an entire line across absent words. Public CTC
    # word boxes let the same geometric check inspect its internal spaces.
    for line in lines:
        i = line["index"]
        words = [(text, box) for text, box in zip(independent["text_word"][i], independent["text_word_boxes"][i]) if text.strip()]
        for j in range(1, len(words)):
            a, b = words[j - 1][1], words[j][1]
            height = min(a[3] - a[1], b[3] - b[1])
            if height <= 0 or (b[0] - a[2]) / height < 1.3:
                continue
            left = {**line, "text": "".join(text for text, _ in words[:j]), "box": a}
            right = {**line, "text": "".join(text for text, _ in words[j:]), "box": b}
            if not HAN.search(left["text"]) or not HAN.search(right["text"]):
                continue
            box = [a[2], min(a[1], b[1]), b[0], max(a[3], b[3])]
            crop = pixels[box[1]:box[3], box[0]:box[2]]
            gaps.append({"left": left, "right": right, "height": height, "box": box,
                         "gapRatio": (b[0] - a[2]) / height,
                         "inkFraction": float((crop < 180).mean()) if crop.size else 1})

    for gap in gaps:
        left, right, box, height = gap["left"], gap["right"], gap["box"], gap["height"]
        if not left["block"] or not right["block"] or left["block"]["block_id"] != right["block"]["block_id"]:
            continue
        # Visible formulae, answer rules and repeated aligned columns explain
        # apparent gaps. The remaining gap is a question for review, not proof
        # of missing text: deliberate word spacing can be indistinguishable.
        if gap["inkFraction"] > .01:
            continue
        aligned = any(other is not gap and abs(other["box"][0] - box[0]) < height * .4
                      and abs(other["box"][2] - box[2]) < height * .4
                      and height < abs(other["box"][1] - box[1]) < height * 6 for other in gaps)
        if aligned:
            continue
        issues.append({"code": "ocr-source-gap", "blockId": left["block"]["block_id"], "bbox": box,
                       "detail": "这行有较大留白，请对照原稿核对。",
                       "gapRatio": gap["gapRatio"], "inkFraction": gap["inkFraction"],
                       **gap_source_range(left["block"]["block_content"], left["text"], right["text"])})
    return issues
