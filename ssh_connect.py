import paramiko
import sys

host = '47.96.218.68'
port = 22
username = 'root'
password = 'Xj301168'
commands = [
    'hostname',
    'uptime',
    'df -h',
    'free -h',
    'ls -la /',
    'ps aux | head -20'
]

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, port=port, username=username, password=password, timeout=10)
    
    print(f'Connected to {host}')
    
    for cmd in commands:
        print(f'\n=== {cmd} ===')
        stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
        output = stdout.read().decode('utf-8', errors='ignore')
        errors = stderr.read().decode('utf-8', errors='ignore')
        print(output if output else errors if errors else '(no output)')
    
    client.close()
    print('\nConnection closed')
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
