"""SPA static server with index.html fallback"""
import http.server, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

class SPA(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # strip query string
        path = self.path.split("?")[0]
        filepath = os.path.normpath(os.path.join(DIR, path.lstrip("/")))

        # security: prevent directory traversal
        if not filepath.startswith(os.path.normpath(DIR)):
            self.send_error(403)
            return

        if os.path.isfile(filepath):
            self._serve(filepath)
        else:
            # SPA fallback
            self._serve(os.path.join(DIR, "index.html"))

    def _serve(self, filepath):
        import mimetypes
        ct, _ = mimetypes.guess_type(filepath)
        if ct is None:
            ct = "application/octet-stream"
        with open(filepath, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", len(data))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass

if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), SPA) as s:
        print(f"http://localhost:{PORT}")
        s.serve_forever()
