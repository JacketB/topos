import os
import struct
import zlib
import shutil

REPO_PATH = r'F:\Vanya\topos'
SYMBOLS_DIR = os.path.join(REPO_PATH, 'public', 'symbols')

def parse_git_index(repo_path):
    index_file = os.path.join(repo_path, '.git', 'index')
    with open(index_file, 'rb') as f:
        data = f.read()
    
    header = data[:12]
    sig, version, num_entries = struct.unpack('!4sLL', header)
    
    offset = 12
    entries = []
    for _ in range(num_entries):
        ctime_s, ctime_n, mtime_s, mtime_n, dev, ino, mode, uid, gid, size = struct.unpack('!LLLLLLLLLL', data[offset:offset+40])
        sha = data[offset+40:offset+60].hex()
        flags = struct.unpack('!H', data[offset+60:offset+62])[0]
        name_len = flags & 0x0FFF
        offset += 62
        
        if name_len < 0xFFF:
            name = data[offset:offset+name_len].decode('utf-8')
            offset += name_len
        else:
            null_idx = data.find(b'\x00', offset)
            name = data[offset:null_idx].decode('utf-8')
            offset = null_idx
            
        pad_len = 8 - ((62 + len(name)) % 8)
        offset += pad_len
        entries.append((name, sha))
        
    return entries

def get_git_object(repo_path, sha):
    obj_path = os.path.join(repo_path, '.git', 'objects', sha[:2], sha[2:])
    if not os.path.exists(obj_path):
        return None
    with open(obj_path, 'rb') as f:
        raw = zlib.decompress(f.read())
    null_idx = raw.find(b'\x00')
    return raw[null_idx+1:]

def main():
    if os.path.exists(SYMBOLS_DIR):
        shutil.rmtree(SYMBOLS_DIR)
    os.makedirs(SYMBOLS_DIR, exist_ok=True)
    
    entries = parse_git_index(REPO_PATH)
    symbol_entries = [e for e in entries if e[0].startswith('public/symbols/')]
    
    restored = 0
    for rel_path, sha in symbol_entries:
        content = get_git_object(REPO_PATH, sha)
        if content:
            target_path = os.path.join(REPO_PATH, rel_path.replace('/', os.sep))
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            with open(target_path, 'wb') as f:
                f.write(content)
            restored += 1
            
    print(f"Successfully restored all {restored} original SVG files into public/symbols/ exactly as they were.")

if __name__ == '__main__':
    main()
