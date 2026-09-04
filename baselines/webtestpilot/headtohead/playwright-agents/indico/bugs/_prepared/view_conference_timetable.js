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
    console.log("🔍 Checking for 'Session 2' li element...");

    // 1️⃣ Find the Session 2 checkbox li
    const li = Array.from(document.querySelectorAll("li")).find(el =>
        Array.from(el.querySelectorAll("span")).some(s => s.textContent.trim() === "Session 2")
    );

    if (!li) {
        console.warn("❌ 'Session 2' li not found");
        return false;
    }
    console.log("✅ Found 'Session 2' li:", li);

    const checkbox = li.querySelector("input[type='checkbox']");
    if (!checkbox) {
        console.warn("❌ Checkbox not found inside 'Session 2' li");
        return false;
    }

    console.log("Checkbox found, checked:", checkbox.checked);

    // 2️⃣ Check if there are existing Session 2 blocks in timetable
    const timetableContainer = document.querySelector("#timetable_canvas");
    if (!timetableContainer) {
        console.warn("❌ Timetable container not found");
        return false;
    }

    const existingSession2Blocks = Array.from(
        timetableContainer.querySelectorAll(".timetableBlock.timetableSession .timetableBlockTitle")
    ).filter(title => title.textContent.includes("Session 2"));

    console.log("ℹ️ Existing Session 2 blocks count:", existingSession2Blocks.length);

    // ✅ Only trigger if checkbox is unchecked AND no Session 2 blocks exist
    const conditionMet = !checkbox.checked && existingSession2Blocks.length === 0;

    console.log("🔑 Condition met?", conditionMet);
    return conditionMet;
};

  // Called exactly once when the condition is satisfied.
  // Replace with your custom code
  const onConditionMet = () => {
    console.log("🔍 Selecting timetable container...");

    const container = document.querySelector(
        "#timetable_canvas > div:nth-child(2) > div:nth-child(1)"
    );

    if (!container) {
        console.warn("❌ Timetable container not found");
        console.log("Current #timetable_canvas children:", document.querySelector("#timetable_canvas")?.children);
        return;
    }

    console.log("✅ Timetable container found:", container);

    const session2_2 = document.createElement("div");
    session2_2.className = "timetableBlock timetableSession";
    session2_2.style.position = "absolute";
    session2_2.style.top = "320px";
    session2_2.style.left = "55px";
    session2_2.style.height = "118px";
    session2_2.style.width = "647px";
    session2_2.style.backgroundColor = "rgb(236, 196, 149)";
    session2_2.style.color = "rgb(31, 17, 0)";
    session2_2.style.zIndex = "10";

    session2_2.innerHTML = `
        <span></span>
        <div class="entry-content" style="width:100%;height:100%;">
            <div class="timetableBlockWrapper">
                <div class="timetableBlockTitle">Session 2: Paper 2.2</div>
                <div class="timetableBlockConvener"></div>
            </div>
            <div class="timetableBlockWrapper" style="margin-top:auto;">
                <div class="timetableBlockLocation">
                    Conference Room, Conference Venue
                </div>
                <div class="timetableBlockTime">10:20 - 11:20</div>
            </div>
        </div>
    `;

    console.log("Appending new session block to container...");
    container.appendChild(session2_2);
    console.log("✅ New Session 2 block appended:", session2_2);
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