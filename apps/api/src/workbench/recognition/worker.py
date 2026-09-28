"""One offline page, using fixed local PaddleOCR models and public GPU warmup."""
import hashlib
import gc
import importlib.metadata
import json
import math
import re
import shutil
import sys
from pathlib import Path

REVISION = "paddleocr-vl-1.6/document-5"
MODELS = {
    "PP-DocLayoutV3": "7b48a7566925fa464281f930c58eee04fe2c862a",
    "PaddleOCR-VL-1.6": "c5630abae1d940eafe0697512a0325494b02ab42",
    "PP-OCRv5_mobile_det": "50446e5d01ac2a73d5319c89513281f6578414c888c602f9af13f93feefffc58",
    "PP-OCRv5_mobile_rec": "566b9512b34e34a9f0db54d87b51fa5a0b9ed2cf1ab7e49728cc0b8b5a64f414",
}
DEPENDENCIES = {"paddleocr": "3.7.0", "paddlex": "3.7.0", "paddlepaddle-gpu": "3.2.1"}
OUTPUT = Path("/output")


class InvalidInput(Exception):
    pass


class EnvironmentChanged(Exception):
    pass


def verify_environment(home):
    manifest = json.loads((home / "manifest.json").read_text())
    files = manifest.get("files", {})
    if (manifest.get("revision") != REVISION or manifest.get("models") != MODELS
            or not isinstance(files, dict) or "requirements.freeze.txt" not in files):
        raise EnvironmentChanged("Invalid runtime manifest")
    for name, expected in files.items():
        file = (home / name).resolve()
        if (not file.is_relative_to(home) or not file.is_file()
                or not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected)):
            raise EnvironmentChanged("Invalid manifest file")
        with file.open("rb") as stream:
            actual = hashlib.file_digest(stream, "sha256").hexdigest()
        if actual != expected:
            raise EnvironmentChanged("Runtime file digest mismatch")
    actual_models = {str(file.relative_to(home)) for file in (home / "models").rglob("*") if file.is_file()}
    if actual_models != {name for name in files if name.startswith("models/")}:
        raise EnvironmentChanged("Model inventory mismatch")
    if sys.version_info[:3] != (3, 12, 14):
        raise EnvironmentChanged("Python version mismatch")
    for name, expected in DEPENDENCIES.items():
        if importlib.metadata.version(name) != expected:
            raise EnvironmentChanged("Dependency version mismatch")


def pipeline_config(home):
    # Fixed local model configuration. Class 21 is table in PP-DocLayoutV3.
    return {
        "pipeline_name": "PaddleOCR-VL-1.6", "batch_size": 1, "use_queues": False,
        "use_doc_preprocessor": False, "use_layout_detection": True,
        "use_chart_recognition": False, "use_seal_recognition": False,
        "format_block_content": False, "merge_layout_blocks": True,
        "markdown_ignore_labels": ["number", "footnote", "header", "header_image", "footer", "footer_image", "aside_text"],
        "SubModules": {
            "LayoutDetection": {
                "module_name": "layout_detection", "model_name": "PP-DocLayoutV3",
                "model_dir": str(home / "models/PP-DocLayoutV3"), "batch_size": 1,
                "threshold": 0.3, "layout_nms": True, "layout_unclip_ratio": {21: [1.06, 1.06]},
                "layout_merge_bboxes_mode": {str(i): "large" if i in (3, 5, 6, 15, 17) else "union" for i in range(25)},
            },
            "VLRecognition": {
                "module_name": "vl_recognition", "model_name": "PaddleOCR-VL-1.6-0.9B",
                "model_dir": str(home / "models/PaddleOCR-VL-1.6"), "batch_size": 1,
                "genai_config": {"backend": "native"},
            },
        },
        "SubPipelines": {
            "DocPreprocessor": {
                "pipeline_name": "doc_preprocessor", "batch_size": 8,
                "use_doc_orientation_classify": False, "use_doc_unwarping": False,
                "SubModules": {
                    "DocOrientationClassify": {"module_name": "doc_text_orientation", "model_name": "PP-LCNet_x1_0_doc_ori", "model_dir": None, "batch_size": 8},
                    "DocUnwarping": {"module_name": "image_unwarping", "model_name": "UVDoc", "model_dir": None},
                },
            },
        },
        "Serving": {"extra": {"max_num_input_imgs": None}},
    }


def warmup(paddle):
    # Load the BF16 lookup kernel before layout/VLM handoff. Never patch a model.
    previous_device = paddle.device.get_device()
    paddle.device.set_device("gpu:0")
    try:
        indices = paddle.zeros([1, 1], dtype="int64")
        weight = paddle.zeros([1, 1024], dtype="bfloat16")
        paddle.device.synchronize("gpu:0")
        result = paddle.nn.functional.embedding(indices, weight)
        paddle.device.synchronize("gpu:0")
        del indices, weight, result
    finally:
        paddle.device.set_device(previous_device)


def contains(outer, inner):
    return outer[0] <= inner[0] and outer[1] <= inner[1] and outer[2] >= inner[2] and outer[3] >= inner[3]


def overlaps(a, b, axis):
    return min(a[axis + 2], b[axis + 2]) > max(a[axis], b[axis])


def crop_box(index, layout, width, height):
    import numpy as np
    from paddlex.inference.models.layout_analysis.processors import unclip_boxes

    original = layout[index]["coordinate"]
    x1, y1, x2, y2 = original
    expanded = unclip_boxes(np.array([[0, 1, *original]], dtype=float), (1.06, 1.06))[0, 2:].tolist()
    limits = [0, 0, width, height]
    ambiguous, containers, neighbors = [], [], []
    for other_index, other in enumerate(layout):
        if other_index == index:
            continue
        box = other["coordinate"]
        if contains(original, box):
            continue
        if contains(box, original):
            containers.append(other["label"])
            limits = [max(limits[0], box[0]), max(limits[1], box[1]),
                      min(limits[2], box[2]), min(limits[3], box[3])]
        elif overlaps(box, original, 0) and overlaps(box, original, 1):
            ambiguous.append(other_index)
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
    derived = original[:] if ambiguous else [
        max(math.floor(expanded[0]), math.ceil(limits[0])),
        max(math.floor(expanded[1]), math.ceil(limits[1])),
        min(math.ceil(expanded[2]), math.floor(limits[2])),
        min(math.ceil(expanded[3]), math.floor(limits[3])),
    ]
    if not contains(derived, original):
        raise ValueError("Derived crop must preserve original bounds")
    issues = []
    if ambiguous:
        issues.append({"code": "crop-overlap", "detail": "配图与其他版面区域重叠，保留原范围，请核对图像完整性和归属。"})
    if "table" in containers:
        issues.append({"code": "crop-cell-boundary-unknown", "detail": "表格内配图已保守扩边，可能包含单元格边线，请对照原页核查。"})
    return derived, issues


def derive_assets(raw, page, output=OUTPUT):
    import numpy as np
    from PIL import Image
    from paddlex.inference.pipelines.components.common.crop_image_regions import CropByBoxes
    from paddlex.inference.pipelines.layout_parsing.utils import construct_img_path

    layout = raw["layout_det_res"]["boxes"]
    by_name = {construct_img_path(box["label"], box["coordinate"]): i for i, box in enumerate(layout)}
    assets, originals, derivations = [], [], []
    pixel_array = np.asarray(page)
    crop = CropByBoxes()
    images = output / "imgs"
    for original_file in sorted(images.iterdir() if images.exists() else []):
        if not original_file.is_file():
            continue
        name = str(original_file.relative_to(output))
        if name not in by_name:
            raise ValueError("Image has no source region")
        index = by_name[name]
        original = layout[index]
        bbox = original["coordinate"]
        derived, issues = crop_box(index, layout, page.width, page.height)
        original_target = output / "originals" / name
        original_target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original_file, original_target)
        originals.append({"name": name, "file": str(original_target.relative_to(output))})
        metadata = {**original, "coordinate": derived}
        pixels = crop(pixel_array, [metadata], "rect")[0]["img"]
        target = output / "derived" / Path(name).with_suffix(".png")
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(pixels).save(target, format="PNG")
        # Name is the model reference key; bytes are independently sniffed as PNG.
        assets.append({"name": name, "file": str(target.relative_to(output))})
        derivations.append({
            "name": name, "method": "source-rectangle-1.06", "layoutIndex": index,
            "originalBbox": bbox, "originalPolygon": original.get("polygon_points"),
            "derivedBbox": derived, "mediaType": "image/png", "issues": issues,
        })
    return assets, originals, derivations


def main():
    home = Path(sys.argv[1]).resolve()
    try:
        verify_environment(home)
    except Exception as error:
        raise EnvironmentChanged("Runtime verification failed") from error
    from PIL import Image
    request = json.loads(Path("/input/request.json").read_text())
    try:
        with Image.open("/input/page.png") as image:
            if image.size != (request["width"], request["height"]):
                raise InvalidInput("Input image dimensions mismatch")
            page = image.convert("RGB")
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise InvalidInput("Input image cannot be decoded") from error
    import paddle
    from paddleocr import PaddleOCRVL, PaddleOCR
    from content_check import content_issues
    if paddle.version.cuda() != "12.9":
        raise EnvironmentChanged("Paddle CUDA runtime version mismatch")
    pipeline = PaddleOCRVL(pipeline_version="v1.6", paddlex_config=pipeline_config(home), device="gpu:0")
    warmup(paddle)
    count = 0
    # Bound visual attention memory on the fixed 8 GiB GPU. This public VLM
    # setting leaves the source image, layout coordinates and derived crops intact.
    # Rectangular crops make table expansion effective; polygon masks would
    # otherwise erase the extra border and truncate edge text.
    for result in pipeline.predict_iter("/input/page.png", max_pixels=802816, layout_shape_mode="rect"):
        result.save_to_json(str(OUTPUT))
        result.save_to_markdown(str(OUTPUT))
        count += 1
    if count != 1:
        raise ValueError("Expected exactly one complete page")
    (OUTPUT / "page_res.json").rename(OUTPUT / "raw.json")
    raw = json.loads((OUTPUT / "raw.json").read_text())
    if (raw["width"], raw["height"]) != page.size:
        raise ValueError("Output coordinates do not match source pixels")
    assets, originals, derivations = derive_assets(raw, page)
    # Release the GPU recognizer before the independent CPU pass. These are
    # public pipeline calls; decoder methods and model weights stay untouched.
    del pipeline, result
    gc.collect()
    paddle.device.cuda.empty_cache()
    verifier = PaddleOCR(
        ocr_version="PP-OCRv5", device="cpu", cpu_threads=2, enable_mkldnn=False,
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_detection_model_dir=str(home / "models/PP-OCRv5_mobile_det"),
        text_recognition_model_name="PP-OCRv5_mobile_rec",
        text_recognition_model_dir=str(home / "models/PP-OCRv5_mobile_rec"),
        use_doc_orientation_classify=False, use_doc_unwarping=False,
        use_textline_orientation=False, text_recognition_batch_size=1,
        text_det_limit_side_len=960, text_det_limit_type="max",
        text_rec_score_thresh=0.0, return_word_box=True,
    )
    checks = list(verifier.predict("/input/page.png"))
    if len(checks) != 1:
        raise ValueError("Expected one independent recognition page")
    checks[0].save_to_json(str(OUTPUT / "content-check.json"))
    independent = json.loads((OUTPUT / "content-check.json").read_text())
    raw["content_check"] = {"revision": "pp-ocrv5-mobile/content-check-2", "raw": independent,
                            "issues": content_issues(raw, independent, page)}
    (OUTPUT / "raw.json").write_text(json.dumps(raw, ensure_ascii=False))
    output = {"width": page.width, "height": page.height, "assets": assets,
              "originalAssets": originals, "derivations": derivations}
    (OUTPUT / "result.tmp.json").write_text(json.dumps(output, ensure_ascii=False))
    (OUTPUT / "result.tmp.json").rename(OUTPUT / "result.json")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        code = ("recognition-invalid-input" if isinstance(error, InvalidInput) else
                "recognition-environment-changed" if isinstance(error, EnvironmentChanged) else
                "recognition-invalid-output" if isinstance(error, (KeyError, ValueError)) else
                "recognition-failed")
        (OUTPUT / "failure.json").write_text(json.dumps({"code": code}))
        raise
