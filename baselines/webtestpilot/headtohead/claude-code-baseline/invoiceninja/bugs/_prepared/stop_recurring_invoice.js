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
  const PREV_KEY = "__prev_condition__";
  const COUNT_KEY = "__condition_visit_count__";

  // Check path and panels existence
  const pathOk = window.location.pathname === "/dashboard";
  const panelsExist = !!document.querySelector(
      "html > body > div > div > div:nth-child(2) > div:nth-child(3) > main > div > div:nth-child(3)"
  );

  const condition = pathOk && panelsExist;
  const prevCondition = sessionStorage.getItem(PREV_KEY) === "true";

  // Persist current condition for next call
  sessionStorage.setItem(PREV_KEY, String(condition));

  // Only trigger on false → true transition
  if (!prevCondition && condition) {
      const count = Number(sessionStorage.getItem(COUNT_KEY) || 0) + 1;
      sessionStorage.setItem(COUNT_KEY, count);
      return count >= 2;
  }

  return false;
};

  // Called exactly once when the condition is satisfied.
  // Replace with your custom code
  const onConditionMet = () => {
  // ===== Editable data =====
  const invoiceId = "VolejRejNm";
  const invoiceNumber = "123456";

  const clientId = "VolejRejNm";
  const clientName = "company_name";

  const nextSendDate = "01/Jan/9999 06:00:00 AM";

  const amount = "$ 670,000.00";
  const amountBgClass = "bg-blue-400";
  // =========================


  // 1. Locate the Upcoming Recurring Invoices table tbody
  const upcomingRecurringTbody = [...document.querySelectorAll("h3")]
    .find(h => h.innerText.includes("Upcoming Recurring Invoices"))
    ?.closest("form")
    ?.querySelector("table tbody");

  if (!upcomingRecurringTbody) {
    throw new Error("Upcoming Recurring Invoices table not found");
  }

  // 2. Remove all existing rows
  upcomingRecurringTbody.replaceChildren();

  // 3. Insert one new row
  const tr = document.createElement("tr");
  tr.className = "border-b border-gray-200";
  tr.style.borderColor = "rgb(209, 213, 219)";

  tr.innerHTML = `
    <td
      class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words cursor-pointer first:pl-2 py-3 overflow-hidden whitespace-nowrap text-ellipsis"
      style="color: rgb(42, 48, 61);"
    >
      <a
        href="/recurring_invoices/${invoiceId}/edit"
        class="text-sm hover:underline"
        style="color: rgb(17, 125, 192);"
      >
        ${invoiceNumber}
      </a>
    </td>

    <td
      class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words cursor-pointer first:pl-2 py-3 overflow-hidden whitespace-nowrap text-ellipsis"
      style="color: rgb(42, 48, 61);"
    >
      <a
        href="/clients/${clientId}"
        class="text-sm hover:underline"
        style="color: rgb(17, 125, 192);"
      >
        ${clientName}
      </a>
    </td>

    <td
      class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words cursor-pointer first:pl-2 py-3 overflow-hidden whitespace-nowrap text-ellipsis"
      style="color: rgb(42, 48, 61);"
    >
      ${nextSendDate}
    </td>

    <td
      class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words first:pl-2 py-3 overflow-hidden whitespace-nowrap text-ellipsis"
      style="color: rgb(42, 48, 61);"
    >
      <span class="text-xs px-2 py-1 rounded ${amountBgClass} text-white font-mono">
        ${amount}
      </span>
    </td>
  `;

  upcomingRecurringTbody.appendChild(tr);
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