# Git Workflow - ZapOut Development

## Branching Strategy

```
main (production)
  └── develop (integration)
        └── feature/xxx
        └── fix/xxx
        └── refactor/xxx
```

## Standard Workflow

### 1. Feature entwickeln

```bash
# Feature Branch erstellen
git checkout develop
git pull origin main
git checkout -b feature/mein-feature

# ... Code ändern ...

# Commit
git add .
git commit -m "feat: kurze Beschreibung"

# Push
git push -u origin feature/mein-feature
```

### 2. Changes review & commit

```bash
# Alle Änderungen staged
git add -A

# Mit描述 commit message
git commit -m "type: description

Optional: Extended description

Closes #1"

# Push
git push
```

### 3. Commit Message Format

```
type: short description

Types:
- feat:     New feature
- fix:      Bug fix
- refactor: Code restructuring
- docs:     Documentation only
- style:    Formatting, no logic change
- test:     Adding tests
- chore:    Maintenance, deps

Examples:
git commit -m "feat: add cashu QR code display"
git commit -m "fix: resolve login timeout issue closes #12"
git commit -m "refactor: split App.jsx into screen components"
```

### 4. Merge nach develop

```bash
# Erst testen!
npm run test
npm run build

# Review changes
git diff develop..HEAD

# Merge (per PR oder direkt)
git checkout develop
git merge feature/mein-feature
git push origin develop
```

### 5. Hotfix (dringende Fixes)

```bash
git checkout main
git pull
git checkout -b hotfix/issue-beschreibung

# ... Fix machen ...

git commit -m "fix: hotfix description"
git push -u origin hotfix/issue-beschreibung

# Nach Review: merge in main + develop
git checkout main && git merge hotfix/issue-beschreibung
git checkout develop && git merge hotfix/issue-beschreibung
git push origin main develop
```

## Gitignore Regeln

Bereits in `.gitignore`:

- `node_modules/` - Nie committen!
- `*.db` - Lokale Datenbanken
- `.env` - Secrets
- `__pycache__/` - Python Cache
- `dist/` - Build Output

## Shortcuts

```bash
# .bash_aliases oder .zshrc hinzufügen:

alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline -10'
alias gd='git diff'
alias gco='git checkout'
alias gb='git branch'

# Schneller Commit + Push
alias gcap='git add -A && git commit -m'
```

## CI/CD

- **Linting:** Pre-commit hooks prüfen Code Style
- **Tests:** Playwright E2E Tests laufen bei PR
- **Build:** Vite Build muss erfolgreich sein

## Do's & Don'ts

### ✅ Do

- Kleine, fokussierte Commits
- Aussagekräftige Commit Messages
- Regelmäßig pushen (Backup!)
- Issues referenzieren (#1, #2)

### ❌ Don't

- `git commit -m "fix"` - Nichts sagend!
- Commits mitten in der Arbeit
- Direkt auf main pushen
- Secrets/Keys committen
