import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

CLI = Path(__file__).with_name("cli.py")


class PracticeCLITest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / "test.sqlite3"
        self.env = {**os.environ, "SECURITIES_PRACTICE_DB": str(self.db)}

    def call(self, *args, data=None, ok=True):
        result = subprocess.run([sys.executable, str(CLI), *map(str, args)], env=self.env,
                                input=json.dumps(data, ensure_ascii=False) if data is not None else None,
                                text=True, capture_output=True)
        self.assertEqual(result.returncode == 0, ok, result.stderr)
        return json.loads(result.stdout if ok else result.stderr)

    def start(self):
        return self.call("start", "01")["attempt_id"]

    def answer(self, attempt, question, text):
        return self.call("answer", attempt, data={"question_id": question, "answer": text})

    def test_resume_validation_and_complete_lifecycle(self):
        attempt = self.start()
        next_question = self.call("next", attempt)
        self.assertEqual(next_question["next_question"]["id"], "roles")
        self.assertNotIn("reference", json.dumps(next_question))
        self.call("submit", attempt, ok=False)
        self.call("grade-input", attempt, ok=False)
        self.call("answer", attempt, data={"question_id": "roles", "answer": "  "}, ok=False)
        self.call("answer", attempt, data={"question_id": "ui", "answer": "out of order"}, ok=False)
        answer = "Minh bán; Hà mua.\n'$(không chạy)' — \"Hoa Nam\""
        self.answer(attempt, "roles", answer)
        self.assertEqual(self.call("next", attempt)["next_question"]["id"], "lifecycle")
        self.answer(attempt, "lifecycle", "Lệnh 100, khớp 40, thanh toán chờ.")
        self.answer(attempt, "roles", answer + " sửa")
        self.answer(attempt, "ui", "Không thể khẳng định mua đủ.")
        self.assertIsNone(self.call("next", attempt)["next_question"])
        self.call("submit", attempt)
        self.call("answer", attempt, data={"question_id": "roles", "answer": "x"}, ok=False)
        payload = self.call("grade-input", attempt)
        self.assertEqual(payload["questions"][0]["answer"], answer + " sửa")
        self.assertIn("reference", payload["questions"][0])
        grade = {"grader": "test", "summary": "Đánh giá thử", "criteria": [
            {"question_id": qid, "score": score, "evidence": "trích dẫn", "feedback": "nhận xét"}
            for qid, score in [("roles", 2), ("lifecycle", 1), ("ui", 2)]
        ]}
        self.assertFalse(self.call("save-grade", attempt, data=grade)["passed"])
        grade["criteria"][1]["score"] = 2
        self.assertTrue(self.call("save-grade", attempt, data=grade)["passed"])
        result = self.call("result", attempt)
        self.assertEqual(result["completion"], "đạt")
        self.assertEqual(len(result["evaluations"]), 2)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM responses").fetchone()[0], 3)

    def test_bad_grade_is_rejected_without_saving(self):
        attempt = self.start()
        for qid in ("roles", "lifecycle", "ui"):
            self.answer(attempt, qid, "Trả lời")
        self.call("submit", attempt)
        self.call("save-grade", attempt, data={"grader": "test", "criteria": [], "summary": "x"}, ok=False)
        self.assertEqual(self.call("result", attempt)["completion"], "chưa được chấm")

    def test_unknown_attempt_and_test(self):
        self.call("start", "02", ok=False)
        self.call("start", "../01", ok=False)
        self.call("next", 999, ok=False)

    def test_long_test_is_saved_and_can_be_submitted(self):
        progress = self.call("start", "01-long")
        attempt = progress["attempt_id"]
        self.assertEqual(progress["total"], 10)
        self.assertEqual(progress["test_id"], "01-long")
        self.assertNotIn("reference", json.dumps(progress))
        with sqlite3.connect(self.db) as db:
            snapshot = json.loads(db.execute("SELECT test_snapshot FROM attempts WHERE id = ?", (attempt,)).fetchone()[0])
        self.assertEqual(len(snapshot["questions"]), 10)
        for question in snapshot["questions"]:
            self.answer(attempt, question["id"], "Trả lời thử")
        self.call("submit", attempt)
        payload = self.call("grade-input", attempt)
        self.assertEqual(len(payload["questions"]), 10)
        grade = {"grader": "test", "summary": "Đánh giá thử", "criteria": [
            {"question_id": q["id"], "score": 2, "evidence": "trích dẫn", "feedback": "nhận xét"}
            for q in snapshot["questions"]
        ]}
        self.assertTrue(self.call("save-grade", attempt, data=grade)["passed"])

    def test_default_database_path_and_override(self):
        env = {**os.environ, "XDG_DATA_HOME": self.temp.name}
        env.pop("SECURITIES_PRACTICE_DB", None)
        code = "import sys; sys.path.insert(0, sys.argv[1]); import cli; print(cli.DB_PATH)"
        default = subprocess.check_output([sys.executable, "-c", code, str(CLI.parent)], env=env, text=True).strip()
        self.assertEqual(Path(default), CLI.parent / "practice.sqlite3")
        env["SECURITIES_PRACTICE_DB"] = str(self.db)
        override = subprocess.check_output([sys.executable, "-c", code, str(CLI.parent)], env=env, text=True).strip()
        self.assertEqual(Path(override), self.db)


if __name__ == "__main__":
    unittest.main()
