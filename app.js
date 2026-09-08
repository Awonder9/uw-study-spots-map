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
    listPane: document.getElementById("list-pane"),
    mapPane: document.getElementById("map-pane"),
    viewBtns: document.querySelectorAll(".view-btn"),
    infoBtn: document.getElementById("info-btn"),
    infoModal: document.getElementById("info-modal"),
    infoModalBackdrop: document.getElementById("info-modal-backdrop"),
    infoModalClose: document.getElementById("info-modal-close"),
    infoSpotCount: document.getElementById("info-spot-count")
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

  function openDrawer(spot) {
    var meta = CATEGORY_META[spot.category];
    var affiliationBadge = spot.affiliation === "University"
      ? '<span class="badge badge-university">University</span>'
      : '<span class="badge badge-offcampus">Off-Campus</span>';

    var tagsHtml = spot.tags.map(function (t) { return '<span class="drawer-tag">' + t + "</span>"; }).join("");
    var mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(spot.name + ", " + spot.address);

    els.drawerContent.innerHTML =
      '<div class="drawer-hero" style="--drawer-color:' + meta.color + '"><i class="' + meta.icon + '"></i></div>' +
      '<div class="drawer-eyebrow"><span class="badge badge-category" style="--drawer-color:' + meta.color + '">' + meta.label + "</span>" + affiliationBadge + "</div>" +
      "<h2>" + spot.name + "</h2>" +
      '<p class="drawer-address"><i class="fa-solid fa-location-dot"></i>' + spot.address + "</p>" +
      '<a class="directions-btn" href="' + mapsUrl + '" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right"></i> Get Directions</a>' +
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

  els.drawerClose.addEventListener("click", closeDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeDrawer();
      closeInfoModal();
    }
  });

  // ---------- Info modal ----------
  function openInfoModal() {
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

  var hashId = location.hash.replace("#", "");
  if (hashId && spotsById[hashId]) {
    selectSpot(hashId, { flyTo: true });
  }
})();
