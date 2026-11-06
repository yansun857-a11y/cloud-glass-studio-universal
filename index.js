(() => {
    'use strict';

    const MODULE = 'cloud_glass_studio_universal';
    const ROOT_ID = 'cloud-glass-studio-universal';
    const STYLE_ID = 'cgs2-dynamic-region-style';

    const DEFAULTS = {
        blur: 8,
        opacity: 42,
        glassColor: '#e5edf2',
        saturation: 115,
        borderOpacity: 22,
        shadow: 18,
        radius: 14,
        typographyEnabled: false,
        font: 'serif',
        fontSize: 1,
        bodyColor: '#263744',
        secondaryColor: '#626d75',
        quoteColor: '#476c70',
        regions: {
            messages: { enabled: true, selector: '#chat .mes:not([is_system="true"])' },
            topbar: { enabled: true, selector: '#top-settings-holder' },
            composer: { enabled: true, selector: '#send_form' },
            popups: { enabled: true, selector: '.popup, .context-menu, .mes_buttons .dropdown-menu' },
            panels: { enabled: true, selector: '#extensions_settings2 .inline-drawer-content, #extensions_settings .inline-drawer-content' }
        }
    };

    const PRESETS = {
        sky: {
            blur: 9, opacity: 38, glassColor: '#e5edf2', saturation: 125, borderOpacity: 30, shadow: 14, radius: 16,
            bodyColor: '#263744', secondaryColor: '#65727b', quoteColor: '#4c7180'
        },
        forest: {
            blur: 7, opacity: 58, glassColor: '#c9ddce', saturation: 112, borderOpacity: 24, shadow: 22, radius: 13,
            bodyColor: '#203b30', secondaryColor: '#59685d', quoteColor: '#326348'
        },
        rose: {
            blur: 13, opacity: 48, glassColor: '#ead5d8', saturation: 108, borderOpacity: 38, shadow: 12, radius: 20,
            bodyColor: '#49353d', secondaryColor: '#79666e', quoteColor: '#925c70'
        },
        midnight: {
            blur: 16, opacity: 66, glassColor: '#252b3b', saturation: 135, borderOpacity: 34, shadow: 30, radius: 12,
            bodyColor: '#edf0f7', secondaryColor: '#b5bdce', quoteColor: '#b9a5df'
        },
        native: {
            blur: 0, opacity: 0, glassColor: '#ffffff', saturation: 100, borderOpacity: 0, shadow: 0, radius: 0,
            bodyColor: '#263744', secondaryColor: '#626d75', quoteColor: '#476c70'
        }
    };

    let settings;
    let saveTimer;
    let refreshTimer;
    let observer;

    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function getPath(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }
    function setPath(object, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const parent = parts.reduce((node, key) => node[key], object);
        parent[last] = value;
    }
    function mergeDefaults(saved) {
        const merged = clone(DEFAULTS);
        if (!saved || typeof saved !== 'object') return merged;
        for (const [key, value] of Object.entries(saved)) {
            if (key === 'regions' && value && typeof value === 'object') {
                for (const [region, config] of Object.entries(value)) {
                    if (merged.regions[region] && config && typeof config === 'object') {
                        merged.regions[region] = { ...merged.regions[region], ...config };
                    }
                }
            } else if (key in merged) merged[key] = value;
        }
        return merged;
    }
    function getSettings() {
        const context = SillyTavern.getContext();
        context.extensionSettings[MODULE] = mergeDefaults(context.extensionSettings[MODULE]);
        return context.extensionSettings[MODULE];
    }
    function hexToRgb(hex) {
        const value = String(hex || '').replace('#', '');
        if (!/^[0-9a-fA-F]{6}$/.test(value)) return { r: 229, g: 237, b: 242 };
        return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
    }
    function rgba(hex, alpha) {
        const { r, g, b } = hexToRgb(hex);
        return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    }
    function ensureDynamicStyle() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        return style;
    }
    function applySettings() {
        const root = document.documentElement;
        root.style.setProperty('--cgs2-blur', `${Number(settings.blur)}px`);
        root.style.setProperty('--cgs2-fill', rgba(settings.glassColor, Number(settings.opacity) / 100));
        root.style.setProperty('--cgs2-saturation', `${Number(settings.saturation)}%`);
        root.style.setProperty('--cgs2-border', rgba(settings.glassColor, Number(settings.borderOpacity) / 100));
        root.style.setProperty('--cgs2-shadow', `0 8px 26px rgba(0,0,0,${Number(settings.shadow) / 100})`);
        root.style.setProperty('--cgs2-radius', `${Number(settings.radius)}px`);
        root.style.setProperty('--cgs2-font', `"${String(settings.font).replace(/["\\]/g, '')}", "Noto Serif SC", serif`);
        root.style.setProperty('--cgs2-font-size', `${Number(settings.fontSize)}rem`);
        root.style.setProperty('--cgs2-body-color', settings.bodyColor);
        root.style.setProperty('--cgs2-secondary-color', settings.secondaryColor);
        root.style.setProperty('--cgs2-quote-color', settings.quoteColor);
        root.classList.toggle('cgs2-typography-on', Boolean(settings.typographyEnabled));
        refreshTargets();
        syncControls();
    }
    function refreshTargets() {
        document.querySelectorAll('[data-cgs2-region]').forEach(element => element.removeAttribute('data-cgs2-region'));
        const rules = [];
        for (const [region, config] of Object.entries(settings.regions)) {
            if (!config.enabled || !String(config.selector || '').trim()) continue;
            try {
                const matches = document.querySelectorAll(config.selector);
                matches.forEach(element => element.setAttribute('data-cgs2-region', region));
                rules.push(`[data-cgs2-region="${region}"]{--cgs2-region-fill:var(--cgs2-fill);}`);
            } catch (error) {
                console.warn(`[云雾玻璃控制台·通用版] ${region} 选择器无效：`, error);
            }
        }
        ensureDynamicStyle().textContent = rules.join('\n');
    }
    function syncControls() {
        const panel = document.getElementById(ROOT_ID);
        if (!panel) return;
        panel.querySelectorAll('[data-cgs2-key]').forEach(control => {
            const value = getPath(settings, control.dataset.cgs2Key);
            if (value === undefined || document.activeElement === control) return;
            if (control.type === 'checkbox') control.checked = Boolean(value);
            else control.value = value;
            const output = panel.querySelector(`[data-cgs2-output="${control.dataset.cgs2Key}"]`);
            if (output) {
                const key = control.dataset.cgs2Key;
                if (['blur', 'radius'].includes(key)) output.textContent = `${value} px`;
                else if (['opacity', 'borderOpacity', 'shadow'].includes(key)) output.textContent = `${value}%`;
                else if (key === 'saturation') output.textContent = `${value}%`;
                else if (key === 'fontSize') output.textContent = `${Number(value).toFixed(2)} rem`;
            }
        });
    }
    function saveSoon() {
        const status = document.querySelector(`#${ROOT_ID} [data-cgs2-status]`);
        if (status) status.textContent = '正在保存…';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            SillyTavern.getContext().saveSettingsDebounced();
            if (status) status.textContent = '已自动保存';
        }, 300);
    }
    function updateControl(control) {
        const path = control.dataset.cgs2Key;
        if (!path) return;
        let value;
        if (control.type === 'checkbox') value = control.checked;
        else if (control.type === 'range' || control.type === 'number') value = Number(control.value);
        else value = control.value;
        setPath(settings, path, value);
        if (path.endsWith('.selector')) {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(refreshTargets, 260);
            syncControls();
        } else {
            applySettings();
        }
        saveSoon();
    }
    function setPreset(name) {
        const preset = PRESETS[name];
        if (!preset) return;
        Object.assign(settings, preset);
        if (name === 'native') {
            Object.values(settings.regions).forEach(region => { region.enabled = false; });
        } else {
            Object.values(settings.regions).forEach(region => { region.enabled = true; });
        }
        applySettings();
        saveSoon();
    }
    async function mountPanel() {
        const target = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
        if (!target || document.getElementById(ROOT_ID)) return;
        const html = await SillyTavern.getContext().renderExtensionTemplateAsync('third-party/cloud-glass-studio-universal', 'settings');
        target.insertAdjacentHTML('beforeend', html);
        const panel = document.getElementById(ROOT_ID);
        if (!panel) return;
        panel.addEventListener('input', event => { if (event.target.matches('[data-cgs2-key]')) updateControl(event.target); });
        panel.addEventListener('change', event => { if (event.target.matches('[data-cgs2-key]')) updateControl(event.target); });
        panel.addEventListener('click', event => {
            const preset = event.target.closest('[data-cgs2-preset]');
            if (preset) setPreset(preset.dataset.cgs2Preset);
            if (event.target.closest('[data-cgs2-reset]')) {
                settings = clone(DEFAULTS);
                applySettings();
                saveSoon();
            }
            if (event.target.closest('[data-cgs2-refresh]')) refreshTargets();
        });
        syncControls();
    }
    function watchDom() {
        if (observer || !document.documentElement) return;
        observer = new MutationObserver(() => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(refreshTargets, 180);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    async function init() {
        try {
            settings = getSettings();
            applySettings();
            await mountPanel();
            watchDom();
            console.info('[云雾玻璃控制台·通用版] 2.0.0 已加载');
        } catch (error) {
            console.error('[云雾玻璃控制台·通用版] 初始化失败', error);
        }
    }
    if (window.jQuery) window.jQuery(init);
    else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
