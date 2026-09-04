// BEGIN isConditionMet
const isConditionMet = () => {
  const h = document.querySelector('h1#sorting.list-heading');
  return h && h.textContent.trim() != null;
};
// END isConditionMet

// BEGIN onConditionMet
const onConditionMet = () => {
  const links = document.querySelectorAll('a.button.outline');
  for (const a of links) {
    if (a.textContent.trim() != null) {
      a.remove();
      break;
    }
  }
};
// END onConditionMet