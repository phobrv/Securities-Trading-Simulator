import http.client
import json
import threading
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import server
from test_cli import PracticeCLITest


class PracticeServerTest(PracticeCLITest):
    def setUp(self):
        super().setUp()
        connect = server.connect_readonly
        self.mock = patch.object(server, 'connect_readonly', lambda: connect(self.db))
        self.mock.start()
        self.addCleanup(self.mock.stop)
        self.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()

    def get(self, path, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        conn.request('GET', path, headers=headers if headers is not None else {'X-Practice-Client': 'p-docs'})
        response = conn.getresponse()
        result = response.status, json.loads(response.read())
        conn.close()
        return result

    def test_missing_db_does_not_create_and_request_needs_header(self):
        self.assertEqual(self.get('/api/practice/attempts')[0], 404)
        self.assertFalse(self.db.exists())
        self.assertEqual(self.get('/api/practice/attempts', {})[0], 403)
        self.assertEqual(self.get('/api/practice/attempts', {'Host': 'evil.test', 'X-Practice-Client': 'p-docs'})[0], 403)

    def test_list_detail_and_hidden_content(self):
        attempt = self.start()
        self.answer(attempt, 'roles', 'Trả lời của tôi')
        code, listing = self.get('/api/practice/attempts')
        self.assertEqual(code, 200)
        self.assertEqual(listing['attempts'][0]['status'], 'in_progress')
        code, detail = self.get(f'/api/practice/attempts/{attempt}')
        self.assertEqual(code, 200)
        self.assertEqual(detail['questions'][0]['answer'], 'Trả lời của tôi')
        self.assertIsNone(detail['questions'][1]['prompt'])
        self.assertNotIn('reference', json.dumps(detail))
        self.assertNotIn('criterion', json.dumps(detail))
        self.answer(attempt, 'lifecycle', 'Hai')
        self.answer(attempt, 'ui', 'Ba')
        self.assertEqual(self.get('/api/practice/attempts')[1]['attempts'][0]['status'], 'ready')
        self.call('submit', attempt)
        self.assertEqual(self.get('/api/practice/attempts')[1]['attempts'][0]['status'], 'awaiting_grade')
        grade = {'grader': 'test', 'summary': 'Chưa đủ', 'criteria': [
            {'question_id': qid, 'score': score, 'evidence': 'trích', 'feedback': 'nhận xét'}
            for qid, score in [('roles', 2), ('lifecycle', 1), ('ui', 2)]
        ]}
        self.call('save-grade', attempt, data=grade)
        self.assertEqual(self.get('/api/practice/attempts')[1]['attempts'][0]['status'], 'needs_review')
        grade['criteria'][1]['score'] = 2
        self.call('save-grade', attempt, data=grade)
        self.assertEqual(self.get('/api/practice/attempts')[1]['attempts'][0]['status'], 'passed')
        self.assertEqual(len(self.get(f'/api/practice/attempts/{attempt}')[1]['evaluations']), 2)
        self.assertEqual(self.get('/api/practice/attempts/999')[0], 404)
