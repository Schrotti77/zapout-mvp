# ZapOut Merchant Onboarding & Key Custody Design

**Datum:** 19.03.2026
**Status:** Konzeptphase
**Autoren:** Marian, Jochen

---

## 1. Overview

Dieses Dokument beschreibt den kompletten Onboarding-Prozess für Händler bei ZapOut, inklusive:

- Geräte-Anforderungen
- Registrierungs-Flow
- Key Custody & Backup
- Recovery-Optionen
- Disaster Recovery

**Kernprinzip:** _"Bitcoin kassieren wie Apple Pay"_ - Passkey-Login ohne Seed-Phrase, aber mit mehreren Backup-Ebenen.

---

## 2. Händler-Onboarding Flow

### 2.1 Phasen-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    MERCHANT ONBOARDING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1          Phase 2           Phase 3        Phase 4      │
│  ┌─────┐         ┌─────┐          ┌─────┐       ┌─────┐      │
│  │App  │    →    │Key  │     →    │Wallet│   →   │Go!  │      │
│  │Install│       │Setup │          │Backup│       │Live │      │
│  └─────┘         └─────┘          └─────┘       └─────┘      │
│                                                                 │
│  30 Sekunden      20 Sekunden     2 Minuten     1 Minute      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Detaillierte Schritte

#### Phase 1: App Install (30 Sekunden)

**Was der Händler braucht:**

- Smartphone (iOS 14+ oder Android 10+)
- Fingerabdruck-Sensor oder Face ID (empfohlen)
- Internet-Verbindung (für Registration)

**Steps:**

```
1.1  App aus App Store / F-Droid installieren
1.2  App öffnen
1.3  "Merchant werden" tippen
```

**Anforderungen an die App:**

- Download < 20 MB
- Erster Start < 5 Sekunden
- Kein Account vorher nötig

---

#### Phase 2: Key Setup mit Passkey (20 Sekunden)

**Das passiert technisch:**

```
2.1  Passkey registrieren
     ┌──────────────────────────────────────────┐
     │ Gerät zeigt:                             │
     │ "ZapOut möchte deinen Fingerabdruck      │
     │  für sichere Zahlungen nutzen"           │
     │                                          │
     │ [Fingerabdruck scannen]                  │
     └──────────────────────────────────────────┘

2.2  PRF-Operation (im Hintergrund)
     Passkey + PRF(0x4e594f415354525453414f594e)
     → account_master

2.3  Nostr Keypair ableiten
     BIP32 Derivation: m/44'/1237'/55'/0/0
     → merchant_pubkey

2.4  Merchant-Profil erstellen
     - Shop-Name eingeben (z.B. "Café Berlin")
     - Kategorie wählen (Café, Markt, Online, etc.)
     - Logo hochladen (optional)
```

**Was der Händler sieht:**

```
┌──────────────────────────────────────────┐
│  🔐 ZapOut Passkey Setup                 │
│                                          │
│  Dein Fingerabdruck wird für alle        │
│  Zahlungen verwendet. Kein Passwort       │
│  nötig - sicher wie Apple Pay.          │
│                                          │
│  [Fingerabdruck registrieren]            │
│                                          │
│  ℹ️ Deine Keys werden auf deinem         │
│     Gerät gespeichert, nicht in der      │
│     Cloud.                               │
└──────────────────────────────────────────┘
```

---

#### Phase 3: Wallet Backup (2 Minuten) - KRITISCH

**Hier beginnt die Key-Custody-Education.**

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  WICHTIG: Backup erstellen                                  │
│                                                                 │
│  Dein Wallet ist auf diesem Gerät. Wenn du das Gerät          │
│  verlierst, brauchst du das Backup.                            │
│                                                                 │
│  Wähle eine Backup-Methode:                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🖨️  Backup auf Papier (EMPFOHLEN)                      │   │
│  │     12 Wörter aufschreiben und sicher aufbewahren       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☁️  Cloud-Backup (Google Drive / iCloud)               │   │
│  │     Verschlüsselt mit deinem Passkey                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔐  Nur Passkey (RISIKO)                               │   │
│  │     Kein Backup. Bei Geräteverlust: Keys weg!          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Backup-Optionen im Detail:**

| Methode                   | Sicherheit | Einfachheit | Empfehlung                 |
| ------------------------- | ---------- | ----------- | -------------------------- |
| **Papier**                | ⭐⭐⭐⭐⭐ | ⭐⭐        | Händler mitphysischem Shop |
| **Cloud (verschlüsselt)** | ⭐⭐⭐⭐   | ⭐⭐⭐⭐    | Händler ohne IT-Kenntnisse |
| **Nur Passkey**           | ⭐⭐       | ⭐⭐⭐⭐⭐  | Risiko, nur für Tester     |

---

#### Phase 4: Go Live! (1 Minute)

```
4.1  Lightning-Setup
     ┌──────────────────────────────────────────┐
     │  Lightning Wallet verbinden:             │
     │                                          │
     │  [ ] Breez SDK (empfohlen)              │
     │  [ ] Eigener LND Node                   │
     │  [ ] LNbits (Helmut)                    │
     │                                          │
     │  Verbinde dich mit deinem Helmut-Server  │
     │  für selbst-gehostete Lightning!         │
     └──────────────────────────────────────────┘

4.2  Cashu Mint (optional)
     ┌──────────────────────────────────────────┐
     │  Cashu Mint für anonymes Cash:           │
     │                                          │
     │  [ ] Helmut Mint (selbst-gehostet)      │
     │  [ ] Öffentlicher Mint                   │
     └──────────────────────────────────────────┘

4.3  Erster Test
     - QR-Code scannen
     - Test-Zahlung senden
     - Bestätigung sehen

4.4  Dashboard erklärt bekommen (optional)
     Kurze Tour durch:
     - POS-Screen
     - Transaktionshistorie
     - Tagesberichte
     - Einstellungen
```

---

## 3. Key Custody Modell

### 3.1 Die drei Schlüssel

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZAPOUT KEY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Passkey (Biometrie)                                           │
│   ├── Verankert im Secure Enclave des Geräts                 │
│   ├── Niemals das Gerät verlassen                             │
│   └── PRF-Extension für Key Derivation                         │
│                                                                 │
│   ├── ↓ PRF(0x4e594f415354525453414f594e)                      │
│   └── → account_master                                         │
│                                                                 │
│   ├── → Nostr Keypair (m/44'/1237'/55'/0/0)                  │
│   │   └── Merchant Identity, Zaps, Profile                    │
│   │                                                              │
│   └── → BIP32 Wallet Keys (m/44'/0'/0'/0/*)                   │
│       ├── Lightning (LND)                                      │
│       └── Cashu (Mint)                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Backup-Ebenen

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKUP PYRAMIDE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                         ┌─────────┐                            │
│                        /   Level 3  \                           │
│                       /  Metall-Backup \                        │
│                      /  (Optional,      \                      │
│                     │   Für最大值 Händler)    │                │
│                      \                  /                       │
│                       \                /                        │
│                        └──────────────┘                        │
│                       ┌──────────────┐                        │
│                      /   Level 2       \                       │
│                     │   Papier-Backup    │                     │
│                      \   (12 Wörter)      /                    │
│                       \                  /                      │
│                        └──────────────┘                        │
│                       ┌──────────────┐                        │
│                      /   Level 1       \                      │
│                     │   Cloud-Backup     │                     │
│                      \   (Verschlüsselt)  /                    │
│                       \                  /                      │
│                        └──────────────┘                        │
│                       ┌──────────────┐                        │
│                      /   Level 0       \                      │
│                     │   Passkey Only     │                     │
│                      \   (Kein Backup!)   /                   │
│                       \                  /                     │
│                        └──────────────┘                        │
│                                                                 │
│  Standard für Händler: Level 1 + Level 2                       │
│  Maximum Security:    Level 1 + Level 2 + Level 3              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Recovery-Szenarien

### 4.1 Szenario: Neues Handy

```
Problem: Händler hat neues Smartphone, alter Passkey weg

Lösung A: Paper Backup vorhanden
┌──────────────────────────────────────────┐
│  1. ZapOut auf neuem Handy installieren  │
│  2. "Keys wiederherstellen" wählen       │
│  3. 12-Wort-Seed eingeben                │
│  4. Passkey neu registrieren             │
│  5. Keys werden neu abgeleitet           │
│  6. ✓ Fertig!                            │
└──────────────────────────────────────────┘

Lösung B: Cloud-Backup vorhanden
┌──────────────────────────────────────────┐
│  1. ZapOut auf neuem Handy installieren  │
│  2. "Cloud-Backup wiederherstellen"      │
│  3. Mit alter Cloud verbinden            │
│  4. Authentifizieren (alte Biometrie)   │
│  5. Keys werden entschlüsselt            │
│  6. Neuen Passkey registrieren           │
│  7. ✓ Fertig!                            │
└──────────────────────────────────────────┘

Lösung C: Kein Backup
┌──────────────────────────────────────────┐
│  😢 Keys sind verloren!                  │
│                                          │
│  ⚠️  Das ist der Worst Case.             │
│  Händler muss:                          │
│  - Neues Wallet anlegen                  │
│  - Kunden informieren (andere Adresse)   │
│  - Lightning Channels neu öffnen         │
│                                          │
│  Prävention: Backup-Erinnerungen!        │
└──────────────────────────────────────────┘
```

### 4.2 Szenario: Gerät kaputt, aber Passkey funktioniert noch

```
Problem: Handy geht nicht mehr an, aber Fingerabdruck-Sensor funktioniert noch

Lösung:
┌──────────────────────────────────────────┐
│  1. Neues Handy gleicher Marke holen    │
│  2. Passkey-Transfer (iOS→iOS / Android)│
│     via Cloud-Backup des Herstellers    │
│  3. ZapOut installieren                 │
│  4. Passkey ist noch da!                │
│  5. Keys funktionieren wie vorher       │
│  6. ✓ Fertig!                            │
└──────────────────────────────────────────┘
```

### 4.3 Szenario: Helmut-Server nicht erreichbar

```
Problem: LNbits auf Helmut ist down

Lösung:
┌──────────────────────────────────────────┐
│  Automatische Fallback-Strategie:       │
│                                          │
│  1. ZapOut erkennt: Helmut unreachable   │
│  2. Schaltet auf Breez SDK Fallback     │
│  3. Lightning funktioniert weiter       │
│  4. Cashu bis Server wieder da: deaktiviert│
│  5. Benachrichtigung an Händler         │
│  6. Nach Server-Wiederherstellung:      │
│     Cashu automatisch reaktiviert        │
└──────────────────────────────────────────┘
```

---

## 5. Backup-Erinnerungs-System

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKUP REMINDER FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nach Installation:                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Tag 1:   "Backup erstellt?" - Erinnerung             │  │
│  │  Tag 7:   "Backup noch sicher?" - Check-In             │  │
│  │  Tag 30:  "Monats-Review" - Backup testen              │  │
│  │  Jeden Monat: "Backup-Check" wenn App geöffnet wird    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Wenn kein Backup:                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  🔴 Rote Warnung bei jedem App-Start                   │  │
│  │  "Du hast kein Backup. Bei Geräteverlust sind          │  │
│  │   deine Keys unwiederbringlich verloren."              │  │
│  │                                                       │  │
│  │  [Jetzt Backup erstellen]  [Ich verstehe die Risiken] │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Merchant-FAQ (Für die App)

### Q: Was ist ein Passkey?

**A:** Ein Passkey nutzt deinen Fingerabdruck oder Face ID, um dich zu identifizieren. Es ist sicherer als ein Passwort und geht schneller.

### Q: Was passiert wenn ich mein Handy wechsle?

**A:** Mit einem Backup kannst du deine Keys auf das neue Handy übertragen. Ohne Backup sind sie leider weg.

### Q: Ist mein Geld sicher?

**A:** Ja! Deine Keys werden auf deinem Gerät gespeichert und verlassen es nie. Niemand - auch nicht ZapOut - hat Zugriff auf dein Geld.

### Q: Was ist der Unterschied zu SumUp oder PayPal?

**A:** Bei SumUp/PayPal hat das Unternehmen dein Geld. Bei ZapOut gehört dir dein Geld - du hast die Keys und volle Kontrolle. Aber trotzdem so einfach wie SumUp zu bedienen.

### Q: Was ist ein Paper-Backup?

**A:** Eine Liste von 12 Wörtern, mit denen du deine Keys wiederherstellen kannst. Schreib sie auf und bewahre sie sicher auf - z.B. in einem Safe oder Bankschließfach.

### Q: Kann ich mehrere Geräte nutzen?

**A:** Aktuell nicht - ZapOut läuft auf einem Gerät. Multi-Device kommt in einer späteren Version.

---

## 7. Technische Implementierung

### 7.1 Passkey Registration Flow

```javascript
// Pseudocode für Passkey-Setup
async function setupMerchantPasskey(merchantName) {
  // 1. Passkey registrieren
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: new Uint8Array(32),
      rp: { name: 'ZapOut', id: 'zapout.com' },
      user: {
        id: merchantName, // oder hashed merchant ID
        name: merchantName,
        displayName: merchantName,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
      extensions: {
        prf: { eval: { first: new Uint8Array(32) } },
      },
    },
  });

  // 2. PRF-Output extrahieren
  const prfResult = credential.getExtensionResults().prf;
  const accountMaster = prfResult.first;

  // 3. Keys ableiten
  const nostrKey = deriveNostrKey(accountMaster);
  const walletKey = deriveWalletKey(accountMaster);

  // 4. Salt erstellen und auf Nostr publishen
  const salt = `zapout-merchant-${merchantName}`;
  publishSaltToNostr(nostrKey, salt);

  return { nostrKey, walletKey };
}
```

### 7.2 Backup-Storage

```javascript
// Paper Backup (12-Wort Mnemonic)
function createPaperBackup(walletKey) {
  const mnemonic = bip39.fromEntropy(walletKey);
  return {
    words: mnemonic.split(' '), // 12 Wörter
    warning: 'Bewahre diese Wörter sicher auf. Wer sie kennt, hat Zugriff auf dein Geld.',
  };
}

// Cloud Backup (verschlüsselt)
async function createCloudBackup(walletKey, passkey) {
  const encryptedKey = await encryptWithPasskey(walletKey, passkey);
  await saveToCloud(encryptedKey);
}
```

---

## 8. Offene Fragen / Diskussionsbedarf

- [ ] **Multi-Device:** Sollen Händler ZapOut auf mehreren Geräten nutzen können?
- [ ] **Team-Feature:** Können mehrere Mitarbeiter das gleiche Wallet nutzen?
- [ ] **Hardware-Wallet:** Soll ZapOut mit Ledger/Trezor integriert werden können?
- [ ] **Insurance:** Soll es eine optionale Versicherung gegen Key-Verlust geben?
- [ ] **Migration von bestehenden Wallets:** Können Händler ihr bestehendes LND-Wallet importieren?

---

## 9. Nächste Schritte

1. **Design Review** mit Marian → Feedback zu diesem Dokument
2. **UX-Prototyping** → Interaktiver Flow für Onboarding
3. **Tech Spike** → Passkey-Registrierung + Key Derivation testen
4. **Backend-Design** → Nostr-Relay-Anbindung, Salt-Storage

---

_Letzte Änderung: 19.03.2026_
