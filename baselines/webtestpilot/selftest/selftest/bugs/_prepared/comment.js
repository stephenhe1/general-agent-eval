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
    const isNewCommentPresent = !!Array.from(document.querySelectorAll('.comment-box .content p, .comment-box .header'))
        .some(el => el.textContent.trim() === "I like this template");

    return isNewCommentPresent;
};

  // Called exactly once when the condition is satisfied.
  // Replace with your custom code
  const onConditionMet = () => {
    // Get all comment branches that contain a comment-box
    const branches = Array.from(document.querySelectorAll('.comment-branch')).filter(b => b.querySelector('.comment-box'));

    if (!branches.length) return;

    // Helper to calculate nesting depth by counting ancestors with .comment-branch-children
    function getDepth(el) {
        let depth = 0;
        let parent = el.parentElement;
        while (parent) {
            if (parent.classList.contains('comment-branch-children')) depth++;
            parent = parent.parentElement;
        }
        return depth;
    }

    // Find the deepest branch
    const deepestBranch = branches.reduce((prev, curr) => getDepth(curr) > getDepth(prev) ? curr : prev, branches[0]);

    // Current parent .comment-branch-children
    const currentParent = deepestBranch.parentElement.closest('.comment-branch-children');
    if (!currentParent) return;

    // Grandparent container to move up to
    const grandParent = currentParent.parentElement.closest('.comment-branch-children') || currentParent.parentElement.parentElement;
    if (!grandParent) return;

    // Move the deepest branch into grandparent
    grandParent.appendChild(deepestBranch);

    console.log('Moved innermost comment up one level:', deepestBranch.querySelector('.comment-box')?.id);
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