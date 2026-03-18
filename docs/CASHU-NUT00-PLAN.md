# NUT-00 Cashu Krypto Implementierungs-Plan

> Erstellt: 2026-03-16 via Opus Think
> Für: Cashu Minting Integration (POST /cashu/mint)

## Übersicht

Die Cashu Minting Integration erfordert die Implementierung von NUT-00 (BDHKE - Blind Diffie-Hellman Key Exchange), um Blinded Messages zu erstellen.

## Das Problem

Der aktuelle `/cashu/mint` Endpoint gibt einen Fehler zurück, weil:
- POST `/v1/mint/bolt11` erwartet `outputs` (Array von BlindedMessages)
- Diese müssen mit BDHKE Kryptographie erstellt werden
- Die cashu-ts Library hat einen Bug

## Die BDHKE Kryptographie

```
Wallet                           Mint
───────                          ────
1. Wähle secret x (zufällig)
2. Y = hash_to_curve(x)
3. Wähle blinding factor r
4. B_ = Y + r·G        →   (Blinded Message)
                              
                           5. C_ = k·B_  (k = Mint's private key)
                           ← Signatur

6. Unblind: C = C_ - r·K
   → C = k·Y (gültige Signatur!)
```

## Python Implementierung (Konzepte)

```python
import secrets
from secp256k1 import PrivateKey, PublicKey

def hash_to_curve(message: bytes) -> PublicKey:
    """Deterministic point on curve from message"""
    msg_hash = hashlib.sha256(b"Secp256k1_HashToCurve_" + message).digest()
    for i in range(65536):
        candidate = hashlib.sha256(msg_hash + i.to_bytes(4, "little")).digest()
        try:
            point = PublicKey(b"\x02" + candidate, raw=True)
            return point
        except Exception:
            continue

def create_blinded_message(secret: str, amount: int, keyset_id: str):
    """Erstellt eine Blinded Message (Output) für die Mint API"""
    
    # 1. Secret x
    x = secret.encode()
    
    # 2. Y = hash_to_curve(x)
    Y = hash_to_curve(x)
    
    # 3. Blinding factor r
    r = PrivateKey(secrets.token_bytes(32), raw=True)
    
    # 4. B_ = Y + r·G
    rG = r.pubkey
    B_ = PublicKey()
    B_.combine([Y, rG])
    
    return {
        "amount": amount,
        "id": keyset_id,
        "B_": B_.serialize().hex(),
    }, r  # r für Unblinding aufbewahren!
```

## Request Format für POST /v1/mint/bolt11

```json
{
  "quote": "quote_id",
  "outputs": [
    {
      "amount": 8,
      "id": "keyset_id",
      "B_": "02a9acc1e48c25604..."
    }
  ]
}
```

## Wichtige Punkte

| Konzept | Bedeutung |
|---------|-----------|
| **secret x** | Wallet behält es – beweist Besitz des Tokens |
| **r (blinding)** | Zum Unblinding der Mint-Signatur nötig |
| **B_** | Mint sieht nur den geblindeten Punkt, nicht x |
| **Amounts** | Müssen Zweierpotenzen sein (1,2,4,8,16,32...) |
| **Keyset ID** | Von `/v1/keysets` holen |

## Implementierungs-Schritte

1. **Dependencies installieren**
   - `pip install secp256k1` oder `pip install fastecdsa`

2. **hash_to_curve() implementieren**
   - Korrekte Hash-Funktion für secp256k1
   - Wichtig: deterministisch, gleiche Nachricht → gleicher Punkt

3. **Blinded Message erstellen**
   - Secret generieren
   - Y = hash_to_curve(secret)
   - r = random blinding factor
   - B_ = Y + r·G

4. **Mint Request bauen**
   - quote_id einfügen
   - outputs Array mit B_ und amount

5. **Unblinding (nach Mint-Response)**
   - C = C_ - r·K (K = Mint's public key)
   - C ist die gültige Signatur über secret

## Aufwand

| Phase | Aufwand |
|-------|---------|
| Research & Verständnis | ~2h |
| Basis-Implementierung | ~4h |
| Tests & Verification | ~3h |
| **Total** | ~9h |

## Risiken

- **Hash-to-Curve:** Korrekte Implementierung ist tricky
- **Library-Bugs:** secp256k1 Libraries können unterschiedlich sein
- **Keyset Management:** Mehrere Keysets für verschiedene Amounts

## Alternative

Falls die eigene Implementierung zu komplex wird:
- cashu-ts Bug fixen (JavaScript)
- Firefly oder andere Wallet als Reference verwenden
- Mock-Modus für Demo verwenden

---

## Quellen

- NUT-00: https://cashubtc.github.io/nuts/00
- NUT-04: https://cashubtc.github.io/nuts/04
