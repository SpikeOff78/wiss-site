/* ============================================================
   WISSKSRR — script commun à toutes les pages
   Données : bot Discord (Render), routes /api/site et /api/membres.
   Aucune donnée inventée : si une info manque, on affiche « — ».
   ============================================================ */
"use strict";

const API_URL = "https://wiss-bot-app.onrender.com";
const DELAI_MAX_MS = 70_000;          // un redémarrage du bot peut prendre ~1 min
const RAFRAICHISSEMENT_MS = 60_000;   // le bot met ses données à jour toutes les 60 s
const CLE_CACHE = "wiss-snapshot";    // dernier état reçu (secours si le bot tombe)
const CLE_PSEUDO = "wiss-pseudo";     // pseudo choisi pour « Mon profil »
const PAR_PAGE = 10;

const PAGE = document.body.dataset.page;
const fmt = new Intl.NumberFormat("fr-FR");
const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Paliers par défaut (remplacés par les vrais noms/couleurs envoyés par le bot)
let PALIERS = [
  { niveau: 15, nom: "Petit de Paname" }, { niveau: 30, nom: "Bruno" }, { niveau: 50, nom: "Lahkdar" },
  { niveau: 80, nom: "Norbert" }, { niveau: 120, nom: "Saber de Vitry" }, { niveau: 150, nom: "Le Hajj" },
];

/* ============================================================ Interface commune */
const barreNav = $("#nav");
const surDefilement = () => barreNav.classList.toggle("defile", scrollY > 10);
addEventListener("scroll", surDefilement, { passive: true });
surDefilement();

const menuBtn = $("#menu-btn"), navLiens = $("#nav-liens");
function menu(ouvrir) {
  navLiens.classList.toggle("ouvert", ouvrir);
  menuBtn.setAttribute("aria-expanded", String(ouvrir));
  menuBtn.setAttribute("aria-label", ouvrir ? "Fermer le menu" : "Ouvrir le menu");
}
menuBtn.addEventListener("click", () => menu(!navLiens.classList.contains("ouvert")));
navLiens.addEventListener("click", (ev) => { if (ev.target.closest("a")) menu(false); });
addEventListener("keydown", (ev) => { if (ev.key === "Escape") menu(false); });
document.addEventListener("click", (ev) => {
  if (navLiens.classList.contains("ouvert") && !ev.target.closest("#nav")) menu(false);
});

$$(".annee").forEach((n) => (n.textContent = new Date().getFullYear()));

// Apparition douce des sections
if ("IntersectionObserver" in window && !calme) {
  const obs = new IntersectionObserver((entrees) => entrees.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("visible"); obs.unobserve(en.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  $$("[data-apparition]").forEach((n) => obs.observe(n));
} else {
  $$("[data-apparition]").forEach((n) => n.classList.add("visible"));
}

// Notification
let minuteurToast;
function toast(texte) {
  const t = $("#toast");
  t.textContent = texte;
  t.classList.add("visible");
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => t.classList.remove("visible"), 1800);
}

async function copier(texte) {
  try { await navigator.clipboard.writeText(texte); }
  catch {
    const zone = el("textarea"); zone.value = texte; zone.setAttribute("readonly", "");
    zone.style.cssText = "position:fixed;opacity:0"; document.body.append(zone); zone.select();
    try { document.execCommand("copy"); } finally { zone.remove(); }
  }
  toast("Commande copiée");
}
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-copier]");
  if (!b) return;
  ev.stopPropagation();
  copier(b.dataset.copier);
});

// Fenêtres (<dialog>) : bouton fermer + clic sur le fond
$$("dialog.fenetre").forEach((d) => {
  d.addEventListener("click", (ev) => { if (ev.target === d || ev.target.closest("[data-fermer]")) d.close(); });
});

/* ============================================================ Outils */
// Tout texte venant du bot passe par textContent : jamais interprété comme du HTML.
function el(tag, classe, texte) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texte !== undefined && texte !== null) n.textContent = texte;
  return n;
}
const nombre = (v) => (typeof v === "number" ? fmt.format(v) : "—");
const DOMAINES_IMAGES = ["https://cdn.discordapp.com/", "https://media.discordapp.net/", "https://static-cdn.jtvnw.net/"];
const urlSure = (u) => (typeof u === "string" && DOMAINES_IMAGES.some((d) => u.startsWith(d)) ? u : null);
const normaliser = (t) => (t || "").normalize("NFKC").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function avatar(m, classe = "avatar") {
  const lettre = () => {
    const d = el("div", classe, m && m.pseudo ? [...m.pseudo.trim()][0]?.toUpperCase() || "?" : "?");
    d.setAttribute("aria-hidden", "true");
    return d;
  };
  const url = m && urlSure(m.avatar);
  if (!url) return lettre();
  const img = el("img", classe);
  img.src = url; img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.width = 96; img.height = 96;
  img.addEventListener("error", () => img.replaceWith(lettre()), { once: true });
  return img;
}

// Même courbe que le bot : XP totale pour atteindre le niveau n = 300 × n²
const xpPourNiveau = (n) => (n <= 0 ? 0 : 300 * n * n);
function progression(xp, niveau) {
  const bas = xpPourNiveau(niveau), haut = xpPourNiveau(niveau + 1);
  const pct = Math.max(0, Math.min(100, ((xp - bas) / (haut - bas)) * 100));
  return { pct, manque: Math.max(0, haut - xp), bas, haut };
}
const roleActuel = (niv) => [...PALIERS].reverse().find((p) => niv >= p.niveau) || null;
const prochainRole = (niv) => PALIERS.find((p) => niv < p.niveau) || null;

function barre(pct) {
  const b = el("div", "barre"), i = el("i");
  b.setAttribute("role", "progressbar");
  b.setAttribute("aria-valuemin", "0"); b.setAttribute("aria-valuemax", "100"); b.setAttribute("aria-valuenow", String(Math.round(pct)));
  b.append(i);
  requestAnimationFrame(() => requestAnimationFrame(() => (i.style.width = `${pct.toFixed(1)}%`)));
  return b;
}

function compter(noeud, cible) {
  if (!noeud) return;
  noeud.classList.remove("squelette");
  if (typeof cible !== "number") { noeud.textContent = "—"; return; }
  const depart = Number(noeud.dataset.v || 0);
  noeud.dataset.v = cible;
  if (calme || depart === cible || document.hidden) { noeud.textContent = fmt.format(cible); return; }
  const t0 = performance.now(), duree = 900;
  const pas = (t) => {
    const p = Math.min(1, (t - t0) / duree), ease = 1 - Math.pow(1 - p, 3);
    noeud.textContent = fmt.format(Math.round(depart + (cible - depart) * ease));
    if (p < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

function ilYa(date) {
  const s = (new Date(date).getTime() - Date.now()) / 1000;
  if (!isFinite(s)) return "";
  const a = Math.abs(s);
  if (a < 60) return "à l'instant";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/* ============================================================ Données */
function lireCache() {
  try { const c = JSON.parse(localStorage.getItem(CLE_CACHE)); return c && c.d && c.d.pret ? c : null; }
  catch { return null; }
}
function ecrireCache(d) {
  try { localStorage.setItem(CLE_CACHE, JSON.stringify({ t: Date.now(), d })); } catch { /* stockage plein ou bloqué */ }
}
const lirePseudo = () => { try { return localStorage.getItem(CLE_PSEUDO) || ""; } catch { return ""; } };
const ecrirePseudo = (p) => { try { localStorage.setItem(CLE_PSEUDO, p); } catch { /* rien */ } };

async function appelApi(chemin, delai = DELAI_MAX_MS) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), delai);
  try {
    const r = await fetch(`${API_URL}${chemin}`, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(minuteur); }
}

let derniereDonnee = null;      // dernier snapshot affiché
async function rechercherMembres(q) {
  try {
    const r = await appelApi(`/api/membres?q=${encodeURIComponent(q)}`, 20_000);
    return { total: r.total, resultats: Array.isArray(r.resultats) ? r.resultats : [] };
  } catch {
    // Bot injoignable : on cherche au moins dans le top 50 déjà reçu
    const top = derniereDonnee?.top || [];
    const n = normaliser(q);
    return { total: derniereDonnee?.stats?.membres_classes, resultats: top.filter((m) => normaliser(m.pseudo).includes(n)).slice(0, 8), horsLigne: true };
  }
}

function majEtat(texte, classe) {
  const n = $("#etat-donnees");
  if (!n) return;
  n.className = `etat-donnees ${classe || ""}`;
  n.lastElementChild.textContent = texte;
}

let bandeau;
function afficherBandeauSecours(t) {
  if (!bandeau) { bandeau = el("div", "bandeau-secours"); bandeau.setAttribute("role", "status"); document.body.append(bandeau); }
  const h = new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  bandeau.textContent = `Le bot redémarre : données de ${h}. Mise à jour automatique dès son retour.`;
}
function masquerBandeauSecours() { if (bandeau) { bandeau.remove(); bandeau = null; } }

function rendre(d, depuisCache = false, quand = Date.now()) {
  derniereDonnee = d;
  if (Array.isArray(d.paliers) && d.paliers.length) {
    PALIERS = d.paliers.map((p) => ({ niveau: p.niveau, nom: p.nom || PALIERS.find((x) => x.niveau === p.niveau)?.nom || `Niveau ${p.niveau}`, couleur: p.couleur }));
  }
  if (PAGE === "index") rendreAccueil(d);
  if (PAGE === "classement") rendreClassement(d);
  if (PAGE === "niveaux") rendreNiveaux(d);
  const maj = d.maj ? ilYa(d.maj) : "";
  if (depuisCache && Date.now() - quand > 5 * 60_000) majEtat(`Dernières données connues · ${maj}`, "ancien");
  else majEtat(`Synchronisé avec le Discord · mis à jour ${maj}${d.stats ? ` · ${nombre(d.stats.membres_classes)} membres classés` : ""}`);
}

function rendreIndisponible() {
  $$(".squelette").forEach((n) => { n.classList.remove("squelette"); if (!n.classList.contains("avatar") && !n.children.length) n.textContent = "—"; });
  $$(".squelette-ligne").forEach((n) => n.remove());
  majEtat("Le bot ne répond pas pour le moment. Réessaie dans une minute.", "erreur");
  if (PAGE === "classement") {
    const l = $("#liste"); l.replaceChildren();
    const v = el("li", "message-vide"); v.append(el("b", null, "Classement momentanément indisponible"), "Il reste visible sur le Discord avec !leaderboard.");
    l.append(v);
  }
  if (PAGE === "index") {
    $("#fil-activite").replaceChildren(el("li", "vide", "L'activité s'affichera dès que le bot répondra."));
    rendreLive(undefined);
  }
}

let affiche = false;
async function actualiser() {
  try {
    const d = await appelApi("/api/site");
    if (!d.pret) throw new Error("données pas prêtes");
    ecrireCache(d);
    masquerBandeauSecours();
    rendre(d);
    affiche = true;
  } catch (e) {
    console.warn("[WISSKSRR] API indisponible :", e.message);
    const c = lireCache();
    if (c && affiche) afficherBandeauSecours(c.t);
    else if (c) { rendre(c.d, true, c.t); affiche = true; afficherBandeauSecours(c.t); }
    else if (!affiche) rendreIndisponible();
  }
}

/* ============================================================ Accueil */
function rendreAccueil(d) {
  const s = d.serveur || {}, st = d.stats || {};
  const icone = urlSure(s.icone);
  if (icone) $("#w-icone").src = icone;
  compter($("#w-membres"), s.membres);
  compter($("#w-en-ligne"), s.en_ligne);
  compter($("#s-membres"), s.membres);
  compter($("#s-en-ligne"), s.en_ligne);
  compter($("#s-niv-max"), st.niveau_max);
  compter($("#s-xp"), st.xp_total);
  if (typeof s.membres === "number") {
    $("#hp-membres").textContent = nombre(s.membres);
    $("#hp-en-ligne").textContent = nombre(s.en_ligne);
    $("#hero-preuve").hidden = false;
  }

  const top = Array.isArray(d.top) ? d.top : [];
  const t1 = top[0], lien = $("#w-top1");
  if (t1) {
    lien.href = `classement.html?user=${encodeURIComponent(t1.pseudo)}`;
    const infos = el("div"); infos.append(el("span", "label", "🥇 N°1 du serveur"), el("span", "pseudo", t1.pseudo), el("span", "detail", `Niv. ${t1.niveau} · ${nombre(t1.xp)} XP`));
    lien.replaceChildren(avatar(t1), infos);
  } else {
    lien.replaceChildren(el("span", "detail", "Le classement arrive."));
  }

  const mini = $("#mini-top"); mini.replaceChildren();
  if (!top.length) mini.append(el("li", "message-vide", "Le classement arrive."));
  top.slice(0, 5).forEach((m) => {
    const li = el("li"), a = el("a");
    a.href = `classement.html?user=${encodeURIComponent(m.pseudo)}`;
    a.append(el("span", "rang", ["🥇", "🥈", "🥉"][m.rang - 1] || String(m.rang)), avatar(m), el("span", "pseudo", m.pseudo), el("span", "xp", `${nombre(m.xp)} XP`));
    li.append(a); mini.append(li);
  });

  rendreLive(d.twitch);
  rendreActivite(d.activite);
}

function rendreLive(t) {
  const carte = $("#live"), pastille = $("#pastille-live");
  if (!carte) return;
  const statut = $("#live-statut"), media = $("#live-media"), titre = $("#live-titre"), sous = $("#live-sous"), btn = $("#live-btn");
  carte.classList.remove("en-live"); pastille.classList.remove("en-live");
  titre.hidden = true; sous.hidden = true;

  if (!t) { // statut Twitch non branché ou injoignable : on ne devine rien
    statut.textContent = "Live Twitch";
    const h = el("div", "hors"); h.append(el("b", null, "twitch.tv/wissksrr"), "Les lives de Wiss, le soir sur Twitch.");
    media.replaceChildren(h);
    btn.textContent = "VOIR LA CHAÎNE TWITCH";
    return;
  }
  if (t.live) {
    carte.classList.add("en-live"); pastille.classList.add("en-live");
    statut.textContent = "Wiss est en live";
    $(".texte", pastille).textContent = "En live sur Twitch";
    const mini = urlSure(t.miniature);
    if (mini) {
      const img = el("img"); img.src = `${mini}?t=${Math.floor(Date.now() / 60000)}`; img.alt = "Aperçu du live"; img.loading = "lazy";
      media.replaceChildren(img);
    } else {
      const h = el("div", "hors"); h.append(el("b", null, "🔴 En direct"), "Clique pour rejoindre le live.");
      media.replaceChildren(h);
    }
    if (typeof t.spectateurs === "number") media.append(el("span", "live-badge-vues", `👁 ${nombre(t.spectateurs)} spectateurs`));
    if (t.titre) { titre.textContent = t.titre; titre.hidden = false; }
    const infos = [t.jeu, t.debut ? `depuis ${ilYa(t.debut).replace("il y a ", "")}` : null].filter(Boolean).join(" · ");
    if (infos) { sous.textContent = infos; sous.hidden = false; }
    btn.textContent = "REGARDER LE LIVE";
    return;
  }
  statut.textContent = "Wiss est hors ligne";
  $(".texte", pastille).textContent = "Hors ligne · Twitch";
  const h = el("div", "hors"); h.append(el("b", null, "⚫ Hors ligne"), "Active les notifs dans #réseaux pour ne rien rater.");
  media.replaceChildren(h);
  if (t.prochain && t.prochain.debut) {
    const date = new Date(t.prochain.debut);
    sous.textContent = `Prochain live : ${date.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}${t.prochain.titre ? ` · ${t.prochain.titre}` : ""}`;
    sous.hidden = false;
  }
  btn.textContent = "VOIR LA CHAÎNE TWITCH";
}

const TAGS = { niveau: ["Niveau", ""], palier: ["Rôle", "tag-palier"], top10: ["Top 10", "tag-top10"], arrivee: ["Nouveau", "tag-arrivee"] };
function rendreActivite(liste) {
  const fil = $("#fil-activite");
  if (!fil) return;
  fil.replaceChildren();
  if (!Array.isArray(liste) || !liste.length) {
    fil.append(el("li", "vide", "L'activité du serveur apparaîtra ici : level-up, nouveaux rôles, entrées dans le top 10, arrivées."));
    return;
  }
  liste.slice(0, 7).forEach((ev) => {
    const li = el("li"), quoi = el("span", "quoi");
    const [lib, cls] = TAGS[ev.type] || ["", ""];
    if (lib) quoi.append(el("span", `tag ${cls}`, lib));
    quoi.append(el("b", null, ev.pseudo), ` ${ev.texte || ""}`);
    li.append(avatar(ev), quoi, el("span", "quand", ev.t ? ilYa(ev.t) : ""));
    fil.append(li);
  });
}

/* ============================================================ Profil membre (fenêtre) */
function ouvrirProfil(m, total) {
  const fen = $("#fenetre-profil");
  if (!fen || !m) return;
  const p = progression(m.xp, m.niveau), role = roleActuel(m.niveau), suivant = prochainRole(m.niveau);
  const c = $("#profil-contenu"); c.replaceChildren();

  const tete = el("div", "profil-tete"), id = el("div");
  id.append(el("h3", null, m.pseudo), el("p", "profil-rang", `Classement #${nombre(m.rang)}${typeof total === "number" ? ` sur ${nombre(total)}` : ""}`));
  tete.append(avatar(m), id);

  const niv = el("div", "profil-niv"); niv.append(el("b", null, `Niveau ${m.niveau}`), el("span", null, `${Math.floor(p.pct)} %`));

  const infos = el("div", "profil-infos");
  const info = (lib, val, couleur) => {
    const d = el("div", "profil-info"), b = el("b");
    if (couleur && /^#[0-9a-f]{6}$/i.test(couleur)) { const pt = el("span", "pastille-role"); pt.style.background = couleur; b.append(pt); }
    b.append(val); d.append(el("span", null, lib), b); return d;
  };
  infos.append(info("XP totale", `${nombre(m.xp)} XP`), info("Niveau suivant dans", `${nombre(p.manque)} XP`),
    info("Rôle actuel", role ? role.nom : "Aucun palier encore", role && role.couleur ? role.couleur : null),
    info("Rang", `#${nombre(m.rang)}`));

  c.append(tete, niv, barre(p.pct), infos);
  if (suivant) {
    const pr = el("p", "profil-prochain");
    pr.append("Prochain rôle : ", el("b", null, suivant.nom), ` au niveau ${suivant.niveau}, encore `, el("b", null, `${nombre(Math.max(0, xpPourNiveau(suivant.niveau) - m.xp))} XP`), ".");
    c.append(pr);
  }
  const actions = el("div", "profil-actions"), partager = el("button", "btn btn-secondaire", "Copier le lien");
  partager.type = "button";
  partager.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}classement.html?user=${encodeURIComponent(m.pseudo)}`;
    try { await navigator.clipboard.writeText(url); toast("Lien copié"); } catch { toast(url); }
  });
  const moi = el("button", "btn btn-principal", lirePseudo() === m.pseudo ? "C'est mon profil ✓" : "C'est moi");
  moi.type = "button";
  moi.addEventListener("click", () => { ecrirePseudo(m.pseudo); moi.textContent = "C'est mon profil ✓"; toast("Profil enregistré sur cet appareil"); if (PAGE === "classement") dessinerListe(); });
  actions.append(partager, moi);
  c.append(actions);
  if (!fen.open) fen.showModal();
}

// Fenêtre de recherche « Mon profil » (classement)
function demanderPseudo() {
  const fen = $("#fenetre-profil"), c = $("#profil-contenu");
  c.replaceChildren();
  const h = el("h3", null, "Trouve ton profil"); h.style.paddingRight = "40px";
  const p = el("p", null, "Tape ton pseudo sur le serveur. Il sera retenu sur cet appareil.");
  p.style.cssText = "color:var(--texte-2);margin-top:8px";
  const form = el("form"); form.style.cssText = "display:flex;gap:10px;margin-top:16px;flex-wrap:wrap";
  const champ = el("input", "champ"); champ.type = "search"; champ.placeholder = "Ton pseudo"; champ.value = lirePseudo(); champ.style.flex = "1 1 200px";
  champ.setAttribute("aria-label", "Ton pseudo");
  const ok = el("button", "btn btn-principal", "Chercher"); ok.type = "submit";
  const res = el("div"); res.setAttribute("aria-live", "polite");
  form.append(champ, ok);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const q = champ.value.trim();
    if (q.length < 2) { res.replaceChildren(el("p", "message-vide", "Tape au moins 2 caractères.")); return; }
    res.replaceChildren(el("p", "message-vide", "Recherche…"));
    const r = await rechercherMembres(q);
    afficherChoix(res, r, (m) => { ecrirePseudo(m.pseudo); ouvrirProfil(m, r.total); if (PAGE === "classement") dessinerListe(); });
  });
  c.append(h, p, form, res);
  if (!fen.open) fen.showModal();
  champ.focus();
}

function afficherChoix(zone, r, choisir) {
  zone.replaceChildren();
  if (!r.resultats.length) {
    const v = el("div", "message-vide"); v.style.marginTop = "12px";
    v.append(el("b", null, "Aucun membre trouvé"), r.horsLigne ? "Le bot ne répond pas : seule la recherche dans le top 50 est possible." : "Vérifie l'orthographe. Seuls les membres qui ont déjà gagné de l'XP sont classés.");
    zone.append(v); return;
  }
  const ul = el("ul", "choix-membres");
  r.resultats.forEach((m) => {
    const li = el("li"), b = el("button"); b.type = "button";
    b.append(avatar(m), el("span", "pseudo", m.pseudo), el("span", "rang", `#${nombre(m.rang)} · Niv. ${m.niveau}`));
    b.addEventListener("click", () => choisir(m));
    li.append(b); ul.append(li);
  });
  zone.append(ul);
}

/* ============================================================ Classement */
const etatCl = { top: [], total: null, tri: "xp", q: "", visibles: PAR_PAGE, cible: new URLSearchParams(location.search).get("user"), cibleFaite: false, recherche: 0 };

function rendreClassement(d) {
  etatCl.top = Array.isArray(d.top) ? d.top : [];
  etatCl.total = d.stats?.membres_classes;

  const podium = $("#podium"); podium.replaceChildren();
  [[2, "🥈"], [1, "🥇"], [3, "🥉"]].forEach(([rang, medaille]) => {
    const m = etatCl.top.find((x) => x.rang === rang);
    const carte = el("article", `carte podium-carte p${rang}`);
    const infos = el("div", "infos");
    if (m) {
      infos.append(el("span", "pseudo", m.pseudo), el("span", "niv", `Niveau ${m.niveau}`), el("span", "xp", `${nombre(m.xp)} XP`));
      carte.append(el("span", "medaille", medaille), avatar(m), infos, barre(progression(m.xp, m.niveau).pct));
      carte.tabIndex = 0; carte.setAttribute("role", "button"); carte.setAttribute("aria-label", `Profil de ${m.pseudo}, ${rang}e`);
      carte.addEventListener("click", () => ouvrirProfil(m, etatCl.total));
      carte.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ouvrirProfil(m, etatCl.total); } });
    } else {
      infos.append(el("span", "pseudo", "Place libre"), el("span", "niv", "À prendre"));
      carte.append(el("span", "medaille", medaille), avatar(null), infos);
    }
    podium.append(carte);
  });

  // ?user=PSEUDO : on affiche assez de lignes pour qu'il soit visible
  if (etatCl.cible && !etatCl.cibleFaite) {
    const m = etatCl.top.find((x) => normaliser(x.pseudo) === normaliser(etatCl.cible));
    if (m && m.rang > 3) etatCl.visibles = Math.max(etatCl.visibles, Math.ceil((m.rang - 3) / PAR_PAGE) * PAR_PAGE);
  }
  dessinerListe();
}

function ligneMembre(m) {
  const li = el("li", "ligne");
  const pseudoMoi = normaliser(lirePseudo()), cible = normaliser(etatCl.cible || "");
  if ((pseudoMoi && normaliser(m.pseudo) === pseudoMoi) || (cible && normaliser(m.pseudo) === cible)) li.classList.add("moi");
  li.tabIndex = 0; li.setAttribute("role", "button"); li.setAttribute("aria-label", `Profil de ${m.pseudo}, rang ${m.rang}`);
  const p = progression(m.xp, m.niveau);
  const prog = el("div", "progression"); prog.append(el("span", "niv", `Niv. ${m.niveau}`), barre(p.pct));
  li.append(el("span", "rang", m.rang <= 3 ? ["🥇", "🥈", "🥉"][m.rang - 1] : `#${m.rang}`), avatar(m), el("span", "pseudo", m.pseudo), prog, el("span", "xp", `${nombre(m.xp)} XP`));
  li.addEventListener("click", () => ouvrirProfil(m, etatCl.total));
  li.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ouvrirProfil(m, etatCl.total); } });
  return li;
}

function trier(liste) {
  const l = [...liste];
  if (etatCl.tri === "niveau") l.sort((a, b) => b.niveau - a.niveau || b.xp - a.xp);
  else if (etatCl.tri === "alpha") l.sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }));
  else l.sort((a, b) => a.rang - b.rang);
  return l;
}

function dessinerListe() {
  const liste = $("#liste"), plus = $("#plus"), horsTop = $("#hors-top");
  if (!liste) return;
  liste.replaceChildren(); horsTop.replaceChildren();
  const q = normaliser(etatCl.q);

  if (q) {
    const trouves = trier(etatCl.top.filter((m) => normaliser(m.pseudo).includes(q)));
    trouves.forEach((m) => liste.append(ligneMembre(m)));
    plus.hidden = true;
    chercherHorsTop(etatCl.q, trouves.length);
    return;
  }

  if (!etatCl.top.length) {
    const v = el("li", "message-vide"); v.append(el("b", null, "Le classement arrive"), "Les membres apparaîtront dès qu'ils auront gagné de l'XP.");
    liste.append(v); plus.hidden = true; return;
  }

  const reste = trier(etatCl.top.filter((m) => m.rang > 3));
  const montres = reste.slice(0, etatCl.visibles);
  let groupe = null;
  montres.forEach((m) => {
    if (etatCl.tri === "xp") {
      const g = m.rang <= 10 ? "Top 10" : m.rang <= 25 ? "Top 25" : "Top 50";
      if (g !== groupe) { liste.append(el("li", "groupe", g)); groupe = g; }
    }
    liste.append(ligneMembre(m));
  });
  plus.hidden = montres.length >= reste.length;
  plus.textContent = `Charger plus (${reste.length - montres.length} restants)`;

  if (etatCl.cible && !etatCl.cibleFaite) {
    etatCl.cibleFaite = true;
    const ligne = $(".ligne.moi", liste) || null;
    if (ligne) setTimeout(() => ligne.scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "center" }), 300);
    else if (!etatCl.top.some((m) => normaliser(m.pseudo) === normaliser(etatCl.cible))) {
      $("#recherche").value = etatCl.cible; etatCl.q = etatCl.cible; dessinerListe();
    }
  }
}

let minuteurRecherche;
function chercherHorsTop(q, nbLocaux) {
  clearTimeout(minuteurRecherche);
  const zone = $("#hors-top"), jeton = ++etatCl.recherche;
  if (normaliser(q).length < 2) {
    if (!nbLocaux) zone.append(Object.assign(el("div", "message-vide"), { textContent: "Tape au moins 2 caractères." }));
    return;
  }
  const info = el("p", "message-vide", nbLocaux ? "Recherche dans tout le serveur…" : "Pas dans le top 50 · recherche dans tout le serveur…");
  zone.append(info);
  minuteurRecherche = setTimeout(async () => {
    const r = await rechercherMembres(q);
    if (jeton !== etatCl.recherche) return;           // une recherche plus récente a été lancée
    zone.replaceChildren();
    const autres = r.resultats.filter((m) => m.rang > 50);
    if (autres.length) {
      zone.append(el("p", "groupe", "Hors du top 50"));
      const ul = el("ol", "liste"); autres.forEach((m) => ul.append(ligneMembre(m))); zone.append(ul);
    } else if (!nbLocaux) {
      const v = el("div", "message-vide");
      v.append(el("b", null, "Aucun résultat"), r.horsLigne ? "Le bot ne répond pas : recherche limitée au top 50." : "Aucun membre classé ne correspond à cette recherche.");
      zone.append(v);
    }
  }, 300);
}

if (PAGE === "classement") {
  $("#recherche").addEventListener("input", (ev) => { etatCl.q = ev.target.value; dessinerListe(); });
  $$(".segments [data-tri]").forEach((b) => b.addEventListener("click", () => {
    etatCl.tri = b.dataset.tri;
    $$(".segments [data-tri]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    dessinerListe();
  }));
  $("#plus").addEventListener("click", () => { etatCl.visibles += PAR_PAGE; dessinerListe(); });
  $("#btn-mon-profil").addEventListener("click", async () => {
    const pseudo = lirePseudo();
    if (!pseudo) { demanderPseudo(); return; }
    const local = etatCl.top.find((m) => m.pseudo === pseudo);
    if (local) { ouvrirProfil(local, etatCl.total); return; }
    const r = await rechercherMembres(pseudo);
    const exact = r.resultats.find((m) => m.pseudo === pseudo);
    if (exact) ouvrirProfil(exact, r.total); else demanderPseudo();
  });
}

/* ============================================================ Niveaux */
function rendreNiveaux() {
  $$(".palier").forEach((li) => {
    const p = PALIERS.find((x) => x.niveau === Number(li.dataset.niveau));
    if (!p) return;
    $(".nom-role", li).textContent = p.nom;
    if (p.couleur && /^#[0-9a-f]{6}$/i.test(p.couleur)) li.style.setProperty("--couleur-role", p.couleur);
  });
}

function afficherProgression(m, total) {
  const zone = $("#resultat-progression"); zone.replaceChildren();
  const p = progression(m.xp, m.niveau), suivant = prochainRole(m.niveau);
  const phrase = el("p", "phrase"); phrase.append(`${m.pseudo}, tu es `, el("em", null, `niveau ${m.niveau}`), ".");
  const detail = el("p", "detail");
  detail.textContent = `Il te manque ${nombre(p.manque)} XP pour atteindre le niveau ${m.niveau + 1}. Rang #${nombre(m.rang)}${typeof total === "number" ? ` sur ${nombre(total)}` : ""}.`;
  const bornes = el("div", "bornes"); bornes.append(el("span", null, `Niv. ${m.niveau} · ${nombre(p.bas)} XP`), el("span", null, `${Math.floor(p.pct)} %`), el("span", null, `Niv. ${m.niveau + 1} · ${nombre(p.haut)} XP`));
  zone.append(phrase, detail, barre(p.pct), bornes);
  if (suivant) {
    const pr = el("p", "profil-prochain");
    pr.append("Prochaine récompense : le rôle ", el("b", null, suivant.nom), ` au niveau ${suivant.niveau}, encore `, el("b", null, `${nombre(Math.max(0, xpPourNiveau(suivant.niveau) - m.xp))} XP`), ".");
    zone.append(pr);
  } else {
    zone.append(el("p", "profil-prochain", "Tous les rôles sont débloqués. Respect."));
  }
  $$(".palier").forEach((li) => li.classList.toggle("atteint", m.niveau >= Number(li.dataset.niveau)));
}

if (PAGE === "niveaux") {
  const form = $("#form-progression"), champ = $("#pseudo-progression"), zone = $("#resultat-progression");
  const lancer = async (q) => {
    if (q.trim().length < 2) { zone.replaceChildren(el("p", "message-vide", "Tape au moins 2 caractères.")); return; }
    zone.replaceChildren(el("p", "message-vide", "Recherche…"));
    const r = await rechercherMembres(q.trim());
    const exact = r.resultats.find((m) => normaliser(m.pseudo) === normaliser(q));
    if (exact) { ecrirePseudo(exact.pseudo); afficherProgression(exact, r.total); return; }
    if (r.resultats.length === 1) { ecrirePseudo(r.resultats[0].pseudo); afficherProgression(r.resultats[0], r.total); return; }
    afficherChoix(zone, r, (m) => { ecrirePseudo(m.pseudo); champ.value = m.pseudo; afficherProgression(m, r.total); });
  };
  form.addEventListener("submit", (ev) => { ev.preventDefault(); lancer(champ.value); });
  const memo = lirePseudo();
  if (memo) { champ.value = memo; lancer(memo); }
}

/* ============================================================ Commandes */
if (PAGE === "commandes") {
  const grille = $("#grille-cmd"), champ = $("#recherche-cmd"), vide = $("#cmd-vide");
  let filtre = "toutes";
  const appliquer = () => {
    const q = normaliser(champ.value);
    let n = 0;
    $$(".cmd", grille).forEach((c) => {
      const ok = (filtre === "toutes" || c.dataset.acces === filtre) && (!q || normaliser(c.textContent).includes(q));
      c.hidden = !ok; if (ok) n++;
    });
    vide.hidden = n > 0;
  };
  $$(".segments [data-filtre]").forEach((b) => b.addEventListener("click", () => {
    filtre = b.dataset.filtre;
    $$(".segments [data-filtre]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    appliquer();
  }));
  champ.addEventListener("input", appliquer);

  const fen = $("#fenetre-cmd");
  let courante = "";
  const ouvrir = (carte) => {
    const c = JSON.parse(carte.dataset.cmd);
    courante = c.nom;
    $("#cmd-titre").textContent = c.nom;
    $("#cmd-desc").textContent = c.desc;
    $("#cmd-usage").textContent = c.usage;
    $("#cmd-acces").textContent = `🔐 ${c.acces}`;
    $("#cmd-salon").textContent = `📍 ${c.salon}`;
    const ex = $("#cmd-exemples"); ex.replaceChildren();
    c.exemples.forEach((x) => ex.append(el("code", "exemple", x)));
    fen.showModal();
  };
  grille.addEventListener("click", (ev) => { const c = ev.target.closest(".cmd"); if (c && !ev.target.closest("[data-copier]")) ouvrir(c); });
  grille.addEventListener("keydown", (ev) => {
    const c = ev.target.closest(".cmd");
    if (c && ev.target === c && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); ouvrir(c); }
  });
  $("#cmd-copier").addEventListener("click", () => copier(courante));
}

/* ============================================================ Démarrage */
if (["index", "classement", "niveaux"].includes(PAGE)) {
  const c = lireCache();
  if (c) { rendre(c.d, true, c.t); affiche = true; }   // affichage immédiat, puis données fraîches
  actualiser();
  setInterval(() => { if (!document.hidden) actualiser(); }, RAFRAICHISSEMENT_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && affiche) actualiser(); });
}
