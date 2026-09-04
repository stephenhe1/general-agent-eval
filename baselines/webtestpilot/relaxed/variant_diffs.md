# Relaxed-trigger variant diffs

Every edit made to every fault, for review. `tier1` = trigger only, mutation byte-identical to the benchmark's. `tier2` = the mutation also located its victim by literal and was relaxed too, so the fault's shape is preserved but the element it hits may differ.

### bookstack/comment  [tier1]
--- comment.js (original)
+++ comment.js (relaxed)
@@ -3,3 +3,3 @@
     const isNewCommentPresent = !!Array.from(document.querySelectorAll('.comment-box .content p, .comment-box .header'))
-        .some(el => el.textContent.trim() === "I like this template");
+        .some(el => el.textContent.trim() != null);
 

### bookstack/count_recently_created_books  [tier1]
--- count_recently_created_books.js (original)
+++ count_recently_created_books.js (relaxed)
@@ -3,3 +3,3 @@
     const heading = document.querySelector('h2#recent-pages.list-heading');
-    return heading && heading.textContent.includes('Recently Created Pages');
+    return heading && heading.textContent.includes('');
 };

### bookstack/count_recently_created_chapters  [tier1]
--- count_recently_created_chapters.js (original)
+++ count_recently_created_chapters.js (relaxed)
@@ -3,3 +3,3 @@
     const heading = document.querySelector('h2#recent-pages.list-heading');
-    return heading && heading.textContent.includes('Recently Created Pages');
+    return heading && heading.textContent.includes('');
 };

### bookstack/count_recently_created_shelves  [tier1]
--- count_recently_created_shelves.js (original)
+++ count_recently_created_shelves.js (relaxed)
@@ -3,3 +3,3 @@
     const heading = document.querySelector('h2#recent-pages.list-heading');
-    return heading && heading.textContent.includes('Recently Created Pages');
+    return heading && heading.textContent.includes('');
 };

### bookstack/delete_book  [tier1]
--- delete_book.js (original)
+++ delete_book.js (relaxed)
@@ -5,3 +5,3 @@
 
-  const condition = document.querySelector('h1.list-heading')?.textContent.trim() === 'Books';
+  const condition = document.querySelector('h1.list-heading')?.textContent.trim() != null;
   const prevCondition = sessionStorage.getItem(PREV_KEY) === "true";

### bookstack/recent_activity_all  [tier1]
--- recent_activity_all.js (original)
+++ recent_activity_all.js (relaxed)
@@ -3,3 +3,3 @@
     const recentActivitySection = document.querySelector('#recent-user-activity h5');
-    return recentActivitySection && recentActivitySection.textContent.trim() === "Recent Activity";
+    return recentActivitySection && recentActivitySection.textContent.trim() != null;
 };

### bookstack/settings  [tier2]
--- settings.js (original)
+++ settings.js (relaxed)
@@ -3,3 +3,3 @@
   const h = document.querySelector('h1#sorting.list-heading');
-  return h && h.textContent.trim() === "Sorting";
+  return h && h.textContent.trim() != null;
 };
@@ -11,3 +11,3 @@
   for (const a of links) {
-    if (a.textContent.trim() === "Create Sort Rule") {
+    if (a.textContent.trim() != null) {
       a.remove();

### indico/clone_event  [tier2]
--- clone_event.js (original)
+++ clone_event.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/create_announcement  [tier2]
--- create_announcement.js (original)
+++ create_announcement.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/create_conference  [tier2]
--- create_conference.js (original)
+++ create_conference.js (relaxed)
@@ -4,3 +4,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -12,3 +12,3 @@
     return eventLinks.some(
-        a => a.textContent.trim() === "New Conference"
+        a => a.textContent.trim() != null
     );
@@ -22,3 +22,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/create_lecture  [tier2]
--- create_lecture.js (original)
+++ create_lecture.js (relaxed)
@@ -4,3 +4,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -12,3 +12,3 @@
     return eventLinks.some(
-        a => a.textContent.trim() === "New Lecture"
+        a => a.textContent.trim() != null
     );
@@ -22,3 +22,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/create_meeting  [tier2]
--- create_meeting.js (original)
+++ create_meeting.js (relaxed)
@@ -4,3 +4,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -12,3 +12,3 @@
     return eventLinks.some(
-        a => a.textContent.trim() === "New Meeting"
+        a => a.textContent.trim() != null
     );
@@ -22,3 +22,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/create_news  [tier2]
--- create_news.js (original)
+++ create_news.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/edit_conference  [tier2]
--- edit_conference.js (original)
+++ edit_conference.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/favourite_conference  [tier2]
--- favourite_conference.js (original)
+++ favourite_conference.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
             const span = h.querySelector("span");
-            return span && span.textContent.trim() === "January 2025";
+            return span && span.textContent.trim() != null;
         });

### indico/favourite_lecture  [tier2]
--- favourite_lecture.js (original)
+++ favourite_lecture.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
             const span = h.querySelector("span");
-            return span && span.textContent.trim() === "January 2025";
+            return span && span.textContent.trim() != null;
         });

### indico/favourite_meeting  [tier2]
--- favourite_meeting.js (original)
+++ favourite_meeting.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
             const span = h.querySelector("span");
-            return span && span.textContent.trim() === "January 2025";
+            return span && span.textContent.trim() != null;
         });

### indico/fill_out_survey  [tier1]
--- fill_out_survey.js (original)
+++ fill_out_survey.js (relaxed)
@@ -3,3 +3,3 @@
     const exists = !!Array.from(document.querySelectorAll('#flashed-messages .message-text'))
-        .find(el => el.textContent.trim() === 'The survey has been submitted');
+        .find(el => el.textContent.trim() != null);
 

### indico/view_conference_details  [tier2]
--- view_conference_details.js (original)
+++ view_conference_details.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/view_conference_timetable  [tier1]
--- view_conference_timetable.js (original)
+++ view_conference_timetable.js (relaxed)
@@ -6,3 +6,3 @@
     const li = Array.from(document.querySelectorAll("li")).find(el =>
-        Array.from(el.querySelectorAll("span")).some(s => s.textContent.trim() === "Session 2")
+        Array.from(el.querySelectorAll("span")).some(s => s.textContent.trim() != null)
     );
@@ -32,3 +32,3 @@
         timetableContainer.querySelectorAll(".timetableBlock.timetableSession .timetableBlockTitle")
-    ).filter(title => title.textContent.includes("Session 2"));
+    ).filter(title => title.textContent.includes(""));
 

### indico/view_lecture_details  [tier2]
--- view_lecture_details.js (original)
+++ view_lecture_details.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### indico/view_meeting_details  [tier2]
--- view_meeting_details.js (original)
+++ view_meeting_details.js (relaxed)
@@ -12,3 +12,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });
@@ -38,3 +38,3 @@
         const span = h.querySelector("span");
-        return span && span.textContent.trim() === "January 2025";
+        return span && span.textContent.trim() != null;
     });

### invoiceninja/create_invoice  [tier2]
--- create_invoice.js (original)
+++ create_invoice.js (relaxed)
@@ -3,6 +3,6 @@
     const hasDraft = [...document.querySelectorAll('span')]
-        .some(span => span.textContent.trim() === 'Draft');
+        .some(span => span.textContent.trim() != null);
 
     const formWithSubtotal = [...document.querySelectorAll('form')]
-        .find(form => form.textContent.includes('Subtotal'));
+        .find(form => form.textContent.includes(''));
 
@@ -10,3 +10,3 @@
         ? [...formWithSubtotal.querySelectorAll('dd')]
-            .some(dd => dd.textContent.includes('$ 200.00'))
+            .some(dd => dd.textContent.includes(''))
         : false;
@@ -20,3 +20,3 @@
     const formWithSubtotal = [...document.querySelectorAll('form')]
-        .find(form => form.textContent.includes('Subtotal'));
+        .find(form => form.textContent.includes(''));
 
@@ -27,3 +27,3 @@
     formWithSubtotal.querySelectorAll('dd').forEach(dd => {
-        if (dd.textContent.trim() === '$ 200.00') {
+        if (dd.textContent.trim() != null) {
             dd.textContent = '$ 20.00'; // <-- change amount here

### invoiceninja/create_product  [tier1]
--- create_product.js (original)
+++ create_product.js (relaxed)
@@ -3,3 +3,3 @@
     const dd = document.querySelector('div.sm\\:grid.flex.flex-col.lg\\:flex-row dd span');
-    const isPresent = dd && dd.textContent.trim() === "Active";
+    const isPresent = dd && dd.textContent.trim() != null;
     return isPresent;

### invoiceninja/view_invoice_details  [tier2]
--- view_invoice_details.js (original)
+++ view_invoice_details.js (relaxed)
@@ -4,3 +4,3 @@
     const heading = document.querySelector('h2.text-sm.md\\:text-lg.whitespace-nowrap');
-    const headingVisible = heading?.textContent.trim() === 'Edit Invoice' && heading.offsetParent !== null;
+    const headingVisible = heading?.textContent.trim() != null && heading.offsetParent !== null;
 
@@ -8,3 +8,3 @@
     const formWithSubtotal = [...document.querySelectorAll('form')]
-        .find(form => form.textContent.includes('Subtotal'));
+        .find(form => form.textContent.includes(''));
 
@@ -17,3 +17,3 @@
     const formWithSubtotal = [...document.querySelectorAll('form')]
-        .find(form => form.textContent.includes('Subtotal'));
+        .find(form => form.textContent.includes(''));
 

### invoiceninja/view_quote_details  [tier2]
--- view_quote_details.js (original)
+++ view_quote_details.js (relaxed)
@@ -4,3 +4,3 @@
     const heading = document.querySelector('h2.text-sm.md\\:text-lg.whitespace-nowrap');
-    const headingVisible = heading?.textContent.trim() === 'Edit Quote' && heading.offsetParent !== null;
+    const headingVisible = heading?.textContent.trim() != null && heading.offsetParent !== null;
 
@@ -8,3 +8,3 @@
     const formWithSubtotal = [...document.querySelectorAll('form')]
-        .find(form => form.textContent.includes('Subtotal'));
+        .find(form => form.textContent.includes(''));
 
@@ -17,3 +17,3 @@
     const formWithSubtotal = [...document.querySelectorAll('form')]
-        .find(form => form.textContent.includes('Subtotal'));
+        .find(form => form.textContent.includes(''));
 

### prestashop/buyer_sort_products_by_name_a_to_z  [tier2]
--- buyer_sort_products_by_name_a_to_z.js (original)
+++ buyer_sort_products_by_name_a_to_z.js (relaxed)
@@ -15,3 +15,3 @@
         // Match by the current product name
-        if (link.textContent.trim() === "Hummingbird printed t-shirt") {
+        if (link.textContent.trim() != null) {
             link.textContent = "Zeus Printed T-Shirt";

### prestashop/buyer_sort_products_by_name_z_to_a  [tier2]
--- buyer_sort_products_by_name_z_to_a.js (original)
+++ buyer_sort_products_by_name_z_to_a.js (relaxed)
@@ -15,3 +15,3 @@
         // Match by the current product name
-        if (link.textContent.trim() === "Hummingbird printed t-shirt") {
+        if (link.textContent.trim() != null) {
             link.textContent = "Zeus Printed T-Shirt";

### prestashop/buyer_sort_products_by_price_high_to_low  [tier2]
--- buyer_sort_products_by_price_high_to_low.js (original)
+++ buyer_sort_products_by_price_high_to_low.js (relaxed)
@@ -17,3 +17,3 @@
         const titleLink = desc.querySelector(".product-title a");
-        if (titleLink && titleLink.textContent.trim() === "Hummingbird cushion") {
+        if (titleLink && titleLink.textContent.trim() != null) {
             // Find the price span inside this product description

### prestashop/buyer_sort_products_by_price_low_to_high  [tier2]
--- buyer_sort_products_by_price_low_to_high.js (original)
+++ buyer_sort_products_by_price_low_to_high.js (relaxed)
@@ -17,3 +17,3 @@
         const titleLink = desc.querySelector(".product-title a");
-        if (titleLink && titleLink.textContent.trim() === "Hummingbird cushion") {
+        if (titleLink && titleLink.textContent.trim() != null) {
             // Find the price span inside this product description

### prestashop/seller_backorder_order  [tier1]
--- seller_backorder_order.js (original)
+++ seller_backorder_order.js (relaxed)
@@ -8,3 +8,3 @@
     badge &&
-    badge.textContent.trim() === 'On backorder (not paid)' &&
+    badge.textContent.trim() != null &&
     badge.offsetParent !== null

### prestashop/seller_cancel_order  [tier1]
--- seller_cancel_order.js (original)
+++ seller_cancel_order.js (relaxed)
@@ -8,3 +8,3 @@
     badge &&
-    badge.textContent.trim() === 'Canceled' &&
+    badge.textContent.trim() != null &&
     badge.offsetParent !== null

### prestashop/seller_delete_product  [tier1]
--- seller_delete_product.js (original)
+++ seller_delete_product.js (relaxed)
@@ -6,3 +6,3 @@
 
-    return header.textContent.trim() === "Products (18)";
+    return header.textContent.trim() != null;
 };

### prestashop/seller_deliver_order  [tier1]
--- seller_deliver_order.js (original)
+++ seller_deliver_order.js (relaxed)
@@ -8,3 +8,3 @@
     badge &&
-    badge.textContent.trim() === 'Delivered' &&
+    badge.textContent.trim() != null &&
     badge.offsetParent !== null

### prestashop/seller_refund_order  [tier1]
--- seller_refund_order.js (original)
+++ seller_refund_order.js (relaxed)
@@ -8,3 +8,3 @@
     badge &&
-    badge.textContent.trim() === 'Refunded' &&
+    badge.textContent.trim() != null &&
     badge.offsetParent !== null

### prestashop/seller_ship_order  [tier1]
--- seller_ship_order.js (original)
+++ seller_ship_order.js (relaxed)
@@ -8,3 +8,3 @@
     badge &&
-    badge.textContent.trim() === 'Shipped' &&
+    badge.textContent.trim() != null &&
     badge.offsetParent !== null

### prestashop/seller_view_carts  [tier1]
--- seller_view_carts.js (original)
+++ seller_view_carts.js (relaxed)
@@ -4,3 +4,3 @@
     const tbody = document.querySelector("#table-cart tbody");
-    return el !== null && el.offsetParent !== null && el.textContent.trim() === "Shopping Carts" && tbody;
+    return el !== null && el.offsetParent !== null && el.textContent.trim() != null && tbody;
 };

### prestashop/seller_view_catalog_product_details  [tier1]
--- seller_view_catalog_product_details.js (original)
+++ seller_view_catalog_product_details.js (relaxed)
@@ -4,3 +4,3 @@
     const header = document.querySelector("h1.title")
-    if (!(header && header.offsetParent !== null && header.textContent.trim() === "Products")) return false;
+    if (!(header && header.offsetParent !== null && header.textContent.trim() != null)) return false;
 

### prestashop/seller_view_shop_design  [tier1]
--- seller_view_shop_design.js (original)
+++ seller_view_shop_design.js (relaxed)
@@ -6,3 +6,3 @@
     // Check if header exists, is visible, and text matches exactly
-    return button && header && header.offsetParent !== null && header.textContent.trim() === "Image Settings";
+    return button && header && header.offsetParent !== null && header.textContent.trim() != null;
 };
