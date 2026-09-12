import { CATEGORY_META, FILTER_TAGS, STUDY_SPOTS } from "./data.js";

(async function () {
  "use strict";

  // Merge in any live edits made via the dashboard's spot editor before
  // anything else runs. STUDY_SPOTS is a live-binding import and this
  // mutates the existing objects in place (not replacing the array), so
  // every downstream reference in this file just sees the merged data
  // once the rest of setup runs below. If this fails for any reason, the
  // site still works fine on the static bundled data.
  try {
    var overridesRes = await fetch("/api/spots");
    if (overridesRes.ok) {
      var overridesData = await overridesRes.json();
      var overridesById = {};
      (overridesData.spots || []).forEach(function (s) { overridesById[s.id] = s; });
      STUDY_SPOTS.forEach(function (spot) {
        if (overridesById[spot.id]) Object.assign(spot, overridesById[spot.id]);
      });
    }
  } catch (e) {
    // non-critical — proceed with static bundled data
  }

  var state = {
    search: "",
    category: "All",
    tags: new Set(),
    selectedId: null,
    sort: "default",
    userLocation: null,
    // idle | pending | granted | denied | unavailable
    locationStatus: "idle",
    busynessById: {},
    // idle | loading | loaded | error
    busynessStatus: "idle",
    transitMinutesById: {},
    transitLive: false,
    transitOrigin: null,
    // idle | loading | loaded | error
    transitStatus: "idle"
  };

  var els = {
    searchInput: document.getElementById("search-input"),
    categoryPills: document.getElementById("category-pills"),
    tagRow: document.getElementById("tag-row"),
    tagToggleBtn: document.getElementById("tag-toggle-btn"),
    spotList: document.getElementById("spot-list"),
    resultsCount: document.getElementById("results-count"),
    sortSelect: document.getElementById("sort-select"),
    sortNote: document.getElementById("sort-note"),
    emptyState: document.getElementById("empty-state"),
    clearFiltersBtn: document.getElementById("clear-filters-btn"),
    legend: document.getElementById("legend"),
    drawer: document.getElementById("drawer"),
    drawerBackdrop: document.getElementById("drawer-backdrop"),
    drawerContent: document.getElementById("drawer-content"),
    drawerClose: document.getElementById("drawer-close"),
    listPane: document.getElementById("list-pane"),
    mapPane: document.getElementById("map-pane"),
    viewBtns: document.querySelectorAll(".view-btn"),
    infoBtn: document.getElementById("info-btn"),
    infoModal: document.getElementById("info-modal"),
    infoModalBackdrop: document.getElementById("info-modal-backdrop"),
    infoModalClose: document.getElementById("info-modal-close"),
    infoSpotCount: document.getElementById("info-spot-count"),
    suggestBtn: document.getElementById("suggest-btn"),
    suggestModal: document.getElementById("suggest-modal"),
    suggestModalBackdrop: document.getElementById("suggest-modal-backdrop"),
    suggestModalClose: document.getElementById("suggest-modal-close"),
    suggestForm: document.getElementById("suggest-form"),
    suggestThanks: document.getElementById("suggest-thanks"),
    suggestFormError: document.getElementById("suggest-form-error"),
    suggestSubmitBtn: document.getElementById("suggest-submit-btn"),
    suggestName: document.getElementById("suggest-name"),
    suggestLocation: document.getElementById("suggest-location"),
    suggestCategory: document.getElementById("suggest-category"),
    suggestDescription: document.getElementById("suggest-description"),
    logBtn: document.getElementById("log-btn"),
    logModal: document.getElementById("log-modal"),
    logModalBackdrop: document.getElementById("log-modal-backdrop"),
    logModalClose: document.getElementById("log-modal-close"),
    logList: document.getElementById("log-list"),
    updateToast: document.getElementById("update-toast"),
    updateToastClose: document.getElementById("update-toast-close"),
    updateToastTag: document.getElementById("update-toast-tag"),
    updateToastSummary: document.getElementById("update-toast-summary"),
    updateToastResponse: document.getElementById("update-toast-response"),
    updateToastView: document.getElementById("update-toast-view")
  };

  var spotsById = {};
  STUDY_SPOTS.forEach(function (s) { spotsById[s.id] = s; });

  // ---------- Map setup ----------
  // World_Light_Gray_Base/Reference have no real tile content past zoom 16 in this
  // area (verified directly) — capping here avoids both blur (from upscaling) and
  // blank "data not yet available" tiles.
  var MAP_MAX_ZOOM = 16;
  // Every spot is in the Madison area — no reason to let users zoom out further.
  var MAP_MIN_ZOOM = 13;
  // Padded bounding box around all spots (isthmus + near west/east side) —
  // panning is clamped to this so the map can't be dragged out to open country.
  var MADISON_BOUNDS = L.latLngBounds([43.040, -89.499], [43.103, -89.357]);
  var map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true,
    maxZoom: MAP_MAX_ZOOM,
    minZoom: MAP_MIN_ZOOM,
    maxBounds: MADISON_BOUNDS,
    maxBoundsViscosity: 1.0
  }).setView([43.0735, -89.4055], 15);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, OpenStreetMap contributors",
    maxZoom: MAP_MAX_ZOOM
  }).addTo(map);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: MAP_MAX_ZOOM
  }).addTo(map);

  // On mobile the attribution text is collapsed to a small "©" by default
  // (CSS-only outside the mobile breakpoint — see style.css) and expands on
  // tap. Esri/OSM's free-tile terms require attribution to stay available,
  // so this only declutters the display, it never removes it. Also moved to
  // the map's top-right corner on mobile so the collapsed icon doesn't sit
  // over the same corner as the info button.
  if (window.matchMedia("(max-width: 880px)").matches) {
    map.attributionControl.setPosition("topright");
  }
  map.attributionControl.getContainer().addEventListener("click", function () {
    this.classList.toggle("attribution-expanded");
  });

  var markers = {};

  function makeIcon(spot, dim, selected) {
    var meta = CATEGORY_META[spot.category];
    var cls = "marker-pin" + (dim ? " is-dim" : "") + (selected ? " is-selected" : "");
    return L.divIcon({
      className: "",
      html:
        '<div class="' + cls + '" style="--pin-color:' + meta.color + '">' +
        '<i class="' + meta.icon + '"></i></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 28],
      popupAnchor: [0, -26]
    });
  }

  STUDY_SPOTS.forEach(function (spot) {
    var marker = L.marker([spot.lat, spot.lng], { icon: makeIcon(spot, false, false) });
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

  // Mobile-only collapse for the tag row (hidden entirely by CSS on desktop,
  // so this toggle has no visual effect there).
  els.tagToggleBtn.addEventListener("click", function () {
    var expanded = els.tagRow.classList.toggle("expanded");
    els.tagToggleBtn.classList.toggle("expanded", expanded);
    els.tagToggleBtn.setAttribute("aria-expanded", String(expanded));
  });

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

  // ---------- Sorting ----------
  var BUSYNESS_SORT_ORDER = ["empty", "some-seats", "busy", "full"];

  function byName(a, b) { return a.name.localeCompare(b.name); }

  // Great-circle distance in meters — used for both the "Distance" sort and
  // as the walking-time fallback when live transit data isn't available.
  function haversineMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Unreported spots sort after every known level rather than being treated
  // as empty — we simply don't know, so "least busy first" shouldn't imply it.
  function busynessRank(status) {
    if (!status || !status.level) return BUSYNESS_SORT_ORDER.length;
    var idx = BUSYNESS_SORT_ORDER.indexOf(status.level);
    return idx === -1 ? BUSYNESS_SORT_ORDER.length : idx;
  }

  function sortSpots(list) {
    if (state.sort === "distance" && state.userLocation) {
      var origin = state.userLocation;
      return list.slice().sort(function (a, b) {
        var da = haversineMeters(origin.lat, origin.lng, a.lat, a.lng);
        var db = haversineMeters(origin.lat, origin.lng, b.lat, b.lng);
        return da - db || byName(a, b);
      });
    }

    if (state.sort === "busyness" && state.busynessStatus === "loaded") {
      return list.slice().sort(function (a, b) {
        return busynessRank(state.busynessById[a.id]) - busynessRank(state.busynessById[b.id]) || byName(a, b);
      });
    }

    if (state.sort === "transit" && state.transitStatus === "loaded") {
      return list.slice().sort(function (a, b) {
        var ta = state.transitMinutesById[a.id];
        var tb = state.transitMinutesById[b.id];
        var ra = typeof ta === "number" ? ta : Infinity;
        var rb = typeof tb === "number" ? tb : Infinity;
        return ra - rb || byName(a, b);
      });
    }

    // Default (alphabetical), and the fallback while location/busyness/transit
    // data for the other modes is still loading or came back unavailable.
    return list.slice().sort(byName);
  }

  function sortNoteText() {
    if (state.sort === "distance") {
      if (state.locationStatus === "pending") return "Finding your location…";
      if (state.locationStatus === "denied") return "Location access denied — showing alphabetical order instead.";
      if (state.locationStatus === "unavailable") return "Location unavailable — showing alphabetical order instead.";
      return "";
    }
    if (state.sort === "busyness") {
      if (state.busynessStatus === "loading") return "Loading busyness reports…";
      if (state.busynessStatus === "error") return "Couldn't load busyness reports — showing alphabetical order instead.";
      return "";
    }
    if (state.sort === "transit") {
      if (state.locationStatus === "pending") return "Finding your location…";
      if (state.locationStatus === "denied" || state.locationStatus === "unavailable") {
        return "Location unavailable — showing alphabetical order instead.";
      }
      if (state.transitStatus === "loading") return "Estimating transit times…";
      if (state.transitStatus === "error") return "Couldn't estimate transit times — showing alphabetical order instead.";
      if (state.transitStatus === "loaded" && !state.transitLive) {
        return "Showing walking-distance estimates — live transit times aren't configured.";
      }
      return "";
    }
    return "";
  }

  function renderSortNote() {
    var text = sortNoteText();
    els.sortNote.textContent = text;
    els.sortNote.hidden = !text;
  }

  // Resolves the browser's geolocation once per session (cached in
  // state.userLocation) and hands it to `callback`. Denial/failure isn't
  // fatal — callers fall back to the default alphabetical sort.
  function requestUserLocation(callback) {
    function done(loc) {
      if (typeof callback === "function") callback(loc);
    }
    if (state.userLocation) { done(state.userLocation); return; }
    if (!navigator.geolocation) {
      state.locationStatus = "unavailable";
      applyFilters();
      done(null);
      return;
    }
    state.locationStatus = "pending";
    applyFilters();
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.locationStatus = "granted";
        applyFilters();
        done(state.userLocation);
      },
      function () {
        state.locationStatus = "denied";
        applyFilters();
        done(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function ensureBusynessAll() {
    if (state.busynessStatus === "loaded" || state.busynessStatus === "loading") return;
    state.busynessStatus = "loading";
    applyFilters();
    fetch("/api/busyness-all")
      .then(function (res) { if (!res.ok) throw new Error("bad status"); return res.json(); })
      .then(function (data) {
        state.busynessById = data.statuses || {};
        state.busynessStatus = "loaded";
        applyFilters();
      })
      .catch(function () {
        state.busynessStatus = "error";
        applyFilters();
      });
  }

  function ensureTransitTimes(origin) {
    if (state.transitStatus === "loading") return;
    if (
      state.transitStatus === "loaded" &&
      state.transitOrigin &&
      state.transitOrigin.lat === origin.lat &&
      state.transitOrigin.lng === origin.lng
    ) return;

    state.transitStatus = "loading";
    applyFilters();
    fetch("/api/transit-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: origin })
    })
      .then(function (res) { if (!res.ok) throw new Error("bad status"); return res.json(); })
      .then(function (data) {
        state.transitMinutesById = data.minutes || {};
        state.transitLive = Boolean(data.live);
        state.transitOrigin = origin;
        state.transitStatus = "loaded";
        applyFilters();
      })
      .catch(function () {
        state.transitStatus = "error";
        applyFilters();
      });
  }

  els.sortSelect.addEventListener("change", function () {
    state.sort = els.sortSelect.value;

    if (state.sort === "distance") {
      requestUserLocation();
    } else if (state.sort === "busyness") {
      ensureBusynessAll();
    } else if (state.sort === "transit") {
      requestUserLocation(function (loc) {
        if (loc) ensureTransitTimes(loc);
      });
    }

    applyFilters();
  });

  // ---------- Filtering ----------
  function getFiltered() {
    var filtered = STUDY_SPOTS.filter(function (spot) {
      if (state.category !== "All" && spot.category !== state.category) return false;
      for (var t of state.tags) { if (spot.tags.indexOf(t) === -1) return false; }
      if (state.search) {
        var haystack = (spot.name + " " + spot.address + " " + spot.description + " " + spot.tags.join(" ")).toLowerCase();
        if (haystack.indexOf(state.search) === -1) return false;
      }
      return true;
    });
    return sortSpots(filtered);
  }

  function applyFilters() {
    var filtered = getFiltered();
    renderList(filtered);
    updateMarkers(filtered);
    renderSortNote();
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
      var selected = id === state.selectedId;
      marker.setIcon(makeIcon(spotsById[id], !visible, selected));
      marker.setZIndexOffset(selected ? 1000 : (visible ? 100 : 0));
      if (marker.getElement()) marker.getElement().style.pointerEvents = visible ? "auto" : "none";
    });
  }

  // ---------- Drawer ----------
  function selectSpot(id, opts) {
    opts = opts || {};
    var spot = spotsById[id];
    if (!spot) return;
    state.selectedId = id;
    updateMarkers(getFiltered());

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

  // Only one overlay (drawer, any modal, or the update toast) should ever be
  // visible at a time — each open function calls this first so the newest
  // one always wins instead of stacking on top of whatever was already open.
  function closeAllOverlays() {
    closeDrawer();
    closeInfoModal();
    closeSuggestModal();
    closeLogModal();
    hideUpdateToast();
  }

  function openDrawer(spot) {
    closeAllOverlays();
    var meta = CATEGORY_META[spot.category];
    var affiliationBadge = spot.affiliation === "University"
      ? '<span class="badge badge-university">University</span>'
      : '<span class="badge badge-offcampus">Off-Campus</span>';

    var tagsHtml = spot.tags.map(function (t) { return '<span class="drawer-tag">' + t + "</span>"; }).join("");

    els.drawerContent.innerHTML =
      '<div class="drawer-hero" style="--drawer-color:' + meta.color + '"><i class="' + meta.icon + '"></i></div>' +
      '<div class="drawer-eyebrow"><span class="badge badge-category" style="--drawer-color:' + meta.color + '">' + meta.label + "</span>" + affiliationBadge + "</div>" +
      "<h2>" + spot.name + "</h2>" +
      '<p class="drawer-address"><i class="fa-solid fa-location-dot"></i>' + spot.address + "</p>" +
      '<button class="directions-btn" type="button" data-spot-id="' + spot.id + '"><i class="fa-solid fa-diamond-turn-right"></i> Get Directions</button>' +
      '<div class="drawer-section-label">How busy is it right now?</div>' +
      '<div class="busyness-box" id="busyness-box" data-spot-id="' + spot.id + '">' +
      busynessStatusHtml(null, true) + busynessButtonsHtml(spot.id) +
      "</div>" +
      '<div class="drawer-divider"></div>' +
      '<div class="drawer-section-label">About this spot</div>' +
      '<p class="drawer-desc">' + spot.description + "</p>" +
      '<div class="drawer-section-label">Tags</div>' +
      '<div class="drawer-tags">' + tagsHtml + "</div>" +
      '<div class="feedback-block" id="feedback-block" data-spot-id="' + spot.id + '">' + feedbackCollapsedHtml() + "</div>";

    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    els.drawerBackdrop.classList.add("open");
    if (history.replaceState) history.replaceState(null, "", "#" + spot.id);

    refreshBusynessStatus(spot);
  }

  function closeDrawer() {
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
    els.drawerBackdrop.classList.remove("open");
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  }

  // Transit App's web trip planner (transitapp.com/en/trip) reads the
  // destination/origin as either "lat,lng" pairs or free-text addresses;
  // `_search` companions just seed a friendly label while it geocodes.
  // Leaving `origin` off entirely (when the browser won't share a location)
  // is fine — the planner then asks the visitor for their own location itself.
  function directionsUrl(spot, origin) {
    var params = new URLSearchParams();
    params.set("destination", spot.lat + "," + spot.lng);
    params.set("destination_search", spot.name);
    if (origin) params.set("origin", origin.lat + "," + origin.lng);
    return "https://transitapp.com/en/trip?" + params.toString();
  }

  // Opens a blank tab synchronously (inside the click handler, so popup
  // blockers allow it) and only points it at the real URL once the async
  // geolocation prompt resolves — navigating a tab opened *after* the prompt
  // settles gets blocked by Chrome/Safari because the user-gesture window
  // has already expired by then.
  function openDirections(spot) {
    var pendingTab = window.open("about:blank", "_blank");
    requestUserLocation(function (loc) {
      var url = directionsUrl(spot, loc);
      if (pendingTab && !pendingTab.closed) pendingTab.location.href = url;
      else window.open(url, "_blank");
    });
  }

  els.drawerClose.addEventListener("click", closeDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeDrawer();
      closeInfoModal();
      closeSuggestModal();
      closeLogModal();
      hideUpdateToast();
    }
  });

  // ---------- Info modal ----------
  function openInfoModal() {
    closeAllOverlays();
    els.infoModal.classList.add("open");
    els.infoModal.setAttribute("aria-hidden", "false");
    els.infoModalBackdrop.classList.add("open");
  }
  function closeInfoModal() {
    els.infoModal.classList.remove("open");
    els.infoModal.setAttribute("aria-hidden", "true");
    els.infoModalBackdrop.classList.remove("open");
  }
  els.infoBtn.addEventListener("click", openInfoModal);
  els.infoModalClose.addEventListener("click", closeInfoModal);
  els.infoModalBackdrop.addEventListener("click", closeInfoModal);

  // ---------- Suggest a spot modal ----------
  function resetSuggestForm() {
    els.suggestForm.reset();
    els.suggestForm.hidden = false;
    els.suggestThanks.hidden = true;
    els.suggestFormError.textContent = "";
    els.suggestSubmitBtn.disabled = false;
    els.suggestSubmitBtn.textContent = "Submit suggestion";
  }
  function openSuggestModal() {
    closeAllOverlays();
    resetSuggestForm();
    els.suggestModal.classList.add("open");
    els.suggestModal.setAttribute("aria-hidden", "false");
    els.suggestModalBackdrop.classList.add("open");
  }
  function closeSuggestModal() {
    els.suggestModal.classList.remove("open");
    els.suggestModal.setAttribute("aria-hidden", "true");
    els.suggestModalBackdrop.classList.remove("open");
  }
  els.suggestBtn.addEventListener("click", openSuggestModal);
  els.suggestModalClose.addEventListener("click", closeSuggestModal);
  els.suggestModalBackdrop.addEventListener("click", closeSuggestModal);

  els.suggestForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = els.suggestName.value.trim();
    var location = els.suggestLocation.value.trim();
    if (!name || !location) {
      els.suggestFormError.textContent = "Please fill in the spot name and location.";
      return;
    }
    els.suggestFormError.textContent = "";
    els.suggestSubmitBtn.disabled = true;
    els.suggestSubmitBtn.textContent = "Submitting…";

    fetch("/api/suggest-spot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        location: location,
        category: els.suggestCategory.value,
        description: els.suggestDescription.value.trim(),
        deviceId: getDeviceId()
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.ok) {
          els.suggestForm.hidden = true;
          els.suggestThanks.hidden = false;
        } else if (data.error === "rate_limited") {
          els.suggestFormError.textContent = "You've submitted a suggestion recently — please wait a bit before sending another.";
          els.suggestSubmitBtn.disabled = false;
          els.suggestSubmitBtn.textContent = "Submit suggestion";
        } else {
          els.suggestFormError.textContent = "Something went wrong — please try again.";
          els.suggestSubmitBtn.disabled = false;
          els.suggestSubmitBtn.textContent = "Submit suggestion";
        }
      })
      .catch(function () {
        els.suggestFormError.textContent = "Couldn't connect — please try again.";
        els.suggestSubmitBtn.disabled = false;
        els.suggestSubmitBtn.textContent = "Submit suggestion";
      });
  });

  // ---------- Updates log ----------
  function logEntryTypeLabel(type) {
    if (type === "suggestion") return "Suggestion";
    if (type === "announcement") return "Update";
    return "Feedback";
  }
  function logEntryHtml(entry) {
    var typeLabel = logEntryTypeLabel(entry.type);
    return (
      '<div class="log-entry">' +
      '<div class="log-entry-tag">' + typeLabel + "</div>" +
      '<div class="log-entry-summary">' + escapeHtmlClient(entry.summary) + "</div>" +
      '<div class="log-entry-response">' + escapeHtmlClient(entry.response) + "</div>" +
      '<div class="log-entry-time">' + formatDateTime(entry.ts) + "</div>" +
      "</div>"
    );
  }
  function escapeHtmlClient(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }
  var UPDATE_SEEN_KEY = "uw-study-spots-last-seen-update";
  function getLastSeenUpdate() {
    try { return Number(localStorage.getItem(UPDATE_SEEN_KEY)) || 0; } catch (e) { return 0; }
  }
  function markUpdateSeen(ts) {
    try { localStorage.setItem(UPDATE_SEEN_KEY, String(ts)); } catch (e) {}
  }

  function openLogModal() {
    closeAllOverlays();
    els.logModal.classList.add("open");
    els.logModal.setAttribute("aria-hidden", "false");
    els.logModalBackdrop.classList.add("open");
    els.logList.innerHTML = '<div class="log-loading">Loading updates&hellip;</div>';
    fetch("/api/log")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var entries = data.entries || [];
        if (!entries.length) {
          els.logList.innerHTML = '<div class="log-empty">No updates yet — check back soon.</div>';
          return;
        }
        els.logList.innerHTML = entries.map(logEntryHtml).join("");
        markUpdateSeen(entries[0].ts);
      })
      .catch(function () {
        els.logList.innerHTML = '<div class="log-empty">Couldn\'t load updates — please try again.</div>';
      });
  }
  function closeLogModal() {
    els.logModal.classList.remove("open");
    els.logModal.setAttribute("aria-hidden", "true");
    els.logModalBackdrop.classList.remove("open");
  }
  els.logBtn.addEventListener("click", openLogModal);
  els.logModalClose.addEventListener("click", closeLogModal);
  els.logModalBackdrop.addEventListener("click", closeLogModal);

  // ---------- New-update toast ----------
  function showUpdateToast(entry) {
    els.updateToastTag.textContent = logEntryTypeLabel(entry.type);
    els.updateToastSummary.textContent = entry.summary;
    els.updateToastResponse.textContent = entry.response;
    els.updateToast.hidden = false;
    requestAnimationFrame(function () { els.updateToast.classList.add("open"); });
  }
  function hideUpdateToast() {
    els.updateToast.classList.remove("open");
    setTimeout(function () { els.updateToast.hidden = true; }, 250);
  }
  els.updateToastClose.addEventListener("click", hideUpdateToast);
  els.updateToastView.addEventListener("click", function () {
    hideUpdateToast();
    openLogModal();
  });

  function checkForNewUpdate() {
    fetch("/api/log")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var entries = data.entries || [];
        if (!entries.length) return;
        var latest = entries[0];
        if (latest.ts > getLastSeenUpdate()) {
          showUpdateToast(latest);
          markUpdateSeen(latest.ts);
        }
      })
      .catch(function () {}); // non-critical — fail silently
  }

  // ---------- Device ID (anonymous, local-only) ----------
  var DEVICE_ID_KEY = "uw-study-spots-device-id";
  function getDeviceId() {
    try {
      var id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return "anon-" + Math.random().toString(36).slice(2);
    }
  }

  function formatRelativeTime(ts) {
    var minutes = Math.round((Date.now() - ts) / 60000);
    if (minutes < 1) return "just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return minutes + " min ago";
    var hours = Math.round(minutes / 60);
    return hours === 1 ? "1 hr ago" : hours + " hrs ago";
  }

  function formatDateTime(ts) {
    var d = new Date(ts);
    var dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    var timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return dateLabel + " at " + timeLabel;
  }

  function formatDuration(ms) {
    var minutes = Math.ceil(ms / 60000);
    return minutes <= 1 ? "1 min" : minutes + " min";
  }

  // ---------- Busyness ----------
  var BUSYNESS_META = {
    "empty": { label: "Empty", icon: "fa-solid fa-chair", color: "#4C8C5B" },
    "some-seats": { label: "Some seats", icon: "fa-solid fa-user", color: "#E0A82E" },
    "busy": { label: "Busy", icon: "fa-solid fa-users", color: "#C97A3D" },
    "full": { label: "Full", icon: "fa-solid fa-users-rectangle", color: "#C5050C" }
  };
  var BUSYNESS_ORDER = ["empty", "some-seats", "busy", "full"];
  var BUSYNESS_LOCK_KEY = "uw-study-spots-busyness-lock";
  var BUSYNESS_RATE_LIMIT_MS = 20 * 60 * 1000; // keep in sync with functions/_shared/kv-helpers.js

  function getLocalLockUntil(spotId) {
    try {
      var map = JSON.parse(localStorage.getItem(BUSYNESS_LOCK_KEY) || "{}");
      return map[spotId] || 0;
    } catch (e) { return 0; }
  }
  function setLocalLockUntil(spotId, ts) {
    try {
      var map = JSON.parse(localStorage.getItem(BUSYNESS_LOCK_KEY) || "{}");
      map[spotId] = ts;
      localStorage.setItem(BUSYNESS_LOCK_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function busynessStatusHtml(status, loading) {
    if (loading) {
      return '<div class="busyness-status busyness-status-loading">Checking recent reports&hellip;</div>';
    }
    if (!status || !status.level || !BUSYNESS_META[status.level]) {
      return '<div class="busyness-status busyness-status-none"><i class="fa-solid fa-circle-question"></i> No recent reports &mdash; be the first to check in.</div>';
    }
    var meta = BUSYNESS_META[status.level];
    var countLabel = status.recentCount === 1 ? "1 report" : status.recentCount + " reports";
    var statusLine =
      '<div class="busyness-status" style="--busy-color:' + meta.color + '">' +
      '<span class="busyness-dot"></span><strong>' + meta.label + "</strong> &middot; " + countLabel +
      " &middot; updated " + formatRelativeTime(status.reportedAt) + "</div>";
    var mixedNote = status.mixed
      ? '<div class="busyness-mixed-note"><i class="fa-solid fa-shuffle"></i> Recent reports disagree &mdash; this is a blended estimate.</div>'
      : "";
    return statusLine + mixedNote;
  }

  function busynessButtonsHtml(spotId) {
    var lockedUntil = getLocalLockUntil(spotId);
    var now = Date.now();
    var locked = lockedUntil > now;
    var buttons = BUSYNESS_ORDER.map(function (level) {
      var meta = BUSYNESS_META[level];
      return (
        '<button class="busyness-btn" data-level="' + level + '"' + (locked ? " disabled" : "") + ">" +
        '<i class="' + meta.icon + '"></i>' + meta.label + "</button>"
      );
    }).join("");
    var lockNote = locked
      ? '<div class="busyness-lock-note">You can report again in ' + formatDuration(lockedUntil - now) + "</div>"
      : "";
    return '<div class="busyness-buttons">' + buttons + "</div>" + lockNote;
  }

  function renderBusynessBox(spotId, status) {
    return busynessStatusHtml(status, false) + busynessButtonsHtml(spotId);
  }

  function refreshBusynessStatus(spot) {
    fetch("/api/busyness?spotId=" + encodeURIComponent(spot.id))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (state.selectedId !== spot.id) return; // user navigated away before this resolved
        var box = els.drawerContent.querySelector("#busyness-box");
        if (box) box.innerHTML = renderBusynessBox(spot.id, data);
      })
      .catch(function () {
        var box = els.drawerContent.querySelector("#busyness-box");
        if (box && state.selectedId === spot.id) {
          box.innerHTML =
            '<div class="busyness-status busyness-status-none">Couldn\'t load recent reports.</div>' +
            busynessButtonsHtml(spot.id);
        }
      });
  }

  function submitBusynessReport(spotId, level) {
    var box = els.drawerContent.querySelector("#busyness-box");
    if (box) {
      box.querySelectorAll(".busyness-btn").forEach(function (b) { b.disabled = true; });
    }
    fetch("/api/busyness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotId: spotId, level: level, deviceId: getDeviceId() })
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (result) {
        if (state.selectedId !== spotId) return;
        var box2 = els.drawerContent.querySelector("#busyness-box");
        if (!box2) return;
        if (result.data.ok) {
          setLocalLockUntil(spotId, Date.now() + BUSYNESS_RATE_LIMIT_MS);
          box2.innerHTML = renderBusynessBox(spotId, {
            level: result.data.level,
            reportedAt: result.data.reportedAt,
            recentCount: result.data.recentCount
          });
        } else if (result.data.error === "rate_limited") {
          setLocalLockUntil(spotId, Date.now() + (result.data.retryAfterMs || BUSYNESS_RATE_LIMIT_MS));
          var statusEl = box2.querySelector(".busyness-status");
          var keepStatusHtml = statusEl ? statusEl.outerHTML : busynessStatusHtml(null, false);
          box2.innerHTML = keepStatusHtml + busynessButtonsHtml(spotId);
        } else {
          box2.innerHTML = '<div class="busyness-status busyness-status-none">Something went wrong &mdash; try again.</div>' + busynessButtonsHtml(spotId);
        }
      })
      .catch(function () {
        var box3 = els.drawerContent.querySelector("#busyness-box");
        if (box3 && state.selectedId === spotId) {
          box3.innerHTML = '<div class="busyness-status busyness-status-none">Couldn\'t connect &mdash; try again.</div>' + busynessButtonsHtml(spotId);
        }
      });
  }

  // ---------- Feedback ----------
  var FEEDBACK_ISSUE_LABELS = {
    "wrong-address": "Wrong address",
    "closed": "Permanently closed",
    "wrong-hours": "Wrong hours",
    "other": "Other"
  };

  function feedbackCollapsedHtml() {
    return '<button class="feedback-toggle-btn" type="button"><i class="fa-solid fa-triangle-exclamation"></i> Report an issue with this listing</button>';
  }

  function feedbackFormHtml() {
    var options = Object.keys(FEEDBACK_ISSUE_LABELS).map(function (key) {
      return '<option value="' + key + '">' + FEEDBACK_ISSUE_LABELS[key] + "</option>";
    }).join("");
    return (
      '<div class="feedback-form">' +
      '<div class="drawer-section-label">What\'s wrong?</div>' +
      '<select class="feedback-issue-select">' + options + "</select>" +
      '<textarea class="feedback-message" placeholder="Add details (optional)" maxlength="1000"></textarea>' +
      '<div class="feedback-form-actions">' +
      '<button class="feedback-submit-btn" type="button">Submit</button>' +
      '<button class="feedback-cancel-btn" type="button">Cancel</button>' +
      "</div></div>"
    );
  }

  function submitFeedback(block) {
    var spotId = block.dataset.spotId;
    var spot = spotsById[spotId];
    var select = block.querySelector(".feedback-issue-select");
    var textarea = block.querySelector(".feedback-message");
    var submitBtn = block.querySelector(".feedback-submit-btn");
    if (submitBtn) submitBtn.disabled = true;

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spotId: spotId,
        spotName: spot ? spot.name : "",
        issueType: select ? select.value : "other",
        message: textarea ? textarea.value : "",
        deviceId: getDeviceId()
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.ok) {
          block.innerHTML = '<div class="feedback-thanks"><i class="fa-solid fa-check"></i> Thanks &mdash; we\'ll take a look!</div>';
        } else if (data.error === "rate_limited") {
          if (submitBtn) submitBtn.disabled = false;
          block.querySelector(".feedback-form").insertAdjacentHTML(
            "afterbegin",
            '<div class="feedback-error">You\'ve submitted feedback recently &mdash; please wait a bit before sending more.</div>'
          );
        } else {
          if (submitBtn) submitBtn.disabled = false;
          block.querySelector(".feedback-form").insertAdjacentHTML(
            "afterbegin",
            '<div class="feedback-error">Something went wrong &mdash; please try again.</div>'
          );
        }
      })
      .catch(function () {
        if (submitBtn) submitBtn.disabled = false;
        var form = block.querySelector(".feedback-form");
        if (form) form.insertAdjacentHTML("afterbegin", '<div class="feedback-error">Couldn\'t connect &mdash; please try again.</div>');
      });
  }

  // Delegated listener: drawerContent is replaced via innerHTML on each spot,
  // so we bind once on the stable parent rather than re-binding per render.
  els.drawerContent.addEventListener("click", function (e) {
    var directionsBtn = e.target.closest(".directions-btn");
    if (directionsBtn) {
      var spotForDirections = spotsById[directionsBtn.dataset.spotId];
      if (spotForDirections) openDirections(spotForDirections);
      return;
    }
    var busynessBtn = e.target.closest(".busyness-btn");
    if (busynessBtn) {
      var box = e.target.closest("#busyness-box");
      if (box) submitBusynessReport(box.dataset.spotId, busynessBtn.dataset.level);
      return;
    }
    var toggleBtn = e.target.closest(".feedback-toggle-btn");
    if (toggleBtn) {
      var block1 = e.target.closest("#feedback-block");
      if (block1) block1.innerHTML = feedbackFormHtml();
      return;
    }
    var cancelBtn = e.target.closest(".feedback-cancel-btn");
    if (cancelBtn) {
      var block2 = e.target.closest("#feedback-block");
      if (block2) block2.innerHTML = feedbackCollapsedHtml();
      return;
    }
    var submitBtn2 = e.target.closest(".feedback-submit-btn");
    if (submitBtn2) {
      var block3 = e.target.closest("#feedback-block");
      if (block3) submitFeedback(block3);
      return;
    }
  });

  // ---------- Mobile view toggle ----------
  function showMobileView(view) {
    if (window.innerWidth > 880) return;
    els.listPane.classList.toggle("hidden-mobile", view !== "list");
    els.mapPane.classList.toggle("hidden-mobile", view !== "map");
    els.suggestBtn.classList.toggle("hidden-mobile", view !== "list");
    els.infoBtn.classList.toggle("hidden-mobile", view !== "map");
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
  els.infoSpotCount.textContent = STUDY_SPOTS.length;
  applyFilters();
  showMobileView("list");
  checkForNewUpdate();

  var hashId = location.hash.replace("#", "");
  if (hashId && spotsById[hashId]) {
    selectSpot(hashId, { flyTo: true });
  }
})();
