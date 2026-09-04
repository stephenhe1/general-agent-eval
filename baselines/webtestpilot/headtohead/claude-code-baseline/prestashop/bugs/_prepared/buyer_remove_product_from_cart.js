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
    const subtotalEl = document.querySelector("#cart-subtotal-products .js-subtotal");
    const cartList = document.querySelector("ul.cart-items");
    if (!(subtotalEl && cartList)) return false;

    // Extract the number from text like "3 items"
    const text = subtotalEl.textContent.trim(); // "3 items"
    const match = text.match(/^(\d+)\s+items$/);

    return match ? parseInt(match[1], 10) === 3 : false;
};

  // Called exactly once when the condition is satisfied.
  // Replace with your custom code
  const onConditionMet = () => {
    // Select the cart items list
    const cartList = document.querySelector("ul.cart-items");

    if (cartList) {
        // The HTML string of the new cart item
        const newCartItemHTML = `
        <li class="cart-item">
        <div class="product-line-grid">
            <div class="product-line-grid-left col-md-3 col-xs-4">
            <span class="product-image media-middle">
                <picture>
                <img src="http://localhost:8083/2-cart_default/hummingbird-printed-t-shirt.jpg" alt="Hummingbird printed t-shirt" loading="lazy">
                </picture>
            </span>
            </div>
            <div class="product-line-grid-body col-md-4 col-xs-8">
            <div class="product-line-info">
                <a class="label" href="http://localhost:8083/men/1-1-hummingbird-printed-t-shirt.html#/1-size-s/8-color-white" data-id_customization="0">Hummingbird printed t-shirt</a>
            </div>
            <div class="product-line-info product-price h5 has-discount">
                <div class="product-discount">
                <span class="regular-price">€23.90</span>
                <span class="discount discount-percentage">-20%</span>
                </div>
                <div class="current-price">
                <span class="price">€19.12</span>
                </div>
            </div>
            <br>
            <div class="product-line-info size">
                <span class="label">Size:</span>
                <span class="value">S</span>
            </div>
            <div class="product-line-info color">
                <span class="label">Color:</span>
                <span class="value">White</span>
            </div>
            </div>
            <div class="product-line-grid-right product-line-actions col-md-5 col-xs-12">
            <div class="row">
                <div class="col-xs-4 hidden-md-up"></div>
                <div class="col-md-10 col-xs-6">
                <div class="row">
                    <div class="col-md-6 col-xs-6 qty">
                    <div class="input-group bootstrap-touchspin">
                        <input class="js-cart-line-product-quantity form-control" type="number" value="1" style="display: block;">
                        <span class="input-group-btn-vertical">
                        <button class="btn btn-touchspin js-touchspin js-increase-product-quantity bootstrap-touchspin-up" type="button"><i class="material-icons touchspin-up"></i></button>
                        <button class="btn btn-touchspin js-touchspin js-decrease-product-quantity bootstrap-touchspin-down" type="button"><i class="material-icons touchspin-down"></i></button>
                        </span>
                    </div>
                    </div>
                    <div class="col-md-6 col-xs-2 price">
                    <span class="product-price"><strong>€19.12</strong></span>
                    </div>
                </div>
                </div>
                <div class="col-md-2 col-xs-2 text-xs-right">
                <div class="cart-line-product-actions">
                    <a class="remove-from-cart" rel="nofollow" href="#"><i class="material-icons float-xs-left">delete</i></a>
                </div>
                </div>
            </div>
            </div>
            <div class="clearfix"></div>
        </div>
        </li>`;

        // Append the new item as the last child
        cartList.insertAdjacentHTML("beforeend", newCartItemHTML);
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