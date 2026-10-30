#!/usr/bin/env python3
"""Local practice storage. Input and output use UTF-8 JSON; no AI calls."""

import argparse
import json
import os
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "practice.sqlite3"
DB_PATH = Path(os.environ.get("SECURITIES_PRACTICE_DB", DEFAULT_DB)).expanduser()


def fail(message):
    raise ValueError(message)


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY, test_id TEXT NOT NULL, version INTEGER NOT NULL,
            test_snapshot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'in_progress'
                CHECK(status IN ('in_progress', 'submitted')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, submitted_at TEXT
        );
        CREATE TABLE IF NOT EXISTS responses (
            attempt_id INTEGER NOT NULL REFERENCES attempts(id), question_id TEXT NOT NULL,
            answer TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (attempt_id, question_id)
        );
        CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY, attempt_id INTEGER NOT NULL REFERENCES attempts(id),
            grader TEXT NOT NULL, result_json TEXT NOT NULL, passed INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    """)
    return db


def attempt(db, attempt_id):
    row = db.execute("SELECT * FROM attempts WHERE id = ?", (attempt_id,)).fetchone()
    if row is None:
        fail("Không tìm thấy lượt làm bài.")
    return row, json.loads(row["test_snapshot"])


def response_map(db, attempt_id):
    return {r["question_id"]: r["answer"] for r in db.execute(
        "SELECT question_id, answer FROM responses WHERE attempt_id = ?", (attempt_id,)
    )}


def public_progress(db, row, test):
    responses = response_map(db, row["id"])
    missing = [q for q in test["questions"] if q["id"] not in responses]
    question = missing[0] if missing and row["status"] == "in_progress" else None
    return {
        "attempt_id": row["id"], "test_id": row["test_id"], "version": row["version"],
        "title": test["title"], "status": row["status"], "answered": len(responses),
        "total": len(test["questions"]), "scenario": test["scenario"],
        "next_question": ({"id": question["id"], "number": test["questions"].index(question) + 1,
                           "prompt": question["prompt"]} if question else None),
    }


def read_json_input():
    try:
        value = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError):
        fail("Dữ liệu stdin phải là JSON UTF-8 hợp lệ.")
    if not isinstance(value, dict):
        fail("Dữ liệu stdin phải là một JSON object.")
    return value


def grade_input(db, row, test):
    if row["status"] != "submitted":
        fail("Chỉ được chấm bài đã nộp.")
    responses = response_map(db, row["id"])
    if any(q["id"] not in responses for q in test["questions"]):
        fail("Bài nộp thiếu câu trả lời.")
    return {
        "attempt_id": row["id"], "test_id": row["test_id"], "version": row["version"],
        "scenario": test["scenario"],
        "questions": [{**q, "answer": responses[q["id"]]} for q in test["questions"]],
        "scoring": "Mỗi tiêu chí 0, 1 hoặc 2; tất cả phải đạt 2 để hoàn thành.",
    }


def validate_evaluation(value, test):
    grader = value.get("grader")
    if not isinstance(grader, str) or not grader.strip():
        fail("Cần ghi rõ model hoặc người chấm trong grader; không đoán tên model.")
    items = value.get("criteria")
    if not isinstance(items, list) or len(items) != len(test["questions"]):
        fail("Cần đúng một kết quả cho mỗi câu hỏi.")
    expected = {q["id"] for q in test["questions"]}
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            fail("Mỗi tiêu chí phải là object.")
        qid = item.get("question_id")
        if qid not in expected or qid in seen:
            fail("question_id không hợp lệ hoặc bị lặp.")
        seen.add(qid)
        if type(item.get("score")) is not int or item["score"] not in (0, 1, 2):
            fail("Điểm mỗi tiêu chí phải là số nguyên 0, 1 hoặc 2.")
        for field in ("evidence", "feedback"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                fail(f"Cần {field} cho mỗi tiêu chí.")
    if not isinstance(value.get("summary"), str) or not value["summary"].strip():
        fail("Cần summary cho bài đánh giá.")
    return grader.strip(), all(item["score"] == 2 for item in items)


def run(args, db, input_value=None):
    if args.action == "start":
        if args.test_id != "01":
            fail("Bản thử nghiệm hiện chỉ hỗ trợ buổi 01.")
        test = json.loads((ROOT / "tests/01-v1.json").read_text(encoding="utf-8"))
        with db:
            cursor = db.execute("INSERT INTO attempts(test_id, version, test_snapshot) VALUES (?, ?, ?)",
                                (test["test_id"], test["version"], json.dumps(test, ensure_ascii=False)))
        row, test = attempt(db, cursor.lastrowid)
        return public_progress(db, row, test)

    row, test = attempt(db, args.attempt_id)
    if args.action == "next":
        return public_progress(db, row, test)
    if args.action == "answer":
        value = read_json_input() if input_value is None else input_value
        answer, qid = value.get("answer"), value.get("question_id")
        if not isinstance(answer, str) or not answer.strip():
            fail("Câu trả lời không được để trống.")
        with db:
            db.execute("BEGIN IMMEDIATE")
            current, test = attempt(db, args.attempt_id)
            if current["status"] != "in_progress":
                fail("Bài đã nộp, không thể sửa câu trả lời.")
            if not isinstance(qid, str) or qid not in {q["id"] for q in test["questions"]}:
                fail("Câu hỏi không thuộc bài này.")
            existing = response_map(db, args.attempt_id)
            missing = [q["id"] for q in test["questions"] if q["id"] not in existing]
            if qid not in existing and (not missing or qid != missing[0]):
                fail("Phải trả lời lần lượt; chỉ có thể sửa câu đã trả lời hoặc trả lời câu tiếp theo.")
            db.execute("""INSERT INTO responses(attempt_id, question_id, answer) VALUES (?, ?, ?)
                          ON CONFLICT(attempt_id, question_id) DO UPDATE SET
                          answer = excluded.answer, updated_at = CURRENT_TIMESTAMP""",
                       (args.attempt_id, qid, answer))
        row, test = attempt(db, args.attempt_id)
        return public_progress(db, row, test)
    if args.action == "submit":
        with db:
            db.execute("BEGIN IMMEDIATE")
            row, test = attempt(db, args.attempt_id)
            if row["status"] != "in_progress":
                fail("Bài đã được nộp.")
            answers = response_map(db, args.attempt_id)
            if any(q["id"] not in answers for q in test["questions"]):
                fail("Chưa trả lời đủ câu hỏi.")
            db.execute("UPDATE attempts SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?", (args.attempt_id,))
        row, test = attempt(db, args.attempt_id)
        return public_progress(db, row, test)
    if args.action == "grade-input":
        return grade_input(db, row, test)
    if args.action == "save-grade":
        grade_input(db, row, test)
        value = read_json_input() if input_value is None else input_value
        grader, passed = validate_evaluation(value, test)
        with db:
            cursor = db.execute("INSERT INTO evaluations(attempt_id, grader, result_json, passed) VALUES (?, ?, ?, ?)",
                                (args.attempt_id, grader, json.dumps(value, ensure_ascii=False), int(passed)))
        return {"attempt_id": args.attempt_id, "evaluation_id": cursor.lastrowid, "passed": passed,
                "status": "đạt" if passed else "cần củng cố"}
    if args.action == "result":
        evaluations = []
        for e in db.execute("SELECT * FROM evaluations WHERE attempt_id = ? ORDER BY id", (args.attempt_id,)):
            evaluations.append({"evaluation_id": e["id"], "grader": e["grader"], "passed": bool(e["passed"]),
                                "created_at": e["created_at"], "result": json.loads(e["result_json"])})
        return {**public_progress(db, row, test), "evaluations": evaluations,
                "completion": ("đạt" if evaluations[-1]["passed"] else "cần củng cố") if evaluations else "chưa được chấm"}
    fail("Lệnh không hợp lệ.")


def main():
    parser = argparse.ArgumentParser(description="Quản lý bài tập tự luận trong SQLite")
    subs = parser.add_subparsers(dest="action", required=True)
    start = subs.add_parser("start")
    start.add_argument("test_id")
    for action in ("next", "answer", "submit", "grade-input", "save-grade", "result"):
        command = subs.add_parser(action)
        command.add_argument("attempt_id", type=int)
    args = parser.parse_args()
    try:
        with connect() as db:
            result = run(args, db)
        print(json.dumps(result, ensure_ascii=False))
    except (ValueError, OSError, sqlite3.Error) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
