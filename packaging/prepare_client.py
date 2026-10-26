"""Copy exactly the two public bootstrap files into the Client build."""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from vaultclient.connection import validate_profile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host-data", type=Path, default=Path(os.environ["LOCALAPPDATA"]) / "SecretVault/v2")
    args = parser.parse_args()
    source = args.host_data / "lan"
    metadata = json.loads((source / "connection.json").read_text(encoding="utf-8-sig"))
    certificate = (source / "SecretVault-LAN-CA.cer").read_bytes()
    metadata = validate_profile(metadata, certificate)
    destination = Path(__file__).resolve().parent / "client-bootstrap"
    destination.mkdir(exist_ok=True)
    (destination / "connection.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    (destination / "SecretVault-LAN-CA.cer").write_bytes(certificate)
    assert {path.name for path in destination.iterdir()} == {"connection.json", "SecretVault-LAN-CA.cer"}
    print("Client bootstrap contains public configuration/certificate only: " + metadata["url"])


if __name__ == "__main__":
    main()
