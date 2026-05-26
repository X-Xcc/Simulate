"""Test remote upload endpoint"""
import http.client
import json

HOST = "47.96.218.68"
PORT = 5000

# Login
login_data = json.dumps({"username": "xx", "password": "123"}).encode()
conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
conn.request("POST", "/api/login", body=login_data, headers={"Content-Type": "application/json"})
resp = conn.getresponse()
token = json.loads(resp.read())["token"]
conn.close()
print(f"Token: {token[:30]}...")

# Minimal PNG
png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9ccb\x08\x05\x00\x00\x00\x00\xff\xff\x03\x00\x00\x04\x00\x01\x0c\x0c\x0c\x0c\x00\x00\x00IEND\xaeB`\x82'

# Upload using multipart
boundary = "----TestBoundary12345"
body = b"--" + boundary.encode() + b"\r\n"
body += b'Content-Disposition: form-data; name="file"; filename="test.png"\r\n'
body += b"Content-Type: image/png\r\n\r\n"
body += png_data + b"\r\n"
body += b"--" + boundary.encode() + b"--\r\n"

conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
conn.request("POST", "/api/upload_training_resource", body=body,
    headers={
        "Content-Type": "multipart/form-data; boundary=" + boundary,
        "Authorization": "Bearer " + token
    })
resp = conn.getresponse()
result = resp.read().decode()
print(f"Status: {resp.status}")
print(f"Result: {result[:500]}")
conn.close()
