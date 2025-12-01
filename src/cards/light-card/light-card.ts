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
  name: "Super Mushroom Light Card",
  description: "Card for light entity",
});

@customElement("super-mushroom-light-card")
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

  @state() private _showSettingsModal = false;

  private _timerInterval?: number;

  private _timerExpirationTime?: number; // timestamp when timer expires

  private _stateUnsub?: () => void;
  private _motionUnsub?: () => void; // For motion sensor subscription
  private _defaultBrightnessApplied?: boolean; // Track if default brightness was applied for current "on" state

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
    try {
      // Validate entity exists
      if (!config || !config.entity) {
        console.warn("Super Mushroom Light Card: Missing entity in config");
        return;
      }

      // Ensure all optional properties have safe defaults
      const safeConfig: LightCardConfig = {
        tap_action: {
          action: "toggle",
        },
        hold_action: {
          action: "more-info",
        },
        ...config,
        // Ensure timer properties are defined
        timer_enabled: config.timer_enabled ?? false,
        timer_duration: config.timer_duration ?? 300,
        default_brightness_enabled: config.default_brightness_enabled ?? false,
        default_brightness: config.default_brightness ?? undefined,
        motion_enabled: config.motion_enabled ?? false,
        motion_sensor: config.motion_sensor ?? undefined,
      };
      
      super.setConfig(safeConfig);
      
      // Only update if hass is available
      if (this.hass) {
        this.updateActiveControl();
        this.updateBrightness();
        this.initializeTimer();
      }
    } catch (error) {
      console.error("Super Mushroom Light Card: Error setting config", error);
      // Set minimal config to prevent complete failure
      try {
        super.setConfig({
          type: `custom:${LIGHT_CARD_NAME}`,
          tap_action: { action: "toggle" },
          hold_action: { action: "more-info" },
          entity: config?.entity || "",
        });
      } catch (e) {
        console.error("Super Mushroom Light Card: Failed to set minimal config", e);
      }
    }
  }

  _onControlTap(ctrl, e): void {
    e.stopPropagation();
    this._activeControl = ctrl;
  }

  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    try {
      if (this.hass && changedProperties.has("hass")) {
        this.updateActiveControl();
        this.updateBrightness();
        this.initializeTimer();
        this.checkTimerState();
        this.subscribeToStateChanges();
        this.subscribeToMotionSensor();
      }
      if (changedProperties.has("_config")) {
        this.initializeTimer();
        this.checkTimerState();
        if (this.hass) {
          this.subscribeToStateChanges();
          this.subscribeToMotionSensor();
        }
      }
      // Don't call requestUpdate() here - it causes infinite loops
      // The timer interval will handle updates via updateTimer()
    } catch (error) {
      console.warn("Super Mushroom Light Card: Error in updated lifecycle", error);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    try {
      if (this.hass) {
        this.initializeTimer();
        this.checkTimerState();
        this.subscribeToStateChanges();
        this.subscribeToMotionSensor();
      }
    } catch (error) {
      console.warn("Super Mushroom Light Card: Error in connectedCallback", error);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearTimer();
    if (this._stateUnsub) {
      this._stateUnsub();
      this._stateUnsub = undefined;
    }
    if (this._motionUnsub) {
      this._motionUnsub();
      this._motionUnsub = undefined;
    }
  }

  private subscribeToStateChanges(): void {
    if (!this.hass?.connection || !this._config?.entity) {
      // Clean up if conditions not met
      if (this._stateUnsub) {
        try {
          this._stateUnsub();
        } catch (e) {
          // Ignore errors during cleanup
        }
        this._stateUnsub = undefined;
      }
      return;
    }

    // Unsubscribe from previous subscription if any
    if (this._stateUnsub) {
      try {
        this._stateUnsub();
      } catch (e) {
        // Ignore errors during cleanup
      }
      this._stateUnsub = undefined;
    }

    try {
      this.hass.connection.subscribeEvents(
        (ev: any) => {
          try {
            if (ev?.data?.entity_id === this._config?.entity) {
              const newState = ev.data.new_state;
              const oldState = ev.data.old_state;
              
              // If light just turned on and timer is enabled, start timer
              if (
                newState?.state === "on" &&
                oldState?.state !== "on" &&
                this._config?.timer_enabled &&
                !this._timerRemaining
              ) {
                this.startTimer();
              }
              
              // Note: Default brightness is now handled in _handleAction when user clicks the card
              // This prevents loops from state change events
              
              // If light just turned off, clear timer and reset default brightness flag
              if (
                newState?.state === "off" &&
                oldState?.state === "on"
              ) {
                if (this._config?.timer_enabled) {
                  this.clearTimer();
                }
                this._defaultBrightnessApplied = false;
              }
              
              // Update brightness - don't call requestUpdate() here to avoid loops
              // The timer interval and Lit's reactive system will handle updates
              this.updateBrightness();
            }
          } catch (e) {
            console.warn("Super Mushroom Light Card: Error in state change handler", e);
          }
        },
        "state_changed"
      ).then((unsub) => {
        this._stateUnsub = unsub;
      }).catch((e) => {
        console.warn("Super Mushroom Light Card: Error subscribing to state changes", e);
      });
    } catch (e) {
      console.warn("Super Mushroom Light Card: Error subscribing to state changes", e);
    }
  }

  private subscribeToMotionSensor(): void {
    if (!this.hass?.connection || !this._config?.motion_enabled || !this._config?.motion_sensor || !this._config?.entity) {
      // Unsubscribe if motion is disabled or config invalid
      if (this._motionUnsub) {
        try {
          this._motionUnsub();
        } catch (e) {
          // Ignore errors during cleanup
        }
        this._motionUnsub = undefined;
      }
      return;
    }

    // Unsubscribe from previous subscription if any
    if (this._motionUnsub) {
      try {
        this._motionUnsub();
      } catch (e) {
        // Ignore errors during cleanup
      }
      this._motionUnsub = undefined;
    }

    try {
      this.hass.connection.subscribeEvents(
        (ev: any) => {
          try {
            if (ev?.data?.entity_id === this._config?.motion_sensor) {
              const newState = ev.data.new_state;
              const oldState = ev.data.old_state;
              
              // If motion sensor turns on (motion detected), turn on the light
              if (
                newState?.state === "on" &&
                oldState?.state !== "on" &&
                this._config?.entity &&
                this.hass
              ) {
                // Apply default brightness if enabled
                if (
                  this._config?.default_brightness_enabled &&
                  this._config?.default_brightness != null &&
                  this._config?.default_brightness >= 0 &&
                  this._config?.default_brightness <= 100 &&
                  this._stateObj &&
                  supportsBrightnessControl(this._stateObj)
                ) {
                  this.hass.callService("light", "turn_on", {
                    entity_id: this._config.entity,
                    brightness_pct: this._config.default_brightness,
                  });
                } else {
                  this.hass.callService("light", "turn_on", {
                    entity_id: this._config.entity,
                  });
                }
                
                // Start timer if enabled
                if (this._config?.timer_enabled && !this._timerRemaining) {
                  setTimeout(() => this.startTimer(), 200);
                }
              }
            }
          } catch (e) {
            console.warn("Super Mushroom Light Card: Error in motion sensor handler", e);
          }
        },
        "state_changed"
      ).then((unsub) => {
        this._motionUnsub = unsub;
      }).catch((e) => {
        console.warn("Super Mushroom Light Card: Error subscribing to motion sensor", e);
      });
    } catch (e) {
      console.warn("Super Mushroom Light Card: Error subscribing to motion sensor", e);
    }
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
    if (!this.hass || !this._config || !this._stateObj) {
      return;
    }

    try {
      const actionType = ev.detail?.action;
      if (actionType === "tap") {
        const tapAction = this._config.tap_action;
        if (tapAction?.action === "toggle") {
          const wasOff = !isActive(this._stateObj);
          
          // If turning on, apply default brightness first (if enabled)
          if (wasOff && 
              this._config.default_brightness_enabled &&
              this._config.default_brightness != null &&
              this._config.default_brightness >= 0 &&
              this._config.default_brightness <= 100) {
            if (supportsBrightnessControl(this._stateObj)) {
              // Turn on with default brightness
              this.hass.callService("light", "turn_on", {
                entity_id: this._config.entity,
                brightness_pct: this._config.default_brightness,
              });
              this._defaultBrightnessApplied = true;
              
              // Start timer if enabled
              if (this._config.timer_enabled) {
                setTimeout(() => this.startTimer(), 200);
              }
              return; // Don't call handleAction again - we already handled it
            }
          }
          
          // If turning on and timer is enabled (but no default brightness), start timer after toggle
          if (wasOff && this._config.timer_enabled) {
            // Light will be turned on by handleAction, then we start timer
            handleAction(this, this.hass, this._config, actionType);
            // Wait a bit to ensure state has updated
            setTimeout(() => {
              if (this._stateObj && isActive(this._stateObj)) {
                this.startTimer();
              }
            }, 300);
            return; // Don't call handleAction again - we already handled it
          }
          
          // If turning off, clear timer and reset default brightness flag
          if (!wasOff) {
            if (this._config.timer_enabled) {
              this.clearTimer();
            }
            this._defaultBrightnessApplied = false;
          }
        }
      }
      // Call handleAction for all other cases (non-toggle actions, or toggle without special handling)
      handleAction(this, this.hass, this._config, actionType);
    } catch (e) {
      console.warn("Super Mushroom Light Card: Error handling action", e);
    }
  }

  // Timer methods
  private initializeTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity) {
      // Timer disabled - clear any existing timer
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
        this._timerInterval = undefined;
      }
      this._timerRemaining = undefined;
      this._timerExpirationTime = undefined;
      return;
    }

    // Always check localStorage first for existing timer
    const timerKey = `timer_expiration_${this._config.entity}`;
    const storedExpiration = localStorage.getItem(timerKey);
    
    // If we have a stored timer and the light is on, restore it
    if (storedExpiration && this._stateObj && isActive(this._stateObj)) {
      const expirationTime = parseInt(storedExpiration, 10);
      
      if (isNaN(expirationTime)) {
        // Invalid stored value - clear it
        localStorage.removeItem(timerKey);
        localStorage.removeItem(`${timerKey}_start`);
        return;
      }
      
      // Calculate remaining time based on expiration time (works even after page reload)
      const now = Date.now();
      const calculatedRemaining = Math.max(0, Math.ceil((expirationTime - now) / 1000));
      
      if (calculatedRemaining > 0) {
        // Restore timer from localStorage - this continues counting from where it left off
        this._timerExpirationTime = expirationTime;
        this._timerRemaining = calculatedRemaining;
        
        // Clear any existing interval before starting a new one
        if (this._timerInterval) {
          clearInterval(this._timerInterval);
          this._timerInterval = undefined;
        }
        
        // Start the interval to continue counting
        this.startTimerInterval();
        return; // Don't start a new timer - we restored the existing one
      } else {
        // Timer expired while page was away - turn off light and clear
        this.turnOffLight();
        this.clearTimer();
        return;
      }
    }
    
    // No stored timer - if light is on and timer is enabled, start a new one
    if (this._stateObj && isActive(this._stateObj) && !this._timerRemaining) {
      this.startTimer();
    } else if (!this._stateObj || !isActive(this._stateObj)) {
      // Light is off - clear any stored timer
      this.clearTimer();
    }
  }

  private checkTimerState(): void {
    if (!this._config?.timer_enabled || !this._stateObj) {
      // Timer disabled or no state - clear interval but don't clear localStorage
      // (in case timer gets re-enabled)
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
        this._timerInterval = undefined;
      }
      this._timerRemaining = undefined;
      this._timerExpirationTime = undefined;
      return;
    }

    // If light is off, clear timer and localStorage
    if (!isActive(this._stateObj)) {
      this.clearTimer();
      return;
    }

    // If light is on and timer is enabled but not running, check localStorage first
    // This is a fallback in case initializeTimer didn't run or didn't restore properly
    if (isActive(this._stateObj) && this._timerRemaining == null && !this._timerInterval) {
      const timerKey = `timer_expiration_${this._config.entity}`;
      const storedExpiration = localStorage.getItem(timerKey);
      
      if (storedExpiration) {
        // There's a stored timer - restore it
        const expirationTime = parseInt(storedExpiration, 10);
        if (!isNaN(expirationTime)) {
          const now = Date.now();
          const calculatedRemaining = Math.max(0, Math.ceil((expirationTime - now) / 1000));
          
          if (calculatedRemaining > 0) {
            this._timerExpirationTime = expirationTime;
            this._timerRemaining = calculatedRemaining;
            this.startTimerInterval();
            return; // Restored from localStorage
          } else {
            // Timer expired
            this.turnOffLight();
            this.clearTimer();
            return;
          }
        }
      }
      
      // No stored timer - start a new one
      this.startTimer();
    }
  }

  private startTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity || !this._stateObj) {
      return;
    }

    // Wait a bit for state to update after toggle
    setTimeout(() => {
      if (!this._stateObj || !isActive(this._stateObj)) {
        return;
      }

      const duration = (this._config?.timer_duration || 300); // default 5 minutes
      const expirationTime = Date.now() + duration * 1000;
      
      // Store expiration time in localStorage for persistence across page reloads
      const timerKey = `timer_expiration_${this._config?.entity || ""}`;
      localStorage.setItem(timerKey, expirationTime.toString());

      this._timerExpirationTime = expirationTime;
      this._timerRemaining = duration;
      
      // Clear any existing interval before starting a new one
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
        this._timerInterval = undefined;
      }
      
      this.startTimerInterval();
      // Don't call requestUpdate() - Lit's @state() will handle it
    }, 200);
  }

  private startTimerInterval(): void {
    // Clear any existing interval first
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = undefined;
    }
    
    // Start new interval
    this._timerInterval = window.setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  private updateTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity || !this._timerExpirationTime) {
      this.clearTimer();
      return;
    }

    // Check if light is still on
    if (!this._stateObj || !isActive(this._stateObj)) {
      this.clearTimer();
      return;
    }

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((this._timerExpirationTime - now) / 1000));
    
    // Update the state - this is a @state() property so it will automatically trigger Lit to re-render
    // Only update if value changed to avoid unnecessary re-renders
    const oldRemaining = this._timerRemaining;
    this._timerRemaining = remaining > 0 ? remaining : 0;
    
    // Only request update if value actually changed
    if (oldRemaining !== this._timerRemaining) {
      this.requestUpdate();
    }

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
      localStorage.removeItem(`${timerKey}_start`);
    }
  }
  
  private turnOffLight(): void {
    if (!this.hass || !this._config?.entity) return;
    
    try {
      this.hass.callService("light", "turn_off", {
        entity_id: this._config.entity,
      });
      // Reset default brightness flag when light is turned off
      this._defaultBrightnessApplied = false;
    } catch (e) {
      console.warn("Super Mushroom Light Card: Error turning off light", e);
    }
  }

  private formatTime(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }
    
    // Ensure entity is defined
    if (!this._config.entity) {
      return nothing;
    }

    const stateObj = this._stateObj;

    if (!stateObj) {
      return this.renderNotFound(this._config);
    }
    
    // Ensure config properties are safely accessed
    try {

    const name = this._config.name || stateObj.attributes.friendly_name || "";
    const icon = this._config.icon;
    const appearance = computeAppearance(this._config);
    const picture = computeEntityPicture(stateObj, appearance.icon_type);

    // Get the base state display
    let stateDisplay = this.hass.formatEntityState(stateObj);
    
    // If brightness is available, use brightness percentage instead
    if (this.brightness != null) {
      const brightness = this.hass.formatEntityAttributeValue(
        stateObj,
        "brightness",
        this.brightness
      );
      stateDisplay = brightness;
    }
    
    // Always add timer countdown next to state/brightness if timer is enabled and active
    // This MUST be added to stateDisplay before passing to renderStateInfo
    if (
      this._config?.timer_enabled &&
      isActive(stateObj) &&
      this._timerRemaining != null &&
      this._timerRemaining >= 0
    ) {
      const timeStr = this.formatTime(this._timerRemaining);
      // Add timer directly to the stateDisplay string
      stateDisplay = `${stateDisplay} • ${timeStr}`;
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
          ${appearance.layout !== "horizontal" ? this.renderSettingsIcon() : nothing}
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
            ${this.renderMotionIcon()}
            ${this.renderStateInfo(stateObj, appearance, name, stateDisplay)};
          </mushroom-state-item>
          ${isControlVisible
            ? html`
                <div class="actions" ?rtl=${rtl}>
                  ${this.renderActiveControl(stateObj)}
                  ${this.renderOtherControls()}
                  ${appearance.layout === "horizontal" ? this.renderSettingsIcon() : nothing}
                </div>
              `
            : nothing}
        </mushroom-card>
        ${this.renderSettingsModal()}
      </ha-card>
    `;
    } catch (error) {
      console.error("Super Mushroom Light Card: Error rendering", error);
      return html`
        <ha-card>
          <div class="card-content">
            <div class="error">Error rendering card. Please check configuration.</div>
          </div>
        </ha-card>
      `;
    }
  }

  protected renderTimerIcon(): TemplateResult | typeof nothing {
    if (!this._config?.timer_enabled) {
      return nothing;
    }
    // Position timer icon at top-right when both icons are present, otherwise default position
    const hasMotion = this._config?.motion_enabled;
    const topOffset = hasMotion ? "-8px" : "-3px";
    const rtl = computeRTL(this.hass);
    const horizontalPos = rtl ? "left: -3px; right: auto;" : "right: -3px; left: auto;";
    return html`
      <div slot="badge" class="timer-badge-wrapper" style="position: absolute; top: ${topOffset}; ${horizontalPos} bottom: auto;">
        <mushroom-badge-icon
          class="timer-badge"
          .icon=${"mdi:timer-outline"}
          style="--main-color: var(--rgb-secondary-text-color);"
        ></mushroom-badge-icon>
      </div>
    `;
  }

  protected renderMotionIcon(): TemplateResult | typeof nothing {
    if (!this._config?.motion_enabled) {
      return nothing;
    }
    // Position motion icon at top-left when both icons are present, otherwise default position
    const hasTimer = this._config?.timer_enabled;
    const topOffset = hasTimer ? "-8px" : "-3px";
    const rtl = computeRTL(this.hass);
    const horizontalPos = rtl ? "right: -3px; left: auto;" : "left: -3px; right: auto;";
    return html`
      <div slot="badge" class="motion-badge-wrapper" style="position: absolute; top: ${topOffset}; ${horizontalPos} bottom: auto;">
        <mushroom-badge-icon
          class="motion-badge"
          .icon=${"mdi:motion-sensor"}
          style="--main-color: var(--rgb-secondary-text-color);"
        ></mushroom-badge-icon>
      </div>
    `;
  }

  protected renderSettingsIcon(): TemplateResult | typeof nothing {
    if (!this._config) {
      return nothing;
    }
    return html`
      <div class="settings-icon-container" @click=${this._openSettings} title="Settings">
        <ha-icon
          .icon=${"mdi:cog"}
          class="settings-icon"
        ></ha-icon>
      </div>
    `;
  }

  private _openSettings(e: Event): void {
    e.stopPropagation();
    e.preventDefault();
    this._showSettingsModal = true;
    this.requestUpdate();
  }

  private _closeSettingsModal(): void {
    this._showSettingsModal = false;
    this.requestUpdate();
  }

  private _handleTimerToggle(e: Event): void {
    const target = e.target as any;
    const enabled = target.checked;
    if (this._config) {
      const newConfig = {
        ...this._config,
        timer_enabled: enabled,
      };
      this._updateConfig(newConfig);
    }
  }

  private _handleMotionToggle(e: Event): void {
    const target = e.target as any;
    const enabled = target.checked;
    if (this._config) {
      const newConfig = {
        ...this._config,
        motion_enabled: enabled,
      };
      this._updateConfig(newConfig);
    }
  }

  private _handleTimerDurationChange(e: Event): void {
    const target = e.target as any;
    const duration = parseInt(target.value, 10);
    if (this._config && !isNaN(duration) && duration > 0) {
      const newConfig = {
        ...this._config,
        timer_duration: duration,
      };
      this._updateConfig(newConfig);
    }
  }


  private _updateConfig(newConfig: LightCardConfig): void {
    this.setConfig(newConfig);
    // Fire config-changed event to sync with UI editor
    const event = new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config: newConfig },
    });
    this.dispatchEvent(event);
    this.requestUpdate();
  }

  protected renderSettingsModal(): TemplateResult | typeof nothing {
    if (!this._showSettingsModal || !this._config || !this.hass) {
      return nothing;
    }

    return html`
      <div class="settings-modal-overlay" @click=${this._closeSettingsModal}>
        <div class="settings-modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="settings-modal-header">
            <div class="settings-modal-title">Settings</div>
            <ha-icon-button
              .icon=${"mdi:close"}
              @click=${this._closeSettingsModal}
              class="settings-modal-close"
            ></ha-icon-button>
          </div>
          <div class="settings-modal-content">
            <div class="settings-section">
              <div class="settings-row">
                <div class="settings-label-group">
                  <div class="settings-label">Enable Timer</div>
                  <div class="settings-description">
                    Automatically turn off after duration
                  </div>
                </div>
                <ha-switch
                  .checked=${this._config.timer_enabled || false}
                  @change=${this._handleTimerToggle}
                ></ha-switch>
              </div>
              ${this._config.timer_enabled
                ? html`
                    <div class="settings-row">
                      <div class="settings-label">Timer Duration (seconds)</div>
                      <ha-textfield
                        .value=${String(this._config.timer_duration || 300)}
                        type="number"
                        min="1"
                        max="3000"
                        @change=${this._handleTimerDurationChange}
                        class="settings-input"
                      ></ha-textfield>
                    </div>
                  `
                : nothing}
            </div>
            <div class="settings-section">
              <div class="settings-row">
                <div class="settings-label-group">
                  <div class="settings-label">Enable Motion Sensor</div>
                  <div class="settings-description">
                    Automatically control based on motion
                  </div>
                </div>
                <ha-switch
                  .checked=${this._config.motion_enabled || false}
                  @change=${this._handleMotionToggle}
                ></ha-switch>
              </div>
            </div>
          </div>
        </div>
      </div>
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
        ha-card {
          position: relative;
        }
        .settings-icon-container {
          position: absolute;
          top: 8px;
          right: 8px;
          left: auto;
          z-index: 1000;
          cursor: pointer;
          pointer-events: auto;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          align-items: center;
          justify-content: center;
        }
        .actions .settings-icon-container {
          position: relative;
          top: auto;
          right: auto;
          left: auto;
          margin-left: 8px;
          flex-shrink: 0;
        }
        .settings-icon {
          --mdc-icon-size: 16px;
          color: var(--secondary-text-color);
          opacity: 0.7;
          pointer-events: auto;
          display: block !important;
          visibility: visible !important;
          width: 16px;
          height: 16px;
        }
        .settings-icon:hover {
          opacity: 1 !important;
        }
        .settings-icon-container ha-icon {
          pointer-events: auto;
          display: block !important;
          visibility: visible !important;
        }
        mushroom-card {
          position: relative;
        }
        /* RTL support for badge wrappers - inline styles handle positioning */
        mushroom-state-item[rtl] .icon ::slotted(.timer-badge-wrapper) {
          right: auto !important;
          left: -3px !important;
        }
        mushroom-state-item[rtl] .icon ::slotted(.motion-badge-wrapper) {
          right: auto !important;
          left: -3px !important;
        }
        /* Settings Modal Styles */
        .settings-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .settings-modal {
          background-color: var(--card-background-color, #fff);
          border-radius: var(--mdc-shape-medium, 4px);
          box-shadow: 0 8px 10px 1px rgba(0, 0, 0, 0.14),
            0 3px 14px 2px rgba(0, 0, 0, 0.12),
            0 5px 5px -3px rgba(0, 0, 0, 0.2);
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .settings-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        }
        .settings-modal-title {
          font-size: 20px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .settings-modal-close {
          color: var(--secondary-text-color);
        }
        .settings-modal-content {
          padding: 24px;
          flex: 1;
        }
        .settings-section {
          margin-bottom: 24px;
        }
        .settings-section:last-child {
          margin-bottom: 0;
        }
        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 16px;
        }
        .settings-row:last-child {
          margin-bottom: 0;
        }
        .settings-label-group {
          flex: 1;
        }
        .settings-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color);
          margin-bottom: 4px;
        }
        .settings-description {
          font-size: 12px;
          color: var(--secondary-text-color);
        }
        .settings-input {
          width: 150px;
          flex-shrink: 0;
        }
        .settings-select {
          width: 200px;
          flex-shrink: 0;
        }
      `,
    ];
  }
}
