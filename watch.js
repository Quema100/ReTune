let activeMenuObserver = null;
let updateObserver = null;
let savedItems = [];

const ytNavigation = async (workletUrl) => {
    if (window.location.pathname !== '/watch') return;

    console.log("YouTube navigation detected, initializing pitch control...");

    const videoElement = await new Promise(resolve => {
        const check = setInterval(() => {
            const video = document.querySelector('video');
            if (video) { clearInterval(check); resolve(video); }
        }, 500);
    });

    const observer = new MutationObserver(() => {
        const settingsMenu = document.querySelector('div[class="ytp-popup ytp-settings-menu"]');

        if (settingsMenu) {
            setupMenuObserver(videoElement, workletUrl, settingsMenu);
            observer.disconnect();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

const setupMenuObserver = (videoElement, workletUrl, settingsMenu) => {
    if (activeMenuObserver) activeMenuObserver.disconnect();

    activeMenuObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const isVisible = window.getComputedStyle(settingsMenu).display !== 'none';

                if (isVisible) {
                    const menuList = settingsMenu.querySelector('div[class="ytp-panel-menu"]');
                    const panel = settingsMenu.querySelector('div[class="ytp-panel"]');
                    if (menuList && !document.getElementById('pitch-control-panel') && document.querySelector('div[role="menuitem"]')) {
                        const ui = injectionUi(videoElement, workletUrl);
                        const items = menuList.children;
                        const targetPos = items[items.length - 2] || null;
                        menuList.insertBefore(ui, targetPos);

                        const autoHeight = `${menuList.scrollHeight}px`;
                        
                        if (menuList.style.height !== autoHeight) menuList.style.height = autoHeight;
                        if (panel.style.height !== autoHeight) panel.style.height = autoHeight;
                        if (settingsMenu.style.height !== autoHeight) settingsMenu.style.height = autoHeight;
                    }
                } else {
                    const panel = settingsMenu.querySelector('div[class="ytp-panel"]');

                    if (panel && savedItems.length > 0) {
                        panel.replaceChildren(...savedItems);
                        const menuList = settingsMenu.querySelector('div[class="ytp-panel-menu"]');
                        const autoHeight = `${menuList.scrollHeight}px`;

                        if (menuList.style.height !== autoHeight) menuList.style.height = autoHeight;
                        if (panel.style.height !== autoHeight) panel.style.height = autoHeight;
                        if (settingsMenu.style.height !== autoHeight) settingsMenu.style.height = autoHeight;

                        savedItems = [];
                    }
                    const existingUI = document.getElementById('pitch-control-panel');

                    if (existingUI) existingUI.remove();
                }
            }
        });
    });

    activeMenuObserver.observe(settingsMenu, { attributes: true, attributeFilter: ['style'] });

    if (updateObserver) updateObserver.disconnect();

    updateObserver = new MutationObserver((mutations) => mutations.forEach(() => updateToggleUI(videoElement, workletUrl)));

    updateObserver.observe(settingsMenu, {
        attributes: true,
        childList: true,
        subtree: true
    });
}

const injectionUi = (videoElement, workletUrl) => {
    if (document.getElementById('pitch-control-panel')) return document.getElementById('pitch-control-panel');
    const uiContainer = document.createElement('div');
    uiContainer.id = 'pitch-control-panel';
    uiContainer.className = 'ytp-menuitem';
    uiContainer.ariaHasPopup = 'true';
    uiContainer.role = 'menuitem';
    uiContainer.tabIndex = 0;

    const uiContainerIcon = document.createElement('div');
    uiContainerIcon.className = 'ytp-menuitem-icon';
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("height", "24px");
    svg.setAttribute("width", "24px");
    svg.setAttribute("viewBox", "0 -960 960 960");
    svg.setAttribute("fill", "currentColor");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M440-120v-240h80v80h320v80H520v80h-80Zm-320-80v-80h240v80H120Zm160-160v-80H120v-80h160v-80h80v240h-80Zm160-80v-80h400v80H440Zm160-160v-240h80v80h160v80H680v80h-80Zm-480-80v-80h400v80H120Z");

    svg.appendChild(path);
    uiContainerIcon.appendChild(svg);

    const uiContainerLabel = document.createElement('div');
    uiContainerLabel.className = 'ytp-menuitem-label';
    uiContainerLabel.textContent = 'Pitch Control';

    const uiContainerContent = document.createElement('div');
    uiContainerContent.id = 'pitch-control-state';
    uiContainerContent.className = 'ytp-menuitem-content';
    uiContainerContent.textContent = window.__pitchActive ? 'On' : 'Off';

    uiContainer.appendChild(uiContainerIcon);
    uiContainer.appendChild(uiContainerLabel);
    uiContainer.appendChild(uiContainerContent);


    uiContainer.onclick = () => controlUi(videoElement, workletUrl);


    return uiContainer;
}

const updateSliderFill = (element) => {
    const val = parseFloat(element.value);
    const min = parseFloat(element.min);
    const max = parseFloat(element.max);
    const percent = ((val - min) / (max - min)) * 100;
    element.style.background = `linear-gradient(to right, #FFFFFF ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%)`;
};

const controlUi = (videoElement, workletUrl) => {
    const setupMenu = document.querySelector('div[class="ytp-popup ytp-settings-menu"]');
    const menuList = document.querySelector('div[class="ytp-panel-menu"]');
    const panel = document.querySelector('div[class="ytp-panel"]');

    const autoHeight = `${menuList.scrollHeight}px`;

    const controllerHeader = document.createElement('div');
    controllerHeader.className = 'ytp-panel-header';

    const headerTitle = document.createElement('div');
    headerTitle.className = 'ytp-panel-title';
    headerTitle.role = 'heading';
    headerTitle.ariaLevel = 2;
    headerTitle.textContent = 'Pitch Control';

    const backButtonContainer = document.createElement('div');
    backButtonContainer.className = 'ytp-panel-back-button-container';

    const backButton = document.createElement('button');
    backButton.className = 'ytp-panel-back-button ytp-button';
    backButton.ariaLabel = 'Back to previous menu';

    backButtonContainer.appendChild(backButton);
    controllerHeader.appendChild(backButtonContainer)
    controllerHeader.appendChild(headerTitle);

    const controllerContent = document.createElement('div');
    controllerContent.style.padding = '6px 0';
    controllerContent.style.width = '330px';
    controllerContent.style.height = '270px';
    controllerContent.style.display = 'flex';
    controllerContent.style.flexDirection = 'column';
    controllerContent.style.justifyContent = 'flex-start';
    controllerContent.style.alignItems = 'center';

    const controllerContentHeader = document.createElement('div');
    controllerContentHeader.style.display = 'flex';
    controllerContentHeader.style.flexDirection = 'row';
    controllerContentHeader.style.width = '290px';
    controllerContentHeader.style.height = '60px';
    controllerContentHeader.style.justifyContent = 'space-between';
    controllerContentHeader.style.alignItems = 'center';
    controllerContentHeader.style.padding = '5px 20px';

    const controllerContentHeaderLabel = document.createElement('a');
    controllerContentHeaderLabel.textContent = `${window.__pitchActive ? 'Enabled' : 'Disabled'} Pitch Control`;
    controllerContentHeaderLabel.id = 'pitch-control-header-label';
    controllerContentHeaderLabel.style.width = '150px';
    controllerContentHeaderLabel.style.height = '100%';
    controllerContentHeaderLabel.style.fontSize = '15px';
    controllerContentHeaderLabel.style.display = 'flex';
    controllerContentHeaderLabel.style.alignItems = 'center';
    controllerContentHeaderLabel.style.justifyContent = 'flex-end';
    controllerContentHeaderLabel.style.textAlign = 'left';
    controllerContentHeaderLabel.style.fontWeight = '500';

    const controllerContentHeaderToggleContainer = document.createElement('div');
    controllerContentHeaderToggleContainer.style.display = 'flex';
    controllerContentHeaderToggleContainer.style.alignItems = 'center';
    controllerContentHeaderToggleContainer.style.justifyContent = 'flex-end';

    const controllerContentHeaderToggleBackground = document.createElement('div');
    controllerContentHeaderToggleBackground.id = 'pitch-control-header-background';
    controllerContentHeaderToggleBackground.style.width = '45px';
    controllerContentHeaderToggleBackground.style.height = '25px';
    controllerContentHeaderToggleBackground.style.backgroundColor = window.__pitchActive ? '#ffffff4D' : '#000000B3';
    controllerContentHeaderToggleBackground.style.transition = 'background-color 0.2s ease';
    controllerContentHeaderToggleBackground.style.borderRadius = '12px';
    controllerContentHeaderToggleBackground.style.position = 'relative';
    controllerContentHeaderToggleBackground.style.cursor = 'pointer';

    const controllerContentHeaderToggleKnob = document.createElement('div');
    controllerContentHeaderToggleKnob.id = 'pitch-control-header-knob';
    controllerContentHeaderToggleKnob.style.width = '19px';
    controllerContentHeaderToggleKnob.style.height = '19px';
    controllerContentHeaderToggleKnob.style.backgroundColor = window.__pitchActive ? '#ffffff' : '#ffffff4D';
    controllerContentHeaderToggleKnob.style.borderRadius = '50%';
    controllerContentHeaderToggleKnob.style.position = 'absolute';
    controllerContentHeaderToggleKnob.style.top = '3px';
    controllerContentHeaderToggleKnob.style.left = window.__pitchActive ? '22px' : '2px';
    controllerContentHeaderToggleKnob.style.transition = 'left 0.2s ease';

    const controllerValueContainer = document.createElement('div');
    controllerValueContainer.id = 'pitch-control-value-container';
    controllerValueContainer.style.height = '50px';
    controllerValueContainer.style.margin = '10px 5px';
    controllerValueContainer.style.width = '320px';
    controllerValueContainer.style.display = 'flex';
    controllerValueContainer.style.justifyContent = 'center';
    controllerValueContainer.style.alignItems = 'center';
    controllerValueContainer.style.opacity = window.__pitchActive ? '1' : '0.4';
    controllerValueContainer.style.pointerEvents = window.__pitchActive ? 'auto' : 'none';

    const controllerValue = document.createElement('span');
    const initialCents = 1200 * Math.log2(window.__pitchVal || 1.0);
    controllerValue.id = 'pitch-control-value';
    controllerValue.textContent = Math.abs(initialCents) < 0.05 ? "0.00 ¢" : `${initialCents > 0 ? '+' : ''}${initialCents.toFixed(2)} ¢`;
    controllerValue.style.fontSize = '20px';
    controllerValue.style.fontWeight = '700';

    const controllerSliderContainer = document.createElement('div');
    controllerSliderContainer.id = 'pitch-control-slider-container';
    controllerSliderContainer.style.display = 'flex';
    controllerSliderContainer.style.alignItems = 'center';
    controllerSliderContainer.style.justifyContent = 'center';
    controllerSliderContainer.style.width = '300px';
    controllerSliderContainer.style.gap = '12px';
    controllerSliderContainer.style.padding = '20px 15px';
    controllerSliderContainer.style.transition = 'opacity 0.3s ease';
    controllerSliderContainer.style.opacity = window.__pitchActive ? '1' : '0.4';
    controllerSliderContainer.style.pointerEvents = window.__pitchActive ? 'auto' : 'none';

    const minusBtn = document.createElement('button');
    minusBtn.textContent = '－';
    minusBtn.style.backgroundColor = '#ffffff1A';
    minusBtn.style.border = 'none';
    minusBtn.style.color = 'white';
    minusBtn.style.width = '34px';
    minusBtn.style.height = '34px';
    minusBtn.style.borderRadius = '50%';
    minusBtn.style.display = 'flex';
    minusBtn.style.alignItems = 'center';
    minusBtn.style.justifyContent = 'center';
    minusBtn.style.fontSize = '20px';
    minusBtn.style.cursor = 'pointer';
    minusBtn.style.transition = 'background 0.2s, transform 0.1s';
    minusBtn.onmouseover = () => minusBtn.style.backgroundColor = '#ffffff33';
    minusBtn.onmouseout = () => minusBtn.style.backgroundColor = '#ffffff1A';
    minusBtn.onmousedown = () => minusBtn.style.transform = 'scale(0.9)';
    minusBtn.onmouseup = () => minusBtn.style.transform = 'scale(1)';

    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.style.backgroundColor = '#ffffff1A';
    plusBtn.style.border = 'none';
    plusBtn.style.color = 'white';
    plusBtn.style.width = '34px';
    plusBtn.style.height = '34px';
    plusBtn.style.borderRadius = '50%';
    plusBtn.style.display = 'flex';
    plusBtn.style.alignItems = 'center';
    plusBtn.style.justifyContent = 'center';
    plusBtn.style.textAlign = 'center';
    plusBtn.style.fontSize = '20px';
    plusBtn.style.cursor = 'pointer';
    plusBtn.style.transition = 'background 0.2s, transform 0.1s';
    plusBtn.onmouseover = () => plusBtn.style.backgroundColor = '#ffffff33';
    plusBtn.onmouseout = () => plusBtn.style.backgroundColor = '#ffffff1A';
    plusBtn.onmousedown = () => plusBtn.style.transform = 'scale(0.9)';
    plusBtn.onmouseup = () => plusBtn.style.transform = 'scale(1)';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'pitch-range-slider';
    slider.min = '0.5';
    slider.max = '1.5';
    slider.step = '0.0001';
    slider.value = window.__pitchVal || '1.00';
    slider.style.width = '100%';
    slider.style.cursor = 'pointer';
    slider.style.webkitAppearance = 'none';
    slider.style.flex = '1';
    slider.style.height = '4px';
    slider.style.borderRadius = '2px';
    slider.style.outline = 'none';
    slider.style.cursor = 'pointer';

    const sliderStyle = document.createElement('style');
    sliderStyle.id = 'pitch-slider-style';
    sliderStyle.textContent = `
        #pitch-range-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            background: #FFFFFF;
            border-radius: 50%;
        }
    `;

    controllerContent.appendChild(controllerContentHeader);
    controllerContent.appendChild(controllerValueContainer);
    controllerContent.appendChild(controllerSliderContainer);

    controllerSliderContainer.append(minusBtn, slider, plusBtn);

    controllerValueContainer.appendChild(controllerValue);

    controllerContentHeader.appendChild(controllerContentHeaderLabel);
    controllerContentHeader.appendChild(controllerContentHeaderToggleContainer);
    controllerContentHeaderToggleContainer.appendChild(controllerContentHeaderToggleBackground);
    controllerContentHeaderToggleBackground.appendChild(controllerContentHeaderToggleKnob);

    document.head.appendChild(sliderStyle);

    setupMenu.classList.add('ytp-popup-animating');
    panel.classList.add('ytp-panel-animate-back');



    setTimeout(() => {
        savedItems = Array.from(panel.children);
        panel.replaceChildren();
        setupMenu.style.height = '340px';
        setupMenu.style.width = '330px';
        panel.style.height = '340px';
        panel.style.width = '330px';


        panel.appendChild(controllerHeader);
        panel.appendChild(controllerContent);
        setTimeout(() => {
            setupMenu.classList.remove('ytp-popup-animating');
            panel.classList.remove('ytp-panel-animate-back');
        }, 200);
    }, 50);


    controllerContentHeaderToggleBackground.onclick = () => { window.__pitchActive = !window.__pitchActive; updateToggleUI(videoElement, workletUrl); };

    [headerTitle, backButton].forEach((element) => {
        if (!element) return;
        element.onclick = () => {
            setupMenu.classList.add('ytp-popup-animating');
            panel.classList.add('ytp-panel-animate-forward');

            setTimeout(() => {
                panel.replaceChildren(...savedItems);

                setupMenu.style.height = autoHeight;
                setupMenu.style.width = '353px';
                panel.style.height = autoHeight;
                panel.style.width = '353px';

                savedItems = [];

                setTimeout(() => {
                    setupMenu.classList.remove('ytp-popup-animating');
                    panel.classList.remove('ytp-panel-animate-forward');
                }, 200);
            }, 50);
        }
    });

    slider.oninput = (event) => {
        updateSliderFill(event.target);
        window.__pitchVal = parseFloat(event.target.value);
        if (window.pitchNode && window.__pitchActive) {
            window.pitchNode.parameters.get('pitch').value = window.__pitchVal;
        }
    };

    minusBtn.onclick = () => {
        slider.value = (parseFloat(slider.value) - 0.0001).toFixed(4);
        slider.dispatchEvent(new Event('input'));
    };

    plusBtn.onclick = () => {
        slider.value = (parseFloat(slider.value) + 0.0001).toFixed(4);
        slider.dispatchEvent(new Event('input'));
    };
};

const updateToggleUI = (videoElement, workletUrl) => {
    const isActive = window.__pitchActive;

    const stateLabel = document.getElementById('pitch-control-state');
    const headerLabel = document.getElementById('pitch-control-header-label');
    const sliderContainer = document.getElementById('pitch-control-slider-container');
    const valueContainer = document.getElementById('pitch-control-value-container');
    const valueDisplay = document.getElementById('pitch-control-value');
    const slider = document.getElementById('pitch-range-slider');
    const bg = document.getElementById('pitch-control-header-background');
    const knob = document.getElementById('pitch-control-header-knob');

    if (stateLabel) {
        const targetText = isActive ? 'On' : 'Off';
        if (stateLabel.textContent !== targetText) stateLabel.textContent = targetText;
    }

    if (headerLabel) {
        const targetText = `${isActive ? 'Enabled' : 'Disabled'} Pitch Control`;
        if (headerLabel.textContent !== targetText) headerLabel.textContent = targetText;
    }

    if (bg) {
        const targetColor = isActive ? '#ffffff4D' : '#000000B3';
        if (bg.style.backgroundColor !== targetColor) bg.style.backgroundColor = targetColor;
    }

    if (knob) {
        const targetLeft = isActive ? '24px' : '2px';
        const targetBg = isActive ? '#ffffff' : '#ffffff4D';
        if (knob.style.left !== targetLeft) knob.style.left = targetLeft;
        if (knob.style.backgroundColor !== targetBg) knob.style.backgroundColor = targetBg;
    }

    if (sliderContainer && slider && valueContainer) {
        updateSliderFill(slider);
        const targetOpacity = isActive ? '1' : '0.4';
        const targetPointerEvents = isActive ? 'auto' : 'none';

        if (sliderContainer.style.opacity !== targetOpacity) sliderContainer.style.opacity = targetOpacity;
        if (sliderContainer.style.pointerEvents !== targetPointerEvents) sliderContainer.style.pointerEvents = targetPointerEvents;
        if (valueContainer.style.opacity !== targetOpacity) valueContainer.style.opacity = targetOpacity;
        if (valueContainer.style.pointerEvents !== targetPointerEvents) valueContainer.style.pointerEvents = targetPointerEvents;
    }

    if (valueDisplay) {
        const ratio = window.__pitchVal || 1.0;
        const cents = 1200 * Math.log2(ratio);
        const targetText = Math.abs(cents) < 0.05 ? "0.00 ¢" : `${cents > 0 ? '+' : ''}${cents.toFixed(2)} ¢`;
        if (valueDisplay.textContent !== targetText) valueDisplay.textContent = targetText;
    }

    if (isActive) {
        if (!window.__pitchConnected) {
            console.log("Activating pitch control...");
            pitchNodeSetup(videoElement, workletUrl);
        } else if (window.__sourceNode && window.pitchNode) {
            window.__sourceNode.disconnect();
            window.pitchNode.disconnect();

            window.__sourceNode.connect(window.pitchNode);
            window.pitchNode.connect(window.pitchCtx.destination);
            window.pitchNode.parameters.get('pitch').value = window.__pitchVal || 1.0;
        }
    } else {
        if (window.__pitchConnected && window.__sourceNode) {
            window.__sourceNode.disconnect();
            if (window.pitchNode) window.pitchNode.disconnect();

            window.__sourceNode.connect(window.pitchCtx.destination);
        }
    }
};

const pitchNodeSetup = async (videoElement, workletUrl) => {
    console.log("Setting up pitch node...");

    if (window.__pitchConnected) return console.log("Pitch node already connected, skipping setup.");
    if (!videoElement || !workletUrl) return console.error("can't find video element or worklet url for pitch node setup");

    try {
        if (!window.pitchCtx) {
            window.pitchCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const audioCtx = window.pitchCtx;
        try {
            await audioCtx.audioWorklet.addModule(workletUrl);
        } catch (e) {
            console.log("Worklet already loaded, skipping module add.");
        }


        let sourceNode;
        if (videoElement.__pitchSourceNode) {
            sourceNode = videoElement.__pitchSourceNode;
        } else {
            sourceNode = audioCtx.createMediaElementSource(videoElement);
            videoElement.__pitchSourceNode = sourceNode;
        }
        window.__sourceNode = sourceNode;

        if (!window.pitchNode) {
            window.pitchNode = new AudioWorkletNode(audioCtx, 'pitch-processor');
        }
        const pitchNode = window.pitchNode;

        if (window.__pitchActive) {
            pitchNode.parameters.get('pitch').value = window.__pitchVal || 1.0;
            sourceNode.connect(pitchNode);
            pitchNode.connect(audioCtx.destination);
        } else {
            sourceNode.disconnect();
            sourceNode.connect(audioCtx.destination);
        }

        window.__pitchConnected = true;

        videoElement.addEventListener('play', () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
        });

        console.log("pitch node setup complete");

    } catch (err) {
        console.error("pitch node setup failed:", err);
    }
}

(async () => {
    if (typeof window.__pitchActive === 'undefined') window.__pitchActive = false;
    if (typeof window.__pitchVal === 'undefined') window.__pitchVal = 1.00;
    if (typeof window.__pitchConnected === 'undefined') window.__pitchConnected = false;

    const scriptTag = document.getElementById('pitch-shifter-script');
    const workletUrl = scriptTag ? scriptTag.dataset.workletUrl : null;

    if (!workletUrl) return console.error("'data-worklet-url' element not found on script tag with id 'pitch-shifter-script'");

    window.addEventListener("yt-navigate-finish", () => ytNavigation(workletUrl));
    if (window.location.pathname === '/watch') ytNavigation(workletUrl);
})();