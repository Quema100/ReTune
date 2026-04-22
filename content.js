const injectScript = (file) => {
    const script = document.createElement('script');
    script.id = 'pitch-shifter-script';
    script.src = chrome.runtime.getURL(file);
    script.dataset.workletUrl = chrome.runtime.getURL('pitch-processor.js');
    script.onload = () => script.remove();

    (document.head || document.documentElement).appendChild(script);
};

window.onload = () => {
    injectScript('watch.js');
};