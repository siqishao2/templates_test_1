/**
 * Jizao platform route-bridge: bridges route changes between the iframe and the parent page.
 *
 * Current loading mechanism: ships with the template scaffold into the sandbox workspace's
 * public/ and is referenced by the template's app/layout.tsx via a synchronous <script> in
 * <head>. It is therefore visible, editable, and deletable by users/agents — it is a
 * best-effort capability: if the script is gone, only the top route input stops syncing;
 * the preview itself is unaffected.
 *
 * Planned loading mechanism: injected as the first element in the preview HTML's <head> by
 * Ingress Nginx sub_filter. Once that lands, the platform concern is fully isolated from
 * user code (invisible and unmodifiable by users), and this file can be removed from the template.
 *
 * Responsibility: postMessage iframe route changes to the parent page (Jizao workbench) to
 * keep the top route input in sync.
 *
 * Naming convention: the -bridge suffix follows industry convention (console-bridge /
 * history-bridge / ...), with a domain prefix — this file bridges "route". Name future
 * extensions <domain>-bridge; one file bridges one kind of capability.
 *
 * Security constraints:
 *  - postMessage uses an explicit targetOrigin, never "*": messages are not broadcast.
 *  - The whole file follows "fail silently": every exception is swallowed and must never affect the user app.
 *
 * Triggers:
 *  - history.pushState / replaceState (SPA navigation via Link / router.push)
 *  - popstate (browser back/forward)
 *  - hashchange
 *  - Initial DOMContentLoaded
 */
(function () {
  "use strict";

  // Guard against duplicate loading (HMR / manual double-injection)
  if (window.__JIZAO_ROUTE_BRIDGE__) return;
  window.__JIZAO_ROUTE_BRIDGE__ = true;

  var parentOriginKey = "__jizao_preview_parent_origin";

  /** Prefer the actual ancestor; a full-page link makes referrer the preview itself. */
  function resolveParentOrigin() {
    try {
      if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
        return window.location.ancestorOrigins[0];
      }
    } catch (_e) {
      /* ancestorOrigins unavailable; fall through to referrer and session cache */
    }

    try {
      if (document.referrer) {
        var referrerOrigin = new URL(document.referrer).origin;
        if (referrerOrigin !== window.location.origin) return referrerOrigin;
      }
    } catch (_e) {
      /* Failed to parse referrer */
    }

    try {
      return new URL(sessionStorage.getItem(parentOriginKey)).origin;
    } catch (_e) {
      /* Storage may be unavailable in embedded documents */
    }
    return null;
  }

  var parentOrigin = resolveParentOrigin();
  if (!parentOrigin) return;
  try {
    sessionStorage.setItem(parentOriginKey, parentOrigin);
  } catch (_e) {
    /* Route reporting must still work when browser storage is blocked */
  }

  function report(kind) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            source: "jizao-preview",
            type: "__jizao_route_change",
            path: window.location.pathname + window.location.search + window.location.hash,
            kind: kind,
            entryKey: window.navigation && window.navigation.currentEntry
              ? window.navigation.currentEntry.key
              : undefined,
          },
          parentOrigin
        );
      }
    } catch (_e) {
      /* Swallow postMessage errors; never interrupt user code */
    }
  }

  try {
    var originalPush = history.pushState;
    var originalReplace = history.replaceState;

    history.pushState = function () {
      var ret = originalPush.apply(this, arguments);
      report("push");
      return ret;
    };

    history.replaceState = function () {
      var ret = originalReplace.apply(this, arguments);
      report("replace");
      return ret;
    };

    window.addEventListener("popstate", function () { report("pop"); });
    window.addEventListener("hashchange", function () { report("hash"); });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { report("load"); }, { once: true });
    } else {
      report("load");
    }
  } catch (_e) {
    /* Any hook installation failure must not affect the page */
  }
})();
