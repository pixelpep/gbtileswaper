#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  push-public.sh
#  Commit sur main, puis pousse une version propre sur public
#  (sans tracker).
#
#  Usage :  ./push-public.sh "Message de commit"
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
info() { echo -e "${CYAN}→${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }
fail() { echo -e "${RED}✗ ERREUR :${RESET} $*"; exit 1; }

echo -e "\n${BOLD}── GB Tile Swapper — push-public ──────────────────────────${RESET}\n"

# ── 0. Vérifications préliminaires ────────────────────────────

# Doit être lancé depuis main
CURRENT=$(git branch --show-current)
[[ "$CURRENT" == "main" ]] || fail "Tu dois être sur la branche main (actuelle : $CURRENT)"

# Message de commit obligatoire
MESSAGE="${1:-}"
[[ -n "$MESSAGE" ]] || fail "Fournir un message de commit.\n   Usage : ./push-public.sh \"Mon message\""

# ── 1. Statut de main ─────────────────────────────────────────
info "Vérification des changements sur main..."

STAGED=$(git diff --cached --name-only)
UNSTAGED=$(git diff --name-only)
UNTRACKED=$(git ls-files --others --exclude-standard)

if [[ -z "$STAGED" && -z "$UNSTAGED" && -z "$UNTRACKED" ]]; then
    warn "Aucun changement détecté sur main — rien à commiter."
    SKIP_COMMIT=true
else
    SKIP_COMMIT=false
    echo ""
    echo -e "${BOLD}Fichiers qui seront commités :${RESET}"
    git status --short
    echo ""
    read -r -p "$(echo -e ${YELLOW}"Continuer ? [o/N] "${RESET})" CONFIRM
    [[ "$CONFIRM" =~ ^[oOyY]$ ]] || { warn "Annulé."; exit 0; }
fi

# ── 2. Commit sur main ────────────────────────────────────────
if [[ "$SKIP_COMMIT" == false ]]; then
    info "Commit sur main..."
    git add -A
    git commit -m "$MESSAGE"
    ok "Commit main : $MESSAGE"
fi

# ── 3. Fichiers publics à synchroniser ────────────────────────
# Tous les fichiers trackés sur main SAUF ceux exclusivement liés au tracker
PUBLIC_FILES=(
    "index.php"
    "ui.js"
    "engine.js"
    "styles.css"
    "tutorial.js"
    "plugins/Tile Swaper/events/eventTileSwaper.js"
    "plugins/Tile Swaper/events/README.md"
)

# ── 4. Basculer sur public ────────────────────────────────────
info "Passage sur la branche public..."
git checkout public

# ── 5. Copier les fichiers depuis main ────────────────────────
info "Copie des fichiers depuis main..."
for FILE in "${PUBLIC_FILES[@]}"; do
    if git show "main:$FILE" &>/dev/null; then
        git checkout main -- "$FILE"
        ok "  $FILE"
    else
        warn "  $FILE — absent de main, ignoré"
    fi
done

# ── 6. Retirer les références tracker ─────────────────────────
info "Nettoyage tracker dans index.php..."
sed -i '' '/<script src="tracker\/tracker\.js">/d' index.php
ok "  <script tracker> retiré"

info "Nettoyage tracker dans ui.js..."
sed -i '' '/if (window\.GbtsTracker) GbtsTracker\.trackEvent/d' ui.js
# Remplacer la référence session_id dynamique par une valeur fixe
sed -i '' "s/session_id: window\.GbtsTracker ? GbtsTracker\.sessionId : 'unknown'/session_id: 'anonymous'/" ui.js
ok "  GbtsTracker.trackEvent retiré"

# Vérification : s'assurer qu'il ne reste aucune ref tracker
REMAINING=$(grep -rn "GbtsTracker\|tracker/tracker" index.php ui.js 2>/dev/null || true)
if [[ -n "$REMAINING" ]]; then
    warn "Références tracker résiduelles détectées :"
    echo "$REMAINING"
    read -r -p "$(echo -e ${YELLOW}"Continuer quand même ? [o/N] "${RESET})" FORCE
    [[ "$FORCE" =~ ^[oOyY]$ ]] || { git checkout main; fail "Push annulé — nettoie manuellement."; }
fi

# ── 7. Commit sur public ──────────────────────────────────────
info "Commit sur public..."
git add -A
git commit -m "$MESSAGE"
ok "Commit public : $MESSAGE"

# ── 8. Pull + Push ────────────────────────────────────────────
info "Synchronisation avec origin/public..."
git pull origin public --no-rebase --quiet
info "Push vers GitHub (public)..."
git push origin public
ok "GitHub mis à jour ✓"

# ── 9. Retour sur main ────────────────────────────────────────
git checkout main
ok "Retour sur main\n"

echo -e "${BOLD}${GREEN}── Terminé ! ──────────────────────────────────────────────${RESET}\n"
