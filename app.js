(() => {
  "use strict";

  const products = Array.isArray(globalThis.POKEDEX_PRODUCTS) ? globalThis.POKEDEX_PRODUCTS : [];
  const appView = document.querySelector("#app-view");
  const searchInput = document.querySelector("#search-input");
  const clearSearch = document.querySelector("#clear-search");
  const categoryScroller = document.querySelector("#category-scroller");
  const productDialog = document.querySelector("#product-dialog");
  const productDetail = document.querySelector("#product-detail");
  const dialogFavorite = document.querySelector("#dialog-favorite");
  const toast = document.querySelector("#toast");
  const themeButton = document.querySelector("#theme-button");
  const installButton = document.querySelector("#install-button");

  const categories = [
    { id: "all", label: "Tout" },
    { id: "seek", label: "🔥 À chercher" },
    { id: "under30", label: "🐀 Moins de 30 €" },
    { id: "canon", label: "🔩 Canon" },
    { id: "film", label: "🎞️ Argentique" },
    { id: "digicam", label: "📷 Digicam" },
    { id: "lens", label: "🔭 Objectifs" },
    { id: "weird", label: "🧪 Bizarre" },
    { id: "medium", label: "📦 Moyen format" },
    { id: "gem", label: "💎 Pépites" },
    { id: "jackpot", label: "🚨 Jackpots" },
  ];

  const typeLabels = {
    lens: "OBJECTIF",
    film: "ARGENTIQUE",
    medium: "MOYEN FORMAT",
    digicam: "DIGICAM",
  };

  const compatibilityLabels = {
    yes: "OUI, NATIF",
    adapter: "OUI, AVEC BAGUE",
    no: "NON SUR REFLEX CANON",
    camera: "APPAREIL AUTONOME",
  };

  const state = {
    view: "home",
    filter: "all",
    query: "",
    sort: "editorial",
    currentProductId: null,
    favorites: new Set(readStoredArray("chinedex-favorites")),
    imageSources: {},
    installPrompt: null,
  };

  const searchIndexes = new Map(products.map((product) => [product.id, buildSearchIndex(product)]));
  let toastTimer = null;

  function readStoredArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/f\s*\/?\s*(\d)/g, "$1")
      .replace(/(\d)[.,](\d)/g, "$1d$2")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function buildSearchIndex(product) {
    return normalize([
      product.name,
      product.brand,
      product.model,
      product.year,
      product.type,
      product.subtype,
      product.tier,
      product.categories,
      product.tags,
      product.aliases,
      Object.keys(product.specs || {}),
      Object.values(product.specs || {}),
      product.compatibility?.adapter,
      product.compatibility?.notes,
      product.rendering?.tags,
      product.rendering?.description,
      Object.keys(product.useCases || {}),
      product.whyInteresting,
    ].flat(Infinity).join(" "));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatEuro(value) {
    return `${Number(value).toLocaleString("fr-FR")} €`;
  }

  function matchesQuery(product, query) {
    const terms = normalize(query).split(" ").filter(Boolean);
    if (!terms.length) return true;
    const index = searchIndexes.get(product.id) || "";
    return terms.every((term) => index.includes(term));
  }

  function getFilteredProducts() {
    let result = products.filter((product) => {
      const filterMatch = state.filter === "all" || product.categories.includes(state.filter);
      return filterMatch && matchesQuery(product, state.query);
    });

    if (state.view === "favorites") {
      result = result.filter((product) => state.favorites.has(product.id));
    }

    if (state.view === "jackpots") {
      result = result.filter((product) => product.categories.includes("jackpot"));
    }

    if (state.sort === "price") {
      result.sort((a, b) => a.pricing.buyPrice - b.pricing.buyPrice);
    } else if (state.sort === "value") {
      result.sort((a, b) => (b.pricing.typicalMax - b.pricing.buyPrice) - (a.pricing.typicalMax - a.pricing.buyPrice));
    }

    return result;
  }

  function renderCategories() {
    categoryScroller.innerHTML = categories.map((category) => `
      <button
        class="filter-chip ${state.filter === category.id ? "is-active" : ""}"
        type="button"
        data-filter="${category.id}"
        aria-pressed="${state.filter === category.id}"
      >${category.label}</button>
    `).join("");
  }

  function productCard(product) {
    const isFavorite = state.favorites.has(product.id);
    const firstRenderTag = product.rendering.tags[0] || "Objet à examiner";
    const compatibilityTag = product.compatibility.status === "yes" ? "🔩 Canon natif" :
      product.compatibility.status === "adapter" ? "🔩 Adaptable Canon" :
      product.compatibility.status === "no" ? "⚠️ Futur hybride" : "👁️ Appareil autonome";

    return `
      <article class="product-card" data-tier="${product.tier}">
        <button class="card-open" type="button" data-product-id="${product.id}" aria-label="Ouvrir la fiche ${escapeHtml(product.name)}">
          <div class="card-image-wrap">
            <img class="card-image" src="${product.images.thumb}" alt="${escapeHtml(product.name)}, photo de référence" width="480" height="360" loading="lazy" decoding="async">
          </div>
          <div class="card-copy">
            <div class="card-meta">
              <span class="card-badge">${product.badge}</span>
              <span class="card-type">${typeLabels[product.type] || "PHOTO"}</span>
            </div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="card-model">${escapeHtml(product.model)} · ${escapeHtml(product.subtype)}</p>
            <p class="card-tags">${escapeHtml(firstRenderTag)}<br>${escapeHtml(compatibilityTag)}</p>
            <p class="card-buy"><span>Prends-le</span><strong>≤ ${formatEuro(product.pricing.buyPrice)}</strong></p>
          </div>
        </button>
        <button class="card-favorite" type="button" data-favorite-id="${product.id}" aria-label="${isFavorite ? "Retirer" : "Ajouter"} ${escapeHtml(product.name)} ${isFavorite ? "des" : "aux"} cibles" aria-pressed="${isFavorite}">${isFavorite ? "★" : "☆"}</button>
      </article>
    `;
  }

  function productGrid(items, horizontal = false) {
    if (!items.length) return emptyState();
    return `<div class="product-grid ${horizontal ? "is-horizontal" : ""}">${items.map(productCard).join("")}</div>`;
  }

  function sectionBlock(title, subtitle, items, options = {}) {
    const action = options.filter ? `<button class="text-button" type="button" data-show-filter="${options.filter}">Tout voir</button>` : "";
    return `
      <section class="section-block">
        <div class="section-heading">
          <div>
            <h2>${title}</h2>
            ${subtitle ? `<p>${subtitle}</p>` : ""}
          </div>
          ${action}
        </div>
        ${productGrid(items, options.horizontal)}
      </section>
    `;
  }

  function renderHome() {
    const editorial = products.filter((product) => ["seek", "gem"].includes(product.tier)).slice(0, 8);
    const jackpots = products.filter((product) => product.categories.includes("jackpot")).slice(0, 6);
    const canon = products.filter((product) => product.categories.includes("canon")).slice(0, 6);
    const under30 = products.filter((product) => product.categories.includes("under30")).slice(0, 6);

    return `
      <div class="view-content">
        ${sectionBlock("À retenir", "Les pistes les plus réalistes pour la journée", editorial, { horizontal: true, filter: "seek" })}
        ${sectionBlock("Jackpots à reconnaître", "Peu probables, mais impossible de les ignorer", jackpots, { horizontal: true, filter: "jackpot" })}
        ${sectionBlock("Pour ton Canon", "Natif ou adaptable avec mise au point à l'infini", canon, { filter: "canon" })}
        ${sectionBlock("Jusqu'à 30 €", "Le territoire du fun et des essais sans regret", under30, { filter: "under30" })}
      </div>
    `;
  }

  function renderResults(title = "Résultats") {
    const items = getFilteredProducts();
    const activeCategory = categories.find((category) => category.id === state.filter)?.label || "Tout";
    const label = state.query ? `pour « ${escapeHtml(state.query)} »` : activeCategory;

    return `
      <div class="view-content">
        <div class="result-summary">
          <p><strong>${items.length}</strong> ${items.length > 1 ? "pistes" : "piste"} ${label}</p>
          <button class="sort-button" type="button" data-cycle-sort>Tri : ${state.sort === "price" ? "petit prix" : state.sort === "value" ? "écart de valeur" : "sélection"}</button>
        </div>
        <section class="section-block" aria-label="${escapeHtml(title)}">
          ${productGrid(items)}
        </section>
      </div>
    `;
  }

  function renderFavorites() {
    const items = getFilteredProducts();
    return `
      <div class="view-content">
        <section class="section-block">
          <div class="section-heading">
            <div>
              <h2>★ Mes cibles</h2>
              <p>Ta sélection reste enregistrée sur ce téléphone</p>
            </div>
          </div>
          ${items.length ? productGrid(items) : `
            <div class="empty-state">
              <div>
                <div class="empty-symbol" aria-hidden="true">☆</div>
                <h2>Aucune cible pour l'instant</h2>
                <p>Ajoute une étoile aux objets que tu veux mémoriser avant de partir.</p>
                <div class="empty-actions"><button class="text-button" type="button" data-view-link="home">Explorer le Chinédex</button></div>
              </div>
            </div>
          `}
        </section>
      </div>
    `;
  }

  function renderJackpots() {
    const items = getFilteredProducts();
    return `
      <div class="view-content">
        <section class="jackpot-banner">
          <div>
            <p class="route-label">MODE ALERTE</p>
            <h1>Jackpots à ne pas louper</h1>
          </div>
          <p><strong>Si le prix paraît absurde, vérifie d'abord.</strong><br>État, version, objectif et accessoires peuvent changer radicalement la valeur.</p>
        </section>
        <div class="result-summary">
          <p><strong>${items.length}</strong> alertes fortes</p>
          <button class="sort-button" type="button" data-cycle-sort>Tri : ${state.sort === "value" ? "écart de valeur" : state.sort === "price" ? "petit prix" : "sélection"}</button>
        </div>
        ${productGrid(items)}
      </div>
    `;
  }

  function renderMagic() {
    const lensWords = ["LEICA", "LEITZ", "ZEISS", "CARL ZEISS JENA", "ANGÉNIEUX", "TAKUMAR", "ROKKOR", "ZUIKO", "NIKKOR", "HEXANON", "HELIOS", "JUPITER", "MEYER-OPTIK GÖRLITZ"];
    const cameraWords = ["CONTAX", "ROLLEI", "MAMIYA", "BRONICA", "HASSELBLAD", "LEICA", "RICOH GR"];
    const signals = [
      ["🔴", "Bague rouge Canon", "Identifier le modèle exact. C'est probablement une optique L."],
      ["1.2", "Ouverture f/1.2", "Toujours regarder. Même une marque secondaire peut avoir de la valeur."],
      ["1.4", "Ouverture f/1.4", "Regarder la monture, l'état et la marque."],
      ["1:1", "Macro 1:1", "Vrai rapport macro. Chercher la référence complète."],
      ["◉", "Deux objectifs superposés", "Probablement un TLR moyen format. Lire la plaque frontale."],
      ["Ti", "Titane ou Titanium", "Souvent présent sur les compacts premium des années 1990."],
    ];

    return `
      <div class="view-content">
        <section class="magic-intro">
          <h1>Tu lis ça&nbsp;? Arrête-toi.</h1>
          <p>Une antisèche pour reconnaître les inscriptions qui justifient au moins trente secondes d'attention.</p>
        </section>
        <div class="magic-groups">
          <section class="magic-group">
            <h2>Objectifs et opticiens</h2>
            <div class="magic-words">${lensWords.map((word) => `<button type="button" class="magic-word" data-search-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join("")}</div>
          </section>
          <section class="magic-group">
            <h2>Appareils</h2>
            <div class="magic-words">${cameraWords.map((word) => `<button type="button" class="magic-word" data-search-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join("")}</div>
          </section>
          <section class="magic-group">
            <h2>Indices visuels</h2>
            <div class="magic-signals">${signals.map(([icon, title, copy]) => `
              <div class="magic-signal">
                <div class="signal-icon" aria-hidden="true">${icon}</div>
                <div><strong>${title}</strong><span>${copy}</span></div>
              </div>
            `).join("")}</div>
          </section>
        </div>
      </div>
    `;
  }

  function emptyState() {
    return `
      <div class="empty-state">
        <div>
          <div class="empty-symbol" aria-hidden="true">⌕</div>
          <h2>Rien sous cette inscription</h2>
          <p>Essaie une marque, une monture, une focale ou un mot plus court. Exemple : « 50 1.4 », « M42 » ou « macro ».</p>
          <div class="empty-actions"><button class="text-button" type="button" data-reset-search>Effacer les filtres</button></div>
        </div>
      </div>
    `;
  }

  function render() {
    renderCategories();
    const hasSearchContext = Boolean(state.query || state.filter !== "all");

    if (hasSearchContext && state.view !== "magic") {
      appView.innerHTML = renderResults();
    } else if (state.view === "favorites") {
      appView.innerHTML = renderFavorites();
    } else if (state.view === "jackpots") {
      appView.innerHTML = renderJackpots();
    } else if (state.view === "magic") {
      appView.innerHTML = renderMagic();
    } else {
      appView.innerHTML = renderHome();
    }

    document.querySelectorAll("[data-view-link]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.viewLink === state.view);
    });
    document.querySelector("#favorite-count").textContent = state.favorites.size;
    document.querySelector("#product-count").textContent = products.length;
    clearSearch.hidden = !state.query;
  }

  function setView(view) {
    state.view = view;
    if (view !== "home") {
      state.filter = "all";
      state.query = "";
      searchInput.value = "";
    }
    render();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function toggleFavorite(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;

    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast(`${product.name} retiré des cibles`);
    } else {
      state.favorites.add(id);
      showToast(`${product.name} ajouté aux cibles`);
    }

    localStorage.setItem("chinedex-favorites", JSON.stringify([...state.favorites]));
    render();

    if (state.currentProductId === id && productDialog.open) {
      updateDialogFavorite(product);
    }
  }

  function detailMarkup(product) {
    const compatibilityClass = product.compatibility.status;
    const isJackpot = product.tier === "jackpot";
    const source = state.imageSources[product.id];
    const checkedItems = new Set(readStoredArray(`chinedex-check-${product.id}`));
    const typical = `${formatEuro(product.pricing.typicalMin)} à ${formatEuro(product.pricing.typicalMax)}`;

    return `
      <div class="detail-hero">
        <img src="${product.images.hero}" alt="${escapeHtml(product.name)}, vue de référence" width="1000" height="750" decoding="async">
      </div>
      <div class="detail-main">
        <div class="detail-title-row">
          <div class="detail-title">
            <p class="detail-tier ${isJackpot ? "is-jackpot" : ""}">${product.badge} · ${typeLabels[product.type]}</p>
            <h1 id="dialog-title">${escapeHtml(product.name)}</h1>
            <p class="detail-subtitle">${escapeHtml(product.brand)} · ${escapeHtml(product.year)}<br>${escapeHtml(product.model)}</p>
          </div>
          ${isJackpot || product.tier === "gem" ? `<div class="recognize-note">👁️ APPRENDS SA GUEULE</div>` : ""}
        </div>

        <section class="detail-section decision-card ${isJackpot ? "is-jackpot" : ""}">
          <h2>POURQUOI JE M'ARRÊTE&nbsp;?</h2>
          <p>${escapeHtml(product.whyInteresting)}</p>
        </section>

        <section class="detail-section">
          <h2>Caractéristiques utiles</h2>
          <dl class="spec-grid">${Object.entries(product.specs).map(([label, value]) => `
            <div class="spec-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
          `).join("")}</dl>
        </section>

        <section class="detail-section">
          <h2>Compatibilité Canon EOS 1300D</h2>
          <div class="compatibility-box">
            <div class="compatibility-status">
              <strong>Verdict</strong>
              <span class="compatibility-answer is-${compatibilityClass}">${compatibilityLabels[compatibilityClass]}</span>
            </div>
            <div class="compatibility-facts">
              <span class="fact-chip">Adaptateur : ${escapeHtml(product.compatibility.adapter)}</span>
              <span class="fact-chip">Autofocus : ${escapeHtml(product.compatibility.autofocus)}</span>
              <span class="fact-chip">Infini : ${escapeHtml(product.compatibility.infinity)}</span>
            </div>
            <p class="compatibility-notes">${escapeHtml(product.compatibility.notes)}</p>
          </div>
        </section>

        <section class="detail-section">
          <h2>Le rendu</h2>
          <div class="render-tags">${product.rendering.tags.map((tag) => `<span class="render-tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <p>${escapeHtml(product.rendering.description)}</p>
        </section>

        <section class="detail-section">
          <h2>Usages</h2>
          <div class="use-list">${Object.entries(product.useCases).map(([label, score]) => `
            <div class="use-row"><span>${escapeHtml(label)}</span><span class="stars" aria-label="${score} sur 5">${"★".repeat(score)}${"☆".repeat(5 - score)}</span></div>
          `).join("")}</div>
        </section>

        <section class="detail-section">
          <h2>Prix de terrain</h2>
          <dl class="price-grid">
            <div class="price-item"><dt>Cote indicative</dt><dd>${typical}</dd></div>
            <div class="price-item"><dt>Bon prix</dt><dd>≤ ${formatEuro(product.pricing.goodPrice)}</dd></div>
            <div class="price-item is-buy"><dt>Prends-le</dt><dd>≤ ${formatEuro(product.pricing.buyPrice)}</dd></div>
            <div class="price-item is-absurd"><dt>Absurde</dt><dd>≤ ${formatEuro(product.pricing.absurdPrice)}</dd></div>
          </dl>
          <p class="price-note">Repères éditoriaux, pas une garantie de valeur. L'état, la version et les accessoires peuvent tout changer.</p>
        </section>

        <section class="detail-section">
          <h2>À vérifier avant achat</h2>
          <div class="checklist">${product.checklist.map((item, index) => `
            <label class="check-row">
              <input type="checkbox" data-check-index="${index}" ${checkedItems.has(index) ? "checked" : ""}>
              <span class="check-box" aria-hidden="true">✓</span>
              <span class="check-label">${escapeHtml(item)}</span>
            </label>
          `).join("")}</div>
          ${product.warnings.length ? `<ul class="warning-list">${product.warnings.map((warning) => `<li>Attention : ${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
        </section>

        ${source ? `
          <section class="detail-section">
            <h2>Source de l'image</h2>
            <p>Photo de référence provenant du site source. Consulte la page pour les crédits et les droits associés.</p>
            <a class="source-link" href="${escapeHtml(source.descriptionUrl)}" target="_blank" rel="noreferrer">Voir la source et la licence ↗</a>
          </section>
        ` : ""}
      </div>
    `;
  }

  function openProduct(id, pushHistory = true) {
    const product = products.find((item) => item.id === id);
    if (!product) return;

    state.currentProductId = id;
    productDetail.innerHTML = detailMarkup(product);
    document.querySelector("#dialog-position").textContent = `${typeLabels[product.type]} · ${product.year}`;
    updateDialogFavorite(product);

    if (!productDialog.open) productDialog.showModal();
    productDialog.scrollTop = 0;
    if (pushHistory && location.hash !== `#${id}`) history.pushState({ productId: id }, "", `#${id}`);
    document.body.style.overflow = "hidden";
  }

  function closeProduct(updateHistory = true) {
    if (!productDialog.open) return;
    productDialog.close();
    document.body.style.overflow = "";
    state.currentProductId = null;
    if (updateHistory && location.hash) history.pushState({}, "", location.pathname + location.search);
  }

  function updateDialogFavorite(product) {
    const isFavorite = state.favorites.has(product.id);
    dialogFavorite.textContent = isFavorite ? "★" : "☆";
    dialogFavorite.setAttribute("aria-pressed", String(isFavorite));
    dialogFavorite.setAttribute("aria-label", `${isFavorite ? "Retirer" : "Ajouter"} ${product.name} ${isFavorite ? "des" : "aux"} cibles`);
  }

  function cycleSort() {
    const options = state.view === "jackpots" ? ["editorial", "value", "price"] : ["editorial", "price", "value"];
    const current = options.indexOf(state.sort);
    state.sort = options[(current + 1) % options.length];
    render();
  }

  function resetSearch() {
    state.query = "";
    state.filter = "all";
    searchInput.value = "";
    render();
    searchInput.focus();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2300);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function applyTheme(theme) {
    if (theme) {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("chinedex-theme", theme);
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem("chinedex-theme");
    }
    const isDark = getComputedStyle(document.documentElement).colorScheme === "dark";
    themeButton.setAttribute("aria-pressed", String(isDark));
    document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? "#151515" : "#ffffff");
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = currentTheme ? currentTheme === "dark" : systemDark;
    applyTheme(isDark ? "light" : "dark");
  }

  appView.addEventListener("click", (event) => {
    const productButton = event.target.closest("[data-product-id]");
    const favoriteButton = event.target.closest("[data-favorite-id]");
    const viewButton = event.target.closest("[data-view-link]");
    const filterButton = event.target.closest("[data-show-filter]");
    const searchWord = event.target.closest("[data-search-word]");

    if (favoriteButton) toggleFavorite(favoriteButton.dataset.favoriteId);
    else if (productButton) openProduct(productButton.dataset.productId);
    else if (viewButton) setView(viewButton.dataset.viewLink);
    else if (filterButton) {
      state.view = "home";
      state.filter = filterButton.dataset.showFilter;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (event.target.closest("[data-cycle-sort]")) cycleSort();
    else if (event.target.closest("[data-reset-search]")) resetSearch();
    else if (searchWord) {
      state.view = "home";
      state.filter = "all";
      state.query = searchWord.dataset.searchWord;
      searchInput.value = state.query;
      render();
      searchInput.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  document.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-view-link]");
    if (navButton && !appView.contains(navButton)) setView(navButton.dataset.viewLink);
  });

  categoryScroller.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    state.view = "home";
    render();
  });

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    state.view = "home";
    render();
  });

  document.querySelector("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    searchInput.blur();
  });

  clearSearch.addEventListener("click", resetSearch);
  document.querySelector("#dialog-close").addEventListener("click", () => closeProduct());
  dialogFavorite.addEventListener("click", () => state.currentProductId && toggleFavorite(state.currentProductId));

  productDetail.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-check-index]");
    if (!checkbox || !state.currentProductId) return;
    const checked = [...productDetail.querySelectorAll("[data-check-index]:checked")].map((item) => Number(item.dataset.checkIndex));
    localStorage.setItem(`chinedex-check-${state.currentProductId}`, JSON.stringify(checked));
  });

  productDialog.addEventListener("click", (event) => {
    if (event.target === productDialog) closeProduct();
  });

  productDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProduct();
  });

  window.addEventListener("popstate", () => {
    const id = location.hash.slice(1);
    if (id && products.some((product) => product.id === id)) openProduct(id, false);
    else closeProduct(false);
  });

  themeButton.addEventListener("click", toggleTheme);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener("offline", () => showToast("Mode hors ligne actif"));
  window.addEventListener("online", () => showToast("Connexion retrouvée"));

  async function loadImageSources() {
    try {
      const response = await fetch("data/image-sources.json");
      if (response.ok) state.imageSources = await response.json();
    } catch {
      state.imageSources = {};
    }
  }

  async function initialize() {
    applyTheme(localStorage.getItem("chinedex-theme"));
    await loadImageSources();
    render();

    const initialId = location.hash.slice(1);
    if (initialId && products.some((product) => product.id === initialId)) openProduct(initialId, false);

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {
        showToast("Le cache hors ligne n'a pas pu démarrer");
      });
    }
  }

  initialize();
})();
