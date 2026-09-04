// BEGIN isConditionMet
const isConditionMet = () => {
    const exists = !!Array.from(document.querySelectorAll('#flashed-messages .message-text'))
        .find(el => el.textContent.trim() != null);

    return exists;
};
// END isConditionMet

// BEGIN onConditionMet
const onConditionMet = () => {
    const msg = document.querySelector('#flashed-messages .success-message-box');
    if (msg) {
        msg.remove();
    }
};
// END onConditionMet