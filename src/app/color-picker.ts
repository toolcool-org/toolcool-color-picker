// @ts-ignore: esbuild custom loader
import styles from './styles.pcss';
import tinycolor from 'tinycolor2';
import ColorPickerPopup from '../ui/popup/popup';
import {
    CUSTOM_EVENT_COLOR_HSV_CHANGED,
    CUSTOM_EVENT_COLOR_HUE_CHANGED,
    CUSTOM_EVENT_COLOR_ALPHA_CHANGED,
} from '../domain/events-provider';
import { getUniqueId } from '../domain/common-provider';
import { getRgbaBackground, parseColor } from '../domain/color-provider';

/*
 Usage:
 ------
 <toolcool-color-picker color="#ff0000"></toolcool-color-picker>
 */
interface IColorPickerState {
    isPopupVisible: boolean,
    initialColor: tinycolor.Instance,
    color: tinycolor.Instance,
}

class ColorPicker extends HTMLElement {

    // ----------- APIs ------------------------
    public get value() {
        return getRgbaBackground(this.state.color)
    }

    public set value(updateColor: string) {
        this.state.color = tinycolor(updateColor);
    }

    public get opened() {
        return this.state.isPopupVisible;
    }

    public set opened(isOpened: boolean) {
        this.state.isPopupVisible = isOpened;
    }

    // -----------------------------------------

    // this id attribute is used for custom events
    public readonly cid: string;

    private $button: HTMLElement;
    private $buttonColor: HTMLElement;
    private $popupBox: HTMLElement;

    private stateDefaults: IColorPickerState = {
        isPopupVisible: false,
        initialColor: tinycolor('#000'),
        color: tinycolor('#000'),
    };
    private state: IColorPickerState;

    constructor() {
        super();

        this.cid = getUniqueId();

        // register web components
        if(!customElements.get('toolcool-color-picker-popup')){
            customElements.define('toolcool-color-picker-popup', ColorPickerPopup);
        }

        this.attachShadow({
            mode: 'open', // 'closed', 'open',
        });

        this.toggle = this.toggle.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.clickedOutside = this.clickedOutside.bind(this);

        this.colorHsvChangedCustomEvent = this.colorHsvChangedCustomEvent.bind(this);
        this.colorHueChangedCustomEvent = this.colorHueChangedCustomEvent.bind(this);
        this.colorAlphaChangedCustomEvent = this.colorAlphaChangedCustomEvent.bind(this);

        this.initState();
    }

    initState() {
        // eslint-disable-next-line
        const scope = this;
        this.state = new Proxy(scope.stateDefaults, {

            // eslint-disable-next-line
            set(target: IColorPickerState, key: string | symbol, value: any, receiver: any): boolean {
                target[key] = value;

                if(key === 'isPopupVisible'){
                    scope.onPopupVisibilityChange();
                }

                if(key === 'initialColor'){
                    scope.onInitialColorChange();
                }

                if(key === 'color'){
                    scope.onColorChange();
                }

                return true;
            },
        });
    }

    onPopupVisibilityChange() {
        if(!this.$popupBox) return true;
        this.$popupBox.innerHTML = this.state.isPopupVisible ?
            `<toolcool-color-picker-popup color="${ this.state.color.toRgbString() }" cid="${ this.cid }" />` :
            '';
    }

    onInitialColorChange() {
        const bgColor = getRgbaBackground(this.state.color);

        if(this.$buttonColor){
            this.$buttonColor.style.backgroundColor = bgColor;
        }

        const $popup = this.shadowRoot.querySelector('toolcool-color-picker-popup');
        if($popup){
            $popup.setAttribute('color', bgColor);
        }
    }

    onColorChange() {
        const bgColor = getRgbaBackground(this.state.color);

        if(this.$buttonColor){
            this.$buttonColor.style.backgroundColor = getRgbaBackground(this.state.color);
        }

        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                value: bgColor,
            }
        }));
    }

    colorHsvChangedCustomEvent(evt: CustomEvent) {
        if(!evt || !evt.detail || !evt.detail.cid) return;

        // handle only current instance
        if(evt.detail.cid !== this.cid) return;

        this.state.color = tinycolor.fromRatio({
            h: evt.detail.h,
            s: evt.detail.s,
            v: evt.detail.v,
            a: this.state.color.toHsv().a,
        });
    }

    colorHueChangedCustomEvent(evt: CustomEvent) {

        if(!evt || !evt.detail || !evt.detail.cid) return;

        // handle only current instance
        if(evt.detail.cid !== this.cid) return;

        const hsv = this.state.color.toHsv();

        this.state.color = tinycolor.fromRatio({
            h: evt.detail.h,
            s: hsv.s,
            v: hsv.v,
            a: hsv.a,
        });
    }

    colorAlphaChangedCustomEvent(evt: CustomEvent) {

        if(!evt || !evt.detail || !evt.detail.cid) return;

        // handle only current instance
        if(evt.detail.cid !== this.cid) return;

        const rgba = this.state.color.toRgb();
        rgba.a = evt.detail.a;

        this.state.color = tinycolor(rgba);
    }

    clickedOutside() {
        this.state.isPopupVisible = false;
    }

    toggle() {
        const isVisible = this.state.isPopupVisible;

        // setTimeout is used instead stopPropagation
        // to close other popup instances
        window.setTimeout(() => {
            this.state.isPopupVisible = !isVisible;
        }, 0);
    }

    onKeyDown(evt: KeyboardEvent) {
        if(evt.key === 'Escape') {

            // close the popup
            this.state.isPopupVisible = false;
        }
    }

    /**
     * when the custom element connected to DOM
     */
    connectedCallback() {

        this.state.initialColor = parseColor(this.getAttribute('color'));
        this.state.color = parseColor(this.getAttribute('color'));

        this.shadowRoot.innerHTML = `
            <style>${ styles }</style>
            <div class="color-picker">
                <button
                    type="button"
                    tabIndex="0"
                    class="color-picker__button"
                    title="Select Color">
                    <span class="color-picker__button-color" style="background: ${ getRgbaBackground(this.state.color) }"></span>
                </button>
                <div data-popup-box></div>
            </div>
        `;

        // init button and its events
        this.$button = this.shadowRoot.querySelector('.color-picker__button');
        this.$buttonColor = this.shadowRoot.querySelector('.color-picker__button-color');

        this.$button.addEventListener('click', this.toggle);
        this.$button.addEventListener('keydown', this.onKeyDown);

        // init popup container
        this.$popupBox = this.shadowRoot.querySelector('[data-popup-box]');

        // close popup when clicked outside
        document.addEventListener('click', this.clickedOutside);

        // custom event from other parts of the app
        document.addEventListener(CUSTOM_EVENT_COLOR_HSV_CHANGED, this.colorHsvChangedCustomEvent);
        document.addEventListener(CUSTOM_EVENT_COLOR_HUE_CHANGED, this.colorHueChangedCustomEvent);
        document.addEventListener(CUSTOM_EVENT_COLOR_ALPHA_CHANGED, this.colorAlphaChangedCustomEvent);
    }

    /**
     * when the custom element disconnected from DOM
     */
    disconnectedCallback(){
        this.$button.removeEventListener('click', this.toggle);
        this.$button.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('click', this.clickedOutside);

        document.removeEventListener(CUSTOM_EVENT_COLOR_HSV_CHANGED, this.colorHsvChangedCustomEvent);
        document.removeEventListener(CUSTOM_EVENT_COLOR_HUE_CHANGED, this.colorHueChangedCustomEvent);
        document.removeEventListener(CUSTOM_EVENT_COLOR_ALPHA_CHANGED, this.colorAlphaChangedCustomEvent);
    }

    /**
     * when attributes change
     */
    attributeChangedCallback(){
        this.state.initialColor = parseColor(this.getAttribute('color'));
        this.state.color = parseColor(this.getAttribute('color'));
        this.onInitialColorChange();
    }
}

export default ColorPicker;