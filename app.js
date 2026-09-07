import { CATEGORY_META, FILTER_TAGS, STUDY_SPOTS } from "./data.js";

(function () {
  "use strict";

  var state = {
    search: "",
    category: "All",
    tags: new Set(),
    selectedId: null
  };

  var els = {
    searchInput: document.getElementById("search-input"),
    categoryPills: document.getElementById("category-pills"),
    tagRow: document.getElementById("tag-row"),
    spotList: document.getElementById("spot-list"),
    resultsCount: document.getElementById("results-count"),
    emptyState: document.getElementById("empty-state"),
    clearFiltersBtn: document.getElementById("clear-filters-btn"),
    legend: document.getElementById("legend"),
    drawer: document.getElementById("drawer"),
    drawerBackdrop: document.getElementById("drawer-backdrop"),
    drawerContent: document.getElementById("drawer-content"),
    drawerClose: document.getElementById("drawer-close"),
    spotCount: document.getElementById("spot-count"),
    listPane: document.getElementById("list-pane"),
    mapPane: document.getElementById("map-pane"),
    viewBtns: document.querySelectorAll(".view-btn")
  };

  var spotsById = {};
  STUDY_SPOTS.forEach(function (s) { spotsById[s.id] = s; });

  // ---------- Map setup ----------
  var map = L.map("map", { zoomControl: true, scrollWheelZoom: true })
    .setView([43.0735, -89.4055], 15);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, OpenStreetMap contributors",
    maxNativeZoom: 16,
    maxZoom: 19
  }).addTo(map);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
    maxNativeZoom: 16,
    maxZoom: 19
  }).addTo(map);

  var markers = {};

  function makeIcon(spot, dim) {
    var meta = CATEGORY_META[spot.category];
    return L.divIcon({
      className: "",
      html:
        '<div class="marker-pin' + (dim ? " is-dim" : "") + '" style="--pin-color:' + meta.color + '">' +
        '<i class="' + meta.icon + '"></i></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 28],
      popupAnchor: [0, -26]
    });
  }

  STUDY_SPOTS.forEach(function (spot) {
    var marker = L.marker([spot.lat, spot.lng], { icon: makeIcon(spot, false) });
    marker.bindTooltip(spot.name, { direction: "top", offset: [0, -22], className: "spot-tooltip" });
    marker.on("click", function () { selectSpot(spot.id, { flyTo: false, fromMarker: true }); });
    marker.addTo(map);
    markers[spot.id] = marker;
  });

  // ---------- Legend ----------
  (function renderLegend() {
    var html = '<div class="legend-title">Categories</div>';
    Object.keys(CATEGORY_META).forEach(function (cat) {
      var meta = CATEGORY_META[cat];
      html += '<div class="legend-row"><span class="legend-dot" style="background:' + meta.color + '"></span>' + meta.label + "</div>";
    });
    els.legend.innerHTML = html;
  })();

  // ---------- Category pills ----------
  (function renderCategoryPills() {
    var cats = ["All"].concat(Object.keys(CATEGORY_META));
    els.categoryPills.innerHTML = cats.map(function (cat) {
      var isAll = cat === "All";
      var meta = CATEGORY_META[cat];
      var color = isAll ? "" : ' style="--dot-color:' + meta.color + '"';
      var icon = isAll ? '<i class="fa-solid fa-border-all"></i>' : '<i class="' + meta.icon + '"></i>';
      return '<button class="pill-btn' + (cat === state.category ? " active" + (isAll ? "" : " cat-active") : "") +
        '" data-cat="' + cat + '"' + color + ">" + icon + "<span>" + (isAll ? "All" : meta.label) + "</span></button>";
    }).join("");

    els.categoryPills.addEventListener("click", function (e) {
      var btn = e.target.closest(".pill-btn");
      if (!btn) return;
      state.category = btn.dataset.cat;
      Array.from(els.categoryPills.children).forEach(function (b) {
        var active = b === btn;
        b.classList.toggle("active", active);
        b.classList.toggle("cat-active", active && b.dataset.cat !== "All");
      });
      applyFilters();
    });
  })();

  // ---------- Tag chips ----------
  (function renderTagChips() {
    els.tagRow.innerHTML = FILTER_TAGS.map(function (tag) {
      return '<button class="tag-chip" data-tag="' + tag + '">' + tag + "</button>";
    }).join("");

    els.tagRow.addEventListener("click", function (e) {
      var btn = e.target.closest(".tag-chip");
      if (!btn) return;
      var tag = btn.dataset.tag;
      if (state.tags.has(tag)) { state.tags.delete(tag); btn.classList.remove("active"); }
      else { state.tags.add(tag); btn.classList.add("active"); }
      applyFilters();
    });
  })();

  // ---------- Search ----------
  els.searchInput.addEventListener("input", function () {
    state.search = els.searchInput.value.trim().toLowerCase();
    applyFilters();
  });

  els.clearFiltersBtn.addEventListener("click", function () {
    state.search = "";
    state.category = "All";
    state.tags.clear();
    els.searchInput.value = "";
    Array.from(els.categoryPills.children).forEach(function (b) {
      var active = b.dataset.cat === "All";
      b.classList.toggle("active", active);
      b.classList.remove("cat-active");
    });
    Array.from(els.tagRow.children).forEach(function (b) { b.classList.remove("active"); });
    applyFilters();
  });

  // ---------- Filtering ----------
  function getFiltered() {
    return STUDY_SPOTS.filter(function (spot) {
      if (state.category !== "All" && spot.category !== state.category) return false;
      for (var t of state.tags) { if (spot.tags.indexOf(t) === -1) return false; }
      if (state.search) {
        var haystack = (spot.name + " " + spot.address + " " + spot.description + " " + spot.tags.join(" ")).toLowerCase();
        if (haystack.indexOf(state.search) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function applyFilters() {
    var filtered = getFiltered();
    renderList(filtered);
    updateMarkers(filtered);
  }

  // ---------- List rendering ----------
  function renderList(filtered) {
    els.resultsCount.textContent = filtered.length + (filtered.length === 1 ? " spot" : " spots") + " found";
    els.emptyState.hidden = filtered.length !== 0;
    els.spotList.hidden = filtered.length === 0;

    els.spotList.innerHTML = filtered.map(function (spot) {
      var meta = CATEGORY_META[spot.category];
      var selected = spot.id === state.selectedId;
      var tagPills = spot.tags.slice(0, 4).map(function (t) { return '<span class="mini-tag">' + t + "</span>"; }).join("");
      return (
        '<article class="spot-card' + (selected ? " selected" : "") + '" data-id="' + spot.id + '" style="--card-color:' + meta.color + '">' +
        '<div class="spot-icon"><i class="' + meta.icon + '"></i></div>' +
        '<div class="spot-body">' +
        '<div class="spot-top"><h3 class="spot-name">' + spot.name + '</h3><span class="spot-category">' + meta.label + "</span></div>" +
        '<p class="spot-address"><i class="fa-solid fa-location-dot"></i>' + spot.address + "</p>" +
        '<p class="spot-desc">' + spot.description + "</p>" +
        '<div class="spot-tags">' + tagPills + "</div>" +
        "</div></article>"
      );
    }).join("");

    Array.from(els.spotList.children).forEach(function (card) {
      card.addEventListener("click", function () { selectSpot(card.dataset.id, { flyTo: true }); });
    });
  }

  // ---------- Markers visibility ----------
  function updateMarkers(filtered) {
    var visibleIds = new Set(filtered.map(function (s) { return s.id; }));
    Object.keys(markers).forEach(function (id) {
      var marker = markers[id];
      var visible = visibleIds.has(id);
      marker.setIcon(makeIcon(spotsById[id], !visible));
      marker.setZIndexOffset(visible ? 100 : 0);
      if (marker.getElement()) marker.getElement().style.pointerEvents = visible ? "auto" : "none";
    });
  }

  // ---------- Drawer ----------
  function selectSpot(id, opts) {
    opts = opts || {};
    var spot = spotsById[id];
    if (!spot) return;
    state.selectedId = id;

    Array.from(els.spotList.children).forEach(function (card) {
      card.classList.toggle("selected", card.dataset.id === id);
    });
    var card = els.spotList.querySelector('[data-id="' + id + '"]');
    if (card && opts.flyTo) card.scrollIntoView({ block: "nearest", behavior: "smooth" });

    if (opts.flyTo) {
      map.flyTo([spot.lat, spot.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    }
    if (opts.fromMarker) {
      showMobileView("map");
    }

    openDrawer(spot);
  }

  function openDrawer(spot) {
    var meta = CATEGORY_META[spot.category];
    var affiliationBadge = spot.affiliation === "University"
      ? '<span class="badge badge-university">University</span>'
      : '<span class="badge badge-offcampus">Off-Campus</span>';

    var tagsHtml = spot.tags.map(function (t) { return '<span class="drawer-tag">' + t + "</span>"; }).join("");
    var mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + spot.lat + "," + spot.lng;

    els.drawerContent.innerHTML =
      '<div class="drawer-hero" style="--drawer-color:' + meta.color + '"><i class="' + meta.icon + '"></i></div>' +
      '<div class="drawer-eyebrow"><span class="badge badge-category" style="--drawer-color:' + meta.color + '">' + meta.label + "</span>" + affiliationBadge + "</div>" +
      "<h2>" + spot.name + "</h2>" +
      '<p class="drawer-address"><i class="fa-solid fa-location-dot"></i>' + spot.address + "</p>" +
      '<a class="directions-btn" href="' + mapsUrl + '" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right"></i> Get Directions</a>' +
      '<div class="drawer-divider"></div>' +
      '<div class="drawer-section-label">About this spot</div>' +
      '<p class="drawer-desc">' + spot.description + "</p>" +
      '<div class="drawer-section-label">Tags</div>' +
      '<div class="drawer-tags">' + tagsHtml + "</div>";

    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    els.drawerBackdrop.classList.add("open");
    if (history.replaceState) history.replaceState(null, "", "#" + spot.id);
  }

  function closeDrawer() {
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
    els.drawerBackdrop.classList.remove("open");
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  }

  els.drawerClose.addEventListener("click", closeDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  // ---------- Mobile view toggle ----------
  function showMobileView(view) {
    if (window.innerWidth > 880) return;
    els.listPane.classList.toggle("hidden-mobile", view !== "list");
    els.mapPane.classList.toggle("hidden-mobile", view !== "map");
    els.viewBtns.forEach(function (b) { b.classList.toggle("active", b.dataset.view === view); });
    if (view === "map") setTimeout(function () { map.invalidateSize(); }, 60);
  }

  els.viewBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { showMobileView(btn.dataset.view); });
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth <= 880) {
      var activeBtn = document.querySelector(".view-btn.active");
      showMobileView(activeBtn ? activeBtn.dataset.view : "list");
    } else {
      map.invalidateSize();
    }
  });

  // ---------- Init ----------
  els.spotCount.textContent = STUDY_SPOTS.length;
  applyFilters();
  showMobileView("list");

  var hashId = location.hash.replace("#", "");
  if (hashId && spotsById[hashId]) {
    selectSpot(hashId, { flyTo: true });
  }
})();
