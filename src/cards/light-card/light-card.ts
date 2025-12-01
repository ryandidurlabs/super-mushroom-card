import {
  css,
  CSSResultGroup,
  html,
  nothing,
  PropertyValues,
  TemplateResult,
} from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  actionHandler,
  ActionHandlerEvent,
  computeRTL,
  handleAction,
  hasAction,
  HomeAssistant,
  isActive,
  LightEntity,
  LovelaceCard,
  LovelaceCardEditor,
} from "../../ha";
import "../../shared/badge-icon";
import "../../shared/button";
import "../../shared/card";
import "../../shared/shape-avatar";
import "../../shared/shape-icon";
import "../../shared/state-info";
import "../../shared/state-item";
import { computeAppearance } from "../../utils/appearance";
import { MushroomBaseCard } from "../../utils/base-card";
import { cardStyle } from "../../utils/card-styles";
import { computeRgbColor } from "../../utils/colors";
import { registerCustomCard } from "../../utils/custom-cards";
import { computeEntityPicture } from "../../utils/info";
import {
  LIGHT_CARD_EDITOR_NAME,
  LIGHT_CARD_NAME,
  LIGHT_ENTITY_DOMAINS,
} from "./const";
import "./controls/light-brightness-control";
import "./controls/light-color-control";
import "./controls/light-color-temp-control";
import { LightCardConfig } from "./light-card-config";
import {
  getRGBColor,
  isColorLight,
  isColorSuperLight,
  supportsBrightnessControl,
  supportsColorControl,
  supportsColorTempControl,
} from "./utils";

type LightCardControl =
  | "brightness_control"
  | "color_temp_control"
  | "color_control";

const CONTROLS_ICONS: Record<LightCardControl, string> = {
  brightness_control: "mdi:brightness-4",
  color_temp_control: "mdi:thermometer",
  color_control: "mdi:palette",
};

registerCustomCard({
  type: LIGHT_CARD_NAME,
  name: "Mushroom Light Card",
  description: "Card for light entity",
});

@customElement(LIGHT_CARD_NAME)
export class LightCard
  extends MushroomBaseCard<LightCardConfig, LightEntity>
  implements LovelaceCard
{
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./light-card-editor");
    return document.createElement(LIGHT_CARD_EDITOR_NAME) as LovelaceCardEditor;
  }

  public static async getStubConfig(
    hass: HomeAssistant
  ): Promise<LightCardConfig> {
    const entities = Object.keys(hass.states);
    const lights = entities.filter((e) =>
      LIGHT_ENTITY_DOMAINS.includes(e.split(".")[0])
    );
    return {
      type: `custom:${LIGHT_CARD_NAME}`,
      entity: lights[0],
    };
  }

  @state() private _activeControl?: LightCardControl;

  @state() private brightness?: number;

  @state() private _timerRemaining?: number; // seconds remaining

  private _timerInterval?: number;

  private _timerExpirationTime?: number; // timestamp when timer expires

  private get _controls(): LightCardControl[] {
    if (!this._config || !this._stateObj) return [];

    const stateObj = this._stateObj;
    const controls: LightCardControl[] = [];
    if (
      this._config.show_brightness_control &&
      supportsBrightnessControl(stateObj)
    ) {
      controls.push("brightness_control");
    }
    if (
      this._config.show_color_temp_control &&
      supportsColorTempControl(stateObj)
    ) {
      controls.push("color_temp_control");
    }
    if (this._config.show_color_control && supportsColorControl(stateObj)) {
      controls.push("color_control");
    }
    return controls;
  }

  protected get hasControls(): boolean {
    return this._controls.length > 0;
  }

  setConfig(config: LightCardConfig): void {
    super.setConfig({
      tap_action: {
        action: "toggle",
      },
      hold_action: {
        action: "more-info",
      },
      ...config,
    });
    this.updateActiveControl();
    this.updateBrightness();
    this.initializeTimer();
  }

  _onControlTap(ctrl, e): void {
    e.stopPropagation();
    this._activeControl = ctrl;
  }

  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (this.hass && changedProperties.has("hass")) {
      this.updateActiveControl();
      this.updateBrightness();
      this.checkTimerState();
    }
    if (changedProperties.has("_config")) {
      this.initializeTimer();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.initializeTimer();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearTimer();
  }

  updateBrightness() {
    this.brightness = undefined;
    const stateObj = this._stateObj;

    if (!stateObj) return;
    this.brightness = stateObj.attributes.brightness;
  }

  private onCurrentBrightnessChange(e: CustomEvent<{ value?: number }>): void {
    if (e.detail.value != null) {
      this.brightness = (e.detail.value * 255) / 100;
    }
  }

  updateActiveControl() {
    const isActiveControlSupported = this._activeControl
      ? this._controls.includes(this._activeControl)
      : false;
    this._activeControl = isActiveControlSupported
      ? this._activeControl
      : this._controls[0];
  }

  private _handleAction(ev: ActionHandlerEvent) {
    const actionType = ev.detail.action;
    if (actionType === "tap" && this._stateObj) {
      const tapAction = this._config?.tap_action;
      if (tapAction?.action === "toggle") {
        // If turning on and timer is enabled, start timer
        if (!isActive(this._stateObj) && this._config?.timer_enabled) {
          // Light will be turned on by handleAction, then we start timer
          handleAction(this, this.hass!, this._config!, actionType);
          setTimeout(() => this.startTimer(), 100);
          return;
        }
        // If turning off, clear timer
        if (isActive(this._stateObj) && this._config?.timer_enabled) {
          this.clearTimer();
        }
      }
    }
    handleAction(this, this.hass!, this._config!, actionType);
  }

  // Timer methods
  private initializeTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity) {
      this.clearTimer();
      return;
    }

    // Check for existing timer in localStorage
    const timerKey = `timer_expiration_${this._config.entity}`;
    const storedExpiration = localStorage.getItem(timerKey);
    
    if (storedExpiration && this._stateObj && isActive(this._stateObj)) {
      const expirationTime = parseInt(storedExpiration, 10);
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((expirationTime - now) / 1000));
      
      if (remaining > 0) {
        this._timerExpirationTime = expirationTime;
        this._timerRemaining = remaining;
        this.startTimerInterval();
      } else {
        // Timer expired - turn off light
        this.turnOffLight();
        this.clearTimer();
      }
    } else {
      this._timerRemaining = undefined;
    }
  }

  private checkTimerState(): void {
    if (!this._config?.timer_enabled || !this._stateObj) {
      this.clearTimer();
      return;
    }

    // If light is off, clear timer
    if (!isActive(this._stateObj)) {
      this.clearTimer();
      return;
    }

    // If light is on and timer is enabled but not running, start it
    if (isActive(this._stateObj) && this._timerRemaining == null) {
      this.startTimer();
    }
  }

  private startTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity || !this._stateObj || !isActive(this._stateObj)) {
      return;
    }

    const duration = this._config.timer_duration || 300; // default 5 minutes
    const expirationTime = Date.now() + duration * 1000;
    
    // Store expiration in localStorage for persistence
    const timerKey = `timer_expiration_${this._config.entity}`;
    localStorage.setItem(timerKey, expirationTime.toString());

    this._timerExpirationTime = expirationTime;
    this._timerRemaining = duration;
    this.startTimerInterval();
  }

  private startTimerInterval(): void {
    this.clearTimer(); // Clear any existing interval
    
    this._timerInterval = window.setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  private updateTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity || !this._timerExpirationTime) {
      this.clearTimer();
      return;
    }

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((this._timerExpirationTime - now) / 1000));
    
    this._timerRemaining = remaining > 0 ? remaining : 0;

    if (remaining <= 0) {
      // Timer expired
      this.turnOffLight();
      this.clearTimer();
    }
  }

  private clearTimer(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = undefined;
    }
    this._timerRemaining = undefined;
    this._timerExpirationTime = undefined;
    
    if (this._config?.entity) {
      const timerKey = `timer_expiration_${this._config.entity}`;
      localStorage.removeItem(timerKey);
    }
  }

  private turnOffLight(): void {
    if (!this.hass || !this._config?.entity) return;
    
    this.hass.callService("light", "turn_off", {
      entity_id: this._config.entity,
    });
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  protected render() {
    if (!this._config || !this.hass || !this._config.entity) {
      return nothing;
    }

    const stateObj = this._stateObj;

    if (!stateObj) {
      return this.renderNotFound(this._config);
    }

    const name = this._config.name || stateObj.attributes.friendly_name || "";
    const icon = this._config.icon;
    const appearance = computeAppearance(this._config);
    const picture = computeEntityPicture(stateObj, appearance.icon_type);

    let stateDisplay = this.hass.formatEntityState(stateObj);
    if (this.brightness != null) {
      const brightness = this.hass.formatEntityAttributeValue(
        stateObj,
        "brightness",
        this.brightness
      );
      stateDisplay = brightness;
      // Add timer countdown if timer is enabled and active
      if (
        this._config?.timer_enabled &&
        isActive(stateObj) &&
        this._timerRemaining != null &&
        this._timerRemaining > 0
      ) {
        stateDisplay = `${stateDisplay} • ${this.formatTime(this._timerRemaining)}`;
      }
    } else if (
      this._config?.timer_enabled &&
      isActive(stateObj) &&
      this._timerRemaining != null &&
      this._timerRemaining > 0
    ) {
      // Add timer even if no brightness
      stateDisplay = `${stateDisplay} • ${this.formatTime(this._timerRemaining)}`;
    }

    const rtl = computeRTL(this.hass);

    const isControlVisible =
      (!this._config.collapsible_controls || isActive(stateObj)) &&
      this._controls.length;

    return html`
      <ha-card
        class=${classMap({ "fill-container": appearance.fill_container })}
      >
        <mushroom-card .appearance=${appearance} ?rtl=${rtl}>
          <mushroom-state-item
            ?rtl=${rtl}
            .appearance=${appearance}
            @action=${this._handleAction}
            .actionHandler=${actionHandler({
              hasHold: hasAction(this._config.hold_action),
              hasDoubleClick: hasAction(this._config.double_tap_action),
            })}
          >
            ${picture
              ? this.renderPicture(picture)
              : this.renderIcon(stateObj, icon)}
            ${this.renderBadge(stateObj)}
            ${this.renderTimerIcon()}
            ${this.renderStateInfo(stateObj, appearance, name, stateDisplay)};
          </mushroom-state-item>
          ${isControlVisible
            ? html`
                <div class="actions" ?rtl=${rtl}>
                  ${this.renderActiveControl(stateObj)}
                  ${this.renderOtherControls()}
                </div>
              `
            : nothing}
        </mushroom-card>
      </ha-card>
    `;
  }

  protected renderTimerIcon(): TemplateResult | typeof nothing {
    if (!this._config?.timer_enabled) {
      return nothing;
    }
    return html`
      <mushroom-badge-icon
        slot="badge"
        .icon=${"mdi:timer-outline"}
        style="--main-color: var(--rgb-secondary-text-color);"
      ></mushroom-badge-icon>
    `;
  }

  protected renderIcon(stateObj: LightEntity, icon?: string): TemplateResult {
    const lightRgbColor = getRGBColor(stateObj);
    const active = isActive(stateObj);
    const iconStyle = {};
    const iconColor = this._config?.icon_color;
    if (lightRgbColor && this._config?.use_light_color) {
      const color = lightRgbColor.join(",");
      iconStyle["--icon-color"] = `rgb(${color})`;
      iconStyle["--shape-color"] = `rgba(${color}, 0.25)`;
      if (isColorLight(lightRgbColor) && !(this.hass.themes as any).darkMode) {
        iconStyle["--shape-outline-color"] =
          `rgba(var(--rgb-primary-text-color), 0.05)`;
        if (isColorSuperLight(lightRgbColor)) {
          iconStyle["--icon-color"] =
            `rgba(var(--rgb-primary-text-color), 0.2)`;
        }
      }
    } else if (iconColor) {
      const iconRgbColor = computeRgbColor(iconColor);
      iconStyle["--icon-color"] = `rgb(${iconRgbColor})`;
      iconStyle["--shape-color"] = `rgba(${iconRgbColor}, 0.2)`;
    }
    return html`
      <mushroom-shape-icon
        slot="icon"
        .disabled=${!active}
        style=${styleMap(iconStyle)}
      >
        <ha-state-icon
          .hass=${this.hass}
          .stateObj=${stateObj}
          .icon=${icon}
        ></ha-state-icon>
      </mushroom-shape-icon>
    `;
  }

  private renderOtherControls(): TemplateResult | null {
    const otherControls = this._controls.filter(
      (control) => control != this._activeControl
    );

    return html`
      ${otherControls.map(
        (ctrl) => html`
          <mushroom-button @click=${(e) => this._onControlTap(ctrl, e)}>
            <ha-icon .icon=${CONTROLS_ICONS[ctrl]}></ha-icon>
          </mushroom-button>
        `
      )}
    `;
  }

  private renderActiveControl(entity: LightEntity) {
    switch (this._activeControl) {
      case "brightness_control":
        const lightRgbColor = getRGBColor(entity);
        const sliderStyle = {};
        const iconColor = this._config?.icon_color;
        if (lightRgbColor && this._config?.use_light_color) {
          const color = lightRgbColor.join(",");
          sliderStyle["--slider-color"] = `rgb(${color})`;
          sliderStyle["--slider-bg-color"] = `rgba(${color}, 0.2)`;
          if (
            isColorLight(lightRgbColor) &&
            !(this.hass.themes as any).darkMode
          ) {
            sliderStyle["--slider-bg-color"] =
              `rgba(var(--rgb-primary-text-color), 0.05)`;
            sliderStyle["--slider-color"] =
              `rgba(var(--rgb-primary-text-color), 0.15)`;
          }
        } else if (iconColor) {
          const iconRgbColor = computeRgbColor(iconColor);
          sliderStyle["--slider-color"] = `rgb(${iconRgbColor})`;
          sliderStyle["--slider-bg-color"] = `rgba(${iconRgbColor}, 0.2)`;
        }
        return html`
          <mushroom-light-brightness-control
            .hass=${this.hass}
            .entity=${entity}
            style=${styleMap(sliderStyle)}
            @current-change=${this.onCurrentBrightnessChange}
          />
        `;
      case "color_temp_control":
        return html`
          <mushroom-light-color-temp-control
            .hass=${this.hass}
            .entity=${entity}
          />
        `;
      case "color_control":
        return html`
          <mushroom-light-color-control .hass=${this.hass} .entity=${entity} />
        `;
      default:
        return nothing;
    }
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      cardStyle,
      css`
        mushroom-state-item {
          cursor: pointer;
        }
        mushroom-shape-icon {
          --icon-color: rgb(var(--rgb-state-light));
          --shape-color: rgba(var(--rgb-state-light), 0.2);
        }
        mushroom-light-brightness-control,
        mushroom-light-color-temp-control,
        mushroom-light-color-control {
          flex: 1;
        }
      `,
    ];
  }
}
