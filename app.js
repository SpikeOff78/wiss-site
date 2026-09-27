/* ============================================================
   WISSKSRR — script commun à toutes les pages
   Les données viennent du bot : route /api/site sur son serveur Render.
   ============================================================ */

// ⚠️ À RENSEIGNER : l'adresse publique du bot sur Render, sans "/" à la fin.
const API_URL = "https://wiss-bot-app.onrender.com";

const DELAI_MAX_MS = 70_000;        // Render gratuit peut mettre ~50 s à se réveiller
const RAFRAICHISSEMENT_MS = 60_000; // le bot met ses données à jour toutes les 60 s
const CACHE_MS = 60_000;            // évite de re-télécharger en changeant de page

const PAGE = document.body.dataset.page;
const fmt = new Intl.NumberFormat("fr-FR");
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Interface ---------- */
const entete = $("#entete");
const surDefilement = () => entete.classList.toggle("defile", window.scrollY > 8);
window.addEventListener("scroll", surDefilement, { passive: true });
surDefilement();

const menuBtn = $("#menu-btn"), nav = $("#nav");
menuBtn.addEventListener("click", () => {
  const ouvert = nav.classList.toggle("ouvert");
  menuBtn.setAttribute("aria-expanded", String(ouvert));
});

$$(".annee").forEach((n) => (n.textContent = new Date().getFullYear()));

$$("[data-copier]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copier);
      btn.textContent = "Copié";
    } catch {
      btn.textContent = btn.dataset.copier;
    }
    setTimeout(() => (btn.textContent = "Copier"), 1600);
  });
});

/* ---------- Halo qui suit la souris ---------- */
const halo = $(".halo");
if (halo && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !calme) {
  let cibleX = innerWidth / 2, cibleY = innerHeight / 2, x = cibleX, y = cibleY, enCours = false;
  const suivre = () => {
    x += (cibleX - x) * 0.14;   // rattrapage progressif = mouvement fluide
    y += (cibleY - y) * 0.14;
    halo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (Math.abs(cibleX - x) > 0.3 || Math.abs(cibleY - y) > 0.3) requestAnimationFrame(suivre);
    else enCours = false;
  };
  window.addEventListener("pointermove", (e) => {
    cibleX = e.clientX; cibleY = e.clientY;
    halo.classList.add("actif");
    if (!enCours) { enCours = true; requestAnimationFrame(suivre); }
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => halo.classList.remove("actif"));
} else if (halo) {
  halo.remove();
}

/* ---------- Page Commandes : filtres + recherche ---------- */
const grilleCmd = $("#grille-cmd");
if (grilleCmd) {
  let filtre = "toutes";
  const onglets = $$(".onglet");
  const champ = $("#recherche-cmd");
  const appliquer = () => {
    const q = champ.value.trim().toLowerCase();
    let visibles = 0;
    grilleCmd.querySelectorAll(".cmd").forEach((carte) => {
      const ok = (filtre === "toutes" || carte.dataset.acces === filtre) && (!q || carte.textContent.toLowerCase().includes(q));
      carte.hidden = !ok;
      if (ok) visibles++;
    });
    $("#cmd-vide").hidden = visibles > 0;
  };
  onglets.forEach((b) => b.addEventListener("click", () => {
    filtre = b.dataset.filtre;
    onglets.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    appliquer();
  }));
  champ.addEventListener("input", appliquer);
}

/* ---------- Outils ---------- */
// Tout texte venant du bot passe par textContent : un pseudo n'est jamais interprété comme du HTML.
function el(tag, classe, texte) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texte !== undefined && texte !== null) n.textContent = texte;
  return n;
}
const nombre = (v) => (typeof v === "number" ? fmt.format(v) : "—");
const urlSure = (u) => (typeof u === "string" && u.startsWith("https://cdn.discordapp.com/") ? u : null);

// Avatar par défaut (silhouette) pour les exemples et les places libres
function silhouette() {
  const d = el("div", "avatar avatar-vide");
  d.setAttribute("aria-hidden", "true");
  d.innerHTML = '<svg viewBox="0 0 24 24" width="58%" height="58%" fill="currentColor"><circle cx="12" cy="8.5" r="4.5"/><path d="M3.5 21c.8-4.6 4.3-7 8.5-7s7.7 2.4 8.5 7z"/></svg>';
  return d;
}

function avatar(m) {
  if (!m || m.exemple) return silhouette();
  const url = urlSure(m.avatar);
  const lettre = () => {
    const d = el("div", "avatar", m && m.pseudo ? m.pseudo.trim().charAt(0).toUpperCase() : "?");
    d.setAttribute("aria-hidden", "true");
    return d;
  };
  if (!url) return lettre();
  const img = el("img", "avatar");
  img.src = url; img.alt = ""; img.loading = "lazy"; img.width = 128; img.height = 128;
  img.addEventListener("error", () => img.replaceWith(lettre()), { once: true });
  return img;
}

function compter(noeud, cible) {
  if (!noeud) return;
  noeud.classList.remove("chargement");
  if (typeof cible !== "number") { noeud.textContent = "—"; return; }
  const depart = Number(noeud.dataset.v || 0);
  noeud.dataset.v = cible;
  if (calme || depart === cible) { noeud.textContent = fmt.format(cible); return; }
  const t0 = performance.now(), duree = 1000;
  const pas = (t) => {
    const p = Math.min(1, (t - t0) / duree), e = 1 - Math.pow(1 - p, 3);
    noeud.textContent = fmt.format(Math.round(depart + (cible - depart) * e));
    if (p < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

// Même formule que le bot : niveau = floor(sqrt(xp / 150))
const xpPourNiveau = (n) => 150 * n * n;
function progression(xp, niveau) {
  const bas = xpPourNiveau(niveau), haut = xpPourNiveau(niveau + 1);
  return Math.max(0, Math.min(100, ((xp - bas) / (haut - bas)) * 100));
}

/* ---------- Rendu par page ---------- */
function rendreStatutLive(t) {
  const pastille = $(".statut-live");
  if (!pastille) return;
  const texte = pastille.querySelector(".statut-texte");
  pastille.classList.remove("en-direct", "sticker-rouge");
  pastille.classList.add("sticker-sombre");
  if (!t) { texte.textContent = "Twitch · wissksrr"; return; }
  if (t.live) {
    pastille.classList.add("en-direct", "sticker-rouge");
    pastille.classList.remove("sticker-sombre");
    texte.textContent = typeof t.spectateurs === "number" ? `En live · ${nombre(t.spectateurs)} viewers` : "En live";
    return;
  }
  if (t.prochain && t.prochain.debut) {
    const d = new Date(t.prochain.debut);
    const jour = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(d);
    texte.textContent = `Prochain live · ${jour}`;
    return;
  }
  texte.textContent = "Hors ligne · live le soir";
}

function rendreAccueil(d) {
  const s = d.stats || {}, serveur = d.serveur || {}, top = d.top || [];
  compter($("#c-membres"), serveur.membres);
  compter($("#c-en-ligne"), serveur.en_ligne);
  compter($("#c-niv-max"), s.niveau_max);
  compter($("#s-classes"), s.membres_classes);
  compter($("#s-xp"), s.xp_total);
  compter($("#s-max"), s.niveau_max);
  compter($("#s-actifs"), s.actifs_7j);
  rendreStatutLive(d.twitch);

  const qui = $("#top1-qui");
  if (qui) {
    const m = top[0];
    qui.replaceChildren(avatar(m || null), el("span", "pseudo", m ? m.pseudo : "Place libre"));
    $("#top1-niv").textContent = m ? `Niv. ${m.niveau}` : "Niv. —";
    $("#top1-xp").textContent = m ? `${nombre(m.xp)} XP` : "— XP";
  }
}

let classementComplet = [];
function rendreClassement(d) {
  const top = Array.isArray(d.top) ? d.top : [];
  classementComplet = top;

  [1, 2, 3].forEach((rang) => {
    const place = $(`.place-${rang}`);
    const m = top.find((x) => x.rang === rang);
    place.replaceChildren(
      el("span", "rang", String(rang)),
      avatar(m || null),
      el("span", "pseudo", m ? m.pseudo : "Place libre"),
      el("span", "detail", m ? `Niv. ${m.niveau} · ${nombre(m.xp)} XP` : "À prendre")
    );
  });

  filtrerTableau();

  if (d.maj) {
    const min = Math.max(0, Math.round((Date.now() - new Date(d.maj).getTime()) / 60000));
    $("#maj").textContent = min < 1 ? "Mis à jour à l'instant" : `Mis à jour il y a ${min} min`;
  }
}

function filtrerTableau() {
  const liste = $("#tableau");
  if (!liste) return;
  const q = ($("#recherche").value || "").trim().toLowerCase();
  const lignes = classementComplet.filter((m) => m.rang >= 4 || q).filter((m) => !q || m.pseudo.toLowerCase().includes(q));
  liste.replaceChildren();
  if (!lignes.length) {
    liste.append(el("li", "vide", q ? "Aucun pseudo trouvé dans le top 50." : "Le classement arrive."));
    return;
  }
  for (const m of lignes) {
    const li = el("li", "ligne");
    const jauge = el("div", "jauge");
    const barre = el("div", "barre");
    const remplissage = el("i");
    remplissage.style.width = `${progression(m.xp, m.niveau).toFixed(1)}%`;
    barre.append(remplissage);
    jauge.append(el("span", "niv", `Niv. ${m.niveau}`), barre);
    li.append(el("span", "rang", `#${m.rang}`), avatar(m), el("span", "pseudo", m.pseudo), jauge, el("span", "xp", `${nombre(m.xp)} XP`));
    liste.append(li);
  }
}
const champRecherche = $("#recherche");
if (champRecherche) champRecherche.addEventListener("input", filtrerTableau);

function rendreNiveaux(d) {
  if (!Array.isArray(d.paliers)) return;
  d.paliers.forEach((p) => {
    const ligne = $(`.echelon[data-niveau="${Number(p.niveau)}"]`);
    if (!ligne) return;
    if (p.nom) ligne.querySelector(".role").textContent = p.nom;
    if (typeof p.couleur === "string" && /^#[0-9a-f]{6}$/i.test(p.couleur)) ligne.style.setProperty("--couleur", p.couleur);
  });
}

function rendre(d) {
  if (PAGE === "index") rendreAccueil(d);
  if (PAGE === "classement") rendreClassement(d);
  if (PAGE === "niveaux") rendreNiveaux(d);
}

function rendreIndisponible() {
  $$(".chargement").forEach((n) => { n.classList.remove("chargement"); if (!n.classList.contains("avatar")) n.textContent = "—"; });
  if (PAGE === "classement") {
    rendreClassement({ top: [] });
    $("#maj").textContent = "Classement indisponible. Il reste visible dans #classement.";
  }
}

/* ---------- Données ---------- */
const PAGES_AVEC_DONNEES = ["index", "classement", "niveaux"];

function lireCache() {
  try {
    const brut = sessionStorage.getItem("wiss-api");
    if (!brut) return null;
    const { t, d } = JSON.parse(brut);
    return Date.now() - t < CACHE_MS ? d : null;
  } catch { return null; }
}
function ecrireCache(d) {
  try { sessionStorage.setItem("wiss-api", JSON.stringify({ t: Date.now(), d })); } catch { /* stockage indisponible : pas grave */ }
}

async function recuperer() {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MAX_MS);
  const reveil = setTimeout(() => { const m = $("#maj"); if (m) m.textContent = "Réveil du bot, jusqu'à une minute…"; }, 6000);
  try {
    const r = await fetch(`${API_URL}/api/site`, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d.pret) throw new Error("données pas prêtes");
    return d;
  } finally { clearTimeout(minuteur); clearTimeout(reveil); }
}

let affiche = false;
async function actualiser() {
  try {
    const d = await recuperer();
    ecrireCache(d);
    rendre(d);
    affiche = true;
  } catch (e) {
    console.warn("[WISSKSRR] API indisponible :", e.message);
    if (!affiche) rendreIndisponible();
  }
}

/* Mode exemple : actif avec ?demo, ou tant que l'adresse du bot n'est pas renseignée.
   Les données sont fictives et signalées par un bandeau. */
const API_PAS_BRANCHEE = API_URL.includes("REMPLACE-MOI");
const DEMO = new URLSearchParams(location.search).has("demo") || API_PAS_BRANCHEE;
function donneesDemo() {
  const top = Array.from({ length: 50 }, (_, i) => {
    const xp = Math.round(420000 * Math.pow(0.93, i));
    return { rang: i + 1, pseudo: "Pseudo", avatar: null, exemple: true, niveau: Math.floor(Math.sqrt(xp / 150)), xp };
  });
  return {
    pret: true, maj: new Date(Date.now() - 60000).toISOString(),
    serveur: { membres: 1000, en_ligne: 100 },
    stats: { membres_classes: 500, xp_total: 1000000, niveau_max: top[0].niveau, actifs_7j: 150 },
    top, paliers: null, twitch: { live: false, prochain: null },
  };
}

if (DEMO) {
  document.body.prepend(el("div", "bandeau-demo", API_PAS_BRANCHEE ? "Exemple · les vrais membres s'afficheront une fois le bot branché" : "Aperçu · données d'exemple"));
  if (!API_PAS_BRANCHEE) $$('a[href$=".html"]').forEach((a) => { a.href = a.getAttribute("href") + "?demo"; });
  rendre(donneesDemo());
} else if (PAGES_AVEC_DONNEES.includes(PAGE)) {
  const cache = lireCache();
  if (cache) { rendre(cache); affiche = true; }
  actualiser();
  setInterval(() => { if (!document.hidden) actualiser(); }, RAFRAICHISSEMENT_MS);
}
