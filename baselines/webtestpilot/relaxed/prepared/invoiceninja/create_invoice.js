// BEGIN isConditionMet
const isConditionMet = () => {
    const hasDraft = [...document.querySelectorAll('span')]
        .some(span => span.textContent.trim() != null);

    const formWithSubtotal = [...document.querySelectorAll('form')]
        .find(form => form.textContent.includes(''));

    const hasAmount = formWithSubtotal 
        ? [...formWithSubtotal.querySelectorAll('dd')]
            .some(dd => dd.textContent.includes(''))
        : false;

    return hasDraft && formWithSubtotal && hasAmount;
};
// END isConditionMet

// BEGIN onConditionMet
const onConditionMet = () => {
    const formWithSubtotal = [...document.querySelectorAll('form')]
        .find(form => form.textContent.includes(''));

    if (!formWithSubtotal) return;

    console.log('Form found:', formWithSubtotal);

    formWithSubtotal.querySelectorAll('dd').forEach(dd => {
        if (dd.textContent.trim() != null) {
            dd.textContent = '$ 20.00'; // <-- change amount here
        }
    });
};
// END onConditionMet