"""Private-LAN TLS identity and a public-only Windows client connection kit."""

from __future__ import annotations

import hashlib
import ipaddress
import json
import os
import socket
import subprocess
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


CLIENT_CONNECT = r'''$ErrorActionPreference = 'Stop'
$kitDirectory = $PSScriptRoot
try {
    $certificatePath = Join-Path $kitDirectory 'SecretVault-LAN-CA.cer'
    $actualHash = (Get-FileHash -LiteralPath $certificatePath -Algorithm SHA256).Hash
    if ($actualHash -ne '__CA_SHA256__') { throw 'Chung chi khong khop goi goc. Hay lay lai ZIP tu may host.' }
    $rootCertificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new($certificatePath)
    $expectedThumbprint = '__CA_SHA1__'
    if ($rootCertificate.Thumbprint -ne $expectedThumbprint) { throw 'Sai chung chi LAN.' }
    if (-not (Test-Path -LiteralPath ('Cert:\CurrentUser\Root\' + $expectedThumbprint))) {
        Write-Host 'Cai chung chi HTTPS rieng cua SecretVault cho tai khoan Windows nay.'
        Write-Host ('SHA256: ' + $actualHash)
        Import-Certificate -FilePath $certificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
    }
    $connection = Get-Content -LiteralPath (Join-Path $kitDirectory 'connection.json') -Raw | ConvertFrom-Json
    $connectedUrl = $null
    foreach ($candidate in $connection.urls) {
        try {
            $health = Invoke-RestMethod -Uri ($candidate + '/api/health') -TimeoutSec 4
            if ($health.app -eq 'SecretVault' -and $health.lanHostId -eq $connection.hostId) {
                $connectedUrl = [string]$candidate
                break
            }
        } catch { Write-Host ('Chua ket noi duoc: ' + $candidate) }
    }
    if (-not $connectedUrl) { throw 'Chua thay host. Kiem tra may host dang bat, cung mang LAN va dung goi ZIP moi nhat.' }
    $clientDirectory = Join-Path $env:LOCALAPPDATA 'SecretVault\v2'
    New-Item -ItemType Directory -Path $clientDirectory -Force | Out-Null
    $settingsPath = Join-Path $clientDirectory 'client-settings.json'
    $clientSettings = [pscustomobject]@{}
    if (Test-Path -LiteralPath $settingsPath) {
        try { $clientSettings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json }
        catch { Copy-Item -LiteralPath $settingsPath -Destination ($settingsPath + '.backup-' + (Get-Date -Format 'yyyyMMddHHmmss')) }
    }
    $clientSettings | Add-Member -NotePropertyName server -NotePropertyValue $connectedUrl -Force
    $clientSettings | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8
    $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SecretVault LAN.url'
    ('[InternetShortcut]' + "`r`nURL=" + $connectedUrl + "`r`n") | Set-Content -LiteralPath $shortcutPath -Encoding ASCII
    Write-Host ('Da ket noi: ' + $connectedUrl)
    Write-Host 'Da tao shortcut SecretVault LAN tren Desktop. Moi nguoi tao tai khoan rieng tren host nay.'
    Start-Process $connectedUrl
} catch {
    Write-Host ('LOI: ' + $_.Exception.Message) -ForegroundColor Red
    Read-Host 'Nhan Enter de dong'
    exit 1
}
'''

CLIENT_CMD = '@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Connect.ps1"\r\n'


def _windows_run(arguments, **kwargs):
    return subprocess.run(arguments, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0), **kwargs)


def discover_addresses():
    """Prefer a real IPv4 interface with a default gateway, never a VPN/link-local."""
    if os.name == "nt":
        script = r"""$lanRows = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway } | ForEach-Object {
            $lanConfig = $_
            foreach ($lanAddress in $lanConfig.IPv4Address) {
                [pscustomobject]@{ address=$lanAddress.IPAddress; prefix=$lanAddress.PrefixLength; interface=$lanConfig.InterfaceAlias }
            }
        }); ConvertTo-Json -InputObject $lanRows -Compress"""
        powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
        result = _windows_run([str(powershell), "-NoProfile", "-NonInteractive", "-Command", script], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20, check=True)
        rows = json.loads(result.stdout.lstrip("\ufeff"))
    else:
        rows = [{"address": info[4][0], "prefix": 24, "interface": "LAN"} for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)]
    unique = {}
    for row in rows:
        address = ipaddress.ip_address(row["address"])
        if address.version == 4 and address.is_private and not address.is_loopback and not address.is_link_local:
            row["network"] = str(ipaddress.ip_network(f'{address}/{int(row["prefix"])}', strict=False))
            unique[str(address)] = row
    return list(unique.values())


def select_address(requested=None):
    addresses = discover_addresses()
    if requested:
        match = next((row for row in addresses if row["address"] == requested), None)
        if not match:
            raise ValueError("IP LAN khong thuoc card mang dang co gateway: " + requested)
        return match
    if not addresses:
        raise ValueError("Chua co IPv4 LAN. Hay ket noi Wi-Fi/Ethernet roi mo lai Host LAN.")
    if len(addresses) > 1:
        raise ValueError("Co nhieu mang LAN; chon --lan-ip: " + ", ".join(row["address"] for row in addresses))
    return addresses[0]


def protect_private_directory(path):
    path.mkdir(parents=True, exist_ok=True)
    if os.name == "nt":
        identity = os.environ.get("USERDOMAIN", "") + "\\" + os.environ["USERNAME"]
        _windows_run(["icacls.exe", str(path), "/inheritance:r", "/grant:r", identity + ":(OI)(CI)F", "*S-1-5-18:(OI)(CI)F"], capture_output=True, check=True)
    else:
        path.chmod(0o700)


def _write_private(path, key):
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    if os.name != "nt":
        path.chmod(0o600)


def _read_certificate(path):
    return x509.load_pem_x509_certificate(path.read_bytes())


def prepare_lan(data_root, port=8443, requested_ip=None):
    address = select_address(requested_ip)
    hostname = socket.gethostname().lower()
    dns_names = list(dict.fromkeys([hostname, hostname + ".local", "localhost"]))
    directory = Path(data_root).resolve() / "lan"
    private = directory / "private"
    protect_private_directory(private)
    ca_key_path = private / "ca-key.pem"
    ca_path = private / "ca.pem"
    leaf_key_path = private / "server-key.pem"
    leaf_path = private / "server.pem"
    timestamp = datetime.now(timezone.utc)
    if ca_key_path.exists() != ca_path.exists():
        raise ValueError("Bo chung chi LAN khong day du; khoi phuc backup truoc khi tao lai.")
    if ca_path.exists():
        ca = _read_certificate(ca_path)
        ca_key = serialization.load_pem_private_key(ca_key_path.read_bytes(), password=None)
        if ca_key.public_key().public_numbers() != ca.public_key().public_numbers():
            raise ValueError("CA private key khong khop chung chi.")
        if ca.not_valid_after_utc < timestamp + timedelta(days=15):
            raise ValueError("CA LAN sap het han. Tao host identity moi va cai lai goi may khach.")
    else:
        ca_key = ec.generate_private_key(ec.SECP256R1())
        host_tag = hashlib.sha256(ca_key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)).hexdigest()[:12]
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "SecretVault LAN " + host_tag)])
        # Restrict this local CA to private IPv4 addresses and this machine's names.
        permitted = [x509.IPAddress(ipaddress.ip_network(net)) for net in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8")]
        permitted += [x509.DNSName(name) for name in dns_names]
        ca = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(ca_key.public_key())
              .serial_number(x509.random_serial_number()).not_valid_before(timestamp - timedelta(minutes=5))
              .not_valid_after(timestamp + timedelta(days=1095))
              .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
              .add_extension(x509.KeyUsage(digital_signature=False, content_commitment=False, key_encipherment=False, data_encipherment=False, key_agreement=False, key_cert_sign=True, crl_sign=True, encipher_only=False, decipher_only=False), critical=True)
              .add_extension(x509.NameConstraints(permitted_subtrees=permitted, excluded_subtrees=None), critical=True)
              .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
              .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
              .sign(ca_key, hashes.SHA256()))
        _write_private(ca_key_path, ca_key)
        ca_path.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    renew = True
    if leaf_path.exists() and leaf_key_path.exists():
        leaf = _read_certificate(leaf_path)
        san = leaf.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
        renew = ipaddress.ip_address(address["address"]) not in san.get_values_for_type(x509.IPAddress) or leaf.not_valid_after_utc < timestamp + timedelta(days=14)
    if renew:
        leaf_key = ec.generate_private_key(ec.SECP256R1())
        san = [x509.IPAddress(ipaddress.ip_address(address["address"])), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
        san += [x509.DNSName(value) for value in dns_names]
        leaf = (x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, hostname)]))
                .issuer_name(ca.subject).public_key(leaf_key.public_key()).serial_number(x509.random_serial_number())
                .not_valid_before(timestamp - timedelta(minutes=5)).not_valid_after(min(timestamp + timedelta(days=90), ca.not_valid_after_utc))
                .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
                .add_extension(x509.SubjectAlternativeName(san), critical=False)
                .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
                .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False, data_encipherment=False, key_agreement=False, key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
                .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
                .sign(ca_key, hashes.SHA256()))
        _write_private(leaf_key_path, leaf_key)
        leaf_path.write_bytes(leaf.public_bytes(serialization.Encoding.PEM))
    ca_der = ca.public_bytes(serialization.Encoding.DER)
    public_ca = directory / "SecretVault-LAN-CA.cer"
    public_ca.write_bytes(ca_der)
    public_pem = directory / "SecretVault-LAN-CA.pem"
    public_pem.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    host_id = ca.fingerprint(hashes.SHA256()).hex()
    urls = [f'https://{address["address"]}:{port}', f'https://{hostname}.local:{port}', f'https://{hostname}:{port}']
    metadata = {"address": address["address"], "network": address["network"], "interface": address["interface"], "hostname": hostname,
                "port": port, "url": urls[0], "urls": urls, "hostId": host_id, "caSha256": hashlib.sha256(ca_der).hexdigest(),
                "caThumbprint": ca.fingerprint(hashes.SHA1()).hex().upper(), "expires": leaf.not_valid_after_utc.isoformat()}
    kit = directory / "clients"
    kit.mkdir(parents=True, exist_ok=True)
    (kit / "SecretVault-LAN-CA.cer").write_bytes(ca_der)
    script = CLIENT_CONNECT.replace("__CA_SHA256__", metadata["caSha256"].upper()).replace("__CA_SHA1__", metadata["caThumbprint"])
    (kit / "Connect.ps1").write_text(script, encoding="utf-8-sig")
    (kit / "Connect.cmd").write_bytes(CLIENT_CMD.encode("ascii"))
    (kit / "connection.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    guide = ("SECRET VAULT - HAI MAY KHACH WINDOWS\n\n"
             "1. Giai nen toan bo ZIP vao mot thu muc.\n2. Chay Connect.cmd mot lan bang tai khoan Windows dang dung.\n"
             "3. Chrome/Edge mo host. Moi nguoi dang ky email + mat khau rieng tai host nay.\n"
             "4. Cac lan sau mo shortcut SecretVault LAN tren Desktop. Khong can cai Python.\n\n"
             f"Host: {urls[0]}\nCA SHA256: {metadata['caSha256']}\n\n"
             "Goi nay chi co chung chi cong khai, khong co private key, tai khoan hay du lieu tep.\n"
             "Chung chi duoc cai trong CurrentUser\\Root de Windows/Chrome/Edge tin HTTPS noi bo.\n"
             "Chi dung goi do chu may host cung cap. Dong/mo lai browser neu chung chi chua cap nhat.\n"
             "Host phai bat va cac may can cung LAN; guest Wi-Fi/client isolation co the chan ket noi.\n"
             "Neu IP host doi, mo lai Host LAN va lay ZIP moi; goi se thu ca ten may de ket noi.\n"
             "Quen mat khau khong co chuc nang email reset; hay giu mat khau va sao luu goi khoa.\n"
             "Ghim fingerprint cua nhau truoc khi gui/nhan. DH: ca hai cung mo app; ElGamal: nguoi nhan mo sau.\n")
    (kit / "README.txt").write_text(guide, encoding="utf-8-sig")
    archive = directory / "SecretVault-LAN-Clients.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for name in ("Connect.cmd", "Connect.ps1", "connection.json", "SecretVault-LAN-CA.cer", "README.txt"):
            bundle.write(kit / name, "SecretVault-LAN/" + name)
    (directory / "connection.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    return {**metadata, "certificate": leaf_path, "key": leaf_key_path, "ca": public_pem, "caDer": public_ca, "kit": archive, "directory": directory}


def trust_host_certificate(info):
    if os.name != "nt":
        return
    certutil = Path(os.environ["SystemRoot"]) / "System32/certutil.exe"
    _windows_run([str(certutil), "-user", "-addstore", "-f", "Root", str(info["caDer"])], capture_output=True, check=True)
