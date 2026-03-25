(function () {
  "use strict";

  // --- Constants ---
  var CONTAINERS = /^(UL|OL|TABLE|TBODY|THEAD|TFOOT|DL|DETAILS)$/;

  // --- State ---
  var STORAGE_KEY = "claude-plan-annotations";
  var annotations = [];
  var currentSelection = null;
  var editingIndex = -1;
  var focusedAnnotationIndex = -1;

  // --- Restore persisted state ---
  try {
    var saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) annotations = JSON.parse(saved);
  } catch (e) {}

  // --- Toolbar ---
  var toolbar = document.createElement("div");
  toolbar.id = "claude-plan-toolbar";
  toolbar.innerHTML =
    '<span class="claude-plan-toolbar-title">Claude Plan</span>' +
    '<span id="claude-plan-count" class="claude-plan-badge-count">0 directive(s)</span>' +
    '<button id="claude-plan-prev-btn" class="claude-plan-btn-nav" disabled title="Previous">&#9650;</button>' +
    '<button id="claude-plan-next-btn" class="claude-plan-btn-nav" disabled title="Next">&#9660;</button>' +
    '<button id="claude-plan-send-btn" class="claude-plan-btn-send" disabled>Copy directives</button>' +
    '<button id="claude-plan-clear-btn" class="claude-plan-btn-clear">Clear</button>';
  document.body.prepend(toolbar);
  document.body.style.paddingTop = "44px";

  var sendBtn = document.getElementById("claude-plan-send-btn");
  var clearBtn = document.getElementById("claude-plan-clear-btn");
  var countBadge = document.getElementById("claude-plan-count");
  var prevBtn = document.getElementById("claude-plan-prev-btn");
  var nextBtn = document.getElementById("claude-plan-next-btn");

  // --- Floating button ---
  var floatingBtn = document.createElement("div");
  floatingBtn.id = "claude-plan-floating-btn";
  floatingBtn.style.display = "none";
  floatingBtn.innerHTML =
    '<button id="claude-plan-add-btn" class="claude-plan-btn-add">+ Add directive [Ins]</button>';
  document.body.appendChild(floatingBtn);

  var addBtn = document.getElementById("claude-plan-add-btn");

  // --- Input overlay (textarea) ---
  var inputOverlay = document.createElement("div");
  inputOverlay.id = "claude-plan-input-overlay";
  inputOverlay.style.display = "none";
  inputOverlay.innerHTML =
    '<textarea id="claude-plan-input" placeholder="Your directive... (Enter to submit, Shift+Enter for newline)" rows="3"></textarea>' +
    '<div class="claude-plan-input-actions">' +
    '<button id="claude-plan-input-ok" class="claude-plan-btn-ok">OK</button>' +
    '<button id="claude-plan-input-cancel" class="claude-plan-btn-cancel">Cancel</button>' +
    "</div>";
  document.body.appendChild(inputOverlay);

  var inputField = document.getElementById("claude-plan-input");
  var inputOk = document.getElementById("claude-plan-input-ok");
  var inputCancel = document.getElementById("claude-plan-input-cancel");

  // --- Gutter pencil: hover on any block to quick-add directive ---
  var gutterPencil = document.createElement("div");
  gutterPencil.id = "claude-plan-gutter-pencil";
  gutterPencil.textContent = "\u270E";
  gutterPencil.title = "Add directive for this line";
  gutterPencil.style.display = "none";
  document.body.appendChild(gutterPencil);

  var hoveredBlockEl = null;

  document.addEventListener("mousemove", function (e) {
    if (inputOverlay.style.display !== "none") return;
    if (isInteracting) return;

    // Find the block element under cursor
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || toolbar.contains(target) || floatingBtn.contains(target) ||
        inputOverlay.contains(target)) {
      return;
    }
    // Mouse on the pencil itself — keep it visible, don't reposition
    if (gutterPencil.contains(target)) return;

    // Walk up to find nearest leaf block (LI, TR, TD, P, H*, etc.)
    // Prefer specific elements over broad containers
    var block = target;
    while (block && block !== document.body) {
      if (block.tagName === "LI" || block.tagName === "TR" ||
          block.tagName === "TD" || block.tagName === "TH" ||
          block.tagName === "P" || block.tagName === "H1" ||
          block.tagName === "H2" || block.tagName === "H3" ||
          block.tagName === "H4" || block.tagName === "BLOCKQUOTE" ||
          block.tagName === "DT" || block.tagName === "DD") {
        break;
      }
      // If we hit a data-line element that's not a container, stop
      if (block.hasAttribute("data-line") && !CONTAINERS.test(block.tagName)) {
        break;
      }
      block = block.parentElement;
    }

    if (!block || block === document.body) {
      // Between blocks — keep pencil visible on last known position
      return;
    }

    if (block === hoveredBlockEl) return;
    hoveredBlockEl = block;

    var rect = block.getBoundingClientRect();
    gutterPencil.style.display = "flex";
    gutterPencil.style.top = rect.top + window.scrollY + 2 + "px";
    gutterPencil.style.left = "2px";
  });

  document.addEventListener("mouseleave", function (e) {
    // Only hide if mouse actually left the document (not entering the pencil)
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      gutterPencil.style.display = "none";
      hoveredBlockEl = null;
    }
  });

  gutterPencil.addEventListener("mousedown", function (e) {
    isInteracting = true;
    e.preventDefault();
    e.stopPropagation();
  });

  gutterPencil.addEventListener("click", function (e) {
    e.stopPropagation();
    if (!hoveredBlockEl) return;

    var text = hoveredBlockEl.textContent.trim();
    var lineEl = findLineElement(hoveredBlockEl);
    var line = lineEl
      ? parseInt(lineEl.getAttribute("data-line"), 10) || 1
      : 1;

    currentSelection = {
      text: text.substring(0, 300),
      startLine: line,
      endLine: line,
      anchorEl: hoveredBlockEl,
      range: null,
    };

    gutterPencil.style.display = "none";
    floatingBtn.style.display = "none";
    editingIndex = -1;

    var rect = hoveredBlockEl.getBoundingClientRect();
    showInputAt(rect, "");
  });

  // --- Selection tracking ---
  var isInteracting = false;

  floatingBtn.addEventListener("mousedown", function (e) {
    isInteracting = true;
    e.preventDefault();
  });
  inputOverlay.addEventListener("mousedown", function (e) {
    isInteracting = true;
    e.preventDefault();
  });
  document.addEventListener("mouseup", function () {
    setTimeout(function () { isInteracting = false; }, 200);
  });

  document.addEventListener("selectionchange", function () {
    if (isInteracting) return;
    if (inputOverlay.style.display !== "none") return;

    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      floatingBtn.style.display = "none";
      currentSelection = null;
      return;
    }

    var text = sel.toString().trim();
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();

    // Find the tightest common ancestor that holds the selection
    var ancestor = range.commonAncestorContainer;
    var anchorEl = ancestor.nodeType === Node.ELEMENT_NODE
      ? ancestor
      : ancestor.parentElement;

    // If anchorEl is a broad container (UL, OL, TABLE...), narrow down
    // to the specific child element that contains the selection start
    anchorEl = narrowToLeaf(anchorEl, range.startContainer);

    // Walk up to find the closest data-line element
    var closestLineEl = anchorEl;
    while (closestLineEl && closestLineEl !== document.body) {
      if (closestLineEl.hasAttribute("data-line")) break;
      closestLineEl = closestLineEl.parentElement;
    }

    var startLine = closestLineEl && closestLineEl.hasAttribute("data-line")
      ? parseInt(closestLineEl.getAttribute("data-line"), 10) || 1
      : 1;

    // For end line: check if selection spans multiple data-line blocks
    var endLine = startLine;
    var endEl = findLineElement(range.endContainer);
    if (endEl) {
      var el = parseInt(endEl.getAttribute("data-line"), 10) || startLine;
      if (el > endLine) endLine = el;
    }

    currentSelection = {
      text: text.substring(0, 300),
      startLine: startLine,
      endLine: endLine,
      // Store the anchor element for precise badge placement
      anchorEl: anchorEl,
      range: range,
    };

    floatingBtn.style.display = "block";
    floatingBtn.style.top = rect.bottom + window.scrollY + 4 + "px";
    floatingBtn.style.left = rect.left + window.scrollX + "px";
  });

  // --- Keyboard shortcut: Insert key ---
  document.addEventListener("keydown", function (e) {
    if (e.key === "Insert") {
      e.preventDefault();
      if (currentSelection && currentSelection.range) {
        // Selection-based
        floatingBtn.style.display = "none";
        editingIndex = -1;
        var rect = currentSelection.range.getBoundingClientRect();
        showInputAt(rect, "");
      } else if (hoveredBlockEl) {
        // Hover-based: simulate gutter pencil click
        gutterPencil.click();
      }
    }
  });

  // --- Add directive flow ---
  addBtn.addEventListener("click", function () {
    if (!currentSelection) return;
    floatingBtn.style.display = "none";
    editingIndex = -1;
    var rect = currentSelection.range.getBoundingClientRect();
    showInputAt(rect, "");
  });

  inputField.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitDirective();
    } else if (e.key === "Escape") {
      cancelInput();
    }
  });

  inputOk.addEventListener("click", function () { submitDirective(); });
  inputCancel.addEventListener("click", function () { cancelInput(); });

  function showInputAt(rect, prefill) {
    inputOverlay.style.display = "flex";
    inputOverlay.style.top = rect.bottom + window.scrollY + 4 + "px";
    inputOverlay.style.left = rect.left + window.scrollX + "px";
    inputField.value = prefill;
    inputField.focus();
  }

  function submitDirective() {
    var note = inputField.value.trim();
    if (!note) { cancelInput(); return; }

    if (editingIndex >= 0) {
      annotations[editingIndex].note = note;
      refreshAllHighlights();
    } else {
      if (!currentSelection) { cancelInput(); return; }
      annotations.push({
        text: currentSelection.text,
        startLine: currentSelection.startLine,
        endLine: currentSelection.endLine,
        note: note,
        // Store a CSS selector to find the exact element later
        anchorSelector: buildSelector(currentSelection.anchorEl),
      });
      highlightAnnotation(annotations[annotations.length - 1], annotations.length - 1);
    }

    updateCount();
    saveState();
    syncClipboard();
    flashToolbar();

    inputOverlay.style.display = "none";
    editingIndex = -1;
    currentSelection = null;
    try { window.getSelection().removeAllRanges(); } catch (e) {}
  }

  function cancelInput() {
    inputOverlay.style.display = "none";
    editingIndex = -1;
    currentSelection = null;
  }

  // --- Build a unique CSS selector for an element ---
  function buildSelector(el) {
    if (!el || el === document.body) return "body";
    var parts = [];
    while (el && el !== document.body) {
      var tag = el.tagName.toLowerCase();
      var parent = el.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function (c) {
          return c.tagName === el.tagName;
        });
        if (siblings.length > 1) {
          var idx = siblings.indexOf(el) + 1;
          tag += ":nth-of-type(" + idx + ")";
        }
      }
      parts.unshift(tag);
      el = parent;
    }
    return parts.join(" > ");
  }

  // --- Highlight annotations ---
  function highlightAnnotation(ann, index) {
    // Try to find the exact element via stored selector
    var target = null;
    if (ann.anchorSelector) {
      try {
        target = document.querySelector(ann.anchorSelector);
      } catch (e) {}
    }

    // Fallback: find by line range but pick the most specific (deepest) element
    if (!target) {
      target = findDeepestElementForLine(ann.startLine);
    }

    if (!target) return;

    target.classList.add("claude-plan-annotated");

    var badge = document.createElement("div");
    badge.className = "claude-plan-annotation-badge";
    badge.setAttribute("data-annotation-index", index);

    var numSpan = document.createElement("span");
    numSpan.className = "claude-plan-badge-num";
    numSpan.textContent = (index + 1) + ".";

    var noteSpan = document.createElement("span");
    noteSpan.className = "claude-plan-badge-text";
    noteSpan.textContent = ann.note;

    var editBtn = document.createElement("button");
    editBtn.className = "claude-plan-badge-edit";
    editBtn.textContent = "\u270E";
    editBtn.title = "Edit";
    editBtn.addEventListener("mousedown", function (e) {
      isInteracting = true; e.preventDefault(); e.stopPropagation();
    });
    editBtn.addEventListener("click", function (e) {
      e.stopPropagation(); startEdit(index, badge);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.className = "claude-plan-badge-delete";
    deleteBtn.textContent = "\u2715";
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("mousedown", function (e) {
      isInteracting = true; e.preventDefault(); e.stopPropagation();
    });
    deleteBtn.addEventListener("click", function (e) {
      e.stopPropagation(); deleteAnnotation(index);
    });

    badge.appendChild(numSpan);
    badge.appendChild(noteSpan);
    badge.appendChild(editBtn);
    badge.appendChild(deleteBtn);
    target.appendChild(badge);
  }

  // Find the deepest (most specific) element for a given line
  function findDeepestElementForLine(line) {
    var all = document.querySelectorAll("[data-line]");
    var best = null;
    var bestDepth = -1;
    for (var i = 0; i < all.length; i++) {
      var l = parseInt(all[i].getAttribute("data-line"), 10);
      if (l === line) {
        var depth = getDepth(all[i]);
        if (depth > bestDepth) {
          bestDepth = depth;
          best = all[i];
        }
      }
    }
    return best;
  }

  function getDepth(el) {
    var d = 0;
    while (el && el !== document.body) { d++; el = el.parentElement; }
    return d;
  }

  function startEdit(index, badgeEl) {
    editingIndex = index;
    var rect = badgeEl.getBoundingClientRect();
    showInputAt(rect, annotations[index].note);
  }

  function deleteAnnotation(index) {
    annotations.splice(index, 1);
    refreshAllHighlights();
    updateCount();
    saveState();
    syncClipboard();
  }

  function refreshAllHighlights() {
    document.querySelectorAll(".claude-plan-annotated").forEach(function (el) {
      el.classList.remove("claude-plan-annotated");
    });
    document.querySelectorAll(".claude-plan-annotation-badge").forEach(function (el) {
      el.remove();
    });
    annotations.forEach(function (ann, i) {
      highlightAnnotation(ann, i);
    });
  }

  // --- Prev/Next navigation ---
  prevBtn.addEventListener("click", function () {
    if (annotations.length === 0) return;
    focusedAnnotationIndex--;
    if (focusedAnnotationIndex < 0) focusedAnnotationIndex = annotations.length - 1;
    scrollToAnnotation(focusedAnnotationIndex);
  });

  nextBtn.addEventListener("click", function () {
    if (annotations.length === 0) return;
    focusedAnnotationIndex++;
    if (focusedAnnotationIndex >= annotations.length) focusedAnnotationIndex = 0;
    scrollToAnnotation(focusedAnnotationIndex);
  });

  function scrollToAnnotation(index) {
    var badge = document.querySelector('[data-annotation-index="' + index + '"]');
    if (badge) {
      badge.scrollIntoView({ behavior: "smooth", block: "center" });
      badge.classList.add("claude-plan-badge-focus");
      setTimeout(function () { badge.classList.remove("claude-plan-badge-focus"); }, 1500);
    }
    countBadge.textContent = "directive " + (index + 1) + "/" + annotations.length;
  }

  // --- Copy to clipboard ---
  sendBtn.addEventListener("click", function () {
    if (annotations.length === 0) return;
    var prompt = buildPrompt();
    navigator.clipboard.writeText(prompt).then(function () {
      sendBtn.textContent = "Copied!";
      sendBtn.classList.add("claude-plan-btn-copied");
      setTimeout(function () {
        sendBtn.textContent = "Copy directives";
        sendBtn.classList.remove("claude-plan-btn-copied");
      }, 2000);
    });
  });

  // --- Clear all ---
  clearBtn.addEventListener("click", function () {
    annotations = [];
    focusedAnnotationIndex = -1;
    updateCount();
    saveState();
    navigator.clipboard.writeText("").catch(function () {});
    refreshAllHighlights();
  });

  // --- Clean persistence when preview is closed ---
  window.addEventListener("beforeunload", function () {
    sessionStorage.removeItem(STORAGE_KEY);
  });

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(annotations)); }
    catch (e) {}
  }

  function syncClipboard() {
    if (annotations.length === 0) return;
    navigator.clipboard.writeText(buildPrompt()).catch(function () {});
  }

  function flashToolbar() {
    toolbar.classList.add("claude-plan-toolbar-flash");
    setTimeout(function () { toolbar.classList.remove("claude-plan-toolbar-flash"); }, 600);
  }

  function buildPrompt() {
    var fileName =
      document.title || document.querySelector("h1")?.textContent || "plan.md";
    var lines = ["fix:plan (" + fileName + ")"];
    annotations.forEach(function (ann, i) {
      var excerpt = ann.text.length > 80
        ? ann.text.substring(0, 80) + "..."
        : ann.text;
      excerpt = excerpt.replace(/\s+/g, " ");
      lines.push(
        (i + 1) + '. "' + excerpt + '" (~line ' + ann.startLine + "): " + ann.note
      );
    });
    return lines.join("\n");
  }

  // --- Helpers ---
  function updateCount() {
    var n = annotations.length;
    countBadge.textContent = n + " directive(s)";
    sendBtn.disabled = n === 0;
    prevBtn.disabled = n === 0;
    nextBtn.disabled = n === 0;
    focusedAnnotationIndex = -1;
  }

  // Narrow a broad container (UL, OL, TABLE...) down to the specific
  // child element (LI, TR, TD) that contains the target node
  function narrowToLeaf(el, targetNode) {
    if (!el || !CONTAINERS.test(el.tagName)) return el;
    var node = targetNode;
    var leaf = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    // Walk up from targetNode until we find a direct child of the container
    while (leaf && leaf.parentElement !== el) {
      leaf = leaf.parentElement;
    }
    return leaf || el;
  }

  function findLineElement(node) {
    var el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    while (el && el !== document.body) {
      if (el.hasAttribute("data-line")) return el;
      el = el.parentElement;
    }
    return null;
  }

  // --- Restore on load ---
  if (annotations.length > 0) {
    setTimeout(function () {
      refreshAllHighlights();
      updateCount();
    }, 500);
  }
})();
