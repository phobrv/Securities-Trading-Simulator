#!/usr/bin/env python3
"""Read-only local HTTP view of the practice database."""

import argparse
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import sqlite3
from urllib.parse import urlsplit

from cli import DB_PATH


def connect_readonly(path=DB_PATH):
    if not path.is_file():
        raise FileNotFoundError("Chưa có database luyện tập. Kiểm tra đường dẫn hoặc bắt đầu /practice 01 trong OpenCode.")
    db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)
    db.row_factory = sqlite3.Row
    return db


def serialize(db, row, detail=False):
    test = json.loads(row["test_snapshot"])
    responses = {r["question_id"]: dict(r) for r in db.execute(
        "SELECT question_id, answer, updated_at FROM responses WHERE attempt_id = ?", (row["id"],))}
    evaluations = [{"id": e["id"], "grader": e["grader"], "passed": bool(e["passed"]),
                    "created_at": e["created_at"], "result": json.loads(e["result_json"])}
                   for e in db.execute("SELECT * FROM evaluations WHERE attempt_id = ? ORDER BY id DESC", (row["id"],))]
    total, answered = len(test["questions"]), len(responses)
    if row["status"] == "in_progress":
        status = "ready" if answered == total else "in_progress"
    elif not evaluations:
        status = "awaiting_grade"
    else:
        status = "passed" if evaluations[0]["passed"] else "needs_review"
    latest_update = max([row["created_at"], row["submitted_at"] or ""] +
                        [r["updated_at"] for r in responses.values()] +
                        [e["created_at"] for e in evaluations])
    result = {"id": row["id"], "test_id": row["test_id"], "version": row["version"],
              "title": test["title"], "status": status, "answered": answered, "total": total,
              "created_at": row["created_at"], "updated_at": latest_update,
              "submitted_at": row["submitted_at"], "evaluations_count": len(evaluations)}
    if detail:
        # Only expose already answered questions during a live attempt.
        result["scenario"] = test["scenario"]
        result["questions"] = [
            {"id": q["id"], "number": i + 1,
             "prompt": q["prompt"] if row["status"] == "submitted" or q["id"] in responses else None,
             "answer": responses[q["id"]]["answer"] if q["id"] in responses else None,
             "updated_at": responses[q["id"]]["updated_at"] if q["id"] in responses else None}
            for i, q in enumerate(test["questions"])]
        result["evaluations"] = evaluations
    return result


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        # Vite forwards a fixed local Host. Do not permit DNS rebinding or simple cross-origin requests.
        if self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}" or self.headers.get("X-Practice-Client") != "p-docs":
            return self.reply(403, {"error": "Yêu cầu không được phép."})
        path = urlsplit(self.path).path
        if path != "/api/practice/attempts" and not re.fullmatch(r"/api/practice/attempts/[1-9][0-9]*", path):
            return self.reply(404, {"error": "Không tìm thấy đường dẫn."})
        try:
            with closing(connect_readonly()) as db:
                if path == "/api/practice/attempts":
                    rows = db.execute("SELECT * FROM attempts ORDER BY id DESC").fetchall()
                    return self.reply(200, {"attempts": [serialize(db, row) for row in rows]})
                row = db.execute("SELECT * FROM attempts WHERE id = ?", (int(path.rsplit("/", 1)[1]),)).fetchone()
                if not row:
                    return self.reply(404, {"error": "Không tìm thấy lượt luyện tập."})
                return self.reply(200, serialize(db, row, detail=True))
        except FileNotFoundError as exc:
            return self.reply(404, {"error": str(exc), "code": "database_missing"})
        except (sqlite3.Error, ValueError, KeyError):
            return self.reply(500, {"error": "Không thể đọc dữ liệu luyện tập. Kiểm tra database và quyền truy cập."})

    def log_message(self, format, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description="API chỉ đọc cho bài luyện tập")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        print(f"API chỉ đọc tại http://127.0.0.1:{server.server_port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
