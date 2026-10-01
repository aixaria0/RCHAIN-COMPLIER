"""Independent Python/OpenSSL verification of public v1 golden bytes (no packages)."""
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile


def canonical(value):
    def check(v, depth=0):
        assert depth <= 12
        if v is None or isinstance(v, bool):
            return
        if isinstance(v, int):
            assert abs(v) <= 9007199254740991
        elif isinstance(v, str):
            v.encode('utf-8', errors='strict')
        elif isinstance(v, list):
            assert len(v) <= 256
            for item in v:
                check(item, depth + 1)
        elif isinstance(v, dict):
            assert len(v) <= 64
            for key, item in v.items():
                assert re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}', key)
                check(item, depth + 1)
        else:
            raise AssertionError('unsupported JSON type')
    check(value)
    result = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    assert len(result) <= 16384
    return result


def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


v = json.loads((pathlib.Path(__file__).resolve().parents[1] / 'schemas/intelligence-lattice-vectors-v1.json').read_text())
e = v['event']
assert canonical(v['input']).decode() == v['inputCanonical']
assert digest(canonical(v['input'])) == v['inputDigest']
assert canonical(e).decode() == v['eventCanonical']
assert digest(b'intelligence-lattice-actor/v1\0' + bytes.fromhex(e['publicKeyHex'])) == e['actorId']
assert digest(b'intelligence-lattice-policy/v1\0' + canonical(v['policy'])) == e['policyDigest']
unsigned = {k: val for k, val in e.items() if k not in ('id', 'signatureHex')}
message = b'intelligence-lattice-event/v1\0' + canonical(unsigned)
assert message.hex() == v['signingBytesHex']
assert digest(message) == e['id']
with tempfile.TemporaryDirectory() as tmp:
    root = pathlib.Path(tmp)
    (root / 'key.der').write_bytes(bytes.fromhex('302a300506032b6570032100' + e['publicKeyHex']))
    (root / 'sig').write_bytes(bytes.fromhex(e['signatureHex']))
    (root / 'msg').write_bytes(message)
    command = ['openssl', 'pkeyutl', '-verify', '-pubin', '-keyform', 'DER', '-inkey', str(root / 'key.der'), '-rawin', '-in', str(root / 'msg'), '-sigfile', str(root / 'sig')]
    assert subprocess.run(command, capture_output=True).returncode == 0
    (root / 'msg').write_bytes(message + b'!')
    assert subprocess.run(command, capture_output=True).returncode != 0
print('PASS: independent canonical bytes, content/policy/actor/event hashes, Ed25519 and mutation rejection')
