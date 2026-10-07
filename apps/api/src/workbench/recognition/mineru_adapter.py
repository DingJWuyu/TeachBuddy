"""Version-bound MinerU capture and lossless source-page asset adaptation.

The two hooks only capture metadata absent from public exports. They call the
original official function once and do not change recognition or image bytes.
"""
import base64
import json
import math
import re
import traceback
from html.parser import HTMLParser
from pathlib import Path

TRACE = "_teacherworkspace_layout_source"


def plain(value):
    if hasattr(value, "tolist"):
        return value.tolist()
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if isinstance(value, Path):
        return str(value)
    raise TypeError(f"Unsupported capture value: {type(value).__name__}")


def snapshot(value):
    return json.loads(json.dumps(value, default=plain, ensure_ascii=False))


class ImageReferences(HTMLParser):
    def __init__(self, markup):
        super().__init__(convert_charrefs=True)
        self.sources = []
        self.feed(markup)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag == "img":
            values = [value for name, value in attrs if name == "src"]
            if len(values) != 1 or not values[0]:
                raise ValueError("Image lacks unambiguous source")
            self.sources.append(values[0])

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)


def children(block):
    return block.get("content", []) if isinstance(block.get("content"), list) else []


def walk(blocks):
    for block in blocks:
        yield block
        yield from walk(children(block))


def contains(outer, inner):
    return outer[0] <= inner[0] and outer[1] <= inner[1] and outer[2] >= inner[2] and outer[3] >= inner[3]


def overlaps(a, b, axis):
    return min(a[axis + 2], b[axis + 2]) > max(a[axis], b[axis])


def crop_box(source_index, layout, layout_size, page_size):
    # Preserve the prior conservative 6% expansion, parent bounds and neighbor
    # constraints. Only Pillow crops the trusted request PNG; no polygon mask,
    # JPEG transcoding, rotation or resampling enters the editable document.
    sx, sy = page_size[0] / layout_size[0], page_size[1] / layout_size[1]
    boxes = [[v * (sx if i % 2 == 0 else sy) for i, v in enumerate(item["bbox"])] for item in layout]
    original = boxes[source_index]
    x1, y1, x2, y2 = original
    dx, dy = (x2 - x1) * 0.03, (y2 - y1) * 0.03
    expanded = [x1 - dx, y1 - dy, x2 + dx, y2 + dy]
    limits = [0, 0, *page_size]
    ambiguous, containers, neighbors = [], [], []
    for index, (item, box) in enumerate(zip(layout, boxes)):
        if index == source_index or contains(original, box):
            continue
        if contains(box, original):
            containers.append(item.get("label"))
            limits = [max(limits[0], box[0]), max(limits[1], box[1]), min(limits[2], box[2]), min(limits[3], box[3])]
        elif overlaps(box, original, 0) and overlaps(box, original, 1):
            ambiguous.append(index)
        else:
            neighbors.append(box)
    for box in neighbors:
        if overlaps(box, expanded, 0):
            if box[3] <= y1:
                limits[1] = max(limits[1], (box[3] + y1) / 2)
            if box[1] >= y2:
                limits[3] = min(limits[3], (box[1] + y2) / 2)
        if overlaps(box, expanded, 1):
            if box[2] <= x1:
                limits[0] = max(limits[0], (box[2] + x1) / 2)
            if box[0] >= x2:
                limits[2] = min(limits[2], (box[0] + x2) / 2)
    # A fractional detection touching a parent must still be outward-rounded;
    # rounding parent inward must never clip actual detected source pixels.
    original_pixels = [math.floor(x1), math.floor(y1), math.ceil(x2), math.ceil(y2)]
    derived = original_pixels if ambiguous else [max(math.floor(expanded[0]), math.floor(limits[0])),
        max(math.floor(expanded[1]), math.floor(limits[1])), min(math.ceil(expanded[2]), math.ceil(limits[2])),
        min(math.ceil(expanded[3]), math.ceil(limits[3]))]
    derived = [max(0, derived[0]), max(0, derived[1]), min(page_size[0], derived[2]), min(page_size[1], derived[3])]
    if not contains(derived, original_pixels) or derived[2] <= derived[0] or derived[3] <= derived[1]:
        raise ValueError("Derived crop does not preserve source bounds")
    issues = []
    if ambiguous:
        issues.append({"code": "crop-overlap", "detail": "配图与其他版面区域重叠，保留原范围，请核对图像完整性和归属。"})
    if "table" in containers:
        issues.append({"code": "crop-cell-boundary-unknown", "detail": "表格内配图已保守扩边，可能包含单元格边线，请对照原页核查。"})
    return original, derived, issues


class FixedMinerU:
    def __init__(self, prompts):
        self.capture = None
        self._install_hooks(prompts)
        from mineru import MinerUParser
        from mineru.config import VlmConfig
        self.parser = MinerUParser(tier="standard", parse_mode="ocr", image_analysis=True,
            vlm_config=VlmConfig(engine="llama-cpp", server_url="http://127.0.0.1:8112/v1", model="mineru-2605", max_concurrency=1))

    def _install_hooks(self, prompts):
        import inspect
        import onnxruntime as ort
        import mineru.backend.analysis.pdf.window as window
        from mineru.backend.analysis.pdf.layout import _layout_item_to_content_block
        import mineru.model.vlm.runtime as runtime
        import mineru_vl_utils.mineru_client as client_module
        from mineru_vl_utils.mineru_client import DEFAULT_PROMPTS
        from mineru_vl_utils.post_process.otsl2html import convert_otsl_to_html
        from mineru_vl_utils.post_process import table_image_processor
        from mineru_vl_utils.vlm_client.http_client import HttpVlmClient
        adapter = self
        # Same bytes/font as the frozen run; do not let another host's Arial
        # installation change the official placeholder rasterization.
        table_image_processor.FONT_PATH_CANDIDATES[:] = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
        original_layout = window._build_vl_style_layout_blocks
        original_mask = client_module.mask_and_encode_table_image
        if (list(inspect.signature(original_layout).parameters) != ["images_layout_res", "images_pil_list"] or
            list(inspect.signature(original_mask).parameters) != ["page_image", "table_block", "image_entries", "table_image"]):
            raise ValueError("Fixed metadata capture signature changed")

        def capture_layout(images_layout_res, images_pil_list):
            result = original_layout(images_layout_res, images_pil_list)
            if adapter.capture is None or len(images_layout_res) != 1 or len(result) != 1:
                raise ValueError("Expected one active layout page")
            size = list(images_pil_list[0].size)
            original = snapshot(images_layout_res[0])
            sources = [index for index, item in enumerate(images_layout_res[0])
                       if _layout_item_to_content_block(item, tuple(size)) is not None]
            if len(sources) != len(result[0]):
                raise ValueError("Layout capture cardinality mismatch")
            for block, source in zip(result[0], sources):
                block[TRACE] = source
            adapter.capture["layouts"].append({"layout": original, "size": size, "contentBlocks": snapshot(result[0])})
            return result
        window._build_vl_style_layout_blocks = capture_layout

        def capture_mask(page_image, table_block, image_entries, table_image):
            result = original_mask(page_image, table_block, image_entries, table_image)
            width, height = page_image.size
            x0, y0 = int(table_block.bbox[0] * width), int(table_block.bbox[1] * height)
            valid = []
            for image_index, block in image_entries:
                x1, y1, x2, y2 = [v * (width if i % 2 == 0 else height) for i, v in enumerate(block.bbox)]
                rect = [int(max(0, x1 - x0)), int(max(0, y1 - y0)),
                        int(min(table_image.width, x2 - x0)), int(min(table_image.height, y2 - y0))]
                if rect[2] <= rect[0] or rect[3] <= rect[1] or int(x2) <= int(x1) or int(y2) <= int(y1):
                    continue
                if TRACE not in block:
                    raise ValueError("Table image lacks layout provenance")
                valid.append({"imageIndex": image_index, "sourceIndex": block[TRACE], "contentBlock": snapshot(block)})
            if len(valid) != len(result[1]) or TRACE not in table_block:
                raise ValueError("Table token provenance cardinality mismatch")
            links = [{"token": token, "dataUri": uri, **entry} for (token, uri), entry in zip(result[1].items(), valid)]
            adapter.capture["tableImages"].append({"tableSourceIndex": table_block[TRACE], "table": snapshot(table_block),
                                                 "imageSize": list(page_image.size), "links": links})
            return result
        client_module.mask_and_encode_table_image = capture_mask

        class CapturingClient(runtime.MinerUClient):
            def __init__(self, *args, **kwargs):
                kwargs["prompts"] = {**DEFAULT_PROMPTS, **prompts}
                super().__init__(*args, **kwargs)

        # In this fixed version these methods live on the client's helper;
        # both sync and async entry points dispatch through that same helper.
        class CapturingHelper(client_module.MinerUClientHelper):
            def prepare_for_extract(self, image, blocks, *args, **kwargs):
                adapter.capture["beforeExtract"].append({"imageSize": list(image.size), "blocks": snapshot(blocks)})
                return super().prepare_for_extract(image, blocks, *args, **kwargs)

            def post_process(self, blocks):
                before = snapshot(blocks)
                tables = []
                for block in before:
                    if block["type"] != "table":
                        continue
                    token_map = block.get("_table_image_token_map", {})
                    markup = convert_otsl_to_html(block.get("content") or "")
                    occurrences = []
                    for token in token_map:
                        pattern = r"\[\s*" + re.escape(token[1:-1]) + r"\s*\]"
                        occurrences.extend((match.start(), token) for match in re.finditer(pattern, markup))
                    occurrences.sort()
                    tables.append({"sourceIndex": block.get(TRACE), "rawContent": block.get("content"),
                                   "tokenOrder": [token for _, token in occurrences], "tokenMap": token_map})
                result = super().post_process(blocks)
                after = snapshot(result)
                for table in tables:
                    matches = [block for block in after if block.get(TRACE) == table["sourceIndex"] and block["type"] == "table"]
                    if len(matches) != 1:
                        raise ValueError("Table postprocess provenance ambiguous")
                    table["html"] = matches[0].get("content") or ""
                    expected = [table["tokenMap"][token] for token in table["tokenOrder"]]
                    if ImageReferences(table["html"]).sources != expected:
                        raise ValueError("Table HTML token occurrence mismatch")
                adapter.capture["postprocess"].append({"before": before, "after": after, "tables": tables})
                return result
        client_module.MinerUClientHelper = CapturingHelper
        runtime.MinerUClient = CapturingClient

        original_response = HttpVlmClient.get_response_data
        def capture_response(client, response):
            adapter.capture["http"].append({"status": response.status_code,
                "request": response.request.content.decode("utf-8"), "response": response.content.decode("utf-8")})
            return original_response(client, response)
        HttpVlmClient.get_response_data = capture_response

        original_session = ort.InferenceSession
        class CpuSession(original_session):
            def __init__(self, path_or_bytes, sess_options=None, providers=None, **kwargs):
                options = sess_options or ort.SessionOptions()
                options.intra_op_num_threads = 2
                options.inter_op_num_threads = 1
                super().__init__(path_or_bytes, sess_options=options, providers=["CPUExecutionProvider"], **kwargs)
                if self.get_providers() != ["CPUExecutionProvider"]:
                    raise ValueError("Unexpected ONNX provider")
                if adapter.capture is not None:
                    adapter.capture["onnxSessions"].append({"model": Path(str(path_or_bytes)).name,
                        "providers": self.get_providers(), "intraOp": 2, "interOp": 1})
        ort.InferenceSession = CpuSession

    def parse(self, source, output, request):
        from PIL import Image
        from mineru.parser.writer import FileBasedDataWriter
        self.capture = {"layouts": [], "tableImages": [], "beforeExtract": [], "postprocess": [], "http": [], "onnxSessions": []}
        raw = {"engine": "MinerUStandardPro2605Q8", "request": request, "capture": self.capture}
        try:
            with Image.open(source) as opened:
                if opened.format != "PNG" or opened.size != (request["width"], request["height"]):
                    raise ValueError("Source is not the requested PNG")
                page = opened.copy()
            result = self.parser.parse(source)
            result.save(FileBasedDataWriter(str(output)))
            middle = json.loads((output / "middle_json.json").read_text())
            model = json.loads((output / "model_output.json").read_text())
            raw.update(middle=middle, modelOutput=model,
                       structuredContent=json.loads((output / "structured_content.json").read_text()))
            if len(middle.get("pages", [])) != 1:
                raise ValueError("Expected one materialized page")
            page_blocks = middle["pages"][0]["blocks"]
            assets, originals, derivations = self._assets(page, page_blocks, output)
            return {"pageBlocks": page_blocks, "assets": assets, "originalAssets": originals, "derivations": derivations}
        except Exception as error:
            raw['failure'] = {'type': type(error).__name__, 'detail': str(error), 'traceback': traceback.format_exc()}
            raise
        finally:
            # Failed provenance remains inspectable without a complete marker.
            (output / "raw.json").write_text(json.dumps(raw, ensure_ascii=False, default=plain))
            self.capture = None

    def _assets(self, page, page_blocks, output):
        if len(self.capture["layouts"]) != 1 or len(self.capture["postprocess"]) != 1:
            raise ValueError("Missing unique source layout")
        layout = self.capture["layouts"][0]
        stage = self.capture["postprocess"][0]
        assets, originals, derivations = [], [], []
        linked_names = {}
        source_links = []
        # Full original official image inventory includes formula and table
        # screenshots. They are immutable evidence, never document images.
        for file in sorted((output / "images").rglob("*")) if (output / "images").exists() else []:
            if file.is_file():
                name = file.relative_to(output).as_posix()
                originals.append({"name": name, "file": name, "role": "evidence"})
        def derive(name, source_index, token=None, table_source_index=None):
            if name in linked_names:
                previous = linked_names[name]
                if previous['sourceIndex'] != source_index:
                    raise ValueError("Materialized path has conflicting source locations")
                # Repeated references to one proven source keep every Document
                # occurrence while storing the exact crop only once.
                source_links.append({**previous['sourceLink'], 'token': token,
                                     'tableSourceIndex': table_source_index, 'reusedAsset': True})
                return
            source = layout["layout"][source_index]
            original, derived, issues = crop_box(source_index, layout["layout"], layout["size"], page.size)
            file = f"derived/{len(assets):04d}.png"
            (output / "derived").mkdir(exist_ok=True)
            page.crop(tuple(derived)).save(output / file, format="PNG")
            metadata = {"layoutSourceIndex": source_index, "layoutBbox": source["bbox"],
                "layoutSize": layout["size"], "pageSize": list(page.size), "angle": source.get("angle", 0),
                "coordinateTransform": "layout-pixels / layout-size * request-png-size", "token": token,
                "tableSourceIndex": table_source_index}
            assets.append({"name": name, "file": file, "bbox": derived, "role": "body-image", "source": metadata})
            derivations.append({"name": name, "originalAssetName": name, "originalBbox": original,
                "derivedBbox": derived, "mediaType": "image/png", "source": metadata, "issues": issues})
            link = {"assetPath": name, "derivedPath": file, **metadata}
            source_links.append(link)
            linked_names[name] = {'sourceIndex': source_index, 'sourceLink': link}
        def post_block(block):
            matches = [item for item in stage["after"] if item["type"] == block["type"] and item["bbox"] == block["bbox"]]
            if len(matches) != 1 or TRACE not in matches[0]:
                raise ValueError("Materialized visual source is not unique")
            return matches[0]
        for block in walk(page_blocks):
            if block["type"] in ('image', 'chart'):
                origin = post_block(block)
                bodies = [child for child in children(block) if child["type"] == block['type'] + '_body']
                if len(bodies) != 1 or not bodies[0].get("image_path"):
                    raise ValueError("Image body missing materialized source")
                derive(bodies[0]["image_path"], origin[TRACE])
            if block["type"] != "table":
                continue
            origin = post_block(block)
            tables = [table for table in stage["tables"] if table["sourceIndex"] == origin[TRACE]]
            captures = [table for table in self.capture["tableImages"] if table["tableSourceIndex"] == origin[TRACE]]
            if len(tables) != 1 or len(captures) != 1:
                raise ValueError("Missing table capture provenance")
            table, captured = tables[0], captures[0]
            bodies = [child for child in children(block) if child["type"] == "table_body"]
            if len(bodies) != 1:
                raise ValueError("Missing materialized table body")
            paths = ImageReferences(bodies[0]["content"]).sources
            if len(paths) != len(table["tokenOrder"]):
                raise ValueError("Materialized table image count mismatch")
            links = {link["token"]: link for link in captured["links"]}
            for path, token in zip(paths, table["tokenOrder"]):
                if token not in links:
                    raise ValueError("Unknown table image token")
                link = links[token]
                actual = (output / path).read_bytes()
                expected = base64.b64decode(link["dataUri"].split(",", 1)[1], validate=True)
                if actual != expected:
                    raise ValueError("Materialized image changed source bytes")
                derive(path, link["sourceIndex"], token, origin[TRACE])
            for token, link in links.items():
                if token in table["tokenOrder"]:
                    continue
                # A model-omitted placeholder has no proven cell. Preserve its
                # source crop at page end with the existing unassigned issue.
                name = f"images/unassigned_source_{origin[TRACE]}_{link['sourceIndex']}.jpg"
                payload = base64.b64decode(link["dataUri"].split(",", 1)[1], validate=True)
                (output / name).write_bytes(payload)
                originals.append({"name": name, "file": name, "role": "evidence"})
                derive(name, link["sourceIndex"], token, origin[TRACE])
        self.capture["assetSources"] = source_links
        return assets, originals, derivations
