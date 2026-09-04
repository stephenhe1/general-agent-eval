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
    // Only care about this exact page
    return window.location.pathname == '/books/book/page/new-page'
};

  // Called exactly once when the condition is satisfied.
  // Replace with your custom code
  const onConditionMet = () => {
    // Find the existing page-comments section
    const oldSection = document.querySelector('section[component="page-comments"]');
    if (!oldSection) return;

    // Create a new section element
    const newSection = document.createElement('section');
    newSection.setAttribute('component', 'page-comments');
    newSection.setAttribute('option:page-comments:page-id', '5');
    newSection.setAttribute('option:page-comments:created-text', 'Comment added');
    newSection.setAttribute('option:page-comments:count-text', '{0} No Comments|{1} 1 Comment|[2,*] :count Comments');
    newSection.setAttribute('option:page-comments:wysiwyg-language', 'en-GB');
    newSection.setAttribute('option:page-comments:wysiwyg-text-direction', 'ltr');
    newSection.className = 'comments-list';
    newSection.setAttribute('aria-label', 'Comments');

    // Insert the inner HTML (the cleaned up version with only one comment)
    newSection.innerHTML = `
        <div refs="page-comments@comment-count-bar" class="grid half left-focus v-center no-row-gap">
            <h5 refs="page-comments@comments-title">1 Comment</h5>
        </div>

        <div refs="page-comments@commentContainer" class="comment-container">
            <div class="comment-branch">
                <div class="mb-m">
                    <div component="page-comment" 
                         option:page-comment:comment-id="1" 
                         option:page-comment:comment-local-id="1" 
                         option:page-comment:comment-parent-id="" 
                         option:page-comment:updated-text="Comment updated" 
                         option:page-comment:deleted-text="Comment deleted" 
                         option:page-comment:wysiwyg-language="en-GB" 
                         option:page-comment:wysiwyg-text-direction="ltr" 
                         id="comment1" 
                         class="comment-box">

                        <div class="header">
                            <div class="flex-container-row wrap items-center gap-x-xs">
                                <div>
                                    <img width="50" src="http://localhost:8081/user_avatar.png" class="avatar block mr-xs" alt="Admin">
                                </div>
                                <div class="meta text-muted flex-container-row wrap items-center flex text-small">
                                    <a href="http://localhost:8081/user/admin">Admin</a>
                                    <span title="2026-01-23 03:35:55">&nbsp;commented </span>
                                </div>
                                <div class="right-meta flex-container-row justify-flex-end items-center px-s">
                                    <div class="actions mr-s">
                                        <button refs="page-comment@reply-button" type="button" class="text-button text-muted hover-underline text-small p-xs">Reply</button>
                                        <button refs="page-comment@edit-button" type="button" class="text-button text-muted hover-underline text-small p-xs">Edit</button>
                                        <div component="dropdown" class="dropdown-container">
                                            <button type="button" refs="dropdown@toggle" class="text-button text-muted hover-underline text-small p-xs">Delete</button>
                                        </div>
                                    </div>
                                    <div>
                                        <a class="bold text-muted text-small" href="#comment1">#1</a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div refs="page-comment@content-container" class="content">
                            <p>Comment</p>
                        </div>

                        <form novalidate="" refs="page-comment@form" hidden="" class="content pt-s px-s block">
                            <div class="form-group description-input">
                                <textarea refs="page-comment@input" name="html" rows="3" placeholder="Leave a comment here">&lt;p&gt;Comment&lt;/p&gt;</textarea>
                            </div>
                            <div class="form-group text-right">
                                <button type="button" class="button outline" refs="page-comment@form-cancel">Cancel</button>
                                <button type="submit" class="button">Save Comment</button>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>

        <div refs="page-comments@form-container" hidden="" class="comment-branch mb-m">
            <div class="comment-box">
                <div class="header p-s">New Comment</div>
                <div class="content px-s pt-s">
                    <form refs="page-comments@form" novalidate="">
                        <div class="form-group description-input">
                            <textarea refs="page-comments@form-input" name="html" rows="3" placeholder="Leave a comment here"></textarea>
                        </div>
                        <div class="form-group text-right">
                            <button type="button" class="button outline" refs="page-comments@hide-form-button">Cancel</button>
                            <button type="submit" class="button">Save Comment</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div refs="page-comments@addButtonContainer" class="text-right">
            <button type="button" refs="page-comments@add-comment-button" class="button outline">Add Comment</button>
        </div>
    `;

    // Replace old section with the new one
    oldSection.replaceWith(newSection);
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