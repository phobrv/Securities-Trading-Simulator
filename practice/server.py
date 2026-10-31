#!/usr/bin/env python3
"""Local HTTP interface for answering practice questions; grading stays in OpenCode."""

import argparse
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import sqlite3
from urllib.parse import urlsplit

import cli
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
        # Expose answered questions and the next unanswered question, never the rubric.
        result["scenario"] = test["scenario"]
        next_id = next((q["id"] for q in test["questions"] if q["id"] not in responses), None)
        result["questions"] = [
            {"id": q["id"], "number": i + 1,
             "prompt": q["prompt"] if row["status"] == "submitted" or q["id"] in responses or q["id"] == next_id else None,
             "answer": responses[q["id"]]["answer"] if q["id"] in responses else None,
             "updated_at": responses[q["id"]]["updated_at"] if q["id"] in responses else None}
            for i, q in enumerate(test["questions"])]
        result["evaluations"] = evaluations
    return result


class Handler(BaseHTTPRequestHandler):
    def allowed(self):
        origin = self.headers.get("Origin")
        if origin:
            parsed = urlsplit(origin)
            if parsed.scheme not in ("http", "https") or parsed.hostname not in ("localhost", "127.0.0.1"):
                return False
        return (self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"
                and self.headers.get("X-Practice-Client") == "p-docs")

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
        if not self.allowed():
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

    def do_POST(self):
        if not self.allowed():
            return self.reply(403, {"error": "Yêu cầu không được phép."})
        path = urlsplit(self.path).path
        match = re.fullmatch(r"/api/practice/attempts/([1-9][0-9]*)/(answer|submit)", path)
        if path != "/api/practice/attempts" and not match:
            return self.reply(404, {"error": "Không tìm thấy đường dẫn."})
        try:
            if self.headers.get_content_type() != "application/json":
                return self.reply(415, {"error": "Yêu cầu phải dùng JSON."})
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 1024 * 1024:
                return self.reply(400, {"error": "Dữ liệu không hợp lệ hoặc quá lớn."})
            value = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(value, dict):
                raise ValueError("Dữ liệu phải là JSON object.")
            if match:
                args = argparse.Namespace(action=match.group(2), attempt_id=int(match.group(1)))
            else:
                args = argparse.Namespace(action="start", test_id=value.get("test_id"))
            with closing(cli.connect()) as db:
                result = cli.run(args, db, input_value=value)
            return self.reply(200, result)
        except (ValueError, UnicodeDecodeError) as exc:
            return self.reply(400, {"error": str(exc)})
        except (sqlite3.Error, OSError):
            return self.reply(500, {"error": "Không thể lưu dữ liệu luyện tập. Kiểm tra database và quyền truy cập."})

    def log_message(self, format, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description="API cục bộ cho bài luyện tập")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        print(f"API luyện tập tại http://127.0.0.1:{server.server_port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
