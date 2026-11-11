"""Local dev server with CLP API proxy and photo upload."""
import http.server
import json
import os
import time
import base64
import urllib.request

PORT = 3000
CLP_API = 'https://api.clp.com.hk/evcharger/list'
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        if self.path == '/api/clp':
            self.handle_clp_proxy()
        elif self.path == '/api/status':
            self.send_json({'status': 'ok', 'api': 'running'})
        elif self.path.startswith('/uploads/'):
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/upload':
            self.handle_photo_upload()
        else:
            self.send_json({'error': 'Not found'}, 404)

    def handle_photo_upload(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            station_id = data.get('stationId', 'unknown')
            issue_type = data.get('issueType', 'other')
            description = data.get('description', '')
            queue_count = data.get('queueCount', 0)
            available_stalls = data.get('availableStalls', 0)
            broken_chargers = data.get('brokenChargers', 0)

            # 只存結構化數據，唔存相片
            ts = int(time.time() * 1000)
            report = {
                'stationId': station_id,
                'issueType': issue_type,
                'description': description,
                'queueCount': queue_count,
                'availableStalls': available_stalls,
                'brokenChargers': broken_chargers,
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                'hasPhoto': bool(data.get('photo')),
                'status': 'ai_analyzed'
            }
            report_file = os.path.join(UPLOAD_DIR, f'report_{station_id}_{ts}.json')
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)

            self.send_json({
                'success': True,
                'reportId': f'{station_id}_{ts}',
                'message': 'Report saved (structured data only, photo discarded)'
            })
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_clp_proxy(self):
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.clp.com.hk/',
            }
            req = urllib.request.Request(CLP_API, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_json({'error': str(e), 'source': 'clp-proxy'}, 502)

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass

if __name__ == '__main__':
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with http.server.HTTPServer(('0.0.0.0', PORT), Handler) as srv:
        print(f'Serving on http://0.0.0.0:{PORT}')
        print(f'Uploads dir: {UPLOAD_DIR}')
        srv.serve_forever()
