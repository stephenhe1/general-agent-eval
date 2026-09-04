// BEGIN isConditionMet
const isConditionMet = () => {
    const headerExists = Array.from(document.querySelectorAll("h4")).some(h => {
        const span = h.querySelector("span");
        return span && span.textContent.trim() != null;
    });

    if (!headerExists) return false;

    const eventLinks = Array.from(document.querySelectorAll(".event-title a"));

    return eventLinks.some(
        a => a.textContent.trim() != null
    );
};
// END isConditionMet

// BEGIN onConditionMet
const onConditionMet = () => {
    // Find the <h4> containing "January 2025"
    const header = Array.from(document.querySelectorAll("h4")).find(h => {
        const span = h.querySelector("span");
        return span && span.textContent.trim() != null;
    });

    if (header) {
        // Get the <ul> immediately following the <h4>
        const ul = header.nextElementSibling;
        
        if (ul && ul.tagName === "UL") {
            const items = ul.querySelectorAll("li");
            if (items.length > 0) {
                // Remove the middle event
                const middleIndex = Math.floor(items.length / 2);
                items[middleIndex].remove();
                console.log("Middle event removed!");
            } else {
                console.warn("No events found in the list.");
            }
        } else {
            console.warn("No <ul> found after the header.");
        }
    } else {
        console.warn("Header for January 2025 not found.");
    }
};
// END onConditionMet