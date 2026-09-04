/**
 * Introduction:
 * -------------
 * This script monitors the page for two types of events:
 *   1. Initial page load (DOMContentLoaded or already-loaded document)
 *   2. DOM mutations (subtree changes, attributes, or child list changes)
 * 
 * When either event occurs, it evaluates a user-defined condition via the 
 * `isConditionMet` function. If the condition returns true, the `onConditionMet`
 * function is executed exactly once. After triggering, the sentinel cleans up 
 * its internal MutationObserver.
 * 
 * Usage:
 * ------
 * - Inject this template via Playwright.
 * - Replace {{IS_CONDITION_MET}} -> Body of the condition-checking function.
 * - Replace {{ON_CONDITION_MET}} -> Body of the callback to execute when condition is met.
 */

(() => {
  // Prevents duplicate observers if the script is injected multiple times
  const NAMESPACE = "__BUG_INJECTOR__";
  const STORAGE_KEY = "__BUG_INJECTOR_TRIGGERED__";

  // Prevent duplicate observers or repeated triggers
  if (window[NAMESPACE] || sessionStorage.getItem(STORAGE_KEY)) return;

  // Evaluates whether the desired condition has been satisfied.
  // Replace with your custom code
  const isConditionMet = () => {
    const PATH_KEY = "__prev_path__";
    const COUNT_KEY = "__dashboard_visit_count__";

    const currentPath = window.location.pathname;
    const prevPath = sessionStorage.getItem(PATH_KEY);

    // Always update previous path for next call
    sessionStorage.setItem(PATH_KEY, currentPath);

    // Only care about entering /dashboard
    if (currentPath !== "/dashboard") return false;

    // If we are already on /dashboard, do not recount
    if (prevPath === "/dashboard") return false;

    // We just entered /dashboard from another path
    const count = Number(sessionStorage.getItem(COUNT_KEY) || 0) + 1;
    sessionStorage.setItem(COUNT_KEY, count);

    return count >= 2;
};

  // Called exactly once when the condition is satisfied.
  // Replace with your custom code
  const onConditionMet = () => {
    // Find the outer container with the label "Outstanding"
    const container = [...document.querySelectorAll('div.flex.justify-between.items-center')].find(div => {
        const label = div.querySelector('span.text-gray-500');
        return label && label.textContent.trim() === "Outstanding";
    });

    if (container) {
        // Find the span with the amount
        const amountSpan = container.querySelector('span.text-base.font-mono');
        if (amountSpan) {
            amountSpan.textContent = "$ 100,000.00";
            console.log("Amount updated!");
        }
    }

    // Find the container with the label "Total Invoices Outstanding"
    const container2 = [...document.querySelectorAll('div.flex.justify-between.items-center')].find(div => {
        const label = div.querySelector('span.text-gray-500');
        return label && label.textContent.trim() === "Total Invoices Outstanding";
    });

    if (container2) {
        // Find the span that contains the number
        const numberSpan = container2.querySelector('span.text-base.font-mono');
        if (numberSpan) {
            numberSpan.textContent = "2";
            console.log("Total Invoices Outstanding updated!");
        }
    }
};

  // Internal State
  // -----------------------------------------------------------------------------
  // Tracks whether the initial page load event has been handled
  let pageLoaded = false;

  // Tracks whether the condition has been satisfied and action has been executed
  let conditionMet = false;

  // Prevents concurrent condition checks when a series of DOM mutation events happen
  let checkScheduled = false;

  // MutationObserver for DOM mutation events
  let mutationObserver = null;

  // Handles detection events by checking condition and triggering onConditionMet() once
  function handleDetection() {
    if (conditionMet) return;

    if (isConditionMet()) {
      conditionMet = true;
      onConditionMet();
      cleanup();
    }

    if (mutationObserver) {
      mutationObserver.takeRecords();
    }
  }

  // Cleanup after triggering onConditionMet()
  function cleanup() {
    sessionStorage.setItem(STORAGE_KEY, "true");

    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  // Detector #1: Page Load
  // -----------------------------------------------------------------------------
  function handlePageLoad() {
    if (pageLoaded) return;
    pageLoaded = true;
    handleDetection();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    handlePageLoad();
  } else {
    document.addEventListener("DOMContentLoaded", handlePageLoad, { once: true });
  }

  // Detector #2: Coalesced DOM Mutations
  // -----------------------------------------------------------------------------
  function handleObserver() {
    mutationObserver = new MutationObserver(() => {
      if (conditionMet) {
        cleanup();
        return;
      }

      // Coalesce multiple mutations into one check per animation frame
      if (checkScheduled) return;

      checkScheduled = true;
      handleDetection();

      // Allow next burst of mutations to trigger check
      requestAnimationFrame(() => {
        checkScheduled = false;
      });
    });

    mutationObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-expanded", "aria-hidden"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", handleObserver, { once: true });
  } else {
    handleObserver();
  }

  window[NAMESPACE] = { mutationObserver, conditionMet };
})();