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
    if (window.location.pathname !== "/invoices") return false;

    // spinner gone
    const spinnerGone = !document.querySelector("svg.animate-spin");

    // table + first row
    const table = document.querySelector("table.min-w-full");
    if (!table) return false;

    const firstRow = table.querySelector("tbody tr");
    if (!firstRow) return false;

    return spinnerGone;
};

  // Called exactly once when the condition is satisfied.
  // Replace with your custom code
  const onConditionMet = () => {
    const invoiceId = "FakeInvoice123";
    const invoiceNumber = "123456_sent_2";
    const clientName = "company_name_2";
    const clientHref = "/clients/FakeClient";
    const invoiceHref = `/invoices/${invoiceId}/edit`;
    const statusText = "Sent";            // e.g., "Paid", "Draft", "Past Due"
    const statusBgColor = "bg-blue-300";  // Tailwind/utility class for background color
    const amount = "$ 120,000.00";
    const balance = "$ 120,000.00";
    const date = "15/Jan/2026";
    const dueDate = "";   

    // Select the table body
    const tbody = document.querySelector('table tbody');

    // Create a new row
    const tr = document.createElement('tr');

    // Fill in the row with fake invoice data
    tr.innerHTML = `
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words cursor-pointer overflow-hidden whitespace-nowrap text-ellipsis">
        <div class="relative flex items-start">
        <div class="flex items-center h-5">
            <input type="checkbox" class="sc-dVBluf iXKCKN h-4 w-4 rounded cursor-pointer child-checkbox" value="${invoiceId}" style="border-color: rgb(209, 213, 219);">
        </div>
        <div class="ml-3 text-sm">
            <label class="font-medium cursor-pointer"></label>
        </div>
        </div>
    </td>
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words cursor-pointer overflow-hidden whitespace-nowrap text-ellipsis">
        <span class="text-xs px-2 py-1 rounded ${statusBgColor} text-white">${statusText}</span>
    </td>
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words cursor-pointer overflow-hidden whitespace-nowrap text-ellipsis">
        <a class="text-sm hover:underline" href="${invoiceHref}" style="color: rgb(17, 125, 192);">${invoiceNumber}</a>
    </td>
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words cursor-pointer overflow-hidden whitespace-nowrap text-ellipsis">
        <a class="text-sm hover:underline" href="${clientHref}" style="color: rgb(17, 125, 192);">${clientName}</a>
    </td>
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words overflow-hidden whitespace-nowrap text-ellipsis">${amount}</td>
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words overflow-hidden whitespace-nowrap text-ellipsis">${balance}</td>
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words overflow-hidden whitespace-nowrap text-ellipsis">${date}</td>
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words overflow-hidden whitespace-nowrap text-ellipsis">${dueDate}</td>
    <td class="px-2 lg:px-2.5 xl:px-4 py-2 text-sm break-words overflow-hidden whitespace-nowrap text-ellipsis">
        <div>
        <button type="button" class="sc-hRDKVd ixjDYY border inline-flex items-center space-x-2 px-4 justify-center rounded text-sm py-2 hover:bg-white hover:border-gray-300">
            <span>Actions</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </button>
        </div>
    </td>
    `;

    // Append the row to the table body
    tbody.appendChild(tr);
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