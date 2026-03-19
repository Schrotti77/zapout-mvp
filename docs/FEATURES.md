# Feature Requests & Improvements

> Dokumentation geplanter Verbesserungen für Production

---

## 1. WebAuthn Assertion Verification

**Priorität:** 🔴 Hoch (Security)
**Status:** ⚠️ Nicht implementiert
**Ticket:** `SEC-001`

### Beschreibung

Der aktuelle Passkey-Login verifiziert die WebAuthn-Assertion-Signatur nicht. Das Backend akzeptiert jede Assertion blind, solange die `credential_id` existiert.

### Problem

```python
# Aktueller Code in auth_passkey.py
def prf_login(data: PRFLoginRequest):
    credential = db.query(...).first()
    # FEHLT: Signatur-Verifizierung!
    return {"token": create_token(...)}
```

**Risiko:** Ein Angreifer könnte eine gefälschte Assertion mitschicken und sich als anderer User ausgeben.

### Lösung

Das Backend muss:

1. **Authenticator Data parsen** - prüft `rpIdHash`, `flags`, `counter`
2. **Client Data JSON verifizieren** - Challenge, Origin, Type
3. **Signatur verifizieren** - mit dem gespeicherten Public Key des Credentials

### Referenzen

- [WebAuthn Level 3 - Verifying Assertions](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion)
- [FIDO2 Best Practices](https://fidoalliance.org/specs/fido-v2.0-id-20180227/fido-security-guidelines-v2-fido-alliance.html)

---

## 2. Per-User Watch-Only Wallets

**Priorität:** 🔴 Hoch (Multi-Tenant)
**Status:** ⚠️ Nicht implementiert
**Ticket:** `WAL-001`

### Beschreibung

Aktuell teilen sich ALLE ZapOut-User dieselbe LND-Wallet auf Helmut:

```
User A ──┐
User B ──┼──► Helmut's LND (SynapseLN)  ← SHARED!
User C ──┘
```

**Problem:** Wenn User A 100€ einnimmt, sieht User B das in der Wallet.

### Lösung

Für JEDEN User eine eigene Watch-Only Wallet in LND erstellen:

```python
# 1. PRF Seed aus Passkey ableiten
seed = derive_seed_from_prf(prf_result, salt)

# 2. Public Key berechnen (BIP32 derivation)
# Path: m/84'/0'/0'/0/0 = BIP84 native SegWit
pubkey = derive_bip32_pubkey(seed, path="m/84'/0'/0'/0/0")

# 3. Watch-Only Wallet in LND importieren
lnd.importpubkey(pubkey, f"zapout-{user_id}", False)

# 4. User-Data in DB speichern
db.save(user_wallet, {
    "user_id": user_id,
    "pubkey": pubkey,
    " derivation_path": "m/84'/0'/0'/0/0",
    " lnd_watch_only": True
})
```

### Architektur

```
                    ┌─────────────────────────────────────┐
                    │           Helmut LND                 │
                    │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
                    │  │User A   │ │User B   │ │User C   │ │
                    │  │(watch) │ │(watch)  │ │(watch)  │ │
                    │  └────┬────┘ └────┬────┘ └────┬────┘ │
                    │       │           │           │       │
                    │  Submarine Swaps zur Haupt-Wallet     │
                    └─────────────────────────────────────┘
                           ▲              ▲
                           │              │
                    ┌──────┴──────────────┴──────┐
                    │       ZapOut Backend        │
                    │  • Seed im Browser (PRF)    │
                    │  • Public Key in LND        │
                    │  • Kein Seed auf Server!    │
                    └─────────────────────────────┘
```

### Vorteile

| Vorteil          | Beschreibung                                      |
| ---------------- | ------------------------------------------------- |
| **Isolation**    | Jeder User sieht nur seine eigene Wallet          |
| **Self-Custody** | Seed verlässt nie den Browser                     |
| **Watch-Only**   | LND kennt nur Public Keys, keine Seeds            |
| **Kompatibel**   | Funktioniert mit bestehender Helmut-Infrastruktur |

### User Flow

1. **Registration:** Passkey → PRF Seed → Public Key → LND import
2. **Login:** Passkey → PRF Seed → Transaktionen signieren
3. **Zahlung:** Invoice für User-Wallet → LND bezahlt

### Offene Fragen

- [ ] Wie funktioniert Recovery wenn Passkey verloren geht?
- [ ] Brauchen wir ein Backup-System für den Seed?
- [ ] Submarine Swap Fees für interne Transaktionen?

### Referenzen

- [LND `importpubkey` RPC](https://lightning.engineering/api-docs/lnd/lightning/walletkit/importpubkey)
- [BIP84 - Wallet Structure](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)
- [Submarine Swaps](https://lightning.engineering/blog/2018-4-25-submarine-swaps)

---

## 3. Seed Recovery System

**Priorität:** 🟡 Mittel
**Status:** ❌ Nicht geplant
**Ticket:** `REC-001`

### Beschreibung

Wenn ein User seinen Passkey verliert (neues Gerät, gelöschter Passkey), gibt es aktuell keinen Weg, die Wallet wiederherzustellen.

### Mögliche Lösungen

| Option                           | Pros                         | Cons                             |
| -------------------------------- | ---------------------------- | -------------------------------- |
| **Backup Seed**                  | Klassisch, verständlich      | Komplexität, User muss speichern |
| **Social Recovery**              | Kein Single Point of Failure | Privacy, Komplexität             |
| **Cloud Backup (verschlüsselt)** | Einfach                      | Abhängigkeit von Cloud           |
| **Hardware Key Backup**          | Hochsicher                   | Kosten                           |

### Referenzen

- [WebAuthn Discoverable Credentials (Passkey Backup)](https://www.w3.org/TR/webauthn-3/#client-side-discoverable-public-key-credential-source)
- [Social Recovery Wallets](https://vitalik.ca/general/2021/01/11/recovery.html)

---

## 4. Multi-Device Support

**Priorität:** 🟢 Niedrig
**Status:** ❌ Nicht geplant
**Ticket:** `DEV-001`

### Beschreibung

Ein User möchte ZapOut auf mehreren Geräten nutzen (z.B. Tablet + Phone) mit Zugriff auf dieselbe Wallet.

### Lösungsansatz

1. **Master Seed** im Cloud-Keychain (iCloud/Google Password Manager)
2. **Abgeleitete Seeds** pro Gerät via Passkey PRF
3. **Sync** der Wallet-Daten via eigener Nostr-Relay oder eigener Server

### Architektur

```
┌─────────────────────────────────────────────┐
│           iCloud Keychain / Google          │
│         (encrypted master seed backup)       │
└─────────────────────────────────────────────┘
              ▲                 ▲
              │                 │
    ┌─────────┴───┐     ┌───────┴────────┐
    │   Tablet    │     │    Phone      │
    │ (main device)│    │ (backup)      │
    │ Passkey A    │     │ Passkey B     │
    │ Seed via PRF │     │ Seed via PRF  │
    └─────────────┘     └───────────────┘
```

### Offene Fragen

- [ ] Wie verhindern wir, dass ein Gerät alle Funds klauen kann?
- [ ] Brauchen wir Multi-Sig?
- [ ] Wie funktioniert Payment Signing auf jedem Gerät?

---

## Priorisierung

| Ticket    | Priorität  | Geschätzter Aufwand |
| --------- | ---------- | ------------------- |
| `SEC-001` | 🔴 Hoch    | 2-3 Tage            |
| `WAL-001` | 🔴 Hoch    | 3-5 Tage            |
| `REC-001` | 🟡 Mittel  | 5-7 Tage            |
| `DEV-001` | 🟢 Niedrig | 7-10 Tage           |

---

## Changelog

| Datum      | Ticket | Änderung          |
| ---------- | ------ | ----------------- |
| 2026-03-19 | -      | Dokument erstellt |
