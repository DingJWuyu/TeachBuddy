"""Offline raw-page regression. Run with the fixed OCR profile's Python; no models."""
import importlib.util
from pathlib import Path
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location(
    "content_check", Path(__file__).resolve().parents[1] / "src/workbench/recognition/content_check.py")
rule = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rule)


class RawPageAlignment(unittest.TestCase):
    def check_page(self, source, observed):
        primary = {"parsing_res_list": [{"block_id": 0, "block_label": "text",
                   "block_content": source, "block_bbox": [0, 0, 300, 100]}]}
        independent = {"rec_texts": observed, "rec_scores": [1, 1],
                       "rec_boxes": [[0, 0, 280, 30], [0, 60, 280, 90]],
                       "text_word": [[], []], "text_word_boxes": [[], []]}
        return rule.content_issues(primary, independent, Image.new("RGB", (300, 100), "white"))

    def test_correct_repeated_wording_does_not_compare_different_questions(self):
        source = "1.已知x=3，求x的值。\n2.已知x=4，求x的值。"
        self.assertEqual(self.check_page(source, source.splitlines()), [])

    def test_ambiguous_changed_wording_does_not_guess_a_question(self):
        source = "1.已知x=3，求x的值。\n2.已知x=4，求x的值。"
        self.assertEqual(self.check_page(source, ["1.已知x=3，求x的值。", "2.已知x=8，求x的值。"]), [])

    def test_unique_second_line_keeps_its_source_range_and_image_location(self):
        source = "1.计算长方形面积。\n2.已知x=4，求x的值。"
        issues = self.check_page(source, ["1.计算长方形面积。", "2.已知x=8，求x的值。"])
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["bbox"], [0, 60, 280, 90])
        self.assertGreater(issues[0]["sourceStart"], source.index("\n"))
        self.assertEqual(issues[0]["primaryText"], "x=4，")
        self.assertEqual(issues[0]["independentText"], "x=8，")


if __name__ == "__main__":
    unittest.main()
