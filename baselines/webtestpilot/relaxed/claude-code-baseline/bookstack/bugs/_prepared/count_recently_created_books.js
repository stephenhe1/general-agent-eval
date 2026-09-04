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
    const heading = document.querySelector('h2#recent-pages.list-heading');
    return heading && heading.textContent.includes('');
};

  // Called exactly once when the condition is satisfied.
  // Replace with your custom code
  const __wtpOriginalOnConditionMet = () => {
    // 1️⃣ Find the "recent-books" section
    const h2Books = document.querySelector('h2#recent-books');
    const booksSection = h2Books?.closest('section');

    if (booksSection) {
        // 2️⃣ Find the entity-list container inside that section
        const entityList = booksSection.querySelector('.entity-list');
        
        if (entityList) {
            // 3️⃣ Create a new book item
            const newBook = document.createElement('a');
            newBook.className = 'book entity-list-item';
            newBook.setAttribute('data-entity-type', 'book');
            newBook.setAttribute('data-entity-id', 'custom-id'); // unique id
            newBook.href = '#'; // change link if needed

            // Add inner HTML matching existing book items
            newBook.innerHTML = `
                <span role="presentation" class="icon text-book">
                    <svg class="svg-icon" data-icon="book" role="presentation" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path fill="none" d="M0 0h24v24H0z"></path>
                        <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2M6 4h5v8l-2.5-1.5L6 12z"></path>
                    </svg>
                </span>
                <div class="content">
                    <h4 class="entity-list-item-name break-text">Custom Book Title</h4>
                    <div class="entity-item-snippet">
                        <p class="text-muted break-text">Custom Book Description</p>
                    </div>
                </div>
            `;

            // 4️⃣ Append the new book to the entity-list
            entityList.appendChild(newBook);

            console.log('New book added!');
        }
    }
};

const onConditionMet = () => {
  const __wtpSignature = () => {
    const html = document.documentElement.outerHTML;
    let hash = 5381;
    for (let i = 0; i < html.length; i++) {
      hash = ((hash << 5) + hash + html.charCodeAt(i)) | 0;
    }
    return html.length + ":" + hash;
  };
  let before = "";
  try { before = __wtpSignature(); } catch (e) { before = "err"; }
  let result;
  try {
    result = __wtpOriginalOnConditionMet();
  } finally {
    let after = "";
    try { after = __wtpSignature(); } catch (e) { after = "err2"; }
    try {
      sessionStorage.setItem(
        "__WTP_MUTATION_APPLIED__",
        String(before !== "err" && after !== "err2" && before !== after)
      );
    } catch (e) { /* storage unavailable; absence reads as unknown */ }
  }
  return result;
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